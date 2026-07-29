import { useState } from 'react'
import { Truck } from 'lucide-react'
import { API_AUTH_BASE as API } from '../../config'

/**
 * Request delivery (standard / priority) and pay fee via PaymentProvider.
 */
export default function DeliveryRequestButton({ authFetch, orderId, disabled }) {
  const [open, setOpen] = useState(false)
  const [tier, setTier] = useState('standard_2day')
  const [provider, setProvider] = useState('manual_aani')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const submit = async () => {
    setBusy(true)
    setMsg('')
    try {
      const r = await authFetch(`${API}/payments/orders/${orderId}/delivery/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed_tier: tier, provider_key: provider }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setMsg(d.detail || 'Could not create delivery request.')
        return
      }
      setMsg(
        d.instruction
          || (d.checkout_url ? 'Redirecting to pay delivery fee…' : 'Delivery request created — pay fee via ops if Aani.')
      )
      if (d.checkout_url) {
        window.location.assign(d.checkout_url)
        return
      }
      setOpen(false)
    } catch {
      setMsg('Network error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold whitespace-nowrap disabled:opacity-50"
        style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold)' }}
      >
        <span className="inline-flex items-center gap-1"><Truck size={10} /> Delivery</span>
      </button>
      {open && (
        <div
          className="absolute right-0 z-20 mt-1 w-56 rounded-xl p-3 shadow-lg"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.2)' }}
        >
          <label className="block text-[10px] text-[var(--text-dim)] mb-1">Speed</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="w-full mb-2 rounded-lg px-2 py-1.5 text-xs bg-transparent border border-white/10"
          >
            <option value="standard_2day">Standard (2-day)</option>
            <option value="priority_sameday">Priority (same-day)</option>
          </select>
          <label className="block text-[10px] text-[var(--text-dim)] mb-1">Pay fee via</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full mb-2 rounded-lg px-2 py-1.5 text-xs bg-transparent border border-white/10"
          >
            <option value="manual_aani">Aani</option>
            <option value="stripe">Card (Stripe)</option>
            <option value="telr">Telr</option>
          </select>
          {msg && <p className="text-[10px] text-amber-200/90 mb-2">{msg}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="w-full py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #E8C96A 100%)', color: '#080808' }}
          >
            {busy ? '…' : 'Request & pay fee'}
          </button>
        </div>
      )}
    </div>
  )
}
