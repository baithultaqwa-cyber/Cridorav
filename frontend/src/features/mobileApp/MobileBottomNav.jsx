import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars -- motion JSX
import { motion, useReducedMotion, LayoutGroup } from 'framer-motion'
import { isTabActive } from './tabConfig'
import { sereneTabTap, tabIndicatorSpring, SERENE_EASE } from '../../lib/sereneMotion'
import { microHaptic } from '../../lib/microHaptic'

function TabGlyph({ Icon, active, accent, reduce }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!reduce && active) ref.current?.startAnimation?.()
  }, [active, reduce])
  if (!Icon) return null
  return (
    <Icon
      ref={ref}
      size={20}
      strokeWidth={active ? 2.35 : 1.75}
      animateOnHover={false}
      style={{
        color: active ? accent : 'var(--text-dim)',
        transition: 'color 0.34s cubic-bezier(0.22, 1, 0.36, 1), stroke-width 0.34s ease',
      }}
    />
  )
}

/**
 * Floating pill tab bar for the mobile app shell (&lt;768px).
 * Icon-only idle tabs; active tab expands with label (minimal + clear).
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
                    layoutId="mobile-tab-pill"
                    className="mobile-bottom-nav__pill"
                    style={{
                      background: `color-mix(in srgb, ${accent} 28%, var(--bg-card))`,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 40%, transparent)`,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={tabIndicatorSpring}
                  />
                )}
                {reduce && active && (
                  <span
                    className="mobile-bottom-nav__pill"
                    style={{
                      background: `color-mix(in srgb, ${accent} 28%, var(--bg-card))`,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 40%, transparent)`,
                    }}
                  />
                )}
                <motion.span
                  className="mobile-bottom-nav__icon"
                  animate={reduce ? undefined : { scale: active ? 1.06 : 1 }}
                  transition={{ duration: 0.32, ease: SERENE_EASE }}
                >
                  <TabGlyph Icon={Icon} active={active} accent={accent} reduce={reduce} />
                  {badge > 0 && (
                    <span className="mobile-bottom-nav__badge">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </motion.span>
                {active && (
                  <span
                    className="mobile-bottom-nav__label"
                    style={{ color: accent }}
                  >
                    {tab.label}
                  </span>
                )}
              </>
            )

            const className = `mobile-bottom-nav__tab ${active ? 'is-active' : ''}`

            if (tab.href && !tab.isMore && !tab.sectionKey && !tab.queuesHub) {
              return (
                <motion.div
                  key={tab.id}
                  className={`mobile-bottom-nav__slot ${active ? 'is-active' : ''}`}
                  whileTap={reduce ? undefined : sereneTabTap}
                >
                  <Link
                    to={tab.href}
                    className={className}
                    aria-label={tab.label}
                    aria-current={active ? 'page' : undefined}
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
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
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
