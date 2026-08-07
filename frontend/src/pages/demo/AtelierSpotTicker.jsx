import { useCallback, useEffect, useRef, useState } from 'react'
import { API_SPOT_PRICES } from '../../config'
import { writeSpotPriceCache, useTickerSpotPrices } from '../../lib/spotPriceCache'
import { subscribePricesRefresh } from '../../lib/pricesRefresh'
import { hydrateFromRateLedger } from '../../lib/rateLedger'

const FALLBACK = { gold24: 478.25, silver999: 6.873 }
const POLL_MS = 60_000

function pickRates(data) {
  if (!data) return null
  const gold24 = Number(data.gold?.['24K'])
  const silver999 = Number(data.silver?.['999'])
  if (!Number.isFinite(gold24) || gold24 <= 0) return null
  if (!Number.isFinite(silver999) || silver999 <= 0) return null
  return { gold24, silver999 }
}

function fmt(n, digits) {
  return n.toLocaleString('en-AE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/**
 * Compact marquee: live Gold 24K + Silver 999 (AED/g).
 * Owns the home-page spot fetch; always keeps last known rates on screen.
 */
export default function AtelierSpotTicker() {
  const { data: cached } = useTickerSpotPrices()
  const [rates, setRates] = useState(() => pickRates(cached) || FALLBACK)
  const [hasLive, setHasLive] = useState(() => Boolean(pickRates(cached)))
  const ratesRef = useRef(rates)
  const cachedRef = useRef(cached)
  ratesRef.current = rates
  cachedRef.current = cached

  const applyRates = useCallback((next, markLive) => {
    if (!next) return
    setRates(next)
    if (markLive) setHasLive(true)
  }, [])

  const fetchSpot = useCallback(async () => {
    try {
      const res = await fetch(API_SPOT_PRICES, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      writeSpotPriceCache(data)
      const next = pickRates(data)
      if (next) {
        applyRates(next, true)
        return
      }
      throw new Error('incomplete')
    } catch {
      const fromCache = pickRates(cachedRef.current)
      if (fromCache) {
        applyRates(fromCache, true)
        return
      }
      const ledger = await hydrateFromRateLedger()
      const fromLedger = pickRates(ledger?.spot)
      if (fromLedger) {
        applyRates(fromLedger, true)
        return
      }
      if (!ratesRef.current) applyRates(FALLBACK, false)
    }
  }, [applyRates])

  useEffect(() => {
    void fetchSpot()
    const id = setInterval(() => void fetchSpot(), POLL_MS)
    return () => clearInterval(id)
  }, [fetchSpot])

  useEffect(() => subscribePricesRefresh(() => { void fetchSpot() }), [fetchSpot])

  useEffect(() => {
    const next = pickRates(cached)
    if (next) applyRates(next, true)
  }, [cached, applyRates])

  const items = [
    { key: 'g', label: 'Gold 24K', value: rates.gold24, digits: 2 },
    { key: 's', label: 'Silver 999', value: rates.silver999, digits: 3 },
  ]

  return (
    <div className="lp-ticker" role="region" aria-label="Live metal rates">
      <div className="lp-ticker-track" aria-hidden="true">
        {[0, 1, 2, 3].flatMap((loop) =>
          items.map((item) => (
            <span key={`${loop}-${item.key}`} className="lp-ticker-item">
              <span className="lp-ticker-label">{item.label}</span>
              <span className="lp-ticker-value tnum">AED {fmt(item.value, item.digits)}/g</span>
            </span>
          )),
        )}
      </div>
      <span className="lp-ticker-live">
        <span className={`lp-ticker-dot${hasLive ? ' is-live' : ''}`} />
        {hasLive ? 'Live' : 'Last rate'}
      </span>
    </div>
  )
}
