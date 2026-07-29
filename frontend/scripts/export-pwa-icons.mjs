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
 * In-app header logo (`CridoraLogo.jsx`) still uses the transparent emblem on the gold coin.
 */
const birdEmblemPath = join(frontendRoot, 'src', 'assets', 'cridora-bird-emblem.png')
const darkSourcePath = join(frontendRoot, 'src', 'assets', 'cridora-pwa-icon-dark.png')
const logoExportPath = join(repoRoot, 'logo-exports', '02-pwa-app-icon.png')

/** Same near-black as vite PWA `manifest.background_color`. */
const BG = { r: 10, g: 10, b: 11, alpha: 1 }

const outs = [
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
