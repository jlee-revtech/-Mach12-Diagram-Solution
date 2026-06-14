'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  listProcessOverlays, createProcessOverlay, deleteProcessOverlay,
} from '@/lib/supabase/process-models'
import type { ProcessOverlay, OverlayKind, ComplianceFramework } from '@/lib/process/types'
import { COMPLIANCE_FRAMEWORKS } from '@/lib/process/types'

const KIND_LABEL: Record<OverlayKind, string> = {
  compliance: 'Compliance Control',
  control: 'Control',
  kpi: 'KPI',
  accelerator: 'RevTech Accelerator',
  variant: 'GovCon Variant',
  scope_item: 'Scope Item',
}

const KIND_COLOR: Record<OverlayKind, string> = {
  compliance: '#EF4444', control: '#EF4444', kpi: '#10B981',
  accelerator: '#8B5CF6', variant: '#F59E0B', scope_item: '#0EA5E9',
}

// RevTech/Mach12 A&D overlay editor for a process node.
export default function OverlayPanel({ nodeId, readOnly }: { nodeId: string; readOnly: boolean }) {
  const [overlays, setOverlays] = useState<ProcessOverlay[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  // new-overlay form state
  const [kind, setKind] = useState<OverlayKind>('compliance')
  const [title, setTitle] = useState('')
  const [framework, setFramework] = useState<ComplianceFramework>('DCAA')
  const [code, setCode] = useState('')
  const [kpiTarget, setKpiTarget] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setOverlays(await listProcessOverlays(nodeId))
    setLoading(false)
  }, [nodeId])
  useEffect(() => { load() }, [load])

  const reset = () => { setTitle(''); setCode(''); setKpiTarget(''); setNotes(''); setAdding(false) }

  const handleAdd = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      const payload: ProcessOverlay['payload'] = { title: title.trim() }
      if (kind === 'compliance' || kind === 'control') { payload.framework = framework; if (code.trim()) payload.code = code.trim() }
      if (kind === 'kpi' && kpiTarget.trim()) payload.kpiTarget = kpiTarget.trim()
      if (kind === 'accelerator' && code.trim()) payload.acceleratorRef = code.trim()
      if (kind === 'scope_item' && code.trim()) payload.code = code.trim()
      if (notes.trim()) payload.notes = notes.trim()
      const created = await createProcessOverlay(nodeId, kind, payload, overlays.length)
      setOverlays(o => [...o, created])
      reset()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add overlay')
    } finally { setBusy(false) }
  }

  const handleDelete = async (id: string) => {
    setOverlays(o => o.filter(x => x.id !== id))
    await deleteProcessOverlay(id).catch(() => load())
  }

  return (
    <div className="px-4 py-3 border-t border-[var(--m12-border)]/40">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold">
          A&amp;D Overlay {overlays.length > 0 && `(${overlays.length})`}
        </span>
        {!readOnly && !adding && (
          <button onClick={() => setAdding(true)} className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[#0EA5E9] hover:text-[#38BDF8]">
            + Add
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-[11px] text-[var(--m12-text-muted)]">Loading…</div>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {overlays.length === 0 && !adding && <span className="text-[11px] text-[var(--m12-text-muted)]">No controls, KPIs, or accelerators yet.</span>}
          {overlays.map(o => {
            const c = KIND_COLOR[o.overlay_kind] || '#64748B'
            const label = o.overlay_kind === 'compliance' || o.overlay_kind === 'control'
              ? `${o.payload.framework || ''} ${o.payload.code || ''} ${o.payload.title}`.trim()
              : o.overlay_kind === 'kpi'
                ? `${o.payload.title}${o.payload.kpiTarget ? ` · ${o.payload.kpiTarget}` : ''}`
                : o.payload.title
            return (
              <span key={o.id} title={o.payload.notes || KIND_LABEL[o.overlay_kind]} className="group inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border" style={{ color: c, borderColor: `${c}55`, background: `${c}12` }}>
                {label}
                {!readOnly && (
                  <button onClick={() => handleDelete(o.id)} className="opacity-50 group-hover:opacity-100 hover:text-red-400">×</button>
                )}
              </span>
            )
          })}
        </div>
      )}

      {adding && !readOnly && (
        <div className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg p-2.5 space-y-2">
          <div className="flex gap-2">
            <select value={kind} onChange={e => setKind(e.target.value as OverlayKind)} aria-label="Overlay kind" className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] focus:outline-none">
              {(Object.keys(KIND_LABEL) as OverlayKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            {(kind === 'compliance' || kind === 'control') && (
              <select value={framework} onChange={e => setFramework(e.target.value as ComplianceFramework)} aria-label="Framework" className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] focus:outline-none">
                {COMPLIANCE_FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            )}
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} aria-label="Overlay title" placeholder="Title (e.g. Timekeeping integrity)" className="w-full bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] focus:outline-none" />
          <div className="flex gap-2">
            {(kind === 'compliance' || kind === 'control' || kind === 'scope_item' || kind === 'accelerator') && (
              <input value={code} onChange={e => setCode(e.target.value)} aria-label="Code or reference" placeholder={kind === 'accelerator' ? 'Accelerator ref' : 'Code (e.g. 52.216-7)'} className="flex-1 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] font-[family-name:var(--font-space-mono)] focus:outline-none" />
            )}
            {kind === 'kpi' && (
              <input value={kpiTarget} onChange={e => setKpiTarget(e.target.value)} aria-label="KPI target" placeholder="Target (e.g. CPI >= 0.95)" className="flex-1 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] font-[family-name:var(--font-space-mono)] focus:outline-none" />
            )}
          </div>
          <input value={notes} onChange={e => setNotes(e.target.value)} aria-label="Notes" placeholder="Notes (optional)" className="w-full bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={busy || !title.trim()} className="flex-1 bg-[#0EA5E9] hover:bg-[#38BDF8] disabled:opacity-50 text-white text-[11px] font-medium rounded py-1.5 transition-colors">{busy ? 'Adding…' : 'Add'}</button>
            <button onClick={reset} className="px-3 text-[11px] text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
