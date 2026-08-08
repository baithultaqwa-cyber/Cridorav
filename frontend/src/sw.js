/* eslint-disable no-restricted-globals */
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

  const tag = payload.category
    ? `${payload.category}-${payload.notification_id || Date.now()}`
    : `cridora-${Date.now()}`

  // One tray logo only — omit `badge` (status-bar glyph) so Android doesn't show
  // two Cridora marks side by side in the notification shade.
  const iconUrl = `${PWA_ICON_192}${PWA_ICON_QUERY}`

  const options = {
    body: payload.body || '',
    icon: iconUrl,
    // Haptic nudge on Android — some OEMs suppress a silent heads-up notification in low-power
    // modes, a short vibration pattern makes delivery more noticeable/reliable on mobile.
    vibrate: [180, 80, 120],
    data: {
      url: payload.url || '/',
      category: payload.category || '',
      notification_id: payload.notification_id,
      ...(payload.data || {}),
    },
    tag,
    renotify: true,
    requireInteraction: false,
  }

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(payload.title || 'Cridora', options)
      } catch {
        // Retry with a minimal, maximally-compatible payload — a bad icon/vibrate/data shape
        // on some Android builds can throw and silently drop the notification otherwise.
        await self.registration.showNotification(payload.title || 'Cridora', {
          body: payload.body || '',
          icon: iconUrl,
          tag: 'cridora-fallback',
          data: { url: payload.url || '/' },
        })
      }
    })(),
  )
})

// Browsers occasionally rotate/invalidate a push subscription in the background (most common
// on Android). Without this, the SW silently has no way to resubscribe and the endpoint the
// server has on file goes stale. Ask any open tab to re-run the subscribe flow.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          client.postMessage({ type: 'CRIDORA_PUSH_RESUBSCRIBE' })
        } catch {
          /* ignore */
        }
      }
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const nd = event.notification.data || {}
  const targetUrl = resolveNotificationNavUrl({
    url: nd.url || '/',
    category: nd.category || '',
    data: nd,
  })
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
