import birdEmblemUrl from '../assets/cridora-bird-emblem.png'

/** Bird seal mark (CRIDORA / UAE) — used in navbar, footer, auth, and dashboards. */
export default function CridoraLogo({ size = 'md', className = '' }) {
  return (
    <div
      className={`cridora-logo cridora-logo--bird cridora-logo--${size} ${className}`.trim()}
      role="img"
      aria-label="Cridora"
    >
      <img
        src={birdEmblemUrl}
        alt=""
        className="cridora-logo__emblem"
        decoding="async"
        draggable={false}
      />
    </div>
  )
}
