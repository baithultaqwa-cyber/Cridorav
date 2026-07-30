import { Landmark, ShieldCheck, TrendingUp, CreditCard, FileCheck2 } from 'lucide-react'

/** Shared trust signals for public marketing surfaces (icon + one short line each). */
export const PUBLIC_TRUST_ITEMS = [
  { icon: Landmark, text: 'Verified UAE bullion dealers' },
  { icon: ShieldCheck, text: 'Authentic physical gold' },
  { icon: TrendingUp, text: 'Transparent live pricing' },
  { icon: CreditCard, text: 'Secure UAE payments' },
  { icon: FileCheck2, text: 'Complete ownership records' },
]

/**
 * @param {{ dense?: boolean, className?: string }} props
 * - dense: single-line chips for tight heroes (Marketplace, How it works, etc.)
 * - default: icon grid for high visibility (e.g. Home hero)
 */
export default function PublicTrustBar({ dense = false, className = '' }) {
  const wrap = dense
    ? `flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-7 gap-y-2.5 ${className}`.trim()
    : `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 ${className}`.trim()

  if (dense) {
    return (
      <div className={wrap} role="list" aria-label="Platform trust and compliance">
        {PUBLIC_TRUST_ITEMS.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 max-w-[18rem]" role="listitem">
            <Icon size={14} className="text-[var(--gold)] opacity-75 flex-shrink-0" aria-hidden />
            <span className="text-[10px] sm:text-[11px] tracking-widest uppercase text-[var(--text-dim)] leading-tight">
              {text}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={wrap} role="list" aria-label="Platform trust and compliance">
      {PUBLIC_TRUST_ITEMS.map(({ icon: Icon, text }) => (
        <div
          key={text}
          className="flex flex-col items-center text-center gap-3 rounded-xl p-3 sm:p-4"
          style={{
            background: 'rgba(201,168,76,0.05)',
            border: '1px solid rgba(201,168,76,0.12)',
          }}
          role="listitem"
        >
          <div
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(201,168,76,0.08)',
              border: '1px solid rgba(201,168,76,0.18)',
            }}
          >
            <Icon size={19} className="text-[var(--gold)] opacity-90" aria-hidden />
          </div>
          <p className="text-[10px] sm:text-[11px] tracking-widest uppercase text-[var(--text-dim)] leading-snug">
            {text}
          </p>
        </div>
      ))}
    </div>
  )
}
