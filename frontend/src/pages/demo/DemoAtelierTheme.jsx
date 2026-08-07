import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  Camera,
  CreditCard,
  Fingerprint,
  PieChart,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  WifiOff,
} from 'lucide-react'
import DemoShell from './DemoShell'
import { API_SPOT_PRICES } from '../../config'
import { writeSpotPriceCache, useTickerSpotPrices } from '../../lib/spotPriceCache'
import { TABS, copy, COUNTRIES, LEDGER } from './atelierThemeCopy'
import './atelier-theme.css'

const FALLBACK = { gold24: 478.25, silver999: 6.873 }
const TIMEFRAMES = ['1D', '1W', '1M', '1Y']
const ICONS = [
  { name: 'ShieldCheck', Icon: ShieldCheck },
  { name: 'TrendingUp', Icon: TrendingUp },
  { name: 'CreditCard', Icon: CreditCard },
  { name: 'Smartphone', Icon: Smartphone },
  { name: 'Fingerprint', Icon: Fingerprint },
  { name: 'Camera', Icon: Camera },
  { name: 'PieChart', Icon: PieChart },
  { name: 'Bell', Icon: Bell },
  { name: 'Settings', Icon: Settings },
  { name: 'Shield', Icon: Shield },
  { name: 'Search', Icon: Search },
  { name: 'RefreshCw', Icon: RefreshCw },
]

function pickRates(data) {
  if (!data) return null
  const gold24 = Number(data.gold?.['24K'])
  const silver999 = Number(data.silver?.['999'])
  if (!(gold24 > 0) || !(silver999 > 0)) return null
  return { gold24, silver999 }
}

function fmt(n, digits = 2, locale = 'en-AE') {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function buildSeries(base, points, seed) {
  const out = []
  let v = base
  for (let i = 0; i < points; i++) {
    const wobble = Math.sin((i + seed) * 0.45) * base * 0.008 + Math.cos((i + seed) * 0.19) * base * 0.004
    v = Math.max(base * 0.92, v + wobble * 0.15)
    out.push(v)
  }
  return out
}

function statusBadge(status, t) {
  if (status === 'allocated') return <span className="at-badge at-badge-success">{t.badgeAllocated}</span>
  if (status === 'pending') return <span className="at-badge at-badge-warning">{t.badgePending}</span>
  return <span className="at-badge at-badge-danger">{t.badgeLiq}</span>
}

export default function DemoAtelierTheme() {
  const { data: cached } = useTickerSpotPrices()
  const [lang, setLang] = useState('en')
  const [tab, setTab] = useState('components')
  const [rates, setRates] = useState(() => pickRates(cached) || FALLBACK)
  const [live, setLive] = useState(false)
  const [smsOn, setSmsOn] = useState(true)
  const [grams, setGrams] = useState(50)
  const [openFaq, setOpenFaq] = useState('faq1')
  const [metal, setMetal] = useState('gold')
  const [tf, setTf] = useState('1M')
  const [hoverIdx, setHoverIdx] = useState(null)
  const [openRow, setOpenRow] = useState(null)

  const t = copy[lang]
  const locale = lang === 'ar' ? 'ar-AE' : 'en-AE'
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  const fetchSpot = useCallback(async () => {
    try {
      const res = await fetch(API_SPOT_PRICES, { cache: 'no-store' })
      if (!res.ok) throw new Error('http')
      const data = await res.json()
      writeSpotPriceCache(data)
      const next = pickRates(data)
      if (next) {
        setRates(next)
        setLive(true)
      }
    } catch {
      const fromCache = pickRates(cached)
      if (fromCache) setRates(fromCache)
      setLive(false)
    }
  }, [cached])

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap'
    document.head.appendChild(link)
    return () => { link.remove() }
  }, [])

  useEffect(() => {
    void fetchSpot()
    const id = setInterval(() => void fetchSpot(), 60_000)
    return () => clearInterval(id)
  }, [fetchSpot])

  useEffect(() => {
    const next = pickRates(cached)
    if (next) setRates(next)
  }, [cached])

  const spot = metal === 'gold' ? rates.gold24 : rates.silver999
  const points = tf === '1D' ? 24 : tf === '1W' ? 28 : tf === '1M' ? 32 : 40
  const series = useMemo(
    () => buildSeries(spot, points, metal === 'gold' ? 2 : 7),
    [spot, points, metal],
  )

  const chart = useMemo(() => {
    const w = 640
    const h = 220
    const pad = 16
    const min = Math.min(...series)
    const max = Math.max(...series)
    const span = max - min || 1
    const coords = series.map((v, i) => {
      const x = pad + (i / (series.length - 1)) * (w - pad * 2)
      const y = pad + (1 - (v - min) / span) * (h - pad * 2)
      return [x, y]
    })
    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${h - 4} L${coords[0][0].toFixed(1)},${h - 4} Z`
    return { w, h, coords, line, area, min, max }
  }, [series])

  const high = chart.max
  const low = chart.min
  const ret = ((series[series.length - 1] - series[0]) / series[0]) * 100
  const valuation = grams * rates.gold24
  const spread = 0.12

  return (
    <DemoShell activeId="atelier-theme">
      <div className="at" dir={dir} lang={lang}>
        <div className="at-feed" role="region" aria-label={t.liveFeed}>
          <span className="at-feed-kicker">{t.liveFeed}</span>
          <span className="at-feed-item">
            <strong>{t.goldLabel}</strong>
            <span>AED {fmt(rates.gold24, 2, locale)}/g</span>
          </span>
          <span className="at-feed-item">
            <strong>{t.silverLabel}</strong>
            <span>AED {fmt(rates.silver999, 3, locale)}/g</span>
          </span>
          <span className="at-feed-badge">
            {t.spread} ${fmt(spread, 2, 'en-US')}/g
          </span>
          <span className="at-feed-badge ok">
            {live ? <span className="at-feed-dot" aria-hidden /> : null}
            {t.lowVol}
          </span>
        </div>

        <header className="at-hero">
          <div>
            <p className="at-sub">{t.subtitle}</p>
            <h1 className="at-display">{t.brand}</h1>
            <p className="at-tagline">{t.tagline}</p>
          </div>
          <div className="at-lang" role="group" aria-label="Language">
            <button type="button" className={lang === 'en' ? 'is-on' : ''} onClick={() => setLang('en')}>
              {t.langEn}
            </button>
            <button type="button" className={lang === 'ar' ? 'is-on' : ''} onClick={() => setLang('ar')}>
              {t.langAr}
            </button>
          </div>
        </header>

        <nav className="at-tabs" aria-label="Theme sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`at-tab${tab === item.id ? ' is-on' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item[lang]}
            </button>
          ))}
        </nav>

        <div className="at-panel">
          {tab === 'components' && (
            <>
              <section className="at-section">
                <h2>{t.sectionButtons}</h2>
                <div className="at-row">
                  <button type="button" className="at-btn at-btn-primary">{t.btnPrimary}</button>
                  <button type="button" className="at-btn at-btn-secondary">{t.btnSecondary}</button>
                  <button type="button" className="at-btn at-btn-outline">{t.btnOutline}</button>
                  <button type="button" className="at-btn at-btn-success">{t.btnSuccess}</button>
                  <button type="button" className="at-btn at-btn-danger">{t.btnDanger}</button>
                  <button type="button" className="at-btn at-btn-primary is-disabled" disabled>{t.btnDisabled}</button>
                </div>
              </section>

              <section className="at-section">
                <h2>{t.sectionBadges}</h2>
                <div className="at-row">
                  <span className="at-badge at-badge-success">{t.badgeAllocated}</span>
                  <span className="at-badge at-badge-warning">{t.badgePending}</span>
                  <span className="at-badge at-badge-danger">{t.badgeLiq}</span>
                  <span className="at-badge at-badge-violet">{t.badgeCbu}</span>
                  <span className="at-badge at-badge-neutral">{t.badgeTier}</span>
                </div>
              </section>

              <section className="at-section">
                <h2>{t.sectionCards}</h2>
                <div className="at-cards">
                  <article className="at-asset">
                    <span className="at-badge at-badge-success">{t.badgeAllocated}</span>
                    <h3>{t.cardGoldTitle}</h3>
                    <p>{t.cardGoldMeta}</p>
                    <div className="at-price">AED {fmt(50 * rates.gold24, 0, locale)}</div>
                  </article>
                  <article className="at-asset">
                    <span className="at-badge at-badge-violet">{t.badgeCbu}</span>
                    <h3>{t.cardSilverTitle}</h3>
                    <p>{t.cardSilverMeta}</p>
                    <div className="at-price">AED {fmt(500 * rates.silver999, 0, locale)}</div>
                  </article>
                </div>
              </section>

              <section className="at-section">
                <h2>{t.sectionInputs}</h2>
                <div className="at-row" style={{ marginBottom: 16 }}>
                  <div className="at-field">
                    <Search size={16} aria-hidden />
                    <input type="search" placeholder={t.searchPh} aria-label={t.searchPh} />
                  </div>
                  <label className="at-toggle">
                    <input type="checkbox" checked={smsOn} onChange={(e) => setSmsOn(e.target.checked)} />
                    <span className="at-switch" aria-hidden />
                    {t.toggleSms}
                  </label>
                </div>
                <div className="at-slider-block">
                  <label htmlFor="at-weight">{t.sliderLabel}</label>
                  <div className="hint">{t.sliderHint}</div>
                  <input
                    id="at-weight"
                    type="range"
                    min={5}
                    max={500}
                    step={5}
                    value={grams}
                    onChange={(e) => setGrams(Number(e.target.value))}
                  />
                  <div className="at-slider-meta">
                    <div>
                      {t.valuation}
                      <strong>AED {fmt(valuation, 0, locale)}</strong>
                    </div>
                    <div>
                      {grams}g Au
                      <strong style={{ color: 'var(--at-success)' }}>{t.yieldLabel} 14.2% APY</strong>
                    </div>
                  </div>
                </div>
              </section>

              <section className="at-section">
                <h2>{t.sectionFaq}</h2>
                {[
                  { id: 'faq1', q: t.faq1q, a: t.faq1a },
                  { id: 'faq2', q: t.faq2q, a: t.faq2a },
                  { id: 'faq3', q: t.faq3q, a: t.faq3a },
                ].map((item) => (
                  <details
                    key={item.id}
                    className="at-acc"
                    open={openFaq === item.id}
                    onToggle={(e) => {
                      if (e.currentTarget.open) setOpenFaq(item.id)
                      else if (openFaq === item.id) setOpenFaq(null)
                    }}
                  >
                    <summary>{item.q}</summary>
                    <p>{item.a}</p>
                  </details>
                ))}
              </section>
            </>
          )}

          {tab === 'rates' && (
            <section className="at-section">
              <h2>{t.chartTitle}</h2>
              <div className="at-metal-switch">
                <button type="button" className={metal === 'gold' ? 'is-on' : ''} onClick={() => setMetal('gold')}>
                  {t.metalGold}
                </button>
                <button type="button" className={metal === 'silver' ? 'is-on' : ''} onClick={() => setMetal('silver')}>
                  {t.metalSilver}
                </button>
              </div>
              <div className="at-chart-wrap">
                <div className="at-tf">
                  {TIMEFRAMES.map((key) => (
                    <button key={key} type="button" className={tf === key ? 'is-on' : ''} onClick={() => setTf(key)}>
                      {key}
                    </button>
                  ))}
                </div>
                <svg
                  className="at-chart"
                  viewBox={`0 0 ${chart.w} ${chart.h}`}
                  onMouseLeave={() => setHoverIdx(null)}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const x = ((e.clientX - rect.left) / rect.width) * chart.w
                    let best = 0
                    let bestDist = Infinity
                    chart.coords.forEach(([cx], i) => {
                      const d = Math.abs(cx - x)
                      if (d < bestDist) {
                        bestDist = d
                        best = i
                      }
                    })
                    setHoverIdx(best)
                  }}
                >
                  <defs>
                    <linearGradient id="atFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e8c34a" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#e8c34a" stopOpacity="0" />
                    </linearGradient>
                    <filter id="atGlow">
                      <feGaussianBlur stdDeviation="2.2" result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path d={chart.area} fill="url(#atFill)" />
                  <path d={chart.line} fill="none" stroke="#e8c34a" strokeWidth="2.2" filter="url(#atGlow)" />
                  {hoverIdx != null && chart.coords[hoverIdx] && (
                    <>
                      <line
                        x1={chart.coords[hoverIdx][0]}
                        x2={chart.coords[hoverIdx][0]}
                        y1={8}
                        y2={chart.h - 8}
                        stroke="rgba(246,239,221,0.25)"
                        strokeDasharray="3 4"
                      />
                      <circle
                        cx={chart.coords[hoverIdx][0]}
                        cy={chart.coords[hoverIdx][1]}
                        r="4.5"
                        fill="#f0cd5e"
                        stroke="#0c0a07"
                        strokeWidth="2"
                      />
                    </>
                  )}
                </svg>
                <div className="at-tooltip">
                  {hoverIdx != null
                    ? `${tf} · ${fmt(series[hoverIdx], metal === 'gold' ? 2 : 3, locale)} AED/g`
                    : `${metal === 'gold' ? t.goldLabel : t.silverLabel} · AED ${fmt(spot, metal === 'gold' ? 2 : 3, locale)}/g`}
                </div>
              </div>
              <div className="at-stats">
                <div className="at-stat">
                  <div className="k">{t.high1y}</div>
                  <div className="v">AED {fmt(high, 2, locale)}</div>
                </div>
                <div className="at-stat">
                  <div className="k">{t.low1y}</div>
                  <div className="v">AED {fmt(low, 2, locale)}</div>
                </div>
                <div className="at-stat">
                  <div className="k">{t.ret1y}</div>
                  <div className={`v${ret >= 0 ? ' up' : ''}`}>
                    {ret >= 0 ? '+' : ''}
                    {fmt(ret, 1, locale)}%
                  </div>
                </div>
              </div>
            </section>
          )}

          {tab === 'states' && (
            <div className="at-state-grid">
              <div className="at-state-card">
                <h3>{t.skeleton}</h3>
                <div className="at-skel lg" />
                <div className="at-skel" />
                <div className="at-skel sm" />
              </div>
              <div className="at-state-card">
                <div className="at-spinner" aria-hidden />
                <h3>{t.spinnerTitle}</h3>
                <p>{t.spinnerDesc}</p>
              </div>
              <div className="at-state-card">
                <WifiOff size={28} color="#e8c34a" style={{ marginBottom: 10 }} />
                <h3>{t.offlineTitle}</h3>
                <p>{t.offlineDesc}</p>
                <button type="button" className="at-btn at-btn-outline" onClick={() => void fetchSpot()}>
                  {t.retry}
                </button>
              </div>
              <div className="at-state-card">
                <h3>{t.notFoundTitle}</h3>
                <p>{t.notFoundDesc}</p>
                <Link to="/" className="at-btn at-btn-primary">{t.returnHome}</Link>
              </div>
            </div>
          )}

          {tab === 'tables' && (
            <section className="at-section">
              <h2>{t.ledgerTitle}</h2>
              <p className="at-hint">{t.expandHint}</p>
              <div className="at-table-wrap">
                <table className="at-table">
                  <thead>
                    <tr>
                      <th>{t.colRef}</th>
                      <th>{t.colType}</th>
                      <th>{t.colWeight}</th>
                      <th>{t.colAmount}</th>
                      <th>{t.colStatus}</th>
                      <th>{t.colAction}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEDGER.map((row) => (
                      <Fragment key={row.ref}>
                        <tr
                          className={openRow === row.ref ? 'is-open' : ''}
                          onClick={() => setOpenRow(openRow === row.ref ? null : row.ref)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="tnum">{row.ref}</td>
                          <td>{row.type[lang]}</td>
                          <td>{row.weight}</td>
                          <td className="tnum">AED {fmt(row.amount, 0, locale)}</td>
                          <td>{statusBadge(row.status, t)}</td>
                          <td>
                            <button type="button" className="linkish" onClick={(e) => { e.stopPropagation(); setOpenRow(openRow === row.ref ? null : row.ref) }}>
                              {t.viewLedger}
                            </button>
                          </td>
                        </tr>
                        {openRow === row.ref ? (
                          <tr className="at-audit">
                            <td colSpan={6}>
                              <strong>{t.auditDate}:</strong> 2026-08-07 · 14:32 GST
                              {' · '}
                              <strong>{t.auditVault}:</strong> {t.vaultLoc}
                              {' · '}
                              <strong>{t.auditSerial}:</strong> {row.serial}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'flags' && (
            <>
              <section className="at-section">
                <h2>{t.countriesTitle}</h2>
                <div className="at-countries">
                  {COUNTRIES.map((c) => (
                    <div key={c.ccy} className="at-country">
                      <span className="flag" aria-hidden>{c.flag}</span>
                      <div>
                        <div className="name">{c.name[lang]}</div>
                        <div className="meta">{c.dial} · {c.ccy}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="at-section">
                <h2>{t.iconsTitle}</h2>
                <div className="at-icons">
                  {ICONS.map(({ name, Icon }) => (
                    <div key={name} className="at-icon-cell">
                      <Icon size={22} strokeWidth={1.75} />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </DemoShell>
  )
}
