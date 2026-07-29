import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Scale, Sparkles } from 'lucide-react'
import { API_AUTH_BASE } from '../../config'
import { fetchPlatformFeesCached } from '../../lib/platformFees'
import { heroCompareRows } from './heroCompare'

const GRAM_PRESETS = [1, 5, 10, 31.1]

function aedAmount(n) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

/**
 * Hero quick-buy: grams → estimate from cheapest live listing + retail comparison.
 * Purchase CTA sends users to Marketplace to pick a product.
 */
export default function HeroBuyPanel() {
  const [grams, setGrams] = useState(10)
  const [customGrams, setCustomGrams] = useState('')
  const [ratePerGram, setRatePerGram] = useState(null)
  const [productHint, setProductHint] = useState('')
  const [buyFeePct, setBuyFeePct] = useState(0.5)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr('')
      try {
        const [fees, mkt] = await Promise.all([
          fetchPlatformFeesCached().catch(() => null),
          fetch(`${API_AUTH_BASE}/marketplace/`, { cache: 'no-store' }).then((r) => r.json()),
        ])
        if (cancelled) return
        if (fees?.buy_fee_pct != null) setBuyFeePct(Number(fees.buy_fee_pct))

        const products = Array.isArray(mkt)
          ? mkt
          : Array.isArray(mkt?.items)
            ? mkt.items
            : Array.isArray(mkt?.products)
              ? mkt.products
              : Array.isArray(mkt?.results)
                ? mkt.results
                : []
        if (mkt?.buy_fee_pct != null) setBuyFeePct(Number(mkt.buy_fee_pct))
        const gold = products.filter(
          (p) =>
            String(p.metal || '').toLowerCase() === 'gold' &&
            p.in_stock !== false &&
            Number(p.final_rate_per_gram ?? p.effective_rate ?? 0) > 0,
        )
        if (!gold.length) {
          setRatePerGram(null)
          setProductHint('')
          setErr('Live gold listings will appear here when vendors stock products.')
          return
        }
        gold.sort(
          (a, b) =>
            Number(a.final_rate_per_gram ?? a.effective_rate) -
            Number(b.final_rate_per_gram ?? b.effective_rate),
        )
        const best = gold[0]
        setRatePerGram(Number(best.final_rate_per_gram ?? best.effective_rate))
        setProductHint(
          best.purity
            ? `Cheapest live ${best.purity} listing`
            : 'Cheapest live gold listing',
        )
      } catch {
        if (!cancelled) setErr('Could not load live rates. Browse the marketplace for current prices.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const activeGrams = useMemo(() => {
    const c = parseFloat(customGrams)
    if (customGrams !== '' && Number.isFinite(c) && c > 0) return c
    return grams
  }, [grams, customGrams])

  const rows = useMemo(
    () => (ratePerGram != null ? heroCompareRows(activeGrams, ratePerGram, buyFeePct) : null),
    [activeGrams, ratePerGram, buyFeePct],
  )

  const shopTo = `/marketplace?metal=gold&grams=${encodeURIComponent(String(activeGrams))}&sort=price`

  const maxSavings = rows?.competitors?.[0]?.vsCridoraAed

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
          <span>Quick gold estimate</span>
        </div>
        {productHint ? (
          <p className="hero-buy-panel__head-hint">{productHint}</p>
        ) : null}
      </header>

      <div className="hero-buy-panel__body">
        <section className="hero-buy-panel__section" aria-label="Select grams">
          <div className="hero-buy-panel__label">Grams</div>
          <div className="hero-buy-panel__presets" role="group" aria-label="Gram presets">
            {GRAM_PRESETS.map((g) => {
              const active = customGrams === '' && grams === g
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
                  {g === 31.1 ? '1 oz' : `${g}g`}
                </button>
              )
            })}
          </div>
          <input
            type="number"
            min="0.1"
            step="0.1"
            inputMode="decimal"
            placeholder="Or enter custom grams"
            value={customGrams}
            onChange={(e) => setCustomGrams(e.target.value)}
            className="hero-buy-panel__input"
            aria-label="Custom grams"
          />
        </section>

        {loading && (
          <p className="hero-buy-panel__status">Loading live dealer rates…</p>
        )}
        {err && !rows && (
          <p className="hero-buy-panel__status hero-buy-panel__status--warn">{err}</p>
        )}

        {rows && (
          <>
            <section className="hero-buy-panel__quote" aria-label="Cridora estimate">
              <div className="hero-buy-panel__quote-top">
                <span className="hero-buy-panel__quote-brand">
                  <Sparkles size={12} aria-hidden />
                  Cridora (from)
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
                  Lower all-in than listed peers — save up to AED {aedAmount(maxSavings)} on this size
                </p>
              )}
              <p className="hero-buy-panel__footnote">
                Final price depends on the product you choose.
              </p>
            </section>

            <section className="hero-buy-panel__section" aria-label="Price comparison">
              <div className="hero-buy-panel__label">
                vs OGold, SaveGold, banks &amp; retail (illustrative)
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
                        ~AED {c.ratePerGramEst.toFixed(1)}/g
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
                scaled from Cridora&apos;s live listing — not direct Noon/OGold/SaveGold API feeds.
                Verified bullion listings set your actual Cridora quote.
              </p>
            </section>
          </>
        )}

        <Link
          to={shopTo}
          className="btn-gold hero-buy-panel__cta group tap-target"
        >
          Purchase — choose product
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
