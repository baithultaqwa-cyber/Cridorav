import { useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  UserCheck, Search, CreditCard, BarChart2, ArrowRight,
  CheckCircle, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react'
import SeoHead from '../components/SeoHead'
import FadeIn from '../components/FadeIn'
import { SITE_ORIGIN } from '../config'

function iconSoftBg(color) {
  if (String(color).includes('var(')) return `color-mix(in srgb, ${color} 12%, transparent)`
  return `${color}18`
}

/* ─── Steps data ─────────────────────────────────────────────── */
const steps = [
  {
    num: '01',
    icon: UserCheck,
    title: 'Create & Verify Your Account',
    subtitle: 'KYC / Identity Verification',
    color: 'gold',
    desc: 'Sign up and complete a quick identity check. We screen customers so trading can follow clear KYC controls.',
    points: [
      'Government ID and selfie check',
      'Typically under 5 minutes',
    ],
  },
  {
    num: '02',
    icon: Search,
    title: 'Browse Real-Time Listings',
    subtitle: 'Live Vendor Quotes',
    color: 'silver',
    desc: 'Explore live listings from verified UAE bullion vendors. Compare pricing, weight, VAT status, and buyback rates in one view.',
    points: [
      'Filter by metal and compare rates',
      'Buyback rates shown before you buy',
    ],
  },
  {
    num: '03',
    icon: CreditCard,
    title: 'Purchase with Instant Settlement',
    subtitle: 'Secure Payment & Ledger Recording',
    color: 'copper',
    desc: 'Pay in AED through Stripe Checkout when enabled. Confirmation records ownership in your ledger; inventory stays with the vendor.',
    points: [
      'Fees disclosed before you confirm',
      'Vendor-isolated settlements',
    ],
  },
  {
    num: '04',
    icon: BarChart2,
    title: 'Hold & Track Your Portfolio',
    subtitle: 'Dashboard & Real-Time Valuation',
    color: 'gold',
    desc: 'See weight, value, purchase price, and gains for gold and silver in one dashboard.',
    points: [
      'Live spot valuation',
      'Transaction history',
    ],
  },
  {
    num: '05',
    icon: RefreshCw,
    title: 'Sell Back at Guaranteed Rates',
    subtitle: 'Built-In Liquidity Mechanism',
    color: 'silver',
    desc: 'Sell holdings back to the original vendor at the buyback rate disclosed at purchase — one click, no finding a buyer.',
    points: [
      'Rate locked at purchase',
      'Settlement in 1–3 business days',
    ],
  },
]

/* ─── FAQ data ───────────────────────────────────────────────── */
const faqs = [
  {
    q: 'Is Cridora a bank?',
    a: 'No — and that\'s by design. Cridora is an ecommerce platform, not a financial institution. We connect you to licensed UAE bullion dealers and record every order transparently. We\'re not a bank, broker-dealer, or metal custodian.',
  },
  {
    q: 'Where is my gold actually kept?',
    a: 'Your gold is held by the dealer you bought it from, in their own vault. Cridora never takes custody of your metal and does not insure it — we connect you to the dealer.',
  },
  {
    q: 'Can I have my gold delivered to me?',
    a: 'Physical delivery isn\'t available yet — today you hold a verified digital ownership record, backed by real metal at the dealer\'s vault. Optional delivery is on our roadmap.',
  },
  {
    q: 'How does card payment work?',
    a: 'When card payment is enabled, you pay securely by card at checkout. Your order confirms once payment clears — card details never touch Cridora\'s servers.',
  },
  {
    q: 'How is pricing determined?',
    a: 'Each dealer sets their own buy and sell prices, anchored to live spot. Platform fees and costs are fully disclosed before you pay.',
  },
  {
    q: 'How long does identity verification take?',
    a: 'Most customers are verified in 5–10 minutes. Manual review can take up to 24 hours — we email you at every stage.',
  },
]

/* ─── Step pill component ────────────────────────────────────── */
const colorMap = {
  gold: { bg: 'rgba(232,195,74,0.08)', border: 'rgba(232,195,74,0.2)', icon: 'var(--gold)', num: 'rgba(232,195,74,0.15)', numText: 'var(--gold)', line: 'var(--gold)' },
  silver: { bg: 'var(--silver-08)', border: 'var(--silver-20)', icon: 'var(--silver)', num: 'var(--silver-15)', numText: 'var(--text-primary)', line: 'var(--silver)' },
  copper: { bg: 'rgba(184,115,51,0.08)', border: 'rgba(184,115,51,0.2)', icon: '#B87333', num: 'rgba(184,115,51,0.15)', numText: '#DA8A67', line: '#B87333' },
}

function StepBlock({ step, index }) {
  const c = colorMap[step.color]
  const isEven = index % 2 === 0

  return (
    <div
      className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-start"
    >
      {/* Number + line (desktop) */}
      <div className={`hidden lg:flex flex-col items-center absolute left-1/2 -translate-x-1/2 top-0 z-10`}>
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black border-2"
          style={{ background: c.num, borderColor: c.line, color: c.numText }}
        >
          {step.num}
        </div>
      </div>

      {/* Content — alternating sides */}
      <div className={isEven ? 'lg:pr-20' : 'lg:col-start-2 lg:pl-20'}>
        <div
          className="rounded-2xl p-8"
          style={{ background: c.bg, border: `1px solid ${c.border}` }}
        >
          {/* Mobile number */}
          <div className="flex items-center gap-3 mb-5 lg:hidden">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black"
              style={{ background: c.num, color: c.numText }}
            >
              {step.num}
            </div>
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: c.icon }}>
              {step.subtitle}
            </span>
          </div>

          <div className="hidden lg:block mb-2">
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: c.icon }}>
              {step.subtitle}
            </span>
          </div>

          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: iconSoftBg(c.icon), border: `1px solid ${c.border}` }}
            >
              <step.icon size={18} style={{ color: c.icon }} />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-primary)] leading-snug">{step.title}</h3>
          </div>

          <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-5">{step.desc}</p>

          <ul className="flex flex-col gap-2.5">
            {step.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <CheckCircle size={13} style={{ color: c.icon }} className="mt-0.5 flex-shrink-0 opacity-80" />
                <span className="text-sm text-[var(--text-soft)]">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Spacer for alternating layout */}
      {!isEven && <div className="hidden lg:block lg:col-start-1 lg:row-start-1" />}
    </div>
  )
}

/* ─── FAQ accordion item ─────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="border-b"
      style={{ borderColor: 'rgba(232,195,74,0.08)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 py-5 text-left group"
      >
        <span className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--gold)] transition-colors leading-relaxed">
          {q}
        </span>
        <span className="flex-shrink-0 mt-0.5">
          {open
            ? <ChevronUp size={16} className="text-[var(--gold)]" />
            : <ChevronDown size={16} className="text-[var(--text-dim)]" />
          }
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <p className="pb-5 text-sm text-[var(--text-muted)] leading-relaxed">{a}</p>
      </motion.div>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function HowItWorks() {
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])

  const howItWorksLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'How to Buy Gold in UAE — Cridora',
    description:
      'Learn how to buy gold in UAE via Cridora: KYC for retail buyers, vendor KYB verification, AED checkout, holdings, compliant sell-back, and Dubai bullion dealer transparency.',
    url: `${SITE_ORIGIN}/how-it-works`,
  }

  return (
    <>
      <SeoHead
        title="How Buying Gold on Cridora Works | UAE Gold Investment Platform"
        description="See exactly how Cridora works: verify your identity, compare live rates from licensed UAE dealers, buy with transparent pricing, and sell back anytime — guaranteed."
        path="/how-it-works"
        jsonLd={howItWorksLd}
      />
      <main className="min-w-0 overflow-x-hidden">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative pt-8 md:pt-32 pb-20 md:pb-28 overflow-hidden">
        <motion.div
          style={{ y: heroY }}
          className="absolute inset-0 pointer-events-none"
        >
          <div
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, var(--gold) 0%, #B87333 50%, transparent 70%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: 'linear-gradient(rgba(232,195,74,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(232,195,74,0.5) 1px, transparent 1px)',
              backgroundSize: '70px 70px',
            }}
          />
        </motion.div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full text-[11px] tracking-[0.2em] uppercase"
            style={{ background: 'rgba(232,195,74,0.08)', border: '1px solid rgba(232,195,74,0.2)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
            <span className="gradient-gold-text font-semibold">5 steps</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.8 }}
            className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-6"
          >
            <span style={{ color: 'var(--text-primary)' }}>How</span>{' '}
            <span className="gradient-gold-text">Cridora</span>
            <br />
            <span style={{ color: 'var(--text-primary)' }}>Works</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7 }}
            className="text-[var(--text-muted)] text-base md:text-lg leading-relaxed max-w-xl mx-auto mb-12"
          >
            From verified signup to sell-back — five calm steps.
          </motion.p>

          {/* Process summary pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {steps.map((s) => (
              <div
                key={s.num}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] tracking-widest uppercase font-semibold"
                style={{ background: colorMap[s.color].num, color: colorMap[s.color].numText, border: `1px solid ${colorMap[s.color].border}` }}
              >
                <span>{s.num}</span>
                <span className="hidden sm:inline">{s.title.split(' ').slice(0, 2).join(' ')}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── STEPS ────────────────────────────────────────────── */}
      <section className="py-24 md:py-32 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">

          {/* Vertical connector line (desktop) */}
          <div className="hidden lg:block absolute left-1/2 top-28 bottom-28 w-px -translate-x-1/2"
            style={{ background: 'linear-gradient(to bottom, transparent, rgba(232,195,74,0.2) 10%, rgba(232,195,74,0.2) 90%, transparent)' }}
          />

          <div className="flex flex-col gap-16 md:gap-20">
            {steps.map((step, i) => (
              <StepBlock key={step.num} step={step} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">Questions</p>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">
                Frequently Asked
              </h2>
            </div>
          </FadeIn>

          <div>
            {faqs.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: 'var(--section-wash-b)' }}>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 50%, var(--gold) 0%, transparent 70%)' }}
        />
        <FadeIn>
          <div className="max-w-2xl mx-auto text-center px-6">
            <h2 className="text-3xl md:text-5xl font-black mb-5">
              <span className="gradient-gold-text">Ready to Start?</span>
            </h2>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-10 max-w-md mx-auto">
              Sign up, verify, and browse live listings — on your own pace.
            </p>
            <Link to="/marketplace">
              <button className="btn-gold inline-flex items-center gap-2.5 group">
                Explore Marketplace
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
          </div>
        </FadeIn>
      </section>
    </main>
    </>
  )
}
