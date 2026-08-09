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
const PUSH_REFRESHED_AT_KEY = 'cridora_push_refreshed_at'
const PUSH_REFRESH_TTL_MS = 12 * 60 * 60 * 1000

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

function markPushRefreshed() {
  try {
    localStorage.setItem(PUSH_REFRESHED_AT_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

function shouldForceRefreshSubscription() {
  try {
    const last = Number(localStorage.getItem(PUSH_REFRESHED_AT_KEY) || 0)
    if (!Number.isFinite(last) || last <= 0) return true
    return Date.now() - last > PUSH_REFRESH_TTL_MS
  } catch {
    return true
  }
}

/**
 * Request notification permission and register Web Push with the backend.
 * Must be called from a user gesture when permission is not yet granted.
 * `authFetch` is optional — signed-out visitors can still subscribe.
 *
 * Mobile Chrome/Safari require Notification.requestPermission() in the same user-gesture
 * turn as the tap — any await (network) before it often yields a silent deny.
 */
export async function enablePushNotifications(authFetch, options = {}) {
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
      vapidKeyPromise = null
      const retry = await prefetchVapidPublicKey()
      if (!retry?.publicKey) {
        return { ok: false, error: 'no_vapid' }
      }
      return finishSubscribe(retry.publicKey, authFetch, {
        forceRefresh: options.forceRefresh !== false,
      })
    }

    return finishSubscribe(keyData.publicKey, authFetch, {
      // Explicit Enable always mints a fresh endpoint so dead Android/PWA subs heal.
      forceRefresh: options.forceRefresh !== false,
    })
  } catch (e) {
    return { ok: false, error: 'exception', detail: e?.message || 'Failed' }
  }
}

/**
 * Re-register push when permission is already granted (no prompt).
 * Used by installed PWAs on open to heal rotated/stale FCM endpoints.
 */
export async function syncPushSubscription(authFetch, options = {}) {
  if (!pushApiSupported()) {
    return { ok: false, error: 'unsupported' }
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return { ok: false, error: 'denied' }
  }
  if (isIosDevice() && !isStandaloneDisplay()) {
    return { ok: false, error: 'ios_install_required' }
  }

  const forceRefresh = options.forceRefresh ?? shouldForceRefreshSubscription()
  try {
    const keyData = await prefetchVapidPublicKey()
    if (!keyData?.publicKey) {
      return { ok: false, error: 'no_vapid' }
    }
    return finishSubscribe(keyData.publicKey, authFetch, { forceRefresh })
  } catch (e) {
    return { ok: false, error: 'exception', detail: e?.message || 'Failed' }
  }
}

export async function hasActivePushSubscription() {
  if (!pushApiSupported()) return false
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return Boolean(sub)
  } catch {
    return false
  }
}

async function finishSubscribe(publicKey, authFetch, { forceRefresh = false } = {}) {
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()

  // Dead Android/PWA endpoints often remain in pushManager while the server
  // has already marked them gone. Force a new subscription so tray delivery resumes.
  if (forceRefresh && sub) {
    try {
      await sub.unsubscribe()
    } catch {
      /* ignore */
    }
    sub = null
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const json = sub.toJSON()
  if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) {
    return { ok: false, error: 'exception', detail: 'Push subscription incomplete' }
  }

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

  markPushRefreshed()
  return { ok: true, permission: 'granted', subscribed: true }
}
