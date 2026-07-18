import { useCallback, useEffect, useState } from 'react'
import { API_NOTIFICATIONS } from '../../config'
import { isStandaloneDisplay } from '../pwa/isStandaloneDisplay'
import {
  enablePushNotifications,
  isIosDevice,
  pushApiSupported,
} from './enablePush'

/**
 * Subscribe / unsubscribe Web Push. Permission must be requested from a user gesture.
 */
export function usePushNotifications(authFetch) {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  )
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [vapidConfigured, setVapidConfigured] = useState(false)
  const isIos = isIosDevice()
  const standalone = isStandaloneDisplay()

  useEffect(() => {
    const ok = pushApiSupported()
    setSupported(ok)
    if (!ok) return

    fetch(`${API_NOTIFICATIONS}/vapid-public-key/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setVapidConfigured(Boolean(d?.configured && d?.publicKey)))
      .catch(() => setVapidConfigured(false))

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => undefined)
  }, [])

  const enable = useCallback(async () => {
    if (!supported || !authFetch) return { ok: false, error: 'unsupported' }
    setBusy(true)
    setError('')
    try {
      const result = await enablePushNotifications(authFetch)
      if (result.permission) setPermission(result.permission)
      else if (typeof Notification !== 'undefined') setPermission(Notification.permission)
      if (result.ok) {
        setSubscribed(true)
        return result
      }
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
    busy,
    error,
    vapidConfigured,
    isIos,
    standalone,
    enable,
    disable,
  }
}
