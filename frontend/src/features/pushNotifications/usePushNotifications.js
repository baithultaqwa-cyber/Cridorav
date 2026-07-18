import { useCallback, useEffect, useState } from 'react'
import { API_NOTIFICATIONS } from '../../config'
import { isStandaloneDisplay } from '../pwa/isStandaloneDisplay'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function detectIos() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

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
  const isIos = detectIos()
  const standalone = isStandaloneDisplay()

  useEffect(() => {
    const ok = typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window
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
    if (isIos && !standalone) {
      setError('On iPhone/iPad, tap Share → Add to Home Screen first, then enable notifications from the installed app.')
      return { ok: false, error: 'ios_install_required' }
    }
    setBusy(true)
    setError('')
    try {
      const keyRes = await fetch(`${API_NOTIFICATIONS}/vapid-public-key/`)
      const keyData = await keyRes.json()
      if (!keyData?.publicKey) {
        setError('Push is not configured on the server yet (missing VAPID keys).')
        return { ok: false, error: 'no_vapid' }
      }
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setError('Notification permission was not granted.')
        return { ok: false, error: 'denied' }
      }
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        })
      }
      const json = sub.toJSON()
      const r = await authFetch(`${API_NOTIFICATIONS}/subscribe/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setError(j.detail || 'Failed to register subscription')
        return { ok: false, error: 'server' }
      }
      setSubscribed(true)
      return { ok: true }
    } catch (e) {
      setError(e?.message || 'Failed to enable notifications')
      return { ok: false, error: 'exception' }
    } finally {
      setBusy(false)
    }
  }, [supported, authFetch, isIos, standalone])

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
