import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(frontendRoot, '..')
const launcherDir = join(repoRoot, 'assets', 'android-launcher')
const fgSvg = readFileSync(join(launcherDir, 'ic_launcher_foreground.svg'))
const bgSvg = readFileSync(join(launcherDir, 'ic_launcher_background.svg'))

const outs = [
  ['pwa-512.png', 512],
  ['pwa-192.png', 192],
  ['apple-touch-icon.png', 180],
]

const density = 360

for (const [name, size] of outs) {
  const outPath = join(frontendRoot, 'public', name)
  const bgPng = await sharp(bgSvg, { density }).resize(size, size).png().toBuffer()
  const fgPng = await sharp(fgSvg, { density }).resize(size, size).png().toBuffer()
  await sharp(bgPng)
    .composite([{ input: fgPng }])
    .png({ compressionLevel: 9 })
    .toFile(outPath)
  console.log('wrote', outPath)
}
