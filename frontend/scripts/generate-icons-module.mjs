/**
 * Vendor used Lucide icons into `src/assets/icons/` (SVG + React wrappers).
 * Run: node scripts/generate-icons-module.mjs
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const frontend = join(root, '..')
const src = join(frontend, 'src')
const iconsDir = join(src, 'assets', 'icons')
const lucideEsm = join(frontend, 'node_modules', 'lucide-react', 'dist', 'esm')
const lucideIcons = join(lucideEsm, 'icons')
const lucideIndex = readFileSync(join(lucideEsm, 'lucide-react.js'), 'utf8')
const lucideExportToFile = new Map()
for (const m of lucideIndex.matchAll(
  /export \{([^}]+)\} from '\.\/icons\/([^']+)\.js'/g,
)) {
  const file = m[2]
  for (const part of m[1].split(',')) {
    const name = part.trim().replace(/^default as /, '').trim()
    if (name && !name.startsWith('Lucide') && !name.endsWith('Icon')) {
      lucideExportToFile.set(name, file)
    }
  }
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name === 'dist' || name.name === 'assets') continue
      walk(p, acc)
    } else if (/\.(jsx?|tsx?)$/.test(name.name)) acc.push(p)
  }
  return acc
}

function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase()
}

function attrToJsx(key, value) {
  if (key === 'key') return null
  if (typeof value === 'string') return `${key}="${value.replace(/"/g, '&quot;')}"`
  return `${key}={${JSON.stringify(value)}}`
}

function attrToSvg(key, value) {
  if (key === 'key') return null
  const kebab = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
  return `${kebab}="${String(value).replace(/"/g, '&quot;')}"`
}

function parseIconNode(source) {
  const m = source.match(/const __iconNode = (\[[\s\S]*?\]);/)
  if (!m) return null
  try {
    return Function(`"use strict"; return (${m[1]})`)()
  } catch {
    return null
  }
}

function resolveLucideFile(pascalName) {
  const mapped = lucideExportToFile.get(pascalName)
  const tried = [mapped, toKebab(pascalName)].filter(Boolean)
  const aliases = {
    home: 'house',
    fingerprint: 'fingerprint-pattern',
    'bar-chart-2': 'bar-chart-2',
    'bar-chart-3': 'bar-chart-3',
    'edit-2': 'pencil',
    unlock: 'lock-open',
    'line-chart': 'chart-line',
    'pie-chart': 'chart-pie',
    'alert-triangle': 'triangle-alert',
    'alert-circle': 'circle-alert',
    'x-circle': 'circle-x',
    'check-circle': 'circle-check',
    'more-horizontal': 'ellipsis',
    sliders: 'sliders-horizontal',
  }
  const first = toKebab(pascalName)
  if (aliases[first]) tried.push(aliases[first])

  for (const slug of tried) {
    const file = join(lucideIcons, `${slug}.js`)
    try {
      let srcText = readFileSync(file, 'utf8')
      const reexport = srcText.match(/export \{ default \} from '\.\/([^']+)\.js'/)
      if (reexport) srcText = readFileSync(join(lucideIcons, `${reexport[1]}.js`), 'utf8')
      const node = parseIconNode(srcText)
      if (node) return { slug, node }
    } catch {
      /* try next */
    }
  }
  return null
}

const used = new Set()
const importRe =
  /import\s+(?:type\s+)?(?:\{([^}]+)\}|\*\s+as\s+\w+)\s+from\s+['"]lucide-react['"]/g
for (const file of walk(src)) {
  if (file.replace(/\\/g, '/').includes('/lib/icons')) continue
  if (file.replace(/\\/g, '/').includes('/assets/icons/')) continue
  const text = readFileSync(file, 'utf8')
  let m
  importRe.lastIndex = 0
  while ((m = importRe.exec(text))) {
    if (!m[1]) continue
    for (const part of m[1].split(',')) {
      const token = part.trim()
      if (!token) continue
      const name = token.split(/\s+as\s+/)[0].trim()
      if (name) used.add(name)
    }
  }
}

mkdirSync(iconsDir, { recursive: true })
for (const name of readdirSync(iconsDir)) {
  if (name === '_Icon.jsx' || name === 'README.md') continue
  rmSync(join(iconsDir, name), { force: true })
}

const barrel = []
barrel.push(`/* eslint-disable react-refresh/only-export-components */`)
barrel.push(`/**`)
barrel.push(` * Cridora icons — local Lucide SVGs under src/assets/icons (no CDN).`)
barrel.push(` * Generated ${new Date().toISOString().slice(0, 10)}. Run:`)
barrel.push(` *   node scripts/generate-icons-module.mjs`)
barrel.push(` */`)

const missing = []
const written = []

for (const name of [...used].sort()) {
  const resolved = resolveLucideFile(name)
  if (!resolved) {
    missing.push(name)
    continue
  }
  const { slug, node } = resolved
  const svgInner = node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .map(([k, v]) => attrToSvg(k, v))
        .filter(Boolean)
        .join(' ')
      return `  <${tag}${a ? ` ${a}` : ''} />`
    })
    .join('\n')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
${svgInner}
</svg>
`

  const jsxInner = node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .map(([k, v]) => attrToJsx(k, v))
        .filter(Boolean)
        .join(' ')
      return `      <${tag}${a ? ` ${a}` : ''} />`
    })
    .join('\n')

  writeFileSync(join(iconsDir, `${slug}.svg`), svg)
  writeFileSync(
    join(iconsDir, `${name}.jsx`),
    `import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const ${name} = forwardRef(function ${name}(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
${jsxInner}
    </CridoraIcon>
  )
})

export default ${name}
`,
  )
  barrel.push(`export { default as ${name} } from '../assets/icons/${name}.jsx'`)
  written.push(name)
}

writeFileSync(join(iconsDir, 'README.md'), `# Cridora icons

Vendored Lucide (ISC) stroke icons. Do not fetch icon SVGs from a CDN.

- Source of truth: \`*.svg\` in this folder
- App usage: import from \`lucide-react\` (Vite aliases to \`src/lib/icons.jsx\`)
- Regenerate after adding a new Lucide import:

\`\`\`
node scripts/generate-icons-module.mjs
\`\`\`
`)

writeFileSync(join(src, 'lib', 'icons.jsx'), `${barrel.join('\n')}\n`)

console.log(`Vendored ${written.length} icons → src/assets/icons/`)
if (missing.length) {
  console.error(`Missing Lucide sources: ${missing.join(', ')}`)
  process.exit(1)
}
