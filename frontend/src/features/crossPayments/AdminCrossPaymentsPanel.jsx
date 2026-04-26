import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

export default function AdminCrossPaymentsPanel({ API, authFetch }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('vendor_name')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [expandId, setExpandId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [pctDraft, setPctDraft] = useState({})
  const [pctMsg, setPctMsg] = useState({})

  const load = () => {
    setBusy(true)
    const q = new URLSearchParams({ sort })
    if (search.trim()) q.set('search', search.trim())
    authFetch(`${API}/admin/cross-payments/?${q}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setBusy(false))
  }

  useEffect(() => { load() }, [sort])
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!expandId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailBusy(true)
    authFetch(`${API}/admin/cross-payments/${expandId}/?days=14`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setDetail(d) })
      .catch(() => { if (!cancelled) setDetail(null) })
      .finally(() => { if (!cancelled) setDetailBusy(false) })
    return () => { cancelled = true }
  }, [expandId, authFetch, API])

  const savePct = async (vendorId) => {
    const v = pctDraft[vendorId]
    if (v === undefined || v === '') return
    setPctMsg((m) => ({ ...m, [vendorId]: '' }))
    const r = await authFetch(`${API}/admin/cross-payments/${vendorId}/holding-pct/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cridora_holding_pct: String(v) }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok) {
      setPctMsg((m) => ({ ...m, [vendorId]: 'Saved' }))
      load()
      if (expandId === vendorId) setDetail(j)
    } else {
      setPctMsg((m) => ({ ...m, [vendorId]: j.detail || 'Failed' }))
    }
  }

  const rows = data?.vendors ?? []

  return (
    <div>
      <p className="text-[11px] text-[#666] mb-4 max-w-3xl leading-relaxed">
        <strong className="text-[#F5F0E8]">Cross payments</strong> — platform calendar day in{' '}
        <span className="font-mono text-[#C9A84C]">{data?.platform_business_timezone ?? '—'}</span>
        . <strong>Circulation</strong> = customer holdings × live buyback (potential sell-back).{' '}
        <strong>Holding target</strong> = circulation × admin-set %. <strong>Vendor pool</strong> = vendor net from buys − customer sell-back payouts.
        One Cridora→vendor bank payout per vendor per platform day (see Settlement).
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendor name, email, id…"
          className="px-3 py-2 rounded-lg text-sm flex-1 min-w-[200px]"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#F5F0E8' }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#F5F0E8' }}
        >
          <option value="vendor_name">Sort: Vendor A–Z</option>
          <option value="-circulation_buyback_aed">Sort: Circulation (high)</option>
          <option value="-holding_target_aed">Sort: Holding target (high)</option>
          <option value="-vendor_pool_aed">Sort: Vendor pool (high)</option>
          <option value="-cridora_holding_pct">Sort: Holding % (high)</option>
        </select>
        <button type="button" onClick={load} disabled={busy} className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
          style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', color: '#C9A84C' }}>
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {!data && (
        <p className="text-xs text-[#555]">Loading…</p>
      )}

      {data && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.12)' }}>
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(18,18,18,0.98)' }}>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Vendor', 'Circulation (buyback)', 'Hold %', 'Holding target', 'Vendor pool', 'Pool − hold', 'Cridora share Σ', 'Payout today'].map((h) => (
                    <th key={h} className="text-left px-2 py-2 text-[10px] uppercase text-[#555] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = expandId === r.vendor_id
                  return (
                    <tr key={r.vendor_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => setExpandId(open ? null : r.vendor_id)} className="flex items-center gap-1 text-left text-[#F5F0E8] font-semibold">
                          {open ? <ChevronDown size={14} className="text-[#C9A84C]" /> : <ChevronRight size={14} className="text-[#555]" />}
                          {r.vendor_name}
                          <span className="text-[10px] text-[#555] font-mono">#{r.vendor_id}</span>
                        </button>
                      </td>
                      <td className="px-2 py-2 tabular-nums">{Number(r.circulation_buyback_aed).toFixed(2)}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className="w-16 px-1 py-0.5 rounded text-[11px] font-mono"
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#F5F0E8' }}
                            value={pctDraft[r.vendor_id] !== undefined ? pctDraft[r.vendor_id] : String(r.cridora_holding_pct)}
                            onChange={(e) => setPctDraft((d) => ({ ...d, [r.vendor_id]: e.target.value }))}
                          />
                          <button type="button" onClick={() => savePct(r.vendor_id)} className="text-[10px] text-[#C9A84C] font-bold uppercase">Save</button>
                        </div>
                        {pctMsg[r.vendor_id] && <div className="text-[10px] mt-0.5 text-[#888]">{pctMsg[r.vendor_id]}</div>}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-amber-400/90">{Number(r.holding_target_aed).toFixed(2)}</td>
                      <td className="px-2 py-2 tabular-nums">{Number(r.vendor_pool_aed).toFixed(2)}</td>
                      <td className="px-2 py-2 tabular-nums text-emerald-400/80">{Number(r.pool_minus_holding_target_aed).toFixed(2)}</td>
                      <td className="px-2 py-2 tabular-nums text-[#888]">{Number(r.cridora_share_total_aed).toFixed(2)}</td>
                      <td className="px-2 py-2">{r.has_payout_today ? <span className="text-amber-400">Yes</span> : <span className="text-[#555]">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {expandId && (
        <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(201,168,76,0.15)' }}>
          {detailBusy && <p className="text-xs text-[#555]">Loading detail…</p>}
          {detail && !detailBusy && (
            <>
              <h4 className="text-[10px] uppercase tracking-widest text-[#C9A84C] mb-2">Holdings (grams) — physical cross-check</h4>
              <div className="overflow-x-auto max-h-40 overflow-y-auto mb-4">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[#555] text-left">
                      <th className="py-1 pr-2">Order</th>
                      <th className="py-1 pr-2">Product</th>
                      <th className="py-1 pr-2">Metal</th>
                      <th className="py-1 pr-2">Purity</th>
                      <th className="py-1 pr-2">g</th>
                      <th className="py-1 pr-2">Buyback/g</th>
                      <th className="py-1">Exposure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.holdings_for_verification ?? []).map((h, i) => (
                      <tr key={`${h.order_id}-${i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="py-1 pr-2 font-mono text-[#C9A84C]">{h.order_ref}</td>
                        <td className="py-1 pr-2">{h.product_name}</td>
                        <td className="py-1 pr-2">{h.metal}</td>
                        <td className="py-1 pr-2">{h.purity}</td>
                        <td className="py-1 pr-2 tabular-nums">{Number(h.grams_remaining).toFixed(4)}</td>
                        <td className="py-1 pr-2 tabular-nums">{Number(h.buyback_per_gram_aed).toFixed(4)}</td>
                        <td className="py-1 tabular-nums">{Number(h.buyback_exposure_aed).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 className="text-[10px] uppercase tracking-widest text-[#C9A84C] mb-2">Daily rollup (platform calendar days)</h4>
              <div className="overflow-x-auto max-h-48 overflow-y-auto mb-4">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[#555] text-left">
                      <th className="py-1 pr-2">Date</th>
                      <th className="py-1 pr-2">Buys</th>
                      <th className="py-1 pr-2">Buy net</th>
                      <th className="py-1 pr-2">Sellbacks</th>
                      <th className="py-1 pr-2">Cust payout</th>
                      <th className="py-1 pr-2">Cridora sell shr</th>
                      <th className="py-1">Δ cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.daily_rollup ?? []).map((d) => (
                      <tr key={d.business_date} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="py-1 pr-2 font-mono">{d.business_date}</td>
                        <td className="py-1 pr-2">{d.buy_count}</td>
                        <td className="py-1 pr-2 tabular-nums">{Number(d.buy_vendor_net_aed).toFixed(2)}</td>
                        <td className="py-1 pr-2">{d.sellback_completed_count}</td>
                        <td className="py-1 pr-2 tabular-nums">{Number(d.sellback_customer_payout_aed).toFixed(2)}</td>
                        <td className="py-1 pr-2 tabular-nums">{Number(d.sellback_cridora_share_aed).toFixed(2)}</td>
                        <td className="py-1 tabular-nums">{Number(d.net_cash_delta_aed).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 className="text-[10px] uppercase tracking-widest text-[#C9A84C] mb-2">Bank movements (Cridora ↔ vendor)</h4>
              <div className="overflow-x-auto max-h-40 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[#555] text-left">
                      <th className="py-1 pr-2">Type</th>
                      <th className="py-1 pr-2">When</th>
                      <th className="py-1 pr-2">AED</th>
                      <th className="py-1 pr-2">Status</th>
                      <th className="py-1">Confirmed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.bank_movements ?? []).map((b) => (
                      <tr key={`${b.kind}-${b.id}`} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="py-1 pr-2">{b.kind === 'cridora_to_vendor' ? '→ Vendor' : '← Vendor'}</td>
                        <td className="py-1 pr-2 font-mono">{b.created_at}</td>
                        <td className="py-1 pr-2 tabular-nums">{Number(b.amount_aed).toFixed(2)}</td>
                        <td className="py-1 pr-2">{b.status}</td>
                        <td className="py-1 font-mono text-[#888]">{b.confirmed_at || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
