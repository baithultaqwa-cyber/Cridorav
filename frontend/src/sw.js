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
  ({ url }) => /\/(pwa-192|pwa-512|apple-touch-icon)\.png(\?.*)?$/i.test(url.pathname + url.search),
  new CacheFirst({
    cacheName: 'cridora-pwa-icons',
    plugins: [
      new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 }),
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

  const options = {
    body: payload.body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    data: {
      url: payload.url || '/',
      category: payload.category || '',
      notification_id: payload.notification_id,
      ...(payload.data || {}),
    },
    tag: payload.category
      ? `${payload.category}-${payload.notification_id || Date.now()}`
      : undefined,
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'Cridora', options))
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
