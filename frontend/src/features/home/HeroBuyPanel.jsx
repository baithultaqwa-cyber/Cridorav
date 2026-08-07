import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Scale, Sparkles } from 'lucide-react'
import { useTickerSpotPrices } from '../../lib/spotPriceCache'
import { heroCompareRows } from './heroCompare'

const METAL_OPTIONS = [
  { key: 'gold', label: 'Gold', purities: ['24K', '22K', '21K', '18K'] },
  { key: 'silver', label: 'Silver', purities: ['999', '925'] },
]

const GRAM_PRESETS = {
  gold: [1, 5, 10, 31.1],
  silver: [1, 10, 100, 311, 1000],
}

function gramOptionLabel(metal, g) {
  if (metal === 'gold' && g === 31.1) return '1 oz (31.1g)'
  if (metal === 'silver' && g === 311) return '10 oz (311g)'
  if (metal === 'silver' && g === 1000) return '1 kg'
  return `${g}g`
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
  const [grams, setGrams] = useState(1)
  const [customGrams, setCustomGrams] = useState('')

  const purities = useMemo(
    () => METAL_OPTIONS.find((m) => m.key === metal)?.purities || ['24K'],
    [metal],
  )

  const ratePerGram = useMemo(
    () => spotRateFromPayload(spotPayload, metal, purity),
    [spotPayload, metal, purity],
  )

  const selectMetal = (next) => {
    setMetal(next)
    setPurity(defaultPurity(next))
    setCustomGrams('')
    setGrams(1)
  }

  const activeGrams = useMemo(() => {
    const c = parseFloat(customGrams)
    if (customGrams !== '' && Number.isFinite(c) && c > 0) return c
    return grams
  }, [grams, customGrams])

  const rows = useMemo(
    () => (ratePerGram != null ? heroCompareRows(activeGrams, ratePerGram, 0, metal) : null),
    [activeGrams, ratePerGram, metal],
  )

  const shopTo = `/marketplace?metal=${encodeURIComponent(metal)}&grams=${encodeURIComponent(String(activeGrams))}&sort=price`
  const maxSavings = rows?.competitors?.[0]?.vsCridoraAed
  const gramPresets = GRAM_PRESETS[metal] || GRAM_PRESETS.gold
  const titleMetal = metalLabel(metal)
  const waitingForTicker = !spotPayload
  const gramsSelectValue = customGrams !== '' ? 'custom' : String(grams)

  return (
    <div
      className="hero-buy-panel w-full mx-auto rounded-2xl text-left overflow-hidden"
      style={{
        background: 'color-mix(in srgb, var(--bg-card, #121212) 92%, transparent)',
        border: '1px solid rgba(232,195,74,0.28)',
        boxShadow: '0 20px 50px -28px rgba(232,195,74,0.35)',
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
        <section className="hero-buy-panel__section" aria-label="Metal, purity and weight">
          <div className="hero-buy-panel__selects">
            <label className="hero-buy-panel__field">
              <span className="hero-buy-panel__label">Metal</span>
              <select
                className="hero-buy-panel__select"
                value={metal}
                onChange={(e) => selectMetal(e.target.value)}
                aria-label="Metal"
              >
                {METAL_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="hero-buy-panel__field">
              <span className="hero-buy-panel__label">
                {metal === 'silver' ? 'Fineness' : 'Purity'}
              </span>
              <select
                className="hero-buy-panel__select"
                value={purity}
                onChange={(e) => setPurity(e.target.value)}
                aria-label={metal === 'silver' ? 'Fineness' : 'Purity'}
              >
                {purities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="hero-buy-panel__field">
              <span className="hero-buy-panel__label">Weight</span>
              <select
                className="hero-buy-panel__select"
                value={gramsSelectValue}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'custom') {
                    setCustomGrams(customGrams || String(grams))
                    return
                  }
                  setGrams(Number(v))
                  setCustomGrams('')
                }}
                aria-label="Weight"
              >
                {gramPresets.map((g) => (
                  <option key={g} value={String(g)}>
                    {gramOptionLabel(metal, g)}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </label>
          </div>

          {gramsSelectValue === 'custom' ? (
            <input
              type="number"
              min="0.1"
              step="0.1"
              inputMode="decimal"
              placeholder="Enter grams"
              value={customGrams}
              onChange={(e) => setCustomGrams(e.target.value)}
              className="hero-buy-panel__input"
              aria-label="Custom grams"
            />
          ) : null}
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
                <span className="tabular-nums">
                  {activeGrams}g × AED {rows.ratePerGram.toFixed(2)}/g ticker
                </span>
              </p>
              {Number.isFinite(maxSavings) && maxSavings > 0 && (
                <p className="hero-buy-panel__savings">
                  Typically AED {aedAmount(maxSavings)} less than banks and retail — before you even compare
                </p>
              )}
              <p className="hero-buy-panel__footnote">
                Compared metal-only (same as peers). Cridora Assurance and product fees appear at checkout.
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
                Peer totals are illustrative metal premiums only (no processing on either side),
                scaled from the {purity} {titleMetal} ticker — not direct competitor API feeds.
                Checkout adds Cridora Assurance on the product you choose.
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
