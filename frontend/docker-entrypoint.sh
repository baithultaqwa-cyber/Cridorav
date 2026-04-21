#!/bin/sh
set -e
cd /app
node <<'NODE'
const fs = require('fs')
const path = require('path')
const origin = process.env.CRIDORA_API_ORIGIN || process.env.API_PUBLIC_URL || ''
const out = path.join(process.cwd(), 'dist', 'config.runtime.js')
const body =
  origin && origin.trim() !== ''
    ? 'window.__CRIDORA_API_ORIGIN__=' + JSON.stringify(origin) + ';\n'
    : 'window.__CRIDORA_API_ORIGIN__=(typeof window!=="undefined"&&window.location)?window.location.origin:"";\n'
fs.writeFileSync(out, body, 'utf8')
NODE
exec serve -s dist -l "${PORT:-3000}"
