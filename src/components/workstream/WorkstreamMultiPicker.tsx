'use client'

import { useEffect, useRef, useState } from 'react'
import type { Workstream } from '@/lib/workstream/types'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import { WorkstreamIcon } from './WorkstreamIcon'

interface Props {
  orgId: string
  value: string[]
  onChange: (ids: string[]) => void
  // Pass a preloaded list to avoid refetching per instance.
  workstreams?: Workstream[]
  className?: string
}

// Multi-select value-stream picker. The FIRST id in `value` is the primary
// value stream (used by the workstream-banded integration layout); the star
// promotes a selected value stream to primary.
export default function WorkstreamMultiPicker({ orgId, value, onChange, workstreams, className }: Props) {
  const [items, setItems] = useState<Workstream[]>(workstreams ?? [])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (workstreams) { setItems(workstreams); return }
    let active = true
    listWorkstreams(orgId).then((ws) => { if (active) setItems(ws) })
    return () => { active = false }
  }, [orgId, workstreams])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const byId = new Map(items.map((w) => [w.id, w]))
  const selected = value.map((id) => byId.get(id)).filter(Boolean) as Workstream[]

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else onChange([...value, id])
  }
  const makePrimary = (id: string) => onChange([id, ...value.filter((v) => v !== id)])

  return (
    <div className={`relative ${className ?? ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 hover:border-[var(--m12-border)] rounded-lg px-2.5 py-2 text-left transition-colors"
      >
        {selected.length === 0 ? (
          <>
            <span className="w-[14px] h-[14px] rounded-full border border-dashed border-[var(--m12-border)] shrink-0" />
            <span className="flex-1 truncate text-[11px] text-[var(--m12-text-muted)]">Value streams…</span>
          </>
        ) : (
          <>
            <div className="flex items-center -space-x-1 shrink-0">
              {selected.slice(0, 4).map((w, i) => (
                <span key={w.id} className="shrink-0" style={{ color: w.color || '#2563EB', zIndex: 10 - i }} title={w.name}>
                  <WorkstreamIcon icon={w.icon} size={14} />
                </span>
              ))}
            </div>
            <span className="flex-1 truncate text-[11px] text-[var(--m12-text)]">
              {selected.length === 1 ? selected[0].name : `${selected.length} value streams`}
            </span>
          </>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`text-[var(--m12-text-muted)] transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-72 overflow-auto bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-lg shadow-xl py-1">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[9px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">Value streams</span>
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="text-[9px] text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]">Clear</button>
            )}
          </div>
          {items.map((w) => {
            const on = value.includes(w.id)
            const isPrimary = value[0] === w.id
            return (
              <div key={w.id} className={`flex items-center gap-2 px-2.5 py-1.5 text-xs ${on ? 'bg-[#2563EB]/8' : ''}`}>
                <button type="button" onClick={() => toggle(w.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-[#2563EB] border-[#2563EB]' : 'border-[var(--m12-border)]'}`}>
                    {on && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  <span className="shrink-0" style={{ color: w.color || '#2563EB' }}><WorkstreamIcon icon={w.icon} size={14} /></span>
                  <span className="flex-1 truncate text-[var(--m12-text-secondary)]">{w.name}</span>
                </button>
                {on && (
                  <button
                    type="button"
                    onClick={() => makePrimary(w.id)}
                    title={isPrimary ? 'Primary value stream (drives diagram banding)' : 'Make primary'}
                    className={`shrink-0 ${isPrimary ? 'text-[#EAB308]' : 'text-[var(--m12-border)] hover:text-[#EAB308]'}`}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill={isPrimary ? 'currentColor' : 'none'}>
                      <path d="M6 1l1.5 3 3.3.5-2.4 2.3.6 3.3L6 9.8 3 10.4l.6-3.3L1.2 4.8 4.5 4.3 6 1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
          {items.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-[var(--m12-text-muted)]">No value streams yet. Seed them from the Workstreams page.</div>
          )}
        </div>
      )}
    </div>
  )
}
