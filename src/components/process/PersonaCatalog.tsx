'use client'

import { useEffect, useState, useCallback } from 'react'
import { Trash2, X } from 'lucide-react'
import { Button, LoadingState } from '@/components/common'
import { listPersonas, createPersona, deletePersona } from '@/lib/supabase/capability-maps'
import {
  listProcessRoles, createProcessRole, deleteProcessRole,
  listPersonaRoleLinks, addPersonaRole, removePersonaRole,
} from '@/lib/supabase/process-models'
import { listWorkstreams, setEntityWorkstream } from '@/lib/supabase/workstreams'
import WorkstreamPicker from '@/components/workstream/WorkstreamPicker'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'
import { CollapsibleSection } from '@/components/common'
import type { Persona } from '@/lib/sipoc/types'
import type { ProcessRole, PersonaRoleLink } from '@/lib/process/types'
import type { Workstream } from '@/lib/workstream/types'

const INPUT_CLASSES = 'h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none'

// Persona Catalog: Persona -> Roles (many-to-many). A persona is made up of
// multiple roles; a role can belong to multiple personas; and a role can be
// instantiated as a swimlane in a process model.
export default function PersonaCatalog({ orgId }: { orgId: string }) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [roles, setRoles] = useState<ProcessRole[]>([])
  const [links, setLinks] = useState<PersonaRoleLink[]>([])
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [loading, setLoading] = useState(true)
  const [newPersona, setNewPersona] = useState('')
  const [newRole, setNewRole] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [p, r, l, w] = await Promise.all([listPersonas(orgId), listProcessRoles(orgId), listPersonaRoleLinks(orgId), listWorkstreams(orgId)])
    setPersonas(p); setRoles(r); setLinks(l); setWorkstreams(w); setLoading(false)
  }, [orgId])
  useEffect(() => { load() }, [load])

  const handleSetPersonaWorkstream = async (personaId: string, wsId: string | null) => {
    setPersonas(x => x.map(p => p.id === personaId ? { ...p, workstream_id: wsId } : p))
    await setEntityWorkstream('persona', personaId, wsId).catch(() => load())
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
    return (
      <div key={p.id} className="bg-white rounded-lg border border-border shadow-card px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || '#6366F1' }} />
          <span className="text-body-sm font-semibold text-text-primary">{p.name}</span>
          <span className="text-[9px] uppercase tracking-wider font-mono text-status-green bg-status-green-bg rounded px-1 py-0.5 shrink-0" title="Personas are swimlanes in process flows">Swimlane</span>
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
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Roles:</span>
          {assigned.length === 0 && <span className="text-[11px] text-text-tertiary">none</span>}
          {assigned.map(r => (
            <span key={r.id} className="group inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border" style={{ color: r.color || '#2563EB', borderColor: `${r.color || '#2563EB'}55`, background: `${r.color || '#2563EB'}12` }}>
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
  const wsById = new Map(workstreams.map(w => [w.id, w]))
  const byWs = new Map<string, Persona[]>()
  for (const p of personas) {
    const key = p.workstream_id && wsById.has(p.workstream_id) ? p.workstream_id : '__none__'
    if (!byWs.has(key)) byWs.set(key, [])
    byWs.get(key)!.push(p)
  }
  const orderedWs = [...workstreams].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
  const personaGroups: { key: string; name: string; color: string; icon: string | null; list: Persona[] }[] = [
    ...orderedWs.filter(w => byWs.has(w.id)).map(w => ({ key: w.id, name: w.name, color: w.color || '#6366F1', icon: w.icon ?? null, list: byWs.get(w.id)! })),
    ...(byWs.get('__none__')?.length ? [{ key: '__none__', name: 'Unaligned', color: '#64748B', icon: null, list: byWs.get('__none__')! }] : []),
  ]

  if (loading) return <LoadingState label="Loading persona catalog..." />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Personas (main) — grouped by value stream */}
      <div className="lg:col-span-2">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-label uppercase text-text-secondary">Personas</h2>
          <span className="text-[11px] text-text-tertiary tabular-nums">({personas.length})</span>
        </div>
        <p className="text-[11px] text-text-tertiary mb-3">Personas are the swimlanes in process flows. Combine personas into roles for a higher-level grouping.</p>
        <div className="flex gap-2 mb-4">
          <input value={newPersona} onChange={e => setNewPersona(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddPersona() }} placeholder="New persona name..." aria-label="New persona" className={`flex-1 ${INPUT_CLASSES}`} />
          <Button onClick={handleAddPersona} disabled={busy || !newPersona.trim()}>Add</Button>
        </div>
        {personas.length === 0 ? (
          <div className="text-body-sm text-text-tertiary py-6 text-center rounded-lg border border-dashed border-border">No personas yet.</div>
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
