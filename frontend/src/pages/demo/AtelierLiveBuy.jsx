import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_MARKET_MATRIX, API_SPOT_PRICES } from '../../config'
import { writeSpotPriceCache, useTickerSpotPrices } from '../../lib/spotPriceCache'
import { heroCompareRows, formatHeroSavingsLine, heroNoonOgoldSavings } from '../../features/home/heroCompare'
const GRAM_PRESETS = {
  gold: [
    { g: 1, label: '1g' },
    { g: 5, label: '5g' },
    { g: 10, label: '10g' },
    { g: 31.1, label: '1 oz' },
  ],
  silver: [
    { g: 1, label: '1g' },
    { g: 10, label: '10g' },
    { g: 100, label: '100g' },
    { g: 311, label: '10 oz' },
    { g: 1000, label: '1 kg' },
  ],
}

const FALLBACK_SPOT = {
  gold: { '24K': 478.25 },
  silver: { '999': 6.873 },
}

function spotRate(data, metal) {
  if (!data) return null
  if (metal === 'silver') {
    const v = Number(data.silver?.['999'])
    return Number.isFinite(v) && v > 0 ? v : null
  }
  const v = Number(data.gold?.['24K'])
  return Number.isFinite(v) && v > 0 ? v : null
}

function fmtAed(n, digits = 2) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-AE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function fmtGrams(n) {
  if (!Number.isFinite(n)) return ''
  if (n >= 100) return String(Math.round(n * 100) / 100)
  if (n >= 10) return String(Math.round(n * 1000) / 1000)
  return String(Math.round(n * 10000) / 10000)
}

/**
 * Atelier live purchase: gold/silver tabs, AED↔grams, presets, competitor compare, Buy now.
 * @param {{
 *   variant?: 'hero' | 'section',
 *   initialGrams?: number,
 *   panelTitle?: string,
 *   showPersonalSavings?: boolean,
 * }} props
 */
export default function AtelierLiveBuy({
  variant = 'hero',
  initialGrams,
  panelTitle,
  showPersonalSavings = false,
}) {
  const isHero = variant === 'hero'
  const startGrams = Number(initialGrams) > 0 ? Number(initialGrams) : 1
  const { data: tickerSpot } = useTickerSpotPrices()
  const [spot, setSpot] = useState(null)
  const [matrix, setMatrix] = useState(null)
  const [metal, setMetal] = useState('gold')
  const [gramsStr, setGramsStr] = useState(String(startGrams))
  const [aedStr, setAedStr] = useState('')
  const [presetG, setPresetG] = useState(startGrams)
  const lastEdit = useRef('grams')
  const [spotStatus, setSpotStatus] = useState('loading')

  const fetchSpot = useCallback(async () => {
    try {
      const res = await fetch(API_SPOT_PRICES, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      writeSpotPriceCache(data)
      setSpot(data)
      setSpotStatus('live')
    } catch {
      if (tickerSpot) {
        setSpot(tickerSpot)
        setSpotStatus('cache')
      } else {
        setSpot((prev) => prev || FALLBACK_SPOT)
        setSpotStatus((s) => (s === 'live' ? s : 'fallback'))
      }
    }
  }, [tickerSpot])

  const fetchMatrix = useCallback(async () => {
    try {
      const res = await fetch(API_MARKET_MATRIX, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setMatrix(await res.json())
    } catch {
      /* keep last good / hero fallback */
    }
  }, [])

  useEffect(() => {
    fetchSpot()
    fetchMatrix()
    const t = setInterval(() => {
      fetchSpot()
      fetchMatrix()
    }, 45_000)
    return () => clearInterval(t)
  }, [fetchSpot, fetchMatrix])

  useEffect(() => {
    if (tickerSpot && !spot) {
      setSpot(tickerSpot)
      setSpotStatus('cache')
    }
  }, [tickerSpot, spot])

  const rate = useMemo(() => {
    const live = spotRate(spot, metal)
    if (live != null) return live
    return spotRate(FALLBACK_SPOT, metal)
  }, [spot, metal])

  const grams = useMemo(() => {
    const n = parseFloat(gramsStr)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [gramsStr])

  // Keep the other field in sync when rate or edited side changes.
  useEffect(() => {
    if (!rate || rate <= 0) return
    if (lastEdit.current === 'grams') {
      const g = parseFloat(gramsStr)
      if (Number.isFinite(g) && g > 0) {
        setAedStr(fmtAed(g * rate, 2))
      } else {
        setAedStr('')
      }
    } else {
      const a = parseFloat(aedStr)
      if (Number.isFinite(a) && a > 0) {
        setGramsStr(fmtGrams(a / rate))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync from last-edited side only
  }, [rate, metal])

  function selectMetal(next) {
    const nextRate = spotRate(spot, next) || spotRate(FALLBACK_SPOT, next)
    setMetal(next)
    lastEdit.current = 'grams'
    const first = GRAM_PRESETS[next][0].g
    setPresetG(first)
    setGramsStr(String(first))
    if (nextRate > 0) setAedStr(fmtAed(first * nextRate, 2))
  }

  function selectPreset(g) {
    lastEdit.current = 'grams'
    setPresetG(g)
    setGramsStr(String(g))
    if (rate > 0) setAedStr(fmtAed(g * rate, 2))
  }

  function onGramsChange(e) {
    const v = e.target.value
    lastEdit.current = 'grams'
    setGramsStr(v)
    setPresetG(null)
    const g = parseFloat(v)
    if (Number.isFinite(g) && g > 0 && rate > 0) {
      setAedStr(fmtAed(g * rate, 2))
      const match = GRAM_PRESETS[metal].find((p) => Math.abs(p.g - g) < 0.0001)
      if (match) setPresetG(match.g)
    } else {
      setAedStr('')
    }
  }

  function onAedChange(e) {
    const v = e.target.value
    lastEdit.current = 'aed'
    setAedStr(v)
    setPresetG(null)
    const a = parseFloat(v)
    if (Number.isFinite(a) && a > 0 && rate > 0) {
      const g = a / rate
      setGramsStr(fmtGrams(g))
      const match = GRAM_PRESETS[metal].find((p) => Math.abs(p.g - g) < 0.05)
      if (match) setPresetG(match.g)
    } else {
      setGramsStr('')
    }
  }

  const activeGrams = grams > 0 ? grams : 0
  const cridoraTotal = activeGrams > 0 && rate > 0 ? activeGrams * rate : 0

  const competitorRows = useMemo(() => {
    if (!(activeGrams > 0 && rate > 0)) return []

    if (metal === 'gold' && matrix?.rows?.length) {
      const peers = matrix.rows
        .filter((r) => !r.is_cridora && r.rate_24k != null && Number(r.rate_24k) > 0)
        .map((r) => {
          const peerRate = Number(r.rate_24k)
          const total = peerRate * activeGrams
          return {
            id: r.id,
            name: r.name,
            short: r.name.replace(/\s*\(.*\)\s*$/, '').replace(/ Gold & Silver Account$/, '').trim(),
            ratePerGram: peerRate,
            totalAed: total,
            vsCridoraAed: total - cridoraTotal,
            live: r.availability === 'live' || r.availability === 'cached',
            segment: r.segment || '',
          }
        })
        .filter((r) => r.vsCridoraAed > 0)
        .sort((a, b) => b.vsCridoraAed - a.vsCridoraAed)
        .slice(0, isHero ? 4 : 6)
      if (peers.length) return peers
    }

    const illus = heroCompareRows(activeGrams, rate, 0, metal)
    return (illus?.competitors || []).slice(0, isHero ? 4 : 6).map((c) => ({
      id: c.id,
      name: c.name,
      short: c.short,
      ratePerGram: c.ratePerGramEst,
      totalAed: c.totalAed,
      vsCridoraAed: c.vsCridoraAed,
      live: false,
      segment: c.category || '',
    }))
  }, [activeGrams, rate, metal, matrix, cridoraTotal, isHero])

  const compareIsLive = metal === 'gold' && competitorRows.some((r) => r.live)
  const shopTo = `/marketplace?metal=${encodeURIComponent(metal)}&grams=${encodeURIComponent(String(activeGrams || 1))}&sort=price`
  const purityLabel = metal === 'silver' ? '999' : '24K'
  const presets = GRAM_PRESETS[metal]
  const personalSavingsLine = useMemo(() => {
    if (!showPersonalSavings || metal !== 'gold' || !(activeGrams > 0 && rate > 0)) return null
    return formatHeroSavingsLine(heroNoonOgoldSavings(activeGrams, rate, matrix, 'gold'))
  }, [showPersonalSavings, metal, activeGrams, rate, matrix])
  const title = panelTitle || 'Buy gold or silver at today\u2019s rate'

  const panel = (
    <div className={`lp-buy-panel ${isHero ? 'lp-buy-panel--hero' : ''}`} id="buy">
      <div className="lp-buy-panel-head">
        <span className="lp-kicker">Live purchase</span>
        <p className="lp-buy-panel-title">{title}</p>
      </div>

      <div className="lp-buy-metal-tabs" role="tablist" aria-label="Metal">
        {['gold', 'silver'].map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={metal === m}
            className={`lp-buy-metal ${metal === m ? 'on' : ''}`}
            onClick={() => selectMetal(m)}
          >
            {m === 'gold' ? 'Gold' : 'Silver'}
          </button>
        ))}
      </div>

      <div className="lp-buy-rate-row">
        <div>
          <div className="lp-buy-rate-label">
            Live {purityLabel} {metal}
            {spotStatus === 'live' ? ' · updating' : spotStatus === 'cache' ? ' · cached' : spotStatus === 'fallback' ? ' · demo rate' : ''}
          </div>
          <div className="lp-buy-rate tnum">
            AED {fmtAed(rate, metal === 'silver' ? 3 : 2)}
            <span>/g</span>
          </div>
        </div>
        <button type="button" className="lp-buy-refresh" onClick={() => { fetchSpot(); fetchMatrix() }}>
          Refresh
        </button>
      </div>

      <div className="lp-buy-presets" role="tablist" aria-label="Predefined quantities">
        {presets.map((p) => (
          <button
            key={p.g}
            type="button"
            role="tab"
            aria-selected={presetG === p.g}
            className={`lp-buy-preset ${presetG === p.g ? 'on' : ''}`}
            onClick={() => selectPreset(p.g)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="lp-buy-inputs">
        <label className="lp-buy-field">
          <span>Grams</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="any"
            value={gramsStr}
            onChange={onGramsChange}
            placeholder="0"
          />
        </label>
        <div className="lp-buy-swap" aria-hidden="true">⇄</div>
        <label className="lp-buy-field">
          <span>AED</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="any"
            value={aedStr}
            onChange={onAedChange}
            placeholder="0.00"
          />
        </label>
      </div>

      <div className="lp-buy-total">
        <span>Your estimate</span>
        <strong className="tnum">AED {fmtAed(cridoraTotal, 2)}</strong>
      </div>

      {personalSavingsLine ? (
        <p className="lp-buy-savings-trigger" role="status">
          {personalSavingsLine}
        </p>
      ) : null}

      <Link
        to={shopTo}
        className={`btn btn-gold sz-lg full ${!(activeGrams > 0) ? 'is-disabled' : ''}`}
        aria-disabled={!(activeGrams > 0)}
        onClick={(e) => {
          if (!(activeGrams > 0)) e.preventDefault()
        }}
      >
        Buy now — {activeGrams > 0 ? `${fmtGrams(activeGrams)}g ${metal}` : 'enter amount'}
      </Link>

      <div className="lp-buy-compare">
        <div className="lp-buy-compare-head">
          <span className="lp-kicker" style={{ marginBottom: 0 }}>
            {compareIsLive ? 'Live peer rates' : 'Rate comparison'}
          </span>
          <span className="lp-buy-compare-meta">
            {compareIsLive ? 'vs Cridora' : 'vs Cridora ticker'}
          </span>
        </div>
        {competitorRows.length === 0 ? (
          <p className="lp-buy-compare-empty">Enter an amount to see competitor totals.</p>
        ) : (
          <ul className="lp-buy-compare-list">
            <li className="lp-buy-compare-row hi">
              <div>
                <strong>Cridora</strong>
                <span className="tnum">AED {fmtAed(rate, metal === 'silver' ? 3 : 2)}/g</span>
              </div>
              <div className="lp-buy-compare-tot tnum">AED {fmtAed(cridoraTotal, 0)}</div>
              <div className="lp-buy-compare-delta">Saving</div>
            </li>
            {competitorRows.map((c) => (
              <li key={c.id} className="lp-buy-compare-row">
                <div>
                  <strong>{c.short}</strong>
                  <span className="tnum">
                    ~AED {fmtAed(c.ratePerGram, metal === 'silver' ? 2 : 1)}/g
                    {c.live ? ' · live' : ''}
                  </span>
                </div>
                <div className="lp-buy-compare-tot tnum">AED {fmtAed(c.totalAed, 0)}</div>
                <div className="lp-buy-compare-delta tnum">
                  +{fmtAed(Math.max(0, c.vsCridoraAed), 0)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )

  if (isHero) return panel

  return (
    <section className="lp-section lp-buy">
      <div className="lp-wrap">{panel}</div>
    </section>
  )
}
