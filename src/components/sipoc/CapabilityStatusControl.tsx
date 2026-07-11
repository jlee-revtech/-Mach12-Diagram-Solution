'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Clock, ChevronDown } from 'lucide-react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import { CAPABILITY_STATUSES, capabilityStatusColor, capabilityStatusLabel, type CapabilityStatus } from '@/lib/sipoc/types'

// Small check / clock glyphs for the status pill.
function StatusGlyph({ status }: { status?: string | null }) {
  if (status === 'done') return <Check size={9} className="shrink-0" />
  if (status === 'in_progress') return <Clock size={9} className="shrink-0" />
  return null
}

// Canonical status token pairs (green = done, yellow = in progress).
function statusPillClasses(status?: string | null): string {
  if (status === 'done') return 'bg-status-green-bg text-status-green'
  if (status === 'in_progress') return 'bg-status-yellow-bg text-status-yellow'
  return ''
}

// Read-only status badge — renders nothing when unset. Used on the L3 chips
// and anywhere a compact status indicator is needed.
export function CapabilityStatusBadge({ status, className = '' }: { status?: string | null; className?: string }) {
  if (status !== 'done' && status !== 'in_progress') return null
  return (
    <span
      title={capabilityStatusLabel(status)}
      className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusPillClasses(status)} ${className}`}
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
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider transition-colors ${
          activeColor ? statusPillClasses(status) : 'text-text-tertiary hover:text-text-primary hover:bg-surface-muted'
        }`}
      >
        {activeColor ? (
          <>
            <StatusGlyph status={status} />
            {status === 'done' ? 'Done' : 'In Progress'}
          </>
        ) : (
          <span>Status</span>
        )}
        <ChevronDown size={8} className="opacity-60 shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-white border border-border rounded-lg shadow-dropdown overflow-hidden py-1 animate-slide-in-up">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-text-tertiary border-b border-border">
            Review Status
          </div>
          {CAPABILITY_STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => set(s.value)}
              className="w-full text-left px-3 py-1.5 text-body-sm flex items-center gap-2 hover:bg-surface-muted transition-colors"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className={status === s.value ? 'font-semibold text-text-primary' : 'text-text-secondary'}>
                {s.label}
              </span>
              {status === s.value && <Check size={10} className="ml-auto text-text-tertiary shrink-0" />}
            </button>
          ))}
          <button
            onClick={() => set(null)}
            className="w-full text-left px-3 py-1.5 text-body-sm flex items-center gap-2 hover:bg-surface-muted transition-colors border-t border-border"
          >
            <span className="w-2 h-2 rounded-full shrink-0 border border-border-strong" />
            <span className={!status ? 'font-semibold text-text-primary' : 'text-text-secondary'}>
              Not Started
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
