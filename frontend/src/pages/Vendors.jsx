import { useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  Globe, Shield, TrendingUp, Zap, CheckCircle,
  ArrowRight, Building2, Award, Send, Eye, EyeOff, FileCheck, Lock, Scale
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { API_AUTH_BASE, SITE_ORIGIN } from '../config'
import { isEmail, isPersonName, isUaeMobile, passwordIssues } from '../lib/formValidation'
import SeoHead from '../components/SeoHead'
import FadeIn from '../components/FadeIn'

function iconSoftBg(color) {
  if (String(color).includes('var(')) return `color-mix(in srgb, ${color} 12%, transparent)`
  return `${color}18`
}

/* ─── Benefits for vendors ───────────────────────────────────── */
const benefits = [
  {
    icon: Globe,
    title: 'Global Buyer Reach',
    desc: 'Reach verified retail buyers without building your own acquisition stack.',
    color: 'gold',
  },
  {
    icon: Zap,
    title: 'Stripe-ready buyer payments',
    desc: 'Checkout uses Stripe when configured — you focus on pricing and fulfilment.',
    color: 'silver',
  },
  {
    icon: Shield,
    title: 'KYC/KYB Done For You',
    desc: 'Buyers arrive verified and compliant — no onboarding overhead for you.',
    color: 'copper',
  },
  {
    icon: TrendingUp,
    title: 'Scalable Revenue',
    desc: 'Fee only when you transact. No upfront costs.',
    color: 'gold',
  },
]

/* ─── Onboarding steps ───────────────────────────────────────── */
const onboardingSteps = [
  {
    num: '01',
    title: 'Submit Application',
    desc: 'Complete the vendor application form with your business details, trade license, and vault information.',
  },
  {
    num: '02',
    title: 'KYB Verification',
    desc: 'Our compliance team conducts a thorough Know Your Business review — typically completed within 3–5 business days.',
  },
  {
    num: '03',
    title: 'Inventory Audit',
    desc: 'An independent audit of your physical inventory is conducted to confirm backing for the lots you intend to list.',
  },
  {
    num: '04',
    title: 'Contract & Integration',
    desc: 'Sign the vendor agreement and integrate your inventory feed. Our team handles the technical setup.',
  },
  {
    num: '05',
    title: 'Go Live',
    desc: 'Your listings appear on the marketplace. Start receiving orders from global buyers instantly.',
  },
]

/* ─── Color map ──────────────────────────────────────────────── */
const colorMap = {
  gold: { bg: 'rgba(232,195,74,0.08)', border: 'rgba(232,195,74,0.18)', icon: 'var(--gold)' },
  silver: { bg: 'var(--silver-08)', border: 'var(--silver-18)', icon: 'var(--silver)' },
  copper: { bg: 'rgba(184,115,51,0.08)', border: 'rgba(184,115,51,0.18)', icon: '#B87333' },
}

const listingStandards = [
  {
    icon: FileCheck,
    title: 'KYB before go-live',
    desc: 'Trade licence, ownership, and business records are reviewed before any inventory can be listed.',
    color: 'gold',
  },
  {
    icon: Shield,
    title: 'Documented inventory',
    desc: 'Listings must be backed by auditable physical stock — Cridora does not warehouse metal on your behalf.',
    color: 'silver',
  },
  {
    icon: Scale,
    title: 'Disclosed buyback terms',
    desc: 'Buyers see buyback rates on each product line before checkout — no hidden spreads after purchase.',
    color: 'copper',
  },
  {
    icon: Lock,
    title: 'Isolated settlements',
    desc: 'Funds and ledgers are kept per seller. Cridora routes orders and compliance; custody stays with you.',
    color: 'gold',
  },
]

/* ─── Application form ───────────────────────────────────────── */
function ApplicationForm() {
  const { loginWithTokens } = useAuth()
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    first_name: '', last_name: '', vendor_company: '', email: '',
    password: '', phone: '', country: '', metals: '', message: '',
  })

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!isPersonName(form.first_name)) {
      setError('Enter a valid first name.')
      return
    }
    if (!form.vendor_company.trim()) {
      setError('Company name is required.')
      return
    }
    if (!isEmail(form.email)) {
      setError('Enter a valid email address.')
      return
    }
    const pwIssues = passwordIssues(form.password, { email: form.email, name: form.first_name })
    if (pwIssues.length) {
      setError(pwIssues[0])
      return
    }
    if (form.phone && !isUaeMobile(form.phone)) {
      setError('Enter a valid UAE mobile, or leave phone blank.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_AUTH_BASE}/vendor/apply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          vendor_company: form.vendor_company,
          email: form.email,
          password: form.password,
          phone: form.phone,
          country: form.country,
          metals: form.metals,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.email?.[0] || data?.vendor_company?.[0] || data?.password?.[0] || data?.detail || 'Application failed.'
        setError(msg)
        return
      }
      await loginWithTokens(data)
      setSubmitted(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <div
          className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{ background: 'rgba(232,195,74,0.15)', border: '2px solid var(--gold)' }}
        >
          <CheckCircle size={28} className="text-[var(--gold)]" />
        </div>
        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Application Submitted</h3>
        <p className="text-sm text-[var(--text-soft)] max-w-sm mx-auto mb-6">
          Your vendor account has been created. Our compliance team will review your KYB within 3–5 business days.
          You can log in now to check your status.
        </p>
        <button
          onClick={() => navigate('/dashboard/vendor')}
          className="btn-gold"
        >
          Go to Vendor Dashboard
        </button>
      </motion.div>
    )
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(232,195,74,0.12)',
    color: 'var(--text-primary)',
    outline: 'none',
  }
  const inputClass = 'w-full px-4 py-3 rounded-xl text-sm placeholder-[#444] transition-all duration-300 focus:border-[rgba(232,195,74,0.35)]'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="px-4 py-3 rounded-xl text-xs text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">First Name</label>
          <input required type="text" placeholder="First name" value={form.first_name} onChange={set('first_name')} className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Last Name</label>
          <input type="text" placeholder="Last name" value={form.last_name} onChange={set('last_name')} className={inputClass} style={inputStyle} />
        </div>
      </div>

      <div>
        <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Company Name</label>
        <input required type="text" placeholder="Registered business / trade name" value={form.vendor_company} onChange={set('vendor_company')} className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Business Email</label>
        <input required type="email" placeholder="business@example.com" value={form.email} onChange={set('email')} className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Password</label>
        <div className="relative">
          <input
            required
            type={showPassword ? 'text' : 'password'}
            placeholder="Min. 8 characters"
            value={form.password}
            onChange={set('password')}
            className={inputClass + ' pr-12'}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-soft)]"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Phone</label>
          <input type="text" placeholder="+971 50 000 0000" value={form.phone} onChange={set('phone')} className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Country</label>
          <input type="text" placeholder="UAE" value={form.country} onChange={set('country')} className={inputClass} style={inputStyle} />
        </div>
      </div>

      <div>
        <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Metals You Trade</label>
        <input type="text" placeholder="e.g. Gold, Silver" value={form.metals} onChange={set('metals')} className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Additional Information</label>
        <textarea
          rows={3}
          placeholder="Business scale, licenses held, trade volumes..."
          value={form.message}
          onChange={set('message')}
          className={`${inputClass} resize-none`}
          style={inputStyle}
        />
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        disabled={loading}
        className="btn-gold w-full flex items-center justify-center gap-2.5 mt-2 disabled:opacity-50"
      >
        <Send size={14} />
        {loading ? 'Submitting…' : 'Submit Application'}
      </motion.button>
      <p className="text-[11px] text-[var(--text-faint)] text-center">
        All applications are reviewed within 3–5 business days by our compliance team.
      </p>
    </form>
  )
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function Vendors() {
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])

  const vendorsLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'UAE Bullion Vendors on Cridora',
    description:
      'Directory of verified UAE gold dealers onboarding through Cridora: KYB requirements, AED marketplace exposure, compliant retail onboarding.',
    url: `${SITE_ORIGIN}/vendors`,
  }

  return (
    <>
      <SeoHead
        title="UAE Bullion Vendors on Cridora"
        description="Explore verified gold dealers UAE can list on Cridora: KYB-verified UAE bullion partners, DMCC-style compliance posture, AED marketplace reach, onboarding for dealers and wholesalers."
        path="/vendors"
        jsonLd={vendorsLd}
      />
      <main className="min-w-0 overflow-x-hidden">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative pt-8 md:pt-32 pb-20 md:pb-28 overflow-hidden">
        <motion.div style={{ y: heroY }} className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-40 right-0 w-[700px] h-[700px] rounded-full opacity-[0.05]"
            style={{ background: 'radial-gradient(circle, var(--gold) 0%, transparent 70%)' }}
          />
          <div
            className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-[0.04]"
            style={{ background: 'radial-gradient(circle, #B87333 0%, transparent 70%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: 'linear-gradient(rgba(232,195,74,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(232,195,74,0.5) 1px, transparent 1px)',
              backgroundSize: '70px 70px',
            }}
          />
        </motion.div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div
                className="inline-flex items-center gap-2 mb-7 px-4 py-2 rounded-full text-[11px] tracking-[0.2em] uppercase"
                style={{ background: 'rgba(232,195,74,0.08)', border: '1px solid rgba(232,195,74,0.2)' }}
              >
                <Building2 size={12} className="text-[var(--gold)]" />
                <span className="gradient-gold-text font-semibold">UAE-licensed partners</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-black leading-[0.95] tracking-tight mb-6">
                <span style={{ color: 'var(--text-primary)' }}>Expand</span>{' '}
                <span className="gradient-gold-text">Globally.</span>
                <br />
                <span style={{ color: 'var(--text-primary)' }}>Sell</span>{' '}
                <span className="gradient-silver-text">Digitally.</span>
              </h1>

              <p className="text-[var(--text-muted)] text-base leading-relaxed mb-8 max-w-md">
                List with verified buyers. You hold inventory and buybacks — we run KYB and order workflows.
              </p>

              <div className="flex flex-wrap items-center gap-5 mb-4">
                {[
                  { value: '3–5', label: 'Business days KYB review' },
                  { value: 'AED', label: 'Card checkout (when set up)' },
                  { value: 'Zero', label: 'Platform metal custody' },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-2xl font-black gradient-gold-text">{s.value}</div>
                    <div className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mt-0.5 max-w-[9rem] leading-snug">{s.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[var(--text-dim)] max-w-md mb-8 leading-relaxed">
                Inventory stays with you.
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <a href="#apply">
                  <button className="btn-gold flex items-center gap-2.5 group">
                    Apply to Join
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </button>
                </a>
                <a
                  href="#standards"
                  className="text-sm text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors underline-offset-4 hover:underline"
                >
                  Listing standards
                </a>
              </div>
            </motion.div>

            {/* Right — requirements checklist */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div
                className="rounded-2xl p-8"
                style={{ background: 'rgba(232,195,74,0.04)', border: '1px solid rgba(232,195,74,0.12)' }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <Award size={18} className="text-[var(--gold)]" />
                  <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-primary)]">
                    Vendor Requirements
                  </h3>
                </div>
                <ul className="flex flex-col gap-4">
                  {[
                    'Active UAE trade license (DMCC, DED, or equivalent)',
                    'Physical bullion inventory with documented storage',
                    'Ability to honour contractual buyback obligations',
                    'Passed Cridora KYB (Know Your Business) review',
                    'Signed platform agreement and fee schedule',
                    'Minimum inventory capacity per listed lot type',
                  ].map((req) => (
                    <li key={req} className="flex items-start gap-3">
                      <CheckCircle size={14} className="text-[var(--gold)] flex-shrink-0 mt-0.5 opacity-80" />
                      <span className="text-sm text-[var(--text-soft)] leading-relaxed">{req}</span>
                    </li>
                  ))}
                </ul>
                <div
                  className="mt-6 pt-5 border-t"
                  style={{ borderColor: 'rgba(232,195,74,0.1)' }}
                >
                  <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
                    Not yet meeting all requirements?{' '}
                    <Link to="/how-it-works" className="text-[var(--gold)] hover:underline">Read how verification works</Link>
                    {' '}— you can still apply and complete gaps during review.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── LISTING STANDARDS (no public vendor directory) ───── */}
      <section id="standards" className="py-24 md:py-32 relative" style={{ background: 'var(--section-wash-a)' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(232,195,74,0.2)] to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">Trust model</p>
              <h2 className="text-3xl md:text-5xl font-black text-[var(--text-primary)] mb-4">
                How listings are qualified
              </h2>
              <p className="text-[var(--text-muted)] text-sm max-w-md mx-auto leading-relaxed">
                No public vendor directory — every live listing has passed the checks below.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
            {listingStandards.map((item, i) => {
              const c = colorMap[item.color]
              return (
                <FadeIn key={item.title} delay={i * 0.08} className="h-full">
                  <div
                    className="rounded-2xl p-7 flex flex-col gap-4 h-full"
                    style={{ background: c.bg, border: `1px solid ${c.border}` }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: iconSoftBg(c.icon), border: `1px solid ${c.border}` }}
                    >
                      <item.icon size={20} style={{ color: c.icon }} />
                    </div>
                    <div className="flex flex-col flex-1">
                      <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">{item.title}</h3>
                      <p className="text-sm text-[var(--text-muted)] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              )
            })}
          </div>

          <FadeIn delay={0.2}>
            <div
              className="mt-12 rounded-2xl p-8 text-center max-w-2xl mx-auto"
              style={{ background: 'rgba(232,195,74,0.04)', border: '1px solid rgba(232,195,74,0.12)' }}
            >
              <Shield size={28} className="text-[var(--gold)] mx-auto mb-4 opacity-90" />
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Browse products, not partner profiles</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6">
                On public pages you compare metal, purity, fees, and buyback terms — then complete KYC before ordering.
              </p>
              <Link to="/marketplace">
                <button
                  type="button"
                  className="btn-outline-gold mr-3 mb-2 sm:mb-0"
                >
                  View marketplace
                </button>
              </Link>
              <a href="#apply">
                <button
                  type="button"
                  className="btn-gold"
                >
                  Apply as a vendor
                </button>
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div
              className="mt-10 p-5 rounded-xl flex items-center justify-between gap-4 flex-wrap"
              style={{ background: 'rgba(232,195,74,0.04)', border: '1px solid rgba(232,195,74,0.1)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
                <span className="text-sm text-[var(--text-soft)]">
                  Currently accepting new vendor applications for <span className="text-[var(--gold)]">Q3 2026</span> cohort
                </span>
              </div>
              <a href="#apply">
                <button className="btn-gold text-[11px] flex items-center gap-2">
                  Apply Now <ArrowRight size={12} />
                </button>
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── BENEFITS ─────────────────────────────────────────── */}
      <section id="benefits" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">Why Partner with Cridora</p>
              <h2 className="text-3xl md:text-5xl font-black text-[var(--text-primary)] mb-4">
                Built Around Your Business
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
            {benefits.map((b, i) => {
              const c = colorMap[b.color]
              return (
                <FadeIn key={b.title} delay={i * 0.1} className="h-full">
                  <div
                    className="rounded-xl p-7 flex flex-col gap-4 h-full"
                    style={{ background: c.bg, border: `1px solid ${c.border}` }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: iconSoftBg(c.icon), border: `1px solid ${c.border}` }}
                    >
                      <b.icon size={20} style={{ color: c.icon }} />
                    </div>
                    <div className="flex flex-col flex-1">
                      <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">{b.title}</h3>
                      <p className="text-sm text-[var(--text-muted)] leading-relaxed">{b.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── ONBOARDING STEPS ─────────────────────────────────── */}
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: 'var(--section-wash-b)' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(232,195,74,0.15)] to-transparent" />
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">Onboarding</p>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">
                From Application to Live — 5 Steps
              </h2>
            </div>
          </FadeIn>

          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-5 top-5 bottom-5 w-px"
              style={{ background: 'linear-gradient(to bottom, var(--gold), rgba(232,195,74,0.1))' }}
            />

            <div className="flex flex-col gap-8 pl-16">
              {onboardingSteps.map((step, i) => (
                <FadeIn key={step.num} delay={i * 0.12} direction="left">
                  <div className="relative">
                    {/* Dot */}
                    <div
                      className="absolute -left-[49px] top-1 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black"
                      style={{ background: 'rgba(232,195,74,0.15)', border: '1px solid rgba(232,195,74,0.4)', color: 'var(--gold)' }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1.5">{step.title}</h4>
                      <p className="text-sm text-[var(--text-muted)] leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── APPLICATION FORM ─────────────────────────────────── */}
      <section id="apply" className="py-24 md:py-32">
        <div className="max-w-2xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4">Get Started</p>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-4">
                Apply to Become a Vendor
              </h2>
              <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-md mx-auto">
                Submit your details and our vendor relations team will be in touch within 3–5 business days.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div
              className="rounded-2xl p-8"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(232,195,74,0.12)' }}
            >
              <ApplicationForm />
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
    </>
  )
}
