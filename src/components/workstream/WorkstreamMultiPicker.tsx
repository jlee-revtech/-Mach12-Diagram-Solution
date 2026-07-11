'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Star } from 'lucide-react'
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
        className="flex items-center gap-1.5 w-full bg-surface-input border border-border hover:border-border-strong rounded-lg px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
      >
        {selected.length === 0 ? (
          <>
            <span className="w-[14px] h-[14px] rounded-full border border-dashed border-border-strong shrink-0" />
            <span className="flex-1 truncate text-[11px] text-text-tertiary">Value streams...</span>
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
            <span className="flex-1 truncate text-[11px] text-text-primary">
              {selected.length === 1 ? selected[0].name : `${selected.length} value streams`}
            </span>
          </>
        )}
        <ChevronDown size={12} className={`text-text-tertiary transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-72 overflow-auto bg-white border border-border rounded-lg shadow-dropdown py-1 animate-slide-in-up">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-mono">Value streams</span>
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="text-[10px] text-text-tertiary hover:text-text-secondary">Clear</button>
            )}
          </div>
          {items.map((w) => {
            const on = value.includes(w.id)
            const isPrimary = value[0] === w.id
            return (
              <div key={w.id} className={`flex items-center gap-2 px-2.5 py-1.5 text-body-sm ${on ? 'bg-brand-50' : ''}`}>
                <button type="button" onClick={() => toggle(w.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-brand-500 border-brand-500' : 'border-border-strong'}`}>
                    {on && <Check size={9} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className="shrink-0" style={{ color: w.color || '#2563EB' }}><WorkstreamIcon icon={w.icon} size={14} /></span>
                  <span className="flex-1 truncate text-text-secondary">{w.name}</span>
                </button>
                {on && (
                  <button
                    type="button"
                    onClick={() => makePrimary(w.id)}
                    title={isPrimary ? 'Primary value stream (drives diagram banding)' : 'Make primary'}
                    className={`shrink-0 ${isPrimary ? 'text-[#EAB308]' : 'text-border-strong hover:text-[#EAB308]'}`}
                  >
                    <Star size={11} fill={isPrimary ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
            )
          })}
          {items.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-text-tertiary">No value streams yet. Seed them from the Workstreams page.</div>
          )}
        </div>
      )}
    </div>
  )
}
