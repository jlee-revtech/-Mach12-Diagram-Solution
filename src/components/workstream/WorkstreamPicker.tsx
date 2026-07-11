'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Workstream } from '@/lib/workstream/types'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import { WorkstreamIcon } from './WorkstreamIcon'

interface Props {
  orgId: string
  value: string | null | undefined
  onChange: (workstreamId: string | null) => void
  // Pass a preloaded list to avoid refetching per instance.
  workstreams?: Workstream[]
  // Show an "All workstreams" option instead of "Unassigned" (filter mode).
  filterMode?: boolean
  className?: string
}

export default function WorkstreamPicker({ orgId, value, onChange, workstreams, filterMode, className }: Props) {
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

  const selected = items.find((w) => w.id === value) || null
  const emptyLabel = filterMode ? 'All workstreams' : 'Unassigned'

  return (
    <div className={`relative ${className ?? ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full bg-surface-input border border-border hover:border-border-strong rounded-lg px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
      >
        {selected ? (
          <span className="shrink-0" style={{ color: selected.color || '#2563EB' }}>
            <WorkstreamIcon icon={selected.icon} size={15} />
          </span>
        ) : (
          <span className="w-[15px] h-[15px] rounded-full border border-dashed border-border-strong shrink-0" />
        )}
        <span className={`flex-1 truncate text-body-sm ${selected ? 'text-text-primary' : 'text-text-tertiary'}`}>
          {selected ? selected.name : emptyLabel}
        </span>
        <ChevronDown size={12} className={`text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full max-h-72 overflow-auto bg-white border border-border rounded-lg shadow-dropdown py-1 animate-slide-in-up">
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false) }}
            className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-body-sm transition-colors ${!value ? 'bg-brand-50 text-brand-600' : 'text-text-tertiary hover:bg-surface-muted'}`}
          >
            <span className="w-[15px] h-[15px] rounded-full border border-dashed border-border-strong shrink-0" />
            {emptyLabel}
          </button>
          {items.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => { onChange(w.id); setOpen(false) }}
              className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-body-sm transition-colors ${w.id === value ? 'bg-brand-50 text-brand-600' : 'text-text-secondary hover:bg-surface-muted'}`}
            >
              <span className="shrink-0" style={{ color: w.color || '#2563EB' }}>
                <WorkstreamIcon icon={w.icon} size={15} />
              </span>
              <span className="flex-1 truncate">{w.name}</span>
            </button>
          ))}
          {items.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-text-tertiary">No workstreams yet. Seed them from the Workstreams page.</div>
          )}
        </div>
      )}
    </div>
  )
}
