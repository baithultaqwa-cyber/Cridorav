import coinFaceUrl from '../assets/cridora-coin-face.png'

/**
 * Wordmark: CRID + O + RA.
 * The “O” is a 3D minted gold coin with the Cridora seal embossed on both faces.
 * size: sm | md | lg | auth (auth = compact wordmark for sign-in / sign-up)
 */
/** Facets for the CSS cylinder rim (CodePen KEPpxy geometry). */
const RIM_SEGMENTS = 64

export default function CridoraLogo({ size = 'md', className = '' }) {
  const sizeClass = ['sm', 'md', 'lg', 'auth'].includes(size) ? size : 'md'

  return (
    <div
      className={`cridora-logo cridora-logo--${sizeClass} ${className}`.trim()}
      role="img"
      aria-label="Cridora"
    >
      <span className="cridora-logo__type" aria-hidden>
        CRID
      </span>
      <div className="cridora-logo__coin" aria-hidden>
        {/* Shadow stays outside the 3D tree — filter on the spinner flattens the coin to paper */}
        <span className="cridora-logo__coin-shadow" />
        <div
          className="cridora-logo__coin-3d"
          style={{ '--cl-rim-segments': RIM_SEGMENTS }}
        >
          <div className="cridora-logo__cylinder" aria-hidden>
            {Array.from({ length: RIM_SEGMENTS }, (_, i) => (
              <div key={i} className="cridora-logo__cylinder-strip" style={{ '--strip-i': i }} />
            ))}
          </div>
          <div className="cridora-logo__face cridora-logo__face--front">
            <img
              className="cridora-coin-face"
              src={coinFaceUrl}
              alt=""
              draggable={false}
              decoding="async"
            />
            <span className="cridora-logo__face-light cridora-logo__face-light--front" />
          </div>
          <div className="cridora-logo__face cridora-logo__face--back">
            <img
              className="cridora-coin-face"
              src={coinFaceUrl}
              alt=""
              draggable={false}
              decoding="async"
            />
            <span className="cridora-logo__face-light cridora-logo__face-light--back" />
          </div>
        </div>
      </div>
      <span className="cridora-logo__type" aria-hidden>
        RA
      </span>
    </div>
  )
}
