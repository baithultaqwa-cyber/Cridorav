# Cloudflare AI Crawler Policy for Cridora

Manual production checklist. These settings live in the Cloudflare dashboard for `cridora.com` and are not applied by deploying this repo alone.

Preferred content use: **search and real-time reference allowed**, **model training blocked**.

## 1. AI bot traffic policies

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → zone `cridora.com`.
2. Go to **Security** → **Settings** (or **AI Crawl Control**).
3. Under **Configure AI bot policies** / bot traffic options:
   - **Search** → **Allow**
   - **Agent** → **Allow**
   - **Training** → **Block (on all pages)**
4. If the legacy **Block AI bots** toggle is still present, do **not** use it to blanket-block mixed Search+Training crawlers if that would also kill Search; prefer the newer Search / Agent / Training controls.

## 2. Managed robots.txt + Content Signals

1. In **AI Crawl Control** / **Security Settings** → Bot traffic:
   - Enable **Set your preference to block training in robots.txt** (managed robots).
2. Confirm the managed block prepends signals equivalent to:
   - `Content-Signal: search=yes, ai-train=no, use=reference`
3. Confirm Cloudflare still merges with origin [`frontend/public/robots.txt`](../frontend/public/robots.txt), which:
   - Allows public pages and agent docs (`/llms.txt`, `*.txt`, OpenAPI)
   - Disallows `/dashboard/`, `/payment/`, `/sell-status/`, auth routes
4. After saving, fetch `https://cridora.com/robots.txt` and verify:
   - It does **not** contain blanket `Disallow: /` for GPTBot, ClaudeBot, ChatGPT-User, Google-Extended, PerplexityBot, or similar reference crawlers
   - Training preference remains `ai-train=no`
   - Origin sitemap and `LLMs-Txt` hints remain visible

**Note (pre-change production snapshot, 2026-08-04):** Cloudflare Managed Content already emits
`Content-Signal: search=yes,ai-train=no,use=reference` but still prepends `Disallow: /` for
GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot, Bytespider, Amazonbot, and
meta-externalagent. Until Search/Agent are explicitly Allowed in AI Crawl Control, those
bots will keep being blocked even after origin `robots.txt` is updated.
## 3. Markdown for Agents (optional, recommended)

If available on the zone:

1. Enable **Markdown for Agents** for public marketing paths only.
2. Do **not** enable it for authenticated or transactional paths:
   - `/dashboard/*`
   - `/payment/*`
   - `/sell-status/*`
   - `/signin`, `/signup`, `/reset-password`

## 4. Post-change verification

```bash
curl -sS https://cridora.com/robots.txt | head -n 80
curl -sS -o NUL -w "%{http_code} %{content_type}\n" https://cridora.com/llms.txt
curl -sS -o NUL -w "%{http_code} %{content_type}\n" https://cridora.com/openapi-public-v1.yaml
curl -sS -o NUL -w "%{http_code}\n" https://cridora.com/api/spot-prices/
```

Expected:
- `llms.txt` and `openapi-public-v1.yaml` return `200` with plain/yaml bodies (not the SPA HTML shell)
- Public rate API still returns JSON
- Cloudflare **AI Crawl Control** activity shows Search/Agent crawls succeeding and Training blocked

## 5. Related origin files

| File | Role |
|------|------|
| `/llms.txt` | Agent entry point |
| `/overview.txt`, `/marketplace.txt`, `/how-it-works.txt`, `/vendors.txt`, `/terms.txt`, `/uae-gold-comparison.txt` | Plain-text product facts |
| `/openapi-public-v1.yaml` | Allowlisted read-only API contract |
| `/sitemap.xml` | Public URL list |
| `/robots.txt` | Origin crawl rules + LLMs-Txt hint |
