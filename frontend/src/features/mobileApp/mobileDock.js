/** CSS custom property names for the mobile app chrome (set in index.css). */
export const APP_TAB_H = 'var(--app-tab-h)'
export const APP_TOP_H = 'var(--app-top-h)'

/**
 * Bottom offset for fixed UI stacked above the mobile tab bar.
 * When tabs are absent (desktop / hidden chrome), falls back to safe-area only.
 */
export function dockAboveTabs(extra = '0.75rem') {
  return `calc(${APP_TAB_H} + env(safe-area-inset-bottom, 0px) + ${extra})`
}

/**
 * Content padding-bottom so scrollable pages clear the tab bar + safe area.
 */
export function contentPadBottom(extra = '0.5rem') {
  return `calc(${APP_TAB_H} + env(safe-area-inset-bottom, 0px) + ${extra})`
}
