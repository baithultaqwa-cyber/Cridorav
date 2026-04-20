import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Lock, Eye, EyeOff, User, Phone, Globe,
  ArrowRight, Shield, CheckCircle, ChevronRight
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const STEPS = ['Account', 'Personal', 'Verify']

const countries = [
  'United Arab Emirates', 'India', 'Pakistan', 'United Kingdom',
  'United States', 'Germany', 'France', 'Singapore', 'Saudi Arabia', 'Other',
]

export default function SignUp() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [step, setStep] = useState(0)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', phone: '', country: '',
    agree: false,
  })
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const validateStep0 = () => {
    const e = {}
    if (!form.email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'At least 8 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep1 = () => {
    const e = {}
    if (!form.firstName) e.firstName = 'First name is required'
    if (!form.lastName) e.lastName = 'Last name is required'
    if (!form.country) e.country = 'Please select your country'
    if (!form.agree) e.agree = 'You must agree to the terms'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = async () => {
    if (step === 0 && !validateStep0()) return
    if (step === 1 && !validateStep1()) return
    if (step === 2) {
      setLoading(true)
      try {
        await register({
          email: form.email,
          password: form.password,
          first_name: form.firstName,
          last_name: form.lastName,
          country: form.country,
          phone: form.phone,
        })
        navigate('/dashboard/customer')
      } catch (err) {
        const msg = err?.email?.[0] || err?.detail || 'Registration failed. Please try again.'
        setErrors({ submit: msg })
      } finally {
        setLoading(false)
      }
      return
    }
    setStep((s) => s + 1)
  }

  const inputStyle = (hasError) => ({
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${hasError ? 'rgba(239,68,68,0.4)' : 'rgba(201,168,76,0.15)'}`,
    color: '#F5F0E8',
    outline: 'none',
    width: '100%',
    borderRadius: '12px',
    padding: '14px 44px',
    fontSize: '14px',
    transition: 'border-color 0.2s',
  })

  const labelClass = 'text-[10px] tracking-[0.2em] uppercase text-[#555] mb-1.5 block'
  const errClass = 'text-[11px] text-red-400 mt-1'

  const strengthScore = () => {
    const p = form.password
    let s = 0
    if (p.length >= 8) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    return s
  }
  const strength = strengthScore()
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColor = ['', '#ef4444', '#f59e0b', '#84cc16', '#10b981']

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,169,173,0.05) 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <Link to="/" className="flex items-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full gradient-gold opacity-90" />
                <div
                  className="absolute inset-[2px] rounded-full flex items-center justify-center"
                  style={{ background: '#080808' }}
                >
                  <span className="text-[11px] font-black tracking-widest gradient-gold-text">C</span>
                </div>
              </div>
              <span className="text-xl font-bold tracking-[0.15em] gradient-gold-text uppercase">Cridora</span>
            </Link>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-8 md:p-10"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(201,168,76,0.12)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black text-[#F5F0E8] mb-2">Create Account</h1>
              <p className="text-sm text-[#666]">Start investing in precious metals today</p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-between mb-8 relative">
              <div
                className="absolute top-4 left-0 right-0 h-px"
                style={{ background: 'rgba(201,168,76,0.1)' }}
              />
              <motion.div
                className="absolute top-4 left-0 h-px"
                style={{ background: 'linear-gradient(to right, #C9A84C, #E8C96A)', transformOrigin: 'left' }}
                animate={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
              {STEPS.map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-2 relative z-10">
                  <motion.div
                    animate={{
                      background: i <= step ? 'linear-gradient(135deg, #C9A84C, #E8C96A)' : 'rgba(30,30,30,1)',
                      borderColor: i <= step ? '#C9A84C' : 'rgba(201,168,76,0.2)',
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold"
                    style={{ color: i <= step ? '#080808' : '#555' }}
                  >
                    {i < step ? <CheckCircle size={14} /> : i + 1}
                  </motion.div>
                  <span
                    className="text-[10px] tracking-widest uppercase"
                    style={{ color: i === step ? '#C9A84C' : '#444' }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Step content */}
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-4"
                >
                  {/* Email */}
                  <div>
                    <label className={labelClass}>Email Address</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e) => set('email', e.target.value)}
                        style={inputStyle(errors.email)}
                        onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.4)' }}
                        onBlur={(e) => { e.target.style.borderColor = errors.email ? 'rgba(239,68,68,0.4)' : 'rgba(201,168,76,0.15)' }}
                      />
                    </div>
                    {errors.email && <p className={errClass}>{errors.email}</p>}
                  </div>

                  {/* Password */}
                  <div>
                    <label className={labelClass}>Password</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        placeholder="Minimum 8 characters"
                        value={form.password}
                        onChange={(e) => set('password', e.target.value)}
                        style={{ ...inputStyle(errors.password), paddingRight: '44px' }}
                        onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.4)' }}
                        onBlur={(e) => { e.target.style.borderColor = errors.password ? 'rgba(239,68,68,0.4)' : 'rgba(201,168,76,0.15)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors"
                      >
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {form.password && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex gap-1 flex-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="h-1 flex-1 rounded-full transition-all duration-300"
                              style={{ background: i <= strength ? strengthColor[strength] : 'rgba(255,255,255,0.08)' }}
                            />
                          ))}
                        </div>
                        <span className="text-[11px]" style={{ color: strengthColor[strength] }}>
                          {strengthLabel[strength]}
                        </span>
                      </div>
                    )}
                    {errors.password && <p className={errClass}>{errors.password}</p>}
                  </div>

                  {/* Confirm */}
                  <div>
                    <label className={labelClass}>Confirm Password</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                      <input
                        type="password"
                        placeholder="Repeat password"
                        value={form.confirmPassword}
                        onChange={(e) => set('confirmPassword', e.target.value)}
                        style={inputStyle(errors.confirmPassword)}
                        onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.4)' }}
                        onBlur={(e) => { e.target.style.borderColor = errors.confirmPassword ? 'rgba(239,68,68,0.4)' : 'rgba(201,168,76,0.15)' }}
                      />
                    </div>
                    {errors.confirmPassword && <p className={errClass}>{errors.confirmPassword}</p>}
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>First Name</label>
                      <div className="relative">
                        <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                        <input
                          type="text"
                          placeholder="First"
                          value={form.firstName}
                          onChange={(e) => set('firstName', e.target.value)}
                          style={inputStyle(errors.firstName)}
                          onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.4)' }}
                          onBlur={(e) => { e.target.style.borderColor = errors.firstName ? 'rgba(239,68,68,0.4)' : 'rgba(201,168,76,0.15)' }}
                        />
                      </div>
                      {errors.firstName && <p className={errClass}>{errors.firstName}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Last Name</label>
                      <div className="relative">
                        <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Last"
                          value={form.lastName}
                          onChange={(e) => set('lastName', e.target.value)}
                          style={inputStyle(errors.lastName)}
                          onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.4)' }}
                          onBlur={(e) => { e.target.style.borderColor = errors.lastName ? 'rgba(239,68,68,0.4)' : 'rgba(201,168,76,0.15)' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Phone Number (optional)</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                      <input
                        type="tel"
                        placeholder="+971 50 000 0000"
                        value={form.phone}
                        onChange={(e) => set('phone', e.target.value)}
                        style={inputStyle(false)}
                        onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.4)' }}
                        onBlur={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.15)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Country of Residence</label>
                    <div className="relative">
                      <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                      <select
                        value={form.country}
                        onChange={(e) => set('country', e.target.value)}
                        style={{
                          ...inputStyle(errors.country),
                          paddingLeft: '44px',
                          paddingRight: '16px',
                          appearance: 'none',
                          cursor: 'pointer',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.4)' }}
                        onBlur={(e) => { e.target.style.borderColor = errors.country ? 'rgba(239,68,68,0.4)' : 'rgba(201,168,76,0.15)' }}
                      >
                        <option value="" style={{ background: '#111' }}>Select country</option>
                        {countries.map((c) => (
                          <option key={c} value={c} style={{ background: '#111' }}>{c}</option>
                        ))}
                      </select>
                    </div>
                    {errors.country && <p className={errClass}>{errors.country}</p>}
                  </div>

                  {/* Terms */}
                  <div>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div
                        onClick={() => set('agree', !form.agree)}
                        className="w-5 h-5 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center transition-all duration-200 cursor-pointer"
                        style={{
                          background: form.agree ? 'linear-gradient(135deg, #C9A84C, #E8C96A)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${form.agree ? '#C9A84C' : errors.agree ? 'rgba(239,68,68,0.4)' : 'rgba(201,168,76,0.2)'}`,
                        }}
                      >
                        {form.agree && <CheckCircle size={12} style={{ color: '#080808' }} />}
                      </div>
                      <span className="text-xs text-[#666] leading-relaxed">
                        I agree to Cridora's{' '}
                        <span className="text-[#C9A84C] cursor-pointer">Terms of Service</span>
                        {' '}and{' '}
                        <span className="text-[#C9A84C] cursor-pointer">Privacy Policy</span>.
                        I confirm I am 18+ years old.
                      </span>
                    </label>
                    {errors.agree && <p className={errClass}>{errors.agree}</p>}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-5"
                >
                  <div
                    className="rounded-xl p-5"
                    style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.12)' }}
                  >
                    <h3 className="text-sm font-bold text-[#F5F0E8] mb-4">Review Your Details</h3>
                    {[
                      { label: 'Email', value: form.email },
                      { label: 'Name', value: `${form.firstName} ${form.lastName}` },
                      { label: 'Country', value: form.country },
                      { label: 'Phone', value: form.phone || '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center py-2.5 border-b last:border-0"
                        style={{ borderColor: 'rgba(201,168,76,0.08)' }}
                      >
                        <span className="text-[11px] tracking-widest uppercase text-[#555]">{label}</span>
                        <span className="text-sm text-[#F5F0E8] font-medium">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div
                    className="rounded-xl p-4"
                    style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}
                  >
                    <div className="flex items-start gap-3">
                      <Shield size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-400 mb-1">KYC Verification Next</p>
                        <p className="text-[11px] text-[#666] leading-relaxed">
                          After creating your account, you'll complete a quick identity verification 
                          (5–10 min) before you can place your first order.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 gap-3">
              {step > 0 ? (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="btn-outline-gold px-5 py-3 rounded-xl text-xs tracking-widest uppercase font-semibold"
                >
                  Back
                </button>
              ) : <div />}

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleNext}
                disabled={loading}
                className="btn-gold flex-1 py-4 rounded-xl text-sm tracking-widest uppercase font-bold flex items-center justify-center gap-2.5 disabled:opacity-60"
              >
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-[#080808] border-t-transparent rounded-full"
                  />
                ) : step === 2 ? (
                  <>Create Account <CheckCircle size={15} /></>
                ) : (
                  <>Continue <ChevronRight size={15} /></>
                )}
              </motion.button>
            </div>

            <p className="text-center text-sm text-[#555] mt-6">
              Already have an account?{' '}
              <Link to="/signin" className="text-[#C9A84C] hover:text-[#E8C96A] transition-colors font-semibold">
                Sign in
              </Link>
            </p>
          </div>

          {/* Trust note */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <Shield size={12} className="text-[#444]" />
            <p className="text-[11px] text-[#444] tracking-wide">
              Secured with bank-grade encryption · UAE regulated
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  )
}
