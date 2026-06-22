'use client'

import { useEffect, useState, useCallback } from 'react'
import { listPersonas, createPersona, deletePersona } from '@/lib/supabase/capability-maps'
import {
  listProcessRoles, createProcessRole, deleteProcessRole,
  listPersonaRoleLinks, addPersonaRole, removePersonaRole,
} from '@/lib/supabase/process-models'
import { listWorkstreams, setEntityWorkstream } from '@/lib/supabase/workstreams'
import WorkstreamPicker from '@/components/workstream/WorkstreamPicker'
import type { Persona } from '@/lib/sipoc/types'
import type { ProcessRole, PersonaRoleLink } from '@/lib/process/types'
import type { Workstream } from '@/lib/workstream/types'

// Persona Catalog: Persona → Roles (many-to-many). A persona is made up of
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

  if (loading) return <div className="py-24 text-center text-sm text-[var(--m12-text-muted)]">Loading persona catalog…</div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Personas (main) */}
      <div className="lg:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[var(--m12-text)]">Personas</h2>
          <span className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">({personas.length})</span>
        </div>
        <div className="flex gap-2 mb-4">
          <input value={newPersona} onChange={e => setNewPersona(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddPersona() }} placeholder="New persona name…" aria-label="New persona" className="flex-1 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none focus:border-[#0EA5E9]/60" />
          <button onClick={handleAddPersona} disabled={busy || !newPersona.trim()} className="bg-[#0EA5E9] hover:bg-[#38BDF8] disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 transition-colors">Add</button>
        </div>
        <div className="space-y-2">
          {personas.length === 0 && <div className="text-xs text-[var(--m12-text-muted)] py-6 text-center border border-dashed border-[var(--m12-border)]/50 rounded-xl">No personas yet.</div>}
          {personas.map(p => {
            const assigned = rolesFor(p.id)
            const assignedIds = new Set(assigned.map(r => r.id))
            const available = roles.filter(r => !assignedIds.has(r.id))
            return (
              <div key={p.id} className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || '#6366F1' }} />
                  <span className="text-sm font-semibold text-[var(--m12-text)]">{p.name}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <WorkstreamPicker orgId={orgId} value={p.workstream_id} workstreams={workstreams} onChange={(wsId) => handleSetPersonaWorkstream(p.id, wsId)} className="w-48" />
                    <button onClick={() => handleDeletePersona(p.id)} title="Delete persona" className="text-[var(--m12-border)] hover:text-red-400">
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {assigned.length === 0 && <span className="text-[10px] text-[var(--m12-text-muted)]">No roles assigned.</span>}
                  {assigned.map(r => (
                    <span key={r.id} className="group inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border" style={{ color: r.color || '#0EA5E9', borderColor: `${r.color || '#0EA5E9'}55`, background: `${r.color || '#0EA5E9'}12` }}>
                      {r.name}
                      <button onClick={() => handleUnlink(p.id, r.id)} className="opacity-50 group-hover:opacity-100 hover:text-red-400">×</button>
                    </span>
                  ))}
                  {available.length > 0 && (
                    <select value="" onChange={e => handleLink(p.id, e.target.value)} aria-label="Assign role" className="text-[10px] bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded px-1.5 py-0.5 text-[var(--m12-text-muted)] focus:outline-none">
                      <option value="">+ role</option>
                      {available.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Roles library (side) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[var(--m12-text)]">Roles</h2>
          <span className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">({roles.length})</span>
        </div>
        <div className="flex gap-2 mb-4">
          <input value={newRole} onChange={e => setNewRole(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddRole() }} placeholder="New role name…" aria-label="New role" className="flex-1 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none focus:border-[#8B5CF6]/60" />
          <button onClick={handleAddRole} disabled={busy || !newRole.trim()} className="bg-[#8B5CF6] hover:bg-[#A78BFA] disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 transition-colors">Add</button>
        </div>
        <div className="space-y-1.5">
          {roles.length === 0 && <div className="text-xs text-[var(--m12-text-muted)] py-6 text-center border border-dashed border-[var(--m12-border)]/50 rounded-xl">No roles yet. Roles can be added to personas and used as swimlanes.</div>}
          {roles.map(r => (
            <div key={r.id} className="group flex items-center gap-2 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.color || '#8B5CF6' }} />
              <span className="text-xs text-[var(--m12-text)] flex-1 truncate">{r.name}</span>
              <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">{personaCountFor(r.id)} persona{personaCountFor(r.id) === 1 ? '' : 's'}</span>
              <button onClick={() => handleDeleteRole(r.id)} title="Delete role" className="text-[var(--m12-border)] hover:text-red-400">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
