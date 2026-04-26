/**
 * Wordmark: CRID + O + RA. The 3D coin is the “O” in Cridora; its diameter matches letter cap height.
 */
export default function CridoraLogo({ size = 'md', className = '' }) {
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
        <div className="cridora-logo__edge" />
        <div className="cridora-logo__face cridora-logo__face--front" />
        <div className="cridora-logo__face cridora-logo__face--back" />
      </div>
      <span className="cridora-logo__type" aria-hidden>
        RA
      </span>
    </div>
  )
}
