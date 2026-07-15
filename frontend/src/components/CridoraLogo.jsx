import { useId } from 'react'
import birdEmblemUrl from '../assets/cridora-bird-emblem.png'

/**
 * Wordmark: CRID + O + RA. A realistic gold bullion–style 3D coin is the “O” in Cridora.
 * Bird seal emblem on both faces (favicon/PWA use the same asset at fixed sizes).
 */
const RIM_SEGMENTS = 36

export default function CridoraLogo({ size = 'md', className = '' }) {
  const uid = useId().replace(/:/g, '')

  return (
    <div
      className={`cridora-logo cridora-logo--${size} ${className}`.trim()}
      role="img"
      aria-label="Cridora"
    >
      <span className="cridora-logo__type" aria-hidden>
        CRID
      </span>
      <div className="cridora-logo__coin" aria-hidden>
        <div
          className="cridora-logo__cylinder"
          style={{ '--cl-rim-segments': RIM_SEGMENTS }}
          aria-hidden
        >
          {Array.from({ length: RIM_SEGMENTS }, (_, i) => (
            <div key={i} className="cridora-logo__cylinder-strip" style={{ '--strip-i': i }} />
          ))}
        </div>
        <div className="cridora-logo__face cridora-logo__face--front">
          <svg
            className="cridora-coin-face"
            viewBox="0 0 100 100"
            width="100%"
            height="100%"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient
                id={`crg-base-${uid}`}
                cx="32%"
                cy="28%"
                r="78%"
                fx="32%"
                fy="28%"
              >
                <stop offset="0%" stopColor="#fff9e0" stopOpacity="0.98" />
                <stop offset="12%" stopColor="#f4d35e" />
                <stop offset="32%" stopColor="#d4a82a" />
                <stop offset="58%" stopColor="#9a7420" />
                <stop offset="100%" stopColor="#3d2f08" />
              </radialGradient>
              <radialGradient id={`crg-dim-${uid}`} cx="50%" cy="55%" r="45%">
                <stop offset="0%" stopColor="#2a1f04" stopOpacity="0" />
                <stop offset="70%" stopColor="#1a1402" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#0d0a01" stopOpacity="0.45" />
              </radialGradient>
              <linearGradient id={`crg-rim-lip-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#e8c65c" />
                <stop offset="0.4" stopColor="#a67c18" />
                <stop offset="1" stopColor="#4a3a0c" />
              </linearGradient>
              <clipPath id={`crg-emblem-clip-${uid}`}>
                <circle cx="50" cy="50" r="40.6" />
              </clipPath>
            </defs>
            <circle cx="50" cy="50" r="49.5" fill={`url(#crg-base-${uid})`} />
            <circle cx="50" cy="50" r="48.8" fill="none" stroke={`url(#crg-rim-lip-${uid})`} strokeWidth="1.1" />
            <circle
              cx="50"
              cy="50"
              r="47.6"
              fill="none"
              stroke="#2d2308"
              strokeOpacity="0.5"
              strokeWidth="0.5"
              strokeDasharray="0.5 0.45"
            />
            <circle cx="50" cy="50" r="42" fill={`url(#crg-dim-${uid})`} />
            <circle cx="50" cy="50" r="41" fill="none" stroke="#1f1805" strokeOpacity="0.4" strokeWidth="0.35" />
            <image
              href={birdEmblemUrl}
              x="0"
              y="0"
              width="100"
              height="100"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#crg-emblem-clip-${uid})`}
              opacity="0.96"
            />
          </svg>
        </div>
        <div className="cridora-logo__face cridora-logo__face--back">
          <svg
            className="cridora-coin-face"
            viewBox="0 0 100 100"
            width="100%"
            height="100%"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient
                id={`crb-base-${uid}`}
                cx="66%"
                cy="34%"
                r="72%"
                fx="65%"
                fy="32%"
              >
                <stop offset="0%" stopColor="#f8e8a8" stopOpacity="0.95" />
                <stop offset="18%" stopColor="#e0b838" />
                <stop offset="45%" stopColor="#b88818" />
                <stop offset="100%" stopColor="#352808" />
              </radialGradient>
              <radialGradient id={`crb-inner-${uid}`} cx="50%" cy="50%" r="40%">
                <stop offset="0%" stopColor="#0d0a02" stopOpacity="0" />
                <stop offset="100%" stopColor="#0d0a02" stopOpacity="0.35" />
              </radialGradient>
              <clipPath id={`crb-emblem-clip-${uid}`}>
                <circle cx="50" cy="50" r="40.6" />
              </clipPath>
            </defs>
            <circle cx="50" cy="50" r="49.5" fill={`url(#crb-base-${uid})`} />
            <circle
              cx="50"
              cy="50"
              r="48.5"
              fill="none"
              stroke="#2a1f0a"
              strokeOpacity="0.45"
              strokeWidth="0.45"
              strokeDasharray="0.55 0.4"
            />
            <circle cx="50" cy="50" r="32" fill={`url(#crb-inner-${uid})`} />
            <image
              href={birdEmblemUrl}
              x="0"
              y="0"
              width="100"
              height="100"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#crb-emblem-clip-${uid})`}
              opacity="0.94"
            />
          </svg>
        </div>
      </div>
      <span className="cridora-logo__type" aria-hidden>
        RA
      </span>
    </div>
  )
}
