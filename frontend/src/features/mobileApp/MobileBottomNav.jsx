import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars -- motion JSX
import { motion, useReducedMotion } from 'framer-motion'
import { isTabActive } from './tabConfig'
import { sereneTabTap } from '../../lib/sereneMotion'
import { microHaptic } from '../../lib/microHaptic'

function TabGlyph({ Icon, active, accent }) {
  if (!Icon) return null
  const tone = active ? accent : 'var(--text-dim)'
  return (
    <Icon
      key={active ? 'on' : 'off'}
      size={22}
      color={tone}
      strokeWidth={active ? 2.35 : 1.75}
      animateOnHover={false}
    />
  )
}

/**
 * Floating tab bar for the mobile app shell (&lt;768px).
 * Equal-width icon slots — active tab highlights in place, no layout shift.
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
              {active && (
                <span
                  className="mobile-bottom-nav__highlight"
                  aria-hidden="true"
                  style={{
                    background: `color-mix(in srgb, ${accent} 22%, transparent)`,
                    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 40%, transparent)`,
                  }}
                />
              )}
              <span className="mobile-bottom-nav__icon">
                <TabGlyph Icon={Icon} active={active} accent={accent} />
                {badge > 0 && (
                  <span className="mobile-bottom-nav__badge">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
            </>
          )

          const className = `mobile-bottom-nav__tab ${active ? 'is-active' : ''}`
          const tabTone = { color: active ? accent : 'var(--text-dim)' }

          if (tab.href && !tab.isMore && !tab.sectionKey && !tab.queuesHub) {
            return (
              <motion.div
                key={tab.id}
                className="mobile-bottom-nav__slot"
                whileTap={reduce ? undefined : sereneTabTap}
              >
                <Link
                  to={tab.href}
                  className={className}
                  style={tabTone}
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
              style={tabTone}
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
    </nav>
  )
}
