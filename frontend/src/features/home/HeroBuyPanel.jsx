import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Scale, Sparkles } from 'lucide-react'
import { fetchPlatformFeesCached } from '../../lib/platformFees'
import { useTickerSpotPrices } from '../../lib/spotPriceCache'
import { heroCompareRows } from './heroCompare'

const METAL_OPTIONS = [
  { key: 'gold', label: 'Gold', purities: ['24K', '22K', '21K', '18K'] },
  { key: 'silver', label: 'Silver', purities: ['999', '925'] },
]

const GRAM_PRESETS = {
  gold: [1, 5, 10, 31.1],
  silver: [10, 100, 311, 1000],
}

function aedAmount(n) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function spotRateFromPayload(data, metal, purity) {
  if (!data || typeof data !== 'object') return null
  const m = String(metal || '').toLowerCase()
  const p = String(purity || '').trim()
  if (!p) return null
  if (m === 'gold' && data.gold && typeof data.gold === 'object') {
    const v = Number(data.gold[p] ?? data.gold[p.toUpperCase()])
    return Number.isFinite(v) && v > 0 ? v : null
  }
  if (m === 'silver' && data.silver && typeof data.silver === 'object') {
    const v = Number(data.silver[p])
    return Number.isFinite(v) && v > 0 ? v : null
  }
  return null
}

function defaultPurity(metal) {
  return metal === 'silver' ? '999' : '24K'
}

function metalLabel(metal) {
  return metal === 'silver' ? 'silver' : 'gold'
}

/**
 * Hero quick-buy: metal + purity → on-page ticker rate + retail comparison.
 * Purchase CTA sends users to Marketplace to pick a product.
 */
export default function HeroBuyPanel() {
  const { data: spotPayload } = useTickerSpotPrices()
  const [metal, setMetal] = useState('gold')
  const [purity, setPurity] = useState('24K')
  const [grams, setGrams] = useState(10)
  const [customGrams, setCustomGrams] = useState('')
  const [buyFeePct, setBuyFeePct] = useState(0.5)
  const [feesLoading, setFeesLoading] = useState(true)

  const purities = useMemo(
    () => METAL_OPTIONS.find((m) => m.key === metal)?.purities || ['24K'],
    [metal],
  )

  const ratePerGram = useMemo(
    () => spotRateFromPayload(spotPayload, metal, purity),
    [spotPayload, metal, purity],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setFeesLoading(true)
      try {
        const fees = await fetchPlatformFeesCached().catch(() => null)
        if (!cancelled && fees?.buy_fee_pct != null) setBuyFeePct(Number(fees.buy_fee_pct))
      } finally {
        if (!cancelled) setFeesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectMetal = (next) => {
    setMetal(next)
    setPurity(defaultPurity(next))
    setCustomGrams('')
    setGrams(next === 'silver' ? 100 : 10)
  }

  const activeGrams = useMemo(() => {
    const c = parseFloat(customGrams)
    if (customGrams !== '' && Number.isFinite(c) && c > 0) return c
    return grams
  }, [grams, customGrams])

  const rows = useMemo(
    () => (ratePerGram != null ? heroCompareRows(activeGrams, ratePerGram, buyFeePct, metal) : null),
    [activeGrams, ratePerGram, buyFeePct, metal],
  )

  const shopTo = `/marketplace?metal=${encodeURIComponent(metal)}&grams=${encodeURIComponent(String(activeGrams))}&sort=price`
  const maxSavings = rows?.competitors?.[0]?.vsCridoraAed
  const gramPresets = GRAM_PRESETS[metal] || GRAM_PRESETS.gold
  const titleMetal = metalLabel(metal)
  const waitingForTicker = !spotPayload && feesLoading === false

  return (
    <div
      className="hero-buy-panel w-full mx-auto rounded-2xl text-left overflow-hidden"
      style={{
        background: 'color-mix(in srgb, var(--bg-card, #121212) 92%, transparent)',
        border: '1px solid rgba(201,168,76,0.28)',
        boxShadow: '0 20px 50px -28px rgba(201,168,76,0.35)',
      }}
    >
      <header className="hero-buy-panel__head">
        <div className="hero-buy-panel__head-title">
          <Scale size={14} className="text-[var(--gold)] flex-shrink-0" aria-hidden />
          <span>What would your {titleMetal} be worth today?</span>
        </div>
        {ratePerGram != null ? (
          <p className="hero-buy-panel__head-hint">
            Live {purity} {titleMetal} — same as the ticker above
          </p>
        ) : null}
      </header>

      <div className="hero-buy-panel__body">
        <section className="hero-buy-panel__section" aria-label="Select metal">
          <div className="hero-buy-panel__label">Metal</div>
          <div className="hero-buy-panel__presets" role="group" aria-label="Metal">
            {METAL_OPTIONS.map((opt) => {
              const active = metal === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => selectMetal(opt.key)}
                  className={`hero-buy-panel__chip${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </section>

        <section className="hero-buy-panel__section" aria-label="Select purity">
          <div className="hero-buy-panel__label">
            {metal === 'silver' ? 'Fineness' : 'Purity'}
          </div>
          <div className="hero-buy-panel__presets" role="group" aria-label="Purity">
            {purities.map((p) => {
              const active = purity === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurity(p)}
                  className={`hero-buy-panel__chip${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </section>

        <section className="hero-buy-panel__section" aria-label="Select grams">
          <div className="hero-buy-panel__label">Grams</div>
          <div className="hero-buy-panel__presets" role="group" aria-label="Gram presets">
            {gramPresets.map((g) => {
              const active = customGrams === '' && grams === g
              const label = metal === 'gold' && g === 31.1
                ? '1 oz'
                : metal === 'silver' && g === 311
                  ? '10 oz'
                  : metal === 'silver' && g === 1000
                    ? '1 kg'
                    : `${g}g`
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setGrams(g)
                    setCustomGrams('')
                  }}
                  className={`hero-buy-panel__chip${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <input
            type="number"
            min="0.1"
            step="0.1"
            inputMode="decimal"
            placeholder="Enter grams, or choose a quick amount"
            value={customGrams}
            onChange={(e) => setCustomGrams(e.target.value)}
            className="hero-buy-panel__input"
            aria-label="Custom grams"
          />
        </section>

        {!spotPayload && (
          <p className="hero-buy-panel__status">
            {waitingForTicker ? 'Waiting for the live ticker…' : 'Loading…'}
          </p>
        )}
        {spotPayload && ratePerGram == null && (
          <p className="hero-buy-panel__status hero-buy-panel__status--warn">
            No {purity} {titleMetal} rate in the ticker right now.
          </p>
        )}

        {rows && (
          <>
            <section className="hero-buy-panel__quote" aria-label="Cridora estimate">
              <div className="hero-buy-panel__quote-top">
                <span className="hero-buy-panel__quote-brand">
                  <Sparkles size={12} aria-hidden />
                  Your price with Cridora
                </span>
                <span className="hero-buy-panel__quote-rate tabular-nums">
                  AED {rows.ratePerGram.toFixed(2)}
                  <span className="hero-buy-panel__per-g">/g</span>
                </span>
              </div>
              <div className="hero-buy-panel__quote-price tabular-nums">
                <span className="hero-buy-panel__currency">AED</span>
                <span className="gradient-gold-text">{aedAmount(rows.cridoraTotal)}</span>
              </div>
              <p className="hero-buy-panel__quote-meta">
                <span className="tabular-nums">Metal AED {aedAmount(rows.metalSubtotal)}</span>
                <span className="hero-buy-panel__dot" aria-hidden />
                <span className="tabular-nums">
                  Cridora Assurance {rows.cridoraServicePct}% (AED{' '}
                  {aedAmount(rows.cridoraService)})
                </span>
              </p>
              {Number.isFinite(maxSavings) && maxSavings > 0 && (
                <p className="hero-buy-panel__savings">
                  Typically AED {aedAmount(maxSavings)} less than banks and retail — before you even compare
                </p>
              )}
              <p className="hero-buy-panel__footnote">
                Cridora rate = today&apos;s {purity} {titleMetal} ticker. Final checkout depends on the product you choose (fees).
              </p>
            </section>

            <section className="hero-buy-panel__section" aria-label="Price comparison">
              <div className="hero-buy-panel__label">
                {metal === 'silver'
                  ? 'vs banks, apps & retail silver (illustrative)'
                  : 'vs OGold, SaveGold, banks & retail (illustrative)'}
              </div>
              <div className="hero-buy-panel__compare-head" aria-hidden>
                <span>Platform</span>
                <span>Est. total</span>
                <span>vs us</span>
              </div>
              <ul className="hero-buy-panel__compare">
                {rows.competitors.map((c) => (
                  <li key={c.id} className="hero-buy-panel__compare-row">
                    <div className="hero-buy-panel__compare-name-wrap">
                      <span className="hero-buy-panel__compare-name">{c.short}</span>
                      <span className="hero-buy-panel__compare-rate tabular-nums">
                        ~AED {c.ratePerGramEst.toFixed(metal === 'silver' ? 2 : 1)}/g
                      </span>
                      {c.hasProcessing && (
                        <span className="hero-buy-panel__proc">
                          + processing
                          {c.processingAed > 0.01
                            ? ` AED ${aedAmount(c.processingAed)}`
                            : ''}
                          {c.processingLabel ? ` · ${c.processingLabel}` : ''}
                        </span>
                      )}
                    </div>
                    <span className="hero-buy-panel__compare-price tabular-nums">
                      <span className="hero-buy-panel__currency-sm">AED</span>
                      {aedAmount(c.totalAed)}
                    </span>
                    <span className="hero-buy-panel__compare-delta tabular-nums">
                      +{aedAmount(Math.max(0, c.vsCridoraAed))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="hero-buy-panel__disclaimer">
                Peer totals are illustrative market premiums (plus typical bank/app processing)
                scaled from the {purity} {titleMetal} ticker above — not direct competitor API feeds.
                Verified bullion listings set your actual Cridora quote.
              </p>
            </section>
          </>
        )}

        <Link
          to={shopTo}
          className="btn-gold hero-buy-panel__cta group tap-target"
        >
          Get This Rate — Choose a Product
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
