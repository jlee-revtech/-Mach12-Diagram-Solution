'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Shield, Sparkles, Wand2 } from 'lucide-react'
import { Button, EmptyState, LoadingState } from '@/components/common'
import AgentChatPanel from '@/components/agents/AgentChatPanel'
import { listPersonas } from '@/lib/supabase/capability-maps'
import {
  listProcessRoles, createProcessRole, deleteProcessRole,
  listPersonaRoleLinks,
} from '@/lib/supabase/process-models'
import {
  listRoleAccess, listRoleMembers, updateSecurityRoleFields,
} from '@/lib/supabase/security-roles'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import type { ProcessRole, PersonaRoleLink } from '@/lib/process/types'
import type { Persona } from '@/lib/sipoc/types'
import type { RoleAccessItem, RoleMemberLink, SecurityRoleType } from '@/lib/security/types'
import type { Workstream } from '@/lib/workstream/types'
import RoleDetailPane, { ROLE_TYPE_STYLE } from './RoleDetailPane'
import AutoMapPanel from './AutoMapPanel'
import { normalizeSapRoleName, sapRoleNameError } from './sapRoleName'

const INPUT_CLASSES = 'h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none'

// Security Role Studio: design single/derived/composite Z*/Y* PFCG roles, hang
// SAP access (Fiori tiles, tcodes, programs, tables, auth objects) on them, tie
// personas to roles, and auto-determine persona→role assignments from the SAP
// access already captured on process-model steps.
export default function SecurityRoleStudio({ orgId, userId }: { orgId: string; userId?: string }) {
  const [roles, setRoles] = useState<ProcessRole[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [links, setLinks] = useState<PersonaRoleLink[]>([])
  const [access, setAccess] = useState<RoleAccessItem[]>([])
  const [members, setMembers] = useState<RoleMemberLink[]>([])
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [autoMapOpen, setAutoMapOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  // Create form
  const [newName, setNewName] = useState('')
  const [newSap, setNewSap] = useState('')
  const [newType, setNewType] = useState<SecurityRoleType>('single')
  const [newDesc, setNewDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const newSapErr = sapRoleNameError(newSap)

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null)
    try {
      const [r, p, l, a, m, w] = await Promise.all([
        listProcessRoles(orgId), listPersonas(orgId), listPersonaRoleLinks(orgId),
        listRoleAccess(orgId), listRoleMembers(orgId), listWorkstreams(orgId),
      ])
      setRoles(r); setPersonas(p); setLinks(l); setAccess(a); setMembers(m); setWorkstreams(w)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not reach the role catalog.')
    } finally {
      setLoading(false)
    }
  }, [orgId])
  useEffect(() => { load() }, [load])

  const selected = roles.find(r => r.id === selectedId) ?? null

  const accessCountFor = (roleId: string) => access.filter(a => a.role_id === roleId).length
  const personaCountFor = (roleId: string) => links.filter(l => l.role_id === roleId).length
  const memberCountFor = (roleId: string) => members.filter(m => m.composite_role_id === roleId).length

  const handleRoleChange = (id: string, patch: Partial<ProcessRole>) =>
    setRoles(x => x.map(r => (r.id === id ? { ...r, ...patch } : r)))

  const handleCreate = async () => {
    if (!newName.trim() || busy || !!newSapErr) return
    setBusy(true)
    try {
      const created = await createProcessRole(orgId, {
        name: newName.trim(),
        ...(newDesc.trim() ? { description: newDesc.trim() } : {}),
      })
      const sap = normalizeSapRoleName(newSap)
      // createProcessRole's payload is intentionally narrow; the security-role
      // fields land via a follow-up patch.
      if (sap || newType !== 'single') {
        await updateSecurityRoleFields(created.id, { sap_role_name: sap || null, role_type: newType }).catch(() => {})
      }
      const merged: ProcessRole = { ...created, sap_role_name: sap || null, role_type: newType }
      setRoles(x => [...x, merged].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedId(created.id)
      setNewName(''); setNewSap(''); setNewDesc(''); setNewType('single')
    } catch {
      load()
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteRole = async (id: string) => {
    if (!confirm('Delete this security role? Its access items, composite memberships, and persona links are removed.')) return
    setRoles(x => x.filter(r => r.id !== id))
    setAccess(x => x.filter(a => a.role_id !== id))
    setMembers(x => x.filter(m => m.composite_role_id !== id && m.member_role_id !== id))
    setLinks(x => x.filter(l => l.role_id !== id))
    if (selectedId === id) setSelectedId(null)
    await deleteProcessRole(id).catch(() => load())
  }

  // What the security-authorization agent sees about this page: the current
  // catalog plus which tools to reach for (modeled on deliverables/page.tsx).
  const pageContext = useMemo(() => {
    const roleList = roles.map(r => {
      const bits = [`id ${r.id}`]
      if (r.sap_role_name) bits.push(`SAP ${r.sap_role_name}`)
      bits.push(r.role_type ?? 'single')
      return `"${r.name}" (${bits.join(', ')})`
    }).join('; ')
    const personaList = personas.map(p => p.name).join(', ')
    return (
      `The user has the Security Role Studio (/process/security) open: SAP security-role design — single/derived/composite Z*/Y* PFCG roles, ` +
      `role access items (Fiori tiles, transactions, programs, tables, auth objects), composite membership, and persona→role assignments. ` +
      `Current security roles: ${roleList || '(none yet)'}. ` +
      `Current personas: ${personaList || '(none yet)'}. ` +
      `When the user asks to create or change security roles, access, or persona mappings, use the security tools ` +
      `(list_security_roles, get_security_role, create_security_role, update_security_role, add_role_access, remove_role_access, ` +
      `set_composite_members, link_persona_to_roles, unlink_persona_role, autodetermine_persona_roles).`
    )
  }, [roles, personas])

  if (loading) return <LoadingState label="Loading security roles..." />

  if (loadError) return (
    <div className="rounded-lg border border-status-red-border bg-status-red-bg px-4 py-6 text-center">
      <p className="text-body-sm text-text-primary font-semibold mb-1">Could not load the security role catalog</p>
      <p className="text-[11px] text-text-tertiary mb-4">{loadError}</p>
      <Button onClick={load}>Retry</Button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* ─── Toolbar ─── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="ai" size="sm" icon={<Wand2 size={14} />}
          onClick={() => setAutoMapOpen(v => !v)}
        >
          Auto-map personas
        </Button>
        <div className="ml-auto">
          <Button variant="ai" size="sm" icon={<Sparkles size={14} />} onClick={() => setChatOpen(true)}>
            Ask the security agent
          </Button>
        </div>
      </div>

      {autoMapOpen && (
        <AutoMapPanel
          orgId={orgId}
          roles={roles}
          personas={personas}
          links={links}
          access={access}
          onLinksRefreshed={setLinks}
          onClose={() => setAutoMapOpen(false)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,360px)_1fr] gap-4 items-start">
        {/* ─── Role catalog (left) ─── */}
        <aside className="space-y-3">
          <div className="bg-white rounded-lg border border-border shadow-card p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary">New security role</div>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Role name (e.g. AR Billing Clerk)"
              aria-label="New role name"
              className={`w-full ${INPUT_CLASSES}`}
            />
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <input
                  value={newSap}
                  onChange={e => setNewSap(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                  placeholder={newType === 'composite' ? 'SAP name, e.g. Z_C_AR_CLERK' : 'SAP name, e.g. Z_AR_CLERK'}
                  aria-label="New SAP role name"
                  className={`w-full ${INPUT_CLASSES} font-mono uppercase placeholder:normal-case ${newSapErr ? '!border-status-red focus:!ring-status-red/30' : ''}`}
                />
                {newSapErr && <span className="block mt-1 text-[10px] text-status-red">{newSapErr}</span>}
              </div>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as SecurityRoleType)}
                aria-label="New role type"
                className={`${INPUT_CLASSES} shrink-0`}
              >
                <option value="single">Single</option>
                <option value="derived">Derived</option>
                <option value="composite">Composite</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                placeholder="Description (optional)"
                aria-label="New role description"
                className={`flex-1 min-w-0 ${INPUT_CLASSES}`}
              />
              <Button onClick={handleCreate} disabled={busy || !newName.trim() || !!newSapErr}>Add</Button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-border shadow-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-muted/60">
              <span className="text-label uppercase text-text-secondary">Roles</span>
              <span className="text-[11px] text-text-tertiary tabular-nums">({roles.length})</span>
            </div>
            {roles.length === 0 ? (
              <div className="text-body-sm text-text-tertiary py-6 px-4 text-center">
                No security roles yet. Create one above, or ask the security agent.
              </div>
            ) : (
              <ul className="max-h-[65vh] overflow-y-auto">
                {roles.map(r => {
                  const t = (r.role_type ?? 'single') as SecurityRoleType
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        className={`w-full border-b border-border last:border-0 px-3 py-2.5 text-left transition-colors ${selected?.id === r.id ? 'bg-brand-50' : 'hover:bg-surface-muted/50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.color || '#8B5CF6' }} />
                          <span className="text-body-sm font-medium text-text-primary flex-1 truncate">{r.name}</span>
                          <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 shrink-0 ${ROLE_TYPE_STYLE[t]}`}>{t}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 pl-3.5">
                          {r.sap_role_name && (
                            <span className="text-[10px] font-mono text-text-secondary bg-surface-muted border border-border rounded px-1 py-0.5 truncate">{r.sap_role_name}</span>
                          )}
                          <span className="text-[10px] text-text-tertiary tabular-nums whitespace-nowrap ml-auto">
                            {accessCountFor(r.id)} access · {personaCountFor(r.id)} persona{personaCountFor(r.id) === 1 ? '' : 's'}
                            {t === 'composite' ? ` · ${memberCountFor(r.id)} member${memberCountFor(r.id) === 1 ? '' : 's'}` : ''}
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ─── Detail (right) ─── */}
        <section>
          {!selected ? (
            <EmptyState
              variant="dashed"
              icon={<Shield size={28} />}
              title="Select a security role"
              description="Pick a role from the catalog to edit its SAP role name, access items, composite members, and persona assignments — or create a new one."
            />
          ) : (
            <RoleDetailPane
              orgId={orgId}
              role={selected}
              roles={roles}
              personas={personas}
              links={links}
              access={access}
              members={members}
              onRoleChange={handleRoleChange}
              onDeleteRole={handleDeleteRole}
              setAccess={setAccess}
              setMembers={setMembers}
              setLinks={setLinks}
              reload={load}
            />
          )}
        </section>
      </div>

      {chatOpen && (
        <AgentChatPanel
          orgId={orgId}
          userId={userId}
          workstreams={workstreams}
          initialAgentCode="security-authorization"
          pageContext={pageContext}
          onClose={() => { setChatOpen(false); load() }}
        />
      )}
    </div>
  )
}
