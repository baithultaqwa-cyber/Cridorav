import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Users,
  Shield,
  RefreshCw,
  Briefcase,
  Scale,
  HeartHandshake,
  CheckCircle,
  ArrowRight,
  Sparkles,
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
    key: 'buyers',
    title: 'More Buyers, Without More Marketing',
    icon: Users,
    color: 'gold',
    lead: 'Your listings reach verified buyers across the platform — not only the customers you already know.',
    bullets: [
      'Less dependency on ads',
      'Discovery from active bullion buyers',
      'Demand that is not only seasonal',
    ],
  },
  {
    key: 'trust',
    title: 'Shared Trust, Not Individual Reputation',
    icon: Shield,
    color: 'silver',
    lead: 'Platform-level verification so customers trust the marketplace — and that trust extends to every listed vendor.',
    bullets: [
      'KYC-verified customers',
      'KYB-verified vendors',
      'Admin-reviewed onboarding',
    ],
  },
  {
    key: 'liquidity',
    title: 'Built-In Liquidity Through Buy & Sell-Back',
    icon: RefreshCw,
    color: 'copper',
    lead: 'Structured buy and sell-back inside one ecosystem — more predictable than isolated vendor systems.',
    bullets: [
      'Buy and sell-back in the same place',
      'Vendors participate in sell-back flows',
      'Admin-controlled settlement workflows',
    ],
  },
  {
    key: 'ops',
    title: 'Lower Operational Burden',
    icon: Briefcase,
    color: 'gold',
    lead: 'Compliance, payments, disputes, and catalog systems sit on the platform so you can focus on sourcing, pricing, and fulfilment.',
    bullets: ['You keep control of metal and pricing.'],
  },
  {
    key: 'product',
    title: 'Compete on Product, Not Technology',
    icon: Scale,
    color: 'silver',
    lead:
      'Compete on quality, pricing, service, and relationships. Cridora handles technology, compliance structure, and transaction flow.',
    bullets: [],
    wide: true,
  },
]

const AT_A_GLANCE = [
  'Marketplace visibility to verified buyers',
  'KYC, KYB, and compliance workflows built in',
  'Buy & sell-back liquidity in one ecosystem',
  'You focus on metal — platform runs the desk',
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
              <p className="text-[11px] tracking-[0.15em] uppercase text-[var(--text-dim)]">Compete on</p>
              <ul className="flex flex-col gap-2">
                {['Product quality', 'Pricing strategy', 'Service reliability', 'Customer relationships'].map((p) => (
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

  const whyVendorsLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'List Your Gold on Cridora — UAE Bullion Vendors',
    description:
      'UAE bullion dealer marketplace onboarding: KYB storefronts, AED pricing tooling, Stripe-ready checkout for customers, treasury and sell-back desk workflows.',
    url: `${SITE_ORIGIN}/why-vendors`,
  }

  return (
    <>
      <SeoHead
        title="List Your Gold on Cridora — UAE Bullion Vendors"
        description="List physical gold UAE inventory on Cridora: KYB onboarding for Dubai and UAE dealers, AED catalog and fees, treasury panels, Stripe Checkout when enabled, and buyer KYC-aligned retail demand."
        path="/why-vendors"
        jsonLd={whyVendorsLd}
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
                <span className="gradient-gold-text font-semibold">For vendors</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 36 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.75 }}
                className="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-black leading-[1.05] tracking-tight mb-5 lg:mb-6"
              >
                <span style={{ color: 'var(--text-primary)' }}>Why Vendors Choose </span>
                <span className="gradient-gold-text">Cridora</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.65 }}
                className="text-[var(--text-muted)] text-base md:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0 mb-10"
              >
                Not another app — a shared marketplace and liquidity network for bullion dealers.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                className="flex flex-col sm:flex-row flex-wrap items-center justify-center lg:justify-start gap-4"
              >
                <Link
                  to="/vendors#apply"
                  className="inline-flex items-center justify-center gap-2 btn-gold"
                >
                  Apply as a vendor
                  <ArrowRight size={14} aria-hidden />
                </Link>
                <Link
                  to="/vendors"
                  className="text-sm text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors underline-offset-4 hover:underline"
                >
                  Vendor program
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
                  We strengthen vendors — we don&apos;t replace them
                </h2>
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Cridora doesn&apos;t sell gold. We connect verified vendors with verified buyers. Your business stays yours.
              </p>
            </article>
          </FadeIn>

          <FadeIn delay={0.08}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-14 md:pt-16">
              <Link
                to="/vendors#apply"
                className="inline-flex items-center justify-center gap-2 btn-gold"
              >
                Apply as a vendor
                <ArrowRight size={14} aria-hidden />
              </Link>
              <Link
                to="/vendors"
                className="text-sm text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors underline-offset-4 hover:underline"
              >
                Vendor program
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
    </>
  )
}
