import { API_NOTIFICATIONS, API_ORIGIN } from '../../config'
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
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
  )
}

let vapidKeyPromise = null
let subscribeInFlight = null
const PUSH_REFRESHED_AT_KEY = 'cridora_push_refreshed_at'
const PUSH_REFRESH_TTL_MS = 12 * 60 * 60 * 1000
const CRIDORA_SHOW_LOCAL_TRAY = 'CRIDORA_SHOW_LOCAL_TRAY'

/** Prefetch VAPID so enable can call requestPermission before any await on a cold tap. */
export function prefetchVapidPublicKey() {
  if (!vapidKeyPromise) {
    vapidKeyPromise = fetch(`${API_NOTIFICATIONS}/vapid-public-key/`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.publicKey && d?.configured ? d : null))
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

async function waitForServiceWorkerController(timeoutMs = 8000) {
  const reg = await navigator.serviceWorker.ready
  if (navigator.serviceWorker.controller) return reg
  await new Promise((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs)
    const onController = () => {
      window.clearTimeout(timer)
      navigator.serviceWorker.removeEventListener('controllerchange', onController)
      resolve()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onController)
  })
  return navigator.serviceWorker.ready
}

async function refreshServiceWorkerRegistration() {
  const reg =
    (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready)
  try {
    await reg.update()
  } catch {
    /* ignore transient network errors */
  }
  return waitForServiceWorkerController()
}

async function fetchDeviceStatus(endpoint, authFetch) {
  if (!endpoint) {
    return { registered: false, linked_to_user: false, channel: 'none' }
  }
  const qs = new URLSearchParams({ endpoint })
  const url = `${API_NOTIFICATIONS}/device-status/?${qs}`
  try {
    const doFetch = authFetch || fetch
    const res = await doFetch(url, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { registered: false, linked_to_user: false, channel: 'none' }
    }
    return {
      registered: Boolean(data.registered),
      linked_to_user: Boolean(data.linked_to_user),
      channel: data.channel === 'webpush' ? 'webpush' : 'none',
    }
  } catch {
    return { registered: false, linked_to_user: false, channel: 'none' }
  }
}

function isDeviceDeliverable(status, hasAuth) {
  if (!status?.registered) return false
  if (hasAuth) return Boolean(status.linked_to_user)
  return true
}

async function postTrayViaServiceWorker(title, body, tag, url) {
  const controller = navigator.serviceWorker.controller
  if (!controller) return false
  controller.postMessage({
    type: CRIDORA_SHOW_LOCAL_TRAY,
    title,
    body,
    tag,
    url,
  })
  return true
}

/** Show a one-time confirmation in the OS tray after enable (iOS needs SW context). */
export async function showTrayWelcomeNotification() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  if (!('serviceWorker' in navigator)) return

  const title = 'Cridora alerts on'
  const body = 'You will get tray alerts for price moves and account updates on this device.'
  const tag = `cridora-tray-welcome-${Date.now()}`

  await refreshServiceWorkerRegistration()

  if (isIosDevice() && isStandaloneDisplay()) {
    if (await postTrayViaServiceWorker(title, body, tag, '/')) return
  }

  try {
    const reg = await navigator.serviceWorker.ready
    const iconHref = new URL('/pwa-192-goldbar.png', window.location.origin).href
    await reg.showNotification(title, {
      body,
      icon: iconHref,
      tag,
      renotify: true,
      data: { url: '/', tag },
    })
    return
  } catch {
    /* iOS installed PWA often requires the service worker context */
  }

  await postTrayViaServiceWorker(title, body, tag, '/')
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

    let keyData = await keyPromise
    if (!keyData?.publicKey) {
      vapidKeyPromise = null
      keyData = await prefetchVapidPublicKey()
      if (!keyData?.publicKey) {
        return { ok: false, error: 'no_vapid' }
      }
    }

    const result = await finishSubscribe(keyData.publicKey, authFetch, {
      // Explicit Enable always mints a fresh endpoint so dead Android/PWA subs heal.
      forceRefresh: options.forceRefresh !== false,
      confirmTray: options.confirmTray !== false,
    })
    return result
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
    return finishSubscribe(keyData.publicKey, authFetch, {
      forceRefresh,
      confirmTray: false,
    })
  } catch (e) {
    return { ok: false, error: 'exception', detail: e?.message || 'Failed' }
  }
}

/**
 * Soft claim: re-POST the current endpoint without unsubscribe (login / foreground heal).
 * Matches cridoraindia claimPushSubscriptionForLoggedInUser.
 */
export async function claimPushSubscription(authFetch) {
  if (!pushApiSupported()) return { ok: false, error: 'unsupported' }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return { ok: false, error: 'denied' }
  }
  if (isIosDevice() && !isStandaloneDisplay()) {
    return { ok: false, error: 'ios_install_required' }
  }
  try {
    const keyData = await prefetchVapidPublicKey()
    if (!keyData?.publicKey) return { ok: false, error: 'no_vapid' }
    return finishSubscribe(keyData.publicKey, authFetch, {
      forceRefresh: false,
      confirmTray: false,
    })
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

/** How long without a successful server register before we ask the user to enable again. */
const PUSH_STALE_PROMPT_MS = 7 * 24 * 60 * 60 * 1000
const NEEDS_REENABLE_KEY = 'cridora_push_needs_reenable'

export function markPushNeedsReEnable(on) {
  try {
    if (on) localStorage.setItem(NEEDS_REENABLE_KEY, '1')
    else localStorage.removeItem(NEEDS_REENABLE_KEY)
  } catch {
    /* ignore */
  }
}

export function readPushNeedsReEnable() {
  try {
    return localStorage.getItem(NEEDS_REENABLE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Whether tray push looks healthy on this device.
 * Used to re-show "Enable again" when the PWA permission/sub is missing or sync failed.
 */
export async function assessPushHealth() {
  if (!pushApiSupported()) {
    return { healthy: false, needsEnable: false, reEnable: false, reason: 'unsupported' }
  }
  if (isIosDevice() && !isStandaloneDisplay()) {
    return { healthy: false, needsEnable: true, reEnable: false, reason: 'ios_install_required' }
  }
  if (typeof Notification === 'undefined') {
    return { healthy: false, needsEnable: false, reEnable: false, reason: 'unsupported' }
  }

  const perm = Notification.permission
  if (perm === 'denied') {
    return { healthy: false, needsEnable: true, reEnable: true, reason: 'denied' }
  }
  if (perm !== 'granted') {
    return { healthy: false, needsEnable: true, reEnable: false, reason: 'permission' }
  }

  if (readPushNeedsReEnable()) {
    return { healthy: false, needsEnable: true, reEnable: true, reason: 'sync_failed' }
  }

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) {
      return { healthy: false, needsEnable: true, reEnable: true, reason: 'no_subscription' }
    }

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
    if (mobileUa || isStandaloneDisplay()) {
      try {
        const last = Number(localStorage.getItem(PUSH_REFRESHED_AT_KEY) || 0)
        if (!Number.isFinite(last) || last <= 0 || Date.now() - last > PUSH_STALE_PROMPT_MS) {
          return { healthy: false, needsEnable: true, reEnable: true, reason: 'stale' }
        }
      } catch {
        return { healthy: false, needsEnable: true, reEnable: true, reason: 'stale' }
      }
    }

    return { healthy: true, needsEnable: false, reEnable: false, reason: 'ok' }
  } catch {
    return { healthy: false, needsEnable: true, reEnable: true, reason: 'no_subscription' }
  }
}

async function finishSubscribe(publicKey, authFetch, { forceRefresh = false, confirmTray = false } = {}) {
  if (subscribeInFlight) {
    return subscribeInFlight
  }

  subscribeInFlight = (async () => {
    const reg = await refreshServiceWorkerRegistration()
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

    const status = await fetchDeviceStatus(json.endpoint, authFetch)
    const hasAuth = Boolean(authFetch)
    if (!isDeviceDeliverable(status, hasAuth)) {
      // Soft claim sometimes races before JWT settles — still mark refreshed if registered.
      if (!status.registered) {
        return {
          ok: false,
          error: 'server',
          detail: hasAuth
            ? 'Tray alerts are not linked to your account yet. Tap Enable again.'
            : 'Server did not register this device for tray alerts. Try again.',
        }
      }
    }

    markPushRefreshed()
    markPushNeedsReEnable(false)

    if (confirmTray) {
      try {
        await showTrayWelcomeNotification()
      } catch {
        /* welcome is best-effort */
      }
    }

    return { ok: true, permission: 'granted', subscribed: true }
  })()

  try {
    return await subscribeInFlight
  } finally {
    subscribeInFlight = null
  }
}

/** Expose API origin for SW diagnostics (same-origin deploy uses relative /api). */
export function pushApiOrigin() {
  return API_ORIGIN
}
