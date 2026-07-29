import { useEffect, useState } from 'react'
import { X, Share2 } from 'lucide-react'
import { isStandaloneDisplay } from './isStandaloneDisplay'
import { PWA_ICON_REVISION } from './iconRevision'
import { isIosDevice } from '../pushNotifications/enablePush'

const DISMISS_KEY = `cridora_ios_icon_refresh_${PWA_ICON_REVISION}`

/**
 * iOS stores Add-to-Home-Screen icons in a persistent Web Clip cache keyed by URL.
 * Changing the apple-touch-icon path helps new installs; already-installed tiles
 * usually only refresh after delete + Share → Add to Home Screen again.
 */
export function IosHomeIconRefreshBanner() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isIosDevice() || !isStandaloneDisplay()) return
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
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          New app icon available
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
          iPhone keeps the old home-screen icon until you remove Cridora, open this site in
          Safari, then tap{' '}
          <Share2 size={12} className="inline align-[-2px]" aria-hidden="true" /> Share → Add
          to Home Screen again.
        </p>
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
  )
}
