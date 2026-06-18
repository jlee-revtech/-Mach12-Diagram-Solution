'use client'

import { useEffect, useState, useCallback } from 'react'
import { useProcessStore } from '@/lib/process/store'
import { listProcessInterfaces, createProcessInterface, deleteProcessInterface } from '@/lib/supabase/process-models'
import type { ProcessInterface, InterfaceDirection } from '@/lib/process/types'
import { INTEGRATION_TECHS, INTERFACE_FREQUENCIES } from '@/lib/process/types'

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

  const sysName = (id: string | null) => (id ? systems.find(s => s.id === id)?.name || '(system)' : '—')

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
    <div className="px-4 py-3 border-t border-[var(--m12-border)]/40">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold">
          Interfaces {items.length > 0 && `(${items.length})`}
        </span>
        {!readOnly && !adding && (
          <button onClick={() => setAdding(true)} className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[#0EA5E9] hover:text-[#38BDF8]">+ Add</button>
        )}
      </div>

      {loading ? (
        <div className="text-[11px] text-[var(--m12-text-muted)]">Loading…</div>
      ) : items.length === 0 && !adding ? (
        <span className="text-[11px] text-[var(--m12-text-muted)]">No interfaces documented.</span>
      ) : (
        <div className="space-y-1 mb-2">
          {items.map(it => (
            <div key={it.id} className="group flex items-center gap-2 text-[11px] bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded px-2 py-1">
              <span className="text-[var(--m12-text-secondary)]">{sysName(it.source_system_id)}</span>
              <span className="text-[#0EA5E9]">{it.direction === 'inbound' ? '←' : it.direction === 'bidirectional' ? '↔' : '→'}</span>
              <span className="text-[var(--m12-text-secondary)]">{sysName(it.target_system_id)}</span>
              <span className="flex-1 text-[10px] text-[var(--m12-text-muted)] truncate">
                {[it.integration_tech, it.frequency, it.interface_ref].filter(Boolean).join(' · ')}
              </span>
              {!readOnly && <button onClick={() => handleDelete(it.id)} aria-label="Delete" className="opacity-50 group-hover:opacity-100 text-[var(--m12-border)] hover:text-red-400">×</button>}
            </div>
          ))}
        </div>
      )}

      {adding && !readOnly && (
        <div className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg p-2.5 space-y-2">
          <div className="flex gap-2">
            <select value={sourceId} onChange={e => setSourceId(e.target.value)} aria-label="Source system" className="flex-1 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] focus:outline-none">
              <option value="">Source…</option>
              {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={direction} onChange={e => setDirection(e.target.value as InterfaceDirection)} aria-label="Direction" className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] focus:outline-none">
              <option value="outbound">→</option><option value="inbound">←</option><option value="bidirectional">↔</option>
            </select>
            <select value={targetId} onChange={e => setTargetId(e.target.value)} aria-label="Target system" className="flex-1 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] focus:outline-none">
              <option value="">Target…</option>
              {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <select value={tech} onChange={e => setTech(e.target.value)} aria-label="Integration tech" className="flex-1 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] focus:outline-none">
              <option value="">Tech…</option>
              {INTEGRATION_TECHS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={frequency} onChange={e => setFrequency(e.target.value)} aria-label="Frequency" className="flex-1 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] focus:outline-none">
              <option value="">Frequency…</option>
              {INTERFACE_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input value={ref} onChange={e => setRef(e.target.value)} aria-label="Interface ref" placeholder="Ref" className="w-20 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] font-[family-name:var(--font-space-mono)] focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={busy || (!sourceId && !targetId)} className="flex-1 bg-[#0EA5E9] hover:bg-[#38BDF8] disabled:opacity-50 text-white text-[11px] font-medium rounded py-1.5 transition-colors">{busy ? 'Adding…' : 'Add'}</button>
            <button onClick={() => setAdding(false)} className="px-3 text-[11px] text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
