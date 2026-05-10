import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const emblemPath = join(frontendRoot, 'src', 'assets', 'cridora-coin-emblem.svg')
const emblemSrc = readFileSync(emblemPath, 'utf8')
const emblemInner = emblemSrc.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '')

/** 512 PNG canvas; emblem scaled to largest uniform size that still fits inside the square. */
const PWA_ICON_PX = 512

/** @returns {{ vw: number, vh: number, cx: number, cy: number }} */
function emblemViewMetrics(svgSrc) {
  const m = svgSrc.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)
  let vw = 1265
  let vh = 1280
  let ox = 0
  let oy = 0
  if (m) {
    const parts = m[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
    if (parts.length >= 4) {
      ;[ox, oy, vw, vh] = parts
    }
  }
  return { vw, vh, cx: ox + vw / 2, cy: oy + vh / 2 }
}

const { cx, cy, vw, vh } = emblemViewMetrics(emblemSrc)
const emblemScale = PWA_ICON_PX / Math.max(vw, vh)

/** Glossy black square (matches icon canvas). */
function pwaBackgroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PWA_ICON_PX} ${PWA_ICON_PX}" width="${PWA_ICON_PX}" height="${PWA_ICON_PX}">
<defs>
  <radialGradient id="pwaBgR" cx="32%" cy="28%" r="78%">
    <stop offset="0%" stop-color="#5a5a5a"/>
    <stop offset="22%" stop-color="#2c2c2c"/>
    <stop offset="52%" stop-color="#0f0f0f"/>
    <stop offset="100%" stop-color="#020202"/>
  </radialGradient>
  <linearGradient id="pwaBgGloss" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
    <stop offset="38%" stop-color="#ffffff" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.32"/>
  </linearGradient>
</defs>
<rect width="${PWA_ICON_PX}" height="${PWA_ICON_PX}" fill="url(#pwaBgR)"/>
<rect width="${PWA_ICON_PX}" height="${PWA_ICON_PX}" fill="url(#pwaBgGloss)"/>
</svg>`
}

/** Emblem centered on transparent square; scale = contain (fills height or width of canvas). */
function pwaForegroundSvg() {
  const half = PWA_ICON_PX / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PWA_ICON_PX} ${PWA_ICON_PX}" width="${PWA_ICON_PX}" height="${PWA_ICON_PX}">
<defs>
  <linearGradient id="pwaGold" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#fff9e0"/>
    <stop offset="28%" stop-color="#f4d35e"/>
    <stop offset="55%" stop-color="#d4a82a"/>
    <stop offset="100%" stop-color="#6b5212"/>
  </linearGradient>
</defs>
<g fill="url(#pwaGold)" transform="translate(${half} ${half}) scale(${emblemScale}) translate(${-cx} ${-cy})">
${emblemInner.trim()}
</g>
</svg>`
}

const bgSvg = Buffer.from(pwaBackgroundSvg())
const fgSvg = Buffer.from(pwaForegroundSvg())

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
