import { Link } from 'react-router-dom'
import CridoraLogo from './CridoraLogo'
import { PUBLIC_TRUST_ITEMS } from './PublicTrustBar'

const footerLinks = {
  Platform: [
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Vendors', href: '/vendors' },
    { label: 'Get started', href: '/signup' },
  ],
  Trust: [
    { label: 'KYC & compliance', href: '/how-it-works' },
    { label: 'Sign in', href: '/signin' },
  ],
  Legal: [
    { label: 'Terms of Service', href: '#' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'Cookie Policy', href: '#' },
  ],
  Support: [
    { label: 'How it works (FAQ)', href: '/how-it-works' },
    { label: 'Vendor program', href: '/vendors#apply' },
  ],
}

export default function Footer() {
  return (
    <footer
      className="relative border-t"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--footer-surface)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(201,168,76,0.02)] to-[rgba(201,168,76,0.04)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-10 relative z-10 min-w-0">
        {/* Top section */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center mb-5">
              <CridoraLogo size="md" />
            </div>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-md mb-6">
              UAE-licensed bullion partners, <strong className="text-[var(--text-soft)] font-semibold">KYC</strong> &amp;{' '}
              <strong className="text-[var(--text-soft)] font-semibold">KYB</strong>,{' '}
              <strong className="text-[var(--text-soft)] font-semibold">AML-aligned</strong> workflows, optional{' '}
              <strong className="text-[var(--text-soft)] font-semibold">Stripe</strong> — inventory stays with vendors.
            </p>
            <div className="flex flex-col gap-2.5">
              {PUBLIC_TRUST_ITEMS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5">
                  <Icon size={13} className="text-[var(--gold)] opacity-80 flex-shrink-0" aria-hidden />
                  <span className="text-[11px] text-[var(--text-muted)] tracking-widest uppercase leading-snug">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--gold)] mb-5">
                {category}
              </h4>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors duration-200 tracking-wide"
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
          <p className="text-[11px] text-[var(--text-faint)] tracking-widest uppercase">
            © 2026 Cridora. All rights reserved. Dubai, UAE.
          </p>
          <p className="text-[11px] text-[var(--text-caption)] tracking-wide text-center max-w-md">
            Cridora is a transaction platform. We do not hold, store, or custody precious metals. All inventory is maintained by verified vendors.
          </p>
        </div>
      </div>
    </footer>
  )
}
