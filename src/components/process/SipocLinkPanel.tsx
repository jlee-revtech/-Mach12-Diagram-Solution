'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Link2, X } from 'lucide-react'
import { Button } from '@/components/common'
import { useProcessStore } from '@/lib/process/store'
import {
  listCapabilityMaps, listCapabilities, getCapability,
  listCapabilityInputs, listCapabilityOutputs,
} from '@/lib/supabase/capability-maps'
import type { CapabilityMapRow, Capability, CapabilityInput, CapabilityOutput } from '@/lib/sipoc/types'

// Bidirectional leaf <-> SIPOC L3 link. The process supplies the activity flow;
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
      <div className="px-4 py-3 border-t border-border">
        {readOnly ? (
          <span className="text-[11px] text-text-tertiary">No linked SIPOC capability.</span>
        ) : (
          <Button variant="secondary" size="sm" icon={<Link2 size={12} />} onClick={() => setPickerOpen(true)}>
            Link SIPOC capability
          </Button>
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
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-purple-50 text-purple-700">
          SIPOC L3
        </span>
        <span className="text-body-sm font-semibold text-text-primary truncate">{cap?.name || (loadingCtx ? 'Loading...' : '(capability)')}</span>
        <div className="ml-auto flex items-center gap-1">
          {cap && (
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={<ExternalLink size={12} />}
              onClick={() => router.push(`/capability-map/${cap.capability_map_id}`)}
            >
              Open
            </Button>
          )}
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<X size={14} />}
              aria-label="Unlink"
              title="Unlink"
              onClick={handleUnlink}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SioChips title="Suppliers" toneClass="text-indigo-600" items={suppliers} />
        <SioChips title="Inputs" toneClass="text-status-yellow" items={inputs.map(i => ipName(i.information_product_id))} />
        <SioChips title="Outputs" toneClass="text-status-green" items={outputs.map(o => ipName(o.information_product_id))} />
        <SioChips title="Customers" toneClass="text-pink-600" items={customers} />
      </div>
      {(sourceSystems.length > 0 || destSystems.length > 0) && (
        <div className="mt-2 text-[10px] text-text-tertiary">
          <span className="uppercase tracking-wider font-medium">Systems: </span>
          {[...sourceSystems, ...destSystems].join(' · ')}
        </div>
      )}
    </div>
  )
}

function SioChips({ title, toneClass, items }: { title: string; toneClass: string; items: string[] }) {
  const unique = Array.from(new Set(items.filter(Boolean)))
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${toneClass}`}>
        {title} ({unique.length})
      </div>
      <div className="flex flex-wrap gap-1">
        {unique.length === 0 ? (
          <span className="text-[10px] text-text-tertiary">None</span>
        ) : unique.slice(0, 8).map((it, i) => (
          <span key={i} className="text-[10px] text-text-secondary bg-surface-muted border border-border rounded px-1.5 py-0.5 truncate max-w-[140px]">{it}</span>
        ))}
        {unique.length > 8 && <span className="text-[10px] text-text-tertiary">+{unique.length - 8}</span>}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-[30rem] max-w-[92vw] max-h-[80vh] flex flex-col bg-white border border-border rounded-xl shadow-card-hover overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="text-heading-sm font-display text-text-primary">Link a SIPOC L3 capability</h3>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={16} />} aria-label="Close" onClick={onClose} />
        </div>
        <div className="p-4 overflow-y-auto">
          <label className="block text-label uppercase text-text-secondary mb-1.5">SIPOC Map</label>
          <select
            value={selectedMap || ''}
            onChange={e => setSelectedMap(e.target.value || null)}
            aria-label="SIPOC map"
            className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none mb-4"
          >
            <option value="">{loading ? 'Loading...' : 'Select a map...'}</option>
            {maps.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>

          {selectedMap && (
            <>
              <label className="block text-label uppercase text-text-secondary mb-1.5">L3 Functionality</label>
              {loadingCaps ? (
                <div className="text-body-sm text-text-tertiary py-3">Loading...</div>
              ) : caps.length === 0 ? (
                <div className="text-body-sm text-text-tertiary py-3">No L3 capabilities in this map.</div>
              ) : (
                <div className="space-y-1">
                  {caps.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onPick(c.id)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-brand-500/60 hover:bg-brand-50/50 transition-colors"
                    >
                      <div className="text-body-sm text-text-primary">{c.name}</div>
                      {c.description && <div className="text-[11px] text-text-tertiary truncate">{c.description}</div>}
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
