import sharp from 'sharp'
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(frontendRoot, '..')
/**
 * Installable app icon (home screen / app switcher / splash):
 * gold bird seal on solid black — transparent corners in `cridora-bird-emblem.png`
 * otherwise flatten to white on Android/iOS tiles.
 * Matches `manifest.background_color` (`#0a0a0b`).
 *
 * Filenames ending in `-black` are intentional: iOS Web Clip icons are keyed by URL
 * path (Safari "shadow cache"). Changing the path forces a re-fetch; overwriting the
 * same `apple-touch-icon.png` URL often leaves the old white tile on the home screen.
 * Legacy unversioned names are still written so root discovery / old links stay correct.
 */
const birdEmblemPath = join(frontendRoot, 'src', 'assets', 'cridora-bird-emblem.png')
const darkSourcePath = join(frontendRoot, 'src', 'assets', 'cridora-pwa-icon-dark.png')
const logoExportPath = join(repoRoot, 'logo-exports', '02-pwa-app-icon.png')

/** Same near-black as vite PWA `manifest.background_color`. */
const BG = { r: 10, g: 10, b: 11, alpha: 1 }

const outs = [
  ['pwa-512-black.png', 512],
  ['pwa-192-black.png', 192],
  ['apple-touch-icon-black.png', 180],
  // Legacy paths (same bytes) — keep for older bookmarks / default Apple discovery.
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
