import { useCallback, useEffect, useState } from 'react'
import { API_NOTIFICATIONS } from '../../config'
import { isStandaloneDisplay } from '../pwa/isStandaloneDisplay'
import {
  enablePushNotifications,
  isIosDevice,
  markPushNeedsReEnable,
  prefetchVapidPublicKey,
  pushApiSupported,
  readPushNeedsReEnable,
  syncPushSubscription,
} from './enablePush'

/**
 * Subscribe / unsubscribe Web Push. Permission must be requested from a user gesture.
 */
export function usePushNotifications(authFetch) {
  const [supported] = useState(() => pushApiSupported())
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  )
  const [subscribed, setSubscribed] = useState(false)
  const [needsReEnable, setNeedsReEnable] = useState(readPushNeedsReEnable)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [vapidConfigured, setVapidConfigured] = useState(false)
  const isIos = isIosDevice()
  const standalone = isStandaloneDisplay()

  useEffect(() => {
    if (!supported) return undefined

    let cancelled = false
    const checkVapid = (attempt = 0) => {
      fetch(`${API_NOTIFICATIONS}/vapid-public-key/`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return
          setVapidConfigured(Boolean(d?.configured && d?.publicKey))
        })
        .catch(() => {
          if (cancelled) return
          // Transient network hiccup on first load (e.g. cold start) — retry once.
          if (attempt < 2) {
            setTimeout(() => checkVapid(attempt + 1), 3000)
          } else {
            setVapidConfigured(false)
          }
        })
    }
    checkVapid()
    prefetchVapidPublicKey()

    // Heal stale Android/iOS endpoints on open (permission already granted → no prompt).
    // Mobile UAs always mint a fresh endpoint — zombie Apple/FCM rows are why news
    // reaches desktop trays but not phones. Desktop keeps the 12h TTL path.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
    syncPushSubscription(authFetch, { forceRefresh: standalone || mobileUa })
      .then((r) => {
        if (cancelled) return
        if (r?.ok) {
          setSubscribed(true)
          setPermission('granted')
          markPushNeedsReEnable(false)
          setNeedsReEnable(false)
          return
        }
        // Permission was granted but sync failed (or never subscribed) — ask to enable again.
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          markPushNeedsReEnable(true)
          setNeedsReEnable(true)
          setSubscribed(false)
        }
      })
      .catch(() => {
        if (cancelled) return
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          markPushNeedsReEnable(true)
          setNeedsReEnable(true)
          setSubscribed(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [authFetch, supported, standalone])

  // Re-sync when the installed PWA returns to foreground (common Android kill path).
  useEffect(() => {
    if (!supported) return undefined
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      syncPushSubscription(authFetch)
        .then((r) => {
          if (r?.ok) {
            setSubscribed(true)
            markPushNeedsReEnable(false)
            setNeedsReEnable(false)
          } else {
            markPushNeedsReEnable(true)
            setNeedsReEnable(true)
            setSubscribed(false)
          }
        })
        .catch(() => {
          markPushNeedsReEnable(true)
          setNeedsReEnable(true)
          setSubscribed(false)
        })
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [supported, authFetch])

  // The SW's `pushsubscriptionchange` handler (fires when the browser rotates/invalidates a
  // subscription in the background — mostly seen on Android) posts here so we can silently
  // resubscribe. No permission prompt shows since permission is already 'granted' at this point.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined
    const onMessage = (event) => {
      if (event?.data?.type === 'CRIDORA_PUSH_RESUBSCRIBE') {
        syncPushSubscription(authFetch, { forceRefresh: true })
          .then((r) => {
            const ok = Boolean(r?.ok)
            setSubscribed(ok)
            markPushNeedsReEnable(!ok)
            setNeedsReEnable(!ok)
          })
          .catch(() => {
            markPushNeedsReEnable(true)
            setNeedsReEnable(true)
            setSubscribed(false)
          })
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [authFetch])

  const enable = useCallback(async () => {
    if (!supported) return { ok: false, error: 'unsupported' }
    setBusy(true)
    setError('')
    try {
      const result = await enablePushNotifications(authFetch, { forceRefresh: true })
      if (result.permission) setPermission(result.permission)
      else if (typeof Notification !== 'undefined') setPermission(Notification.permission)
      if (result.ok) {
        setSubscribed(true)
        markPushNeedsReEnable(false)
        setNeedsReEnable(false)
        return result
      }
      markPushNeedsReEnable(true)
      setNeedsReEnable(true)
      if (result.error === 'ios_install_required') {
        setError(
          'On iPhone/iPad, tap Share → Add to Home Screen first, then enable notifications from the installed app.',
        )
      } else if (result.error === 'no_vapid') {
        setError('Push is not configured on the server yet (missing VAPID keys).')
      } else if (result.error === 'denied') {
        setError('Notification permission was not granted.')
      } else {
        setError(result.detail || 'Failed to enable notifications')
      }
      return result
    } finally {
      setBusy(false)
    }
  }, [supported, authFetch])

  const disable = useCallback(async () => {
    if (!supported || !authFetch) return
    setBusy(true)
    setError('')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await authFetch(`${API_NOTIFICATIONS}/unsubscribe/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      markPushNeedsReEnable(false)
      setNeedsReEnable(false)
    } catch {
      setError('Failed to disable notifications')
    } finally {
      setBusy(false)
    }
  }, [supported, authFetch])

  return {
    supported,
    permission,
    subscribed,
    needsReEnable,
    busy,
    error,
    vapidConfigured,
    isIos,
    standalone,
    enable,
    disable,
  }
}
