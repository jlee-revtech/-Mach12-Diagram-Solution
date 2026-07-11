'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  listCapabilityMap, createCapability, updateCapability, deleteCapability,
  archiveCapability, restoreCapability,
  addCapabilityLogicalSystem, removeCapabilityLogicalSystem,
  addCapabilityPhysicalSystem, removeCapabilityPhysicalSystem, bulkCreateCapabilities,
} from '@/lib/supabase/capmap'
import { listBedrockCatalog, seedBedrockSystems } from '@/lib/supabase/bedrock-systems'
import { listWorkstreams, seedStandardWorkstreams } from '@/lib/supabase/workstreams'
import { STANDARD_WORKSTREAMS } from '@/lib/workstream/catalog'
import { flattenStandardCapabilities } from '@/lib/capmap/standardCapabilities'
import { downloadCapabilityMapXlsx } from '@/lib/export/capabilityWorkspaceXlsx'
import { createCmCapabilityShare, listCmCapabilityShares, deleteCmCapabilityShare, type CmCapabilityShare } from '@/lib/supabase/capmap-shares'
import CapabilityAIReviewPanel from '@/components/capmap/CapabilityAIReviewPanel'
import WorkstreamPicker from '@/components/workstream/WorkstreamPicker'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'
import { Button, EmptyState, LoadingState } from '@/components/common'
import {
  Plus, Download, Share2, Sparkles, Wand2, SearchCheck, Lightbulb, LayoutGrid,
  Archive, ArchiveRestore, Trash2, X, ChevronRight, Check,
} from 'lucide-react'
import type { CapabilityWithSystems } from '@/lib/capmap/types'
import type { BedrockSystemWithPhysicals } from '@/lib/bedrock/types'
import type { Workstream } from '@/lib/workstream/types'

const UNALIGNED = '__unaligned__'

interface DraftCap { name: string; workstreamCode: string; domain: string; description: string; systems: string[]; physicalSystemIds: string[]; physicalLabels: string[]; selected: boolean }

export default function CapabilityMapWorkspace({ orgId, userId }: { orgId: string; userId: string }) {
  const [catalog, setCatalog] = useState<BedrockSystemWithPhysicals[]>([])
  const [caps, setCaps] = useState<CapabilityWithSystems[]>([])
  const [archivedCaps, setArchivedCaps] = useState<CapabilityWithSystems[]>([])
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [seedingStd, setSeedingStd] = useState(false)
  const [aligning, setAligning] = useState(false)
  const [view, setView] = useState<'board' | 'pivot'>('board')
  const [slice, setSlice] = useState<'workstream' | 'logical' | 'physical'>('workstream')
  const [search, setSearch] = useState('')
  const [wsFilter, setWsFilter] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // AI draft modal
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiFocusWs, setAiFocusWs] = useState('')   // workstream id, '' = all
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiResults, setAiResults] = useState<DraftCap[] | null>(null)

  // AI review/apply panel (Consistency Checker + Suggest Updates)
  const [aiReview, setAiReview] = useState<'consistency' | 'suggest' | null>(null)
  // Track whether any finding was applied while the panel is open, so we refresh
  // the board ONCE on close instead of reloading (and reflowing) it per-apply.
  const reviewDirtyRef = useRef(false)

  // Read-only share links
  const [shareOpen, setShareOpen] = useState(false)
  const [shares, setShares] = useState<CmCapabilityShare[]>([])
  const [shareBusy, setShareBusy] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const shareRef = useRef<HTMLDivElement>(null)

  // silent: refetch without tripping the full-screen loading gate (which would
  // unmount any open panel/modal and remount it — e.g. re-running the AI review).
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    const [c, m, w] = await Promise.all([listBedrockCatalog(orgId), listCapabilityMap(orgId, true), listWorkstreams(orgId)])
    setCatalog(c)
    setCaps(m.filter(x => !x.archived_at))
    setArchivedCaps(m.filter(x => x.archived_at))
    setWorkstreams(w)
    if (!opts?.silent) setLoading(false)
  }, [orgId])
  useEffect(() => { load() }, [load])

  // Ensure the standard value streams exist (seed if the org has none yet).
  const ensureWorkstreams = useCallback(async (): Promise<Workstream[]> => {
    if (workstreams.length) return workstreams
    const w = await seedStandardWorkstreams(orgId, userId)
    setWorkstreams(w)
    return w
  }, [workstreams, orgId, userId])

  // ─── Lookups ───
  const catById = useMemo(() => new Map(catalog.map(c => [c.id, c])), [catalog])
  const catByType = useMemo(() => new Map<string, BedrockSystemWithPhysicals>(catalog.map(c => [c.system_type, c])), [catalog])
  const physById = useMemo(() => {
    const m = new Map<string, { name: string; parentId: string }>()
    for (const c of catalog) for (const p of c.physicals) m.set(p.id, { name: p.name, parentId: c.id })
    return m
  }, [catalog])
  const wsById = useMemo(() => new Map(workstreams.map(w => [w.id, w])), [workstreams])
  const wsByCode = useMemo(() => new Map(workstreams.map(w => [w.code, w])), [workstreams])

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

  // Board groups ordered by workstream sort order, Unaligned last.
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

  // Pivot columns by the chosen slice dimension (value stream / logical / physical).
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

  const unalignedCount = useMemo(() => caps.filter(c => !c.workstream_id || !wsById.has(c.workstream_id)).length, [caps, wsById])
  const selected = caps.find(c => c.id === selectedId) || null

  // ─── Optimistic mutators ───
  const patchCap = (id: string, fn: (c: CapabilityWithSystems) => CapabilityWithSystems) =>
    setCaps(x => x.map(c => c.id === id ? fn(c) : c))

  const handleAddCapability = async () => {
    try {
      const ws = wsFilter && wsFilter !== UNALIGNED ? wsFilter : undefined
      const cap = await createCapability(orgId, userId, { name: 'New capability', workstream_id: ws, sort_order: caps.length })
      setCaps(x => [...x, { ...cap, logicalSystemIds: [], physicalSystemIds: [] }])
      setSelectedId(cap.id)
    } catch { load() }
  }

  const handleUpdateCap = async (id: string, updates: { name?: string; domain?: string; description?: string }) => {
    patchCap(id, c => ({ ...c, ...updates }))
    await updateCapability(id, updates).catch(() => load())
  }

  const handleSetWorkstream = async (id: string, wsId: string | null) => {
    patchCap(id, c => ({ ...c, workstream_id: wsId }))
    await updateCapability(id, { workstream_id: wsId }).catch(() => load())
  }

  const handleDeleteCap = async (id: string) => {
    if (!confirm('Permanently delete this capability and its system mappings? This cannot be undone.')) return
    setCaps(x => x.filter(c => c.id !== id))
    setArchivedCaps(x => x.filter(c => c.id !== id))
    if (selectedId === id) setSelectedId(null)
    await deleteCapability(id).catch(() => load())
  }

  const handleArchiveCap = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const cap = caps.find(c => c.id === id)
    setCaps(x => x.filter(c => c.id !== id))
    if (cap) setArchivedCaps(x => [{ ...cap, archived_at: new Date().toISOString() }, ...x])
    if (selectedId === id) setSelectedId(null)
    await archiveCapability(id).catch(() => load())
  }

  const handleRestoreCap = async (id: string) => {
    const cap = archivedCaps.find(c => c.id === id)
    setArchivedCaps(x => x.filter(c => c.id !== id))
    if (cap) setCaps(x => [...x, { ...cap, archived_at: null }])
    await restoreCapability(id).catch(() => load())
  }

  const toggleLogical = async (capId: string, sysId: string) => {
    const cap = caps.find(c => c.id === capId)
    if (!cap) return
    const has = cap.logicalSystemIds.includes(sysId)
    if (has) {
      const childPhys = cap.physicalSystemIds.filter(pid => physById.get(pid)?.parentId === sysId)
      patchCap(capId, c => ({ ...c, logicalSystemIds: c.logicalSystemIds.filter(s => s !== sysId), physicalSystemIds: c.physicalSystemIds.filter(p => !childPhys.includes(p)) }))
      await removeCapabilityLogicalSystem(capId, sysId).catch(() => load())
      for (const pid of childPhys) await removeCapabilityPhysicalSystem(capId, pid).catch(() => {})
    } else {
      patchCap(capId, c => ({ ...c, logicalSystemIds: [...c.logicalSystemIds, sysId] }))
      await addCapabilityLogicalSystem(orgId, userId, capId, sysId).catch(() => load())
    }
  }

  const togglePhysical = async (capId: string, physId: string, parentId: string) => {
    const cap = caps.find(c => c.id === capId)
    if (!cap) return
    const has = cap.physicalSystemIds.includes(physId)
    if (has) {
      patchCap(capId, c => ({ ...c, physicalSystemIds: c.physicalSystemIds.filter(p => p !== physId) }))
      await removeCapabilityPhysicalSystem(capId, physId).catch(() => load())
    } else {
      const needLogical = !cap.logicalSystemIds.includes(parentId)
      patchCap(capId, c => ({ ...c, physicalSystemIds: [...c.physicalSystemIds, physId], logicalSystemIds: needLogical ? [...c.logicalSystemIds, parentId] : c.logicalSystemIds }))
      if (needLogical) await addCapabilityLogicalSystem(orgId, userId, capId, parentId).catch(() => load())
      await addCapabilityPhysicalSystem(orgId, userId, capId, physId).catch(() => load())
    }
  }

  // ─── Align existing capabilities to value streams ───
  const handleAlign = async () => {
    if (aligning) return
    const ws = await ensureWorkstreams()
    if (ws.length === 0) { alert('No value streams are defined yet.'); return }
    let targets = caps.filter(c => !c.workstream_id || !wsById.has(c.workstream_id))
    if (targets.length === 0) {
      if (!confirm('All capabilities are already aligned. Re-align every capability to its best-fit value stream?')) return
      targets = caps
    }
    setAligning(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'capability-map-align',
          context: {
            capabilities: targets.map(c => ({ name: c.name, domain: c.domain, description: c.description })),
            workstreams: ws.map(w => ({ code: w.code, name: w.name, description: w.description })),
          },
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Alignment failed') }
      const data = await res.json() as { assignments?: { name: string; workstream: string }[] }
      const byName = new Map(targets.map(c => [c.name.toLowerCase(), c]))
      const codeToId = new Map(ws.map(w => [w.code, w.id]))
      for (const a of data.assignments || []) {
        const cap = byName.get((a.name || '').toLowerCase())
        const wsId = codeToId.get(a.workstream)
        if (cap && wsId) {
          patchCap(cap.id, c => ({ ...c, workstream_id: wsId }))
          await updateCapability(cap.id, { workstream_id: wsId }).catch(() => {})
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Alignment failed')
    } finally {
      setAligning(false)
    }
  }

  // ─── Seed the standard capability map (one curated set per value stream) ───
  const handleSeedStandard = async () => {
    if (seedingStd) return
    setSeedingStd(true)
    try {
      const ws = await ensureWorkstreams()
      const codeToId = new Map(ws.map(w => [w.code, w.id]))
      // Dedup by value stream + capability group (domain) + sub-capability name, so the
      // same granular verb can appear under different groups / streams without collisions.
      const keyOf = (wsId: string | null, group: string, name: string) =>
        `${wsId ?? ''}|${group.trim().toLowerCase()}|${name.trim().toLowerCase()}`
      const existing = new Set(caps.map(c => keyOf(c.workstream_id, c.domain ?? '', c.name)))
      const items: { name: string; description?: string; domain?: string; workstream_id?: string | null; bedrockSystemIds: string[] }[] = []
      for (const def of STANDARD_WORKSTREAMS) {
        const wsId = codeToId.get(def.code) ?? null
        for (const cap of flattenStandardCapabilities(def.code)) {
          const key = keyOf(wsId, cap.group, cap.name)
          if (existing.has(key)) continue
          existing.add(key)
          // domain carries the L2 capability group; the board renders it as a sub-header.
          items.push({ name: cap.name, description: cap.description, domain: cap.group, workstream_id: wsId, bedrockSystemIds: [] })
        }
      }
      if (items.length === 0) { alert('The standard capability map is already seeded for every value stream.'); return }
      await bulkCreateCapabilities(orgId, userId, items, 'standard')
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to seed the standard capability map')
    } finally {
      setSeedingStd(false)
    }
  }

  // ─── AI draft ───
  const openAi = async () => { setAiOpen(true); setAiError(null); setAiResults(null); await ensureWorkstreams() }

  const runAiDraft = async () => {
    setAiBusy(true); setAiError(null)
    try {
      const ws = await ensureWorkstreams()
      const focus = aiFocusWs ? ws.find(w => w.id === aiFocusWs) : null
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'capability-map-draft',
          prompt: aiPrompt.trim(),
          context: {
            catalog: catalog.map(c => ({ systemType: c.system_type, label: c.label, physicals: c.physicals.map(p => p.name) })),
            existing: caps.map(c => c.name),
            workstreams: ws.map(w => ({ code: w.code, name: w.name, description: w.description })),
            focusWorkstream: focus?.name,
          },
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Draft failed') }
      type RawSystem = string | { systemType?: string; physical?: string }
      const data = await res.json() as { capabilities?: { name: string; workstream?: string; domain?: string; description?: string; systems?: RawSystem[] }[] }
      // Resolve a physical product (by name) under a logical system, falling back to its primary.
      const resolvePhysical = (systemType: string, physName?: string): { id: string; label: string } | null => {
        const sys = catByType.get(systemType)
        if (!sys?.physicals?.length) return null
        const match = physName ? sys.physicals.find(p => p.name.toLowerCase() === physName.trim().toLowerCase()) : undefined
        const p = match ?? sys.physicals.find(p => p.is_primary) ?? sys.physicals[0]
        return p ? { id: p.id, label: p.name } : null
      }
      const existing = new Set(caps.map(c => c.name.toLowerCase()))
      const drafts: DraftCap[] = (data.capabilities || [])
        .filter(d => d.name && !existing.has(d.name.toLowerCase()))
        .map(d => {
          const logical: string[] = []
          const physIds: string[] = []
          const physLabels: string[] = []
          for (const entry of d.systems || []) {
            const st = typeof entry === 'string' ? entry : entry?.systemType
            if (!st || !catByType.has(st)) continue
            if (!logical.includes(st)) logical.push(st)
            const resolved = resolvePhysical(st, typeof entry === 'string' ? undefined : entry?.physical)
            if (resolved && !physIds.includes(resolved.id)) { physIds.push(resolved.id); physLabels.push(resolved.label) }
          }
          return { name: d.name, workstreamCode: d.workstream && wsByCode.has(d.workstream) ? d.workstream : '', domain: d.domain || '', description: d.description || '', systems: logical, physicalSystemIds: physIds, physicalLabels: physLabels, selected: true }
        })
      setAiResults(drafts)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Draft failed')
    } finally {
      setAiBusy(false)
    }
  }

  const acceptAiDraft = async () => {
    if (!aiResults) return
    const chosen = aiResults.filter(d => d.selected)
    if (chosen.length === 0) { setAiOpen(false); return }
    setAiBusy(true)
    try {
      await bulkCreateCapabilities(orgId, userId, chosen.map(d => ({
        name: d.name,
        description: d.description || undefined,
        domain: d.domain || undefined,
        workstream_id: d.workstreamCode ? wsByCode.get(d.workstreamCode)?.id ?? null : null,
        bedrockSystemIds: d.systems.map(s => catByType.get(s)?.id).filter((x): x is string => !!x),
        physicalSystemIds: d.physicalSystemIds,
      })))
      setAiOpen(false); setAiResults(null); setAiPrompt(''); setAiFocusWs('')
      await load()
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to add capabilities')
    } finally {
      setAiBusy(false)
    }
  }

  // ─── Read-only share links ───
  useEffect(() => {
    if (!shareOpen) return
    const h = (e: MouseEvent) => { if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [shareOpen])

  const openShare = useCallback(async () => {
    const next = !shareOpen
    setShareOpen(next)
    if (next) setShares(await listCmCapabilityShares(orgId))
  }, [shareOpen, orgId])

  const createWeekShare = useCallback(async () => {
    setShareBusy(true)
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      await createCmCapabilityShare(orgId, userId, expiresAt)
      setShares(await listCmCapabilityShares(orgId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create share link. Has migration 039 been run?')
    } finally {
      setShareBusy(false)
    }
  }, [orgId, userId])

  const revokeShare = useCallback(async (id: string) => {
    await deleteCmCapabilityShare(id).catch(() => {})
    setShares(await listCmCapabilityShares(orgId))
  }, [orgId])

  const copyShareLink = useCallback((code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/share/capmap/${code}`)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(c => (c === code ? null : c)), 2000)
  }, [])

  const activeShares = shares.filter(s => !s.expires_at || new Date(s.expires_at) > new Date())

  // ─── Render ───
  if (loading) return <div className="py-12"><LoadingState variant="inline" label="Loading capability map…" /></div>

  if (catalog.length === 0) {
    return (
      <EmptyState
        variant="dashed"
        icon={<LayoutGrid size={28} />}
        title="Define your bedrock systems first"
        description="Capabilities are mapped to your Logical Bedrock Systems and Physical Systems. Seed the standard catalog to begin."
        action={
          <Button
            variant="primary"
            onClick={async () => { setSeeding(true); try { const c = await seedBedrockSystems(orgId, userId); setCatalog(c) } finally { setSeeding(false) } }}
            loading={seeding}
          >
            {seeding ? 'Seeding…' : 'Seed standard systems'}
          </Button>
        }
      />
    )
  }

  const wsChips = workstreams.filter(w => caps.some(c => c.workstream_id === w.id))

  return (
    <div>
      {/* Toolbar */}
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
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search capabilities…"
          aria-label="Search capabilities"
          className="flex-1 min-w-[160px] h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
        {caps.length > 0 && (
          <Button variant="ai" size="md" onClick={handleAlign} disabled={aligning} title="Use AI to align capabilities to their best-fit value stream" icon={<Wand2 size={14} />}>
            {aligning ? 'Aligning…' : `Align to value streams${unalignedCount ? ` (${unalignedCount})` : ''}`}
          </Button>
        )}
        {caps.length > 0 && (
          <Button variant="secondary" size="md" onClick={() => downloadCapabilityMapXlsx(caps, workstreams, catalog)} title="Download the capability map as an Excel workbook" icon={<Download size={14} />}>
            Download
          </Button>
        )}
        {caps.length > 0 && (
          <div ref={shareRef} className="relative">
            <Button variant="secondary" size="md" onClick={openShare} title="Create a read-only public link to this capability map" icon={<Share2 size={14} />}>
              Share
            </Button>
            {shareOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-white border border-border rounded-lg shadow-dropdown overflow-hidden animate-slide-in-up">
                <div className="px-4 py-3 border-b border-border">
                  <div className="text-body-sm font-semibold text-text-primary">Read-only share link</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">Anyone with the link can view the capability list (board + pivots). No login, no edits, no AI tools.</div>
                </div>
                <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                  {activeShares.map(s => (
                    <div key={s.id} className="bg-surface-muted rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input readOnly aria-label="Read-only share link" value={`${typeof window !== 'undefined' ? window.location.origin : ''}/share/capmap/${s.code}`} onClick={e => (e.target as HTMLInputElement).select()} className="flex-1 bg-transparent text-[10px] text-text-secondary font-mono truncate focus:outline-none" />
                        <button type="button" onClick={() => copyShareLink(s.code)} className="shrink-0 text-[10px] font-medium text-brand-600 hover:text-brand-500 transition-colors">{copiedCode === s.code ? 'Copied!' : 'Copy'}</button>
                        <button type="button" onClick={() => revokeShare(s.id)} title="Revoke this link" className="shrink-0 text-text-tertiary hover:text-red-600 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                      <div className="text-[10px] text-text-tertiary mt-1">{s.expires_at ? `Expires ${new Date(s.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'No expiry'}</div>
                    </div>
                  ))}
                  {activeShares.length === 0 && <div className="text-[11px] text-text-tertiary text-center py-2">No active links.</div>}
                  <Button variant="primary" size="sm" fullWidth onClick={createWeekShare} loading={shareBusy} icon={<Plus size={12} />}>
                    {shareBusy ? 'Generating…' : 'Generate 1-week link'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        <Button variant="secondary" size="md" onClick={handleSeedStandard} disabled={seedingStd} title="Seed a standard A&D capability map across every value stream" icon={<LayoutGrid size={14} />}>
          {seedingStd ? 'Seeding…' : 'Seed standard'}
        </Button>
        {caps.length > 0 && (
          <Button variant="ai" size="md" onClick={() => setAiReview('consistency')} title="AI review of duplicates, overlap, ownership, and level of detail across the capability map" icon={<SearchCheck size={14} />}>
            Consistency Check
          </Button>
        )}
        {caps.length > 0 && (
          <Button variant="ai" size="md" onClick={() => setAiReview('suggest')} title="Prompt the AI to suggest updates for consistency, non-overlap, and uniform level of detail" icon={<Lightbulb size={14} />}>
            Suggest Updates
          </Button>
        )}
        <Button variant="ai" size="md" onClick={openAi} icon={<Sparkles size={14} />}>
          AI Draft
        </Button>
        <Button variant="primary" size="md" onClick={handleAddCapability} icon={<Plus size={14} />}>
          Capability
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

      {caps.length === 0 ? (
        <EmptyState
          variant="dashed"
          icon={<LayoutGrid size={28} />}
          title="No capabilities yet"
          description="Seed the standard A&D capability map (one curated set per value stream), let AI draft one, or add capabilities manually."
          action={
            <div className="flex items-center justify-center gap-2">
              <Button variant="primary" onClick={handleSeedStandard} loading={seedingStd}>{seedingStd ? 'Seeding…' : 'Seed standard map'}</Button>
              <Button variant="ai" onClick={openAi} icon={<Sparkles size={14} />}>AI Draft</Button>
              <Button variant="secondary" onClick={handleAddCapability}>Add manually</Button>
            </div>
          }
        />
      ) : view === 'board' ? (
        /* ─── Board (grouped by value stream) ─── */
        <div className="space-y-6">
          {groups.map(({ key, ws, list }) => {
            // Sub-group by capability group (domain = the L2 tier), preserving sort order.
            const subMap = new Map<string, CapabilityWithSystems[]>()
            for (const c of list) {
              const g = c.domain && c.domain.trim() ? c.domain.trim() : 'Other capabilities'
              if (!subMap.has(g)) subMap.set(g, [])
              subMap.get(g)!.push(c)
            }
            const subGroups = Array.from(subMap.entries())
            // Only show sub-headers when there is a real group structure (not a single "Other" bucket).
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
                          <div
                            key={c.id}
                            onClick={() => setSelectedId(c.id)}
                            className={`group text-left bg-white border rounded-lg p-4 shadow-card transition-all cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 ${selectedId === c.id ? 'border-brand-500' : 'border-border'}`}
                          >
                            <div className="flex items-start gap-2 mb-2">
                              <h4 className="text-body-md font-semibold text-text-primary flex-1">{c.name}</h4>
                              {c.source === 'ai' && <span className="text-[10px] uppercase tracking-wider font-mono text-blue-700 bg-blue-50 border border-blue-200 rounded px-1 py-0.5 shrink-0">AI</span>}
                              <button type="button" onClick={(e) => handleArchiveCap(c.id, e)} title="Archive capability" className="text-text-tertiary hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <Archive size={13} />
                              </button>
                            </div>
                            {c.description && <p className="text-[11px] text-text-secondary mb-2 line-clamp-2">{c.description}</p>}
                            <div className="flex flex-wrap gap-1">
                              {c.logicalSystemIds.length === 0 && c.physicalSystemIds.length === 0 && (
                                <span className="text-[10px] text-text-tertiary italic">Unmapped</span>
                              )}
                              {c.logicalSystemIds.map(sid => {
                                const s = catById.get(sid)
                                if (!s) return null
                                const physCount = c.physicalSystemIds.filter(p => physById.get(p)?.parentId === sid).length
                                return (
                                  <span key={sid} className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border" style={{ color: s.color || '#10B981', borderColor: `${s.color || '#10B981'}55`, background: `${s.color || '#10B981'}12` }}>
                                    <span className="w-1.5 h-1.5 rounded-sm" style={{ background: s.color || '#10B981' }} />
                                    {s.label}{physCount > 0 && <span className="opacity-60">·{physCount}</span>}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ─── Pivot (slice into columns by the chosen dimension) ─── */
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
                <div className="p-2 space-y-1.5 overflow-y-auto" style={{ maxHeight: 560 }}>
                  {col.caps.map(c => {
                    const ws = c.workstream_id ? wsById.get(c.workstream_id) : null
                    return (
                      <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} className="w-full text-left bg-white border border-border hover:border-brand-300 rounded-lg px-2.5 py-2 transition-colors">
                        <div className="text-body-sm font-medium text-text-primary mb-1">{c.name}</div>
                        <div className="flex flex-wrap gap-1">
                          {slice !== 'workstream' && ws && (
                            <span className="text-[10px] rounded px-1 py-0.5" style={{ color: ws.color || '#10B981', background: `${ws.color || '#10B981'}18` }}>{ws.name}</span>
                          )}
                          {slice === 'workstream' && c.logicalSystemIds.map(sid => { const s = catById.get(sid); return s ? <span key={sid} className="text-[10px] rounded px-1 py-0.5 border" style={{ color: s.color || '#10B981', borderColor: `${s.color || '#10B981'}55` }}>{s.label}</span> : null })}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ─── Archived ─── */}
      {archivedCaps.length > 0 && (
        <div className="mt-8">
          <button type="button" onClick={() => setShowArchived(!showArchived)} className="flex items-center gap-2 text-body-sm text-text-tertiary hover:text-text-secondary transition-colors mb-3">
            <ChevronRight size={10} className={`transition-transform ${showArchived ? 'rotate-90' : ''}`} />
            <Archive size={14} className="opacity-60" />
            Archived ({archivedCaps.length})
          </button>
          {showArchived && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {archivedCaps.map(c => (
                <div key={c.id} className="bg-white border border-border rounded-lg p-4 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="flex items-start gap-2 mb-1">
                    <h4 className="text-body-md font-semibold text-text-primary flex-1">{c.name}</h4>
                    <button type="button" onClick={() => handleRestoreCap(c.id)} title="Restore capability" className="text-text-tertiary hover:text-status-green transition-colors shrink-0">
                      <ArchiveRestore size={14} />
                    </button>
                    <button type="button" onClick={() => handleDeleteCap(c.id)} title="Delete permanently" className="text-text-tertiary hover:text-red-600 transition-colors shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="text-[10px]" style={{ color: c.workstream_id ? (wsById.get(c.workstream_id)?.color || undefined) : undefined }}>
                    <span className={c.workstream_id && wsById.get(c.workstream_id)?.color ? undefined : 'text-text-tertiary'}>{wsName(c.workstream_id)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Assignment drawer ─── */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelectedId(null)} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white border-l border-border shadow-modal animate-slide-in-right flex flex-col">
            <div className="flex items-start gap-2 p-5 border-b border-border">
              <div className="flex-1 min-w-0">
                <input
                  value={selected.name}
                  onChange={e => patchCap(selected.id, c => ({ ...c, name: e.target.value }))}
                  onBlur={e => handleUpdateCap(selected.id, { name: e.target.value.trim() || 'Untitled' })}
                  aria-label="Capability name"
                  className="w-full bg-transparent text-heading-sm font-semibold text-text-primary focus:outline-none border-b border-transparent focus:border-brand-500"
                />
                <input
                  value={selected.domain || ''}
                  onChange={e => patchCap(selected.id, c => ({ ...c, domain: e.target.value }))}
                  onBlur={e => handleUpdateCap(selected.id, { domain: e.target.value.trim() })}
                  placeholder="Domain (optional, e.g. Finance)"
                  aria-label="Domain"
                  className="w-full bg-transparent text-[11px] text-text-secondary mt-1 focus:outline-none placeholder:text-text-tertiary"
                />
              </div>
              <Button variant="ghost" size="sm" iconOnly aria-label="Delete capability" title="Delete capability" onClick={() => handleDeleteCap(selected.id)} icon={<Trash2 size={15} />} className="hover:text-red-600" />
              <Button variant="ghost" size="sm" iconOnly aria-label="Close" title="Close" onClick={() => setSelectedId(null)} icon={<X size={16} />} />
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <h4 className="text-label uppercase text-text-secondary mb-2">Value stream</h4>
              <div className="mb-5">
                <WorkstreamPicker orgId={orgId} value={selected.workstream_id} workstreams={workstreams} onChange={(wsId) => handleSetWorkstream(selected.id, wsId)} />
              </div>

              <textarea
                value={selected.description || ''}
                onChange={e => patchCap(selected.id, c => ({ ...c, description: e.target.value }))}
                onBlur={e => handleUpdateCap(selected.id, { description: e.target.value.trim() })}
                placeholder="Description…"
                aria-label="Description"
                rows={2}
                className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 mb-5 resize-none"
              />

              <h4 className="text-label uppercase text-text-secondary mb-2">Realized by</h4>
              <div className="space-y-1.5">
                {catalog.map(s => {
                  const on = selected.logicalSystemIds.includes(s.id)
                  return (
                    <div key={s.id} className={`rounded-lg border transition-colors ${on ? 'border-border-strong bg-surface-muted' : 'border-border'}`}>
                      <button type="button" onClick={() => toggleLogical(selected.id, s.id)} className="flex items-center gap-2 w-full px-3 py-2 text-left">
                        <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${on ? 'border-transparent' : 'border-border-strong'}`} style={on ? { background: s.color || '#10B981' } : undefined}>
                          {on && <Check size={10} className="text-white" />}
                        </span>
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color || '#10B981' }} />
                        <span className={`flex-1 text-body-sm ${on ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>{s.label}</span>
                        <span className="text-[10px] uppercase font-mono text-text-tertiary">{s.system_type}</span>
                      </button>
                      {on && s.physicals.length > 0 && (
                        <div className="px-3 pb-2 pl-9 flex flex-wrap gap-1.5">
                          {s.physicals.map(p => {
                            const pon = selected.physicalSystemIds.includes(p.id)
                            return (
                              <button key={p.id} type="button" onClick={() => togglePhysical(selected.id, p.id, s.id)} className={`text-[10px] rounded px-1.5 py-0.5 border transition-colors ${pon ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-border text-text-secondary hover:bg-surface-muted'}`}>
                                {pon ? '✓ ' : ''}{p.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── AI Consistency Checker / Suggest Updates panel ─── */}
      {aiReview && (
        <CapabilityAIReviewPanel
          mode={aiReview}
          caps={caps}
          workstreams={workstreams}
          orgId={orgId}
          userId={userId}
          onClose={() => { setAiReview(null); if (reviewDirtyRef.current) { reviewDirtyRef.current = false; load({ silent: true }) } }}
          onApplied={() => { reviewDirtyRef.current = true }}
        />
      )}

      {/* ─── AI Draft modal ─── */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !aiBusy && setAiOpen(false)}>
          <div className="w-full max-w-lg bg-white rounded-xl shadow-card-hover flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 pb-3">
              <h2 className="text-heading-sm font-display text-text-primary mb-1">AI Draft capability map</h2>
              <p className="text-body-sm text-text-secondary">Draft a capability map aligned to your value streams and mapped to your bedrock systems. Review, deselect any, and add.</p>
            </div>

            {!aiResults ? (
              <div className="px-6 pb-6 overflow-y-auto">
                <label className="block text-label uppercase text-text-secondary mb-1">Organization context (optional)</label>
                <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={3} placeholder="e.g. Tier-1 aerospace structures manufacturer, mixed cost-plus and FFP contracts, SAP S/4HANA + Teamcenter + Costpoint…" className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 mb-3 resize-none" />
                <label className="block text-label uppercase text-text-secondary mb-1">Value stream</label>
                <select value={aiFocusWs} onChange={e => setAiFocusWs(e.target.value)} aria-label="Focus value stream" className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 mb-3">
                  <option value="">All value streams</option>
                  {workstreams.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                {aiError && <div className="text-[11px] text-status-red mb-3">{aiError}</div>}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="md" onClick={() => setAiOpen(false)} disabled={aiBusy}>Cancel</Button>
                  <Button variant="ai" size="md" onClick={runAiDraft} disabled={aiBusy} icon={<Sparkles size={14} />}>{aiBusy ? 'Drafting…' : 'Generate draft'}</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 overflow-y-auto flex-1">
                  {aiResults.length === 0 ? (
                    <div className="text-body-sm text-text-tertiary py-8 text-center">No new capabilities returned. Try a different prompt.</div>
                  ) : (
                    <div className="space-y-1.5 pb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-text-tertiary">{aiResults.filter(d => d.selected).length} of {aiResults.length} selected</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setAiResults(r => r!.map(d => ({ ...d, selected: true })))} className="text-[10px] text-brand-600 hover:underline">All</button>
                          <button type="button" onClick={() => setAiResults(r => r!.map(d => ({ ...d, selected: false })))} className="text-[10px] text-text-tertiary hover:underline">None</button>
                        </div>
                      </div>
                      {aiResults.map((d, i) => {
                        const ws = d.workstreamCode ? wsByCode.get(d.workstreamCode) : null
                        return (
                          <label key={i} className="flex items-start gap-2 bg-surface-muted border border-border rounded-lg px-3 py-2 cursor-pointer">
                            <input type="checkbox" checked={d.selected} onChange={e => setAiResults(r => r!.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))} className="mt-0.5 accent-[#2563EB]" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-body-sm font-semibold text-text-primary">{d.name}</span>
                                {ws && <span className="text-[10px] rounded px-1 py-0.5" style={{ color: ws.color || '#10B981', background: `${ws.color || '#10B981'}18` }}>{ws.name}</span>}
                              </div>
                              {d.description && <div className="text-[10px] text-text-tertiary line-clamp-1">{d.description}</div>}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {d.systems.map(st => { const s = catByType.get(st); return s ? <span key={st} className="text-[10px] rounded px-1 py-0.5 border" style={{ color: s.color || '#10B981', borderColor: `${s.color || '#10B981'}55` }}>{s.label}</span> : null })}
                                {d.physicalLabels.map((pl, k) => <span key={`p${k}`} className="text-[10px] rounded px-1 py-0.5 bg-white border border-border text-text-secondary">{pl}</span>)}
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="p-6 pt-3 border-t border-border flex justify-between items-center">
                  <button type="button" onClick={() => setAiResults(null)} disabled={aiBusy} className="text-body-sm text-text-tertiary hover:text-text-secondary disabled:opacity-50">← Back</button>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="md" onClick={() => setAiOpen(false)} disabled={aiBusy}>Cancel</Button>
                    <Button variant="primary" size="md" onClick={acceptAiDraft} disabled={aiBusy || aiResults.filter(d => d.selected).length === 0}>{aiBusy ? 'Adding…' : `Add ${aiResults.filter(d => d.selected).length} capabilities`}</Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
