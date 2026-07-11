'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, ArrowLeftRight, ArrowRight, Plus, X } from 'lucide-react'
import { Button, LoadingState } from '@/components/common'
import { useProcessStore } from '@/lib/process/store'
import { listProcessInterfaces, createProcessInterface, deleteProcessInterface } from '@/lib/supabase/process-models'
import type { ProcessInterface, InterfaceDirection } from '@/lib/process/types'
import { INTEGRATION_TECHS, INTERFACE_FREQUENCIES } from '@/lib/process/types'

const FIELD_CLASSES = 'h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none'

// Per-process integration register (inbound/outbound system interfaces).
export default function InterfacePanel({ nodeId, readOnly }: { nodeId: string; readOnly: boolean }) {
  const systems = useProcessStore(s => s.logicalSystems)
  const [items, setItems] = useState<ProcessInterface[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [direction, setDirection] = useState<InterfaceDirection>('outbound')
  const [frequency, setFrequency] = useState('')
  const [tech, setTech] = useState('')
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => { setLoading(true); setItems(await listProcessInterfaces(nodeId)); setLoading(false) }, [nodeId])
  useEffect(() => { load() }, [load])

  const sysName = (id: string | null) => (id ? systems.find(s => s.id === id)?.name || '(system)' : 'None')

  const handleAdd = async () => {
    if ((!sourceId && !targetId) || busy) return
    setBusy(true)
    try {
      const created = await createProcessInterface(nodeId, {
        source_system_id: sourceId || null, target_system_id: targetId || null,
        direction, frequency: frequency || null, integration_tech: tech || null, interface_ref: ref || null,
        sort_order: items.length,
      })
      setItems(i => [...i, created])
      setSourceId(''); setTargetId(''); setFrequency(''); setTech(''); setRef(''); setAdding(false)
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to add interface') } finally { setBusy(false) }
  }
  const handleDelete = async (id: string) => { setItems(i => i.filter(x => x.id !== id)); await deleteProcessInterface(id).catch(() => load()) }

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-label uppercase text-text-secondary">
          Interfaces {items.length > 0 && `(${items.length})`}
        </span>
        {!readOnly && !adding && (
          <Button variant="ghost" size="sm" icon={<Plus size={12} />} onClick={() => setAdding(true)}>Add</Button>
        )}
      </div>

      {loading ? (
        <LoadingState variant="inline" compact label="Loading interfaces..." />
      ) : items.length === 0 && !adding ? (
        <span className="text-[11px] text-text-tertiary">No interfaces documented.</span>
      ) : (
        <div className="space-y-1 mb-2">
          {items.map(it => (
            <div key={it.id} className="group flex items-center gap-2 text-[11px] bg-surface-muted border border-border rounded px-2 py-1">
              <span className="text-text-secondary">{sysName(it.source_system_id)}</span>
              <span className="text-brand-600 inline-flex shrink-0">
                {it.direction === 'inbound' ? <ArrowLeft size={12} /> : it.direction === 'bidirectional' ? <ArrowLeftRight size={12} /> : <ArrowRight size={12} />}
              </span>
              <span className="text-text-secondary">{sysName(it.target_system_id)}</span>
              <span className="flex-1 text-[10px] text-text-tertiary truncate">
                {[it.integration_tech, it.frequency, it.interface_ref].filter(Boolean).join(' · ')}
              </span>
              {!readOnly && (
                <button type="button" onClick={() => handleDelete(it.id)} aria-label="Delete" className="opacity-50 group-hover:opacity-100 text-text-tertiary hover:text-status-red">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && !readOnly && (
        <div className="bg-surface-muted border border-border rounded-lg p-2.5 space-y-2">
          <div className="flex gap-2">
            <select value={sourceId} onChange={e => setSourceId(e.target.value)} aria-label="Source system" className={`flex-1 min-w-0 ${FIELD_CLASSES}`}>
              <option value="">Source...</option>
              {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={direction} onChange={e => setDirection(e.target.value as InterfaceDirection)} aria-label="Direction" className={FIELD_CLASSES}>
              <option value="outbound">→</option><option value="inbound">←</option><option value="bidirectional">↔</option>
            </select>
            <select value={targetId} onChange={e => setTargetId(e.target.value)} aria-label="Target system" className={`flex-1 min-w-0 ${FIELD_CLASSES}`}>
              <option value="">Target...</option>
              {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <select value={tech} onChange={e => setTech(e.target.value)} aria-label="Integration tech" className={`flex-1 min-w-0 ${FIELD_CLASSES}`}>
              <option value="">Tech...</option>
              {INTEGRATION_TECHS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={frequency} onChange={e => setFrequency(e.target.value)} aria-label="Frequency" className={`flex-1 min-w-0 ${FIELD_CLASSES}`}>
              <option value="">Frequency...</option>
              {INTERFACE_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input value={ref} onChange={e => setRef(e.target.value)} aria-label="Interface ref" placeholder="Ref" className={`w-24 font-mono ${FIELD_CLASSES}`} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" loading={busy} disabled={!sourceId && !targetId} onClick={handleAdd}>
              {busy ? 'Adding...' : 'Add'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
