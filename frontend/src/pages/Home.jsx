import { useRef, useState, useEffect } from 'react'
import { motion, useScroll, useTransform, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Shield, Globe, Zap, TrendingUp, Lock,
  ChevronRight, Award, BarChart2, Users, CheckCircle
} from 'lucide-react'
import SpotPriceTicker from '../components/SpotPriceTicker'
import { API_AUTH_BASE, API_SPOT_PRICES } from '../config'

/* ─── Reusable fade-in wrapper ─────────────────────────────── */
function FadeIn({ children, delay = 0, direction = 'up', className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const variants = {
    hidden: {
      opacity: 0,
      y: direction === 'up' ? 40 : direction === 'down' ? -40 : 0,
      x: direction === 'left' ? 40 : direction === 'right' ? -40 : 0,
    },
    visible: { opacity: 1, y: 0, x: 0 },
  }
  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ─── Stat counter card ─────────────────────────────────────── */
function StatCard({ value, label, suffix = '', sublabel = null }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl md:text-5xl font-black gradient-gold-text mb-2 tracking-tight break-words">
        {value}<span className="text-2xl">{suffix}</span>
      </div>
      <div className="text-[11px] tracking-[0.2em] uppercase text-[#666]">{label}</div>
      {sublabel && (
        <div className="text-[10px] text-[#555] mt-2 leading-snug max-w-[14rem] mx-auto">{sublabel}</div>
      )}
    </div>
  )
}

/* ─── Feature card ──────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, desc, color = 'gold' }) {
  const colors = {
    gold: { bg: 'rgba(201,168,76,0.08)', border: 'rgba(201,168,76,0.2)', icon: '#C9A84C' },
    silver: { bg: 'rgba(168,169,173,0.08)', border: 'rgba(168,169,173,0.2)', icon: '#A8A9AD' },
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
        style={{ background: `${c.icon}18`, border: `1px solid ${c.border}` }}
      >
        <Icon size={20} style={{ color: c.icon }} />
      </div>
      <div className="flex flex-col flex-1">
        <h3 className="text-base font-semibold mb-1.5" style={{ color: '#F5F0E8' }}>{title}</h3>
        <p className="text-sm text-[#666] leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

/* ─── Step card ─────────────────────────────────────────────── */
function StepCard({ num, title, desc }) {
  return (
    <div className="flex gap-5">
      <div className="flex-shrink-0 w-10 h-10 rounded-full gradient-gold flex items-center justify-center text-[#080808] font-black text-sm mt-1">
        {num}
      </div>
      <div>
        <h4 className="text-base font-semibold mb-1.5 text-[#F5F0E8]">{title}</h4>
        <p className="text-sm text-[#666] leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}


/* ─── Main Home component ───────────────────────────────────── */
export default function Home() {
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const [verifiedVendorCount, setVerifiedVendorCount] = useState(null)
  const [spotGold24, setSpotGold24] = useState(null)
  const [spotSilver999, setSpotSilver999] = useState(null)
  const [spotSourceNote, setSpotSourceNote] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [vRes, sRes] = await Promise.all([
          fetch(`${API_AUTH_BASE}/vendors/verified/`, { cache: 'no-store' }),
          fetch(API_SPOT_PRICES, { cache: 'no-store' }),
        ])
        if (!cancelled && vRes.ok) {
          const d = await vRes.json()
          setVerifiedVendorCount(Array.isArray(d.vendors) ? d.vendors.length : 0)
        } else if (!cancelled) {
          setVerifiedVendorCount(0)
        }
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
        if (!cancelled) {
          setVerifiedVendorCount(0)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="min-w-0 overflow-x-hidden">
      {/* ── HERO ────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Orb backgrounds */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full opacity-[0.07]"
            animate={{ scale: [1, 1.05, 1], opacity: [0.06, 0.1, 0.06] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: 'radial-gradient(circle, #C9A84C 0%, #B87333 40%, transparent 70%)',
              y: heroY,
            }}
          />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full opacity-[0.04]"
            style={{ background: 'radial-gradient(circle, #A8A9AD 0%, transparent 70%)' }} />
          <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full opacity-[0.04]"
            style={{ background: 'radial-gradient(circle, #B87333 0%, transparent 70%)' }} />
        </div>

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />

        {/* Ticker */}
        <div className="pt-20">
          <SpotPriceTicker />
          {/* Dubai retail strip (RetailRatesStrip) hidden until we have a stable reference — add import + component here */}
        </div>

        {/* Hero content */}
        <motion.div
          style={{ opacity: heroOpacity }}
          className="flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 py-16 sm:py-20 relative z-10"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full text-[11px] tracking-[0.2em] uppercase"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
            <span className="gradient-gold-text font-semibold">Dubai-Based · Globally Accessible</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight mb-6"
          >
            <span className="gradient-gold-text">Precious Metals.</span>
            <br />
            <span style={{ color: '#F5F0E8' }}>Digitally Owned.</span>
            <br />
            <span className="gradient-silver-text text-4xl md:text-5xl lg:text-6xl font-medium tracking-widest mt-2 block">
              Globally Traded.
            </span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.8 }}
            className="text-base md:text-lg text-[#666] max-w-xl leading-relaxed mb-10"
          >
            Buy, hold, and sell precious metals with KYB-verified vendors in the UAE. You get a clear order
            and ledger, disclosed fees and buyback terms before you pay, and card checkout when enabled by the operator.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center gap-4 mb-16"
          >
            <Link to="/marketplace">
              <button className="btn-gold px-8 py-4 rounded-sm text-sm tracking-widest uppercase font-bold flex items-center gap-2.5 group">
                Explore Marketplace
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
            <Link to="/how-it-works">
              <button className="btn-outline-gold px-8 py-4 rounded-sm text-sm tracking-widest uppercase font-semibold flex items-center gap-2.5">
                How It Works
                <ChevronRight size={16} />
              </button>
            </Link>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-6"
          >
            {[
              { icon: Shield, text: 'KYC / KYB reviews' },
              { icon: Lock, text: 'No platform metal custody' },
              { icon: Globe, text: 'Dubai, UAE–based' },
              { icon: Zap, text: 'Fast payment & records' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-[#555]">
                <Icon size={13} className="text-[#C9A84C] opacity-70" />
                {text}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[10px] tracking-[0.25em] uppercase text-[#444]">Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-px h-8 bg-gradient-to-b from-[#C9A84C] to-transparent"
          />
        </motion.div>
      </section>

      {/* ── STATS ───────────────────────────────────────────── */}
      <section className="py-20 relative overflow-hidden" style={{ background: '#0A0A0A' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.03)] to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-[10px] text-[#555] max-w-2xl mx-auto mb-10 tracking-wide">
            Figures below are read from the same public API the app uses: KYB-verified partner count and live reference rates (AED/gram) when the feed is available.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              {
                value: verifiedVendorCount == null ? '—' : String(verifiedVendorCount),
                suffix: '',
                label: 'KYB-verified partners',
                sublabel: 'Vendors with approved KYB, exposed on the public /vendors/verified/ endpoint.',
              },
              {
                value: spotGold24 == null ? '—' : Number(spotGold24).toLocaleString('en-AE', { maximumFractionDigits: 2 }),
                suffix: ' AED/g',
                label: 'Gold 24K (reference)',
                sublabel: 'Indicative AED per gram from the spot (or floor) feed — not a binding quote.',
              },
              {
                value: spotSilver999 == null ? '—' : Number(spotSilver999).toLocaleString('en-AE', { maximumFractionDigits: 3 }),
                suffix: ' AED/g',
                label: 'Silver 999 (reference)',
                sublabel: 'Same public feed as the header ticker, for transparency.',
              },
              {
                value: '100%',
                suffix: '',
                label: 'KYC for orders',
                sublabel: 'Customers must be verified (and banks cleared in-app) before trading per platform rules.',
              },
            ].map((stat, i) => (
              <FadeIn key={stat.label} delay={i * 0.1}>
                <StatCard {...stat} />
              </FadeIn>
            ))}
          </div>
          {spotSourceNote && (
            <p className="text-center text-[10px] text-[#555] max-w-2xl mx-auto mt-8 leading-relaxed">{spotSourceNote}</p>
          )}
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section id="features" className="py-28 relative">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C] mb-4">Why Cridora</p>
              <h2 className="text-3xl md:text-5xl font-black leading-tight mb-5">
                <span style={{ color: '#F5F0E8' }}>Built for the</span>{' '}
                <span className="gradient-gold-text">Modern Investor</span>
              </h2>
              <p className="text-[#666] max-w-xl mx-auto text-sm leading-relaxed">
                From Dubai's trading floors to global wallets — Cridora bridges the gap between 
                physical bullion and digital access.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {[
              {
                icon: Shield,
                title: 'Non-Custodial Architecture',
                desc: 'Cridora never holds your metal. All inventory stays with verified UAE bullion vendors. Zero custody risk.',
                color: 'gold',
              },
              {
                icon: TrendingUp,
                title: 'Real-Time Vendor Quotes',
                desc: 'Live pricing directly from vendors with full fee transparency. No hidden spreads or surprise charges.',
                color: 'silver',
              },
              {
                icon: Zap,
                title: 'Instant Purchase & Settlement',
                desc: 'Buy gold in seconds using card payments. Ownership is recorded digitally in your ledger immediately.',
                color: 'copper',
              },
              {
                icon: BarChart2,
                title: 'Guaranteed Sell-Back',
                desc: 'Sell back to the original vendor at disclosed buyback rates. Liquidity is built into the platform.',
                color: 'gold',
              },
              {
                icon: Lock,
                title: 'Per-Vendor Fund Isolation',
                desc: 'Funds are never mixed across vendors. Each vendor operates in a completely isolated financial environment.',
                color: 'silver',
              },
              {
                icon: Globe,
                title: 'Designed for Global Access',
                desc: 'Cross-border users from India, Pakistan, Europe, UK, and the US can participate from day one.',
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

      {/* ── METALS SHOWCASE ─────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden" style={{ background: '#080808' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.2)] to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.2)] to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C] mb-4">The Metals</p>
              <h2 className="text-3xl md:text-5xl font-black text-[#F5F0E8] mb-5">
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
                gradient: 'linear-gradient(135deg, rgba(168,169,173,0.12) 0%, rgba(212,213,217,0.06) 100%)',
                border: 'rgba(168,169,173,0.25)',
                textClass: 'gradient-silver-text',
                icon: '◇',
              },
              {
                name: 'Platinum',
                symbol: 'XPT',
                price: 'Per listing',
                refLabel: 'No global ticker on platform',
                desc: 'Platinum is offered when a verified vendor publishes a product. Pricing is always the vendor’s quoted all-in rate for that line item.',
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
                      <div className="text-[10px] tracking-[0.25em] uppercase text-[#555] mt-1">{metal.symbol}</div>
                    </div>
                    <div className="text-right max-w-[11rem]">
                      <div className="text-sm font-bold text-[#F5F0E8] leading-tight">{metal.price}</div>
                      <div className="text-[10px] text-[#666] font-medium mt-1">{metal.refLabel}</div>
                    </div>
                  </div>
                  <p className="text-sm text-[#666] leading-relaxed mb-6">{metal.desc}</p>
                  <Link to="/marketplace">
                    <button
                      className="w-full py-3 rounded-lg text-xs tracking-widest uppercase font-semibold transition-all duration-300 hover:opacity-90"
                      style={{ background: metal.border, color: '#F5F0E8', border: `1px solid ${metal.border}` }}
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

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section id="how-it-works" className="py-28">
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C] mb-4">The Process</p>
              <h2 className="text-3xl md:text-5xl font-black text-[#F5F0E8] mb-5">
                Simple. Transparent. Secure.
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                num: '01',
                title: 'Complete KYC Verification',
                desc: 'A quick and secure identity verification process to protect all users and comply with UAE AML regulations.',
              },
              {
                num: '02',
                title: 'Browse Real-Time Listings',
                desc: 'See live quotes from multiple verified vendors. Compare pricing, buyback rates, and available inventory.',
              },
              {
                num: '03',
                title: 'Purchase with Confidence',
                desc: 'Pay by card instantly. Your ownership is recorded in your digital ledger, backed by real vendor inventory.',
              },
              {
                num: '04',
                title: 'Hold, Track & Sell Back',
                desc: 'Monitor your portfolio in real-time. Sell back to the original vendor at guaranteed buyback rates anytime.',
              },
            ].map((step, i) => (
              <FadeIn key={step.num} delay={i * 0.12} direction={i % 2 === 0 ? 'right' : 'left'}>
                <div
                  className="card-hover p-7 rounded-xl"
                  style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}
                >
                  <StepCard {...step} />
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST SECTION ───────────────────────────────────── */}
      <section className="py-20" style={{ background: '#080808' }}>
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C] mb-4">Compliance & Security</p>
              <h2 className="text-3xl md:text-4xl font-black text-[#F5F0E8]">
                Trust Is Not a Feature. It's the Foundation.
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Award,
                title: 'Verified Vendors Only',
                points: ['KYB and document checks before going live', 'Listings from verified-vendor accounts only', 'Buyback terms shown on the product', 'Admin tools for KYC, docs, and sell-back flows'],
                color: 'gold',
              },
              {
                icon: Shield,
                title: 'User Protection',
                points: ['Full KYC/KYB process', 'AML transaction monitoring', 'No custody exposure', 'Transparent fee structure'],
                color: 'silver',
              },
              {
                icon: Lock,
                title: 'Platform Security',
                points: ['Bank-grade encryption', 'Per-vendor fund isolation', 'Real-time transaction logs', 'Independent audit trail'],
                color: 'copper',
              },
            ].map((item, i) => {
              const colors = {
                gold: { bg: 'rgba(201,168,76,0.06)', border: 'rgba(201,168,76,0.15)', icon: '#C9A84C' },
                silver: { bg: 'rgba(168,169,173,0.06)', border: 'rgba(168,169,173,0.15)', icon: '#A8A9AD' },
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
                    <h3 className="text-base font-bold mb-4 text-[#F5F0E8]">{item.title}</h3>
                    <ul className="flex flex-col gap-2.5">
                      {item.points.map((p) => (
                        <li key={p} className="flex items-start gap-2.5">
                          <CheckCircle size={13} style={{ color: c.icon }} className="mt-0.5 flex-shrink-0 opacity-80" />
                          <span className="text-sm text-[#666]">{p}</span>
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
            <p className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C] mb-6">Start Today</p>
            <h2 className="text-4xl md:text-6xl font-black leading-tight mb-6">
              <span className="gradient-gold-text">Own Real Metal.</span>
              <br />
              <span style={{ color: '#F5F0E8' }}>From Anywhere.</span>
            </h2>
            <p className="text-[#666] text-base leading-relaxed mb-10 max-w-md mx-auto">
              Create an account, pass verification, then place orders with disclosed pricing and a recorded ledger. 
              Metal sits with the vendor; the platform does not act as a warehouse.
            </p>
            <p className="text-[10px] text-[#555] max-w-lg mx-auto mb-8 leading-relaxed">
              Cridora is software for order flow, compliance gates, and records — not a substitute for your own financial, tax, or regulatory advice.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/marketplace">
                <button className="btn-gold px-10 py-4 rounded-sm text-sm tracking-widest uppercase font-bold flex items-center gap-2.5 group">
                  Open Marketplace
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </button>
              </Link>
              <Link to="/vendors">
                <button className="btn-outline-gold px-10 py-4 rounded-sm text-sm tracking-widest uppercase font-semibold flex items-center gap-2.5">
                  <Users size={15} />
                  For Vendors
                </button>
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>
    </main>
  )
}
