'use client'

// Deterministic multi-capability assignment for an L3 process leaf. Distinct from
// the single SIPOC link (which drives the S/I/P/O/C context): this is an explicit,
// many-to-many set of capabilities the user assigns to the process flow. The set
// is what the workstream's data-architecture generator groups the diagram by.
// Stored as process_node_links rows with link_kind='sipoc_capability'.

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, Plus, X } from 'lucide-react'
import { Button } from '@/components/common'
import {
  listProcessNodeLinks, createProcessNodeLink, deleteProcessNodeLink, type ProcessNodeLink,
} from '@/lib/supabase/process-models'
import { listCapabilityMaps, listCapabilities } from '@/lib/supabase/capability-maps'
import type { CapabilityMapRow, Capability } from '@/lib/sipoc/types'

export const LINK_KIND_SIPOC_CAP = 'sipoc_capability'

export default function CapabilityAssignPanel({
  nodeId, orgId, userId, readOnly,
}: {
  nodeId: string
  orgId: string
  userId?: string
  readOnly: boolean
}) {
  const router = useRouter()
  const [links, setLinks] = useState<ProcessNodeLink[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const all = await listProcessNodeLinks(nodeId)
    setLinks(all.filter((l) => l.link_kind === LINK_KIND_SIPOC_CAP))
  }, [nodeId])

  useEffect(() => { load() }, [load])

  const assignedIds = new Set(links.map((l) => l.target_id))

  const assign = useCallback(async (cap: Capability) => {
    if (assignedIds.has(cap.id) || !userId) return
    setBusyId(cap.id)
    try {
      const link = await createProcessNodeLink(nodeId, LINK_KIND_SIPOC_CAP, cap.id, userId, cap.name)
      setLinks((ls) => [{ ...link }, ...ls])
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to assign capability')
    } finally { setBusyId(null) }
  }, [nodeId, userId, assignedIds])

  const unassign = useCallback(async (link: ProcessNodeLink) => {
    setBusyId(link.target_id)
    try {
      await deleteProcessNodeLink(link.id)
      setLinks((ls) => ls.filter((l) => l.id !== link.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to remove capability')
    } finally { setBusyId(null) }
  }, [])

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-status-blue-bg text-status-blue">
          Capabilities
        </span>
        <span className="text-[11px] text-text-tertiary">{links.length} assigned</span>
        {!readOnly && (
          <Button variant="ghost" size="sm" icon={<Plus size={12} />} className="ml-auto" onClick={() => setPickerOpen(true)}>
            Assign
          </Button>
        )}
      </div>

      {links.length === 0 ? (
        <div className="text-[11px] text-text-tertiary">
          No capabilities assigned. These drive the capability groupings in the workstream data-architecture diagram.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {links.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1.5 text-[10px] text-text-secondary bg-surface-muted border border-border rounded px-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
              <span className="truncate max-w-[180px]">{l.label || '(capability)'}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => unassign(l)}
                  disabled={busyId === l.target_id}
                  title="Remove"
                  aria-label="Remove capability"
                  className="text-text-tertiary hover:text-status-red disabled:opacity-40"
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {pickerOpen && (
        <CapabilityMultiPicker
          orgId={orgId}
          assignedIds={assignedIds}
          busyId={busyId}
          onAdd={assign}
          onOpenMap={(mapId) => router.push(`/capability-map/${mapId}`)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

// Lightweight in-memory map of capabilityId -> capabilityMapId, populated as the
// user assigns from the picker (so a future deep-link could resolve the map).
const capMapIndex = new Map<string, string>()

function CapabilityMultiPicker({
  orgId, assignedIds, busyId, onAdd, onOpenMap, onClose,
}: {
  orgId: string
  assignedIds: Set<string>
  busyId: string | null
  onAdd: (cap: Capability, mapId: string) => void
  onOpenMap: (mapId: string) => void
  onClose: () => void
}) {
  const [maps, setMaps] = useState<CapabilityMapRow[]>([])
  const [selectedMap, setSelectedMap] = useState<string | null>(null)
  const [caps, setCaps] = useState<Capability[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCaps, setLoadingCaps] = useState(false)

  useEffect(() => {
    listCapabilityMaps(orgId).then((m) => { setMaps(m); setLoading(false); if (m.length === 1) setSelectedMap(m[0].id) })
  }, [orgId])

  useEffect(() => {
    if (!selectedMap) { setCaps([]); return }
    setLoadingCaps(true)
    listCapabilities(selectedMap).then((c) => { setCaps(c.filter((x) => x.level === 3)); setLoadingCaps(false) })
  }, [selectedMap])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[32rem] max-w-[92vw] max-h-[80vh] flex flex-col bg-white border border-border rounded-xl shadow-card-hover overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="text-heading-sm font-display text-text-primary">Assign L3 capabilities</h3>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={16} />} title="Close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="p-4 overflow-y-auto">
          <label className="block text-label uppercase text-text-secondary mb-1.5">Capability map</label>
          <select
            value={selectedMap || ''}
            onChange={(e) => setSelectedMap(e.target.value || null)}
            aria-label="Capability map"
            className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none mb-4"
          >
            <option value="">{loading ? 'Loading...' : 'Select a map...'}</option>
            {maps.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>

          {selectedMap && (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-label uppercase text-text-secondary">L3 functionalities</label>
                <Button variant="ghost" size="sm" trailingIcon={<ExternalLink size={12} />} onClick={() => onOpenMap(selectedMap)}>
                  Open map
                </Button>
              </div>
              {loadingCaps ? (
                <div className="text-body-sm text-text-tertiary py-3">Loading...</div>
              ) : caps.length === 0 ? (
                <div className="text-body-sm text-text-tertiary py-3">No L3 capabilities in this map.</div>
              ) : (
                <div className="space-y-1">
                  {caps.map((c) => {
                    const added = assignedIds.has(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { if (!added) onAdd(c, selectedMap) }}
                        disabled={added || busyId === c.id}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 disabled:cursor-default ${added ? 'border-status-green/30 bg-status-green-bg/50' : 'border-border hover:border-brand-500/60 hover:bg-brand-50/50'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-body-sm text-text-primary">{c.name}</div>
                          {c.description && <div className="text-[11px] text-text-tertiary truncate">{c.description}</div>}
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium shrink-0 ${added ? 'text-status-green' : 'text-brand-600'}`}>
                          {busyId === c.id ? '...' : added ? (<><Check size={10} /> Added</>) : (<><Plus size={10} /> Add</>)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}
