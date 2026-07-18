import { useEffect, useState } from 'react'
import { BellRing, Smartphone } from 'lucide-react'
import { usePushNotifications } from './usePushNotifications'

const DISMISS_KEY = 'cridora_push_prompt_dismissed'

export default function EnableNotificationsPrompt({ authFetch, roleLabel = 'updates' }) {
  const push = usePushNotifications(authFetch)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const onDismiss = () => setDismissed(true)
    window.addEventListener('cridora-push-prompt-dismiss', onDismiss)
    return () => window.removeEventListener('cridora-push-prompt-dismiss', onDismiss)
  }, [])

  if (!push.supported || push.subscribed || dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  return (
    <div
      className="mb-6 px-4 py-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4"
      style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.22)' }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(201,168,76,0.15)' }}
      >
        {push.isIos && !push.standalone
          ? <Smartphone size={18} style={{ color: 'var(--gold)' }} />
          : <BellRing size={18} style={{ color: 'var(--gold)' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--text-primary)] mb-0.5">Enable tray notifications</p>
        <p className="text-xs text-[var(--text-soft)] leading-relaxed">
          {push.isIos && !push.standalone
            ? 'On iPhone/iPad: tap Share → Add to Home Screen, open the installed app, then enable notifications for instant alerts.'
            : `Get instant ${roleLabel} on your phone lock screen / notification tray — even when the browser tab is closed.`}
        </p>
        {push.error && <p className="text-[11px] text-red-400 mt-1">{push.error}</p>}
        {!push.vapidConfigured && (
          <p className="text-[11px] text-[var(--text-dim)] mt-1">
            Push delivery needs VAPID keys on the server (in-app bell still works).
          </p>
        )}
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
          disabled={push.busy || (push.isIos && !push.standalone) || !push.vapidConfigured}
          onClick={() => push.enable()}
          className="btn-gold px-4 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
          title={
            !push.vapidConfigured
              ? 'Server VAPID keys not configured yet'
              : push.isIos && !push.standalone
                ? 'Install to Home Screen first'
                : undefined
          }
        >
          {push.busy ? 'Enabling…' : 'Enable'}
        </button>
      </div>
    </div>
  )
}
