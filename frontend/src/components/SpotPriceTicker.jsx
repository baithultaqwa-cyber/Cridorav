import { useState, useEffect } from 'react'
import { API_SPOT_PRICES as API_URL } from '../config'

const BAR_STYLE = {
  background: 'rgba(201, 168, 76, 0.06)',
  borderBottom: '1px solid rgba(201, 168, 76, 0.15)',
  padding: '6px 0',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  position: 'relative',
  zIndex: 51,
}

const CACHE_KEY = 'cridora_spot_prices_v1'

function buildTickerRows(data) {
  if (Array.isArray(data.ticker_items) && data.ticker_items.length > 0) {
    return data.ticker_items.map((row) => {
      if (row.text != null && row.text !== '') {
        return { key: row.label, label: row.label, text: row.text, value: null }
      }
      return {
        key: row.label,
        label: row.label,
        value: row.value,
        text: null,
      }
    })
  }
  if (!data.gold || !data.silver) return []
  return [
    { key: 'g24', label: 'Gold 24K', value: data.gold['24K'], text: null },
    { key: 'g22', label: 'Gold 22K', value: data.gold['22K'], text: null },
    { key: 'g21', label: 'Gold 21K', value: data.gold['21K'], text: null },
    { key: 'g18', label: 'Gold 18K', value: data.gold['18K'], text: null },
    { key: 's99', label: 'Silver 999', value: data.silver['999'], text: null },
    { key: 's92', label: 'Silver 925', value: data.silver['925'], text: null },
  ]
}

function readSpotCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const { savedAt, data } = parsed
    if (!data || typeof savedAt !== 'number') return null
    const rows = buildTickerRows(data)
    if (rows.length === 0) return null
    return { ...data, _rows: rows, _fromCache: true, _cachedAt: savedAt }
  } catch {
    return null
  }
}

function writeSpotCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    /* quota / private mode */
  }
}

function initialPayload() {
  return readSpotCache()
}

export default function SpotPriceTicker() {
  const [payload, setPayload] = useState(initialPayload)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPrices(true)
    const interval = setInterval(() => fetchPrices(false), 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function fetchPrices(isInitial = false) {
    if (isInitial) setLoading(true)
    try {
      const res = await fetch(API_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const rows = buildTickerRows(data)
      if (rows.length === 0) {
        const cached = readSpotCache()
        if (cached) {
          setPayload(cached)
          setError(false)
        } else if (isInitial) {
          setPayload(null)
          setError(true)
        }
        return
      }
      writeSpotCache(data)
      setPayload({ ...data, _rows: rows })
      setError(false)
    } catch {
      const cached = readSpotCache()
      if (cached) {
        setPayload(cached)
        setError(false)
      } else if (isInitial) {
        setPayload(null)
        setError(true)
      }
    } finally {
      if (isInitial) setLoading(false)
    }
  }

  const showLoadingOnly = loading && !payload?._rows?.length && !error

  if (showLoadingOnly) {
    return (
      <div style={BAR_STYLE}>
        <div className="text-center text-[11px] tracking-[0.15em] uppercase text-[#666] py-1">
          Loading rates…
        </div>
      </div>
    )
  }

  if (error || !payload?._rows?.length) {
    const msg =
      'Live rates unavailable right now. If this persists, confirm the API is running and CORS allows this site.'
    const fallbackItems = [msg, msg, msg]
    return (
      <div style={BAR_STYLE}>
        <div
          style={{
            display: 'inline-flex',
            gap: '48px',
            animation: 'ticker-scroll 40s linear infinite',
          }}
        >
          {[...fallbackItems, ...fallbackItems].map((text, i) => (
            <span key={i} style={{ fontSize: '11px', letterSpacing: '0.08em', color: '#888' }}>
              {text}
            </span>
          ))}
        </div>
        <style>{`
          @keyframes ticker-scroll {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
        `}</style>
      </div>
    )
  }

  const source = payload.source
  const note = payload.note
  const rows = payload._rows
  const fromCache = payload._fromCache === true
  const cachedAt = payload._cachedAt

  return (
    <div style={BAR_STYLE}>
      {source === 'spot' && (
        <div className="text-[9px] text-center text-[#555] tracking-wide px-2 pb-1 max-w-4xl mx-auto leading-snug">
          Global spot (XAU / XAG) · AED per gram · indicative international reference
        </div>
      )}
      {fromCache && cachedAt != null && (
        <div className="text-[9px] text-center text-[#666] tracking-wide px-2 pb-1 max-w-4xl mx-auto leading-snug">
          Showing last saved rates (live feed unavailable) ·{' '}
          {new Date(cachedAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      )}
      {note && !fromCache && (source === 'platform_floor' || source === 'stale_cache') && (
        <div className="text-[9px] text-center text-[#666] tracking-wide px-2 pb-1 max-w-4xl mx-auto leading-snug">
          {note}
        </div>
      )}
      <div
        style={{
          display: 'inline-flex',
          gap: '48px',
          animation: 'ticker-scroll 30s linear infinite',
        }}
      >
        {[...rows, ...rows].map((item, i) => (
          <span key={i} style={{ fontSize: '11px', letterSpacing: '0.1em', color: '#aaa' }}>
            <span style={{ color: '#C9A84C', fontWeight: 600 }}>{item.label}</span>
            {item.text != null && item.text !== '' ? (
              <span style={{ color: '#888' }}> — {item.text}</span>
            ) : (
              <>
                {' '}
                <span style={{ color: '#e0e0e0' }}>
                  AED{' '}
                  {typeof item.value === 'number'
                    ? item.value.toLocaleString('en-AE', { maximumFractionDigits: 4 })
                    : item.value}
                </span>
              </>
            )}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
