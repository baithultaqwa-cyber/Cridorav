import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
/** Source of truth: bird seal logo (also in repo `logo-exports/01-bird-emblem.png`). */
const emblemPath = join(frontendRoot, 'src', 'assets', 'cridora-bird-emblem.png')

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
