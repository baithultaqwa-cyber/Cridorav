/**
 * Very light specks in fixed positions; movement is a slow float (CSS, GPU-friendly).
 * Parent: .app-bg-ambient (App.jsx) — keep pointer-events none globally.
 */
const SEEDS = [
  { t: 8, l: 6, d: 0, dur: 88, a: 0 },
  { t: 18, l: 22, d: 2, dur: 102, a: 1 },
  { t: 5, l: 48, d: 4, dur: 96, a: 2 },
  { t: 32, l: 72, d: 1, dur: 110, a: 3 },
  { t: 44, l: 12, d: 6, dur: 92, a: 0 },
  { t: 12, l: 88, d: 3, dur: 100, a: 1 },
  { t: 58, l: 38, d: 5, dur: 86, a: 2 },
  { t: 70, l: 58, d: 0, dur: 104, a: 3 },
  { t: 26, l: 66, d: 7, dur: 90, a: 0 },
  { t: 82, l: 28, d: 2, dur: 98, a: 1 },
  { t: 14, l: 42, d: 8, dur: 94, a: 2 },
  { t: 62, l: 8, d: 4, dur: 108, a: 3 },
  { t: 36, l: 92, d: 1, dur: 84, a: 0 },
  { t: 52, l: 50, d: 6, dur: 100, a: 1 },
  { t: 76, l: 18, d: 3, dur: 96, a: 2 },
  { t: 4, l: 34, d: 9, dur: 88, a: 3 },
  { t: 90, l: 78, d: 0, dur: 92, a: 0 },
  { t: 22, l: 14, d: 5, dur: 104, a: 1 },
  { t: 48, l: 84, d: 2, dur: 90, a: 2 },
  { t: 66, l: 44, d: 7, dur: 98, a: 3 },
]

export default function AmbientParticles() {
  return (
    <div className="app-bg-ambient__particles" aria-hidden>
      {SEEDS.map((p, i) => (
        <span
          key={i}
          className={`app-bg-ambient__dot app-bg-ambient__dot--a${(p.a % 4) + 1}`}
          style={{
            top: `${p.t}%`,
            left: `${p.l}%`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.d}s`,
          }}
        />
      ))}
    </div>
  )
}
