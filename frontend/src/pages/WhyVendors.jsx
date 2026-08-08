import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Search,
  Shield,
  RefreshCw,
  Scale,
  HeartHandshake,
  CheckCircle,
  ArrowRight,
  Sparkles,
  LineChart,
} from 'lucide-react'
import SeoHead from '../components/SeoHead'
import FadeIn from '../components/FadeIn'
import { SITE_ORIGIN } from '../config'

function iconSoftBg(color) {
  if (String(color).includes('var(')) return `color-mix(in srgb, ${color} 12%, transparent)`
  return `${color}18`
}

const colorMap = {
  gold: { bg: 'rgba(232,195,74,0.08)', border: 'rgba(232,195,74,0.2)', icon: 'var(--gold)' },
  silver: { bg: 'var(--silver-08)', border: 'var(--silver-20)', icon: 'var(--silver)' },
  copper: { bg: 'rgba(184,115,51,0.08)', border: 'rgba(184,115,51,0.2)', icon: '#B87333' },
}

const SECTIONS = [
  {
    key: 'compare',
    title: 'Compare Offers Before You Buy',
    icon: Search,
    color: 'gold',
    lead: 'See live rates and peer comparisons in one place — then choose the deal that fits your grams, purity, and budget.',
    bullets: [
      'Clear AED pricing on verified listings',
      'Side-by-side peer rate context',
      'Buy when the number makes sense to you',
    ],
  },
  {
    key: 'trust',
    title: 'Verified Dealers, Not Guesswork',
    icon: Shield,
    color: 'silver',
    lead: 'Shop with KYB-reviewed bullion vendors and KYC-aligned checkout — so trust sits on the marketplace, not a random WhatsApp quote.',
    bullets: [
      'Vendors reviewed before they list',
      'Buyer identity steps when you order',
      'Transparent terms before you commit',
    ],
  },
  {
    key: 'liquidity',
    title: 'Buy Today, Sell-Back Later',
    icon: RefreshCw,
    color: 'copper',
    lead: 'Physical gold with a path to exit — structured buy and sell-back in the same ecosystem, not a one-way purchase.',
    bullets: [
      'Purchase from licensed UAE dealers',
      'Sell-back flows when you need liquidity',
      'Settlement workflows under admin control',
    ],
  },
  {
    key: 'clarity',
    title: 'Know What You Pay',
    icon: LineChart,
    color: 'gold',
    lead: 'Live ticker context, weight presets, and checkout that shows the quote you are locking — fewer surprises at the last step.',
    bullets: ['Live metal context on the storefront', 'Grams ↔ AED that stay in sync'],
  },
  {
    key: 'choice',
    title: 'Your Gold. Your Choice. Your Best Deal.',
    icon: Scale,
    color: 'silver',
    lead:
      'Cridora does not push a single house brand. You compare verified dealers and pick the offer that wins on price, product, and confidence.',
    bullets: [],
    wide: true,
    sideLabel: 'You decide on',
    sideItems: ['Live price vs peers', 'Dealer credibility', 'Purity and weight', 'When to buy or hold'],
  },
]

const AT_A_GLANCE = [
  'Compare verified Dubai / UAE bullion offers',
  'KYC-aligned buying with clear checkout quotes',
  'Buy & sell-back in one trusted marketplace',
  'You choose the dealer — Cridora runs the rails',
]

function SectionCard({ section, index }) {
  const c = colorMap[section.color]
  const Icon = section.icon
  return (
    <FadeIn delay={index * 0.04} className={section.wide ? 'lg:col-span-2' : 'h-full'}>
      <article
        className={`rounded-2xl p-6 sm:p-8 flex flex-col ${section.wide ? '' : 'h-full'}`}
        style={{ background: c.bg, border: `1px solid ${c.border}` }}
      >
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: iconSoftBg(c.icon), border: `1px solid ${c.border}` }}
          >
            <Icon size={20} style={{ color: c.icon }} aria-hidden />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] leading-snug pt-0.5">
            {section.title}
          </h2>
        </div>
        {section.wide ? (
          <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:items-start">
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{section.lead}</p>
            <div className="flex flex-col gap-3 mt-6 lg:mt-0">
              <p className="text-[11px] tracking-[0.15em] uppercase text-[var(--text-dim)]">
                {section.sideLabel || 'You get'}
              </p>
              <ul className="flex flex-col gap-2">
                {(section.sideItems || []).map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                    <CheckCircle size={14} style={{ color: c.icon }} className="opacity-80 flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <>
            {section.lead && (
              <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-5">{section.lead}</p>
            )}
            {section.bullets.length > 0 && (
              <ul className="flex flex-col gap-2.5">
                {section.bullets.map((p) => (
                  <li key={p} className="flex items-start gap-2.5">
                    <CheckCircle size={14} style={{ color: c.icon }} className="mt-0.5 flex-shrink-0 opacity-80" />
                    <span className="text-sm text-[var(--text-soft)]">{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </article>
    </FadeIn>
  )
}

export default function WhyVendors() {
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '28%'])

  const whyBuyersLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Why Cridora — Buy Gold from Verified UAE Dealers',
    description:
      'Why gold buyers and investors use Cridora: compare verified Dubai bullion dealers, clear AED pricing, KYC-aligned checkout, and buy & sell-back in one marketplace.',
    url: `${SITE_ORIGIN}/why-vendors`,
  }

  return (
    <>
      <SeoHead
        title="Why Cridora — Buy Gold from Verified UAE Dealers"
        description="Why Cridora is useful for gold buyers and investors: compare verified UAE bullion offers, see clear AED pricing, buy with confidence, and access sell-back when you need liquidity."
        path="/why-vendors"
        jsonLd={whyBuyersLd}
      />
      <main className="min-w-0 overflow-x-hidden">
      <section
        ref={heroRef}
        className="relative pt-8 md:pt-[calc(6rem+env(safe-area-inset-top,0px))] pb-20 md:pb-28 overflow-hidden"
      >
        <motion.div style={{ y: heroY }} className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[min(100vw,56rem)] h-[min(100vw,56rem)] max-w-[900px] max-h-[900px] rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, var(--gold) 0%, #B87333 50%, transparent 70%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(232,195,74,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(232,195,74,0.5) 1px, transparent 1px)',
              backgroundSize: '70px 70px',
            }}
          />
        </motion.div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-left min-w-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="inline-flex items-center gap-2 mb-6 lg:mb-7 px-4 py-2 rounded-full text-[11px] tracking-[0.2em] uppercase"
                style={{ background: 'rgba(232,195,74,0.08)', border: '1px solid rgba(232,195,74,0.2)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
                <span className="gradient-gold-text font-semibold">For buyers &amp; investors</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 36 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.75 }}
                className="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-black leading-[1.05] tracking-tight mb-5 lg:mb-6"
              >
                <span style={{ color: 'var(--text-primary)' }}>Why Buyers Choose </span>
                <span className="gradient-gold-text">Cridora</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.65 }}
                className="text-[var(--text-muted)] text-base md:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0 mb-10"
              >
                Compare verified UAE bullion dealers, lock a clear AED quote, and buy physical gold with
                confidence — then sell back when you need liquidity.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                className="flex flex-col sm:flex-row flex-wrap items-center justify-center lg:justify-start gap-4"
              >
                <Link
                  to="/marketplace"
                  className="inline-flex items-center justify-center gap-2 btn-gold"
                >
                  Start buying gold
                  <ArrowRight size={14} aria-hidden />
                </Link>
                <Link
                  to="/how-it-works"
                  className="text-sm text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors underline-offset-4 hover:underline"
                >
                  How it works
                </Link>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35, duration: 0.75 }}
              className="rounded-2xl p-6 sm:p-8"
              style={{ background: 'rgba(232,195,74,0.05)', border: '1px solid rgba(232,195,74,0.14)' }}
            >
              <div className="flex items-center gap-3 mb-6">
                <Sparkles size={18} className="text-[var(--gold)] flex-shrink-0" aria-hidden />
                <h2 className="text-sm font-bold tracking-widest uppercase text-[var(--text-primary)] leading-snug">
                  At a glance
                </h2>
              </div>
              <ul className="flex flex-col gap-4">
                {AT_A_GLANCE.map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <CheckCircle size={16} className="text-[var(--gold)] flex-shrink-0 mt-0.5 opacity-85" />
                    <span className="text-sm text-[var(--text-soft)] leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32 relative" style={{ background: 'var(--section-wash-a)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
            {SECTIONS.map((s, i) => (
              <SectionCard key={s.key} section={s} index={i} />
            ))}
          </div>

          <FadeIn delay={0.06}>
            <article
              className="rounded-2xl p-6 sm:p-8 mt-12 md:mt-16 max-w-2xl mx-auto text-center"
              style={{
                background: 'var(--silver-08)',
                border: '1px solid var(--silver-20)',
              }}
            >
              <div className="flex items-center justify-center gap-3 mb-4">
                <HeartHandshake size={20} className="text-[var(--silver)]" aria-hidden />
                <h2 className="text-lg font-bold text-[var(--text-primary)] leading-snug">
                  We connect you to dealers — we don&apos;t replace them
                </h2>
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Cridora doesn&apos;t warehouse your gold as a house brand. We bring verified vendors and
                verified buyers together so you can compare, choose, and buy with confidence.
              </p>
            </article>
          </FadeIn>

          <FadeIn delay={0.08}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-14 md:pt-16">
              <Link
                to="/marketplace"
                className="inline-flex items-center justify-center gap-2 btn-gold"
              >
                Open marketplace
                <ArrowRight size={14} aria-hidden />
              </Link>
              <Link
                to="/signup"
                className="text-sm text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors underline-offset-4 hover:underline"
              >
                Create a buyer account
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
    </>
  )
}
