'use client'

// Deterministic multi-capability assignment for an L3 process leaf. Distinct from
// the single SIPOC link (which drives the S/I/P/O/C context): this is an explicit,
// many-to-many set of capabilities the user assigns to the process flow. The set
// is what the workstream's data-architecture generator groups the diagram by.
// Stored as process_node_links rows with link_kind='sipoc_capability'.

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
    <div className="px-4 py-3 border-t border-[var(--m12-border)]/40">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 rounded px-2 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9]" />
          <span className="text-[9px] font-[family-name:var(--font-space-mono)] text-[#0EA5E9] uppercase tracking-wider font-bold">Capabilities</span>
        </span>
        <span className="text-[11px] text-[var(--m12-text-muted)]">{links.length} assigned</span>
        {!readOnly && (
          <button
            onClick={() => setPickerOpen(true)}
            className="ml-auto text-[10px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[#0EA5E9] hover:text-[#38BDF8]"
          >
            + Assign
          </button>
        )}
      </div>

      {links.length === 0 ? (
        <div className="text-[11px] text-[var(--m12-text-muted)]">
          No capabilities assigned. These drive the capability groupings in the workstream data-architecture diagram.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {links.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1.5 text-[10px] text-[var(--m12-text-secondary)] bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded px-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] shrink-0" />
              <span className="truncate max-w-[180px]">{l.label || '(capability)'}</span>
              {!readOnly && (
                <button
                  onClick={() => unassign(l)}
                  disabled={busyId === l.target_id}
                  title="Remove"
                  className="text-[var(--m12-border)] hover:text-red-400 disabled:opacity-40"
                >
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[32rem] max-w-[92vw] max-h-[80vh] flex flex-col bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--m12-border)]/40">
          <h3 className="text-sm font-semibold text-[var(--m12-text)]">Assign L3 capabilities</h3>
          <button type="button" onClick={onClose} title="Close" aria-label="Close" className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <label className="block text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold mb-1.5">Capability map</label>
          <select
            value={selectedMap || ''}
            onChange={(e) => setSelectedMap(e.target.value || null)}
            aria-label="Capability map"
            className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-md px-2.5 py-1.5 text-xs text-[var(--m12-text)] focus:outline-none focus:border-[#0EA5E9]/60 mb-4"
          >
            <option value="">{loading ? 'Loading…' : '— select a map —'}</option>
            {maps.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>

          {selectedMap && (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold">L3 functionalities</label>
                <button onClick={() => onOpenMap(selectedMap)} className="text-[9px] uppercase tracking-wider text-[#0EA5E9] hover:text-[#38BDF8]">Open map ↗</button>
              </div>
              {loadingCaps ? (
                <div className="text-xs text-[var(--m12-text-muted)] py-3">Loading…</div>
              ) : caps.length === 0 ? (
                <div className="text-xs text-[var(--m12-text-muted)] py-3">No L3 capabilities in this map.</div>
              ) : (
                <div className="space-y-1">
                  {caps.map((c) => {
                    const added = assignedIds.has(c.id)
                    return (
                      <button
                        key={c.id}
                        onClick={() => { if (!added) onAdd(c, selectedMap) }}
                        disabled={added || busyId === c.id}
                        className="w-full text-left px-3 py-2 rounded-md border transition-colors flex items-center gap-2 disabled:cursor-default"
                        style={{ borderColor: added ? '#0EA5E933' : 'var(--m12-border)' }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-[var(--m12-text)]">{c.name}</div>
                          {c.description && <div className="text-[10px] text-[var(--m12-text-muted)] truncate">{c.description}</div>}
                        </div>
                        <span className={`text-[10px] font-medium shrink-0 ${added ? 'text-[#10B981]' : 'text-[#0EA5E9]'}`}>
                          {busyId === c.id ? '…' : added ? '✓ Added' : '+ Add'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-[var(--m12-border)]/40 flex justify-end">
          <button onClick={onClose} className="text-[11px] px-3 py-1.5 rounded-lg bg-[#0EA5E9] hover:bg-[#38BDF8] text-white font-medium">Done</button>
        </div>
      </div>
    </div>
  )
}
