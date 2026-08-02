import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars -- motion JSX
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Bell, CheckCheck, X } from 'lucide-react'
import { API_NOTIFICATIONS } from '../../config'
import { usePoll } from '../../hooks/usePoll'
import { sereneTap, SERENE_EASE } from '../../lib/sereneMotion'
import { microHaptic } from '../../lib/microHaptic'
import { resolveNotificationNavUrl } from '../../lib/priceAlertCompareUrl'

export default function NotificationBell({ authFetch }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef(null)
  const reduce = useReducedMotion()
  const prevUnread = useRef(0)

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
    if (unread > prevUnread.current && prevUnread.current >= 0) {
      /* new notification arrived — badge already pulses via CSS */
    }
    prevUnread.current = unread
  }, [unread])

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
    microHaptic(8)
    load()
  }

  const openItem = async (n) => {
    if (n.unread) await markRead(n.id)
    setOpen(false)
    const target = resolveNotificationNavUrl(n)
    if (target) navigate(target)
  }

  return (
    <div className="relative" ref={panelRef}>
      <motion.button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        whileTap={reduce ? undefined : sereneTap}
        onClick={() => {
          setOpen((o) => !o)
          if (!open) {
            load()
            microHaptic(6)
          }
        }}
        className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(201,168,76,0.08)] relative"
      >
        <motion.span
          animate={reduce || unread === 0 ? undefined : { rotate: [0, -8, 8, -5, 5, 0] }}
          transition={{ duration: 0.7, ease: SERENE_EASE, delay: 0.15 }}
          key={unread > 0 ? `bell-${unread}` : 'bell-0'}
        >
          <Bell size={15} className="text-[var(--text-dim)]" />
        </motion.span>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={reduce ? false : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? undefined : { scale: 0.5, opacity: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center micro-badge-pulse"
              style={{ background: 'var(--gold)', color: '#080808' }}
            >
              {unread > 99 ? '99+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
            transition={reduce ? { duration: 0 } : { duration: 0.28, ease: SERENE_EASE }}
            className="absolute right-0 mt-2 w-[min(92vw,340px)] max-h-[70vh] overflow-hidden rounded-xl shadow-xl z-50 flex flex-col origin-top-right"
            style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <span className="text-[11px] tracking-widest uppercase font-bold text-[var(--text-primary)]">Notifications</span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <motion.button
                    type="button"
                    whileTap={reduce ? undefined : sereneTap}
                    onClick={markAll}
                    className="text-[10px] text-[var(--gold)] flex items-center gap-1 min-h-[32px] px-1"
                  >
                    <CheckCheck size={12} /> Mark all
                  </motion.button>
                )}
                <motion.button
                  type="button"
                  aria-label="Close"
                  whileTap={reduce ? undefined : sereneTap}
                  onClick={() => setOpen(false)}
                  className="text-[var(--text-dim)] min-w-[32px] min-h-[32px] flex items-center justify-center"
                >
                  <X size={14} />
                </motion.button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {items.length === 0 ? (
                <p className="text-xs text-[var(--text-dim)] text-center py-8 px-4">No notifications yet</p>
              ) : (
                items.map((n, i) => (
                  <motion.button
                    key={n.id}
                    type="button"
                    initial={reduce ? false : { opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.24), duration: 0.28, ease: SERENE_EASE }}
                    whileTap={reduce ? undefined : { backgroundColor: 'rgba(201,168,76,0.1)' }}
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
                  </motion.button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
