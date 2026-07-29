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

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [
      /^\/api\//,
      /^\/healthz\/?$/,
      /^\/monkey123\//,
      /^\/media\//,
      /^\/sitemap\.xml$/,
      /^\/robots\.txt$/,
    ],
  }),
)

registerRoute(
  ({ url }) =>
    /\/(pwa-192|pwa-512|apple-touch-icon)(-black)?\.png(\?.*)?$/i.test(
      url.pathname + url.search,
    ),
  new CacheFirst({
    // Bump name when icons change so installed PWAs drop stale CacheFirst entries.
    cacheName: 'cridora-pwa-icons-v3',
    plugins: [
      new ExpirationPlugin({ maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 7 }),
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

  const options = {
    body: payload.body || '',
    icon: '/pwa-192-black.png?v=icon-black-1',
    badge: '/pwa-192-black.png?v=icon-black-1',
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
          icon: '/pwa-192-black.png?v=icon-black-1',
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
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'
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
