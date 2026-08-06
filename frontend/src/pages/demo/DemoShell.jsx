import { Link, useLocation } from 'react-router-dom'
import { DEMO_PAGES } from './demoMeta'

/**
 * Thin chrome shared by all landing demos so reviewers can switch without losing context.
 */
export default function DemoShell({ children, activeId }) {
  const { pathname } = useLocation()
  const active = DEMO_PAGES.find((d) => d.id === activeId) || DEMO_PAGES.find((d) => pathname.startsWith(d.path))

  return (
    <div className="min-h-[100dvh] bg-[#0a0806] text-[#f2ece0]">
      <header
        className="sticky top-0 z-[70] flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(212,175,55,0.18)] px-3 py-2 sm:px-5"
        style={{
          background: 'rgba(10,8,6,0.92)',
          backdropFilter: 'blur(14px)',
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))',
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/demos"
            className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gold,#d4af37)] hover:opacity-90"
          >
            ← All demos
          </Link>
          {active && (
            <p className="hidden min-w-0 truncate text-xs text-[#b8ab96] sm:block">
              <span className="text-[#f2ece0]">{active.number}</span>
              {' · '}
              {active.title}
              <span className="text-[#6e6250]"> — pick a favourite with your team</span>
            </p>
          )}
        </div>
        <nav className="flex flex-wrap items-center gap-1.5" aria-label="Demo variants">
          {DEMO_PAGES.map((d) => {
            const on = active?.id === d.id
            return (
              <Link
                key={d.id}
                to={d.path}
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                  on
                    ? 'bg-[var(--gold,#d4af37)] text-[#14110b]'
                    : 'border border-[rgba(212,175,55,0.25)] text-[#b8ab96] hover:border-[rgba(212,175,55,0.5)] hover:text-[#f2ece0]'
                }`}
              >
                {d.number} {d.title}
              </Link>
            )
          })}
        </nav>
      </header>
      <div className="relative">{children}</div>
    </div>
  )
}
