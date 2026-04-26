/**
 * Small drifting specks — durations ~18–30s so motion is actually noticeable.
 * One `animation` shorthand per dot (reliable in all engines vs split longhands + classes).
 */
const PARTICLE_KEYFRAMES = ['app-particle-1', 'app-particle-2', 'app-particle-3', 'app-particle-4']

const SEEDS = [
  { t: 8, l: 6, d: 0, dur: 22, a: 0 },
  { t: 18, l: 22, d: 1, dur: 26, a: 1 },
  { t: 5, l: 48, d: 2, dur: 20, a: 2 },
  { t: 32, l: 72, d: 0.5, dur: 28, a: 3 },
  { t: 44, l: 12, d: 3, dur: 24, a: 0 },
  { t: 12, l: 88, d: 1.5, dur: 21, a: 1 },
  { t: 58, l: 38, d: 2.5, dur: 19, a: 2 },
  { t: 70, l: 58, d: 0, dur: 25, a: 3 },
  { t: 26, l: 66, d: 4, dur: 23, a: 0 },
  { t: 82, l: 28, d: 1, dur: 20, a: 1 },
  { t: 14, l: 42, d: 5, dur: 27, a: 2 },
  { t: 62, l: 8, d: 2, dur: 18, a: 3 },
  { t: 36, l: 92, d: 0.2, dur: 24, a: 0 },
  { t: 52, l: 50, d: 3.5, dur: 22, a: 1 },
  { t: 76, l: 18, d: 1, dur: 21, a: 2 },
  { t: 4, l: 34, d: 6, dur: 26, a: 3 },
  { t: 90, l: 78, d: 0, dur: 20, a: 0 },
  { t: 22, l: 14, d: 4, dur: 25, a: 1 },
  { t: 48, l: 84, d: 1.2, dur: 19, a: 2 },
  { t: 66, l: 44, d: 2, dur: 23, a: 3 },
]

export default function AmbientParticles() {
  return (
    <div className="app-bg-ambient__particles" aria-hidden>
      {SEEDS.map((p, i) => {
        const name = PARTICLE_KEYFRAMES[p.a % 4]
        return (
          <span
            key={i}
            className="app-bg-ambient__dot"
            style={{
              top: `${p.t}%`,
              left: `${p.l}%`,
              animation: `${name} ${p.dur}s ease-in-out ${p.d}s infinite`,
            }}
          />
        )
      })}
    </div>
  )
}
