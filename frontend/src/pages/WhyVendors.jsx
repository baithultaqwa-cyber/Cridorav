import { useRef } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
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
import PublicTrustBar from '../components/PublicTrustBar'

function iconSoftBg(color) {
  if (String(color).includes('var(')) return `color-mix(in srgb, ${color} 12%, transparent)`
  return `${color}18`
}

function FadeIn({ children, delay = 0, direction = 'up', className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: 0,
        y: direction === 'up' ? 40 : direction === 'down' ? -40 : 0,
        x: direction === 'left' ? 40 : direction === 'right' ? -40 : 0,
      }}
      animate={inView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const colorMap = {
  gold: { bg: 'rgba(201,168,76,0.08)', border: 'rgba(201,168,76,0.2)', icon: '#C9A84C' },
  silver: { bg: 'var(--silver-08)', border: 'var(--silver-20)', icon: 'var(--silver)' },
  copper: { bg: 'rgba(184,115,51,0.08)', border: 'rgba(184,115,51,0.2)', icon: '#B87333' },
}

const SECTIONS = [
  {
    key: 'buyers',
    title: 'More Buyers, Without More Marketing',
    icon: Users,
    color: 'gold',
    lead:
      'A standalone vendor app only reaches customers you already know or can acquire through advertising. On Cridora, your products are visible to a larger pool of verified buyers across the platform.',
    bullets: [
      'Reduced dependency on ads and promotions',
      'Higher discovery from active bullion buyers',
      'More consistent demand, even during low seasons',
    ],
  },
  {
    key: 'trust',
    title: 'Shared Trust, Not Individual Reputation',
    icon: Shield,
    color: 'silver',
    lead: 'In bullion trading, trust is everything. Cridora provides a platform-level trust system through:',
    bullets: [
      'KYC-verified customers',
      'KYB-verified vendors',
      'Bank verification and compliance checks',
      'Admin-reviewed onboarding and approvals',
    ],
    footer:
      'Instead of every vendor building trust alone, customers trust the platform’s verification layer, and that trust extends to all listed vendors.',
  },
  {
    key: 'liquidity',
    title: 'Built-In Liquidity Through Buy & Sell-Back',
    icon: RefreshCw,
    color: 'copper',
    lead: 'One of the biggest challenges in bullion trading is liquidity — especially buyback reliability. Cridora enables a structured system where:',
    bullets: [
      'Customers can buy and sell back within the same ecosystem',
      'Vendors participate in sell-back flows',
      'Admin-controlled workflows help ensure settlement consistency',
    ],
    footer:
      'This creates a more stable and predictable trading environment compared to isolated vendor systems.',
  },
  {
    key: 'ops',
    title: 'Lower Operational Burden',
    icon: Briefcase,
    color: 'gold',
    leadBefore:
      'Running a standalone bullion app requires maintaining software infrastructure, managing compliance workflows, handling payments, disputes, and records, and building pricing and catalog systems.',
    lead: 'Cridora centralizes these systems so vendors can focus on their core business:',
    bullets: ['Sourcing, pricing, and fulfilling bullion orders.'],
  },
  {
    key: 'product',
    title: 'Compete on Product, Not Technology',
    icon: Scale,
    color: 'silver',
    lead:
      'On Cridora, vendors don’t need to compete by building better apps. Instead, they compete on product quality, pricing strategy, service reliability, and customer relationships. The platform handles the rest — technology, compliance structure, and transaction flow.',
    bullets: [],
    wide: true,
  },
]

const AT_A_GLANCE = [
  'Marketplace visibility to verified buyers — not just your own funnel',
  'Platform KYC, KYB, and compliance workflows you don’t rebuild per app',
  'Structured buy & sell-back liquidity inside one ecosystem',
  'Operations for payments, catalog, and records — you focus on metal',
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
            {section.leadBefore && (
              <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-4">{section.leadBefore}</p>
            )}
            {section.lead && (
              <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-5">{section.lead}</p>
            )}
            {section.bullets.length > 0 && (
              <ul className="flex flex-col gap-2.5 mb-4">
                {section.bullets.map((p) => (
                  <li key={p} className="flex items-start gap-2.5">
                    <CheckCircle size={14} style={{ color: c.icon }} className="mt-0.5 flex-shrink-0 opacity-80" />
                    <span className="text-sm text-[var(--text-soft)]">{p}</span>
                  </li>
                ))}
              </ul>
            )}
            {section.footer && (
              <p
                className="text-sm text-[var(--text-dim)] leading-relaxed border-t pt-4 mt-auto"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
              >
                {section.footer}
              </p>
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

  return (
    <main className="min-w-0 overflow-x-hidden">
      <section
        ref={heroRef}
        className="relative pt-[calc(6rem+env(safe-area-inset-top,0px))] pb-14 md:pb-20 overflow-hidden"
      >
        <motion.div style={{ y: heroY }} className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[min(100vw,56rem)] h-[min(100vw,56rem)] max-w-[900px] max-h-[900px] rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, #C9A84C 0%, #B87333 50%, transparent 70%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)',
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
                style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
                <span className="gradient-gold-text font-semibold">For vendors · Marketplace · Trust · Liquidity</span>
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
                className="text-[var(--text-muted)] text-base md:text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0 mb-4"
              >
                Most bullion businesses already have their own app, customer base, and sales process. So the natural
                question is: why join Cridora at all?
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.48, duration: 0.65 }}
                className="text-[var(--text-soft)] text-base md:text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0 mb-8 font-medium"
              >
                The answer is simple — Cridora is not another app. It is a shared marketplace and liquidity network built
                specifically for the bullion industry.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.55 }}
                className="max-w-2xl mx-auto lg:mx-0 mb-8"
              >
                <PublicTrustBar dense />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center lg:justify-start gap-3"
              >
                <Link
                  to="/vendors#apply"
                  className="inline-flex items-center justify-center gap-2 btn-gold text-xs px-6 py-3.5 rounded-sm tracking-widest uppercase font-semibold"
                >
                  Apply as a vendor
                  <ArrowRight size={14} aria-hidden />
                </Link>
                <Link
                  to="/vendors"
                  className="inline-flex items-center justify-center btn-outline-gold text-xs px-6 py-3.5 rounded-sm tracking-widest uppercase font-semibold"
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
              style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.14)' }}
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

      <section className="py-12 md:py-20 relative" style={{ background: 'var(--section-wash-a)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {SECTIONS.map((s, i) => (
              <SectionCard key={s.key} section={s} index={i} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mt-6 lg:mt-8">
            <FadeIn>
              <div
                className="rounded-2xl p-6 sm:p-8 h-full flex flex-col"
                style={{
                  background: 'rgba(201,168,76,0.06)',
                  border: '1px solid rgba(201,168,76,0.22)',
                }}
              >
                <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] mb-4">Why This Matters</h2>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6 flex-1">
                  A single vendor app is limited by its own customer base. Cridora connects you to a larger trading
                  ecosystem where demand, trust, and liquidity are shared.
                </p>
                <p className="text-base md:text-lg font-semibold gradient-gold-text leading-snug">
                  In simple terms: Your reach expands beyond your own customers, without losing control of your business.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.06}>
              <article
                className="rounded-2xl p-6 sm:p-8 h-full flex flex-col gap-3"
                style={{
                  background: 'var(--silver-08)',
                  border: '1px solid var(--silver-20)',
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: iconSoftBg('var(--silver)'),
                      border: '1px solid var(--silver-20)',
                    }}
                  >
                    <HeartHandshake size={20} className="text-[var(--silver)]" aria-hidden />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] leading-snug pt-0.5">
                    Cridora is Not Replacing Vendors
                  </h2>
                </div>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  Cridora is designed to strengthen bullion businesses, not replace them.
                </p>
                <p className="text-sm text-[var(--text-soft)] leading-relaxed font-medium">We don’t sell gold.</p>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  We connect verified vendors with verified buyers in a structured, compliant marketplace.
                </p>
                <p
                  className="text-sm text-[var(--text-primary)] leading-relaxed font-semibold pt-3 mt-auto border-t"
                  style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  Your business stays yours — Cridora simply expands what it can reach.
                </p>
              </article>
            </FadeIn>
          </div>

          <FadeIn delay={0.08}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 pt-10">
              <Link
                to="/vendors#apply"
                className="inline-flex items-center justify-center gap-2 btn-gold text-xs px-6 py-3 rounded-sm tracking-widest uppercase font-semibold"
              >
                Apply as a vendor
                <ArrowRight size={14} aria-hidden />
              </Link>
              <Link
                to="/vendors"
                className="inline-flex items-center justify-center btn-outline-gold text-xs px-6 py-3 rounded-sm tracking-widest uppercase font-semibold"
              >
                Vendor program
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  )
}
