'use client'

import { useState, useMemo } from 'react'
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
    <span className="text-[8px] font-bold uppercase tracking-wider rounded px-1 py-0.5" style={{ color: src === 'dassian' ? '#F43F5E' : '#0EA5E9', background: src === 'dassian' ? '#F43F5E1A' : '#0EA5E91A' }}>
      {src === 'dassian' ? 'DSN' : 'Fiori'}
    </span>
  )

  if (value && !open) {
    return (
      <div className="flex items-center gap-1.5 bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-md px-2 py-1.5">
        {badge(value.source)}
        <span className="flex-1 text-[11px] text-[var(--m12-text)] truncate" title={value.title}>{value.title}</span>
        <button type="button" onClick={() => setOpen(true)} title="Change tile" className="text-[var(--m12-text-muted)] hover:text-[#0EA5E9] text-[10px]">edit</button>
        <button type="button" onClick={() => onChange(undefined)} title="Clear tile" className="text-[var(--m12-border)] hover:text-red-400">×</button>
      </div>
    )
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-1.5 text-[11px] text-[#0EA5E9] border border-[#0EA5E9]/40 hover:border-[#0EA5E9]/70 hover:bg-[#0EA5E9]/5 rounded-md px-2.5 py-1.5 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
            <rect x="8" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
            <rect x="1.5" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
            <rect x="8" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          Choose Fiori / Dassian tile
        </button>
      ) : (
        <div className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-md p-1.5">
          <div className="flex items-center gap-1 mb-1.5">
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search tiles…"
              aria-label="Search Fiori tiles"
              className="flex-1 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] focus:outline-none focus:border-[#0EA5E9]/60"
            />
            <button type="button" onClick={() => { setOpen(false); setQ('') }} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] px-1 text-xs">done</button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {results.length === 0 && <div className="text-[10px] text-[var(--m12-text-muted)] px-1 py-2">No tiles match.</div>}
            {results.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onChange({ id: t.id, title: t.title, source: t.source, ...(t.appId ? { appId: t.appId } : {}) }); setOpen(false); setQ('') }}
                className="w-full flex items-center gap-1.5 text-left px-1.5 py-1 rounded hover:bg-[var(--m12-bg-card)] transition-colors"
              >
                {badge(t.source)}
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] text-[var(--m12-text)] truncate">{t.title}{t.appId ? ` (${t.appId})` : ''}</span>
                  <span className="block text-[9px] text-[var(--m12-text-muted)] truncate">{t.area}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
