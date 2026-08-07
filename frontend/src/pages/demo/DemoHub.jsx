import { Link } from 'react-router-dom'
import { DEMO_PAGES } from './demoMeta'

export default function DemoHub() {
  return (
    <div className="min-h-[100dvh] bg-[#0a0806] text-[#f2ece0]">
      <div
        className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14"
        style={{ paddingTop: 'calc(2.5rem + env(safe-area-inset-top, 0px))' }}
      >
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--gold)]">
          Landing demos
        </p>
        <h1
          className="mb-3 text-4xl font-medium tracking-tight sm:text-5xl"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Pick a direction.
        </h1>
        <p className="mb-10 max-w-xl text-sm leading-relaxed text-[#b8ab96] sm:text-base">
          Three full landing concepts for Cridora. Share this page with friends and stakeholders —
          open each demo, compare feel and motion, then decide which becomes the production homepage.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {DEMO_PAGES.map((d) => (
            <Link
              key={d.id}
              to={d.path}
              className="group flex flex-col border border-[rgba(212,175,55,0.18)] bg-[rgba(18,13,9,0.65)] p-5 transition-colors hover:border-[rgba(212,175,55,0.45)] hover:bg-[rgba(28,22,14,0.85)]"
            >
              <span className="mb-4 font-mono text-xs text-[var(--gold)]">{d.number}</span>
              <h2
                className="mb-1 text-2xl font-medium"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {d.title}
              </h2>
              <p className="mb-3 text-xs uppercase tracking-[0.12em] text-[#8a6a3c]">{d.subtitle}</p>
              <p className="mb-5 flex-1 text-sm leading-relaxed text-[#b8ab96]">{d.blurb}</p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {d.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-[rgba(212,175,55,0.2)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#9a8b72]"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)] group-hover:underline">
                Open demo →
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-[#6e6250]">
          <Link to="/" className="text-[#b8ab96] hover:text-[var(--gold)]">
            ← Back to current live site
          </Link>
        </p>
      </div>
    </div>
  )
}
