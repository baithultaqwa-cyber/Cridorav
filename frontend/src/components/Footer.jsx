import { Link } from 'react-router-dom'
import CridoraLogo from './CridoraLogo'
import PwaInstallHelp from '../features/pwa/PwaInstallHelp'

const footerLinks = {
  Platform: [
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'How it works', href: '/how-it-works' },
    { label: 'Vendors', href: '/vendors' },
  ],
  Account: [
    { label: 'Sign in', href: '/signin' },
    { label: 'Get started', href: '/signup' },
    { label: 'Why vendors', href: '/why-vendors' },
  ],
  Legal: [
    { label: 'Terms of Service', href: '/terms' },
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 md:pt-24 pb-10 relative z-10 min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16 mb-16">
          <div className="md:col-span-1">
            <div className="flex items-center mb-5">
              <CridoraLogo size="md" />
            </div>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-xs">
              Physical gold from licensed UAE dealers — with clear pricing and records.
            </p>
            <div className="mt-6">
              <PwaInstallHelp />
            </div>
          </div>

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
                      className="text-sm text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[rgba(232,195,74,0.15)] to-transparent mb-8" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-[var(--text-faint)] tracking-widest uppercase">
            © 2026 Cridora. Dubai, UAE.
          </p>
          <p className="text-[11px] text-[var(--text-caption)] text-center max-w-sm leading-relaxed">
            Cridora does not hold customer gold or funds as custodian.
          </p>
        </div>
      </div>
    </footer>
  )
}
