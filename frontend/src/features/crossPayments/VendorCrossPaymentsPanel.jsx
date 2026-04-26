import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

export default function VendorCrossPaymentsPanel({ API, authFetch }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setBusy(true)
    authFetch(`${API}/vendor/cross-payments/?days=14`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setBusy(false))
  }

  useEffect(() => { load() }, [authFetch, API])

  return (
    <div>
      <p className="text-[11px] text-[#666] mb-4 max-w-3xl leading-relaxed">
        <strong className="text-[#F5F0E8]">Cross payments</strong> — your customer holdings × <strong>live buyback</strong> (circulation exposure), admin-set <strong>holding %</strong>, and your <strong>vendor pool</strong> (buy net − completed sell-back payouts to customers).
        Platform day: <span className="font-mono text-[#C9A84C]">{data?.platform_business_today ?? '—'}</span> ({data?.platform_business_timezone ?? ''}).
        One bank payout from Cridora per vendor per platform day — confirm receipts under <strong>Bank & payouts</strong>.
      </p>
      <button type="button" onClick={load} disabled={busy} className="mb-4 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
        style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', color: '#C9A84C' }}>
        <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Refresh
      </button>

      {!data && <p className="text-xs text-[#555]">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            {[
              ['Circulation (buyback)', data.circulation_buyback_aed, '#60a5fa'],
              ['Holding % (admin)', `${Number(data.cridora_holding_pct).toFixed(2)}%`, '#f59e0b'],
              ['Holding target', data.holding_target_aed, '#f59e0b'],
              ['Vendor pool', data.vendor_pool_aed, '#10b981'],
              ['Pool − holding target', data.pool_minus_holding_target_aed, '#a78bfa'],
              ['Cridora share (fees)', data.cridora_share_total_aed, '#888'],
            ].map(([label, val, color]) => (
              <div key={label} className="rounded-lg p-3" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
                <div className="text-[9px] uppercase tracking-widest text-[#555] mb-1">{label}</div>
                <div className="text-sm font-black tabular-nums" style={{ color }}>{typeof val === 'number' ? Number(val).toFixed(2) : val}</div>
              </div>
            ))}
          </div>

          <h4 className="text-[10px] uppercase tracking-widest text-[#C9A84C] mb-2">Your metal in customer hands (verification)</h4>
          <div className="overflow-x-auto max-h-48 overflow-y-auto mb-6 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <table className="w-full text-[11px]">
              <thead className="sticky top-0" style={{ background: 'rgba(20,20,20,0.95)' }}>
                <tr className="text-[#555] text-left">
                  <th className="py-2 px-2">Order</th>
                  <th className="py-2 px-2">Product</th>
                  <th className="py-2 px-2">Metal</th>
                  <th className="py-2 px-2">Purity</th>
                  <th className="py-2 px-2">g</th>
                  <th className="py-2 px-2">Exposure AED</th>
                </tr>
              </thead>
              <tbody>
                {(data.holdings_for_verification ?? []).map((h, i) => (
                  <tr key={`${h.order_id}-${i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="py-1.5 px-2 font-mono text-[#C9A84C]">{h.order_ref}</td>
                    <td className="py-1.5 px-2">{h.product_name}</td>
                    <td className="py-1.5 px-2">{h.metal}</td>
                    <td className="py-1.5 px-2">{h.purity}</td>
                    <td className="py-1.5 px-2 tabular-nums">{Number(h.grams_remaining).toFixed(4)}</td>
                    <td className="py-1.5 px-2 tabular-nums">{Number(h.buyback_exposure_aed).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="text-[10px] uppercase tracking-widest text-[#C9A84C] mb-2">Daily rollup</h4>
          <div className="overflow-x-auto max-h-56 overflow-y-auto mb-6 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <table className="w-full text-[11px]">
              <thead className="sticky top-0" style={{ background: 'rgba(20,20,20,0.95)' }}>
                <tr className="text-[#555] text-left">
                  <th className="py-2 px-2">Date</th>
                  <th className="py-2 px-2">Buys</th>
                  <th className="py-2 px-2">Buy net</th>
                  <th className="py-2 px-2">Sellbacks</th>
                  <th className="py-2 px-2">Cust payout</th>
                  <th className="py-2 px-2">Δ cash</th>
                </tr>
              </thead>
              <tbody>
                {(data.daily_rollup ?? []).map((d) => (
                  <tr key={d.business_date} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="py-1.5 px-2 font-mono">{d.business_date}</td>
                    <td className="py-1.5 px-2">{d.buy_count}</td>
                    <td className="py-1.5 px-2 tabular-nums">{Number(d.buy_vendor_net_aed).toFixed(2)}</td>
                    <td className="py-1.5 px-2">{d.sellback_completed_count}</td>
                    <td className="py-1.5 px-2 tabular-nums">{Number(d.sellback_customer_payout_aed).toFixed(2)}</td>
                    <td className="py-1.5 px-2 tabular-nums">{Number(d.net_cash_delta_aed).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="text-[10px] uppercase tracking-widest text-[#C9A84C] mb-2">Bank movements</h4>
          <div className="overflow-x-auto max-h-40 overflow-y-auto rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[#555] text-left">
                  <th className="py-2 px-2">Type</th>
                  <th className="py-2 px-2">When</th>
                  <th className="py-2 px-2">AED</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {(data.bank_movements ?? []).map((b) => (
                  <tr key={`${b.kind}-${b.id}`} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="py-1.5 px-2">{b.kind === 'cridora_to_vendor' ? 'Incoming' : 'Repayment'}</td>
                    <td className="py-1.5 px-2 font-mono">{b.created_at}</td>
                    <td className="py-1.5 px-2 tabular-nums">{Number(b.amount_aed).toFixed(2)}</td>
                    <td className="py-1.5 px-2">{b.status}</td>
                    <td className="py-1.5 px-2 font-mono text-[#888]">{b.confirmed_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
