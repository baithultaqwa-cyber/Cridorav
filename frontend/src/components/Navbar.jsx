import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, LayoutDashboard, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Vendors', href: '/vendors' },
]

const DASHBOARD_ROUTE = {
  admin: '/dashboard/admin',
  vendor: '/dashboard/vendor',
  customer: '/dashboard/customer',
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const dashboardHref = user ? (DASHBOARD_ROUTE[user.user_type] || '/dashboard') : '/signin'

  const handleLogout = async () => {
    setMenuOpen(false)
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
  }, [location])

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
        zIndex: 50,
        transition: 'background 0.4s ease, backdrop-filter 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease, padding 0.3s ease',
        background: scrolled ? 'rgba(5, 5, 5, 0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(201, 168, 76, 0.12)' : '1px solid transparent',
        boxShadow: scrolled ? '0 4px 40px rgba(0,0,0,0.5)' : 'none',
        padding: scrolled ? '12px 0' : '20px 0',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 rounded-full gradient-gold opacity-90 group-hover:opacity-100 transition-opacity" />
            <div
              className="absolute inset-[2px] rounded-full flex items-center justify-center"
              style={{ background: '#080808' }}
            >
              <span className="text-[10px] font-black tracking-widest gradient-gold-text">C</span>
            </div>
          </div>
          <span className="text-lg font-bold tracking-[0.15em] gradient-gold-text uppercase">
            Cridora
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className={`text-sm tracking-widest uppercase font-medium transition-all duration-300 relative group ${
                location.pathname === link.href
                  ? 'text-[#C9A84C]'
                  : 'text-[#888] hover:text-[#C9A84C]'
              }`}
            >
              {link.label}
              <span
                className="absolute -bottom-1 left-0 h-px bg-gradient-to-r from-[#C9A84C] to-transparent transition-all duration-300"
                style={{ width: location.pathname === link.href ? '100%' : '0' }}
              />
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
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
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-[#C9A84C] p-1"
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
              background: 'rgba(5, 5, 5, 0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(201, 168, 76, 0.1)',
              overflow: 'hidden',
            }}
          >
            <div className="px-6 py-6 flex flex-col gap-5">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`text-sm tracking-widest uppercase font-medium transition-colors ${
                    location.pathname === link.href ? 'text-[#C9A84C]' : 'text-[#888] hover:text-[#C9A84C]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
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
