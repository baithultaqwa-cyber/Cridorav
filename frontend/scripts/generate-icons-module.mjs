/**
 * One-shot generator: Cridora icon barrel from lucide-animated + lucide-react fallback.
 * Run: node scripts/generate-icons-module.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const frontend = join(root, '..')
const src = join(frontend, 'src')

const ALIAS = {
  CheckCircle: 'CircleCheck',
  AlertCircle: 'CircleAlert',
  XCircle: 'CircleX',
  AlertTriangle: 'TriangleAlert',
  Edit2: 'Pencil',
  BarChart2: 'ChartNoAxesColumn',
  BarChart3: 'ChartColumn',
  MoreHorizontal: 'Ellipsis',
  Sliders: 'SlidersHorizontal',
  LineChart: 'ChartLine',
  PieChart: 'ChartPie',
  Unlock: 'LockOpen',
  LayoutDashboard: 'LayoutDashboard',
  FileCheck: 'FileCheck',
  FileCheck2: 'FileCheck2',
  HeartHandshake: 'HeartHandshake',
  Share2: 'Share2',
  BellRing: 'BellRing',
  ArrowUpRight: 'ArrowUpRight',
  ArrowDownRight: 'ArrowDownRight',
  ShoppingCart: 'Cart',
  ShoppingBag: 'ShoppingBag',
  SlidersHorizontal: 'SlidersHorizontal',
  RefreshCcw: 'RefreshCcw',
  RotateCcw: 'RotateCcw',
  UserPlus: 'UserPlus',
  UserCheck: 'UserCheck',
  KeyRound: 'KeyRound',
  Building2: 'Building2',
  DollarSign: 'DollarSign',
  Link2: 'Link2',
  Table2: 'Table2',
  WifiOff: 'WifiOff',
  LogOut: 'Logout',
  LogIn: 'Login',
  ExternalLink: 'ExternalLink',
  ShieldCheck: 'ShieldCheck',
  ShieldAlert: 'ShieldAlert',
  FileText: 'FileText',
}

/** Keep CSS-spin loaders + filled hearts on lucide-react. */
const FORCE_LUCIDE = new Set(['Loader2', 'Heart'])

function walk(dir, acc = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name === 'dist') continue
      walk(p, acc)
    } else if (/\.(jsx?|tsx?)$/.test(name.name)) acc.push(p)
  }
  return acc
}

const used = new Set()
const importRe =
  /import\s+(?:type\s+)?(?:\{([^}]+)\}|\*\s+as\s+\w+)\s+from\s+['"]lucide-react['"]/g
for (const file of walk(src)) {
  if (file.replace(/\\/g, '/').includes('/lib/icons')) continue
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

const dts = readFileSync(
  join(frontend, 'node_modules/lucide-animated/dist/index.d.ts'),
  'utf8',
)
const exportBlock = dts.match(/^export \{([\s\S]*)\}\s*;?\s*$/m)?.[1] || ''
const animated = new Set()
for (const part of exportBlock.split(',')) {
  const tokens = part.trim().split(/\s+/)
  if (!tokens.length || tokens[0] === 'type') continue
  const last = tokens[tokens.length - 1]
  if (/^[A-Z][A-Za-z0-9]*Icon$/.test(last)) animated.add(last.replace(/Icon$/, ''))
}

function animatedName(lucideName) {
  if (FORCE_LUCIDE.has(lucideName)) return null
  const candidates = [lucideName, ALIAS[lucideName]].filter(Boolean)
  for (const c of candidates) {
    if (animated.has(c)) return c
  }
  return null
}

const animatedPairs = []
const lucideNames = []
for (const name of [...used].sort()) {
  const a = animatedName(name)
  if (a) animatedPairs.push([name, a])
  else lucideNames.push(name)
}

const animatedImport = [...new Set(animatedPairs.map(([, a]) => `${a}Icon`))].sort()
const lines = []
lines.push(`/* eslint-disable no-unused-vars -- lucide props stripped for animated wrappers */`)
lines.push(`/**`)
lines.push(` * Cridora icon barrel — one Lucide family for web + PWA + dashboards.`)
lines.push(` * Animated icons from lucide-animated; remaining names from lucide-react.`)
lines.push(` * Generated ${new Date().toISOString().slice(0, 10)}. Do not edit by hand —`)
lines.push(` * run \`node scripts/generate-icons-module.mjs\` after adding a new Lucide import.`)
lines.push(` */`)
lines.push(`import { forwardRef } from 'react'`)
if (animatedImport.length) {
  lines.push(`import {`)
  for (const n of animatedImport) lines.push(`  ${n},`)
  lines.push(`} from 'lucide-animated'`)
}
if (lucideNames.length) {
  lines.push(`import {`)
  for (const n of lucideNames) lines.push(`  ${n} as Lucide${n},`)
  lines.push(`} from '#lucide-react'`)
}
lines.push(``)
lines.push(`function preferHover() {`)
lines.push(`  if (typeof window === 'undefined' || !window.matchMedia) return true`)
lines.push(`  return window.matchMedia('(hover: hover) and (pointer: fine)').matches`)
lines.push(`}`)
lines.push(``)
lines.push(`function asAnimated(Icon) {`)
lines.push(`  const Wrapped = forwardRef(function CridoraIcon(`)
lines.push(`    { strokeWidth: _strokeWidth, absoluteStrokeWidth: _absoluteStrokeWidth, animateOnHover, color, style, ...rest },`)
lines.push(`    ref,`)
lines.push(`  ) {`)
lines.push(`    return (`)
lines.push(`      <Icon`)
lines.push(`        ref={ref}`)
lines.push(`        animateOnHover={animateOnHover ?? preferHover()}`)
lines.push(`        style={{ display: 'inline-flex', lineHeight: 0, ...(color ? { color } : null), ...style }}`)
lines.push(`        {...rest}`)
lines.push(`      />`)
lines.push(`    )`)
lines.push(`  })`)
lines.push(`  Wrapped.displayName = Icon.displayName || 'CridoraIcon'`)
lines.push(`  return Wrapped`)
lines.push(`}`)
lines.push(``)
lines.push(`function asLucide(Icon) {`)
lines.push(`  const Wrapped = forwardRef(function CridoraLucideIcon({ animateOnHover: _animateOnHover, ...rest }, ref) {`)
lines.push(`    return <Icon ref={ref} {...rest} />`)
lines.push(`  })`)
lines.push(`  Wrapped.displayName = Icon.displayName || Icon.name || 'CridoraLucideIcon'`)
lines.push(`  return Wrapped`)
lines.push(`}`)
lines.push(``)

const seenAnimated = new Map()
for (const [lucideName, aName] of animatedPairs) {
  const exportId = `${aName}Icon`
  if (!seenAnimated.has(exportId)) {
    seenAnimated.set(exportId, `_A_${aName}`)
    lines.push(`const ${seenAnimated.get(exportId)} = asAnimated(${exportId})`)
  }
}
if (seenAnimated.size) lines.push(``)

for (const [lucideName, aName] of animatedPairs) {
  lines.push(`export const ${lucideName} = ${seenAnimated.get(`${aName}Icon`)}`)
}
if (lucideNames.length) {
  lines.push(``)
  for (const n of lucideNames) {
    lines.push(`export const ${n} = asLucide(Lucide${n})`)
  }
}
lines.push(``)

const out = join(src, 'lib', 'icons.jsx')
writeFileSync(out, `${lines.join('\n')}\n`)

console.log(`Used: ${used.size}`)
console.log(`Animated: ${animatedPairs.length}`)
console.log(`Lucide fallback: ${lucideNames.length}`)
if (lucideNames.length) console.log(`Fallback: ${lucideNames.join(', ')}`)
console.log(`Wrote ${out}`)
