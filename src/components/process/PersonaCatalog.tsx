'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Trash2, X, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { Button, LoadingState } from '@/components/common'
import { listPersonas, createPersona, deletePersona, updatePersona } from '@/lib/supabase/capability-maps'
import {
  listProcessRoles, createProcessRole, deleteProcessRole,
  listPersonaRoleLinks, addPersonaRole, removePersonaRole,
} from '@/lib/supabase/process-models'
import { listWorkstreams, setEntityWorkstream } from '@/lib/supabase/workstreams'
import { downloadPersonaCatalogXlsx, downloadPersonaCatalogCsv } from '@/lib/export/personaCatalogXlsx'
import WorkstreamPicker from '@/components/workstream/WorkstreamPicker'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'
import { CollapsibleSection } from '@/components/common'
import type { Persona, PersonaWorkstreamRole } from '@/lib/sipoc/types'
import type { ProcessRole, PersonaRoleLink } from '@/lib/process/types'
import type { Workstream } from '@/lib/workstream/types'

const INPUT_CLASSES = 'h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none'

// Primary = the persona executes/owns the value stream's work. Stakeholder =
// it receives the stream's data, governs it, or feeds it from another stream.
type RoleFilter = 'all' | PersonaWorkstreamRole | 'none'
const ROLE_STYLE: Record<PersonaWorkstreamRole | 'none', string> = {
  primary: 'bg-brand-50 text-brand-700 border-brand-200',
  stakeholder: 'bg-amber-50 text-amber-800 border-amber-200',
  none: 'bg-surface-muted text-text-tertiary border-dashed border-border',
}
const ROLE_LABEL: Record<PersonaWorkstreamRole | 'none', string> = {
  primary: 'Primary',
  stakeholder: 'Stakeholder / Receiver',
  none: 'Set type',
}

// Persona Catalog: Persona -> Roles (many-to-many). A persona is made up of
// multiple roles; a role can belong to multiple personas; and a role can be
// instantiated as a swimlane in a process model.
export default function PersonaCatalog({ orgId }: { orgId: string }) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [roles, setRoles] = useState<ProcessRole[]>([])
  const [links, setLinks] = useState<PersonaRoleLink[]>([])
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newPersona, setNewPersona] = useState('')
  const [newRole, setNewRole] = useState('')
  const [busy, setBusy] = useState(false)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null)
    try {
      const [p, r, l, w] = await Promise.all([listPersonas(orgId), listProcessRoles(orgId), listPersonaRoleLinks(orgId), listWorkstreams(orgId)])
      setPersonas(p); setRoles(r); setLinks(l); setWorkstreams(w)
    } catch (err) {
      // Without this the rejected Promise.all left `loading` true forever and
      // the page sat on the spinner with nothing to click.
      setLoadError(err instanceof Error ? err.message : 'Could not reach the catalog.')
    } finally {
      setLoading(false)
    }
  }, [orgId])
  useEffect(() => { load() }, [load])

  const handleSetPersonaWorkstream = async (personaId: string, wsId: string | null) => {
    setPersonas(x => x.map(p => p.id === personaId ? { ...p, workstream_id: wsId } : p))
    await setEntityWorkstream('persona', personaId, wsId).catch(() => load())
  }

  // Manual override of the primary / stakeholder determination. The stored note
  // is the basis for the *previous* call, so it is cleared rather than left to
  // contradict the new one.
  const handleSetPersonaRole = async (personaId: string, role: PersonaWorkstreamRole | null) => {
    setPersonas(x => x.map(p => p.id === personaId ? { ...p, workstream_role: role, workstream_role_note: null } : p))
    await updatePersona(personaId, { workstream_role: role, workstream_role_note: null }).catch(() => load())
  }

  const rolesFor = (personaId: string) =>
    links.filter(l => l.persona_id === personaId).map(l => roles.find(r => r.id === l.role_id)).filter((r): r is ProcessRole => !!r)
  const personaCountFor = (roleId: string) => links.filter(l => l.role_id === roleId).length

  const handleAddPersona = async () => {
    if (!newPersona.trim() || busy) return
    setBusy(true)
    try { const p = await createPersona(orgId, { name: newPersona.trim() }); setPersonas(x => [...x, p].sort((a, b) => a.name.localeCompare(b.name))); setNewPersona('') }
    finally { setBusy(false) }
  }
  const handleAddRole = async () => {
    if (!newRole.trim() || busy) return
    setBusy(true)
    try { const r = await createProcessRole(orgId, { name: newRole.trim() }); setRoles(x => [...x, r].sort((a, b) => a.name.localeCompare(b.name))); setNewRole('') }
    finally { setBusy(false) }
  }
  const handleDeletePersona = async (id: string) => {
    if (!confirm('Delete this persona? Its role assignments are removed (roles themselves are kept).')) return
    setPersonas(x => x.filter(p => p.id !== id)); setLinks(x => x.filter(l => l.persona_id !== id))
    await deletePersona(id).catch(() => load())
  }
  const handleDeleteRole = async (id: string) => {
    if (!confirm('Delete this role? It is removed from all personas and any lanes referencing it.')) return
    setRoles(x => x.filter(r => r.id !== id)); setLinks(x => x.filter(l => l.role_id !== id))
    await deleteProcessRole(id).catch(() => load())
  }
  const handleLink = async (personaId: string, roleId: string) => {
    if (!roleId) return
    const optimistic: PersonaRoleLink = { id: `tmp-${personaId}-${roleId}`, persona_id: personaId, role_id: roleId, created_at: '' }
    setLinks(x => [...x, optimistic])
    try { await addPersonaRole(personaId, roleId) } catch { load() }
  }
  const handleUnlink = async (personaId: string, roleId: string) => {
    setLinks(x => x.filter(l => !(l.persona_id === personaId && l.role_id === roleId)))
    await removePersonaRole(personaId, roleId).catch(() => load())
  }

  const renderPersona = (p: Persona) => {
    const assigned = rolesFor(p.id)
    const assignedIds = new Set(assigned.map(r => r.id))
    const available = roles.filter(r => !assignedIds.has(r.id))
    const kind: PersonaWorkstreamRole | 'none' = p.workstream_role ?? 'none'
    return (
      <div key={p.id} className="bg-white rounded-lg border border-border shadow-card px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || '#6366F1' }} />
          <span className="text-body-sm font-semibold text-text-primary">{p.name}</span>
          <select
            value={p.workstream_role ?? ''}
            onChange={e => handleSetPersonaRole(p.id, (e.target.value || null) as PersonaWorkstreamRole | null)}
            aria-label={`Persona type for ${p.name}`}
            title="Primary = runs the value stream's work. Stakeholder / Receiver = consumes its data, governs it, or feeds it from another stream."
            className={`shrink-0 text-[10px] uppercase tracking-wider font-medium rounded px-1.5 py-0.5 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${ROLE_STYLE[kind]}`}
          >
            <option value="">{ROLE_LABEL.none}</option>
            <option value="primary">{ROLE_LABEL.primary}</option>
            <option value="stakeholder">{ROLE_LABEL.stakeholder}</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <WorkstreamPicker orgId={orgId} value={p.workstream_id} workstreams={workstreams} onChange={(wsId) => handleSetPersonaWorkstream(p.id, wsId)} className="w-48" />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<Trash2 size={14} />}
              aria-label="Delete persona"
              title="Delete persona"
              onClick={() => handleDeletePersona(p.id)}
            />
          </div>
        </div>
        {p.workstream_role_note && (
          <p className="text-[11px] text-text-tertiary mb-2 leading-snug">{p.workstream_role_note}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Roles:</span>
          {assigned.length === 0 && <span className="text-[11px] text-text-tertiary">none</span>}
          {assigned.map(r => (
            <span key={r.id} title={r.sap_role_name ? `SAP role: ${r.sap_role_name}` : undefined} className="group inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border" style={{ color: r.color || '#2563EB', borderColor: `${r.color || '#2563EB'}55`, background: `${r.color || '#2563EB'}12` }}>
              {r.name}
              <button type="button" onClick={() => handleUnlink(p.id, r.id)} aria-label={`Remove ${r.name}`} className="opacity-50 group-hover:opacity-100 hover:text-status-red">
                <X size={10} />
              </button>
            </span>
          ))}
          {available.length > 0 && (
            <select value="" onChange={e => handleLink(p.id, e.target.value)} aria-label="Add to role" className="text-[10px] bg-surface-input border border-border rounded px-1.5 py-0.5 text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500/30">
              <option value="">+ role</option>
              {available.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
        </div>
      </div>
    )
  }

  // Group personas by value stream, ordered by workstream sort order, Unaligned last.
  // Primary personas sort ahead of stakeholders/receivers inside each stream.
  const wsById = new Map(workstreams.map(w => [w.id, w]))
  const matchesFilter = (p: Persona) =>
    roleFilter === 'all' ? true : roleFilter === 'none' ? !p.workstream_role : p.workstream_role === roleFilter
  const roleRank = (p: Persona) => (p.workstream_role === 'primary' ? 0 : p.workstream_role === 'stakeholder' ? 1 : 2)
  const byWs = new Map<string, Persona[]>()
  for (const p of personas) {
    if (!matchesFilter(p)) continue
    const key = p.workstream_id && wsById.has(p.workstream_id) ? p.workstream_id : '__none__'
    if (!byWs.has(key)) byWs.set(key, [])
    byWs.get(key)!.push(p)
  }
  for (const list of byWs.values()) list.sort((a, b) => roleRank(a) - roleRank(b) || a.name.localeCompare(b.name))
  const orderedWs = [...workstreams].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
  const personaGroups: { key: string; name: string; color: string; icon: string | null; list: Persona[] }[] = [
    ...orderedWs.filter(w => byWs.has(w.id)).map(w => ({ key: w.id, name: w.name, color: w.color || '#6366F1', icon: w.icon ?? null, list: byWs.get(w.id)! })),
    ...(byWs.get('__none__')?.length ? [{ key: '__none__', name: 'Unaligned', color: '#64748B', icon: null, list: byWs.get('__none__')! }] : []),
  ]
  const shownCount = personaGroups.reduce((n, g) => n + g.list.length, 0)
  const totals = {
    primary: personas.filter(p => p.workstream_role === 'primary').length,
    stakeholder: personas.filter(p => p.workstream_role === 'stakeholder').length,
    none: personas.filter(p => !p.workstream_role).length,
  }

  const handleExport = (fmt: 'xlsx' | 'csv') => {
    setExportOpen(false)
    const fn = fmt === 'xlsx' ? downloadPersonaCatalogXlsx : downloadPersonaCatalogCsv
    fn(personas, workstreams, roles, links, 'Persona Catalog')
  }

  if (loading) return <LoadingState label="Loading persona catalog..." />

  if (loadError) return (
    <div className="rounded-lg border border-status-red-border bg-status-red-bg px-4 py-6 text-center">
      <p className="text-body-sm text-text-primary font-semibold mb-1">Could not load the persona catalog</p>
      <p className="text-[11px] text-text-tertiary mb-4">{loadError}</p>
      <Button onClick={load}>Retry</Button>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Personas (main) — grouped by value stream */}
      <div className="lg:col-span-2">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-label uppercase text-text-secondary">Personas</h2>
          <span className="text-[11px] text-text-tertiary tabular-nums">
            ({roleFilter === 'all' ? personas.length : `${shownCount} of ${personas.length}`})
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border overflow-hidden" role="group" aria-label="Filter personas by type">
              {([
                ['all', `All ${personas.length}`],
                ['primary', `Primary ${totals.primary}`],
                ['stakeholder', `Stakeholders ${totals.stakeholder}`],
                ...(totals.none ? [['none', `Undetermined ${totals.none}`] as const] : []),
              ] as [RoleFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRoleFilter(key)}
                  aria-pressed={roleFilter === key}
                  className={`px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${roleFilter === key ? 'bg-brand-500 text-white' : 'bg-white text-text-secondary hover:bg-surface-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative" ref={exportRef}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Download size={12} />}
                onClick={() => setExportOpen(o => !o)}
                title="Download the full persona catalog grouped by value stream"
              >
                Download
              </Button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white rounded-lg shadow-dropdown border border-border py-1 animate-slide-in-up">
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-text-tertiary">All {personas.length} personas by value stream</div>
                  <ExportItem icon={<FileSpreadsheet size={14} />} desc="Personas + summary by value stream" onClick={() => handleExport('xlsx')}>Excel (.xlsx)</ExportItem>
                  <ExportItem icon={<FileText size={14} />} desc="Flat list, one row per persona" onClick={() => handleExport('csv')}>CSV (.csv)</ExportItem>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-text-tertiary mb-3">Personas are the swimlanes in process flows. Each one is typed against its value stream: <span className="text-brand-700 font-medium">Primary</span> runs the stream&apos;s work, <span className="text-amber-800 font-medium">Stakeholder / Receiver</span> consumes its data, governs it, or feeds it from another stream.</p>
        <div className="flex gap-2 mb-4">
          <input value={newPersona} onChange={e => setNewPersona(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddPersona() }} placeholder="New persona name..." aria-label="New persona" className={`flex-1 ${INPUT_CLASSES}`} />
          <Button onClick={handleAddPersona} disabled={busy || !newPersona.trim()}>Add</Button>
        </div>
        {personas.length === 0 ? (
          <div className="text-body-sm text-text-tertiary py-6 text-center rounded-lg border border-dashed border-border">No personas yet.</div>
        ) : shownCount === 0 ? (
          <div className="text-body-sm text-text-tertiary py-6 text-center rounded-lg border border-dashed border-border">No personas of this type.</div>
        ) : (
          <div className="space-y-3">
            {personaGroups.map(grp => (
              <CollapsibleSection
                key={grp.key}
                id={grp.key}
                storageKey="mach12-studio:persona-ws"
                tone="neutral"
                count={grp.list.length}
                title={
                  <span className="inline-flex items-center gap-2">
                    {grp.icon
                      ? <span className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${grp.color}1A`, color: grp.color }}><WorkstreamIcon icon={grp.icon} size={12} /></span>
                      : <span className="w-2 h-2 rounded-full bg-amber-500" />}
                    {grp.name}
                    <span className="text-[10px] font-normal text-text-tertiary tabular-nums">
                      {grp.list.filter(p => p.workstream_role === 'primary').length} primary
                      {' · '}
                      {grp.list.filter(p => p.workstream_role === 'stakeholder').length} stakeholder
                    </span>
                  </span>
                }
              >
                <div className="space-y-2">
                  {grp.list.map(renderPersona)}
                </div>
              </CollapsibleSection>
            ))}
          </div>
        )}
      </div>

      {/* Roles library (side) — a role combines one or more personas */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-label uppercase text-text-secondary">Roles</h2>
          <span className="text-[11px] text-text-tertiary tabular-nums">({roles.length})</span>
        </div>
        <p className="text-[11px] text-text-tertiary mb-3">A role is a combination of personas. Assign personas to a role from each persona card.</p>
        <div className="flex gap-2 mb-4">
          <input value={newRole} onChange={e => setNewRole(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddRole() }} placeholder="New role name..." aria-label="New role" className={`flex-1 min-w-0 ${INPUT_CLASSES}`} />
          <Button onClick={handleAddRole} disabled={busy || !newRole.trim()}>Add</Button>
        </div>
        <div className="space-y-1.5">
          {roles.length === 0 && (
            <div className="text-body-sm text-text-tertiary py-6 text-center rounded-lg border border-dashed border-border">No roles yet. Roles can be added to personas and used as swimlanes.</div>
          )}
          {roles.map(r => (
            <div key={r.id} className="group flex items-center gap-2 bg-white rounded-lg border border-border shadow-card px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.color || '#8B5CF6' }} />
              <span className="text-body-sm text-text-primary flex-1 truncate">{r.name}</span>
              <span className="text-[10px] text-text-tertiary tabular-nums">{personaCountFor(r.id)} persona{personaCountFor(r.id) === 1 ? '' : 's'}</span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={<Trash2 size={14} />}
                aria-label="Delete role"
                title="Delete role"
                onClick={() => handleDeleteRole(r.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ExportItem({ children, desc, icon, onClick }: { children: React.ReactNode; desc?: string; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-start gap-2 text-left px-3 py-1.5 hover:bg-surface-muted transition-colors">
      {icon && <span className="inline-flex shrink-0 text-text-tertiary mt-0.5">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-body-sm text-text-primary">{children}</span>
        {desc && <span className="block text-[10px] text-text-tertiary">{desc}</span>}
      </span>
    </button>
  )
}
