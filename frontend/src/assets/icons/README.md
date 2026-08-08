# Cridora icons

Vendored Lucide (ISC) stroke icons. Do not fetch icon SVGs from a CDN.

- Source of truth: `*.svg` in this folder
- App usage: import from `lucide-react` (Vite aliases to `src/lib/icons.jsx`)
- Regenerate after adding a new Lucide import:

```
node scripts/generate-icons-module.mjs
```
