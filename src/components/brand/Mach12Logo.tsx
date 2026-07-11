/**
 * Mach12 tesseract logo mark. Inline SVG (per the design system, the brand
 * mark is inlined in the Sidebar, not an <img>). Gradient blue -> cyan on a
 * transparent background so it sits on both light and dark surfaces.
 */
export function Mach12Logo({
  size = 28,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 76 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="m12-mark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <g transform="translate(38, 38)">
        <rect x="-26" y="-26" width="52" height="52" fill="none" stroke="url(#m12-mark)" strokeWidth="3" opacity="0.35" />
        <rect x="-12" y="-12" width="24" height="24" fill="none" stroke="url(#m12-mark)" strokeWidth="3" opacity="0.85" />
        <line x1="-26" y1="-26" x2="-12" y2="-12" stroke="url(#m12-mark)" strokeWidth="2" opacity="0.4" />
        <line x1="26" y1="-26" x2="12" y2="-12" stroke="url(#m12-mark)" strokeWidth="2" opacity="0.4" />
        <line x1="26" y1="26" x2="12" y2="12" stroke="url(#m12-mark)" strokeWidth="2" opacity="0.4" />
        <line x1="-26" y1="26" x2="-12" y2="12" stroke="url(#m12-mark)" strokeWidth="2" opacity="0.4" />
        <rect x="-5" y="-5" width="10" height="10" rx="1.5" fill="url(#m12-mark)" opacity="0.95" />
      </g>
    </svg>
  )
}
