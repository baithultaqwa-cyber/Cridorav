import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))
/** Bump per deploy so Workbox caches are namespaced (Railway/CI commits when set). */
const buildId =
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.VITE_PWA_BUILD_ID ||
  pkg.version
const pwaCacheId = `cridora-pwa-${typeof buildId === 'string' && buildId.length > 7 ? buildId.slice(0, 12) : buildId}`
const manifestIconQuery =
  typeof buildId === 'string' && buildId.length > 0
    ? `?v=${encodeURIComponent(buildId.length > 12 ? buildId.slice(0, 12) : buildId)}`
    : ''

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'cridora-pwa-icon-cache-bust',
      transformIndexHtml(html) {
        if (!manifestIconQuery) return html
        const q = manifestIconQuery
        const icon192 = `/pwa-192.png${q}`
        const icon512 = `/pwa-512.png${q}`
        const apple = `/apple-touch-icon.png${q}`
        return html
          .replace('href="/apple-touch-icon.png"', `href="${apple}"`)
          .replace(
            '<link rel="apple-touch-icon"',
            `<link rel="preload" href="${apple}" as="image" type="image/png" />\n    <link rel="preload" href="${icon192}" as="image" type="image/png" />\n    <link rel="icon" type="image/png" sizes="192x192" href="${icon192}" />\n    <link rel="icon" type="image/png" sizes="512x512" href="${icon512}" />\n    <link rel="apple-touch-icon"`,
          )
      },
    },
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192.png',
        'pwa-512.png',
      ],
      manifest: {
        name: 'Cridora — Digital Precious Metals',
        short_name: 'Cridora',
        description:
          'Buy, hold, and sell gold, silver, and platinum with verified UAE bullion vendors.',
        theme_color: '#c9a84c',
        background_color: '#0a0a0b',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui', 'browser'],
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: `pwa-192.png${manifestIconQuery}`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `pwa-512.png${manifestIconQuery}`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `apple-touch-icon.png${manifestIconQuery}`,
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `pwa-512.png${manifestIconQuery}`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cacheId: pwaCacheId,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest,xml,txt}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/healthz\/?$/,
          /^\/monkey123\//,
          /^\/media\//,
          /^\/sitemap\.xml$/,
          /^\/robots\.txt$/,
        ],
        runtimeCaching: [
          {
            urlPattern: /^\/(pwa-192|pwa-512|apple-touch-icon)\.png(\?.*)?$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: `${pwaCacheId}-icons`,
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: false,
    watch: {
      usePolling: true,
      interval: 300,
    },
    hmr: {
      overlay: true,
    },
  },
})
