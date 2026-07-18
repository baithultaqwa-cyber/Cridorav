import { useState } from 'react'
import { UserCheck, Loader2 } from 'lucide-react'

/**
 * Compact toggle embedded in each admin vendor row.
 * Props: vendorId, enabled (bool), authFetch, API_VENDOR_KYC base, onChanged?
 */
export default function VendorKycAdminToggle({
  vendorId,
  enabled: initialEnabled = false,
  authFetch,
  apiBase,
  onChanged,
}) {
  const [enabled, setEnabled] = useState(Boolean(initialEnabled))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const toggle = async () => {
    if (busy) return
    const next = !enabled
    const confirmMsg = next
      ? 'Enable manual customer KYC for this dealer? They will verify customers themselves before those customers can buy from them (bypassing global KYC for this dealer only).'
      : 'Disable manual KYC for this dealer? Purchase gating will revert to the platform global KYC rules. Existing verification history is kept.'
    if (!window.confirm(confirmMsg)) return
    setBusy(true)
    setMsg('')
    try {
      const r = await authFetch(`${apiBase}/admin/vendors/${vendorId}/access/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        setEnabled(Boolean(j.enabled))
        setMsg(next ? 'Manual KYC enabled' : 'Manual KYC disabled')
        onChanged?.(Boolean(j.enabled))
        setTimeout(() => setMsg(''), 2500)
      } else {
        setMsg(j.detail || 'Failed')
      }
    } catch {
      setMsg('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        disabled={busy}
        onClick={toggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
        style={
          enabled
            ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }
            : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }
        }
        title="Allow this dealer to manually verify customers"
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <UserCheck size={11} />}
        Manual KYC: {enabled ? 'On' : 'Off'}
      </button>
      {msg && <span className="text-[10px] text-[var(--text-dim)]">{msg}</span>}
    </div>
  )
}
