import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import CustodyHoldingsTable from './CustodyHoldingsTable'

export default function AdminCrossPaymentsPanel({ API, authFetch, dataRefreshKey = 0 }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('vendor_name')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [expandId, setExpandId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [pctDraft, setPctDraft] = useState({})
  const [pctMsg, setPctMsg] = useState({})
  const [pctSaving, setPctSaving] = useState({})

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

  useEffect(() => { load() }, [sort, dataRefreshKey])
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
    if (pctSaving[vendorId]) return
    const v = pctDraft[vendorId]
    if (v === undefined || v === '') return
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setPctMsg((m) => ({ ...m, [vendorId]: 'Enter a number between 0 and 100.' }))
      return
    }
    if (!window.confirm(`Set this vendor's holding % to ${n}%? This changes how much of their positive daily net position Cridora retains.`)) return
    setPctSaving((s) => ({ ...s, [vendorId]: true }))
    setPctMsg((m) => ({ ...m, [vendorId]: '' }))
    try {
      const r = await authFetch(`${API}/admin/cross-payments/${vendorId}/holding-pct/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cridora_holding_pct: String(n) }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        setPctMsg((m) => ({ ...m, [vendorId]: 'Saved' }))
        load()
        if (expandId === vendorId) {
          const rd = await authFetch(`${API}/admin/cross-payments/${vendorId}/?days=14`, { cache: 'no-store' })
          if (rd.ok) setDetail(await rd.json())
        }
        setTimeout(() => setPctMsg((m) => ({ ...m, [vendorId]: '' })), 3000)
      } else {
        setPctMsg((m) => ({ ...m, [vendorId]: j.detail || 'Failed' }))
      }
    } finally {
      setPctSaving((s) => ({ ...s, [vendorId]: false }))
    }
  }

  const rows = data?.vendors ?? []

  return (
    <div>
      <p className="text-[11px] text-[var(--text-muted)] mb-4 max-w-3xl leading-relaxed">
        <strong className="text-[var(--text-primary)]">Cross payments</strong> — platform calendar day in{' '}
        <span className="font-mono text-[var(--gold)]">{data?.platform_business_timezone ?? '—'}</span>.{' '}
        <strong> Custody sell value</strong> = Σ (grams held × current sell reference).{' '}
        <strong>Sell-back liability</strong> = Σ (grams × current customer sell-back rate).{' '}
        <strong>Custody hold</strong> = custody sell value × this vendor's <strong>holding %</strong> — a risk-monitoring figure only.{' '}
        <strong>Vendor pool</strong> = buy net − completed sell-backs (all-time).{' '}
        <strong>Vendor payout</strong> here = vendor pool − custody hold, an estimated capacity figure for monitoring.{' '}
        <span className="text-amber-300">This holding % does not affect the real bank payout amount</span> — the actual Cridora→vendor bank payout is computed at EOD using the separate, platform-wide <strong>EOD holding %</strong> (Fees &amp; Config) applied to each vendor's positive daily net, one payout per vendor per platform day (see Settlement). <strong>EOD→</strong> columns show open EOD lines (auto-drafted payouts appear after Run EOD). Lifetime pool/hold unchanged by EOD.
        <br />
        <span className="text-[var(--text-soft)]"><strong>Custody</strong> (expand a vendor) includes <strong>delisted / hidden SKUs</strong>.</span>
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendor name, email, id…"
          className="px-3 py-2 rounded-lg text-sm flex-1 min-w-[200px]"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
        >
          <option value="vendor_name">Sort: Vendor A–Z</option>
          <option value="-circulation_sell_value_aed">Sort: Custody sell value (high)</option>
          <option value="-circulation_buyback_aed">Sort: Sell-back liability (high)</option>
          <option value="-custody_hold_aed">Sort: Custody hold (high)</option>
          <option value="-vendor_payout_after_hold_aed">Sort: Vendor payout after hold (high)</option>
          <option value="-vendor_pool_aed">Sort: Vendor pool (high)</option>
          <option value="-cridora_holding_pct">Sort: Holding % (high)</option>
          <option value="-eod_cridora_to_vendor_open_aed">Sort: EOD Cridora→vendor (high)</option>
          <option value="-eod_vendor_to_cridora_open_aed">Sort: EOD vendor→Cridora (high)</option>
        </select>
        <button type="button" onClick={load} disabled={busy} className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
          style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold)' }}>
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {!data && (
        <p className="text-xs text-[var(--text-dim)]">Loading…</p>
      )}

      {data && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.12)' }}>
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(18,18,18,0.98)' }}>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Vendor', 'Custody sell', 'Sell-back liab.', 'Hold %', 'Custody hold', 'Vendor pool', 'Vendor payout', 'Cridora Σ', 'EOD→V', 'EOD←V', 'Bank?'].map((h) => (
                    <th key={h} className="text-left px-2 py-2 text-[10px] uppercase text-[var(--text-dim)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = expandId === r.vendor_id
                  return (
                    <tr key={r.vendor_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => setExpandId(open ? null : r.vendor_id)} className="flex items-center gap-1 text-left text-[var(--text-primary)] font-semibold">
                          {open ? <ChevronDown size={14} className="text-[var(--gold)]" /> : <ChevronRight size={14} className="text-[var(--text-dim)]" />}
                          {r.vendor_name}
                          <span className="text-[10px] text-[var(--text-dim)] font-mono">#{r.vendor_id}</span>
                        </button>
                      </td>
                      <td className="px-2 py-2 tabular-nums text-sky-200/90">{Number(r.circulation_sell_value_aed ?? 0).toFixed(2)}</td>
                      <td className="px-2 py-2 tabular-nums">{Number(r.circulation_buyback_aed).toFixed(2)}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className="w-16 px-1 py-0.5 rounded text-[11px] font-mono"
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
                            value={pctDraft[r.vendor_id] !== undefined ? pctDraft[r.vendor_id] : String(r.cridora_holding_pct)}
                            onChange={(e) => setPctDraft((d) => ({ ...d, [r.vendor_id]: e.target.value }))}
                          />
                          <button type="button" onClick={() => savePct(r.vendor_id)} disabled={!!pctSaving[r.vendor_id]} className="text-[10px] text-[var(--gold)] font-bold uppercase disabled:opacity-50">
                            {pctSaving[r.vendor_id] ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                        {pctMsg[r.vendor_id] && <div className="text-[10px] mt-0.5 text-[var(--text-soft)]">{pctMsg[r.vendor_id]}</div>}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-amber-400/90">{Number(r.custody_hold_aed ?? r.admin_hold_aed ?? r.holding_target_aed ?? 0).toFixed(2)}</td>
                      <td className="px-2 py-2 tabular-nums">{Number(r.vendor_pool_aed).toFixed(2)}</td>
                      <td className="px-2 py-2 tabular-nums text-emerald-400/80">{Number(r.vendor_payout_after_hold_aed ?? r.pool_minus_holding_target_aed ?? 0).toFixed(2)}</td>
                      <td className="px-2 py-2 tabular-nums text-[var(--text-soft)]">{Number(r.cridora_share_total_aed).toFixed(2)}</td>
                      <td className="px-2 py-2 tabular-nums text-teal-300/90">{Number(r.eod_cridora_to_vendor_open_aed ?? 0).toFixed(2)}</td>
                      <td className="px-2 py-2 tabular-nums text-rose-300/80">{Number(r.eod_vendor_to_cridora_open_aed ?? 0).toFixed(2)}</td>
                      <td className="px-2 py-2">
                        {(r.has_payout_today || r.has_eod_bank_action)
                          ? <span className="text-amber-400">Yes</span>
                          : <span className="text-[var(--text-dim)]">—</span>}
                      </td>
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
          {detailBusy && <p className="text-xs text-[var(--text-dim)]">Loading detail…</p>}
          {detail && !detailBusy && (
            <>
              <h4 className="text-[10px] uppercase tracking-widest text-[var(--gold)] mb-1">Custody — vendor vault vs customer positions</h4>
              <p className="text-[10px] text-[var(--text-dim)] mb-2">Customer name + email; listing status shows whether the SKU is still offered. Inactive rows remain until grams are fully sold back.</p>
              <div className="mb-4">
                <CustodyHoldingsTable rows={detail.holdings_for_verification} idPrefix={`admin-custody-${expandId}`} />
              </div>

              <h4 className="text-[10px] uppercase tracking-widest text-[var(--gold)] mb-2">Daily rollup (platform calendar days)</h4>
              <div className="overflow-x-auto max-h-48 overflow-y-auto mb-4">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[var(--text-dim)] text-left">
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

              <h4 className="text-[10px] uppercase tracking-widest text-[var(--gold)] mb-2">Bank movements (Cridora ↔ vendor)</h4>
              <div className="overflow-x-auto max-h-40 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[var(--text-dim)] text-left">
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
                        <td className="py-1 font-mono text-[var(--text-soft)]">{b.confirmed_at || '—'}</td>
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
