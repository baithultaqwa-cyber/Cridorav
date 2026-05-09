import CoinHoverPinchLottie from '../features/lottie/CoinHoverPinchLottie'

/**
 * Wordmark: CRID + O + RA. The “O” is the Lottie coin (patched to logo golds; see scripts/patch_lottie_coin.py).
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
      <div className="cridora-logo__coin cridora-logo__coin--lottie" aria-hidden>
        <CoinHoverPinchLottie className="cridora-coin-face cridora-logo__lottie-inner" />
      </div>
      <span className="cridora-logo__type" aria-hidden>
        RA
      </span>
    </div>
  )
}
