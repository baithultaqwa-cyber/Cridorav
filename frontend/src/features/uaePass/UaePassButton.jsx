/**
 * UAE Pass entry — UI only until OIDC credentials are wired.
 * Do not fake a successful login from this control.
 */
export default function UaePassButton({ className = '' }) {
  return (
    <div className={className}>
      <button
        type="button"
        disabled
        title="UAE Pass sign-in is coming soon"
        className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-semibold disabled:opacity-70"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(232,195,74,0.18)',
          color: 'var(--text-primary)',
          cursor: 'not-allowed',
        }}
      >
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-black tracking-tight"
          style={{ background: '#C8102E', color: '#fff' }}
        >
          UAE
        </span>
        Continue with UAE Pass
      </button>
      <p className="text-[11px] text-center text-[var(--text-dim)] mt-2">
        UAE Pass will be available shortly. Use your mobile number for now.
      </p>
    </div>
  )
}
