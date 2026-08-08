/**
 * UAE Pass entry — UI only until OIDC credentials are wired.
 * Official logo from https://uaepass.ae/images/full-logo.svg
 * Do not fake a successful login from this control.
 */
export default function UaePassButton({ className = '' }) {
  return (
    <div className={className}>
      <button
        type="button"
        disabled
        title="UAE Pass sign-in is coming soon"
        aria-label="Continue with UAE PASS"
        className="w-full flex items-center justify-center rounded-xl py-3.5 px-4 disabled:opacity-70"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(232,195,74,0.18)',
          cursor: 'not-allowed',
        }}
      >
        <img
          src="/brand/uae-pass-logo-white.svg"
          alt="UAE PASS"
          width={114}
          height={34}
          className="h-8 w-auto"
          draggable={false}
        />
      </button>
      <p className="text-[11px] text-center text-[var(--text-dim)] mt-2">
        UAE PASS will be available shortly. Use your mobile number for now.
      </p>
    </div>
  )
}
