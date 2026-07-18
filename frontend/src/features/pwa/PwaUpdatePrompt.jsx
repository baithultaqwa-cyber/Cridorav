import { useCallback, useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Frequent checks so installs / standalone surfaces see new SW sooner. */
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000
/** Small heads-up window before we apply the update + reload, so it never feels abrupt. */
const AUTO_APPLY_DELAY_MS = 2500

function shouldShowRefreshPrompt(registration) {
  return Boolean(
    registration && navigator.serviceWorker.controller && registration.waiting
  )
}

/**
 * Standalone PWA often mounts after a new SW is already in `waiting`, so Workbox's
 * `waiting` event was missed. Also re-check after `registration.update()`.
 */
function useServiceWorkerWaitingProbe(setNeedRefresh) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined
    }

    let intervalId = null
    let cancelled = false
    let onVisible = null
    let onFocus = null
    let onPageshow = null

    const applyIfWaiting = (registration) => {
      if (cancelled || !shouldShowRefreshPrompt(registration)) {
        return
      }
      setNeedRefresh(true)
    }

    const attachUpdateFound = (registration) => {
      registration.addEventListener('updatefound', () => {
        const inst = registration.installing
        if (!inst) {
          return
        }
        inst.addEventListener('statechange', () => {
          if (inst.state === 'installed') {
            queueMicrotask(() => applyIfWaiting(registration))
          }
        })
      })
    }

    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (!registration || cancelled) {
          return
        }

        attachUpdateFound(registration)
        applyIfWaiting(registration)

        const check = () => {
          registration
            .update()
            .catch(() => {})
            .finally(() => applyIfWaiting(registration))
        }

        check()
        intervalId = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS)

        onVisible = () => {
          if (document.visibilityState === 'visible') {
            check()
          }
        }
        onFocus = () => check()
        onPageshow = (event) => {
          if (event.persisted) {
            check()
          }
        }
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('focus', onFocus)
        window.addEventListener('pageshow', onPageshow)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
      if (onVisible !== null) {
        document.removeEventListener('visibilitychange', onVisible)
      }
      if (onFocus !== null) {
        window.removeEventListener('focus', onFocus)
      }
      if (onPageshow !== null) {
        window.removeEventListener('pageshow', onPageshow)
      }
    }
  }, [setNeedRefresh])
}

/**
 * Auto-updates: no user click required. When a new version is detected we show a
 * brief non-blocking "Updating…" toast, then activate the new service worker and
 * reload automatically after a short grace period (long enough to notice, short
 * enough to not feel stuck on stale code).
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })

  useServiceWorkerWaitingProbe(setNeedRefresh)

  const [applying, setApplying] = useState(false)
  const appliedRef = useRef(false)

  const applyUpdate = useCallback(async () => {
    if (appliedRef.current) return
    appliedRef.current = true
    try {
      await updateServiceWorker(true)
    } catch {
      window.location.reload()
    }
  }, [updateServiceWorker])

  useEffect(() => {
    if (!needRefresh || appliedRef.current) return undefined
    setApplying(true)
    const timer = window.setTimeout(() => {
      void applyUpdate()
    }, AUTO_APPLY_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [needRefresh, applyUpdate])

  if (!applying) {
    return null
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex items-end justify-center p-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 shadow-[0_12px_48px_rgba(0,0,0,0.45)]"
      >
        <span
          className="h-2 w-2 rounded-full animate-pulse"
          style={{ background: 'var(--gold)' }}
          aria-hidden="true"
        />
        <p className="text-xs font-medium text-[var(--text-primary)]">
          Updating to the latest version…
        </p>
      </div>
    </div>
  )
}
