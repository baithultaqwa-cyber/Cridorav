import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, X } from 'lucide-react'
import { API_NOTIFICATIONS } from '../../config'
import { usePoll } from '../../hooks/usePoll'

export default function NotificationBell({ authFetch }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef(null)

  const load = () => {
    if (!authFetch) return
    authFetch(`${API_NOTIFICATIONS}/?limit=20`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setItems(d.items || [])
        setUnread(Number(d.unread_count) || 0)
      })
      .catch(() => undefined)
  }

  usePoll(load, 45000, Boolean(authFetch))
  useEffect(() => { load() }, [authFetch])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const markRead = async (id) => {
    await authFetch(`${API_NOTIFICATIONS}/${id}/read/`, { method: 'POST' })
    load()
  }

  const markAll = async () => {
    await authFetch(`${API_NOTIFICATIONS}/read-all/`, { method: 'POST' })
    load()
  }

  const openItem = async (n) => {
    if (n.unread) await markRead(n.id)
    setOpen(false)
    if (n.url) navigate(n.url)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => { setOpen((o) => !o); if (!open) load() }}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(201,168,76,0.08)] relative"
      >
        <Bell size={15} className="text-[var(--text-dim)]" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center"
            style={{ background: 'var(--gold)', color: '#080808' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[min(92vw,340px)] max-h-[70vh] overflow-hidden rounded-xl shadow-xl z-50 flex flex-col"
          style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <span className="text-[11px] tracking-widest uppercase font-bold text-[var(--text-primary)]">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button type="button" onClick={markAll} className="text-[10px] text-[var(--gold)] flex items-center gap-1">
                  <CheckCheck size={12} /> Mark all
                </button>
              )}
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-[var(--text-dim)]">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)] text-center py-8 px-4">No notifications yet</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openItem(n)}
                  className="w-full text-left px-3 py-3 border-b transition-colors hover:bg-[rgba(201,168,76,0.06)]"
                  style={{
                    borderColor: 'rgba(255,255,255,0.04)',
                    background: n.unread ? 'rgba(201,168,76,0.04)' : 'transparent',
                  }}
                >
                  <div className="flex items-start gap-2">
                    {n.unread && (
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--gold)' }} />
                    )}
                    <div className={n.unread ? '' : 'pl-3.5'}>
                      <div className="text-xs font-semibold text-[var(--text-primary)]">{n.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">{n.body}</div>
                      {n.created_at && (
                        <div className="text-[9px] text-[var(--text-faint)] mt-1">
                          {String(n.created_at).slice(0, 16).replace('T', ' ')}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
