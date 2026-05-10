import { useCallback, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Frequent checks so installs / standalone surfaces see new SW sooner. */
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000

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

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })

  useServiceWorkerWaitingProbe(setNeedRefresh)

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
