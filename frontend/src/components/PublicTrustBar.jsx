import { Building2, CreditCard, UserCheck, Briefcase } from 'lucide-react'

/**
 * Public marketing strip — claims align with README baseline (KYB-gated marketplace,
 * KYC-gated trading, optional Stripe Checkout). “Licensed” refers to vendor trade licenses.
 */
const ITEMS = [
  {
    icon: Building2,
    label: 'UAE trade-license partners',
    detail: 'Bullion vendors onboard with KYB, documents & registry checks.',
  },
  {
    icon: UserCheck,
    label: 'Customer KYC',
    detail: 'Identity, address & bank verification before you can buy or sell back.',
  },
  {
    icon: Briefcase,
    label: 'Vendor KYB',
    detail: 'Every marketplace seller is admin-verified — not anonymous listings.',
  },
  {
    icon: CreditCard,
    label: 'Stripe card payments',
    detail: 'Checkout in AED when your operator enables Stripe — industry-standard PCI scope.',
  },
]

export default function PublicTrustBar({ dense = false, className = '' }) {
  return (
    <div
      className={`rounded-2xl ${dense ? 'p-4 sm:p-5' : 'p-5 sm:p-6'} ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(201,168,76,0.06) 0%, rgba(0,0,0,0.2) 100%)',
        border: '1px solid rgba(201,168,76,0.14)',
      }}
    >
      <p
        className={`text-center ${dense ? 'mb-3' : 'mb-4'} text-[10px] tracking-[0.25em] uppercase text-[var(--gold)] font-semibold`}
      >
        Trust & responsibility
      </p>
      <ul className={`grid grid-cols-1 sm:grid-cols-2 ${dense ? 'lg:grid-cols-2' : 'lg:grid-cols-4'} gap-4`}>
        {ITEMS.map(({ icon: Icon, label, detail }) => (
          <li
            key={label}
            className="flex gap-3 rounded-xl p-3"
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.2)' }}
            >
              <Icon size={16} className="text-[var(--gold)] opacity-90" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-wide text-[var(--text-primary)] leading-snug">{label}</p>
              <p className={`text-[10px] sm:text-[11px] text-[var(--text-muted)] leading-relaxed mt-1`}>{detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
