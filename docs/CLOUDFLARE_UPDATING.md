# Hide Cloudflare error pages during Railway deploys

Hard refresh while Cridorav is redeploying hits a down origin. Cloudflare then shows its **521 / 522 / 523 / 502** page. The media volume on Railway also means **true zero-downtime overlap is not possible** (one volume = one active container).

Goal: visitors see a Cridora “updating” page that auto-refreshes, not Cloudflare’s error HTML.

## 1. Cloudflare dashboard (do this once, while the site is up)

### Always Online (Free, 30 seconds)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → zone **cridora.com**
2. **Caching** → **Configuration**
3. Turn **Always Online** **On**

If Cloudflare still has a cached snapshot, hard refresh may show the last good site instead of an error.

### Custom Error Pages (Pro+ only)

1. **Error Pages** (or **Rules** → **Custom Errors**)
2. For **500 class errors** / **521 / 522 / 523 / 502**, set the page URL to:

   `https://cridora.com/updating.html`

   Cloudflare snapshots that HTML once. After that it works even when Railway is down.

### Origin-fallback Worker (Free, recommended)

This Worker sits on `cridora.com` and replaces 52x / origin-down with `/updating.html` content.

```bash
cd cloudflare/origin-fallback
npx wrangler login
npx wrangler deploy
```

Then in Cloudflare → **Workers & Pages** → **cridora-origin-fallback** → **Triggers** → add routes:

- `cridora.com/*`
- `www.cridora.com/*`

DNS records for `cridora.com` / `www` must stay **proxied** (orange cloud).

## 2. Railway (already in repo `railway.json`)

- Healthcheck: `GET /healthz/` must return 200 before traffic switches.
- `DJANGO_ALLOWED_HOSTS` must include `healthcheck.railway.app` (code adds it automatically).
- **Volume caveat:** attached `/app/media` volume still causes a short outage on each deploy. The Worker / Always Online / Error Pages cover that window.

## 3. Verify

While a deploy is running, hard-refresh `https://cridora.com/`. You should see **Cridora is updating** (or the last cached site), not Cloudflare’s error page. It reloads itself after ~4 seconds.
