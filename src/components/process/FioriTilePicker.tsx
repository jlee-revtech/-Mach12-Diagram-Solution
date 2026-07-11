'use client'

import { useState, useMemo } from 'react'
import { LayoutGrid, Pencil, Search, X } from 'lucide-react'
import { Button } from '@/components/common'
import { searchFioriTiles } from '@/lib/process/fioriCatalog'
import type { FioriTileRef } from '@/lib/process/types'

// Searchable picker over the seeded Fiori/Dassian tile catalog. Expands inline
// (no absolute popover) to avoid clipping inside the narrow inspector.
export default function FioriTilePicker({ value, onChange }: {
  value?: FioriTileRef
  onChange: (t: FioriTileRef | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const results = useMemo(() => searchFioriTiles(q).slice(0, 40), [q])

  const badge = (src: 'fiori' | 'dassian') => (
    <span className={`text-[10px] font-bold uppercase tracking-wider rounded px-1 py-0.5 ${src === 'dassian' ? 'bg-rose-50 text-rose-600' : 'bg-status-blue-bg text-status-blue'}`}>
      {src === 'dassian' ? 'DSN' : 'Fiori'}
    </span>
  )

  if (value && !open) {
    return (
      <div className="flex items-center gap-1.5 bg-surface-muted border border-border rounded-lg px-2 py-1.5">
        {badge(value.source)}
        <span className="flex-1 text-[11px] text-text-primary truncate" title={value.title}>{value.title}</span>
        <button type="button" onClick={() => setOpen(true)} title="Change tile" aria-label="Change tile" className="text-text-tertiary hover:text-brand-600 transition-colors">
          <Pencil size={12} />
        </button>
        <button type="button" onClick={() => onChange(undefined)} title="Clear tile" aria-label="Clear tile" className="text-text-tertiary hover:text-status-red transition-colors">
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <div>
      {!open ? (
        <Button variant="secondary" size="sm" fullWidth icon={<LayoutGrid size={12} />} onClick={() => setOpen(true)}>
          Choose Fiori / Dassian tile
        </Button>
      ) : (
        <div className="bg-surface-muted border border-border rounded-lg p-1.5">
          <div className="flex items-center gap-1 mb-1.5">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                autoFocus
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search tiles..."
                aria-label="Search Fiori tiles"
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setQ('') }}>Done</Button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {results.length === 0 && <div className="text-[11px] text-text-tertiary px-1 py-2">No tiles match.</div>}
            {results.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onChange({ id: t.id, title: t.title, source: t.source, ...(t.appId ? { appId: t.appId } : {}) }); setOpen(false); setQ('') }}
                className="w-full flex items-center gap-1.5 text-left px-1.5 py-1 rounded hover:bg-white transition-colors"
              >
                {badge(t.source)}
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] text-text-primary truncate">
                    {t.title}
                    {t.appId ? <span className="font-mono text-text-tertiary"> ({t.appId})</span> : null}
                  </span>
                  <span className="block text-[10px] text-text-tertiary truncate">{t.area}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
