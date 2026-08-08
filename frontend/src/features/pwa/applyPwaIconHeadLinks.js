import {
  APPLE_TOUCH_ICON,
  PWA_ICON_192,
  PWA_ICON_512,
  PWA_ICON_QUERY,
  PWA_ICON_REVISION,
} from './iconRevision'

/**
 * Keep document head icon / apple-touch links on the current path-busted URLs.
 * Installed PWAs often keep an old index.html shell until SW activates; patching
 * head links + warming the new icon URLs helps Chrome/Android pick up the tile
 * as soon as the updated manifest is live.
 */
export function applyPwaIconHeadLinks() {
  if (typeof document === 'undefined') return

  const apple = `${APPLE_TOUCH_ICON}${PWA_ICON_QUERY}`
  const icon192 = `${PWA_ICON_192}${PWA_ICON_QUERY}`
  const icon512 = `${PWA_ICON_512}${PWA_ICON_QUERY}`

  const ensureLink = (key, rel, href, attrs = {}) => {
    let el = document.head.querySelector(`link[data-cridora-pwa-icon="${key}"]`)
    if (!el) {
      el = document.createElement('link')
      el.setAttribute('data-cridora-pwa-icon', key)
      el.setAttribute('rel', rel)
      document.head.appendChild(el)
    }
    el.setAttribute('rel', rel)
    el.setAttribute('href', href)
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v)
    }
  }

  document.head.querySelectorAll('link[rel="apple-touch-icon"]').forEach((el) => {
    el.setAttribute('href', apple)
  })
  document.head.querySelectorAll('link[rel="icon"]').forEach((el) => {
    const sizes = el.getAttribute('sizes') || ''
    el.setAttribute('href', sizes.includes('512') ? icon512 : icon192)
    el.setAttribute('type', 'image/png')
  })

  ensureLink('apple', 'apple-touch-icon', apple, { sizes: '180x180' })
  ensureLink('icon-192', 'icon', icon192, { type: 'image/png', sizes: '192x192' })
  ensureLink('icon-512', 'icon', icon512, { type: 'image/png', sizes: '512x512' })

  ;[apple, icon192, icon512].forEach((href) => {
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = href
    } catch {
      /* ignore */
    }
  })

  try {
    window.sessionStorage.setItem('cridora_pwa_icon_rev_applied', PWA_ICON_REVISION)
  } catch {
    /* ignore */
  }
}
