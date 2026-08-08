import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Smartphone } from 'lucide-react'
import { API_MESSAGING } from '../../config'

const inputStyle = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'var(--text-primary)',
  outline: 'none',
}

export default function AdminSmsGatewayPanel({ authFetch }) {
  const [cfg, setCfg] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${API_MESSAGING}/admin/sms-gateway/`)
      if (!res.ok) return
      const d = await res.json()
      setCfg(d)
      setForm({
        provider: d.provider || 'httpsms',
        enabled: d.enabled !== false,
        api_url: d.api_url || '',
        from_number: d.from_number || '',
        auth_header: d.auth_header || 'x-api-key',
        body_template: d.body_template || '',
        api_key: '',
        api_secret: '',
      })
    } catch { /* ignore */ }
  }, [authFetch])

  useEffect(() => { load() }, [load])

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true)
    setMsg('')
    try {
      const body = {
        provider: form.provider,
        enabled: form.enabled,
        api_url: form.api_url,
        from_number: form.from_number,
        auth_header: form.auth_header,
        body_template: form.body_template,
      }
      if ((form.api_key || '').trim()) body.api_key = form.api_key.trim()
      if ((form.api_secret || '').trim()) body.api_secret = form.api_secret.trim()
      const res = await authFetch(`${API_MESSAGING}/admin/sms-gateway/`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsgOk(false)
        setMsg(d.detail || 'Could not save SMS gateway.')
        return
      }
      setCfg(d)
      setForm((p) => ({ ...p, api_key: '', api_secret: '', provider: d.provider, enabled: d.enabled, api_url: d.api_url || '', from_number: d.from_number || '', auth_header: d.auth_header || 'x-api-key', body_template: d.body_template || '' }))
      setMsgOk(true)
      setMsg('SMS gateway updated. OTP flow is unchanged — only the provider API switched.')
    } catch {
      setMsgOk(false)
      setMsg('Connection issue — please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!cfg || !form.provider) {
    return (
      <div className="rounded-2xl p-6 lg:col-span-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs text-[var(--text-dim)]">Loading SMS gateway…</p>
      </div>
    )
  }

  const provider = form.provider
  return (
    <div className="rounded-2xl p-6 lg:col-span-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <h3 className="text-xs font-bold tracking-widest uppercase text-[var(--text-primary)] mb-2 flex items-center gap-2">
        <Smartphone size={14} className="text-[var(--gold)]" /> SMS gateway
      </h3>
      <p className="text-[11px] text-[var(--text-dim)] mb-4 leading-relaxed">
        Cridora → OTP service → this SMS API → customer. Change provider anytime; login / KYC OTP stays the same.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[10px] tracking-widest uppercase px-2 py-1 rounded-sm"
          style={{ background: cfg.live ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: cfg.live ? '#10b981' : '#f59e0b' }}>
          {cfg.live ? 'Live' : 'Not configured'}
        </span>
        {cfg.api_key_hint ? <span className="text-[11px] text-[var(--text-dim)]">Key {cfg.api_key_hint}</span> : null}
      </div>

      {msg && (
        <div className={`mb-4 px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 ${msgOk ? 'text-emerald-400' : 'text-red-400'}`}
          style={{ background: msgOk ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${msgOk ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
          {msgOk ? <CheckCircle size={12} /> : <AlertCircle size={12} />} {msg}
        </div>
      )}

      <label className="flex items-center gap-2 mb-4 text-sm text-[var(--text-primary)]">
        <input type="checkbox" checked={!!form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
        Gateway enabled
      </label>

      <div className="flex flex-wrap gap-2 mb-4">
        {(cfg.providers || []).map((p) => (
          <button key={p.id} type="button" onClick={() => set('provider', p.id)}
            className="px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold"
            style={provider === p.id
              ? { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold)' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-1.5 block">
            {provider === 'twilio' ? 'Account SID' : 'API key'}
          </label>
          <input type="password" autoComplete="off" placeholder={cfg.api_key_configured ? 'Leave blank to keep current' : 'Paste key'}
            value={form.api_key} onChange={(e) => set('api_key', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </div>
        {provider === 'twilio' && (
          <div>
            <label className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-1.5 block">Auth token</label>
            <input type="password" autoComplete="off" placeholder={cfg.api_secret_configured ? 'Leave blank to keep current' : 'Paste token'}
              value={form.api_secret} onChange={(e) => set('api_secret', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>
        )}
        <div>
          <label className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-1.5 block">From number</label>
          <input value={form.from_number} onChange={(e) => set('from_number', e.target.value)} placeholder="+9715…"
            className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </div>
        {(provider === 'generic' || provider === 'httpsms' || provider === 'twilio') && (
          <div>
            <label className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-1.5 block">
              API URL {provider !== 'generic' ? '(optional override)' : ''}
            </label>
            <input value={form.api_url} onChange={(e) => set('api_url', e.target.value)}
              placeholder={provider === 'httpsms' ? 'https://api.httpsms.com/v1/messages/send' : provider === 'twilio' ? 'Leave blank for Twilio default' : 'https://…'}
              className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>
        )}
        {provider === 'generic' && (
          <>
            <div>
              <label className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-1.5 block">Auth header</label>
              <input value={form.auth_header} onChange={(e) => set('auth_header', e.target.value)} placeholder="x-api-key or Authorization"
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-1.5 block">JSON body template</label>
              <textarea rows={3} value={form.body_template} onChange={(e) => set('body_template', e.target.value)}
                placeholder={'{"to": "{to}", "from": "{from}", "content": "{content}"}'}
                className="w-full px-3 py-2 rounded-lg text-sm font-mono" style={inputStyle} />
              <p className="text-[10px] text-[var(--text-dim)] mt-1">Placeholders: {'{to}'} {'{from}'} {'{content}'}</p>
            </div>
          </>
        )}
      </div>

      <button type="button" disabled={saving} onClick={save} className="btn-gold mt-4 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save SMS gateway'}
      </button>
    </div>
  )
}
