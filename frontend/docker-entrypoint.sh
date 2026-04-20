#!/bin/sh
set -e
cd /app
node <<'NODE'
const fs = require('fs')
const path = require('path')
const origin = process.env.CRIDORA_API_ORIGIN || process.env.API_PUBLIC_URL || ''
const out = path.join(process.cwd(), 'dist', 'config.runtime.js')
fs.writeFileSync(
  out,
  'window.__CRIDORA_API_ORIGIN__=' + JSON.stringify(origin) + ';\n',
  'utf8'
)
NODE
exec serve -s dist -l "${PORT:-3000}"
