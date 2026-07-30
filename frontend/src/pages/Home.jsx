import { useRef, useState, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Shield, TrendingUp, Lock,
  ChevronRight, Award, BarChart2, Users, CheckCircle,
  Clock, LayoutDashboard, Sparkles,
} from 'lucide-react'
import SpotPriceTicker from '../components/SpotPriceTicker'
import GoldMarketMatrix from '../components/GoldMarketMatrix'
import PublicTrustBar from '../components/PublicTrustBar'
import SeoHead from '../components/SeoHead'
import FadeIn from '../components/FadeIn'
import InvestNowBar from '../components/InvestNowBar'
import HeroBuyPanel from '../features/home/HeroBuyPanel'
import { useBottomDock } from '../context/BottomDockContext'
import { useIsMobileApp } from '../features/mobileApp'
import { API_SPOT_PRICES, SITE_ORIGIN } from '../config'

/* ─── Stat counter card ─────────────────────────────────────── */
function StatCard({ value, label, suffix = '', sublabel = null }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl md:text-5xl font-black gradient-gold-text mb-2 tracking-tight break-words">
        {value}<span className="text-2xl">{suffix}</span>
      </div>
      <div className="text-[11px] tracking-[0.2em] uppercase text-[var(--text-muted)]">{label}</div>
      {sublabel && (
        <div className="text-[10px] text-[var(--text-dim)] mt-2 leading-snug max-w-[14rem] mx-auto">{sublabel}</div>
      )}
    </div>
  )
}

function iconSoftBg(color) {
  if (String(color).includes('var(')) return `color-mix(in srgb, ${color} 12%, transparent)`
  return `${color}18`
}

/* ─── Feature card ──────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, desc, color = 'gold' }) {
  const colors = {
    gold: { bg: 'rgba(201,168,76,0.08)', border: 'rgba(201,168,76,0.2)', icon: '#C9A84C' },
    silver: { bg: 'var(--silver-08)', border: 'var(--silver-20)', icon: 'var(--silver)' },
    copper: { bg: 'rgba(184,115,51,0.08)', border: 'rgba(184,115,51,0.2)', icon: '#B87333' },
  }
  const c = colors[color]
  return (
    <div
      className="card-hover rounded-xl p-6 flex flex-col gap-4 h-full"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconSoftBg(c.icon), border: `1px solid ${c.border}` }}
      >
        <Icon size={20} style={{ color: c.icon }} />
      </div>
      <div className="flex flex-col flex-1">
        <h3 className="text-base font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

/* ─── Step card ─────────────────────────────────────────────── */
function StepCard({ num, title, desc }) {
  return (
    <div className="flex gap-5 h-full items-start">
      <div className="flex-shrink-0 w-10 h-10 rounded-full gradient-gold flex items-center justify-center text-[var(--btn-gold-fg)] font-black text-sm mt-1">
        {num}
      </div>
      <div>
        <h4 className="text-base font-semibold mb-1.5 text-[var(--text-primary)]">{title}</h4>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}


/* ─── Main Home component ───────────────────────────────────── */
export default function Home() {
  const heroRef = useRef(null)
  const [investPinned, setInvestPinned] = useState(false)
  const { setInvestBarAtBottom } = useBottomDock()
  const isMobileApp = useIsMobileApp()
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const [spotGold24, setSpotGold24] = useState(null)
  const [spotSilver999, setSpotSilver999] = useState(null)
  const [spotSourceNote, setSpotSourceNote] = useState('')

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
        'UAE ecommerce platform connecting buyers with business-verified UAE precious metals dealers to purchase physical gold, silver, and platinum at the lowest bullion rates.',
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

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const sRes = await fetch(API_SPOT_PRICES, { cache: 'no-store' })
        if (!cancelled && sRes.ok) {
          const s = await sRes.json()
          const g24 = s.gold && typeof s.gold['24K'] === 'number' ? s.gold['24K'] : null
          const s99 = s.silver && typeof s.silver['999'] === 'number' ? s.silver['999'] : null
          setSpotGold24(g24)
          setSpotSilver999(s99)
          const note = s.note && String(s.note).trim() ? String(s.note).trim() : ''
          setSpotSourceNote(
            s.source === 'spot'
              ? 'Indicative global spot (AED per gram) — your checkout price is always the vendor’s quote on the order.'
              : note || 'Sourced from the public rates feed or marketplace floor — vendor quotes apply at purchase.',
          )
        }
      } catch {
        /* spot optional for highlight section */
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <SeoHead
        title="Buy Physical Gold Online in the UAE with Trusted Bullion Dealers — Cridora"
        description="Buy authentic physical gold online in the UAE through verified bullion dealers. Enjoy transparent live pricing, secure transactions, and a premium gold ownership experience with Cridora."
        path="/"
        jsonLd={homeJsonLd}
      />
      <main className="min-w-0 overflow-x-hidden">
      {/* ── HERO ────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col overflow-x-hidden">
        {/* Ambient (neutral — no gold wash behind copy) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full"
            animate={{ scale: [1, 1.05, 1], opacity: [0.04, 0.07, 0.04] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: 'radial-gradient(circle, color-mix(in srgb, var(--text-primary) 5%, transparent) 0%, transparent 70%)',
              y: heroY,
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full opacity-[0.04]"
            style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--silver) 10%, transparent) 0%, transparent 70%)' }}
          />
          <div
            className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full opacity-[0.04]"
            style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--text-primary) 4%, transparent) 0%, transparent 70%)' }}
          />
        </div>

        {/* Grid — neutral lines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(color-mix(in srgb, var(--text-muted) 14%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--text-muted) 14%, transparent) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />

        {/* Ticker */}
        <div className="pt-4 md:pt-[calc(6rem+env(safe-area-inset-top,0px))]">
          <SpotPriceTicker />
          {/* Dubai retail strip (RetailRatesStrip) hidden until we have a stable reference — add import + component here */}
        </div>

        {/* Hero content — copy left, quick estimate right on desktop */}
        <motion.div
          style={{ opacity: heroOpacity }}
          className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-16 md:py-20 relative z-10"
        >
          <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-14 items-center">
            <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left min-w-0">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full text-[11px] tracking-[0.2em] uppercase"
                style={{
                  background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--text-muted) 20%, transparent)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
                <span className="font-semibold text-[var(--text-primary)]">
                  <span className="gradient-gold-text">UAE&apos;s trusted gold marketplace</span>
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="font-black leading-tight tracking-tight mb-6 max-w-4xl text-3xl sm:text-4xl md:text-5xl lg:text-[2.75rem] xl:text-6xl"
              >
                <span className="block">
                  <span className="gradient-gold-text-hero">Own Authentic Gold.</span>
                  <span className="text-[var(--text-primary)]">
                    {' '}
                    Invest With Confidence.
                  </span>
                </span>
              </motion.h1>

              {/* Sub */}
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.8 }}
                className="text-base md:text-lg max-w-2xl leading-relaxed mb-8"
              >
                <span className="text-white/90">
                  Buy authentic gold from verified UAE bullion dealers with transparent pricing, secure transactions, and complete ownership —{' '}
                </span>
                <span className="gradient-gold-text font-semibold">all through one trusted platform.</span>
                <span className="block mt-2 text-sm md:text-base text-[var(--text-muted)]">
                  Cridora is UAE&apos;s ecommerce platform for physical gold and silver — every gram verified before you pay, and yours to keep or sell back, anytime.
                </span>
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75, duration: 0.6 }}
                className="w-full max-w-4xl mb-8 px-0"
              >
                <PublicTrustBar />
              </motion.div>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.95, duration: 0.6 }}
                className="flex flex-col sm:flex-row items-center lg:items-stretch gap-4 mb-4 lg:mb-0"
              >
                <Link to="/marketplace">
                  <button className="btn-outline-gold px-8 py-4 rounded-sm text-sm tracking-widest uppercase font-semibold flex items-center gap-2.5 group">
                    Start Building Your Gold Portfolio
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </button>
                </Link>
                <Link to="/marketplace">
                  <button className="btn-outline-gold px-8 py-4 rounded-sm text-sm tracking-widest uppercase font-semibold flex items-center gap-2.5">
                    Explore Live Gold Prices
                    <ChevronRight size={16} />
                  </button>
                </Link>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 28, x: 0 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={{ delay: 0.72, duration: 0.65 }}
              className="lg:col-span-6 xl:col-span-5 w-full max-w-[26rem] sm:max-w-[28rem] mx-auto lg:max-w-none lg:mx-0 min-w-0"
            >
              <HeroBuyPanel />
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator — floats just above the Start Investing Now bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ bottom: 'calc(var(--invest-bar-h) + 1.5rem)' }}
        >
          <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--text-faint)]">Explore more</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-px h-8 bg-gradient-to-b from-[var(--text-faint)] to-transparent"
          />
        </motion.div>

      </section>

      {/* Start Investing Now — floats at the bottom of the viewport (any
          screen size) while the hero is in view, then pins to the top below
          the navbar once the hero has scrolled past (see effect above).
          Rendered outside the hero so it's never clipped by its overflow-hidden. */}
      {!isMobileApp && (
        <>
          <InvestNowBar pinned={investPinned} />
          {investPinned && <div style={{ height: 'var(--invest-bar-h)' }} aria-hidden="true" />}
        </>
      )}

      {/* ── MARKET RATE MATRIX ─────────────────────────────── */}
      <GoldMarketMatrix />

      <div className="max-w-7xl mx-auto px-6 -mt-10 mb-4 relative z-[1]">
        <FadeIn>
          <div
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl px-5 py-4"
            style={{
              background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
              border: '1px solid var(--border)',
            }}
          >
            <p className="text-sm text-[var(--text-muted)] max-w-xl leading-relaxed">
              See how bank and retail costs compare to Cridora&apos;s live, transparent pricing — same AED reference as our ticker.
            </p>
            <Link
              to="/tools/uae-digital-gold-comparison"
              className="btn-outline-gold px-5 py-3 rounded-sm text-xs tracking-widest uppercase font-semibold whitespace-nowrap shrink-0 text-center"
            >
              Try the UAE gold comparison tool
            </Link>
          </div>
        </FadeIn>
      </div>

      {/* ── PLATFORM HIGHLIGHTS ─────────────────────────────── */}
      <section className="py-20 relative overflow-hidden" style={{ background: 'var(--section-wash-a)' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.03)] to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-3">At a Glance</p>
              <h2 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] mb-3">
                Transparent Pricing. Verified Ownership.
              </h2>
              <p className="text-sm text-[var(--text-muted)] max-w-2xl mx-auto leading-relaxed">
                Live reference rates, multiple metals, and full compliance — built so you always know
                exactly what you own and what it&apos;s worth.
              </p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              {
                value: spotGold24 == null ? '—' : Number(spotGold24).toLocaleString('en-AE', { maximumFractionDigits: 2 }),
                suffix: ' AED/g',
                label: 'Gold 24K reference',
                sublabel: 'Indicative spot from the public feed — checkout uses each vendor quote.',
              },
              {
                value: spotSilver999 == null ? '—' : Number(spotSilver999).toLocaleString('en-AE', { maximumFractionDigits: 3 }),
                suffix: ' AED/g',
                label: 'Silver 999 reference',
                sublabel: 'Same feed as the header ticker for price transparency.',
              },
              {
                value: '4',
                suffix: '',
                label: 'Four metals',
                sublabel: 'Gold, silver, copper, and palladium listings on one platform.',
              },
              {
                value: 'Zero',
                suffix: '',
                label: 'Platform custody',
                sublabel: 'Metal stays with the selling vendor — Cridora records orders and compliance.',
              },
            ].map((stat, i) => (
              <FadeIn key={stat.label} delay={i * 0.1}>
                <StatCard {...stat} />
              </FadeIn>
            ))}
          </div>
          {spotSourceNote && (
            <p className="text-center text-[10px] text-[var(--text-dim)] max-w-2xl mx-auto mt-8 leading-relaxed">{spotSourceNote}</p>
          )}
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section id="features" className="py-28 relative">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">Why Choose Cridora</p>
              <h2 className="text-3xl md:text-5xl font-black leading-tight mb-5">
                <span style={{ color: 'var(--text-primary)' }}>More Than a</span>{' '}
                <span className="gradient-gold-text">Gold Marketplace</span>
              </h2>
              <p className="text-[var(--text-muted)] max-w-xl mx-auto text-sm leading-relaxed">
                Cridora connects you with licensed UAE bullion dealers, making gold ownership simple,
                transparent, and secure. Every purchase is backed by verified sellers, live market
                pricing, and a seamless buying experience designed for long-term investors.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {[
              {
                icon: Shield,
                title: 'Verified Dealers',
                desc: 'Only licensed and verified bullion dealers can list products on Cridora, giving you confidence in every purchase.',
                color: 'gold',
              },
              {
                icon: TrendingUp,
                title: 'Live Market Pricing',
                desc: "See transparent pricing linked to live market rates so you always know what you're paying.",
                color: 'silver',
              },
              {
                icon: Lock,
                title: 'Secure Ownership',
                desc: 'Every purchase is securely recorded, making it easy to manage your gold portfolio over time.',
                color: 'copper',
              },
              {
                icon: Clock,
                title: 'Buy Today. Collect Later.',
                desc: "Keep your gold with the dealer or request delivery whenever you're ready.",
                color: 'gold',
              },
              {
                icon: BarChart2,
                title: 'Sell Back Easily',
                desc: 'When the time is right, request a sell-back directly through Cridora with participating dealers.',
                color: 'silver',
              },
              {
                icon: LayoutDashboard,
                title: 'Your Gold Dashboard',
                desc: 'Track your purchases, monitor market value, and manage your entire portfolio from one place.',
                color: 'copper',
              },
            ].map((feat, i) => (
              <FadeIn key={feat.title} delay={i * 0.1} className="h-full">
                <FeatureCard {...feat} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── VENDORS: ALREADY HAVE AN APP? ───────────────────── */}
      <section
        id="already-have-an-app"
        className="py-28 relative overflow-hidden"
        aria-labelledby="already-have-an-app-heading"
        style={{ background: 'var(--section-wash-a)' }}
      >
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-[rgba(201,168,76,0.04)] to-transparent" />
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">Why Cridora</p>
              <h2 id="already-have-an-app-heading" className="text-2xl md:text-4xl font-black text-[var(--text-primary)] leading-tight mb-6">
                Why Join Cridora If You Already Have an App?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-10">
                <div
                  className="rounded-xl p-5 md:p-6"
                  style={{
                    background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--text-muted) 18%, transparent)',
                  }}
                >
                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                    Your app helps you serve your existing customers.
                  </p>
                </div>
                <div
                  className="rounded-xl p-5 md:p-6"
                  style={{
                    background: 'rgba(201,168,76,0.08)',
                    border: '1px solid rgba(201,168,76,0.22)',
                  }}
                >
                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                    Cridora helps you scale beyond them.
                  </p>
                </div>
              </div>
              <p className="text-sm text-[var(--text-muted)] text-left md:text-center leading-relaxed max-w-3xl mx-auto mb-8">
                While most dealer apps are limited to a single business ecosystem, Cridora is designed as
                a larger trusted bullion network that helps vendors:
              </p>
            </div>
          </FadeIn>
          <ul className="space-y-4 mb-10 text-[var(--text-muted)]">
            {[
              'reach new customers digitally,',
              'streamline operational workflows,',
              'reduce dependency on manual coordination,',
              'and expand beyond physical branch limitations.',
            ].map((line, i) => (
              <FadeIn key={line} delay={0.06 * i}>
                <li className="flex gap-3 text-sm md:text-[15px] leading-relaxed">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--gold)]" aria-hidden />
                  <span>{line}</span>
                </li>
              </FadeIn>
            ))}
          </ul>
          <FadeIn delay={0.15}>
            <p className="text-sm md:text-[15px] text-[var(--text-muted)] leading-relaxed mb-8">
              Cridora does not replace your business or your app — it strengthens them through shared
              visibility, structured workflows, and a verified ecosystem built specifically for bullion trade.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div
              className="rounded-xl p-6 md:p-8"
              style={{
                background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                border: '1px solid color-mix(in srgb, var(--gold) 28%, transparent)',
              }}
            >
              <p className="text-sm md:text-[15px] text-[var(--text-muted)] leading-relaxed mb-4">
                Because in modern bullion commerce:
              </p>
              <p className="text-base md:text-lg text-[var(--text-primary)] font-semibold leading-relaxed mb-3">
                Having an app is useful,
              </p>
              <p className="text-base md:text-lg text-[var(--text-muted)] leading-relaxed font-normal">
                but being part of a trusted digital ecosystem is far more powerful.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── METALS SHOWCASE ─────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden" style={{ background: 'var(--section-wash-b)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.2)] to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.2)] to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">The Metals</p>
              <h2 className="text-3xl md:text-5xl font-black text-[var(--text-primary)] mb-5">
                Trade What Matters
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Gold',
                symbol: 'XAU',
                price: spotGold24 == null
                  ? '—'
                  : `${Number(spotGold24).toLocaleString('en-AE', { maximumFractionDigits: 2 })} AED/g`,
                refLabel: '24K · public spot reference',
                desc: 'Build positions with full quote and fee disclosure on each vendor listing; physical metal is held by the selling vendor, not the platform.',
                gradient: 'linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(232,201,106,0.06) 100%)',
                border: 'rgba(201,168,76,0.25)',
                textClass: 'gradient-gold-text',
                icon: '◈',
              },
              {
                name: 'Silver',
                symbol: 'XAG',
                price: spotSilver999 == null
                  ? '—'
                  : `${Number(spotSilver999).toLocaleString('en-AE', { maximumFractionDigits: 3 })} AED/g`,
                refLabel: '999 · public spot reference',
                desc: 'Same transparency model as gold: see buy and buyback on the product before you commit, and complete KYC before you trade.',
                gradient: 'linear-gradient(135deg, var(--silver-12) 0%, var(--silver-light-06) 100%)',
                border: 'var(--silver-25)',
                textClass: 'gradient-silver-text',
                icon: '◇',
              },
              {
                name: 'Copper',
                symbol: 'XCU · industrial & bullion',
                price: 'Per listing',
                refLabel: 'No global ticker on platform',
                desc:
                  'Copper combines heavy industrial demand with tradable bar and cathode-style products when vendors list them. See vendor-quoted AED rates, fees, and buyback disclosures on each listing — priced by weight or unit like other metals.',
                gradient: 'linear-gradient(135deg, rgba(184,115,51,0.12) 0%, rgba(218,138,103,0.06) 100%)',
                border: 'rgba(184,115,51,0.25)',
                textClass: 'gradient-copper-text',
                icon: '◆',
              },
            ].map((metal, i) => (
              <FadeIn key={metal.name} delay={i * 0.15}>
                <div
                  className="card-hover rounded-2xl p-8 relative overflow-hidden"
                  style={{ background: metal.gradient, border: `1px solid ${metal.border}` }}
                >
                  <div className="absolute top-5 right-5 text-4xl opacity-10">{metal.icon}</div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className={`text-2xl font-black ${metal.textClass} tracking-tight`}>{metal.name}</div>
                      <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--text-dim)] mt-1">{metal.symbol}</div>
                    </div>
                    <div className="text-right max-w-[11rem]">
                      <div className="text-sm font-bold text-[var(--text-primary)] leading-tight">{metal.price}</div>
                      <div className="text-[10px] text-[var(--text-muted)] font-medium mt-1">{metal.refLabel}</div>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6">{metal.desc}</p>
                  <Link to="/marketplace">
                    <button
                      className="w-full py-3 rounded-lg text-xs tracking-widest uppercase font-semibold transition-all duration-300 hover:opacity-90"
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

      {/* ── EMOTIONAL SECTION ───────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.05]"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 50%, #C9A84C 0%, transparent 70%)' }} />
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center px-6 relative z-10">
            <Sparkles size={22} className="text-[var(--gold)] mx-auto mb-6 opacity-80" aria-hidden />
            <h2 className="text-3xl md:text-5xl font-black leading-tight mb-6">
              <span style={{ color: 'var(--text-primary)' }}>Gold Isn&apos;t Just a Purchase.</span>
              <br />
              <span className="gradient-gold-text">It&apos;s Peace of Mind.</span>
            </h2>
            <p className="text-[var(--text-muted)] text-base leading-relaxed max-w-xl mx-auto">
              Gold has protected wealth for generations. Cridora makes owning physical gold just as
              simple as managing any modern investment — without compromising on trust, authenticity,
              or transparency.
            </p>
          </div>
        </FadeIn>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section id="how-it-works" className="py-28">
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">The Process</p>
              <h2 className="text-3xl md:text-5xl font-black text-[var(--text-primary)] mb-5">
                Simple. Transparent. Yours.
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:items-stretch">
            {[
              {
                num: '01',
                title: 'Verify Once',
                desc: 'A quick identity check — ID, proof of address, and a selfie. It\u2019s what keeps every trade on Cridora safe.',
              },
              {
                num: '02',
                title: 'Compare Live Rates',
                desc: 'Browse real-time prices from licensed dealers, side by side, with buyback rates shown upfront.',
              },
              {
                num: '03',
                title: 'Buy With Confidence',
                desc: 'Your price is locked the moment you confirm. Your ledger records it instantly; the metal stays with the UAE vendor.',
              },
              {
                num: '04',
                title: 'Track, Hold or Sell',
                desc: 'Watch your gold\u2019s value grow in real time — or sell it back to the original vendor whenever you\u2019re ready.',
              },
            ].map((step, i) => (
              <FadeIn key={step.num} delay={i * 0.12} direction={i % 2 === 0 ? 'right' : 'left'} className="h-full">
                <div
                  className="card-hover p-7 rounded-xl h-full"
                  style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}
                >
                  <StepCard {...step} />
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── INVESTMENT SECTION ──────────────────────────────── */}
      <section className="py-24 relative" style={{ background: 'var(--section-wash-a)' }}>
        <div className="max-w-3xl mx-auto text-center px-6">
          <FadeIn>
            <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">Grow at Your Pace</p>
            <h2 className="text-3xl md:text-5xl font-black text-[var(--text-primary)] mb-5">
              Start Small. Grow Over Time.
            </h2>
            <p className="text-[var(--text-muted)] text-base leading-relaxed max-w-xl mx-auto">
              Whether you&apos;re buying your first gram or expanding a growing portfolio, Cridora
              helps you build your wealth with physical gold at your own pace.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── SECURITY SECTION ─────────────────────────────────── */}
      <section className="py-20" style={{ background: 'var(--section-wash-b)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">Compliance & Security</p>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-5">
                Designed Around Trust
              </h2>
              <p className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm leading-relaxed">
                Every interaction on Cridora is built around one principle: confidence. From verified
                dealers and transparent pricing to secure transactions and documented ownership,
                every step is designed to help you buy with certainty.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Award,
                title: 'Every Dealer Is Verified',
                points: ['Background-checked before they list a single product', 'Only verified-dealer accounts appear on Cridora', 'Buy-back terms shown upfront, on every listing', 'Continuously monitored, not just checked once'],
                color: 'gold',
              },
              {
                icon: Shield,
                title: 'Your Funds Are Protected',
                points: ['Your identity verified before every trade', 'Full compliance with UAE financial regulations', 'Payments held securely until your order is confirmed', 'Your gold stays with the dealer — never with us', 'Every cost shown clearly before you commit'],
                color: 'silver',
              },
              {
                icon: Lock,
                title: 'Bank-Grade Security, Always On',
                points: ['Encrypted payments, monitored 24/7', "Every dealer's funds kept completely separate", 'Real-time transaction records', 'Independent audit trail'],
                color: 'copper',
              },
            ].map((item, i) => {
              const colors = {
                gold: { bg: 'rgba(201,168,76,0.06)', border: 'rgba(201,168,76,0.15)', icon: '#C9A84C' },
                silver: { bg: 'var(--silver-06)', border: 'var(--silver-15)', icon: 'var(--silver)' },
                copper: { bg: 'rgba(184,115,51,0.06)', border: 'rgba(184,115,51,0.15)', icon: '#B87333' },
              }
              const c = colors[item.color]
              return (
                <FadeIn key={item.title} delay={i * 0.15}>
                  <div
                    className="card-hover rounded-xl p-7 h-full"
                    style={{ background: c.bg, border: `1px solid ${c.border}` }}
                  >
                    <item.icon size={24} style={{ color: c.icon }} className="mb-5 opacity-90" />
                    <h3 className="text-base font-bold mb-4 text-[var(--text-primary)]">{item.title}</h3>
                    <ul className="flex flex-col gap-2.5">
                      {item.points.map((p) => (
                        <li key={p} className="flex items-start gap-2.5">
                          <CheckCircle size={13} style={{ color: c.icon }} className="mt-0.5 flex-shrink-0 opacity-80" />
                          <span className="text-sm text-[var(--text-muted)]">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── PORTFOLIO SECTION ────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, #C9A84C 0%, transparent 70%)' }} />
        <div className="max-w-3xl mx-auto text-center px-6 relative z-10">
          <FadeIn>
            <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">One Place for Everything</p>
            <h2 className="text-3xl md:text-5xl font-black text-[var(--text-primary)] mb-5">
              Your Gold. One Dashboard.
            </h2>
            <p className="text-[var(--text-muted)] text-base leading-relaxed max-w-xl mx-auto mb-9">
              Monitor live values, manage purchases, request delivery, and view your complete
              ownership history — all in one beautifully designed experience.
            </p>
            <Link to="/dashboard/customer?section=portfolio">
              <button className="btn-gold px-10 py-4 rounded-sm text-sm tracking-widest uppercase font-bold flex items-center gap-2.5 group mx-auto">
                View Your Portfolio
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ── VALUE PROPOSITION ───────────────────────────────── */}
      <section className="py-24 relative" style={{ background: 'var(--section-wash-a)' }}>
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-5xl font-black text-[var(--text-primary)]">
                Everything You Need to <span className="gradient-gold-text">Own Gold Confidently</span>
              </h2>
            </div>
          </FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
            {[
              'Verified UAE Dealers',
              'Live Gold Pricing',
              'Secure Checkout',
              'Digital Ownership Records',
              'Flexible Delivery',
              'Easy Sell Back',
              'Personal Gold Tracker',
              'Premium User Experience',
            ].map((item, i) => (
              <FadeIn key={item} delay={i * 0.05}>
                <div className="flex items-start gap-2.5">
                  <CheckCircle size={16} className="text-[var(--gold)] mt-0.5 flex-shrink-0" aria-hidden />
                  <span className="text-sm text-[var(--text-muted)] leading-snug">{item}</span>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT SECTION ────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden">
        <div className="max-w-3xl mx-auto text-center px-6 relative z-10">
          <FadeIn>
            <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">About Cridora</p>
            <h2 className="text-3xl md:text-5xl font-black text-[var(--text-primary)] mb-6">
              Built for Modern Gold Investors
            </h2>
            <p className="text-[var(--text-muted)] text-base leading-relaxed max-w-xl mx-auto mb-2">
              Cridora brings together trusted bullion dealers and modern technology to make physical
              gold ownership simple, transparent, and accessible across the UAE.
            </p>
            <p className="text-[var(--text-muted)] text-base leading-relaxed max-w-xl mx-auto">
              No hidden surprises. No unnecessary complexity. Just a better way to own gold.
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div
              className="rounded-xl p-6 md:p-8 mt-12"
              style={{
                background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                border: '1px solid color-mix(in srgb, var(--gold) 28%, transparent)',
              }}
            >
              <p className="text-lg md:text-xl text-[var(--text-primary)] font-semibold leading-relaxed italic">
                &ldquo;Confidence is the most valuable asset you can own. Gold simply preserves it.&rdquo;
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.06]"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, #C9A84C 0%, #B87333 40%, transparent 70%)' }} />
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: 'linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <FadeIn>
          <div className="max-w-3xl mx-auto text-center px-6">
            <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-6">Ready When You Are</p>
            <h2 className="text-4xl md:text-6xl font-black leading-tight mb-6">
              <span className="gradient-gold-text">Begin Your Gold</span>
              <br />
              <span style={{ color: 'var(--text-primary)' }}>Ownership Journey.</span>
            </h2>
            <p className="text-[var(--text-muted)] text-base leading-relaxed mb-10 max-w-md mx-auto">
              Join a growing community choosing a smarter, safer, and more transparent way to own
              physical gold in the UAE.
            </p>
            <p className="text-[10px] text-[var(--text-dim)] max-w-lg mx-auto mb-8 leading-relaxed">
              Cridora is software for order flow, compliance gates, and records — not a substitute for your own financial, tax, or regulatory advice.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/marketplace">
                <button className="btn-gold px-10 py-4 rounded-sm text-sm tracking-widest uppercase font-bold flex items-center gap-2.5 group">
                  Start With Cridora Today
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </button>
              </Link>
              <Link to="/vendors">
                <button className="btn-outline-gold px-10 py-4 rounded-sm text-sm tracking-widest uppercase font-semibold flex items-center gap-2.5">
                  <Users size={15} />
                  Become a Vendor
                </button>
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>
    </main>
    </>
  )
}
