import type { WorkstreamIconKey } from '@/lib/workstream/catalog'

// Inline SVG glyphs for each workstream icon key. Single-color (currentColor)
// so the caller controls hue via the wrapping element / style.
const PATHS: Record<WorkstreamIconKey, React.ReactNode> = {
  target: (
    <>
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="9" cy="9" r="0.8" fill="currentColor" />
    </>
  ),
  contract: (
    <>
      <path d="M4 2.5h6l4 4V15a.5.5 0 01-.5.5h-9A.5.5 0 014 15V3a.5.5 0 010-.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M10 2.5V6.5h4M6.5 9.5h5M6.5 12h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  factory: (
    <>
      <path d="M2.5 15.5V7l4 2.5V7l4 2.5V5l4 2v6.5a.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </>
  ),
  cart: (
    <>
      <circle cx="6.5" cy="14.5" r="1.1" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="13" cy="14.5" r="1.1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 2.5h2l1.6 8.2a1 1 0 001 .8h6.2a1 1 0 001-.8L16 5H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  drafting: (
    <>
      <path d="M9 2L3 14.5h12L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6 10.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  asset: (
    <>
      <path d="M9 2.5l6 3.2v6.6L9 15.5l-6-3.2V5.7L9 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M3 5.7L9 9m0 0l6-3.3M9 9v6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  wrench: (
    <>
      <path d="M12.5 2.5a3.2 3.2 0 00-3 4.2L3 13.2a1.4 1.4 0 102 2l6.5-6.5a3.2 3.2 0 004.2-3l-2 2-1.7-.5-.5-1.7 2-2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </>
  ),
  portfolio: (
    <>
      <rect x="2.5" y="9" width="3" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="7.5" y="5.5" width="3" height="9.5" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="12.5" y="2.5" width="3" height="12.5" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  ledger: (
    <>
      <rect x="3" y="2.5" width="12" height="13" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 5.5h6M6 8h6M6 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  people: (
    <>
      <circle cx="6.5" cy="6" r="2.3" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12.5" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 14.5c0-2.3 1.9-3.7 4-3.7s4 1.4 4 3.7M11 14.5c0-1.7 1-2.9 2.7-3.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
}

export function WorkstreamIcon({ icon, size = 18, className }: { icon?: string | null; size?: number; className?: string }) {
  const node = icon && icon in PATHS ? PATHS[icon as WorkstreamIconKey] : PATHS.target
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" className={className}>
      {node}
    </svg>
  )
}
