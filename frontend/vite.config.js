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
const manifestIconQuery =
  typeof buildId === 'string' && buildId.length > 0
    ? `?v=${encodeURIComponent(buildId.length > 12 ? buildId.slice(0, 12) : buildId)}`
    : ''
/**
 * New path (not just ?v=) — iOS Web Clip / apple-touch-icon cache is keyed by URL path.
 * Bump the `-black` suffix (and re-export icons) whenever the artwork changes again.
 */
const ICON_192 = 'pwa-192-black.png'
const ICON_512 = 'pwa-512-black.png'
const ICON_APPLE = 'apple-touch-icon-black.png'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'cridora-pwa-icon-cache-bust',
      transformIndexHtml(html) {
        const q = manifestIconQuery
        const icon192 = `/${ICON_192}${q}`
        const icon512 = `/${ICON_512}${q}`
        const apple = `/${ICON_APPLE}${q}`
        return html
          .replace(/href="\/apple-touch-icon[^"]*"/g, `href="${apple}"`)
          .replace(/href="\/pwa-192[^"]*"/g, `href="${icon192}"`)
          .replace(
            '<link rel="apple-touch-icon"',
            `<link rel="preload" href="${apple}" as="image" type="image/png" />\n    <link rel="preload" href="${icon192}" as="image" type="image/png" />\n    <link rel="icon" type="image/png" sizes="192x192" href="${icon192}" />\n    <link rel="icon" type="image/png" sizes="512x512" href="${icon512}" />\n    <link rel="apple-touch-icon"`,
          )
      },
    },
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // App auto-applies updates itself (see PwaUpdatePrompt) rather than asking the user to click refresh.
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        ICON_APPLE,
        ICON_192,
        ICON_512,
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
            src: `${ICON_192}${manifestIconQuery}`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${ICON_512}${manifestIconQuery}`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${ICON_APPLE}${manifestIconQuery}`,
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${ICON_512}${manifestIconQuery}`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest,xml,txt}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
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
