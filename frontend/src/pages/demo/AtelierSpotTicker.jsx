import { useCallback, useEffect, useState } from 'react'
import { API_SPOT_PRICES } from '../../config'
import { writeSpotPriceCache, useTickerSpotPrices } from '../../lib/spotPriceCache'

const FALLBACK = { gold24: 478.25, silver999: 6.873 }

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
 */
export default function AtelierSpotTicker() {
  const { data: cached } = useTickerSpotPrices()
  const [rates, setRates] = useState(() => pickRates(cached) || FALLBACK)
  const [status, setStatus] = useState(pickRates(cached) ? 'live' : 'loading')

  const fetchSpot = useCallback(async () => {
    try {
      const res = await fetch(API_SPOT_PRICES, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      writeSpotPriceCache(data)
      const next = pickRates(data)
      if (next) {
        setRates(next)
        setStatus('live')
        return
      }
      throw new Error('incomplete')
    } catch {
      const fromCache = pickRates(cached)
      if (fromCache) {
        setRates(fromCache)
        setStatus('cache')
      } else {
        setRates((prev) => prev || FALLBACK)
        setStatus((s) => (s === 'live' ? s : 'fallback'))
      }
    }
  }, [cached])

  useEffect(() => {
    void fetchSpot()
    const id = setInterval(() => void fetchSpot(), 60_000)
    return () => clearInterval(id)
  }, [fetchSpot])

  useEffect(() => {
    const next = pickRates(cached)
    if (next) {
      setRates(next)
      setStatus((s) => (s === 'fallback' ? 'cache' : s === 'loading' ? 'live' : s))
    }
  }, [cached])

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
        <span className={`lp-ticker-dot${status === 'live' ? ' is-live' : ''}`} />
        {status === 'live' ? 'Live' : status === 'cache' ? 'Saved' : status === 'loading' ? 'Updating' : 'Indicative'}
      </span>
    </div>
  )
}
