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

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent || '')
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function pushApiSupported() {
  return (
    typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
  )
}

/**
 * Request notification permission and register Web Push with the backend.
 * Must be called from a user gesture. `authFetch` is optional — signed-out visitors can
 * still subscribe (e.g. for price alerts); the backend accepts anonymous subscriptions and
 * re-claims them for the account automatically the next time this runs while signed in.
 */
export async function enablePushNotifications(authFetch) {
  if (!pushApiSupported()) {
    return { ok: false, error: 'unsupported' }
  }
  if (isIosDevice() && !isStandaloneDisplay()) {
    return { ok: false, error: 'ios_install_required' }
  }

  try {
    const keyRes = await fetch(`${API_NOTIFICATIONS}/vapid-public-key/`)
    const keyData = await keyRes.json().catch(() => ({}))
    if (!keyData?.publicKey) {
      return { ok: false, error: 'no_vapid' }
    }

    const perm = await Notification.requestPermission()
    if (perm !== 'granted') {
      return { ok: false, error: 'denied', permission: perm }
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
    const doFetch = authFetch || fetch
    const r = await doFetch(`${API_NOTIFICATIONS}/subscribe/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      return { ok: false, error: 'server', detail: j.detail || 'Failed to register' }
    }

    return { ok: true, permission: 'granted', subscribed: true }
  } catch (e) {
    return { ok: false, error: 'exception', detail: e?.message || 'Failed' }
  }
}
