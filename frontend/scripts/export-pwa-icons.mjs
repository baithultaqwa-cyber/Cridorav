import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
/**
 * Source of truth for the installable app icon (home screen / app switcher / splash):
 * bird seal emblem on a black background, matching `manifest.background_color` (`#0a0a0b`)
 * so there's no white flash/border on Android/iOS home screens.
 * Also in repo at `logo-exports/02-pwa-app-icon.png`.
 * NOTE: this is a different asset from `cridora-bird-emblem.png` (white bg), which stays
 * as-is since it's composited inside the in-app gold coin logo (`CridoraLogo.jsx`).
 */
const emblemPath = join(frontendRoot, 'src', 'assets', 'cridora-pwa-icon-dark.png')

const outs = [
  ['pwa-512.png', 512],
  ['pwa-192.png', 192],
  ['apple-touch-icon.png', 180],
]

for (const [name, size] of outs) {
  const outPath = join(frontendRoot, 'public', name)
  await sharp(emblemPath)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toFile(outPath)
  console.log('wrote', outPath)
}
