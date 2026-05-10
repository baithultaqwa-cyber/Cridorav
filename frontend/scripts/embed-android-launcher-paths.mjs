/**
 * Converts Bodoni Moda text in the launcher foreground to SVG paths so Android VectorDrawable,
 * PNG rasterizers without fonts, and adaptive layers never render tofu boxes.
 * Run after editing letterforms: node scripts/embed-android-launcher-paths.mjs
 */
import opentype from 'opentype.js'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const decompressWoff2 = require('wawoff2/decompress.js')

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = join(__dirname, '..')
const fontDir = join(frontendRoot, 'node_modules', '@fontsource', 'bodoni-moda', 'files')

async function loadFont(woff2Name) {
  const woff2 = readFileSync(join(fontDir, woff2Name))
  const ttf = await decompressWoff2(woff2)
  return opentype.parse(ttf)
}

const font800 = await loadFont('bodoni-moda-latin-800-normal.woff2')
const font900 = await loadFont('bodoni-moda-latin-900-normal.woff2')

/** 108dp adaptive canvas: larger = more readable; keep ~inside 66dp safe circle. */
const COIN_SCALE = 0.34
const COIN_ANCHOR_Y = 38
const COIN_LETTER_SIZE = 31
const WORDMARK_SIZE = 11.25
const WORDMARK_BASELINE = 65.5

function layoutText(font, text, fontSize, letterSpacingEm, baselineY, centerX) {
  const scale = fontSize / font.unitsPerEm
  const tracking = letterSpacingEm * fontSize
  let width = 0
  for (let i = 0; i < text.length; i++) {
    const g = font.charToGlyph(text[i])
    width += g.advanceWidth * scale
    if (i < text.length - 1) width += tracking
  }
  let x = centerX - width / 2
  const chunks = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const g = font.charToGlyph(ch)
    const p = font.getPath(ch, x, baselineY, fontSize)
    chunks.push(p.toPathData(2))
    x += g.advanceWidth * scale + tracking
  }
  return chunks.join(' ')
}

function coinCPaths() {
  const size = COIN_LETTER_SIZE
  const bb = font800.getPath('C', 0, 0, size).getBoundingBox()
  const x = 50 - (bb.x1 + bb.x2) / 2
  const shadow = font800.getPath('C', x + 0.4, 60 + 0.8, size)
  const main = font800.getPath('C', x, 60, size)
  return {
    shadowD: shadow.toPathData(2),
    mainD: main.toPathData(2),
  }
}

const wordmarkD = layoutText(
  font900,
  'CRIDORA',
  WORDMARK_SIZE,
  -0.06,
  WORDMARK_BASELINE,
  54
)
const { shadowD, mainD } = coinCPaths()

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108">
  <!-- Text outlined as paths (Bodoni Moda 800/900). Regenerate: node scripts/embed-android-launcher-paths.mjs -->
  <defs>
    <radialGradient id="crg-base-and" cx="32%" cy="28%" r="78%" fx="32%" fy="28%">
      <stop offset="0%" stop-color="#fff9e0" stop-opacity="0.98"/>
      <stop offset="12%" stop-color="#f4d35e"/>
      <stop offset="32%" stop-color="#d4a82a"/>
      <stop offset="58%" stop-color="#9a7420"/>
      <stop offset="100%" stop-color="#3d2f08"/>
    </radialGradient>
    <radialGradient id="crg-dim-and" cx="50%" cy="55%" r="45%">
      <stop offset="0%" stop-color="#2a1f04" stop-opacity="0"/>
      <stop offset="70%" stop-color="#1a1402" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#0d0a01" stop-opacity="0.45"/>
    </radialGradient>
    <linearGradient id="crg-rim-lip-and" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#e8c65c"/>
      <stop offset="0.4" stop-color="#a67c18"/>
      <stop offset="1" stop-color="#4a3a0c"/>
    </linearGradient>
    <linearGradient id="crg-letter-and" x1="18%" y1="12%" x2="82%" y2="88%">
      <stop stop-color="#fff4c8"/>
      <stop offset="0.35" stop-color="#e8c040"/>
      <stop offset="0.72" stop-color="#7a5c10"/>
      <stop offset="1" stop-color="#2a2008"/>
    </linearGradient>
  </defs>
  <g transform="translate(54 ${COIN_ANCHOR_Y}) scale(${COIN_SCALE}) translate(-50 -50)">
    <circle cx="50" cy="50" r="49.5" fill="url(#crg-base-and)"/>
    <circle cx="50" cy="50" r="48.8" fill="none" stroke="url(#crg-rim-lip-and)" stroke-width="1.1"/>
    <circle cx="50" cy="50" r="47.6" fill="none" stroke="#2d2308" stroke-opacity="0.5" stroke-width="0.5" stroke-dasharray="0.5 0.45"/>
    <circle cx="50" cy="50" r="42" fill="url(#crg-dim-and)"/>
    <circle cx="50" cy="50" r="41" fill="none" stroke="#1f1805" stroke-opacity="0.4" stroke-width="0.35"/>
    <path d="${shadowD}" fill="#0a0802" fill-opacity="0.28"/>
    <path d="${mainD}" fill="url(#crg-letter-and)" stroke="#120d04" stroke-width="0.2" stroke-opacity="0.45" paint-order="stroke fill"/>
  </g>
  <path d="${wordmarkD}" fill="#f5f0e8" stroke="#070605" stroke-width="0.16" stroke-opacity="0.35" paint-order="stroke fill"/>
</svg>
`

const out = join(frontendRoot, 'android-launcher', 'ic_launcher_foreground.svg')
writeFileSync(out, svg, 'utf8')
console.log('wrote', out)
