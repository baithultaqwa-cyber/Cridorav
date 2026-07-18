import { useEffect, useState } from 'react'
import { BellRing, Smartphone } from 'lucide-react'
import { usePushNotifications } from './usePushNotifications'

/**
 * Session-scoped "Later" dismissal: closing hides it for this visit only. A fresh
 * visit (new tab / new session) shows it again until the user actually enables
 * notifications — per product requirement, we never permanently suppress this.
 */
const SESSION_DISMISS_KEY = 'cridora_push_prompt_dismissed_session'

function readSessionDismissed() {
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export default function EnableNotificationsPrompt({ authFetch, roleLabel = 'updates' }) {
  const push = usePushNotifications(authFetch)
  const [dismissed, setDismissed] = useState(readSessionDismissed)

  useEffect(() => {
    const onDismiss = () => setDismissed(true)
    window.addEventListener('cridora-push-prompt-dismiss', onDismiss)
    return () => window.removeEventListener('cridora-push-prompt-dismiss', onDismiss)
  }, [])

  if (!push.supported || push.subscribed || dismissed) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  const iosNeedsInstall = push.isIos && !push.standalone

  return (
    <div
      className="mb-6 px-4 py-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4"
      style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.22)' }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(201,168,76,0.15)' }}
      >
        {iosNeedsInstall
          ? <Smartphone size={18} style={{ color: 'var(--gold)' }} />
          : <BellRing size={18} style={{ color: 'var(--gold)' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--text-primary)] mb-0.5">Enable tray notifications</p>
        <p className="text-xs text-[var(--text-soft)] leading-relaxed">
          {iosNeedsInstall
            ? 'On iPhone/iPad: tap Share → Add to Home Screen, open the installed app, then enable notifications for instant alerts.'
            : `Get instant ${roleLabel} on your phone lock screen / notification tray — even when the browser tab is closed.`}
        </p>
        {push.error && <p className="text-[11px] text-red-400 mt-1">{push.error}</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={dismiss}
          className="px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-semibold text-[var(--text-dim)]"
        >
          Later
        </button>
        <button
          type="button"
          disabled={push.busy || iosNeedsInstall}
          onClick={() => push.enable()}
          className="btn-gold px-4 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
          title={iosNeedsInstall ? 'Install to Home Screen first' : undefined}
        >
          {push.busy ? 'Enabling…' : 'Enable'}
        </button>
      </div>
    </div>
  )
}
