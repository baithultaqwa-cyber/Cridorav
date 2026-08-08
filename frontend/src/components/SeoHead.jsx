import { Helmet } from 'react-helmet-async'
import { SITE_ORIGIN } from '../config'

function normPath(path) {
  let p = (path || '/').trim()
  if (!p.startsWith('/')) p = `/${p}`
  return p.replace(/\/+$/, '') === '' ? '/' : p.replace(/\/+$/, '')
}

/**
 * Route-level SEO tags (SPA). Canonical and OG urls use SITE_ORIGIN from config/runtime.
 *
 * @param {object} props
 * @param {string} [props.title] — page title segment before " | Cridora"
 * @param {string} props.description — meta description (keep under ~155 chars ideally)
 * @param {string} props.path — canonical path (e.g. "/marketplace")
 * @param {boolean} [props.noindex] — set robots noindex,nofollow
 * @param {string} [props.ogTitle] — override og:title / twitter:title (defaults to full title)
 * @param {string} [props.ogDescription] — override og:description / twitter (defaults to description)
 * @param {string} [props.ogImagePath] — path under site root for og:image
 * @param {object | object[]} [props.jsonLd] — structured data schema object(s)
 */
export default function SeoHead({
  title,
  description,
  path,
  noindex = false,
  ogTitle,
  ogDescription,
  ogImagePath = '/pwa-512-medal.png',
  jsonLd = null,
}) {
  const p = normPath(path)
  const canonical = `${SITE_ORIGIN}${p}`
  const fullTitle =
    title != null && String(title).trim() !== ''
      ? `${title.trim()} | Cridora`
      : 'Cridora — Buy Physical Gold from Verified UAE Bullion Dealers'
  const desc = String(description || '').trim()
  const ogTpl = ogTitle != null && String(ogTitle).trim() !== '' ? String(ogTitle).trim() : fullTitle
  const ogDesc = ogDescription != null && String(ogDescription).trim() !== '' ? String(ogDescription).trim() : desc
  const imgPath = ogImagePath.startsWith('/') ? ogImagePath : `/${ogImagePath}`
  const ogImage = `${SITE_ORIGIN}${imgPath}`

  const ldPieces = []
  if (jsonLd != null) {
    if (Array.isArray(jsonLd)) {
      ldPieces.push(...jsonLd.filter(Boolean))
    } else {
      ldPieces.push(jsonLd)
    }
  }

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />

      <link rel="canonical" href={canonical} />

      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Cridora" />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={ogTpl} />
      <meta property="og:description" content={ogDesc} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="en_AE" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTpl} />
      <meta name="twitter:description" content={ogDesc} />
      <meta name="twitter:image" content={ogImage} />

      {ldPieces.map((schema, idx) =>
        typeof schema === 'object' && schema !== null ? (
          <script key={`ld-${idx}`} type="application/ld+json">
            {JSON.stringify(schema)}
          </script>
        ) : null,
      )}
    </Helmet>
  )
}
