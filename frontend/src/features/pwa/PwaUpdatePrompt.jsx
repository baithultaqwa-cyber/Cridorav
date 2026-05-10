import { useCallback, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Frequent checks so installs / standalone surfaces see new SW sooner (was 60m). */
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000

function usePeriodicServiceWorkerChecks() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined
    }

    let intervalId = null
    let cancelled = false
    let onVisible = null
    let onFocus = null
    let onPageshow = null

    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (!registration || cancelled) {
          return
        }
        const check = () => {
          registration.update().catch(() => {})
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
  }, [])
}

export function PwaUpdatePrompt() {
  usePeriodicServiceWorkerChecks()

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })

  const onRefresh = useCallback(async () => {
    try {
      await updateServiceWorker()
    } catch {
      window.location.reload()
    }
  }, [updateServiceWorker])

  if (!needRefresh) {
    return null
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex items-end justify-center p-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-update-title"
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[0_12px_48px_rgba(0,0,0,0.45)]"
      >
        <p
          id="pwa-update-title"
          className="mb-3 text-center text-sm font-medium text-[var(--text-primary)]"
        >
          New version available — Refresh?
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="order-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm font-medium text-[var(--text-soft)] transition hover:border-[var(--gold)]/40 hover:text-[var(--text-primary)] sm:order-1"
          >
            Later
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="order-1 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-gold-fg)] transition hover:brightness-110 sm:order-2"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
