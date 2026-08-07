import { useState, useEffect } from 'react'
import { Timer } from 'lucide-react'

export default function OrderTimer({ seconds, max = 60 }) {
  const [remaining, setRemaining] = useState(seconds)
  useEffect(() => {
    setRemaining(seconds)
  }, [seconds])
  useEffect(() => {
    if (remaining <= 0) return
    const t = setInterval(() => setRemaining((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [remaining])
  const pct = max > 0 ? (remaining / max) * 100 : 0
  const urgent = remaining <= Math.max(10, Math.floor(max * 0.2))
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8">
        <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle cx="16" cy="16" r="12" fill="none"
            stroke={urgent ? '#ef4444' : '#e8c34a'} strokeWidth="3"
            strokeDasharray={75.4} strokeDashoffset={75.4 * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <Timer size={12} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ color: urgent ? '#ef4444' : 'var(--gold)' }} />
      </div>
      <span className="text-sm font-mono font-bold" style={{ color: urgent ? '#ef4444' : 'var(--gold)' }}>
        {remaining}s
      </span>
    </div>
  )
}
