import { useRef, useState } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  UserCheck, Search, CreditCard, BarChart2, ArrowRight,
  Shield, Lock, Zap, CheckCircle, ChevronDown, ChevronUp,
  FileText, Globe, RefreshCw, TrendingUp, AlertCircle
} from 'lucide-react'

/* ─── FadeIn ────────────────────────────────────────────────── */
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

/* ─── Steps data ─────────────────────────────────────────────── */
const steps = [
  {
    num: '01',
    icon: UserCheck,
    title: 'Create & Verify Your Account',
    subtitle: 'KYC / Identity Verification',
    color: 'gold',
    desc: 'Sign up with your email and complete a fast, secure identity verification. Cridora is built for compliance: we screen customers and vendors so that trading can follow clear know-your-customer and anti–money-laundering-style controls appropriate to a multi-sided marketplace (exact rules depend on your operator’s program).',
    points: [
      'Government-issued ID (passport or national ID)',
      'Selfie liveness check',
      'Address verification',
      'Typically completed in under 5 minutes',
    ],
    note: 'Your documents are encrypted and handled in accordance with UAE data protection standards.',
  },
  {
    num: '02',
    icon: Search,
    title: 'Browse Real-Time Listings',
    subtitle: 'Live Vendor Quotes',
    color: 'silver',
    desc: 'Once verified, explore live listings from multiple verified UAE bullion vendors. Every listing shows real-time pricing, the vendor\'s identity, available weight, VAT status, and the guaranteed buyback rate — all in one view.',
    points: [
      'Filter by metal type: Gold, Silver, Platinum',
      'Compare rate-per-gram across vendors',
      'See buyback rates before you buy',
      'VAT-inclusive and exclusive options clearly labelled',
    ],
    note: 'Vendors pass Cridora KYB (Know Your Business) and document checks. Individual listings may also reference their own licences; verify details on the product or with the vendor.',
  },
  {
    num: '03',
    icon: CreditCard,
    title: 'Purchase with Instant Settlement',
    subtitle: 'Secure Payment & Ledger Recording',
    color: 'copper',
    desc: 'Select your lot and pay instantly by card. The moment your payment is confirmed, ownership of the metal is recorded in your digital ledger — backed by the physical inventory held by the vendor. No waiting, no paperwork.',
    points: [
      'Visa, Mastercard, and international cards accepted',
      'Instant ledger entry upon payment confirmation',
      'Ownership certificate issued digitally',
      'Funds flow directly — not pooled across vendors',
    ],
    note: 'Cridora does not hold or custody your metal. The vendor retains physical possession under contractual obligation.',
  },
  {
    num: '04',
    icon: BarChart2,
    title: 'Hold & Track Your Portfolio',
    subtitle: 'Dashboard & Real-Time Valuation',
    color: 'gold',
    desc: 'Your dashboard gives you a real-time view of everything you own — weight, current value, purchase price, and unrealised gains. Track multiple metals from multiple vendors in one clean interface.',
    points: [
      'Real-time spot price valuation',
      'Unrealised P&L per holding',
      'Transaction history and certificates',
      'Multi-vendor, multi-metal portfolio view',
    ],
    note: 'Portfolio data is updated continuously using live market pricing.',
  },
  {
    num: '05',
    icon: RefreshCw,
    title: 'Sell Back at Guaranteed Rates',
    subtitle: 'Built-In Liquidity Mechanism',
    color: 'silver',
    desc: 'When you\'re ready to exit, sell your holdings back to the original vendor at the buyback rate that was disclosed at the time of purchase. No need to find a buyer, no market friction — just a single click.',
    points: [
      'Sell-back rate locked in at time of purchase',
      'Settlement processed within 1–3 business days',
      'Proceeds returned to your registered payment method',
      'Full transaction record maintained for tax/audit purposes',
    ],
    note: 'Cridora\'s MVP guarantees sell-back to the original vendor only. Future versions will include secondary market options.',
  },
]

/* ─── FAQ data ───────────────────────────────────────────────── */
const faqs = [
  {
    q: 'Is Cridora a bank or financial institution?',
    a: 'No. Cridora is software that connects buyers and bullion vendors and records order and ledger data. The platform is not a bank, broker-dealer, or metal custodian, and it does not give investment or legal advice.',
  },
  {
    q: 'Is Cridora a licensed exchange or “regulated fintech” in a specific form?',
    a: 'The product is designed with separations of duties: vendors hold stock, the platform enforces KYC/KYB and workflow rules, and your contract is with the product’s operator for your deployment. Public pages describe capabilities; for licensing, speak with qualified counsel in your market.',
  },
  {
    q: 'Where is my metal physically stored?',
    a: 'Physical metal is held by the vendor from whom you purchased. Each vendor maintains their own insured, audited vault. Cridora does not operate any storage facilities.',
  },
  {
    q: 'What happens if a vendor goes out of business?',
    a: 'Vendor contracts include obligations to maintain sufficient inventory backing all issued lots. Regular audits are conducted. In the event of a vendor failure, Cridora\'s dispute resolution process is activated to protect buyer holdings.',
  },
  {
    q: 'Can I take physical delivery of my metal?',
    a: 'Physical delivery is not available in the MVP. Users hold digital ownership records. Future releases will include optional physical delivery arrangements with vendors.',
  },
  {
    q: 'What currencies are supported for payment?',
    a: 'Payments are processed in USD and AED at launch. Additional currencies are planned based on demand from key markets (GBP, EUR, INR, PKR).',
  },
  {
    q: 'How is pricing determined?',
    a: 'Each vendor sets their own buy and sell prices, anchored to live spot prices. The spread and fees are fully disclosed before purchase. Cridora does not manipulate or add hidden margins.',
  },
  {
    q: 'Is there a minimum purchase amount?',
    a: 'Minimum purchase depends on the vendor\'s listed lot size. Some vendors offer small-denomination lots starting from 1 gram. Check individual listings for details.',
  },
  {
    q: 'How long does the KYC process take?',
    a: 'KYC is typically completed within 5–10 minutes for automated approvals. In some cases, manual review may take up to 24 hours. You will be notified by email at each stage.',
  },
]

/* ─── Step pill component ────────────────────────────────────── */
const colorMap = {
  gold: { bg: 'rgba(201,168,76,0.08)', border: 'rgba(201,168,76,0.2)', icon: '#C9A84C', num: 'rgba(201,168,76,0.15)', numText: '#C9A84C', line: '#C9A84C' },
  silver: { bg: 'rgba(168,169,173,0.08)', border: 'rgba(168,169,173,0.2)', icon: '#A8A9AD', num: 'rgba(168,169,173,0.15)', numText: '#D4D5D9', line: '#A8A9AD' },
  copper: { bg: 'rgba(184,115,51,0.08)', border: 'rgba(184,115,51,0.2)', icon: '#B87333', num: 'rgba(184,115,51,0.15)', numText: '#DA8A67', line: '#B87333' },
}

function StepBlock({ step, index }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const c = colorMap[step.color]
  const isEven = index % 2 === 0

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: isEven ? -50 : 50 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.75, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
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
              style={{ background: `${c.icon}18`, border: `1px solid ${c.border}` }}
            >
              <step.icon size={18} style={{ color: c.icon }} />
            </div>
            <h3 className="text-xl font-bold text-[#F5F0E8] leading-snug">{step.title}</h3>
          </div>

          <p className="text-sm text-[#666] leading-relaxed mb-5">{step.desc}</p>

          <ul className="flex flex-col gap-2.5 mb-5">
            {step.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <CheckCircle size={13} style={{ color: c.icon }} className="mt-0.5 flex-shrink-0 opacity-80" />
                <span className="text-sm text-[#888]">{p}</span>
              </li>
            ))}
          </ul>

          <div
            className="flex items-start gap-2.5 p-3 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <AlertCircle size={13} className="text-[#555] flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#555] leading-relaxed">{step.note}</p>
          </div>
        </div>
      </div>

      {/* Spacer for alternating layout */}
      {!isEven && <div className="hidden lg:block lg:col-start-1 lg:row-start-1" />}
    </motion.div>
  )
}

/* ─── FAQ accordion item ─────────────────────────────────────── */
function FaqItem({ q, a, index }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.5 }}
      className="border-b"
      style={{ borderColor: 'rgba(201,168,76,0.08)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 py-5 text-left group"
      >
        <span className="text-sm font-semibold text-[#D0C8BB] group-hover:text-[#C9A84C] transition-colors leading-relaxed">
          {q}
        </span>
        <span className="flex-shrink-0 mt-0.5">
          {open
            ? <ChevronUp size={16} className="text-[#C9A84C]" />
            : <ChevronDown size={16} className="text-[#555]" />
          }
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <p className="pb-5 text-sm text-[#666] leading-relaxed">{a}</p>
      </motion.div>
    </motion.div>
  )
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function HowItWorks() {
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])

  return (
    <main className="min-w-0 overflow-x-hidden">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative pt-32 pb-24 overflow-hidden">
        <motion.div
          style={{ y: heroY }}
          className="absolute inset-0 pointer-events-none"
        >
          <div
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, #C9A84C 0%, #B87333 50%, transparent 70%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: 'linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)',
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
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
            <span className="gradient-gold-text font-semibold">5-Step Process</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.8 }}
            className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-6"
          >
            <span style={{ color: '#F5F0E8' }}>How</span>{' '}
            <span className="gradient-gold-text">Cridora</span>
            <br />
            <span style={{ color: '#F5F0E8' }}>Works</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7 }}
            className="text-[#666] text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-10"
          >
            From account creation to your first sell-back — every step is transparent, 
            compliant, and built to give you full confidence in your holdings.
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

      {/* ── TRUST BAR ────────────────────────────────────────── */}
      <div
        className="py-5 border-y"
        style={{ borderColor: 'rgba(201,168,76,0.08)', background: '#0A0A0A' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-center gap-8">
          {[
            { icon: Shield, text: 'KYC / KYB gates' },
            { icon: Lock, text: 'No platform metal custody' },
            { icon: Zap, text: 'Card & workflow speed' },
            { icon: Globe, text: 'Remote-friendly access' },
            { icon: FileText, text: 'Order & ledger trail' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-[#555]">
              <Icon size={13} className="text-[#C9A84C] opacity-70" />
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* ── STEPS ────────────────────────────────────────────── */}
      <section className="py-28 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">

          {/* Vertical connector line (desktop) */}
          <div className="hidden lg:block absolute left-1/2 top-28 bottom-28 w-px -translate-x-1/2"
            style={{ background: 'linear-gradient(to bottom, transparent, rgba(201,168,76,0.2) 10%, rgba(201,168,76,0.2) 90%, transparent)' }}
          />

          <div className="flex flex-col gap-16">
            {steps.map((step, i) => (
              <StepBlock key={step.num} step={step} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FLOW DIAGRAM ─────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden" style={{ background: '#080808' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.2)] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.2)] to-transparent" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C] mb-4">Money & Metal Flow</p>
              <h2 className="text-3xl md:text-4xl font-black text-[#F5F0E8]">
                Where Does Your Money Go?
              </h2>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  label: 'Buyer',
                  icon: '👤',
                  desc: 'Pays for a metal lot via card. Receives digital ownership in ledger.',
                  dir: '→ Payment →',
                  color: 'rgba(201,168,76,0.1)',
                  border: 'rgba(201,168,76,0.2)',
                },
                {
                  label: 'Cridora Platform',
                  icon: '⬡',
                  desc: 'Routes payment to vendor. Records ownership. Takes platform fee. Never holds metal.',
                  dir: '→ Net Funds →',
                  color: 'rgba(168,169,173,0.1)',
                  border: 'rgba(168,169,173,0.2)',
                },
                {
                  label: 'Vendor',
                  icon: '🏛',
                  desc: 'Receives payment. Holds physical inventory. Obligated to honour buyback.',
                  dir: null,
                  color: 'rgba(184,115,51,0.1)',
                  border: 'rgba(184,115,51,0.2)',
                },
              ].map((node, i) => (
                <div key={node.label} className="flex flex-col items-center">
                  <div
                    className="w-full rounded-2xl p-6 text-center flex flex-col items-center gap-3 h-full"
                    style={{ background: node.color, border: `1px solid ${node.border}` }}
                  >
                    <div className="text-3xl">{node.icon}</div>
                    <h4 className="text-sm font-bold text-[#F5F0E8] tracking-wide">{node.label}</h4>
                    <p className="text-xs text-[#666] leading-relaxed">{node.desc}</p>
                  </div>
                  {node.dir && (
                    <div className="hidden md:flex items-center justify-center w-full mt-3">
                      <span className="text-[10px] tracking-[0.2em] text-[#C9A84C] opacity-60">{node.dir}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div
              className="mt-8 p-5 rounded-xl text-center"
              style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}
            >
              <p className="text-sm text-[#666] leading-relaxed">
                <span className="text-[#C9A84C] font-semibold">Key principle:</span> Funds are 
                always vendor-isolated. Cridora never pools money across vendors, ensuring your 
                holdings are not exposed to any other vendor's risk.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C] mb-4">Questions</p>
              <h2 className="text-3xl md:text-4xl font-black text-[#F5F0E8]">
                Frequently Asked
              </h2>
            </div>
          </FadeIn>

          <div>
            {faqs.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden" style={{ background: '#080808' }}>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 50%, #C9A84C 0%, transparent 70%)' }}
        />
        <FadeIn>
          <div className="max-w-2xl mx-auto text-center px-6">
            <h2 className="text-3xl md:text-5xl font-black mb-5">
              <span className="gradient-gold-text">Ready to Start?</span>
            </h2>
            <p className="text-[#666] text-sm leading-relaxed mb-8 max-w-lg mx-auto">
              Takes less than 10 minutes from sign-up to your first gold holding. 
              Fully verified. Fully transparent. Fully yours.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/marketplace">
                <button className="btn-gold px-8 py-4 rounded-sm text-sm tracking-widest uppercase font-bold flex items-center gap-2.5 group">
                  Explore Marketplace
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </button>
              </Link>
              <Link to="/vendors">
                <button className="btn-outline-gold px-8 py-4 rounded-sm text-sm tracking-widest uppercase font-semibold">
                  Partner as a Vendor
                </button>
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>
    </main>
  )
}
