'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, LoadingState } from '@/components/common'
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

const KIND_CHIP: Record<OverlayKind, string> = {
  compliance: 'bg-status-red-bg text-status-red',
  control: 'bg-status-red-bg text-status-red',
  kpi: 'bg-status-green-bg text-status-green',
  accelerator: 'bg-purple-50 text-purple-700',
  variant: 'bg-status-yellow-bg text-status-yellow',
  scope_item: 'bg-status-blue-bg text-status-blue',
}

const FIELD_CLASSES = 'h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none'

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
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-label uppercase text-text-secondary">
          A&amp;D Overlay {overlays.length > 0 && `(${overlays.length})`}
        </span>
        {!readOnly && !adding && (
          <Button variant="ghost" size="sm" icon={<Plus size={12} />} onClick={() => setAdding(true)}>
            Add
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState variant="inline" compact label="Loading overlays..." />
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {overlays.length === 0 && !adding && <span className="text-[11px] text-text-tertiary">No controls, KPIs, or accelerators yet.</span>}
          {overlays.map(o => {
            const chip = KIND_CHIP[o.overlay_kind] || 'bg-gray-100 text-gray-500'
            const label = o.overlay_kind === 'compliance' || o.overlay_kind === 'control'
              ? `${o.payload.framework || ''} ${o.payload.code || ''} ${o.payload.title}`.trim()
              : o.overlay_kind === 'kpi'
                ? `${o.payload.title}${o.payload.kpiTarget ? ` · ${o.payload.kpiTarget}` : ''}`
                : o.payload.title
            return (
              <span key={o.id} title={o.payload.notes || KIND_LABEL[o.overlay_kind]} className={`group inline-flex items-center gap-1 text-[10px] font-mono rounded px-1.5 py-0.5 ${chip}`}>
                {label}
                {!readOnly && (
                  <button type="button" onClick={() => handleDelete(o.id)} aria-label="Remove overlay" className="opacity-50 group-hover:opacity-100 hover:text-status-red">
                    <X size={10} />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      {adding && !readOnly && (
        <div className="bg-surface-muted border border-border rounded-lg p-2.5 space-y-2">
          <div className="flex gap-2">
            <select value={kind} onChange={e => setKind(e.target.value as OverlayKind)} aria-label="Overlay kind" className={FIELD_CLASSES}>
              {(Object.keys(KIND_LABEL) as OverlayKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            {(kind === 'compliance' || kind === 'control') && (
              <select value={framework} onChange={e => setFramework(e.target.value as ComplianceFramework)} aria-label="Framework" className={FIELD_CLASSES}>
                {COMPLIANCE_FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            )}
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} aria-label="Overlay title" placeholder="Title (e.g. Timekeeping integrity)" className={`w-full ${FIELD_CLASSES}`} />
          <div className="flex gap-2">
            {(kind === 'compliance' || kind === 'control' || kind === 'scope_item' || kind === 'accelerator') && (
              <input value={code} onChange={e => setCode(e.target.value)} aria-label="Code or reference" placeholder={kind === 'accelerator' ? 'Accelerator ref' : 'Code (e.g. 52.216-7)'} className={`flex-1 min-w-0 font-mono ${FIELD_CLASSES}`} />
            )}
            {kind === 'kpi' && (
              <input value={kpiTarget} onChange={e => setKpiTarget(e.target.value)} aria-label="KPI target" placeholder="Target (e.g. CPI >= 0.95)" className={`flex-1 min-w-0 font-mono ${FIELD_CLASSES}`} />
            )}
          </div>
          <input value={notes} onChange={e => setNotes(e.target.value)} aria-label="Notes" placeholder="Notes (optional)" className={`w-full ${FIELD_CLASSES}`} />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" loading={busy} disabled={!title.trim()} onClick={handleAdd}>
              {busy ? 'Adding...' : 'Add'}
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
