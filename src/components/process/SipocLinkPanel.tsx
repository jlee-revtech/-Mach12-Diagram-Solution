'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useProcessStore } from '@/lib/process/store'
import {
  listCapabilityMaps, listCapabilities, getCapability,
  listCapabilityInputs, listCapabilityOutputs,
} from '@/lib/supabase/capability-maps'
import type { CapabilityMapRow, Capability, CapabilityInput, CapabilityOutput } from '@/lib/sipoc/types'

// Bidirectional leaf ↔ SIPOC L3 link. The process supplies the activity flow;
// the linked SIPOC L3 supplies Suppliers / Inputs / Outputs / Customers, shown
// here as read-only context beside the BPMN editor.
export default function SipocLinkPanel({ nodeId, orgId, readOnly }: { nodeId: string; orgId: string; readOnly: boolean }) {
  const router = useRouter()
  const node = useProcessStore(s => s.nodes.find(n => n.id === nodeId))
  const updateNode = useProcessStore(s => s.updateNode)
  const informationProducts = useProcessStore(s => s.informationProducts)
  const personas = useProcessStore(s => s.personas)
  const logicalSystems = useProcessStore(s => s.logicalSystems)

  const linkedId = node?.sipoc_capability_id || null
  const [pickerOpen, setPickerOpen] = useState(false)

  // Linked capability context
  const [cap, setCap] = useState<Capability | null>(null)
  const [inputs, setInputs] = useState<CapabilityInput[]>([])
  const [outputs, setOutputs] = useState<CapabilityOutput[]>([])
  const [loadingCtx, setLoadingCtx] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!linkedId) { setCap(null); setInputs([]); setOutputs([]); return }
    setLoadingCtx(true)
    Promise.all([getCapability(linkedId), listCapabilityInputs(linkedId), listCapabilityOutputs(linkedId)])
      .then(([c, ins, outs]) => {
        if (cancelled) return
        setCap(c); setInputs(ins.filter(i => !i.archived_at)); setOutputs(outs.filter(o => !o.archived_at))
      })
      .finally(() => { if (!cancelled) setLoadingCtx(false) })
    return () => { cancelled = true }
  }, [linkedId])

  const ipName = useCallback((id: string) => informationProducts.find(p => p.id === id)?.name || '(product)', [informationProducts])
  const personaName = useCallback((id: string) => personas.find(p => p.id === id)?.name || null, [personas])
  const sysName = useCallback((id: string) => logicalSystems.find(s => s.id === id)?.name || null, [logicalSystems])

  const resolveMany = (ids: string[] | undefined, fn: (id: string) => string | null) =>
    Array.from(new Set((ids || []).map(fn).filter((x): x is string => !!x)))

  const suppliers = resolveMany(inputs.flatMap(i => i.supplier_persona_ids), personaName)
  const sourceSystems = resolveMany(inputs.flatMap(i => [...(i.source_system_ids || []), ...(i.feeding_system_id ? [i.feeding_system_id] : [])]), sysName)
  const customers = resolveMany(outputs.flatMap(o => o.consumer_persona_ids), personaName)
  const destSystems = resolveMany(outputs.flatMap(o => o.destination_system_ids || []), sysName)

  const handleUnlink = async () => {
    if (!confirm('Unlink this SIPOC capability?')) return
    await updateNode(nodeId, { sipoc_capability_id: null })
  }

  if (!linkedId) {
    return (
      <div className="px-4 py-3 border-t border-[var(--m12-border)]/40">
        {readOnly ? (
          <span className="text-[11px] text-[var(--m12-text-muted)]">No linked SIPOC capability.</span>
        ) : (
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 text-[11px] text-[#8B5CF6] border border-[#8B5CF6]/40 hover:border-[#8B5CF6]/70 hover:bg-[#8B5CF6]/5 rounded-md px-2.5 py-1.5 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M5.5 8.5a2 2 0 002.8 0l2-2a2 2 0 00-2.8-2.8l-.6.6M8.5 5.5a2 2 0 00-2.8 0l-2 2a2 2 0 002.8 2.8l.6-.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Link SIPOC capability
          </button>
        )}
        {pickerOpen && (
          <SipocPicker
            orgId={orgId}
            onPick={async (capId) => { await updateNode(nodeId, { sipoc_capability_id: capId }); setPickerOpen(false) }}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="px-4 py-3 border-t border-[var(--m12-border)]/40">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded px-2 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
          <span className="text-[9px] font-[family-name:var(--font-space-mono)] text-[#8B5CF6] uppercase tracking-wider font-bold">SIPOC L3</span>
        </span>
        <span className="text-xs font-semibold text-[var(--m12-text)] truncate">{cap?.name || (loadingCtx ? 'Loading…' : '(capability)')}</span>
        <div className="ml-auto flex items-center gap-2">
          {cap && (
            <button
              onClick={() => router.push(`/capability-map/${cap.capability_map_id}`)}
              className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[#8B5CF6] hover:text-[#A78BFA]"
            >
              Open ↗
            </button>
          )}
          {!readOnly && (
            <button onClick={handleUnlink} title="Unlink" className="text-[var(--m12-border)] hover:text-red-400">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SioChips title="Suppliers" color="#6366F1" items={suppliers} />
        <SioChips title="Inputs" color="#F59E0B" items={inputs.map(i => ipName(i.information_product_id))} />
        <SioChips title="Outputs" color="#10B981" items={outputs.map(o => ipName(o.information_product_id))} />
        <SioChips title="Customers" color="#EC4899" items={customers} />
      </div>
      {(sourceSystems.length > 0 || destSystems.length > 0) && (
        <div className="mt-2 text-[10px] text-[var(--m12-text-muted)]">
          <span className="font-[family-name:var(--font-space-mono)] uppercase tracking-wider">Systems: </span>
          {[...sourceSystems, ...destSystems].join(' · ')}
        </div>
      )}
    </div>
  )
}

function SioChips({ title, color, items }: { title: string; color: string; items: string[] }) {
  const unique = Array.from(new Set(items.filter(Boolean)))
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest font-[family-name:var(--font-space-mono)] font-bold mb-1" style={{ color }}>
        {title} ({unique.length})
      </div>
      <div className="flex flex-wrap gap-1">
        {unique.length === 0 ? (
          <span className="text-[10px] text-[var(--m12-text-muted)]">—</span>
        ) : unique.slice(0, 8).map((it, i) => (
          <span key={i} className="text-[10px] text-[var(--m12-text-secondary)] bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded px-1.5 py-0.5 truncate max-w-[140px]">{it}</span>
        ))}
        {unique.length > 8 && <span className="text-[10px] text-[var(--m12-text-muted)]">+{unique.length - 8}</span>}
      </div>
    </div>
  )
}

function SipocPicker({ orgId, onPick, onClose }: { orgId: string; onPick: (capId: string) => void; onClose: () => void }) {
  const [maps, setMaps] = useState<CapabilityMapRow[]>([])
  const [selectedMap, setSelectedMap] = useState<string | null>(null)
  const [caps, setCaps] = useState<Capability[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCaps, setLoadingCaps] = useState(false)

  useEffect(() => {
    listCapabilityMaps(orgId).then(m => { setMaps(m); setLoading(false) })
  }, [orgId])

  useEffect(() => {
    if (!selectedMap) { setCaps([]); return }
    setLoadingCaps(true)
    listCapabilities(selectedMap).then(c => { setCaps(c.filter(x => x.level === 3)); setLoadingCaps(false) })
  }, [selectedMap])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-[30rem] max-w-[92vw] max-h-[80vh] flex flex-col bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--m12-border)]/40">
          <h3 className="text-sm font-semibold text-[var(--m12-text)]">Link a SIPOC L3 capability</h3>
          <button onClick={onClose} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <label className="block text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold mb-1.5">SIPOC Map</label>
          <select
            value={selectedMap || ''}
            onChange={e => setSelectedMap(e.target.value || null)}
            aria-label="SIPOC map"
            className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-md px-2.5 py-1.5 text-xs text-[var(--m12-text)] focus:outline-none focus:border-[#8B5CF6]/60 mb-4"
          >
            <option value="">{loading ? 'Loading…' : '— select a map —'}</option>
            {maps.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>

          {selectedMap && (
            <>
              <label className="block text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold mb-1.5">L3 Functionality</label>
              {loadingCaps ? (
                <div className="text-xs text-[var(--m12-text-muted)] py-3">Loading…</div>
              ) : caps.length === 0 ? (
                <div className="text-xs text-[var(--m12-text-muted)] py-3">No L3 capabilities in this map.</div>
              ) : (
                <div className="space-y-1">
                  {caps.map(c => (
                    <button
                      key={c.id}
                      onClick={() => onPick(c.id)}
                      className="w-full text-left px-3 py-2 rounded-md border border-[var(--m12-border)]/40 hover:border-[#8B5CF6]/60 hover:bg-[#8B5CF6]/5 transition-colors"
                    >
                      <div className="text-xs text-[var(--m12-text)]">{c.name}</div>
                      {c.description && <div className="text-[10px] text-[var(--m12-text-muted)] truncate">{c.description}</div>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
