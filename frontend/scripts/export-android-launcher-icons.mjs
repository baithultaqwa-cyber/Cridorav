import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = join(__dirname, '..')
const launcherSrc = join(frontendRoot, 'android-launcher')
const repoRoot = join(frontendRoot, '..')
const base = join(repoRoot, 'assets', 'android-launcher')
const fgSvg = readFileSync(join(launcherSrc, 'ic_launcher_foreground.svg'))
const bgSvg = readFileSync(join(launcherSrc, 'ic_launcher_background.svg'))

/** Android adaptive icon layers: one PNG per density (108 dp base). @see https://developer.android.com/develop/ui/views/launch-icon */
const dpiToPx = [
  ['mipmap-mdpi', 108],
  ['mipmap-hdpi', 162],
  ['mipmap-xhdpi', 216],
  ['mipmap-xxhdpi', 324],
  ['mipmap-xxxhdpi', 432],
]

const density = 360

async function renderLayer(svg, size, outPath) {
  await sharp(svg, { density })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(outPath)
}

for (const [folder, size] of dpiToPx) {
  const dir = join(base, folder)
  mkdirSync(dir, { recursive: true })
  await renderLayer(fgSvg, size, join(dir, 'ic_launcher_foreground.png'))
  await renderLayer(bgSvg, size, join(dir, 'ic_launcher_background.png'))
  console.log('wrote', folder, size + 'px')
}

const out512 = join(base, 'ic_launcher_512_composite.png')
const sz = 512
const bgPng = await sharp(bgSvg, { density }).resize(sz, sz).png().toBuffer()
const fgPng = await sharp(fgSvg, { density }).resize(sz, sz).png().toBuffer()
await sharp(bgPng).composite([{ input: fgPng }]).png({ compressionLevel: 9 }).toFile(out512)
console.log('wrote', out512)
