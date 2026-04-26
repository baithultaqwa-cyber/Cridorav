import { useRef, useState, useEffect } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  Globe, Shield, TrendingUp, Users, BarChart2, Zap, CheckCircle,
  ArrowRight, Star, Building2, MapPin, Award, ChevronRight, Send, Eye, EyeOff
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { API_AUTH_BASE } from '../config'
import { catalogImageUrl } from '../utils/mediaUrl'

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

/* ─── Benefits for vendors ───────────────────────────────────── */
const benefits = [
  {
    icon: Globe,
    title: 'Global Buyer Reach',
    desc: 'Access retail investors from India, Pakistan, UK, Europe, and the US without any additional infrastructure.',
    color: 'gold',
  },
  {
    icon: Zap,
    title: 'Instant Digital Transactions',
    desc: 'Card payments processed instantly. No manual invoicing, no wire transfer delays. Settlement within 1–3 business days.',
    color: 'silver',
  },
  {
    icon: Shield,
    title: 'KYC/KYB Done For You',
    desc: 'Cridora handles all buyer verification. You receive only verified, compliant customers — no onboarding overhead.',
    color: 'copper',
  },
  {
    icon: BarChart2,
    title: 'Real-Time Analytics',
    desc: 'Vendor dashboard with transaction volume, revenue, buyer geography, and inventory tracking — all in one place.',
    color: 'gold',
  },
  {
    icon: TrendingUp,
    title: 'Scalable Revenue',
    desc: 'Pay a fee only when you transact. No upfront costs. Scale as your digital volume grows.',
    color: 'silver',
  },
  {
    icon: Users,
    title: 'Onboarding & platform support',
    desc: 'Help with KYB, listing setup, and using the desk — depth of coverage depends on your operator’s support model.',
    color: 'copper',
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
  gold: { bg: 'rgba(201,168,76,0.08)', border: 'rgba(201,168,76,0.18)', icon: '#C9A84C' },
  silver: { bg: 'rgba(168,169,173,0.08)', border: 'rgba(168,169,173,0.18)', icon: '#A8A9AD' },
  copper: { bg: 'rgba(184,115,51,0.08)', border: 'rgba(184,115,51,0.18)', icon: '#B87333' },
}

const badgeMap = {
  gold: { bg: 'rgba(201,168,76,0.15)', text: '#C9A84C' },
  silver: { bg: 'rgba(168,169,173,0.15)', text: '#D4D5D9' },
  copper: { bg: 'rgba(184,115,51,0.15)', text: '#DA8A67' },
}

function initialsFromName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'V'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Map API row to VendorCard props; uses sample-style fields when stats are unknown. */
function mapApiVendorToCard(v, index) {
  const name = v.vendor_company || 'Vendor'
  const colors = ['#C9A84C', '#A8A9AD', '#B87333', '#C9A84C']
  const badgeColors = ['gold', 'silver', 'copper', 'gold']
  const idx = index % 4
  const loc = (v.country || '').trim() || 'United Arab Emirates'
  return {
    id: `live-vendor-${v.id}`,
    name,
    location: loc,
    since: '—',
    metals: ['Gold', 'Silver', 'Platinum'],
    rating: null,
    reviews: null,
    totalTransactions: null,
    specialty: (v.vendor_description || '').trim() || 'KYB-verified bullion vendor on Cridora.',
    badge: 'Verified',
    badgeColor: badgeColors[idx],
    logo: initialsFromName(name),
    logoColor: colors[idx],
    imageUrl: v.logo_url ? catalogImageUrl(v.logo_url) : null,
  }
}

/* ─── Vendor card ────────────────────────────────────────────── */
function VendorCard({ vendor, index }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      whileHover={{ y: -5 }}
      className="rounded-2xl p-7 flex flex-col gap-5 h-full"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(201,168,76,0.12)',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)'
        e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,168,76,0.2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(201,168,76,0.12)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          {/* Logo avatar */}
          {vendor.imageUrl ? (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(201,168,76,0.2)' }}
            >
              <img src={vendor.imageUrl} alt="" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
              style={{ background: `${vendor.logoColor}15`, border: `1px solid ${vendor.logoColor}30`, color: vendor.logoColor }}
            >
              {vendor.logo}
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-[#F5F0E8]">{vendor.name}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin size={10} className="text-[#555]" />
              <span className="text-[11px] text-[#555]">{vendor.location}</span>
            </div>
          </div>
        </div>
        <div
          className="px-2 py-1 rounded-sm text-[9px] font-bold tracking-widest uppercase flex-shrink-0"
          style={{ background: badgeMap[vendor.badgeColor].bg, color: badgeMap[vendor.badgeColor].text }}
        >
          {vendor.badge}
        </div>
      </div>

      {/* Rating (optional — hidden for live API vendors without review data) */}
      {vendor.rating != null && vendor.reviews != null && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={11}
                style={{
                  color: i < Math.floor(vendor.rating) ? '#C9A84C' : '#333',
                  fill: i < Math.floor(vendor.rating) ? '#C9A84C' : '#333',
                }}
              />
            ))}
          </div>
          <span className="text-[11px] text-[#666]">{vendor.rating} · {vendor.reviews} reviews</span>
        </div>
      )}
      {vendor.rating == null && (
        <p className="text-[11px] text-[#666] tracking-wide">Cridora KYB verified</p>
      )}

      {/* Specialty */}
      <p className="text-sm text-[#666] leading-relaxed flex-1">{vendor.specialty}</p>

      {/* Metals */}
      <div className="flex flex-wrap gap-2">
        {vendor.metals.map((m) => (
          <span
            key={m}
            className="text-[10px] tracking-widest uppercase px-2 py-1 rounded-sm font-semibold"
            style={{
              background: m === 'Gold' ? 'rgba(201,168,76,0.1)' : m === 'Silver' ? 'rgba(168,169,173,0.1)' : 'rgba(184,115,51,0.1)',
              color: m === 'Gold' ? '#C9A84C' : m === 'Silver' ? '#D4D5D9' : '#DA8A67',
            }}
          >
            {m}
          </span>
        ))}
      </div>

      {/* Stats */}
      {(vendor.since && vendor.since !== '—') || (vendor.totalTransactions && vendor.totalTransactions !== '—') ? (
        <div
          className="grid grid-cols-2 gap-3 p-4 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.3)' }}
        >
          <div>
            <div className="text-[9px] tracking-[0.15em] uppercase text-[#444] mb-1">Est.</div>
            <div className="text-sm font-bold text-[#F5F0E8]">{vendor.since}</div>
          </div>
          <div>
            <div className="text-[9px] tracking-[0.15em] uppercase text-[#444] mb-1">Transactions</div>
            <div className="text-sm font-bold gradient-gold-text">{vendor.totalTransactions}</div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] text-emerald-400/80 tracking-widest uppercase">Active · Verified</span>
        <Shield size={11} className="text-emerald-400/60 ml-auto" />
      </div>
    </motion.div>
  )
}

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
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
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
          style={{ background: 'rgba(201,168,76,0.15)', border: '2px solid #C9A84C' }}
        >
          <CheckCircle size={28} className="text-[#C9A84C]" />
        </div>
        <h3 className="text-xl font-bold text-[#F5F0E8] mb-2">Application Submitted</h3>
        <p className="text-sm text-[#888] max-w-sm mx-auto mb-6">
          Your vendor account has been created. Our compliance team will review your KYB within 3–5 business days.
          You can log in now to check your status.
        </p>
        <button
          onClick={() => navigate('/dashboard/vendor')}
          className="btn-gold px-6 py-2.5 rounded-lg text-xs tracking-widest uppercase font-bold"
        >
          Go to Vendor Dashboard
        </button>
      </motion.div>
    )
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(201,168,76,0.12)',
    color: '#F5F0E8',
    outline: 'none',
  }
  const inputClass = 'w-full px-4 py-3 rounded-xl text-sm placeholder-[#444] transition-all duration-300 focus:border-[rgba(201,168,76,0.35)]'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="px-4 py-3 rounded-xl text-xs text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-1.5 block">First Name</label>
          <input required type="text" placeholder="First name" value={form.first_name} onChange={set('first_name')} className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-1.5 block">Last Name</label>
          <input type="text" placeholder="Last name" value={form.last_name} onChange={set('last_name')} className={inputClass} style={inputStyle} />
        </div>
      </div>

      <div>
        <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-1.5 block">Company Name</label>
        <input required type="text" placeholder="Registered business / trade name" value={form.vendor_company} onChange={set('vendor_company')} className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-1.5 block">Business Email</label>
        <input required type="email" placeholder="business@example.com" value={form.email} onChange={set('email')} className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-1.5 block">Password</label>
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888]"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-1.5 block">Phone</label>
          <input type="text" placeholder="+971 50 000 0000" value={form.phone} onChange={set('phone')} className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-1.5 block">Country</label>
          <input type="text" placeholder="UAE" value={form.country} onChange={set('country')} className={inputClass} style={inputStyle} />
        </div>
      </div>

      <div>
        <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-1.5 block">Metals You Trade</label>
        <input type="text" placeholder="e.g. Gold, Silver, Platinum" value={form.metals} onChange={set('metals')} className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-1.5 block">Additional Information</label>
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
        className="btn-gold w-full py-4 rounded-xl text-sm tracking-widest uppercase font-bold flex items-center justify-center gap-2.5 mt-2 disabled:opacity-50"
      >
        <Send size={14} />
        {loading ? 'Submitting…' : 'Submit Application'}
      </motion.button>
      <p className="text-[11px] text-[#444] text-center">
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
  const [verifiedVendors, setVerifiedVendors] = useState([])

  useEffect(() => {
    fetch(`${API_AUTH_BASE}/vendors/verified/`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        const list = Array.isArray(data.vendors) ? data.vendors : []
        setVerifiedVendors(list)
      })
      .catch(() => undefined)
  }, [])

  const displayVendors = verifiedVendors.map((v, i) => mapApiVendorToCard(v, i))

  return (
    <main className="min-w-0 overflow-x-hidden">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative pt-32 pb-24 overflow-hidden">
        <motion.div style={{ y: heroY }} className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-40 right-0 w-[700px] h-[700px] rounded-full opacity-[0.05]"
            style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)' }}
          />
          <div
            className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-[0.04]"
            style={{ background: 'radial-gradient(circle, #B87333 0%, transparent 70%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: 'linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)',
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
                style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}
              >
                <Building2 size={12} className="text-[#C9A84C]" />
                <span className="gradient-gold-text font-semibold">UAE Bullion Vendors</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-black leading-[0.95] tracking-tight mb-6">
                <span style={{ color: '#F5F0E8' }}>Expand</span>{' '}
                <span className="gradient-gold-text">Globally.</span>
                <br />
                <span style={{ color: '#F5F0E8' }}>Sell</span>{' '}
                <span className="gradient-silver-text">Digitally.</span>
              </h1>

              <p className="text-[#666] text-base leading-relaxed mb-8 max-w-lg">
                Cridora gives UAE bullion vendors a fully-managed digital channel to reach 
                verified retail investors worldwide — with no custody exposure, no tech complexity, 
                and a transparent commercial model.
              </p>

              <div className="flex flex-wrap items-center gap-5 mb-8">
                {[
                  { value: String(verifiedVendors.length), label: 'Live KYB partners' },
                  { value: 'AED', label: 'Card checkout (when set up)' },
                  { value: '0', label: 'Platform metal custody' },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-2xl font-black gradient-gold-text">{s.value}</div>
                    <div className="text-[10px] tracking-widest uppercase text-[#555] mt-0.5 max-w-[9rem] leading-snug">{s.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#555] max-w-lg mb-4 leading-relaxed">
                The first number is the current count from the public API (same data buyers see). “Platform metal custody” is zero because inventory stays with vendors; Cridora records orders and compliance status.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a href="#apply">
                  <button className="btn-gold px-7 py-4 rounded-sm text-sm tracking-widest uppercase font-bold flex items-center gap-2.5 group">
                    Apply to Join
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </button>
                </a>
                <a href="#vendors">
                  <button className="btn-outline-gold px-7 py-4 rounded-sm text-sm tracking-widest uppercase font-semibold flex items-center gap-2.5">
                    View Partners
                    <ChevronRight size={15} />
                  </button>
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
                style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)' }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <Award size={18} className="text-[#C9A84C]" />
                  <h3 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8]">
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
                      <CheckCircle size={14} className="text-[#C9A84C] flex-shrink-0 mt-0.5 opacity-80" />
                      <span className="text-sm text-[#888] leading-relaxed">{req}</span>
                    </li>
                  ))}
                </ul>
                <div
                  className="mt-6 pt-5 border-t"
                  style={{ borderColor: 'rgba(201,168,76,0.1)' }}
                >
                  <p className="text-[11px] text-[#555] leading-relaxed">
                    Not yet meeting all requirements?{' '}
                    <Link to="/how-it-works" className="text-[#C9A84C] hover:underline">Read how verification works</Link>
                    {' '}— you can still apply and complete gaps during review.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CURRENT VENDORS ──────────────────────────────────── */}
      <section id="vendors" className="py-28 relative" style={{ background: '#0A0A0A' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.2)] to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C] mb-4">Our Network</p>
              <h2 className="text-3xl md:text-5xl font-black text-[#F5F0E8] mb-4">
                Verified Partners
              </h2>
              <p className="text-[#666] text-sm max-w-md mx-auto leading-relaxed">
                {verifiedVendors.length > 0
                  ? 'Live KYB-verified partners on the platform. Each vendor can add a short intro for buyers.'
                  : 'When the first partners go live, they will appear here automatically from the same verified-vendor list used in checkout — we do not show fictional “sample” companies.'}
              </p>
            </div>
          </FadeIn>

          {displayVendors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
              {displayVendors.map((v, i) => (
                <VendorCard key={v.id} vendor={v} index={i} />
              ))}
            </div>
          ) : (
            <FadeIn>
              <div
                className="rounded-2xl p-10 text-center max-w-xl mx-auto"
                style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)' }}
              >
                <Shield size={28} className="text-[#C9A84C] mx-auto mb-4 opacity-90" />
                <h3 className="text-lg font-bold text-[#F5F0E8] mb-2">No public partners here yet</h3>
                <p className="text-sm text-[#666] leading-relaxed mb-6">
                  The network is in onboarding: we only display real, KYB-verified companies — never placeholder brands.
                  If you are a qualified UAE bullion business, you can be among the first listed.
                </p>
                <a href="#apply">
                  <button
                    type="button"
                    className="btn-gold px-6 py-3 rounded-sm text-xs tracking-widest uppercase font-bold"
                  >
                    Start vendor application
                  </button>
                </a>
              </div>
            </FadeIn>
          )}

          <FadeIn delay={0.3}>
            <div
              className="mt-8 p-5 rounded-xl flex items-center justify-between gap-4 flex-wrap"
              style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse" />
                <span className="text-sm text-[#888]">
                  Currently accepting new vendor applications for <span className="text-[#C9A84C]">Q3 2026</span> cohort
                </span>
              </div>
              <a href="#apply">
                <button className="btn-gold px-5 py-2.5 rounded-sm text-[11px] tracking-widest uppercase font-bold flex items-center gap-2">
                  Apply Now <ArrowRight size={12} />
                </button>
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── BENEFITS ─────────────────────────────────────────── */}
      <section className="py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C] mb-4">Why Partner with Cridora</p>
              <h2 className="text-3xl md:text-5xl font-black text-[#F5F0E8] mb-4">
                Built Around Your Business
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
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
                      style={{ background: `${c.icon}18`, border: `1px solid ${c.border}` }}
                    >
                      <b.icon size={20} style={{ color: c.icon }} />
                    </div>
                    <div className="flex flex-col flex-1">
                      <h3 className="text-base font-bold text-[#F5F0E8] mb-2">{b.title}</h3>
                      <p className="text-sm text-[#666] leading-relaxed">{b.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── ONBOARDING STEPS ─────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden" style={{ background: '#080808' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.15)] to-transparent" />
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C] mb-4">Onboarding</p>
              <h2 className="text-3xl md:text-4xl font-black text-[#F5F0E8]">
                From Application to Live — 5 Steps
              </h2>
            </div>
          </FadeIn>

          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-5 top-5 bottom-5 w-px"
              style={{ background: 'linear-gradient(to bottom, #C9A84C, rgba(201,168,76,0.1))' }}
            />

            <div className="flex flex-col gap-8 pl-16">
              {onboardingSteps.map((step, i) => (
                <FadeIn key={step.num} delay={i * 0.12} direction="left">
                  <div className="relative">
                    {/* Dot */}
                    <div
                      className="absolute -left-[49px] top-1 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black"
                      style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C' }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#F5F0E8] mb-1.5">{step.title}</h4>
                      <p className="text-sm text-[#666] leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── APPLICATION FORM ─────────────────────────────────── */}
      <section id="apply" className="py-28">
        <div className="max-w-2xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C] mb-4">Get Started</p>
              <h2 className="text-3xl md:text-4xl font-black text-[#F5F0E8] mb-4">
                Apply to Become a Vendor
              </h2>
              <p className="text-[#666] text-sm leading-relaxed max-w-md mx-auto">
                Submit your details and our vendor relations team will be in touch within 3–5 business days.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div
              className="rounded-2xl p-8"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.12)' }}
            >
              <ApplicationForm />
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  )
}
