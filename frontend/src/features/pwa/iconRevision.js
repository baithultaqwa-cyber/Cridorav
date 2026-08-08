/**
 * Bump when home-screen icons change.
 * Must match vite.config.js ICON_* filenames and ICON_ASSET_VERSION.
 * New path suffix (not only ?v=) so Android/Chrome re-fetch launcher icons
 * for already-installed PWAs without uninstall.
 */
export const PWA_ICON_REVISION = 'goldbar-1'

export const PWA_ICON_192 = '/pwa-192-goldbar.png'
export const PWA_ICON_512 = '/pwa-512-goldbar.png'
export const APPLE_TOUCH_ICON = '/apple-touch-icon-goldbar.png'
export const PWA_ICON_QUERY = `?v=${PWA_ICON_REVISION}`
