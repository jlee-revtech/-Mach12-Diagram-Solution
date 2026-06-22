'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  listCapabilityMap, createCapability, updateCapability, deleteCapability,
  addCapabilityLogicalSystem, removeCapabilityLogicalSystem,
  addCapabilityPhysicalSystem, removeCapabilityPhysicalSystem, bulkCreateCapabilities,
} from '@/lib/supabase/capmap'
import { listBedrockCatalog, seedBedrockSystems } from '@/lib/supabase/bedrock-systems'
import type { CapabilityWithSystems } from '@/lib/capmap/types'
import type { BedrockSystemWithPhysicals } from '@/lib/bedrock/types'

const UNCATEGORIZED = 'Uncategorized'

interface DraftCap { name: string; domain: string; description: string; systems: string[]; selected: boolean }

export default function CapabilityMapWorkspace({ orgId, userId }: { orgId: string; userId: string }) {
  const [catalog, setCatalog] = useState<BedrockSystemWithPhysicals[]>([])
  const [caps, setCaps] = useState<CapabilityWithSystems[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [view, setView] = useState<'board' | 'matrix'>('board')
  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // AI draft modal
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiFocus, setAiFocus] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiResults, setAiResults] = useState<DraftCap[] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [c, m] = await Promise.all([listBedrockCatalog(orgId), listCapabilityMap(orgId)])
    setCatalog(c); setCaps(m); setLoading(false)
  }, [orgId])
  useEffect(() => { load() }, [load])

  // ─── Lookups ───
  const catById = useMemo(() => new Map(catalog.map(c => [c.id, c])), [catalog])
  const catByType = useMemo(() => new Map<string, BedrockSystemWithPhysicals>(catalog.map(c => [c.system_type, c])), [catalog])
  const physById = useMemo(() => {
    const m = new Map<string, { name: string; parentId: string }>()
    for (const c of catalog) for (const p of c.physicals) m.set(p.id, { name: p.name, parentId: c.id })
    return m
  }, [catalog])

  const domains = useMemo(() => {
    const set = new Set<string>()
    for (const c of caps) set.add(c.domain?.trim() || UNCATEGORIZED)
    return [...set].sort((a, b) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : a.localeCompare(b)))
  }, [caps])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return caps.filter(c => {
      if (domainFilter && (c.domain?.trim() || UNCATEGORIZED) !== domainFilter) return false
      if (q && !(`${c.name} ${c.description || ''} ${c.domain || ''}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [caps, search, domainFilter])

  const byDomain = useMemo(() => {
    const m = new Map<string, CapabilityWithSystems[]>()
    for (const c of filtered) {
      const d = c.domain?.trim() || UNCATEGORIZED
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(c)
    }
    return [...m.entries()].sort((a, b) => (a[0] === UNCATEGORIZED ? 1 : b[0] === UNCATEGORIZED ? -1 : a[0].localeCompare(b[0])))
  }, [filtered])

  const selected = caps.find(c => c.id === selectedId) || null

  // ─── Optimistic mutators ───
  const patchCap = (id: string, fn: (c: CapabilityWithSystems) => CapabilityWithSystems) =>
    setCaps(x => x.map(c => c.id === id ? fn(c) : c))

  const handleAddCapability = async () => {
    try {
      const cap = await createCapability(orgId, userId, { name: 'New capability', domain: domainFilter && domainFilter !== UNCATEGORIZED ? domainFilter : undefined, sort_order: caps.length })
      setCaps(x => [...x, { ...cap, logicalSystemIds: [], physicalSystemIds: [] }])
      setSelectedId(cap.id)
    } catch { load() }
  }

  const handleUpdateCap = async (id: string, updates: { name?: string; domain?: string; description?: string }) => {
    patchCap(id, c => ({ ...c, ...updates }))
    await updateCapability(id, updates).catch(() => load())
  }

  const handleDeleteCap = async (id: string) => {
    if (!confirm('Delete this capability and its system mappings?')) return
    setCaps(x => x.filter(c => c.id !== id))
    if (selectedId === id) setSelectedId(null)
    await deleteCapability(id).catch(() => load())
  }

  const toggleLogical = async (capId: string, sysId: string) => {
    const cap = caps.find(c => c.id === capId)
    if (!cap) return
    const has = cap.logicalSystemIds.includes(sysId)
    if (has) {
      // Remove the logical system and any physical mappings beneath it.
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
      // Assigning a physical implies its logical system is realized.
      const needLogical = !cap.logicalSystemIds.includes(parentId)
      patchCap(capId, c => ({ ...c, physicalSystemIds: [...c.physicalSystemIds, physId], logicalSystemIds: needLogical ? [...c.logicalSystemIds, parentId] : c.logicalSystemIds }))
      if (needLogical) await addCapabilityLogicalSystem(orgId, userId, capId, parentId).catch(() => load())
      await addCapabilityPhysicalSystem(orgId, userId, capId, physId).catch(() => load())
    }
  }

  // ─── AI draft ───
  const runAiDraft = async () => {
    setAiBusy(true); setAiError(null)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'capability-map-draft',
          prompt: aiPrompt.trim(),
          context: {
            catalog: catalog.map(c => ({ systemType: c.system_type, label: c.label, physicals: c.physicals.map(p => p.name) })),
            existing: caps.map(c => c.name),
            focusDomain: aiFocus.trim() || undefined,
          },
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Draft failed') }
      const data = await res.json() as { capabilities?: { name: string; domain?: string; description?: string; systems?: string[] }[] }
      const existing = new Set(caps.map(c => c.name.toLowerCase()))
      const drafts: DraftCap[] = (data.capabilities || [])
        .filter(d => d.name && !existing.has(d.name.toLowerCase()))
        .map(d => ({ name: d.name, domain: d.domain || UNCATEGORIZED, description: d.description || '', systems: (d.systems || []).filter(s => catByType.has(s)), selected: true }))
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
        domain: d.domain === UNCATEGORIZED ? undefined : d.domain,
        bedrockSystemIds: d.systems.map(s => catByType.get(s)?.id).filter((x): x is string => !!x),
      })))
      setAiOpen(false); setAiResults(null); setAiPrompt(''); setAiFocus('')
      await load()
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to add capabilities')
    } finally {
      setAiBusy(false)
    }
  }

  // ─── Render ───
  if (loading) return <div className="py-24 text-center text-sm text-[var(--m12-text-muted)]">Loading capability map…</div>

  if (catalog.length === 0) {
    return (
      <div className="text-center py-24 border border-dashed border-[var(--m12-border)]/60 rounded-2xl">
        <h2 className="text-lg font-semibold text-[var(--m12-text-secondary)] mb-2">Define your bedrock systems first</h2>
        <p className="text-sm text-[var(--m12-text-muted)] mb-6">Capabilities are mapped to your Logical Bedrock Systems and Physical Systems. Seed the standard catalog to begin.</p>
        <button
          type="button"
          onClick={async () => { setSeeding(true); try { const c = await seedBedrockSystems(orgId, userId); setCatalog(c) } finally { setSeeding(false) } }}
          disabled={seeding}
          className="inline-flex items-center gap-2 bg-[#10B981] hover:bg-[#34D399] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {seeding ? 'Seeding…' : 'Seed standard systems'}
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-1">
          <button type="button" onClick={() => setView('board')} className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${view === 'board' ? 'bg-[#10B981]/12 text-[#34D399]' : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'}`}>Board</button>
          <button type="button" onClick={() => setView('matrix')} className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${view === 'matrix' ? 'bg-[#10B981]/12 text-[#34D399]' : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'}`}>Matrix</button>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search capabilities…"
          aria-label="Search capabilities"
          className="flex-1 min-w-[160px] bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] placeholder:text-[var(--m12-text-muted)] focus:outline-none focus:border-[#10B981]/60"
        />
        <button type="button" onClick={() => { setAiOpen(true); setAiError(null); setAiResults(null) }} className="flex items-center gap-2 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 hover:border-[#10B981]/60 text-[var(--m12-text-secondary)] px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l1.6 3.4 3.7.5-2.7 2.6.6 3.7L8 9.9 4.8 11.7l.6-3.7L2.7 5.4l3.7-.5L8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
          AI Draft
        </button>
        <button type="button" onClick={handleAddCapability} className="flex items-center gap-2 bg-[#10B981] hover:bg-[#34D399] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Capability
        </button>
      </div>

      {/* Domain filter chips */}
      {domains.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          <button type="button" onClick={() => setDomainFilter(null)} className={`text-[11px] rounded-full px-2.5 py-1 border transition-colors ${!domainFilter ? 'border-[#10B981]/60 bg-[#10B981]/12 text-[#34D399]' : 'border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'}`}>All ({caps.length})</button>
          {domains.map(d => {
            const n = caps.filter(c => (c.domain?.trim() || UNCATEGORIZED) === d).length
            return <button key={d} type="button" onClick={() => setDomainFilter(d)} className={`text-[11px] rounded-full px-2.5 py-1 border transition-colors ${domainFilter === d ? 'border-[#10B981]/60 bg-[#10B981]/12 text-[#34D399]' : 'border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'}`}>{d} ({n})</button>
          })}
        </div>
      )}

      {caps.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[var(--m12-border)]/60 rounded-2xl">
          <h2 className="text-base font-semibold text-[var(--m12-text-secondary)] mb-2">No capabilities yet</h2>
          <p className="text-sm text-[var(--m12-text-muted)] mb-6">Let AI draft a capability map for your organization, or add capabilities manually and map them to your systems.</p>
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => { setAiOpen(true); setAiError(null); setAiResults(null) }} className="inline-flex items-center gap-2 bg-[#10B981] hover:bg-[#34D399] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">AI Draft capabilities</button>
            <button type="button" onClick={handleAddCapability} className="inline-flex items-center gap-2 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 hover:border-[var(--m12-border)] text-[var(--m12-text-secondary)] px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">Add manually</button>
          </div>
        </div>
      ) : view === 'board' ? (
        /* ─── Board ─── */
        <div className="space-y-6">
          {byDomain.map(([domain, list]) => (
            <div key={domain}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--m12-text-secondary)] font-[family-name:var(--font-space-mono)]">{domain}</h3>
                <span className="text-[10px] text-[var(--m12-text-muted)]">{list.length}</span>
                <div className="flex-1 h-px bg-[var(--m12-border)]/30" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`text-left bg-[var(--m12-bg-card)] border rounded-xl p-4 transition-all card-glow ${selectedId === c.id ? 'border-[#10B981]/70' : 'border-[var(--m12-border)]/40 hover:border-[var(--m12-border)]'}`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-[var(--m12-text)] flex-1">{c.name}</h4>
                      {c.source === 'ai' && <span className="text-[8px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[#34D399] border border-[#10B981]/40 rounded px-1 py-0.5 shrink-0">AI</span>}
                    </div>
                    {c.description && <p className="text-[11px] text-[var(--m12-text-muted)] mb-2 line-clamp-2">{c.description}</p>}
                    <div className="flex flex-wrap gap-1">
                      {c.logicalSystemIds.length === 0 && c.physicalSystemIds.length === 0 && (
                        <span className="text-[10px] text-[var(--m12-text-muted)] italic">Unmapped</span>
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
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ─── Matrix ─── */
        <div className="overflow-x-auto border border-[var(--m12-border)]/40 rounded-xl">
          <table className="border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[var(--m12-bg-card)] text-left font-semibold text-[var(--m12-text-secondary)] px-3 py-2 border-b border-r border-[var(--m12-border)]/40 min-w-[200px]">Capability</th>
                {catalog.map(s => (
                  <th key={s.id} className="px-1.5 py-2 border-b border-[var(--m12-border)]/40 align-bottom" title={s.label}>
                    <div className="flex flex-col items-center gap-1">
                      <span className="w-2 h-2 rounded-sm" style={{ background: s.color || '#10B981' }} />
                      <span className="text-[9px] uppercase tracking-wide font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: 90 }}>{s.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-[var(--m12-bg-card)]/50">
                  <td className="sticky left-0 z-10 bg-[var(--m12-bg)] px-3 py-1.5 border-b border-r border-[var(--m12-border)]/30">
                    <button type="button" onClick={() => setSelectedId(c.id)} className="text-left text-[var(--m12-text)] hover:text-[#34D399] transition-colors">
                      {c.name}
                      <span className="block text-[9px] text-[var(--m12-text-muted)]">{c.domain || UNCATEGORIZED}</span>
                    </button>
                  </td>
                  {catalog.map(s => {
                    const on = c.logicalSystemIds.includes(s.id)
                    const physCount = c.physicalSystemIds.filter(p => physById.get(p)?.parentId === s.id).length
                    return (
                      <td key={s.id} className="text-center border-b border-[var(--m12-border)]/20 px-1">
                        <button
                          type="button"
                          onClick={() => toggleLogical(c.id, s.id)}
                          title={`${c.name} ↔ ${s.label}`}
                          className="w-7 h-7 inline-flex items-center justify-center rounded transition-colors hover:bg-[var(--m12-bg-card)]"
                        >
                          {on ? (
                            <span className="inline-flex items-center justify-center rounded-full text-white text-[8px] font-bold" style={{ background: s.color || '#10B981', width: physCount > 0 ? 16 : 12, height: physCount > 0 ? 16 : 12 }}>{physCount > 0 ? physCount : ''}</span>
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full border border-[var(--m12-border)]/40" />
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Assignment drawer ─── */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelectedId(null)} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[var(--m12-bg)] border-l border-[var(--m12-border)]/60 shadow-2xl flex flex-col">
            <div className="flex items-start gap-2 p-5 border-b border-[var(--m12-border)]/40">
              <div className="flex-1 min-w-0">
                <input
                  value={selected.name}
                  onChange={e => patchCap(selected.id, c => ({ ...c, name: e.target.value }))}
                  onBlur={e => handleUpdateCap(selected.id, { name: e.target.value.trim() || 'Untitled' })}
                  aria-label="Capability name"
                  className="w-full bg-transparent text-base font-semibold text-[var(--m12-text)] focus:outline-none border-b border-transparent focus:border-[#10B981]/40"
                />
                <input
                  value={selected.domain || ''}
                  onChange={e => patchCap(selected.id, c => ({ ...c, domain: e.target.value }))}
                  onBlur={e => handleUpdateCap(selected.id, { domain: e.target.value.trim() })}
                  placeholder="Domain (e.g. Finance)"
                  aria-label="Domain"
                  className="w-full bg-transparent text-[11px] text-[var(--m12-text-muted)] mt-1 focus:outline-none placeholder:text-[var(--m12-text-muted)]"
                />
              </div>
              <button type="button" onClick={() => handleDeleteCap(selected.id)} title="Delete capability" className="text-[var(--m12-border)] hover:text-red-400 shrink-0">
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button type="button" onClick={() => setSelectedId(null)} title="Close" className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <textarea
                value={selected.description || ''}
                onChange={e => patchCap(selected.id, c => ({ ...c, description: e.target.value }))}
                onBlur={e => handleUpdateCap(selected.id, { description: e.target.value.trim() })}
                placeholder="Description…"
                aria-label="Description"
                rows={2}
                className="w-full bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-muted)] focus:outline-none focus:border-[#10B981]/50 mb-5 resize-none"
              />

              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--m12-text-secondary)] font-[family-name:var(--font-space-mono)] mb-2">Realized by</h4>
              <div className="space-y-1.5">
                {catalog.map(s => {
                  const on = selected.logicalSystemIds.includes(s.id)
                  return (
                    <div key={s.id} className={`rounded-lg border transition-colors ${on ? 'border-[var(--m12-border)]/60 bg-[var(--m12-bg-card)]' : 'border-[var(--m12-border)]/30'}`}>
                      <button type="button" onClick={() => toggleLogical(selected.id, s.id)} className="flex items-center gap-2 w-full px-3 py-2 text-left">
                        <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${on ? 'border-transparent' : 'border-[var(--m12-border)]/50'}`} style={on ? { background: s.color || '#10B981' } : undefined}>
                          {on && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </span>
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color || '#10B981' }} />
                        <span className={`flex-1 text-xs ${on ? 'text-[var(--m12-text)] font-medium' : 'text-[var(--m12-text-secondary)]'}`}>{s.label}</span>
                        <span className="text-[9px] uppercase font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)]">{s.system_type}</span>
                      </button>
                      {on && s.physicals.length > 0 && (
                        <div className="px-3 pb-2 pl-9 flex flex-wrap gap-1.5">
                          {s.physicals.map(p => {
                            const pon = selected.physicalSystemIds.includes(p.id)
                            return (
                              <button key={p.id} type="button" onClick={() => togglePhysical(selected.id, p.id, s.id)} className={`text-[10px] rounded px-1.5 py-0.5 border transition-colors ${pon ? 'border-[#10B981]/60 bg-[#10B981]/12 text-[#34D399]' : 'border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'}`}>
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

      {/* ─── AI Draft modal ─── */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !aiBusy && setAiOpen(false)}>
          <div className="w-full max-w-lg bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 pb-3">
              <h2 className="text-base font-semibold text-[var(--m12-text)] mb-1">AI Draft capability map</h2>
              <p className="text-xs text-[var(--m12-text-muted)]">Draft a business capability map mapped to your bedrock systems. Review, deselect any, and add.</p>
            </div>

            {!aiResults ? (
              <div className="px-6 pb-6 overflow-y-auto">
                <label className="block text-[11px] font-medium text-[var(--m12-text-secondary)] mb-1">Organization context (optional)</label>
                <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={3} placeholder="e.g. Tier-1 aerospace structures manufacturer, mixed cost-plus and FFP contracts, SAP S/4HANA + Teamcenter + Costpoint…" className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] placeholder:text-[var(--m12-text-muted)] focus:outline-none focus:border-[#10B981]/60 mb-3 resize-none" />
                <label className="block text-[11px] font-medium text-[var(--m12-text-secondary)] mb-1">Focus domain (optional)</label>
                <input value={aiFocus} onChange={e => setAiFocus(e.target.value)} placeholder="e.g. Program Management" className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] placeholder:text-[var(--m12-text-muted)] focus:outline-none focus:border-[#10B981]/60 mb-3" />
                {aiError && <div className="text-[11px] text-red-400 mb-3">{aiError}</div>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setAiOpen(false)} disabled={aiBusy} className="px-4 py-2 rounded-lg text-sm text-[var(--m12-text-secondary)] hover:text-[var(--m12-text)] disabled:opacity-50">Cancel</button>
                  <button type="button" onClick={runAiDraft} disabled={aiBusy} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#10B981] hover:bg-[#34D399] disabled:opacity-50 text-white transition-colors">{aiBusy ? 'Drafting…' : 'Generate draft'}</button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 overflow-y-auto flex-1">
                  {aiResults.length === 0 ? (
                    <div className="text-sm text-[var(--m12-text-muted)] py-8 text-center">No new capabilities returned. Try a different prompt.</div>
                  ) : (
                    <div className="space-y-1.5 pb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-[var(--m12-text-muted)]">{aiResults.filter(d => d.selected).length} of {aiResults.length} selected</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setAiResults(r => r!.map(d => ({ ...d, selected: true })))} className="text-[10px] text-[#34D399] hover:underline">All</button>
                          <button type="button" onClick={() => setAiResults(r => r!.map(d => ({ ...d, selected: false })))} className="text-[10px] text-[var(--m12-text-muted)] hover:underline">None</button>
                        </div>
                      </div>
                      {aiResults.map((d, i) => (
                        <label key={i} className="flex items-start gap-2 bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2 cursor-pointer">
                          <input type="checkbox" checked={d.selected} onChange={e => setAiResults(r => r!.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))} className="mt-0.5 accent-[#10B981]" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-[var(--m12-text)]">{d.name}</span>
                              <span className="text-[9px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)]">{d.domain}</span>
                            </div>
                            {d.description && <div className="text-[10px] text-[var(--m12-text-muted)] line-clamp-1">{d.description}</div>}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {d.systems.map(st => { const s = catByType.get(st); return s ? <span key={st} className="text-[9px] rounded px-1 py-0.5 border" style={{ color: s.color || '#10B981', borderColor: `${s.color || '#10B981'}55` }}>{s.label}</span> : null })}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-6 pt-3 border-t border-[var(--m12-border)]/40 flex justify-between items-center">
                  <button type="button" onClick={() => setAiResults(null)} disabled={aiBusy} className="text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] disabled:opacity-50">← Back</button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAiOpen(false)} disabled={aiBusy} className="px-4 py-2 rounded-lg text-sm text-[var(--m12-text-secondary)] hover:text-[var(--m12-text)] disabled:opacity-50">Cancel</button>
                    <button type="button" onClick={acceptAiDraft} disabled={aiBusy || aiResults.filter(d => d.selected).length === 0} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#10B981] hover:bg-[#34D399] disabled:opacity-50 text-white transition-colors">{aiBusy ? 'Adding…' : `Add ${aiResults.filter(d => d.selected).length} capabilities`}</button>
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
