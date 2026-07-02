'use client'

import { useEffect, useRef, useState } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import { CAPABILITY_STATUSES, capabilityStatusColor, capabilityStatusLabel, type CapabilityStatus } from '@/lib/sipoc/types'

// Small check / dot glyphs for the status pill.
function StatusGlyph({ status }: { status?: string | null }) {
  if (status === 'done') {
    return (
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
        <path d="M1.5 5.2l2.2 2.3L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (status === 'in_progress') {
    return (
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 5V2.2A2.8 2.8 0 015 7.8z" fill="currentColor" />
      </svg>
    )
  }
  return null
}

// Read-only status badge — renders nothing when unset. Used on the L3 chips
// and anywhere a compact status indicator is needed.
export function CapabilityStatusBadge({ status, className = '' }: { status?: string | null; className?: string }) {
  if (status !== 'done' && status !== 'in_progress') return null
  const color = capabilityStatusColor(status)
  return (
    <span
      title={capabilityStatusLabel(status)}
      className={`shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-semibold ${className}`}
      style={{ color, backgroundColor: `${color}22` }}
    >
      <StatusGlyph status={status} />
      {status === 'done' ? 'Done' : 'WIP'}
    </span>
  )
}

// Interactive status control — a pill that opens a small menu to set
// Done / In Progress / Not Started. Persists via the store (optimistic +
// Supabase PATCH). When read-only, degrades to a plain badge.
export default function CapabilityStatusControl({
  capabilityId,
  status,
  readOnly,
}: {
  capabilityId: string
  status?: string | null
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  if (readOnly) {
    const color = capabilityStatusColor(status)
    if (!color) return null
    return <CapabilityStatusBadge status={status} />
  }

  const set = (next: CapabilityStatus | null) => {
    useSIPOCStore.getState().updateCapability(capabilityId, { status: next })
    setOpen(false)
  }

  const activeColor = capabilityStatusColor(status)

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        title="Set review status"
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider transition-colors"
        style={
          activeColor
            ? { color: activeColor, backgroundColor: `${activeColor}1f` }
            : undefined
        }
      >
        {activeColor ? (
          <>
            <StatusGlyph status={status} />
            {status === 'done' ? 'Done' : 'In Progress'}
          </>
        ) : (
          <span className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">Status</span>
        )}
        <svg width="7" height="7" viewBox="0 0 8 8" fill="none" className="opacity-60">
          <path d="M1.5 3L4 5.5 6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg shadow-xl overflow-hidden py-0.5">
          <div className="px-2.5 py-1 text-[8px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] uppercase tracking-widest font-bold border-b border-[var(--m12-border)]/20">
            Review Status
          </div>
          {CAPABILITY_STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => set(s.value)}
              className="w-full text-left px-2.5 py-1.5 text-[10px] flex items-center gap-2 hover:bg-[var(--m12-bg)] transition-colors"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className={status === s.value ? 'font-semibold text-[var(--m12-text)]' : 'text-[var(--m12-text-secondary)]'}>
                {s.label}
              </span>
              {status === s.value && (
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="ml-auto text-[var(--m12-text-muted)]">
                  <path d="M1.5 5.2l2.2 2.3L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
          <button
            onClick={() => set(null)}
            className="w-full text-left px-2.5 py-1.5 text-[10px] flex items-center gap-2 hover:bg-[var(--m12-bg)] transition-colors border-t border-[var(--m12-border)]/20"
          >
            <span className="w-2 h-2 rounded-full shrink-0 border border-[var(--m12-text-faint)]" />
            <span className={!status ? 'font-semibold text-[var(--m12-text)]' : 'text-[var(--m12-text-secondary)]'}>
              Not Started
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
