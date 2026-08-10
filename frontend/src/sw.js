/**
 * Custom service worker (injectManifest) — Workbox precache + Web Push tray handlers.
 */
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { resolveNotificationNavUrl } from './lib/priceAlertCompareUrl'
import {
  PWA_ICON_192,
  PWA_ICON_QUERY,
  PWA_ICON_REVISION,
} from './features/pwa/iconRevision'

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

/** Drop prior icon CacheFirst buckets so installed PWAs fetch new icon URLs. */
const PWA_ICON_CACHE = `cridora-pwa-icons-${PWA_ICON_REVISION}`

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith('cridora-pwa-icons-') && key !== PWA_ICON_CACHE)
          .map((key) => caches.delete(key)),
      )
      // Tell every open install/tab to reload onto the new SW + logo paths now.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        try {
          client.postMessage({
            type: 'CRIDORA_SW_ACTIVATED',
            iconRevision: PWA_ICON_REVISION,
          })
        } catch {
          /* ignore */
        }
      }
    })(),
  )
})

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [
      /^\/api\//,
      /^\/healthz\/?$/,
      /^\/updating\.html$/,
      /^\/monkey123\//,
      /^\/media\//,
      // Standalone Three.js landing demos (iframes) — must not get the SPA shell
      /^\/demos\/.+\.html$/,
      /^\/sitemap\.xml$/,
      /^\/robots\.txt$/,
      /^\/llms\.txt$/,
      /^\/overview\.txt$/,
      /^\/marketplace\.txt$/,
      /^\/how-it-works\.txt$/,
      /^\/vendors\.txt$/,
      /^\/terms\.txt$/,
      /^\/uae-gold-comparison\.txt$/,
      /^\/openapi-public-v1\.ya?ml$/,
    ],
  }),
)

registerRoute(
  ({ url }) =>
    /\/(pwa-192|pwa-512|apple-touch-icon)(-(black|seal|seal2|medal|img1333|goldbar))?\.png(\?.*)?$/i.test(
      url.pathname + url.search,
    ) || /\/pwa-badge-96\.png(\?.*)?$/i.test(url.pathname + url.search),
  new CacheFirst({
    // Path-busted icon URLs are immutable; cache name still bumps with revision
    // so older generations are dropped on activate.
    cacheName: PWA_ICON_CACHE,
    plugins: [
      new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

async function showTrayNotification(title, optionsList) {
  let lastErr = null
  for (const options of optionsList) {
    try {
      await self.registration.showNotification(title, options)
      return true
    } catch (err) {
      lastErr = err
    }
  }
  if (lastErr) {
    console.warn('[cridora-sw] showNotification failed', lastErr)
  }
  return false
}

/** Unique per push — reused tags (e.g. cridora-minimal) silently replace prior tray alerts on Android. */
function trayTagForPayload(payload) {
  if (typeof payload.tag === 'string' && payload.tag.trim()) return payload.tag.trim()
  const nid = payload.notification_id
  if (nid != null && String(nid).trim()) {
    const cat = payload.category ? `${payload.category}-` : 'cridora-'
    return `${cat}${nid}`
  }
  if (payload.category) return `${payload.category}-${Date.now()}`
  return `cridora-${Date.now()}`
}

// Client → SW local tray (iOS installed PWA often cannot showNotification from the page).
self.addEventListener('message', (event) => {
  const data = event.data && typeof event.data === 'object' ? event.data : null
  const t = data?.type
  if (t === 'SKIP_WAITING') {
    void self.skipWaiting()
    return
  }
  if (t === 'CRIDORA_SHOW_LOCAL_TRAY') {
    const title = typeof data?.title === 'string' && data.title.trim() ? data.title.trim() : 'Cridora'
    const body =
      typeof data?.body === 'string' && data.body.trim()
        ? data.body.trim()
        : 'Open Cridora for details.'
    const tag = typeof data?.tag === 'string' && data.tag.trim() ? data.tag.trim() : `cridora-local-${Date.now()}`
    const url = typeof data?.url === 'string' ? data.url : '/'
    const iconUrl = new URL(`${PWA_ICON_192}${PWA_ICON_QUERY}`, self.location.origin).href
    const targetUrl = new URL(url, self.location.origin).href
    event.waitUntil(
      showTrayNotification(title, [
        {
          body,
          icon: iconUrl,
          tag,
          renotify: true,
          requireInteraction: false,
          data: { url: targetUrl, tag },
        },
        {
          body,
          tag: `${tag}-safe`,
          renotify: true,
          data: { url: targetUrl, tag },
        },
        {
          body: body || 'Open Cridora for details.',
          tag: `${tag}-minimal`,
        },
      ]),
    )
  }
})

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Cridora',
    body: 'You have a new update',
    url: '/',
  }
  try {
    if (event.data) {
      const parsed = event.data.json()
      payload = { ...payload, ...parsed }
    }
  } catch {
    try {
      payload.body = event.data ? event.data.text() : payload.body
    } catch {
      /* ignore */
    }
  }

  const tag = trayTagForPayload(payload)

  // Absolute icon URL — relative paths can fail silently in installed PWAs.
  const iconUrl = new URL(`${PWA_ICON_192}${PWA_ICON_QUERY}`, self.location.origin).href
  const title = (payload.title || 'Cridora').trim() || 'Cridora'
  const bodyRaw = typeof payload.body === 'string' ? payload.body.trim() : ''
  const body = bodyRaw.length > 0 ? bodyRaw : 'Open Cridora for details.'
  const data = {
    url: payload.url || '/',
    category: payload.category || '',
    notification_id: payload.notification_id,
    tag,
    ...(payload.data || {}),
  }

  event.waitUntil(
    (async () => {
      // Match cridoraindia: unique tag + rich options first, then safer fallbacks.
      // Never reuse a shared tag like cridora-minimal across pushes — Android replaces
      // the prior tray entry without a new banner/sound.
      const ua = (self.navigator && self.navigator.userAgent) || ''
      const mobileLike = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
      const rich = {
        body,
        icon: iconUrl,
        data,
        tag,
        renotify: true,
        requireInteraction: false,
        ...(mobileLike ? {} : { vibrate: [180, 80, 120] }),
      }
      const attempts = [
        rich,
        {
          body,
          icon: iconUrl,
          data,
          tag: `${tag}-novib`,
          renotify: true,
        },
        {
          body,
          data: { url: data.url, tag },
          tag: `${tag}-plain`,
          renotify: true,
        },
        {
          body,
          tag: `${tag}-minimal`,
          renotify: true,
        },
      ]
      await showTrayNotification(title, attempts)

      // Refresh in-app bell immediately when a tab/PWA window is open.
      try {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of clientList) {
          client.postMessage({ type: 'CRIDORA_PUSH_RECEIVED', category: payload.category || '' })
        }
      } catch {
        /* ignore */
      }
    })(),
  )
})

// Browsers occasionally rotate/invalidate a push subscription in the background (most common
// on Android). Re-subscribe from the SW itself so delivery keeps working even with no open tab.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldSub = event.oldSubscription
        const applicationServerKey =
          oldSub?.options?.applicationServerKey
          || event.newSubscription?.options?.applicationServerKey
        if (!applicationServerKey) {
          // Fall back to asking open tabs (they can fetch the VAPID public key).
          const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          for (const client of clientList) {
            try {
              client.postMessage({ type: 'CRIDORA_PUSH_RESUBSCRIBE' })
            } catch {
              /* ignore */
            }
          }
          return
        }

        const newSub =
          event.newSubscription
          || await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          })
        const json = newSub.toJSON()
        const subscribeUrl = new URL('/api/notifications/subscribe/', self.location.origin).href
        await fetch(subscribeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys,
          }),
        })
        // Also ask open tabs to re-claim the subscription for a signed-in user.
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of clientList) {
          try {
            client.postMessage({ type: 'CRIDORA_PUSH_RESUBSCRIBE' })
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore — next app open will re-subscribe via usePushNotifications */
      }
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const nd = event.notification.data || {}
  const targetPath = resolveNotificationNavUrl({
    url: nd.url || '/',
    category: nd.category || '',
    data: nd,
  })
  // Absolute URL is more reliable for installed PWAs than a path-only string.
  const targetUrl = new URL(targetPath || '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl)
            } catch {
              /* ignore */
            }
          }
          return
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })(),
  )
})
