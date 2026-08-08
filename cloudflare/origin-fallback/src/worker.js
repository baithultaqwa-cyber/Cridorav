/**
 * Intercept Railway origin outages (deploys / 52x) and return Cridora's
 * updating page instead of Cloudflare's default error HTML.
 *
 * Route this Worker on cridora.com/* and www.cridora.com/* (see wrangler.toml).
 * fetch(request) from a Worker Route goes to the orange-cloud origin.
 */

const UPDATING_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="4" />
    <title>Cridora is updating</title>
    <meta name="robots" content="noindex" />
    <style>
      :root { color-scheme: dark; --gold:#e8c34a; --bg:#0c0a07; --text:#f6efdd; --muted:#9a8b72; }
      * { box-sizing: border-box; }
      html, body { margin:0; min-height:100%; background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,'Segoe UI',sans-serif; }
      main { min-height:100dvh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:2rem 1.25rem; text-align:center; }
      .mark { width:2.5rem; height:2.5rem; border-radius:999px; border:2px solid color-mix(in srgb, var(--gold) 70%, transparent); margin-bottom:1.25rem; animation:pulse 1.4s ease-in-out infinite; }
      h1 { margin:0 0 .5rem; font-size:1.45rem; font-weight:600; letter-spacing:.02em; color:var(--gold); }
      p { margin:0; max-width:28rem; line-height:1.5; color:var(--muted); font-size:.98rem; }
      @keyframes pulse { 0%,100%{opacity:.45;transform:scale(.92)} 50%{opacity:1;transform:scale(1)} }
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true"></div>
      <h1>Cridora is updating</h1>
      <p>A new version is going live. This page refreshes automatically — usually a few seconds.</p>
    </main>
    <script>setTimeout(function(){location.reload()},4000)</script>
  </body>
</html>`

function updatingResponse() {
  return new Response(UPDATING_HTML, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '4',
    },
  })
}

function isEdgeOriginDown(res) {
  const code = res.status
  return (code >= 520 && code <= 527) || code === 530
}

export default {
  async fetch(request) {
    try {
      const res = await fetch(request)
      if (isEdgeOriginDown(res)) return updatingResponse()
      return res
    } catch {
      return updatingResponse()
    }
  },
}
