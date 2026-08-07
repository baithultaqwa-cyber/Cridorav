import { useCallback, useEffect, useState } from 'react'
import { Download, Bell, X, Share2, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useBottomDock } from '../../context/BottomDockContext'
import { isStandaloneDisplay } from './isStandaloneDisplay'
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  promptPwaInstall,
  subscribeDeferredInstallPrompt,
} from './pwaInstallPrompt'
import { enablePushNotifications, isIosDevice } from '../pushNotifications/enablePush'

const DISMISS_KEY = 'cridora_mobile_install_cta_dismissed'
const PENDING_PUSH_KEY = 'cridora_enable_push_after_install'

/**
 * Sticky bottom CTA (all screen sizes): one tap installs the PWA (when the
 * browser allows) and requests notification permission / push subscription.
 *
 * Docks just above the "Buy Gold Now" invest bar while that bar sits at the
 * bottom of the viewport, then drops into the freed bottom spot once the
 * invest bar pins to the top (see `BottomDockContext`) — so it never
 * overlaps other bottom UI or crowds the navbar.
 */
export default function InstallNotifyCta() {
  const { authFetch, user } = useAuth()
  const { investBarAtBottom, mobileTabsVisible } = useBottomDock()
  const [visible, setVisible] = useState(false)
  const [deferred, setDeferred] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [iosSheet, setIosSheet] = useState(false)
  const [standalone, setStandalone] = useState(() =>
    typeof window !== 'undefined' ? isStandaloneDisplay() : false,
  )
  const ios = isIosDevice()

  const recompute = useCallback(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') {
        setVisible(false)
        return
      }
    } catch {
      /* ignore */
    }
    const alone = isStandaloneDisplay()
    setStandalone(alone)
    // Hide when already installed AND notifications already granted (or no login needed yet)
    const notifOk =
      typeof Notification !== 'undefined' && Notification.permission === 'granted'
    if (alone && notifOk) {
      setVisible(false)
      return
    }
    setVisible(true)
  }, [])

  useEffect(() => {
    recompute()
    const unsub = subscribeDeferredInstallPrompt(setDeferred)
    window.addEventListener('appinstalled', recompute)
    return () => {
      unsub()
      window.removeEventListener('appinstalled', recompute)
    }
  }, [recompute])

  // After iOS Add-to-Home-Screen, remind on first standalone open
  useEffect(() => {
    if (!standalone) return
    try {
      if (localStorage.getItem(PENDING_PUSH_KEY) === '1') {
        setVisible(true)
        setMsg('App installed — tap below to enable alerts.')
      }
    } catch {
      /* ignore */
    }
  }, [standalone])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
    setIosSheet(false)
  }

  const runOneClick = async () => {
    if (busy) return
    setBusy(true)
    setMsg('')
    try {
      // iOS Safari (not installed): cannot install programmatically — show Share steps
      if (ios && !standalone && !getDeferredInstallPrompt()) {
        try {
          localStorage.setItem(PENDING_PUSH_KEY, '1')
        } catch {
          /* ignore */
        }
        setIosSheet(true)
        return
      }

      // 1) Install when Chrome/Edge deferred prompt is available
      if (getDeferredInstallPrompt() || deferred) {
        const result = await promptPwaInstall()
        clearDeferredInstallPrompt()
        setDeferred(null)
        if (result.outcome === 'dismissed') {
          setMsg('Install cancelled. You can try again anytime.')
          return
        }
      }

      // 2) Notifications (same gesture chain — browsers allow this after install prompt).
      // Works signed-out too (e.g. for price alerts) — the subscription is claimed by their
      // account automatically the next time they open the app signed in.
      const push = await enablePushNotifications(user ? authFetch : undefined)
      if (push.ok) {
        try {
          localStorage.removeItem(PENDING_PUSH_KEY)
        } catch {
          /* ignore */
        }
        setMsg('Installed and alerts enabled.')
        setTimeout(() => setVisible(false), 1600)
      } else if (push.error === 'ios_install_required') {
        try {
          localStorage.setItem(PENDING_PUSH_KEY, '1')
        } catch {
          /* ignore */
        }
        setIosSheet(true)
      } else if (push.error === 'denied') {
        setMsg('Notifications were blocked. Enable them in browser settings.')
      } else if (push.error === 'no_vapid') {
        setMsg('App install done. Alerts need server VAPID config.')
      } else {
        setMsg(push.detail || 'Could not enable alerts. Try again from Settings.')
      }
      recompute()
    } finally {
      setBusy(false)
    }
  }

  if (!visible) return null

  const label = standalone
    ? 'Enable notifications'
    : ios && !deferred
      ? 'Install app & alerts'
      : 'Install app & enable alerts'

  // Stack above mobile tabs and/or the invest bar; never overlap bottom chrome.
  const dockedBottom = mobileTabsVisible
    ? 'calc(var(--app-tab-h, 3.75rem) + env(safe-area-inset-bottom, 0px) + 0.75rem)'
    : investBarAtBottom
      ? 'calc(var(--invest-bar-h) + env(safe-area-inset-bottom, 0px) + 0.75rem)'
      : 'calc(0.75rem + env(safe-area-inset-bottom, 0px))'

  return (
    <>
      <div
        className="fixed inset-x-0 z-[45] px-3 pointer-events-none"
        style={{ bottom: dockedBottom, transition: 'bottom 0.3s ease' }}
      >
        <div
          className="pointer-events-auto mx-auto max-w-md rounded-2xl shadow-lg flex items-stretch gap-1 overflow-hidden"
          style={{
            background: 'var(--bg-secondary, #141416)',
            border: '1px solid rgba(232,195,74,0.35)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => void runOneClick()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-[11px] font-bold tracking-widest uppercase disabled:opacity-60 min-h-[48px]"
            style={{ color: 'var(--gold)' }}
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : standalone ? (
              <Bell size={16} aria-hidden />
            ) : (
              <Download size={16} aria-hidden />
            )}
            {busy ? 'Working…' : label}
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="px-3 text-[var(--text-dim)] hover:text-[var(--text-soft)] flex items-center"
          >
            <X size={16} />
          </button>
        </div>
        {msg && (
          <p
            className="pointer-events-none mt-1.5 text-center text-[10px] px-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {msg}
          </p>
        )}
      </div>

      {iosSheet && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
          onClick={() => setIosSheet(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(232,195,74,0.25)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="ios-install-title"
          >
            <div className="flex items-center gap-2 mb-3">
              <Share2 size={18} className="text-[var(--gold)]" aria-hidden />
              <h2 id="ios-install-title" className="text-sm font-bold text-[var(--text-primary)]">
                Install on iPhone / iPad
              </h2>
            </div>
            <ol className="text-xs text-[var(--text-muted)] leading-relaxed list-decimal pl-4 space-y-2 mb-4">
              <li>
                Tap <strong className="text-[var(--text-soft)]">Share</strong> (square with arrow) in Safari
              </li>
              <li>
                Tap <strong className="text-[var(--text-soft)]">Add to Home Screen</strong>, then{' '}
                <strong className="text-[var(--text-soft)]">Add</strong>
              </li>
              <li>
                Open the Cridora icon, then tap{' '}
                <strong className="text-[var(--text-soft)]">Enable notifications</strong>
              </li>
            </ol>
            <p className="text-[10px] text-[var(--text-dim)] mb-4">
              Apple requires Add to Home Screen before tray notifications (iOS 16.4+).
            </p>
            <button
              type="button"
              onClick={() => setIosSheet(false)}
              className="btn-gold w-full text-[11px]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
