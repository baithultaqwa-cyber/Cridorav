import { usePushNotifications } from './usePushNotifications'

/**
 * Interactive settings row for push / price alerts.
 */
export default function PushSettingsToggle({ authFetch, label, desc }) {
  const push = usePushNotifications(authFetch)

  const on = push.subscribed && push.permission === 'granted'

  const toggle = async () => {
    if (push.busy) return
    if (on) await push.disable()
    else await push.enable()
  }

  return (
    <div
      className="flex items-center justify-between py-3 border-b last:border-0"
      style={{ borderColor: 'rgba(255,255,255,0.04)' }}
    >
      <div className="min-w-0 pr-4">
        <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
        <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{desc}</div>
        {push.isIos && !push.standalone && (
          <div className="text-[10px] text-amber-400/90 mt-1">
            Install the app to Home Screen on iOS to receive tray alerts.
          </div>
        )}
        {push.error && <div className="text-[10px] text-red-400 mt-1">{push.error}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={push.busy || !push.supported}
        onClick={toggle}
        className="w-10 h-5.5 rounded-full relative cursor-pointer flex-shrink-0 disabled:opacity-40"
        style={{ background: on ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)', padding: '2px' }}
      >
        <div
          className="w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  )
}
