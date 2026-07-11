'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Button, EmptyState } from '@/components/common'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'
import { downloadCapabilityMapXlsx } from '@/lib/export/capabilityWorkspaceXlsx'
import type { CapabilityWithSystems } from '@/lib/capmap/types'
import type { BedrockSystemWithPhysicals } from '@/lib/bedrock/types'
import type { Workstream } from '@/lib/workstream/types'

const UNALIGNED = '__unaligned__'

// Read-only renderer for a shared Capability Map workspace. Board + pivots only:
// no add/edit/archive/AI/seed/align — purely a view of the capability list and
// its value-stream / logical-system / physical-system assignments.
export default function CapabilityMapShareView({
  caps, catalog, workstreams, title, expiresAt,
}: {
  caps: CapabilityWithSystems[]
  catalog: BedrockSystemWithPhysicals[]
  workstreams: Workstream[]
  title: string
  expiresAt: string | null
}) {
  const [view, setView] = useState<'board' | 'pivot'>('board')
  const [slice, setSlice] = useState<'workstream' | 'logical' | 'physical'>('workstream')
  const [search, setSearch] = useState('')
  const [wsFilter, setWsFilter] = useState<string | null>(null)

  const catById = useMemo(() => new Map(catalog.map(c => [c.id, c])), [catalog])
  const physById = useMemo(() => {
    const m = new Map<string, { name: string; parentId: string }>()
    for (const c of catalog) for (const p of c.physicals) m.set(p.id, { name: p.name, parentId: c.id })
    return m
  }, [catalog])
  const wsById = useMemo(() => new Map(workstreams.map(w => [w.id, w])), [workstreams])
  const wsName = (id: string | null) => (id && wsById.get(id)?.name) || 'Unaligned'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return caps.filter(c => {
      if (wsFilter) {
        if (wsFilter === UNALIGNED ? !!c.workstream_id : c.workstream_id !== wsFilter) return false
      }
      if (q && !(`${c.name} ${c.description || ''} ${c.domain || ''} ${wsName(c.workstream_id)}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [caps, search, wsFilter, wsById])

  const groups = useMemo(() => {
    const byWs = new Map<string, CapabilityWithSystems[]>()
    for (const c of filtered) {
      const key = c.workstream_id && wsById.has(c.workstream_id) ? c.workstream_id : UNALIGNED
      if (!byWs.has(key)) byWs.set(key, [])
      byWs.get(key)!.push(c)
    }
    const ordered: { key: string; ws: Workstream | null; list: CapabilityWithSystems[] }[] = []
    for (const w of workstreams) if (byWs.has(w.id)) ordered.push({ key: w.id, ws: w, list: byWs.get(w.id)! })
    if (byWs.has(UNALIGNED)) ordered.push({ key: UNALIGNED, ws: null, list: byWs.get(UNALIGNED)! })
    return ordered
  }, [filtered, workstreams, wsById])

  const pivotColumns = useMemo(() => {
    type Col = { key: string; label: string; color: string; icon?: string | null; caps: CapabilityWithSystems[] }
    const cols: Col[] = []
    if (slice === 'workstream') {
      const byWs = new Map<string, CapabilityWithSystems[]>()
      for (const c of filtered) {
        const key = c.workstream_id && wsById.has(c.workstream_id) ? c.workstream_id : UNALIGNED
        if (!byWs.has(key)) byWs.set(key, [])
        byWs.get(key)!.push(c)
      }
      for (const w of workstreams) if (byWs.has(w.id)) cols.push({ key: w.id, label: w.name, color: w.color || '#10B981', icon: w.icon, caps: byWs.get(w.id)! })
      if (byWs.has(UNALIGNED)) cols.push({ key: UNALIGNED, label: 'Unaligned', color: '#F59E0B', caps: byWs.get(UNALIGNED)! })
    } else if (slice === 'logical') {
      for (const s of catalog) {
        const list = filtered.filter(c => c.logicalSystemIds.includes(s.id))
        if (list.length) cols.push({ key: s.id, label: s.label, color: s.color || '#10B981', caps: list })
      }
      const unmapped = filtered.filter(c => c.logicalSystemIds.length === 0)
      if (unmapped.length) cols.push({ key: UNALIGNED, label: 'Unmapped', color: '#F59E0B', caps: unmapped })
    } else {
      for (const s of catalog) for (const p of s.physicals) {
        const list = filtered.filter(c => c.physicalSystemIds.includes(p.id))
        if (list.length) cols.push({ key: p.id, label: p.name, color: s.color || '#10B981', caps: list })
      }
      const unmapped = filtered.filter(c => c.physicalSystemIds.length === 0)
      if (unmapped.length) cols.push({ key: UNALIGNED, label: 'No physical system', color: '#F59E0B', caps: unmapped })
    }
    return cols
  }, [slice, filtered, catalog, workstreams, wsById])

  const wsChips = workstreams.filter(w => caps.some(c => c.workstream_id === w.id))
  const unalignedCount = caps.filter(c => !c.workstream_id || !wsById.has(c.workstream_id)).length

  const renderChips = (c: CapabilityWithSystems) => (
    <div className="flex flex-wrap gap-1">
      {c.logicalSystemIds.length === 0 && c.physicalSystemIds.length === 0 && (
        <span className="text-[10px] text-text-tertiary italic">Unmapped</span>
      )}
      {c.logicalSystemIds.map(sid => {
        const s = catById.get(sid)
        if (!s) return null
        return (
          <span key={sid} className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border" style={{ color: s.color || '#10B981', borderColor: `${s.color || '#10B981'}55`, background: `${s.color || '#10B981'}12` }}>
            <span className="w-1.5 h-1.5 rounded-sm" style={{ background: s.color || '#10B981' }} />
            {s.label}
          </span>
        )
      })}
      {c.physicalSystemIds.map(pid => {
        const p = physById.get(pid)
        return p ? <span key={pid} className="text-[10px] rounded px-1.5 py-0.5 bg-surface-muted border border-border text-text-secondary">{p.name}</span> : null
      })}
    </div>
  )

  const expiryNote = expiresAt ? `Link expires ${new Date(expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : null

  return (
    <div className="min-h-screen bg-surface-muted p-6 md:p-8">
      <div className="mx-auto w-full max-w-[1800px]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <span className="text-gradient text-xl font-bold font-display tracking-wide">MACH12</span>
          <span className="text-text-tertiary text-body-md">/</span>
          <span className="text-text-secondary text-body-md font-medium">{title}</span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded">Read-only</span>
        </div>
        <div className="flex items-center gap-3 mb-5">
          <p className="text-body-sm text-text-secondary">Shared view of the capability map. {caps.length} capabilities across {wsChips.length} value streams.{expiryNote ? ` ${expiryNote}.` : ''}</p>
        </div>

        {/* Toolbar (view + slice + search + export only - no editing) */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex gap-1 bg-white border border-border rounded-lg p-1">
            <button type="button" onClick={() => setView('board')} className={`px-3 py-1.5 rounded text-body-sm font-medium transition-colors ${view === 'board' ? 'bg-brand-500 text-white' : 'text-text-secondary hover:bg-surface-muted'}`}>Board</button>
            <button type="button" onClick={() => setView('pivot')} className={`px-3 py-1.5 rounded text-body-sm font-medium transition-colors ${view === 'pivot' ? 'bg-brand-500 text-white' : 'text-text-secondary hover:bg-surface-muted'}`}>Pivot</button>
          </div>
          {view === 'pivot' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider font-mono text-text-tertiary">Slice by</span>
              <div className="flex gap-1 bg-white border border-border rounded-lg p-1">
                {([['workstream', 'Value Stream'], ['logical', 'Logical System'], ['physical', 'Physical System']] as const).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setSlice(k)} className={`px-2.5 py-1.5 rounded text-body-sm font-medium transition-colors ${slice === k ? 'bg-brand-500 text-white' : 'text-text-secondary hover:bg-surface-muted'}`}>{label}</button>
                ))}
              </div>
            </div>
          )}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search capabilities…" aria-label="Search capabilities" className="flex-1 min-w-[160px] h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          <Button
            variant="secondary"
            size="md"
            onClick={() => downloadCapabilityMapXlsx(caps, workstreams, catalog, title)}
            title="Download this capability map as Excel"
            icon={<Download size={14} />}
          >
            Download
          </Button>
        </div>

        {/* Value stream filter chips */}
        {(wsChips.length > 0 || unalignedCount > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-5">
            <button type="button" onClick={() => setWsFilter(null)} className={`text-[11px] rounded-full px-2.5 py-1 border transition-colors ${!wsFilter ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-border text-text-secondary hover:bg-surface-muted'}`}>All ({caps.length})</button>
            {wsChips.map(w => {
              const n = caps.filter(c => c.workstream_id === w.id).length
              const on = wsFilter === w.id
              return (
                <button key={w.id} type="button" onClick={() => setWsFilter(w.id)} className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2.5 py-1 border transition-colors ${on ? 'text-white' : 'text-text-secondary hover:bg-surface-muted'}`} style={on ? { background: w.color || '#10B981', borderColor: w.color || '#10B981' } : { borderColor: `${w.color || '#64748B'}66` }}>
                  <span style={{ color: on ? '#fff' : (w.color || '#10B981') }}><WorkstreamIcon icon={w.icon} size={11} /></span>
                  {w.name} ({n})
                </button>
              )
            })}
            {unalignedCount > 0 && (
              <button type="button" onClick={() => setWsFilter(UNALIGNED)} className={`text-[11px] rounded-full px-2.5 py-1 border transition-colors ${wsFilter === UNALIGNED ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-border text-text-secondary hover:bg-surface-muted'}`}>Unaligned ({unalignedCount})</button>
            )}
          </div>
        )}

        {view === 'board' ? (
          <div className="space-y-6">
            {groups.map(({ key, ws, list }) => {
              const subMap = new Map<string, CapabilityWithSystems[]>()
              for (const c of list) {
                const g = c.domain && c.domain.trim() ? c.domain.trim() : 'Other capabilities'
                if (!subMap.has(g)) subMap.set(g, [])
                subMap.get(g)!.push(c)
              }
              const subGroups = Array.from(subMap.entries())
              const showSub = subGroups.length > 1 || subGroups[0]?.[0] !== 'Other capabilities'
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-3">
                    {ws ? <span style={{ color: ws.color || '#10B981' }}><WorkstreamIcon icon={ws.icon} size={14} /></span> : <span className="w-2 h-2 rounded-full bg-amber-500" />}
                    <h3 className="text-body-sm font-semibold tracking-wide" style={{ color: ws?.color || '#B45309' }}>{ws ? ws.name : 'Unaligned'}</h3>
                    <span className="text-[10px] text-text-tertiary">{list.length}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-4">
                    {subGroups.map(([groupName, groupCaps]) => (
                      <div key={groupName}>
                        {showSub && (
                          <div className="flex items-center gap-2 mb-2 pl-0.5">
                            <span className="w-1 h-3 rounded-full shrink-0" style={{ background: ws?.color || '#10B981' }} />
                            <h4 className="text-[11px] font-semibold tracking-wide text-text-secondary">{groupName}</h4>
                            <span className="text-[10px] text-text-tertiary">{groupCaps.length}</span>
                            <div className="flex-1 h-px bg-border/50" />
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {groupCaps.map(c => (
                            <div key={c.id} className="bg-white border border-border rounded-lg shadow-card p-4">
                              <h4 className="text-body-md font-semibold text-text-primary mb-2">{c.name}</h4>
                              {c.description && <p className="text-[11px] text-text-secondary mb-2 line-clamp-2">{c.description}</p>}
                              {renderChips(c)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {groups.length === 0 && (
              <EmptyState variant="dashed" title="No matches" description="No capabilities match this filter." />
            )}
          </div>
        ) : (
          pivotColumns.length === 0 ? (
            <EmptyState variant="dashed" title="No matches" description="No capabilities match this slice." />
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-3">
              {pivotColumns.map(col => (
                <div key={col.key} className="w-64 shrink-0 bg-surface-muted border border-border rounded-lg flex flex-col">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    {slice === 'workstream' && col.icon !== undefined && col.key !== UNALIGNED
                      ? <span style={{ color: col.color }}><WorkstreamIcon icon={col.icon} size={13} /></span>
                      : <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: col.color }} />}
                    <span className="text-body-sm font-semibold flex-1 truncate" style={{ color: col.color }}>{col.label}</span>
                    <span className="text-[10px] text-text-tertiary shrink-0">{col.caps.length}</span>
                  </div>
                  <div className="p-2 space-y-1.5 overflow-y-auto" style={{ maxHeight: 600 }}>
                    {col.caps.map(c => {
                      const ws = c.workstream_id ? wsById.get(c.workstream_id) : null
                      return (
                        <div key={c.id} className="bg-white border border-border rounded-lg px-2.5 py-2">
                          <div className="text-body-sm font-medium text-text-primary mb-1">{c.name}</div>
                          <div className="flex flex-wrap gap-1">
                            {slice !== 'workstream' && ws && (
                              <span className="text-[10px] rounded px-1 py-0.5" style={{ color: ws.color || '#10B981', background: `${ws.color || '#10B981'}18` }}>{ws.name}</span>
                            )}
                            {slice === 'workstream' && c.logicalSystemIds.map(sid => { const s = catById.get(sid); return s ? <span key={sid} className="text-[10px] rounded px-1 py-0.5 border" style={{ color: s.color || '#10B981', borderColor: `${s.color || '#10B981'}55` }}>{s.label}</span> : null })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
