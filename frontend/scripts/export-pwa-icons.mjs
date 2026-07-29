import sharp from 'sharp'
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(frontendRoot, '..')
/**
 * Installable app icon (home screen / app switcher / splash / tray):
 * gold bird seal on solid near-black — transparent corners in
 * `cridora-bird-emblem.png` otherwise flatten to white on Android/iOS tiles.
 * Matches `manifest.background_color` (`#0a0a0b`).
 *
 * Filenames ending in `-seal` are intentional: Android / iOS home-screen
 * icons are keyed by URL *path*. Overwriting the same filename (or only
 * changing `?v=`) often leaves the old tile on already-installed PWAs.
 * Bump the path suffix whenever the artwork changes again.
 *
 * Legacy `-black` / unversioned names are still written so old bookmarks
 * and SW caches keep resolving to *something* (same bytes).
 */
const birdEmblemPath = join(frontendRoot, 'src', 'assets', 'cridora-bird-emblem.png')
const darkSourcePath = join(frontendRoot, 'src', 'assets', 'cridora-pwa-icon-dark.png')
const logoExportPath = join(repoRoot, 'logo-exports', '02-pwa-app-icon.png')

/** Same near-black as vite PWA `manifest.background_color`. */
const BG = { r: 10, g: 10, b: 11, alpha: 1 }

const outs = [
  // Current install / tray / apple-touch paths (bump suffix when art changes).
  ['pwa-512-seal.png', 512],
  ['pwa-192-seal.png', 192],
  ['apple-touch-icon-seal.png', 180],
  // Previous generation (same bytes) — keep for older SW / bookmarks.
  ['pwa-512-black.png', 512],
  ['pwa-192-black.png', 192],
  ['apple-touch-icon-black.png', 180],
  // Oldest discovery names.
  ['pwa-512.png', 512],
  ['pwa-192.png', 192],
  ['apple-touch-icon.png', 180],
]

const master512 = await sharp(birdEmblemPath)
  .resize(512, 512, { fit: 'contain', background: BG })
  .flatten({ background: BG })
  .png({ compressionLevel: 9 })
  .toBuffer()

await sharp(master512).toFile(darkSourcePath)
console.log('wrote', darkSourcePath)

try {
  copyFileSync(darkSourcePath, logoExportPath)
  console.log('wrote', logoExportPath)
} catch (err) {
  console.warn('skip logo-exports copy:', err.message)
}

for (const [name, size] of outs) {
  const outPath = join(frontendRoot, 'public', name)
  await sharp(master512)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toFile(outPath)
  console.log('wrote', outPath)
}

/**
 * Android status-bar / tray *badge* must be a white silhouette on transparent
 * background (colored PNGs get flattened to a white blob by the OS).
 */
const badgePath = join(frontendRoot, 'public', 'pwa-badge-96.png')
const emblemRaw = await sharp(birdEmblemPath)
  .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const { data, info } = emblemRaw
for (let i = 0; i < data.length; i += info.channels) {
  const a = data[i + 3]
  if (a > 16) {
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
    // keep alpha
  } else {
    data[i] = 0
    data[i + 1] = 0
    data[i + 2] = 0
    data[i + 3] = 0
  }
}
await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
  .png({ compressionLevel: 9 })
  .toFile(badgePath)
console.log('wrote', badgePath)
