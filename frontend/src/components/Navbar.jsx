import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, LayoutDashboard, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import CridoraLogo from './CridoraLogo'

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Why Cridora', href: '/why-vendors' },
  { label: 'Vendors', href: '/vendors' },
]

const toolLinks = [
  { label: 'UAE gold comparison', href: '/tools/uae-digital-gold-comparison' },
]

const DASHBOARD_ROUTE = {
  admin: '/dashboard/admin',
  vendor: '/dashboard/vendor',
  customer: '/dashboard/customer',
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false)
  const toolsWrapRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const dashboardHref = user ? (DASHBOARD_ROUTE[user.user_type] || '/dashboard') : '/signin'

  const handleLogout = async () => {
    setMenuOpen(false)
    setToolsMenuOpen(false)
    await logout()
    navigate('/')
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setToolsMenuOpen(false)
  }, [location])

  useEffect(() => {
    if (!toolsMenuOpen) return
    function onDocMouseDown(e) {
      if (toolsWrapRef.current && !toolsWrapRef.current.contains(e.target)) {
        setToolsMenuOpen(false)
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setToolsMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [toolsMenuOpen])

  const toolsActive = location.pathname.startsWith('/tools')

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: menuOpen || toolsMenuOpen ? 60 : 50,
        transition: 'background 0.4s ease, backdrop-filter 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease, padding 0.3s ease',
        background: scrolled ? 'var(--nav-scrolled)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--nav-border)' : '1px solid transparent',
        boxShadow: scrolled ? 'var(--nav-shadow)' : 'none',
        paddingTop: scrolled
          ? 'calc(12px + env(safe-area-inset-top, 0px))'
          : 'calc(20px + env(safe-area-inset-top, 0px))',
        paddingBottom: scrolled ? '12px' : '20px',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-3 min-[400px]:px-4 sm:px-6 flex items-center justify-between gap-2 min-w-0">
        {/* Logo */}
        <Link to="/" className="flex items-center group min-w-0 shrink overflow-hidden max-w-[min(200px,calc(100%-3.5rem))]">
          <CridoraLogo size="sm" className="group-hover:opacity-95 transition-opacity" />
        </Link>

        {/* Desktop: main nav + Tools */}
        <div className="hidden md:flex flex-1 min-w-0 items-center justify-center gap-5 lg:gap-6 xl:gap-8 flex-wrap px-2">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className={`text-sm tracking-widest uppercase font-medium transition-all duration-300 relative group shrink-0 ${
                location.pathname === link.href
                  ? 'text-[var(--gold)]'
                  : 'text-[var(--text-soft)] hover:text-[var(--gold)]'
              }`}
            >
              {link.label}
              <span
                className="absolute -bottom-1 left-0 h-px bg-gradient-to-r from-[var(--gold)] to-transparent transition-all duration-300"
                style={{ width: location.pathname === link.href ? '100%' : '0' }}
              />
            </Link>
          ))}
          <div ref={toolsWrapRef} className="relative shrink-0">
            <button
              type="button"
              className={`text-sm tracking-widest uppercase font-medium transition-colors flex items-center gap-1.5 ${
                toolsActive ? 'text-[var(--gold)]' : 'text-[var(--text-soft)] hover:text-[var(--gold)]'
              }`}
              aria-expanded={toolsMenuOpen}
              aria-haspopup="true"
              onClick={() => setToolsMenuOpen((o) => !o)}
            >
              Tools
              <ChevronDown
                size={16}
                aria-hidden
                className={`transition-transform duration-200 ${toolsMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {toolsMenuOpen && (
              <div
                className="absolute left-0 top-full z-[70] pt-2 w-max min-w-[13rem] max-w-[min(20rem,calc(100vw-2rem))]"
                role="menu"
              >
                <div
                  className="rounded-lg py-2 shadow-lg"
                  style={{
                    background: 'var(--chrome-mobile-nav)',
                    border: '1px solid var(--nav-border)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  {toolLinks.map((t) => (
                    <Link
                      key={t.href}
                      to={t.href}
                      role="menuitem"
                      className={`block px-4 py-3 text-xs tracking-widest uppercase font-medium whitespace-normal leading-snug transition-colors ${
                        location.pathname === t.href
                          ? 'text-[var(--gold)] bg-[rgba(201,168,76,0.08)]'
                          : 'text-[var(--text-soft)] hover:text-[var(--gold)] hover:bg-[rgba(201,168,76,0.05)]'
                      }`}
                      onClick={() => setToolsMenuOpen(false)}
                    >
                      {t.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {user ? (
            <>
              <Link to={dashboardHref}>
                <button className="btn-outline-gold text-xs px-5 py-2.5 rounded-sm tracking-widest uppercase font-semibold flex items-center gap-2">
                  <LayoutDashboard size={13} />
                  Dashboard
                </button>
              </Link>
              <button
                onClick={handleLogout}
                className="text-xs px-5 py-2.5 rounded-sm tracking-widest uppercase font-semibold flex items-center gap-2 transition-all"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                <LogOut size={13} />
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/signin">
                <button className="btn-outline-gold text-xs px-5 py-2.5 rounded-sm tracking-widest uppercase font-semibold">
                  Sign In
                </button>
              </Link>
              <Link to="/signup">
                <button className="btn-gold text-xs px-5 py-2.5 rounded-sm tracking-widest uppercase font-semibold">
                  Get Started
                </button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-[var(--gold)] shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              background: 'var(--chrome-mobile-nav)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: '1px solid var(--nav-border)',
              overflow: 'hidden',
            }}
          >
            <div
              className="px-4 sm:px-6 pt-6 flex flex-col gap-5 min-w-0 max-w-full"
              style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
            >
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`text-sm tracking-widest uppercase font-medium transition-colors min-w-0 break-words max-w-full ${
                    location.pathname === link.href ? 'text-[var(--gold)]' : 'text-[var(--text-soft)] hover:text-[var(--gold)]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="min-w-0 max-w-full pt-1">
                <p className="text-[10px] tracking-[0.25em] uppercase text-[var(--text-dim)] mb-3">Tools</p>
                <div className="flex flex-col gap-3 min-w-0">
                  {toolLinks.map((t) => (
                    <Link
                      key={t.href}
                      to={t.href}
                      className={`text-sm tracking-widest uppercase font-medium transition-colors min-w-0 break-words max-w-full leading-snug ${
                        location.pathname === t.href ? 'text-[var(--gold)]' : 'text-[var(--text-soft)] hover:text-[var(--gold)]'
                      }`}
                    >
                      {t.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div
                className="flex flex-col gap-3 pt-3"
                style={{ borderTop: '1px solid rgba(201, 168, 76, 0.1)' }}
              >
                {user ? (
                  <>
                    <Link to={dashboardHref} onClick={() => setMenuOpen(false)}>
                      <button className="btn-outline-gold text-xs px-5 py-3 rounded-sm tracking-widest uppercase font-semibold w-full flex items-center justify-center gap-2">
                        <LayoutDashboard size={13} />
                        Dashboard
                      </button>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="text-xs px-5 py-3 rounded-sm tracking-widest uppercase font-semibold w-full flex items-center justify-center gap-2"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                      <LogOut size={13} />
                      Log Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/signin" onClick={() => setMenuOpen(false)}>
                      <button className="btn-outline-gold text-xs px-5 py-3 rounded-sm tracking-widest uppercase font-semibold w-full">
                        Sign In
                      </button>
                    </Link>
                    <Link to="/signup" onClick={() => setMenuOpen(false)}>
                      <button className="btn-gold text-xs px-5 py-3 rounded-sm tracking-widest uppercase font-semibold w-full">
                        Get Started
                      </button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
