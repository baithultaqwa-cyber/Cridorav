import { useCallback, useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { PWA_ICON_192, PWA_ICON_QUERY, PWA_ICON_REVISION } from './iconRevision'
import { isStandaloneDisplay } from './isStandaloneDisplay'

/** Frequent checks so installs / standalone surfaces see new SW sooner. */
const UPDATE_CHECK_INTERVAL_MS = 3 * 60 * 1000
/** Brief heads-up before activate + reload. */
const AUTO_APPLY_DELAY_MS = 3200
const NOTIFY_KEY = `cridora_pwa_update_notified_${PWA_ICON_REVISION}`

function shouldShowRefreshPrompt(registration) {
  return Boolean(
    registration && navigator.serviceWorker.controller && registration.waiting
  )
}

function notifyUpdateAvailable() {
  try {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    if (window.localStorage.getItem(NOTIFY_KEY) === '1') return
    window.localStorage.setItem(NOTIFY_KEY, '1')
    const n = new Notification('Cridora update ready', {
      body: 'New app version and logo are installing now — no reinstall needed.',
      icon: `${PWA_ICON_192}${PWA_ICON_QUERY}`,
      badge: '/pwa-badge-96.png',
      tag: `cridora-pwa-update-${PWA_ICON_REVISION}`,
      renotify: true,
    })
    n.onclick = () => {
      try {
        window.focus()
      } catch {
        /* ignore */
      }
      n.close()
    }
  } catch {
    /* ignore */
  }
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
 * Auto-updates installed PWAs: toast + optional tray notification, then activate
 * the new service worker (new logo paths included in the fresh manifest).
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
    notifyUpdateAvailable()
    const timer = window.setTimeout(() => {
      void applyUpdate()
    }, AUTO_APPLY_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [needRefresh, applyUpdate])

  if (!applying) {
    return null
  }

  const standalone = isStandaloneDisplay()

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex items-end justify-center p-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none flex max-w-sm items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 shadow-[0_12px_48px_rgba(0,0,0,0.45)]"
      >
        <img
          src={`${PWA_ICON_192}${PWA_ICON_QUERY}`}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 rounded-lg object-cover flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            Updating Cridora…
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">
            {standalone
              ? 'New version and app logo install automatically — no uninstall needed.'
              : 'Loading the latest version and logo.'}
          </p>
        </div>
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full animate-pulse"
          style={{ background: 'var(--gold)' }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
