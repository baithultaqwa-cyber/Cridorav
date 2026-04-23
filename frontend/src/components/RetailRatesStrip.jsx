import { useState, useEffect, useCallback } from 'react'
import { API_DUBAI_RETAIL_RATES as API_URL } from '../config'
import { usePoll } from '../hooks/usePoll'
import { RETAIL_STRIP_POLL_MS } from '../config/pollIntervals'
import { subscribePricesRefresh } from '../lib/pricesRefresh'

const ROW_STYLE = {
  background: 'rgba(168, 169, 173, 0.05)',
  borderBottom: '1px solid rgba(168, 169, 173, 0.12)',
  padding: '8px 0',
}

const GOLD_ORDER = ['24K', '22K', '21K', '18K']
const SILVER_ORDER = ['999', '925']

export default function RetailRatesStrip() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchRates = useCallback(async (isInitial) => {
    if (isInitial) setLoading(true)
    try {
      const res = await fetch(API_URL, { cache: 'no-store' })
      if (!res.ok) {
        if (isInitial) setData({ error: 'unavailable' })
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      if (isInitial) setData({ error: 'unavailable' })
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch for retail strip
    void fetchRates(true)
  }, [fetchRates])

  useEffect(() => subscribePricesRefresh(() => { void fetchRates(false) }), [fetchRates])

  usePoll(() => fetchRates(false), RETAIL_STRIP_POLL_MS, true)

  if (loading) {
    return (
      <div style={ROW_STYLE}>
        <p className="text-center text-[10px] tracking-[0.12em] uppercase text-[#555] py-1">
          Loading Dubai retail reference…
        </p>
      </div>
    )
  }

  const err = data?.error
  const gold = data?.gold && typeof data.gold === 'object' ? data.gold : {}
  const silver = data?.silver && typeof data.silver === 'object' ? data.silver : {}

  if (err || (!Object.keys(gold).length && !Object.keys(silver).length)) {
    return (
      <div style={ROW_STYLE}>
        <p className="text-center text-[10px] text-[#666] px-4 py-1 leading-relaxed max-w-2xl mx-auto">
          Dubai retail reference rates are temporarily unavailable. Please try again later.
        </p>
      </div>
    )
  }

  const goldCells = GOLD_ORDER.filter((k) => gold[k] != null)
  const silverCells = SILVER_ORDER.filter((k) => silver[k] != null)

  return (
    <div style={ROW_STYLE}>
      <div className="text-[9px] text-center text-[#666] tracking-wide px-3 pb-1.5 max-w-4xl mx-auto leading-snug">
        <span className="text-[#A8A9AD] font-semibold uppercase tracking-[0.15em]">Dubai retail reference</span>
        <span className="mx-2 text-[#444]">·</span>
        <span>{data?.source_label || 'Third-party board rates'}</span>
        <span className="mx-2 text-[#444]">·</span>
        <a
          href={data?.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#888] underline underline-offset-2 hover:text-[#aaa]"
        >
          Source
        </a>
      </div>
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 px-4 pb-0.5">
        {goldCells.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
            {goldCells.map((k) => (
              <span key={k} className="text-[11px] tracking-[0.08em]">
                <span className="text-[#C9A84C] font-semibold">Gold {k}</span>{' '}
                <span className="text-[#d8d8d8]">
                  AED {Number(gold[k]).toLocaleString('en-AE', { maximumFractionDigits: 2 })}
                </span>
              </span>
            ))}
          </div>
        )}
        {silverCells.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
            {silverCells.map((k) => (
              <span key={k} className="text-[11px] tracking-[0.08em]">
                <span className="text-[#A8A9AD] font-semibold">Silver {k}</span>{' '}
                <span className="text-[#d8d8d8]">
                  AED {Number(silver[k]).toLocaleString('en-AE', { maximumFractionDigits: 3 })}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="text-[9px] text-center text-[#555] px-4 pt-1">
        Retail shop rates are typically higher than global spot (shown above).
      </p>
    </div>
  )
}
