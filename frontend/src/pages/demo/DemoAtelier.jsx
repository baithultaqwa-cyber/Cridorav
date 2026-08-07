import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DemoShell from './DemoShell'
import AtelierLiveBuy from './AtelierLiveBuy'
import AtelierSpotTicker from './AtelierSpotTicker'
import { useInView } from './hooks/useInView'
import { useScrollProgress } from './hooks/useScrollProgress'
import './atelier.css'

const BOOKING_KEY = 'cridora-demo-booking-atelier'

const metals = {
  gold: { name: 'Gold', symbol: 'XAU', purity: '24K', price: 478.25, chg: 0.42 },
  silver: { name: 'Silver', symbol: 'XAG', purity: '999', price: 6.873, chg: -0.18 },
}

const dealers = [
  { id: 'd1', name: 'Sundial Bullion Co.', location: 'Deira Gold Souk', storageOffered: true, buybackOffered: true },
  { id: 'd2', name: 'Zenith Metals', location: 'Meydan Free Zone', storageOffered: true, buybackOffered: true },
  { id: 'd3', name: 'Al Fajr Precious', location: 'Gold Souk, Deira', storageOffered: false, buybackOffered: true },
  { id: 'd4', name: 'Lantern & Co.', location: 'DMCC, JLT', storageOffered: true, buybackOffered: false },
]

const steps = [
  { n: '01', h: 'Verify once', p: 'Light identity capture at signup, full KYC when thresholds require it — unlocks trading with every verified dealer on the platform.' },
  { n: '02', h: 'Compare live listings', p: 'Side-by-side quotes from licensed UAE bullion dealers. Purity, weight, fees, and buyback terms — all disclosed before you commit.' },
  { n: '03', h: 'Buy with clarity', p: 'Every fee is its own line. The dealer is always the seller of record. Cridora coordinates the transaction — never custodies the metal.' },
  { n: '04', h: 'Hold, redeem, or sell back', p: "Leave gold in the dealer's storage program, request delivery, or sell back at the disclosed rate — tracked in one calm dashboard." },
]

const pillars = [
  { h: 'Non-custodial by design', p: 'Metal stays with the selling dealer. Cridora never takes title and never holds inventory — built for marketplace licensing, not vault theatre.' },
  { h: 'Thinner round-trip cost', p: 'Direct dealer listings and a flat platform fee instead of the typical marketplace premium on small bars. The math shows early.' },
  { h: 'Handover you can watch', p: 'Weight and purity verified at fulfillment. Signed acknowledgment. A relationship that continues after the first purchase.' },
  { h: 'Built for calm trust', p: 'No ticker anxiety. Exact numbers early. Verification as the trust moment — not a wall of badges competing for attention.' },
]

const compare = [
  { who: 'Cridora', pct: '2.00%', detail: 'Direct dealer listing + flat fee · ≈ AED 9.51/g', hi: true },
  { who: 'Typical marketplace', pct: '7.75%', detail: 'Marketplace premium on small bars · ≈ AED 36.87/g', hi: false },
  { who: 'Retail counter', pct: '9.66%', detail: 'Walk-in jeweller markup · ≈ AED 45.95/g', hi: false },
]

const visitTypes = [
  { id: 'handover', label: 'Collection / handover', hint: 'Verify weight & purity in person' },
  { id: 'consult', label: 'Dealer consultation', hint: 'Walk through listings before you buy' },
  { id: 'pickup', label: 'Stored-metal pickup', hint: 'Redeem metal left with a dealer' },
]

const timeSlots = ['10:00', '11:30', '13:00', '15:00', '16:30', '18:00']

function Reveal({ children, className = '', delay }) {
  const { ref, inView } = useInView()
  return (
    <div
      ref={ref}
      className={`lp-reveal ${delay ? `lp-reveal-delay-${delay}` : ''} ${inView ? 'is-in' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

function nextWeekdayDates(count = 8) {
  const out = []
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  while (out.length < count) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() === 5) continue
    out.push({
      value: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' }),
    })
  }
  return out
}

function DirectBooking() {
  const dates = useMemo(() => nextWeekdayDates(), [])
  const [form, setForm] = useState({
    visitType: 'handover',
    dealerId: dealers[0]?.id ?? '',
    date: dates[0]?.value ?? '',
    slot: timeSlots[1],
    name: '',
    phone: '',
    notes: '',
  })
  const [saved, setSaved] = useState(() => {
    try {
      const raw = localStorage.getItem(BOOKING_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [error, setError] = useState('')
  const confirmRef = useRef(null)
  const selectedDealer = dealers.find((d) => d.id === form.dealerId)

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  function onSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and UAE mobile are required.')
      return
    }
    if (!/^\+?[0-9\s-]{8,16}$/.test(form.phone.trim())) {
      setError('Enter a valid phone number.')
      return
    }
    const booking = {
      ...form,
      name: form.name.trim(),
      phone: form.phone.trim(),
      id: `BK-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    }
    localStorage.setItem(BOOKING_KEY, JSON.stringify(booking))
    setSaved(booking)
    requestAnimationFrame(() => confirmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  return (
    <section className="lp-section lp-book" id="book">
      <div className="lp-wrap">
        <div className="lp-book-grid">
          <Reveal>
            <span className="lp-kicker">Direct booking</span>
            <h2 className="lp-h2">Book a dealer visit — no account required.</h2>
            <p className="lp-sub">
              Reserve a verified handover or consultation window at a licensed UAE dealer. Cridora coordinates the slot; the dealer fulfills in person.
            </p>
            <ul className="lp-book-points">
              <li>Verified dealers only — KYB-checked before they appear here</li>
              <li>Weight &amp; purity checked in front of you at handover</li>
              <li>Demo saves locally — no data leaves your browser</li>
            </ul>
          </Reveal>

          <Reveal delay={2}>
            {saved ? (
              <div className="lp-book-card lp-book-confirm" ref={confirmRef}>
                <span className="lp-kicker">Confirmed</span>
                <h3>You&apos;re booked · {saved.id}</h3>
                <dl>
                  <div><dt>Visit</dt><dd>{visitTypes.find((v) => v.id === saved.visitType)?.label}</dd></div>
                  <div><dt>Dealer</dt><dd>{dealers.find((d) => d.id === saved.dealerId)?.name ?? saved.dealerId}</dd></div>
                  <div><dt>When</dt><dd>{saved.date} · {saved.slot}</dd></div>
                  <div><dt>Contact</dt><dd>{saved.name} · {saved.phone}</dd></div>
                </dl>
                <p className="lp-book-note">
                  Demo confirmation only. In production this notifies the dealer and Cridora Ops; metal never moves through Cridora.
                </p>
                <div className="lp-book-actions">
                  <button type="button" className="btn btn-line sz-md" onClick={() => { localStorage.removeItem(BOOKING_KEY); setSaved(null) }}>
                    Book another
                  </button>
                  <Link to="/marketplace" className="btn btn-gold sz-md">Browse listings</Link>
                </div>
              </div>
            ) : (
              <form className="lp-book-card" onSubmit={onSubmit} noValidate>
                <fieldset className="lp-book-fieldset">
                  <legend>Visit type</legend>
                  <div className="lp-book-chips">
                    {visitTypes.map((v) => (
                      <button key={v.id} type="button" className={`lp-book-chip ${form.visitType === v.id ? 'on' : ''}`} onClick={() => update('visitType', v.id)}>
                        <strong>{v.label}</strong>
                        <span>{v.hint}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="lp-book-label">
                  Dealer
                  <select value={form.dealerId} onChange={(e) => update('dealerId', e.target.value)} required>
                    {dealers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} — {d.location}</option>
                    ))}
                  </select>
                </label>

                <div className="lp-book-row">
                  <label className="lp-book-label">
                    Date
                    <select value={form.date} onChange={(e) => update('date', e.target.value)} required>
                      {dates.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </label>
                  <fieldset className="lp-book-fieldset">
                    <legend>Time</legend>
                    <div className="lp-book-slots">
                      {timeSlots.map((t) => (
                        <button key={t} type="button" className={`lp-book-slot ${form.slot === t ? 'on' : ''}`} onClick={() => update('slot', t)}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <div className="lp-book-row">
                  <label className="lp-book-label">
                    Full name
                    <input type="text" autoComplete="name" placeholder="As on Emirates ID / passport" value={form.name} onChange={(e) => update('name', e.target.value)} required />
                  </label>
                  <label className="lp-book-label">
                    Mobile
                    <input type="tel" autoComplete="tel" placeholder="+971 5X XXX XXXX" value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
                  </label>
                </div>

                <label className="lp-book-label">
                  Notes <span>(optional)</span>
                  <textarea rows={2} placeholder="Order ID, preferred metal, or accessibility needs" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
                </label>

                {selectedDealer && (
                  <p className="lp-book-dealer-meta">
                    {selectedDealer.name} · {selectedDealer.location}
                    {selectedDealer.storageOffered ? ' · Storage offered' : ''}
                    {selectedDealer.buybackOffered ? ' · Buyback offered' : ''}
                  </p>
                )}

                {error && <p className="lp-book-error" role="alert">{error}</p>}

                <button type="submit" className="btn btn-gold sz-lg full">Confirm direct booking</button>
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export default function DemoAtelier() {
  const progress = useScrollProgress()

  useEffect(() => {
    const id = 'cridora-atelier-fonts'
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Outfit:wght@300;400;500;600;700&display=swap'
      document.head.appendChild(link)
    }
    if (window.location.hash === '#book' || window.location.hash === '#buy') {
      requestAnimationFrame(() => {
        document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [])

  return (
    <DemoShell activeId="atelier">
      <div className="lp">
        <div className="lp-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
        <AtelierSpotTicker />

        <section className="lp-hero lp-hero--buy">
          <div className="lp-hero-grain" aria-hidden="true" />
          <div className="lp-hero-inner">
            <div className="lp-hero-copy">
              <h1 className="lp-brand">
                <img className="lp-brand-mark" src="/assets/cridora-mark.png" alt="" width={56} height={56} />
                <span className="lp-brand-word">Cridora</span>
              </h1>
              <p className="lp-headline">A calmer way to buy gold, wherever you are.</p>
              <p className="lp-lede">
                Live rates, clear peer comparisons, and buy in one step — connected to verified UAE bullion dealers. Zero platform custody.
              </p>
              <div className="lp-cta">
                <a className="btn btn-line sz-lg" href="#book">Book a dealer visit</a>
              </div>
            </div>
            <AtelierLiveBuy variant="hero" />
          </div>
          <div className="lp-scroll-hint" aria-hidden="true">
            Scroll
            <span />
          </div>
        </section>

        <section className="lp-statement">
          <Reveal>
            <p>
              Physical metal from licensed dealers.
              <br />
              <em>Never held by the platform.</em>
            </p>
          </Reveal>
        </section>

        <section className="lp-section">
          <div className="lp-wrap">
            <div className="lp-process-grid">
              <div className="lp-process-sticky">
                <Reveal>
                  <span className="lp-kicker">How it works</span>
                  <h2 className="lp-h2">Four steps. Nothing hidden between them.</h2>
                  <p className="lp-sub">Browse, buy, hold or collect, then redeem or sell back — coordinated through Cridora, fulfilled by the dealer.</p>
                </Reveal>
              </div>
              <div className="lp-steps">
                {steps.map((s, i) => (
                  <Reveal key={s.n} delay={Math.min(i + 1, 4)}>
                    <article className="lp-step">
                      <div className="lp-step-n">{s.n}</div>
                      <div>
                        <h3>{s.h}</h3>
                        <p>{s.p}</p>
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        <DirectBooking />

        <section className="lp-section">
          <div className="lp-wrap">
            <Reveal>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <span className="lp-kicker">Live reference</span>
                  <h2 className="lp-h2">Two metals. One honest number each.</h2>
                  <p className="lp-sub">Indicative spot from the public feed — checkout always uses each dealer&apos;s disclosed quote.</p>
                </div>
                <Link to="/marketplace" className="link" style={{ color: 'var(--lp-gold)', fontSize: 13, fontWeight: 600 }}>
                  View all listings →
                </Link>
              </div>
            </Reveal>
            <div className="lp-metals">
              {Object.values(metals).map((m, i) => (
                <Reveal key={m.symbol} delay={Math.min(i + 1, 4)}>
                  <div className="lp-metal">
                    <div>
                      <div className="lp-metal-name">{m.name} · {m.purity}</div>
                      <div className="lp-metal-price tnum">
                        {m.price.toFixed(m.name === 'Silver' ? 3 : 2)}
                      </div>
                      <div className="lp-metal-meta">AED / g · {m.symbol}</div>
                    </div>
                    <div className={`lp-metal-chg ${m.chg >= 0 ? 'up' : 'down'}`}>
                      {m.chg >= 0 ? '+' : ''}{m.chg.toFixed(2)}% today
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-wrap">
            <Reveal>
              <span className="lp-kicker">Why it&apos;s cheaper</span>
              <h2 className="lp-h2">The math, not a marketing claim.</h2>
              <p className="lp-sub">Illustrative buy-side friction on a 1g gold reference. Checkout always reflects the live dealer quote.</p>
            </Reveal>
            <div className="lp-compare">
              {compare.map((c, i) => (
                <Reveal key={c.who} delay={Math.min(i + 1, 4)}>
                  <div className={`lp-compare-item ${c.hi ? 'hi' : ''}`}>
                    <div className="who">{c.who}</div>
                    <div className="pct tnum">{c.pct}</div>
                    <div className="detail">{c.detail}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-wrap">
            <Reveal>
              <span className="lp-kicker">Built for trust</span>
              <h2 className="lp-h2">Minimal is the trust signal.</h2>
              <p className="lp-sub">Say less. Show exact numbers. Demonstrate handover — don&apos;t decorate the page with reassurance theatre.</p>
            </Reveal>
            <div className="lp-pillars">
              {pillars.map((p, i) => (
                <Reveal key={p.h} delay={Math.min(i + 1, 4)}>
                  <div className="lp-pillar">
                    <h3>{p.h}</h3>
                    <p>{p.p}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-close">
          <Reveal>
            <div className="lp-close-brand">
              <img src="/assets/cridora-logo.png" alt="" width={72} height={72} />
              <div className="lp-brand"><span className="lp-brand-word">Cridora</span></div>
            </div>
            <p className="lp-lede">Own real metal. From anywhere. The dealer holds it — we never do.</p>
            <div className="lp-cta">
              <a className="btn btn-gold sz-lg" href="#buy">Buy at live price</a>
              <a className="btn btn-line sz-lg" href="#book">Book a visit</a>
            </div>
          </Reveal>
        </section>
      </div>
    </DemoShell>
  )
}
