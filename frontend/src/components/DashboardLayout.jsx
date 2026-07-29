import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars -- `motion` is used as motion.div / motion.aside (JSX member)
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Menu, X, LogOut, ExternalLink } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import CridoraLogo from './CridoraLogo'
import NotificationBell from '../features/pushNotifications/NotificationBell'
import { DashboardMobileNav, titleForSection, useIsMobileApp } from '../features/mobileApp'
import { SERENE_EASE } from '../lib/sereneMotion'

const ROLE_LABELS = {
  admin: 'Platform Admin',
  vendor: 'Bullion Vendor',
  customer: 'Investor',
}

const ROLE_COLORS = {
  admin: 'var(--gold)',
  vendor: 'var(--silver)',
  customer: 'var(--copper)',
}

/** 8-bit hex tints (dark) or color-mix (when accent is a CSS var). */
function accentLayer(color, layer) {
  if (String(color).includes('var(')) {
    const pct = { avFill: 11, avLine: 25, activeFill: 13, activeTab: 16, lineStrong: 32 }[layer] ?? 12
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`
  }
  const suf = { avFill: '18', avLine: '30', activeFill: '12', activeTab: '15', lineStrong: '40' }[layer] ?? '12'
  return `${color}${suf}`
}

function SidebarContent({ navItems, activeSection, onSectionChange, onClose, user, onLogout }) {
  const roleColor = ROLE_COLORS[user?.user_type] || 'var(--gold)'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 h-16 border-b flex-shrink-0"
        style={{ borderColor: 'var(--nav-border)' }}>
        <Link to="/" className="flex items-center" onClick={onClose}>
          <CridoraLogo size="sm" />
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-[var(--text-dim)] hover:text-[var(--text-soft)] min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--nav-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
            style={{ background: accentLayer(roleColor, 'avFill'), border: `1px solid ${accentLayer(roleColor, 'avLine')}`, color: roleColor }}>
            {user?.first_name?.[0] || 'U'}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {user?.first_name} {user?.last_name}
            </div>
            <div className="text-[10px] tracking-widest uppercase" style={{ color: roleColor }}>
              {ROLE_LABELS[user?.user_type]}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.sectionKey ? item.sectionKey === activeSection : false

          if (item.external) {
            return (
              <Link key={item.label} to={item.href}
                className="dash-nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
                style={{ borderLeft: '2px solid transparent' }}
                onClick={onClose}>
                <item.icon size={16} className="flex-shrink-0 transition-colors" style={{ color: 'var(--text-muted)' }} />
                <span className="text-sm flex-1" style={{ color: 'var(--text-soft)' }}>{item.label}</span>
                <ExternalLink size={11} className="text-[var(--text-faint)]" />
              </Link>
            )
          }

          return (
            <button key={item.label}
              onClick={() => {
                if (onSectionChange) onSectionChange(item.sectionKey)
                if (onClose) onClose()
              }}
              className="dash-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-left"
              style={{
                ...(isActive ? { background: accentLayer(roleColor, 'activeFill') } : {}),
                borderLeft: isActive ? `2px solid ${roleColor}` : '2px solid transparent',
              }}>
              <item.icon size={16} className="flex-shrink-0 transition-colors"
                style={{ color: isActive ? roleColor : 'var(--text-muted)' }} />
              <span className="text-sm flex-1 transition-colors"
                style={{ color: isActive ? roleColor : 'var(--text-soft)' }}>
                {item.label}
              </span>
              {item.badge > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--nav-border)' }}>
        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
          <LogOut size={15} className="text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-400">Sign Out</span>
        </button>
      </div>
    </div>
  )
}

/**
 * @param {object} props
 * @param {Array} props.navItems
 * @param {React.ReactNode} props.children
 * @param {string} props.title
 * @param {string} props.activeSection
 * @param {(key: string) => void} props.onSectionChange
 * @param {Record<string, number>} [props.tabBadges] — badges keyed by mobile tab id (desk, queues, …)
 * @param {(item: object) => boolean} [props.moreFilter]
 */
export default function DashboardLayout({
  navItems,
  children,
  title,
  activeSection,
  onSectionChange,
  tabBadges = {},
  moreFilter,
}) {
  const { user, logout, authFetch } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isMobileApp = useIsMobileApp()
  const role = user?.user_type || 'customer'
  const roleColor = ROLE_COLORS[role] || 'var(--gold)'
  const screenTitle = titleForSection(role, activeSection, null) || title
  const reduce = useReducedMotion()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex min-w-0 overflow-x-hidden bg-[var(--bg-primary)]">

      {/* Desktop / large tablet sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 flex-shrink-0 sticky top-0 h-screen overflow-hidden"
        style={{
          background: 'var(--dash-sidebar)',
          borderRight: '1px solid var(--nav-border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <SidebarContent
          navItems={navItems}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          onClose={null}
          user={user}
          onLogout={handleLogout}
        />
      </aside>

      {/* Tablet drawer (768–1023): full nav list; phone uses bottom tabs instead */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/70 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed top-0 left-0 h-full z-40 w-64 flex flex-col lg:hidden"
              style={{
                background: 'var(--dash-sidebar)',
                borderRight: '1px solid var(--nav-border)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
            >
              <SidebarContent
                navItems={navItems}
                activeSection={activeSection}
                onSectionChange={onSectionChange}
                onClose={() => setMobileOpen(false)}
                user={user}
                onLogout={handleLogout}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center justify-between px-4 sm:px-6 border-b flex-shrink-0 sticky top-0 z-20 pt-[env(safe-area-inset-top,0px)] min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] md:min-h-[calc(4rem+env(safe-area-inset-top,0px))]"
          style={{ background: 'var(--dash-header)', borderColor: 'var(--nav-border)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger: tablet only when not using phone bottom-tabs; phones still get overflow list via More */}
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className={`${isMobileApp ? 'hidden' : 'lg:hidden'} text-[var(--text-dim)] hover:text-[var(--text-soft)] min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 -ms-2`}
            >
              <Menu size={20} />
            </button>
            {isMobileApp && (
              <Link to="/" className="md:hidden flex items-center shrink-0 -ms-1" aria-label="Cridora home">
                <CridoraLogo size="sm" />
              </Link>
            )}
            <h1 className="text-sm font-semibold text-[var(--text-primary)] tracking-wide truncate">
              {isMobileApp ? screenTitle : title}
            </h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <NotificationBell authFetch={authFetch} />
            <Link to="/"
              className="text-[11px] tracking-widest uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors hidden sm:block">
              Public Site
            </Link>
          </div>
        </header>

        {/* Horizontal chips: tablet only (md to lg); phones use bottom tabs */}
        <div
          className="hidden md:block lg:hidden overflow-x-auto border-b flex-shrink-0"
          style={{ borderColor: 'var(--nav-border)', background: 'var(--dash-tabs)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {navItems.map((item) => {
              if (item.external) {
                return (
                  <Link key={item.label} to={item.href}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold whitespace-nowrap"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <item.icon size={11} />
                    {item.label}
                  </Link>
                )
              }
              const isActive = item.sectionKey === activeSection
              return (
                <button key={item.label}
                  onClick={() => onSectionChange?.(item.sectionKey)}
                  className={`filter-chip flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold whitespace-nowrap ${isActive ? 'is-active' : ''}`}
                  style={isActive
                    ? { background: accentLayer(roleColor, 'activeTab'), border: `1px solid ${accentLayer(roleColor, 'lineStrong')}`, color: roleColor }
                    : { background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }
                  }>
                  <item.icon size={11} />
                  {item.label}
                  {item.badge > 0 && (
                    <span className="text-[9px] px-1 py-0.5 rounded-full font-black"
                      style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <main
          className={`flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6 min-w-0 overscroll-y-contain ${isMobileApp ? 'dashboard-main--mobile-tabs' : ''}`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection || 'main'}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: reduce ? 0 : 0.38, ease: SERENE_EASE }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <DashboardMobileNav
        role={role}
        sectionKey={activeSection}
        onSectionChange={onSectionChange}
        badges={tabBadges}
        moreFilter={moreFilter}
      />
    </div>
  )
}
