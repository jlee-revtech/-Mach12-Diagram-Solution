'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  listBedrockCatalog, seedBedrockSystems, createBedrockSystem, updateBedrockSystem, deleteBedrockSystem,
  createPhysicalSystem, deletePhysicalSystem, setPrimaryPhysicalSystem,
} from '@/lib/supabase/bedrock-systems'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import WorkstreamPicker from '@/components/workstream/WorkstreamPicker'
import { SYSTEM_TEMPLATES, type SystemType } from '@/lib/diagram/types'
import type { BedrockSystemWithPhysicals } from '@/lib/bedrock/types'
import type { Workstream } from '@/lib/workstream/types'

// Bedrock Systems catalog: Logical Bedrock Systems (the Systems palette
// categories) each with an editable set of Physical Systems. This defines the
// org's best-of-breed platform architecture that grounds the AI-generated
// data integration diagrams.
export default function BedrockCatalog({ orgId, userId }: { orgId: string; userId: string }) {
  const [catalog, setCatalog] = useState<BedrockSystemWithPhysicals[]>([])
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [newType, setNewType] = useState<SystemType | ''>('')
  const [physInput, setPhysInput] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const [c, w] = await Promise.all([listBedrockCatalog(orgId), listWorkstreams(orgId)])
    setCatalog(c); setWorkstreams(w); setLoading(false)
  }, [orgId])
  useEffect(() => { load() }, [load])

  const presentTypes = new Set(catalog.map(c => c.system_type))
  const availableTemplates = SYSTEM_TEMPLATES.filter(t => !presentTypes.has(t.type))

  const handleSeed = async () => {
    if (busy) return
    setBusy(true)
    try { const c = await seedBedrockSystems(orgId, userId); setCatalog(c) }
    finally { setBusy(false) }
  }

  const handleAddSystem = async () => {
    if (!newType || busy) return
    const tmpl = SYSTEM_TEMPLATES.find(t => t.type === newType)
    if (!tmpl) return
    setBusy(true)
    try {
      const sys = await createBedrockSystem(orgId, userId, { system_type: tmpl.type, label: tmpl.label, description: tmpl.description, color: tmpl.color, sort_order: catalog.length })
      setCatalog(x => [...x, { ...sys, physicals: [] }])
      setNewType('')
    } finally { setBusy(false) }
  }

  const handleDeleteSystem = async (id: string) => {
    if (!confirm('Remove this logical bedrock system and its physical systems? Generated diagrams are not affected.')) return
    setCatalog(x => x.filter(s => s.id !== id))
    await deleteBedrockSystem(id).catch(() => load())
  }

  const handleSetWorkstream = async (id: string, wsId: string | null) => {
    setCatalog(x => x.map(s => s.id === id ? { ...s, workstream_id: wsId } : s))
    await updateBedrockSystem(id, { workstream_id: wsId }).catch(() => load())
  }

  const handleAddPhysical = async (sysId: string) => {
    const name = (physInput[sysId] || '').trim()
    if (!name) return
    setPhysInput(p => ({ ...p, [sysId]: '' }))
    const sys = catalog.find(s => s.id === sysId)
    const isPrimary = !sys || sys.physicals.length === 0
    try {
      const phys = await createPhysicalSystem(sysId, { name, is_primary: isPrimary, sort_order: sys ? sys.physicals.length : 0 })
      setCatalog(x => x.map(s => s.id === sysId ? { ...s, physicals: [...s.physicals, phys] } : s))
    } catch { load() }
  }

  const handleDeletePhysical = async (sysId: string, physId: string) => {
    setCatalog(x => x.map(s => s.id === sysId ? { ...s, physicals: s.physicals.filter(p => p.id !== physId) } : s))
    await deletePhysicalSystem(physId).catch(() => load())
  }

  const handleSetPrimary = async (sysId: string, physId: string) => {
    setCatalog(x => x.map(s => s.id === sysId
      ? { ...s, physicals: s.physicals.map(p => ({ ...p, is_primary: p.id === physId })).sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order) }
      : s))
    await setPrimaryPhysicalSystem(sysId, physId).catch(() => load())
  }

  if (loading) return <div className="py-24 text-center text-sm text-[var(--m12-text-muted)]">Loading bedrock systems…</div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Logical Bedrock Systems (main) */}
      <div className="lg:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[var(--m12-text)]">Logical Bedrock Systems</h2>
          <span className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">({catalog.length})</span>
        </div>

        {catalog.length === 0 && (
          <div className="text-xs text-[var(--m12-text-muted)] py-10 text-center border border-dashed border-[var(--m12-border)]/50 rounded-xl">
            No bedrock systems yet. Seed the standard platform architecture to get started.
            <div className="mt-3">
              <button onClick={handleSeed} disabled={busy} className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
                {busy ? 'Seeding…' : 'Seed standard systems'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {catalog.map(s => (
            <div key={s.id} className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color || '#2563EB' }} />
                <span className="text-sm font-semibold text-[var(--m12-text)]">{s.label}</span>
                <span className="text-[9px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded px-1.5 py-0.5">{s.system_type}</span>
                <div className="ml-auto flex items-center gap-2">
                  <WorkstreamPicker orgId={orgId} value={s.workstream_id} workstreams={workstreams} onChange={(wsId) => handleSetWorkstream(s.id, wsId)} className="w-48" />
                  <button onClick={() => handleDeleteSystem(s.id)} title="Remove logical system" className="text-[var(--m12-border)] hover:text-red-400">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {s.physicals.length === 0 && <span className="text-[10px] text-[var(--m12-text-muted)]">No physical systems assigned.</span>}
                {s.physicals.map(p => (
                  <span key={p.id} className={`group inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border ${p.is_primary ? 'border-[#2563EB]/60 bg-[#2563EB]/12 text-[#93C5FD]' : 'border-[var(--m12-border)]/40 bg-[var(--m12-bg)] text-[var(--m12-text-secondary)]'}`}>
                    <button onClick={() => handleSetPrimary(s.id, p.id)} title={p.is_primary ? 'Primary platform' : 'Set as primary'} className={p.is_primary ? 'text-[#2563EB]' : 'text-[var(--m12-border)] hover:text-[#2563EB]'}>
                      <svg width="9" height="9" viewBox="0 0 12 12" fill={p.is_primary ? 'currentColor' : 'none'}><path d="M6 1l1.5 3 3.3.5-2.4 2.3.6 3.3L6 9.8 3 10.4l.6-3.3L1.2 4.8 4.5 4.3 6 1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" /></svg>
                    </button>
                    {p.name}
                    {p.vendor && <span className="opacity-50">· {p.vendor}</span>}
                    <button onClick={() => handleDeletePhysical(s.id, p.id)} className="opacity-50 group-hover:opacity-100 hover:text-red-400">×</button>
                  </span>
                ))}
                <input
                  value={physInput[s.id] || ''}
                  onChange={e => setPhysInput(p => ({ ...p, [s.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddPhysical(s.id) }}
                  placeholder="+ physical system"
                  aria-label="Add physical system"
                  className="text-[10px] bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded px-1.5 py-0.5 text-[var(--m12-text)] placeholder:text-[var(--m12-text-muted)] focus:outline-none focus:border-[#2563EB]/60 w-36"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Catalog actions (side) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[var(--m12-text)]">Catalog</h2>
        </div>
        <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-xl px-4 py-3 space-y-3">
          <p className="text-[11px] text-[var(--m12-text-muted)]">
            Seed the 19 standard platform categories with best-of-breed physical systems, then refine the physical assignments per logical system.
          </p>
          <button onClick={handleSeed} disabled={busy} className="w-full bg-[#2563EB]/12 border border-[#2563EB]/40 hover:border-[#2563EB]/70 disabled:opacity-50 text-[#93C5FD] text-xs font-medium rounded-lg px-3 py-2 transition-colors">
            {busy ? 'Seeding…' : 'Seed standard systems'}
          </button>
          {availableTemplates.length > 0 && (
            <div className="flex gap-2 pt-1 border-t border-[var(--m12-border)]/30">
              <select value={newType} onChange={e => setNewType(e.target.value as SystemType)} aria-label="Add logical system" className="flex-1 bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-2 py-2 text-xs text-[var(--m12-text)] focus:outline-none focus:border-[#2563EB]/60">
                <option value="">Add a system category…</option>
                {availableTemplates.map(t => <option key={t.type} value={t.type}>{t.label} — {t.description}</option>)}
              </select>
              <button onClick={handleAddSystem} disabled={busy || !newType} className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 transition-colors">Add</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
