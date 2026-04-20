import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, LogOut, Bell, ExternalLink } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  admin: 'Platform Admin',
  vendor: 'Bullion Vendor',
  customer: 'Investor',
}

const ROLE_COLORS = {
  admin: '#C9A84C',
  vendor: '#A8A9AD',
  customer: '#B87333',
}

function SidebarContent({ navItems, activeSection, onSectionChange, onClose, user, onLogout }) {
  const roleColor = ROLE_COLORS[user?.user_type] || '#C9A84C'

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 border-b flex-shrink-0"
        style={{ borderColor: 'rgba(201,168,76,0.08)' }}>
        <Link to="/" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-full gradient-gold opacity-90" />
            <div className="absolute inset-[2px] rounded-full flex items-center justify-center"
              style={{ background: '#080808' }}>
              <span className="text-[9px] font-black gradient-gold-text">C</span>
            </div>
          </div>
          <span className="text-sm font-bold tracking-[0.15em] gradient-gold-text uppercase">Cridora</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-[#555] hover:text-[#888]">
            <X size={18} />
          </button>
        )}
      </div>

      {/* User badge */}
      <div className="px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(201,168,76,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
            style={{ background: `${roleColor}18`, border: `1px solid ${roleColor}30`, color: roleColor }}>
            {user?.first_name?.[0] || 'U'}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-semibold text-[#F5F0E8] truncate">
              {user?.first_name} {user?.last_name}
            </div>
            <div className="text-[10px] tracking-widest uppercase" style={{ color: roleColor }}>
              {ROLE_LABELS[user?.user_type]}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.sectionKey ? item.sectionKey === activeSection : false

          if (item.external) {
            return (
              <Link key={item.label} to={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-200"
                style={{ background: 'transparent', borderLeft: '2px solid transparent' }}
                onClick={onClose}>
                <item.icon size={16} className="flex-shrink-0 transition-colors" style={{ color: '#555' }} />
                <span className="text-sm flex-1" style={{ color: '#666' }}>{item.label}</span>
                <ExternalLink size={11} className="text-[#444]" />
              </Link>
            )
          }

          return (
            <button key={item.label}
              onClick={() => {
                if (onSectionChange) onSectionChange(item.sectionKey)
                if (onClose) onClose()
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-200 text-left"
              style={{
                background: isActive ? `${roleColor}12` : 'transparent',
                borderLeft: isActive ? `2px solid ${roleColor}` : '2px solid transparent',
              }}>
              <item.icon size={16} className="flex-shrink-0 transition-colors"
                style={{ color: isActive ? roleColor : '#555' }} />
              <span className="text-sm flex-1 transition-colors"
                style={{ color: isActive ? roleColor : '#666' }}>
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

      {/* Logout */}
      <div className="px-3 py-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(201,168,76,0.06)' }}>
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

export default function DashboardLayout({
  navItems,
  children,
  title,
  activeSection,
  onSectionChange,
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const roleColor = ROLE_COLORS[user?.user_type] || '#C9A84C'

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#080808' }}>

      {/* ── Desktop Sidebar (always visible, no animation) ── */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 sticky top-0 h-screen overflow-hidden"
        style={{ background: '#0A0A0A', borderRight: '1px solid rgba(201,168,76,0.1)' }}>
        <SidebarContent
          navItems={navItems}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          onClose={null}
          user={user}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile Sidebar overlay ── */}
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
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed top-0 left-0 h-full z-40 w-64 flex flex-col lg:hidden"
              style={{ background: '#0A0A0A', borderRight: '1px solid rgba(201,168,76,0.1)' }}>
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

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b flex-shrink-0 sticky top-0 z-20"
          style={{ background: 'rgba(8,8,8,0.97)', borderColor: 'rgba(201,168,76,0.08)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button onClick={() => setMobileOpen(true)}
              className="lg:hidden text-[#555] hover:text-[#888]">
              <Menu size={20} />
            </button>
            <h1 className="text-sm font-semibold text-[#F5F0E8] tracking-wide">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(201,168,76,0.08)]">
              <Bell size={15} className="text-[#555]" />
            </button>
            <Link to="/"
              className="text-[11px] tracking-widest uppercase text-[#555] hover:text-[#C9A84C] transition-colors hidden sm:block">
              Public Site
            </Link>
          </div>
        </header>

        {/* Mobile section tabs (visible only when sidebar is closed on mobile) */}
        <div className="lg:hidden overflow-x-auto border-b flex-shrink-0"
          style={{ borderColor: 'rgba(201,168,76,0.06)', background: '#0A0A0A' }}>
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {navItems.map((item) => {
              if (item.external) {
                return (
                  <Link key={item.label} to={item.href}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold whitespace-nowrap"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }}>
                    <item.icon size={11} />
                    {item.label}
                  </Link>
                )
              }
              const isActive = item.sectionKey === activeSection
              return (
                <button key={item.label}
                  onClick={() => onSectionChange?.(item.sectionKey)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold whitespace-nowrap transition-all"
                  style={isActive
                    ? { background: `${roleColor}15`, border: `1px solid ${roleColor}40`, color: roleColor }
                    : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }
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

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
