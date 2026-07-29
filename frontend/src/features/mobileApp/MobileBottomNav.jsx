import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars -- motion JSX
import { motion, useReducedMotion, LayoutGroup } from 'framer-motion'
import { isTabActive } from './tabConfig'
import { sereneTabTap, tabIndicatorSpring, SERENE_EASE } from '../../lib/sereneMotion'
import { microHaptic } from '../../lib/microHaptic'

/**
 * Fixed bottom tab bar for the mobile app shell (&lt;768px).
 */
export default function MobileBottomNav({
  tabs = [],
  accent = 'var(--gold)',
  sectionKey,
  pathname,
  moreActive = false,
  onTabPress,
  badges = {},
}) {
  const barRef = useRef(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const sync = () => {
      document.documentElement.style.setProperty('--app-tab-h', `${el.offsetHeight}px`)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('resize', sync)
      document.documentElement.style.setProperty('--app-tab-h', '0px')
    }
  }, [])

  return (
    <nav
      ref={barRef}
      className="mobile-bottom-nav md:hidden"
      aria-label="Primary"
    >
      <LayoutGroup id="mobile-tabs">
        <div className="mobile-bottom-nav__inner">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active =
              tab.isMore
                ? moreActive
                : isTabActive(tab, { sectionKey, pathname })
            const badge = badges[tab.id] || tab.badge || 0

            const inner = (
              <>
                {!reduce && active && (
                  <motion.span
                    layoutId="mobile-tab-glow"
                    className="mobile-bottom-nav__glow"
                    style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={tabIndicatorSpring}
                  />
                )}
                <motion.span
                  className="relative z-[1]"
                  animate={reduce ? undefined : { scale: active ? 1.04 : 1 }}
                  transition={{ duration: 0.36, ease: SERENE_EASE }}
                >
                  {Icon && (
                    <Icon
                      size={20}
                      strokeWidth={active ? 2.25 : 1.8}
                      style={{
                        color: active ? accent : 'var(--text-dim)',
                        transition: 'color 0.34s cubic-bezier(0.22, 1, 0.36, 1), stroke-width 0.34s ease',
                      }}
                    />
                  )}
                  {badge > 0 && (
                    <span className="mobile-bottom-nav__badge">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </motion.span>
                <span
                  className="relative z-[1] text-[10px] font-semibold tracking-wide leading-none"
                  style={{
                    color: active ? accent : 'var(--text-dim)',
                    transition: 'color 0.34s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  {tab.label}
                </span>
                {!reduce && active && (
                  <motion.span
                    layoutId="mobile-tab-indicator"
                    className="mobile-bottom-nav__indicator"
                    style={{ background: accent }}
                    initial={{ opacity: 0, scaleX: 0.6 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={tabIndicatorSpring}
                  />
                )}
              </>
            )

            const className = `mobile-bottom-nav__tab ${active ? 'is-active' : ''}`

            if (tab.href && !tab.isMore && !tab.sectionKey && !tab.queuesHub) {
              return (
                <motion.div
                  key={tab.id}
                  className="flex-1 min-w-0"
                  whileTap={reduce ? undefined : sereneTabTap}
                >
                  <Link
                    to={tab.href}
                    className={className}
                    onClick={(e) => {
                      microHaptic(6)
                      if (onTabPress) {
                        const handled = onTabPress(tab, e)
                        if (handled === false) e.preventDefault()
                      }
                    }}
                  >
                    {inner}
                  </Link>
                </motion.div>
              )
            }

            return (
              <motion.button
                key={tab.id}
                type="button"
                className={className}
                whileTap={reduce ? undefined : sereneTabTap}
                onClick={() => {
                  microHaptic(6)
                  onTabPress?.(tab)
                }}
              >
                {inner}
              </motion.button>
            )
          })}
        </div>
      </LayoutGroup>
    </nav>
  )
}
