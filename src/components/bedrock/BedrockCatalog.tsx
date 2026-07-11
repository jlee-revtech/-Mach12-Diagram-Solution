'use client'

import { useEffect, useState, useCallback } from 'react'
import { Database, Star, Trash2, X } from 'lucide-react'
import {
  listBedrockCatalog, seedBedrockSystems, createBedrockSystem, deleteBedrockSystem, setBedrockWorkstreams,
  createPhysicalSystem, deletePhysicalSystem, setPrimaryPhysicalSystem,
} from '@/lib/supabase/bedrock-systems'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import WorkstreamMultiPicker from '@/components/workstream/WorkstreamMultiPicker'
import { SYSTEM_TEMPLATES, type SystemType } from '@/lib/diagram/types'
import type { BedrockSystemWithPhysicals } from '@/lib/bedrock/types'
import type { Workstream } from '@/lib/workstream/types'
import { Button, EmptyState, LoadingState } from '@/components/common'

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

  const handleSetWorkstreams = async (id: string, ids: string[]) => {
    setCatalog(x => x.map(s => s.id === id ? { ...s, workstream_ids: ids, workstream_id: ids[0] ?? null } : s))
    await setBedrockWorkstreams(id, ids).catch(() => load())
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

  if (loading) return <LoadingState label="Loading bedrock systems..." />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Logical Bedrock Systems (main) */}
      <div className="lg:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-body-md font-semibold text-text-primary">Logical Bedrock Systems</h2>
          <span className="text-[11px] text-text-tertiary font-mono">({catalog.length})</span>
        </div>

        {catalog.length === 0 && (
          <EmptyState
            variant="dashed"
            icon={<Database size={28} />}
            title="No bedrock systems yet"
            description="Seed the standard platform architecture to get started."
            action={
              <Button variant="primary" onClick={handleSeed} loading={busy}>
                {busy ? 'Seeding…' : 'Seed standard systems'}
              </Button>
            }
          />
        )}

        <div className="space-y-2">
          {catalog.map(s => (
            <div key={s.id} className="bg-white rounded-lg border border-border shadow-card px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color || '#2563EB' }} />
                <span className="text-body-sm font-semibold text-text-primary">{s.label}</span>
                <span className="text-[10px] uppercase tracking-wider font-mono text-text-secondary bg-surface-muted border border-border rounded px-1.5 py-0.5">{s.system_type}</span>
                <div className="ml-auto flex items-center gap-1">
                  <WorkstreamMultiPicker orgId={orgId} value={s.workstream_ids ?? (s.workstream_id ? [s.workstream_id] : [])} workstreams={workstreams} onChange={(ids) => handleSetWorkstreams(s.id, ids)} className="w-56" />
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={<Trash2 size={13} />}
                    aria-label="Remove logical system"
                    title="Remove logical system"
                    className="hover:!text-red-600"
                    onClick={() => handleDeleteSystem(s.id)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {s.physicals.length === 0 && <span className="text-[11px] text-text-tertiary">No physical systems assigned.</span>}
                {s.physicals.map(p => (
                  <span key={p.id} className={`group inline-flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 border ${p.is_primary ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-border bg-surface-muted text-text-secondary'}`}>
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(s.id, p.id)}
                      title={p.is_primary ? 'Primary platform' : 'Set as primary'}
                      className={p.is_primary ? 'text-brand-600' : 'text-text-tertiary hover:text-brand-600'}
                    >
                      <Star size={9} fill={p.is_primary ? 'currentColor' : 'none'} />
                    </button>
                    <span className="font-mono">{p.name}</span>
                    {p.vendor && <span className="opacity-60">· {p.vendor}</span>}
                    <button
                      type="button"
                      onClick={() => handleDeletePhysical(s.id, p.id)}
                      aria-label={`Remove ${p.name}`}
                      className="opacity-50 group-hover:opacity-100 hover:text-red-600"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <input
                  value={physInput[s.id] || ''}
                  onChange={e => setPhysInput(p => ({ ...p, [s.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddPhysical(s.id) }}
                  placeholder="+ physical system"
                  aria-label="Add physical system"
                  className="text-[11px] bg-surface-input border border-border rounded px-1.5 py-0.5 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 w-36"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Catalog actions (side) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-body-md font-semibold text-text-primary">Catalog</h2>
        </div>
        <div className="bg-white rounded-lg border border-border shadow-card px-4 py-3 space-y-3">
          <p className="text-body-sm text-text-secondary">
            Seed the 19 standard platform categories with best-of-breed physical systems, then refine the physical assignments per logical system.
          </p>
          <Button variant="secondary" fullWidth onClick={handleSeed} loading={busy}>
            {busy ? 'Seeding…' : 'Seed standard systems'}
          </Button>
          {availableTemplates.length > 0 && (
            <div className="flex gap-2 pt-3 border-t border-border">
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as SystemType)}
                aria-label="Add logical system"
                className="flex-1 min-w-0 h-9 px-2 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none"
              >
                <option value="">Add a system category…</option>
                {availableTemplates.map(t => <option key={t.type} value={t.type}>{t.label} - {t.description}</option>)}
              </select>
              <Button variant="primary" onClick={handleAddSystem} disabled={busy || !newType}>Add</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
