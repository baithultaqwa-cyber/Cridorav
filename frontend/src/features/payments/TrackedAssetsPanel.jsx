import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { API_AUTH_BASE as API } from '../../config'

/** Personal tracker (v7 TrackedAsset) — non-custody watchlist. */
export default function TrackedAssetsPanel({ authFetch }) {
  const [items, setItems] = useState([])
  const [label, setLabel] = useState('')
  const [grams, setGrams] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await authFetch(`${API}/payments/tracked-assets/`)
      const d = await r.json().catch(() => ({}))
      setItems(Array.isArray(d.assets) ? d.assets : [])
    } catch {
      setError('Could not load tracker.')
    }
  }, [authFetch])

  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    setError('')
    try {
      const r = await authFetch(`${API}/payments/tracked-assets/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: label.trim(),
          weight_grams: Number(grams) || 0,
          metal_type: 'gold',
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.detail || 'Add failed.')
        return
      }
      setLabel('')
      setGrams('')
      await load()
    } catch {
      setError('Network error.')
    }
  }

  const remove = async (id) => {
    await authFetch(`${API}/payments/tracked-assets/${id}/`, { method: 'DELETE' })
    await load()
  }

  return (
    <section className="mb-8 rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.1)' }}>
      <h2 className="text-sm font-bold tracking-widest uppercase text-[var(--text-primary)] mb-1">Personal tracker</h2>
      <p className="text-[11px] text-[var(--text-dim)] mb-4">Watch assets you hold outside Cridora (not custody).</p>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          className="flex-1 min-w-[8rem] rounded-lg px-3 py-2 text-xs bg-transparent border border-white/10"
        />
        <input
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          placeholder="Grams"
          className="w-24 rounded-lg px-3 py-2 text-xs bg-transparent border border-white/10"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold"
          style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--gold)' }}
        >
          <Plus size={12} /> Add
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between text-xs text-[var(--text-soft)] px-2 py-1.5 rounded-lg border border-white/5">
            <span>{it.note || 'Asset'} · {Number(it.weight_grams || 0).toFixed(2)}g · {it.metal_type}</span>
            <button type="button" onClick={() => remove(it.id)} className="text-red-400/80 p-1" aria-label="Remove">
              <Trash2 size={12} />
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-[11px] text-[var(--text-faint)]">No tracked assets yet.</li>}
      </ul>
    </section>
  )
}
