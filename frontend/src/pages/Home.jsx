import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Shield, TrendingUp, BarChart2 } from 'lucide-react'
import GoldMarketMatrix from '../components/GoldMarketMatrix'
import SeoHead from '../components/SeoHead'
import FadeIn from '../components/FadeIn'
import InvestNowBar from '../components/InvestNowBar'
import HomeAtelierHero from '../features/home/HomeAtelierHero'
import { useBottomDock } from '../context/BottomDockContext'
import { useIsMobileApp } from '../features/mobileApp'
import { SITE_ORIGIN } from '../config'
import { useTickerSpotPrices } from '../lib/spotPriceCache'

function StatCard({ value, label, suffix = '' }) {
  return (
    <div className="text-center px-2">
      <div className="text-3xl sm:text-4xl md:text-5xl font-black gradient-gold-text mb-3 tracking-tight break-words">
        {value}<span className="text-2xl">{suffix}</span>
      </div>
      <div className="text-[11px] tracking-[0.2em] uppercase text-[var(--text-muted)]">{label}</div>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="flex flex-col gap-4 h-full py-2">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)',
        }}
      >
        <Icon size={18} style={{ color: 'var(--gold)' }} />
      </div>
      <div>
        <h3 className="text-base font-semibold mb-1.5 text-[var(--text-primary)]">{title}</h3>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-xs">{desc}</p>
      </div>
    </div>
  )
}

function StepCard({ num, title, desc }) {
  return (
    <div className="flex gap-5 items-start">
      <div className="flex-shrink-0 w-9 h-9 gradient-gold flex items-center justify-center text-[var(--btn-gold-fg)] font-black mt-0.5">
        {num}
      </div>
      <div>
        <h4 className="text-base font-semibold mb-1 text-[var(--text-primary)]">{title}</h4>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-sm">{desc}</p>
      </div>
    </div>
  )
}

export default function Home() {
  const heroRef = useRef(null)
  const [investPinned, setInvestPinned] = useState(false)
  const { setInvestBarAtBottom } = useBottomDock()
  const isMobileApp = useIsMobileApp()
  const { data: tickerSpot } = useTickerSpotPrices()
  const spotGold24 = typeof tickerSpot?.gold?.['24K'] === 'number' ? tickerSpot.gold['24K'] : null
  const spotSilver999 = typeof tickerSpot?.silver?.['999'] === 'number' ? tickerSpot.silver['999'] : null
  const spotSourceNote = tickerSpot?.source === 'spot'
    ? 'Indicative global spot (AED per gram) — checkout uses each vendor’s quote.'
    : (tickerSpot?.note && String(tickerSpot.note).trim())
      || (tickerSpot
        ? 'Sourced from the live ticker — vendor quotes apply at purchase.'
        : '')

  /* The "Start Investing Now" bar floats fixed at the bottom of the
     viewport (any screen size) while the hero is still in view, then pins
     to the top — below the navbar — once the hero has fully scrolled past.
     On phone (&lt;768) the mobile bottom tabs own the dock; hide this bar. */
  useEffect(() => {
    if (isMobileApp) {
      setInvestPinned(true)
      return undefined
    }
    let raf = 0
    const navbarHeight = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--navbar-h')
      return parseFloat(v) || 96
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const el = heroRef.current
        if (!el) return
        const heroFinished = el.getBoundingClientRect().bottom <= navbarHeight()
        setInvestPinned((prev) => (prev === heroFinished ? prev : heroFinished))
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [isMobileApp])

  // Let the install/notify CTA know when the invest bar is docked at the
  // bottom (so the CTA can float just above it) vs pinned to the top
  // (so the CTA can drop into the freed bottom spot). Never bottom-dock on phones.
  useEffect(() => {
    setInvestBarAtBottom(!isMobileApp && !investPinned)
  }, [investPinned, setInvestBarAtBottom, isMobileApp])

  const homeJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Cridora',
      url: `${SITE_ORIGIN}/`,
      logo: `${SITE_ORIGIN}/pwa-512-seal.png`,
      description:
        'UAE ecommerce platform connecting buyers with business-verified UAE precious metals dealers to purchase physical gold and silver at the lowest bullion rates.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Cridora',
      url: `${SITE_ORIGIN}/`,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_ORIGIN}/marketplace?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ]

  return (
    <>
      <SeoHead
        title="Buy Physical Gold Online in the UAE with Trusted Bullion Dealers — Cridora"
        description="Buy authentic physical gold online in the UAE through verified bullion dealers. Transparent live pricing and secure transactions with Cridora."
        path="/"
        jsonLd={homeJsonLd}
      />
      <main className="min-w-0 overflow-x-hidden">
      {/* ── HERO (Atelier landing match) ───────────────────── */}
      <HomeAtelierHero heroRef={heroRef} />

      {!isMobileApp && (
        <>
          <InvestNowBar pinned={investPinned} />
          {investPinned && <div style={{ height: 'var(--invest-bar-h)' }} aria-hidden="true" />}
        </>
      )}

      {/* ── MARKET RATE MATRIX ─────────────────────────────── */}
      <GoldMarketMatrix />

      {/* ── AT A GLANCE ─────────────────────────────────────── */}
      <section
        className="py-[clamp(4rem,8vw,8rem)] relative overflow-hidden"
        style={{ background: 'var(--section-wash-a)' }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16 md:mb-20">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-3">At a Glance</p>
              <h2 className="text-2xl md:text-3xl font-black text-[var(--text-primary)]">
                Transparent. Verified. Yours.
              </h2>
            </div>
          </FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-14 py-4">
            {[
              {
                value: spotGold24 == null ? '—' : Number(spotGold24).toLocaleString('en-AE', { maximumFractionDigits: 2 }),
                suffix: ' AED/g',
                label: 'Gold 24K',
              },
              {
                value: spotSilver999 == null ? '—' : Number(spotSilver999).toLocaleString('en-AE', { maximumFractionDigits: 3 }),
                suffix: ' AED/g',
                label: 'Silver 999',
              },
              {
                value: '2',
                suffix: '',
                label: 'Metals',
              },
              {
                value: 'Allocated',
                suffix: '',
                label: 'Not pooled',
              },
            ].map((stat, i) => (
              <FadeIn key={stat.label} delay={i * 0.1}>
                <StatCard {...stat} />
              </FadeIn>
            ))}
          </div>
          {spotSourceNote && (
            <p className="text-center text-[10px] text-[var(--text-dim)] max-w-xl mx-auto mt-12 leading-relaxed">{spotSourceNote}</p>
          )}
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section id="features" className="py-24 md:py-32 relative">
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16 md:mb-20">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">Why Cridora</p>
              <h2 className="text-3xl md:text-4xl font-black leading-tight">
                <span style={{ color: 'var(--text-primary)' }}>Built for calm</span>{' '}
                <span className="gradient-gold-text">ownership</span>
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-10">
            {[
              {
                icon: Shield,
                title: 'Allocated to you',
                desc: 'Not pooled. Matched with licensed UAE dealers — metal stays in your name.',
              },
              {
                icon: TrendingUp,
                title: 'Specific savings',
                desc: 'Live math vs OGold, Noon, and banks — not a "lowest price" slogan.',
              },
              {
                icon: BarChart2,
                title: 'Drop alerts',
                desc: 'Notify when gold drops. We only message when the price is worth it.',
              },
            ].map((feat, i) => (
              <FadeIn key={feat.title} delay={i * 0.1}>
                <FeatureCard {...feat} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 md:py-32" style={{ background: 'var(--section-wash-b)' }}>
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16 md:mb-20">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">The Process</p>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">
                Four quiet steps
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-14">
            {[
              {
                num: '01',
                title: 'Verify once',
                desc: 'A light identity check that unlocks trading across the platform.',
              },
              {
                num: '02',
                title: 'Compare rates',
                desc: 'Browse live quotes from licensed dealers, buyback shown upfront.',
              },
              {
                num: '03',
                title: 'Buy with clarity',
                desc: 'Price locks on confirm. Metal stays with the UAE vendor.',
              },
              {
                num: '04',
                title: 'Hold or sell',
                desc: 'Track value in your dashboard — or sell back when ready.',
              },
            ].map((step, i) => (
              <FadeIn key={step.num} delay={i * 0.1}>
                <StepCard {...step} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── METALS ──────────────────────────────────────────── */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16 md:mb-20">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">The Metals</p>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">
                Trade what matters
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 max-w-4xl mx-auto">
            {[
              {
                name: 'Gold',
                symbol: 'XAU',
                price: spotGold24 == null
                  ? '—'
                  : `${Number(spotGold24).toLocaleString('en-AE', { maximumFractionDigits: 2 })} AED/g`,
                refLabel: '24K · spot reference',
                desc: 'Physical gold held by the selling vendor — full quote disclosure on every listing.',
                gradient: 'linear-gradient(135deg, rgba(232,195,74,0.10) 0%, rgba(240,205,94,0.04) 100%)',
                border: 'rgba(232,195,74,0.22)',
                textClass: 'gradient-gold-text',
              },
              {
                name: 'Silver',
                symbol: 'XAG',
                price: spotSilver999 == null
                  ? '—'
                  : `${Number(spotSilver999).toLocaleString('en-AE', { maximumFractionDigits: 3 })} AED/g`,
                refLabel: '999 · spot reference',
                desc: 'Same transparency as gold — buy and buyback shown before you commit.',
                gradient: 'linear-gradient(135deg, var(--silver-12) 0%, var(--silver-light-06) 100%)',
                border: 'var(--silver-25)',
                textClass: 'gradient-silver-text',
              },
            ].map((metal, i) => (
              <FadeIn key={metal.name} delay={i * 0.12}>
                <div
                  className="rounded-2xl p-8 md:p-10 h-full flex flex-col"
                  style={{ background: metal.gradient, border: `1px solid ${metal.border}` }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className={`text-2xl font-black ${metal.textClass} tracking-tight`}>{metal.name}</div>
                      <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--text-dim)] mt-1">{metal.symbol}</div>
                    </div>
                    <div className="text-right max-w-[10rem]">
                      <div className="text-sm font-bold text-[var(--text-primary)] leading-tight">{metal.price}</div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-1">{metal.refLabel}</div>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-8 flex-1">{metal.desc}</p>
                  <Link to="/marketplace">
                    <button
                      className="w-full py-3 rounded-lg text-xs tracking-widest uppercase font-semibold transition-opacity hover:opacity-90"
                      style={{ background: metal.border, color: 'var(--text-primary)', border: `1px solid ${metal.border}` }}
                    >
                      View Listings
                    </button>
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────── */}
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: 'var(--section-wash-a)' }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.05]"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 50%, var(--gold) 0%, transparent 70%)' }}
        />
        <FadeIn>
          <div className="max-w-xl mx-auto text-center px-6 relative z-10">
            <h2 className="text-3xl md:text-5xl font-black leading-tight mb-5">
              <span className="gradient-gold-text">Begin with gold</span>
              <span className="text-[var(--text-primary)]">.</span>
            </h2>
            <p className="text-[var(--text-muted)] text-base leading-relaxed mb-10 max-w-md mx-auto">
              A quieter way to own physical gold in the UAE — verified dealers, clear pricing, one marketplace.
            </p>
            <Link to="/marketplace">
              <button className="btn-gold inline-flex items-center gap-2.5 group">
                Explore Marketplace
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
            <p className="mt-8 text-sm text-[var(--text-muted)]">
              Dealer?{' '}
              <Link to="/vendors" className="text-[var(--gold)] underline-offset-4 hover:underline">
                Become a vendor
              </Link>
            </p>
          </div>
        </FadeIn>
      </section>
    </main>
    </>
  )
}
