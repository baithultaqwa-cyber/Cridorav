import sharp from 'sharp'
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(frontendRoot, '..')
/**
 * Installable app icon (home screen / app switcher / splash / tray):
 * polished gold plaque on black — shadows lifted so the tile reads as real metal,
 * not a muddy “black patch” in the embossing.
 *
 * Filenames ending in `-goldbar` are intentional: Android / iOS home-screen
 * icons are keyed by URL *path*. Bump the path suffix whenever artwork changes.
 *
 * Legacy `-img1333` / `-medal` / … names are still written (same polished bytes).
 */
const assetsDir = join(frontendRoot, 'src', 'assets')
const compactSourcePath = join(assetsDir, 'pwalogo-img1333.png')
const rawSourcePath = join(assetsDir, 'IMG_1333.PNG')
/** Prefer original export; never re-polish an already-polished goldbar file. */
const pwaLogoPath = existsSync(rawSourcePath)
  ? rawSourcePath
  : compactSourcePath
const birdEmblemPath = join(assetsDir, 'cridora-bird-emblem.png')
const darkSourcePath = join(assetsDir, 'cridora-pwa-icon-dark.png')
const polishedSourcePath = join(assetsDir, 'pwalogo-goldbar.png')
const logoExportPath = join(repoRoot, 'logo-exports', '02-pwa-app-icon.png')

if (!existsSync(pwaLogoPath)) {
  throw new Error(`PWA logo source missing: ${pwaLogoPath}`)
}

/** Same near-black as vite PWA `manifest.background_color`. */
const BG = { r: 10, g: 10, b: 11, alpha: 1 }

const outs = [
  // Current install / tray / apple-touch paths (bump suffix when art changes).
  ['pwa-512-goldbar.png', 512],
  ['pwa-192-goldbar.png', 192],
  ['apple-touch-icon-goldbar.png', 180],
  // Previous generations — keep so older SW / bookmarks still resolve.
  ['pwa-512-img1333.png', 512],
  ['pwa-192-img1333.png', 192],
  ['apple-touch-icon-img1333.png', 180],
  ['pwa-512-medal.png', 512],
  ['pwa-192-medal.png', 192],
  ['apple-touch-icon-medal.png', 180],
  ['pwa-512-seal2.png', 512],
  ['pwa-192-seal2.png', 192],
  ['apple-touch-icon-seal2.png', 180],
  ['pwa-512-seal.png', 512],
  ['pwa-192-seal.png', 192],
  ['apple-touch-icon-seal.png', 180],
  ['pwa-512-black.png', 512],
  ['pwa-192-black.png', 192],
  ['apple-touch-icon-black.png', 180],
  ['pwa-512.png', 512],
  ['pwa-192.png', 192],
  ['apple-touch-icon.png', 180],
]

/**
 * Lift crushed emboss shadows toward warm gold so the launcher tile looks like
 * polished metal. Leaves true black background untouched.
 */
async function polishGoldPlaque(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const GOLD = { r: 212, g: 154, b: 36 } // polished bullion mid-gold
  const GOLD_LO = { r: 150, g: 98, b: 18 }
  const pxCount = width * height

  for (let p = 0; p < pxCount; p++) {
    const i = p * channels
    const x = p % width
    const y = (p / width) | 0
    const nx = (x / (width - 1)) * 2 - 1
    const ny = (y / (height - 1)) * 2 - 1
    // Squircle mask: true black only outside the gold bar (corners stay black).
    const insidePlaque = Math.pow(Math.abs(nx), 4.5) + Math.pow(Math.abs(ny), 4.5) < 0.78

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b

    if (!insidePlaque) continue

    // Even near-black recesses inside letters (O/D/R) become warm gold shadow —
    // those were the “black patch” on home-screen tiles.
    if (lum < 125) {
      const t = Math.min(1, (125 - lum) / 125)
      const lift = 0.82 * Math.max(t, lum < 40 ? 0.9 : t)
      const target = lum < 60 ? GOLD_LO : GOLD
      data[i] = Math.min(255, Math.round(r * (1 - lift) + target.r * lift + 20 * t))
      data[i + 1] = Math.min(255, Math.round(g * (1 - lift) + target.g * lift + 10 * t))
      data[i + 2] = Math.min(255, Math.round(b * (1 - lift) + target.b * lift + 2 * t))
      continue
    }

    if (lum < 185) {
      data[i] = Math.min(255, Math.round(r * 1.07 + 6))
      data[i + 1] = Math.min(255, Math.round(g * 1.03 + 2))
      data[i + 2] = Math.min(255, Math.round(b * 0.97))
      continue
    }

    data[i] = Math.min(255, Math.round(r * 1.04 + 10))
    data[i + 1] = Math.min(255, Math.round(g * 1.03 + 6))
    data[i + 2] = Math.min(255, Math.round(b * 1.01 + 2))
  }

  return sharp(data, { raw: { width, height, channels } })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

const sized = await sharp(pwaLogoPath)
  .resize(1024, 1024, { fit: 'contain', background: BG })
  .flatten({ background: BG })
  .png({ compressionLevel: 9 })
  .toBuffer()

const polished1024 = await polishGoldPlaque(sized)
await sharp(polished1024).toFile(polishedSourcePath)
console.log('wrote', polishedSourcePath)

// Keep an unpolished compact master for CI when IMG_1333.PNG is absent.
if (!existsSync(compactSourcePath) && pwaLogoPath === rawSourcePath) {
  await sharp(sized).toFile(compactSourcePath)
  console.log('wrote', compactSourcePath)
}

const master512 = await sharp(polished1024)
  .resize(512, 512, { fit: 'cover', position: 'centre' })
  .png({ compressionLevel: 9 })
  .toBuffer()

try {
  await sharp(master512).toFile(darkSourcePath)
  console.log('wrote', darkSourcePath)
  try {
    copyFileSync(darkSourcePath, logoExportPath)
    console.log('wrote', logoExportPath)
  } catch (err) {
    console.warn('skip logo-exports copy:', err.message)
  }
} catch (err) {
  console.warn('skip dark source write:', err.message)
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
