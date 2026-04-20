import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Globe, Lock, ArrowUpRight } from 'lucide-react'

const footerLinks = {
  Platform: [
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Pricing', href: '#' },
    { label: 'Security', href: '#' },
  ],
  Company: [
    { label: 'About Cridora', href: '#' },
    { label: 'Press', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Blog', href: '#' },
  ],
  Legal: [
    { label: 'Terms of Service', href: '#' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'AML Policy', href: '#' },
    { label: 'Cookie Policy', href: '#' },
  ],
  Support: [
    { label: 'Help Center', href: '#' },
    { label: 'Contact Us', href: '#' },
    { label: 'Vendor Portal', href: '/vendors' },
    { label: 'API Docs', href: '#' },
  ],
}

const badges = [
  { icon: Shield, label: 'KYC/KYB Verified' },
  { icon: Globe, label: 'UAE Licensed' },
  { icon: Lock, label: 'Bank-Grade Security' },
]

export default function Footer() {
  return (
    <footer
      className="relative border-t"
      style={{ borderColor: 'var(--border)', background: '#050505' }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(201,168,76,0.02)] to-[rgba(201,168,76,0.04)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 pt-20 pb-10 relative z-10">
        {/* Top section */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <div className="relative w-9 h-9">
                <div className="absolute inset-0 rounded-full gradient-gold opacity-90" />
                <div className="absolute inset-[2px] rounded-full bg-[#050505] flex items-center justify-center">
                  <span className="text-[10px] font-black tracking-widest gradient-gold-text">C</span>
                </div>
              </div>
              <span className="text-lg font-bold tracking-[0.15em] gradient-gold-text uppercase">Cridora</span>
            </div>
            <p className="text-[#666] text-sm leading-relaxed max-w-xs mb-6">
              The trusted global infrastructure for digital precious metals trading. Buy, hold, and sell gold, silver, and platinum—backed by real inventory.
            </p>
            <div className="flex flex-col gap-2">
              {badges.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <Icon size={13} className="text-[#C9A84C] opacity-80" />
                  <span className="text-[11px] text-[#666] tracking-widest uppercase">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#C9A84C] mb-5">
                {category}
              </h4>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-[#555] hover:text-[#C9A84C] transition-colors duration-200 tracking-wide"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.2)] to-transparent mb-8" />

        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-[#444] tracking-widest uppercase">
            © 2026 Cridora. All rights reserved. Dubai, UAE.
          </p>
          <p className="text-[11px] text-[#333] tracking-wide text-center max-w-md">
            Cridora is a transaction platform. We do not hold, store, or custody precious metals. All inventory is maintained by verified vendors.
          </p>
        </div>
      </div>
    </footer>
  )
}
