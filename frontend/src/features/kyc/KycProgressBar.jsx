const STEPS = [
  { n: 1, label: 'Details' },
  { n: 2, label: 'Documents' },
  { n: 3, label: 'Review' },
]

export default function KycProgressBar({ progress }) {
  const current = Number(progress?.current_step) || 1
  const percent = Number(progress?.percent) || 0
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] tracking-widest uppercase text-[var(--text-dim)]">
          Step {current} of 3 — {STEPS[current - 1]?.label}
        </p>
        <p className="text-[11px] font-semibold" style={{ color: 'var(--gold)' }}>{percent}% complete</p>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: 'linear-gradient(90deg,#C9A84C,#E8C96A)' }} />
      </div>
      <div className="flex gap-2 mt-3">
        {STEPS.map((s) => {
          const done = Boolean(progress?.[`step${s.n}_complete`])
          const active = current === s.n
          return (
            <div key={s.n} className="flex-1 text-center text-[10px] tracking-widest uppercase"
              style={{ color: done ? '#10b981' : active ? 'var(--gold)' : '#555' }}>
              {s.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
