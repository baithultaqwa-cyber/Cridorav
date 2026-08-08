import { useEffect, useState } from 'react'
import { X, Share2, Smartphone } from 'lucide-react'
import { isStandaloneDisplay } from './isStandaloneDisplay'
import { APPLE_TOUCH_ICON, PWA_ICON_QUERY, PWA_ICON_REVISION } from './iconRevision'
import { isIosDevice } from '../pushNotifications/enablePush'

const DISMISS_KEY = `cridora_home_icon_refresh_${PWA_ICON_REVISION}`

/**
 * After a logo path bump, Android/Chrome usually picks up the new launcher icon
 * via the updated web manifest (no reinstall). iOS Web Clip icons are OS-cached
 * by Apple and typically need Share → Add to Home Screen again.
 */
export function IosHomeIconRefreshBanner() {
  const [open, setOpen] = useState(false)
  const ios = isIosDevice()

  useEffect(() => {
    if (!isStandaloneDisplay()) return
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      return
    }
    setOpen(true)
  }, [])

  if (!open) return null

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  return (
    <div
      className="fixed inset-x-0 z-[190] flex justify-center px-3"
      style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        role="status"
        className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 pr-10 shadow-[0_12px_48px_rgba(0,0,0,0.45)]"
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2 top-2 rounded-full p-1.5 text-[var(--text-muted)]"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
        <div className="flex items-start gap-3">
          <img
            src={`${APPLE_TOUCH_ICON}${PWA_ICON_QUERY}`}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-xl object-cover flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Smartphone size={14} aria-hidden />
              New Cridora app logo
            </p>
            {ios ? (
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                iPhone freezes the home-screen tile at install time. Remove the old Cridora
                icon, open this site in Safari, then tap{' '}
                <Share2 size={12} className="inline align-[-2px]" aria-hidden="true" /> Share →
                Add to Home Screen. Account and data stay — you are not deleting an App Store
                app.
              </p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                Android often keeps the old launcher tile even after the app updates. Long-press
                the Cridora icon → Remove, then open cridora.com in Chrome → Install app again.
                You stay signed in; this only refreshes the shortcut.
              </p>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="mt-3 text-xs font-semibold"
              style={{ color: 'var(--gold)' }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
