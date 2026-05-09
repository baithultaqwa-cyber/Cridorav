import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = join(root, 'public', 'cridora-pwa-icon.svg')
const svg = readFileSync(svgPath)

const outs = [
  ['pwa-512.png', 512],
  ['pwa-192.png', 192],
  ['apple-touch-icon.png', 180],
]

for (const [name, size] of outs) {
  const outPath = join(root, 'public', name)
  await sharp(svg, { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(outPath)
  console.log('wrote', outPath)
}
