/**
 * Layout wrapper for marketing sections. Content is always visible immediately
 * (no scroll-gated opacity) so fast scrolling never leaves blank sections.
 */
export default function FadeIn({ children, className = '' }) {
  return <div className={className}>{children}</div>
}
