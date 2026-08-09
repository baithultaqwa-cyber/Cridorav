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

let vapidKeyPromise = null

/** Prefetch VAPID so enable can call requestPermission before any await on a cold tap. */
export function prefetchVapidPublicKey() {
  if (!vapidKeyPromise) {
    vapidKeyPromise = fetch(`${API_NOTIFICATIONS}/vapid-public-key/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.publicKey ? d : null))
      .catch(() => null)
  }
  return vapidKeyPromise
}

/**
 * Request notification permission and register Web Push with the backend.
 * Must be called from a user gesture. `authFetch` is optional — signed-out visitors can
 * still subscribe (e.g. for price alerts); the backend accepts anonymous subscriptions and
 * re-claims them for the account automatically the next time this runs while signed in.
 *
 * Mobile Chrome/Safari require Notification.requestPermission() in the same user-gesture
 * turn as the tap — any await (network) before it often yields a silent deny.
 */
export async function enablePushNotifications(authFetch) {
  if (!pushApiSupported()) {
    return { ok: false, error: 'unsupported' }
  }
  if (isIosDevice() && !isStandaloneDisplay()) {
    return { ok: false, error: 'ios_install_required' }
  }

  try {
    // Kick off VAPID fetch without awaiting — permission must come first on mobile.
    const keyPromise = prefetchVapidPublicKey()

    let perm = Notification.permission
    if (perm !== 'granted') {
      perm = await Notification.requestPermission()
    }
    if (perm !== 'granted') {
      return { ok: false, error: 'denied', permission: perm }
    }

    const keyData = await keyPromise
    if (!keyData?.publicKey) {
      // One retry in case the prefetch raced a cold start
      vapidKeyPromise = null
      const retry = await prefetchVapidPublicKey()
      if (!retry?.publicKey) {
        return { ok: false, error: 'no_vapid' }
      }
      return finishSubscribe(retry.publicKey, authFetch)
    }

    return finishSubscribe(keyData.publicKey, authFetch)
  } catch (e) {
    return { ok: false, error: 'exception', detail: e?.message || 'Failed' }
  }
}

async function finishSubscribe(publicKey, authFetch) {
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
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
}
