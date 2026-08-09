'use client'

import { useEffect, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { Button, CollapsibleSection } from '@/components/common'
import FioriTilePicker from '@/components/process/FioriTilePicker'
import { updateProcessRole, addPersonaRole, removePersonaRole } from '@/lib/supabase/process-models'
import {
  updateSecurityRoleFields,
  addRoleAccess, removeRoleAccess,
  addRoleMember, removeRoleMember,
} from '@/lib/supabase/security-roles'
import type { ProcessRole, PersonaRoleLink } from '@/lib/process/types'
import type { Persona } from '@/lib/sipoc/types'
import type { RoleAccessItem, RoleAccessType, RoleMemberLink, SecurityRoleType } from '@/lib/security/types'
import { normalizeSapRoleName, sapRoleNameError } from './sapRoleName'

const INPUT_CLASSES = 'w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none'
const CHIP_SELECT_CLASSES = 'text-[10px] bg-surface-input border border-border rounded px-1.5 py-0.5 text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500/30'

const ACCESS_GROUPS: { type: RoleAccessType; label: string; placeholder: string }[] = [
  { type: 'fiori_tile', label: 'Fiori tiles', placeholder: '' },
  { type: 'transaction', label: 'Transactions', placeholder: 'e.g. VA01' },
  { type: 'program', label: 'Programs', placeholder: 'e.g. RFITEMAR' },
  { type: 'table', label: 'Tables', placeholder: 'e.g. VBAK' },
  { type: 'auth_object', label: 'Auth objects', placeholder: 'e.g. V_VBAK_VKO' },
]

export const ROLE_TYPE_STYLE: Record<string, string> = {
  single: 'bg-slate-100 text-slate-600',
  derived: 'bg-status-blue-bg text-status-blue',
  composite: 'bg-purple-50 text-purple-700',
}

interface Props {
  orgId: string
  role: ProcessRole
  roles: ProcessRole[]
  personas: Persona[]
  links: PersonaRoleLink[]
  access: RoleAccessItem[]
  members: RoleMemberLink[]
  onRoleChange: (id: string, patch: Partial<ProcessRole>) => void
  onDeleteRole: (id: string) => void
  setAccess: React.Dispatch<React.SetStateAction<RoleAccessItem[]>>
  setMembers: React.Dispatch<React.SetStateAction<RoleMemberLink[]>>
  setLinks: React.Dispatch<React.SetStateAction<PersonaRoleLink[]>>
  reload: () => void
}

// Detail editor for one security role: SAP fields, access items grouped by
// access_type, composite membership, and linked-persona chips. Optimistic
// updates with `.catch(() => reload())`, mirroring PersonaCatalog.
export default function RoleDetailPane({
  orgId, role, roles, personas, links, access, members,
  onRoleChange, onDeleteRole, setAccess, setMembers, setLinks, reload,
}: Props) {
  const roleType: SecurityRoleType = (role.role_type ?? 'single') as SecurityRoleType

  const [draft, setDraft] = useState({
    name: role.name,
    description: role.description ?? '',
    sap: role.sap_role_name ?? '',
    derivedFrom: role.derived_from ?? '',
    orgLevels: role.org_levels ?? '',
  })
  const [sapErr, setSapErr] = useState<string | null>(null)
  const [accessDrafts, setAccessDrafts] = useState<Partial<Record<RoleAccessType, string>>>({})

  useEffect(() => {
    setDraft({
      name: role.name,
      description: role.description ?? '',
      sap: role.sap_role_name ?? '',
      derivedFrom: role.derived_from ?? '',
      orgLevels: role.org_levels ?? '',
    })
    setSapErr(null)
    setAccessDrafts({})
    // Reset drafts when switching roles only — not on every optimistic patch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role.id])

  const roleAccess = access.filter(a => a.role_id === role.id)
  const memberLinks = members.filter(m => m.composite_role_id === role.id)
  const linkedPersonaIds = new Set(links.filter(l => l.role_id === role.id).map(l => l.persona_id))

  // ─── Field commits ───────────────────────────────────

  const commitName = async () => {
    const v = draft.name.trim()
    if (!v || v === role.name) { setDraft(d => ({ ...d, name: role.name })); return }
    onRoleChange(role.id, { name: v })
    await updateProcessRole(role.id, { name: v }).catch(() => reload())
  }

  const commitDescription = async () => {
    const v = draft.description.trim()
    if (v === (role.description ?? '')) return
    onRoleChange(role.id, { description: v || null })
    await updateProcessRole(role.id, { description: v || null }).catch(() => reload())
  }

  const commitSap = async () => {
    const err = sapRoleNameError(draft.sap)
    setSapErr(err)
    if (err) return
    const norm = normalizeSapRoleName(draft.sap)
    setDraft(d => ({ ...d, sap: norm }))
    if (norm === (role.sap_role_name ?? '')) return
    onRoleChange(role.id, { sap_role_name: norm || null })
    await updateSecurityRoleFields(role.id, { sap_role_name: norm || null }).catch(() => reload())
  }

  const commitDerivedFrom = async () => {
    const norm = draft.derivedFrom.trim().toUpperCase()
    setDraft(d => ({ ...d, derivedFrom: norm }))
    if (norm === (role.derived_from ?? '')) return
    onRoleChange(role.id, { derived_from: norm || null })
    await updateSecurityRoleFields(role.id, { derived_from: norm || null }).catch(() => reload())
  }

  const commitOrgLevels = async () => {
    const v = draft.orgLevels.trim()
    if (v === (role.org_levels ?? '')) return
    onRoleChange(role.id, { org_levels: v || null })
    await updateSecurityRoleFields(role.id, { org_levels: v || null }).catch(() => reload())
  }

  const handleTypeChange = async (t: SecurityRoleType) => {
    onRoleChange(role.id, { role_type: t })
    await updateSecurityRoleFields(role.id, { role_type: t }).catch(() => reload())
  }

  // ─── Access items ────────────────────────────────────

  const handleAddAccess = async (type: RoleAccessType, rawValue: string, title?: string, fioriAppId?: string) => {
    // Tcodes/programs/tables/auth objects are uppercase in SAP; tile ids keep their catalog casing.
    const value = type === 'fiori_tile' ? rawValue.trim() : rawValue.trim().toUpperCase()
    if (!value) return
    if (roleAccess.some(a => a.access_type === type && a.value === value)) return
    const tmpId = `tmp-${role.id}-${type}-${value}`
    const optimistic: RoleAccessItem = {
      id: tmpId, organization_id: orgId, role_id: role.id, access_type: type, value,
      title: title ?? null, fiori_app_id: fioriAppId ?? null, source: 'manual', note: null, created_at: '',
    }
    setAccess(x => [...x, optimistic])
    try {
      const saved = await addRoleAccess(orgId, role.id, {
        access_type: type, value,
        ...(title ? { title } : {}),
        ...(fioriAppId ? { fiori_app_id: fioriAppId } : {}),
      })
      setAccess(x => x.map(a => (a.id === tmpId ? saved : a)))
    } catch {
      reload()
    }
  }

  const handleRemoveAccess = async (item: RoleAccessItem) => {
    if (item.id.startsWith('tmp-')) { reload(); return }
    setAccess(x => x.filter(a => a.id !== item.id))
    await removeRoleAccess(item.id).catch(() => reload())
  }

  const submitAccessDraft = (type: RoleAccessType) => {
    const raw = accessDrafts[type] ?? ''
    if (!raw.trim()) return
    setAccessDrafts(d => ({ ...d, [type]: '' }))
    handleAddAccess(type, raw)
  }

  // ─── Composite members ───────────────────────────────

  const memberCandidates = roles.filter(r =>
    r.id !== role.id &&
    (r.role_type ?? 'single') === 'single' &&
    !memberLinks.some(m => m.member_role_id === r.id)
  )

  const handleAddMember = async (memberRoleId: string) => {
    if (!memberRoleId) return
    const optimistic: RoleMemberLink = { id: `tmp-${role.id}-${memberRoleId}`, composite_role_id: role.id, member_role_id: memberRoleId, created_at: '' }
    setMembers(x => [...x, optimistic])
    try { await addRoleMember(role.id, memberRoleId) } catch { reload() }
  }

  const handleRemoveMember = async (memberRoleId: string) => {
    setMembers(x => x.filter(m => !(m.composite_role_id === role.id && m.member_role_id === memberRoleId)))
    await removeRoleMember(role.id, memberRoleId).catch(() => reload())
  }

  // ─── Persona links ───────────────────────────────────

  const handleLinkPersona = async (personaId: string) => {
    if (!personaId) return
    const optimistic: PersonaRoleLink = { id: `tmp-${personaId}-${role.id}`, persona_id: personaId, role_id: role.id, created_at: '' }
    setLinks(x => [...x, optimistic])
    try { await addPersonaRole(personaId, role.id) } catch { reload() }
  }

  const handleUnlinkPersona = async (personaId: string) => {
    setLinks(x => x.filter(l => !(l.persona_id === personaId && l.role_id === role.id)))
    await removePersonaRole(personaId, role.id).catch(() => reload())
  }

  // ─── Render ──────────────────────────────────────────

  const renderAccessGroup = (grp: { type: RoleAccessType; label: string; placeholder: string }) => {
    const items = roleAccess.filter(a => a.access_type === grp.type)
    return (
      <div key={grp.type}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">{grp.label}</span>
          <span className="text-[10px] text-text-tertiary tabular-nums">({items.length})</span>
        </div>
        {items.length > 0 && (
          <ul className="space-y-1 mb-1.5">
            {items.map(a => (
              <li key={a.id} className="group flex items-center gap-1.5 bg-surface-muted/60 border border-border rounded px-2 py-1">
                <span className="text-[11px] font-mono text-text-primary shrink-0">{a.value}</span>
                {a.title && <span className="text-[11px] text-text-secondary truncate" title={a.title}>{a.title}</span>}
                {a.fiori_app_id && <span className="text-[10px] font-mono text-text-tertiary shrink-0">({a.fiori_app_id})</span>}
                {a.source === 'ai' && (
                  <span className="text-[9px] uppercase font-bold tracking-wider text-purple-700 bg-purple-50 rounded px-1 py-0.5 shrink-0" title={a.note || 'Added by AI auto-determination'}>AI</span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveAccess(a)}
                  aria-label={`Remove ${a.value}`}
                  className="ml-auto opacity-50 group-hover:opacity-100 text-text-tertiary hover:text-status-red transition-opacity shrink-0"
                >
                  <X size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {grp.type === 'fiori_tile' ? (
          <FioriTilePicker
            value={undefined}
            onChange={t => { if (t) handleAddAccess('fiori_tile', t.id, t.title, t.appId) }}
          />
        ) : (
          <div className="flex gap-1.5">
            <input
              value={accessDrafts[grp.type] ?? ''}
              onChange={e => setAccessDrafts(d => ({ ...d, [grp.type]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') submitAccessDraft(grp.type) }}
              placeholder={grp.placeholder}
              aria-label={`Add ${grp.label}`}
              className={`flex-1 min-w-0 h-8 px-2.5 rounded-lg border border-border bg-surface-input text-[11px] font-mono uppercase placeholder:normal-case placeholder:font-sans focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none`}
            />
            <Button variant="secondary" size="sm" disabled={!(accessDrafts[grp.type] ?? '').trim()} onClick={() => submitAccessDraft(grp.type)}>Add</Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ─── Role fields ─── */}
      <div className="bg-white rounded-lg border border-border shadow-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: role.color || '#8B5CF6' }} />
          <input
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            aria-label="Role name"
            className="flex-1 min-w-0 text-body-md font-semibold text-text-primary bg-transparent border-b border-transparent hover:border-border focus:border-brand-500 focus:outline-none"
          />
          <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 shrink-0 ${ROLE_TYPE_STYLE[roleType]}`}>{roleType}</span>
          <Button
            variant="ghost" size="sm" iconOnly icon={<Trash2 size={14} />}
            aria-label="Delete role" title="Delete role"
            onClick={() => onDeleteRole(role.id)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">SAP role name (Z*/Y*)</span>
            <input
              value={draft.sap}
              onChange={e => { setDraft(d => ({ ...d, sap: e.target.value })); setSapErr(sapRoleNameError(e.target.value)) }}
              onBlur={commitSap}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              placeholder={roleType === 'composite' ? 'Z_C_...' : 'Z_...'}
              className={`${INPUT_CLASSES} font-mono uppercase placeholder:normal-case ${sapErr ? '!border-status-red focus:!ring-status-red/30' : ''}`}
            />
            {sapErr && <span className="block mt-1 text-[10px] text-status-red">{sapErr}</span>}
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Role type</span>
            <select
              value={roleType}
              onChange={e => handleTypeChange(e.target.value as SecurityRoleType)}
              className={INPUT_CLASSES}
            >
              <option value="single">Single</option>
              <option value="derived">Derived</option>
              <option value="composite">Composite</option>
            </select>
          </label>
          {roleType === 'derived' && (
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Derived from (master role)</span>
              <input
                value={draft.derivedFrom}
                onChange={e => setDraft(d => ({ ...d, derivedFrom: e.target.value }))}
                onBlur={commitDerivedFrom}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                placeholder="Z_..."
                className={`${INPUT_CLASSES} font-mono uppercase placeholder:normal-case`}
              />
            </label>
          )}
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Org levels</span>
            <input
              value={draft.orgLevels}
              onChange={e => setDraft(d => ({ ...d, orgLevels: e.target.value }))}
              onBlur={commitOrgLevels}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              placeholder="e.g. company code 1000, plant 2100"
              className={INPUT_CLASSES}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Description</span>
            <input
              value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              onBlur={commitDescription}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              placeholder="What this role authorizes..."
              className={INPUT_CLASSES}
            />
          </label>
        </div>
      </div>

      {/* ─── SAP access ─── */}
      <CollapsibleSection
        id="sec-access"
        storageKey="mach12-studio:sec-detail"
        tone="neutral"
        title="SAP access"
        count={roleAccess.length}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ACCESS_GROUPS.map(renderAccessGroup)}
        </div>
      </CollapsibleSection>

      {/* ─── Composite members ─── */}
      {roleType === 'composite' && (
        <CollapsibleSection
          id="sec-members"
          storageKey="mach12-studio:sec-detail"
          tone="purple"
          title="Composite members"
          count={memberLinks.length}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {memberLinks.length === 0 && <span className="text-[11px] text-text-tertiary">No member roles yet. A composite role bundles single roles.</span>}
            {memberLinks.map(m => {
              const member = roles.find(r => r.id === m.member_role_id)
              if (!member) return null
              return (
                <span key={m.id} className="group inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border" style={{ color: member.color || '#2563EB', borderColor: `${member.color || '#2563EB'}55`, background: `${member.color || '#2563EB'}12` }} title={member.sap_role_name ? `SAP ${member.sap_role_name}` : undefined}>
                  {member.name}
                  {member.sap_role_name && <span className="font-mono opacity-70">{member.sap_role_name}</span>}
                  <button type="button" onClick={() => handleRemoveMember(member.id)} aria-label={`Remove ${member.name}`} className="opacity-50 group-hover:opacity-100 hover:text-status-red">
                    <X size={10} />
                  </button>
                </span>
              )
            })}
            {memberCandidates.length > 0 && (
              <select value="" onChange={e => handleAddMember(e.target.value)} aria-label="Add member role" className={CHIP_SELECT_CLASSES}>
                <option value="">+ single role</option>
                {memberCandidates.map(r => <option key={r.id} value={r.id}>{r.name}{r.sap_role_name ? ` (${r.sap_role_name})` : ''}</option>)}
              </select>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* ─── Linked personas ─── */}
      <CollapsibleSection
        id="sec-personas"
        storageKey="mach12-studio:sec-detail"
        tone="neutral"
        title="Linked personas"
        count={linkedPersonaIds.size}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {linkedPersonaIds.size === 0 && <span className="text-[11px] text-text-tertiary">No personas yet. Link them here, or run Auto-map personas.</span>}
          {links.filter(l => l.role_id === role.id).map(l => {
            const p = personas.find(x => x.id === l.persona_id)
            if (!p) return null
            const aiTitle = l.source === 'ai'
              ? `AI-assigned${typeof l.confidence === 'number' ? ` (${Math.round(l.confidence * 100)}% coverage)` : ''}${l.rationale ? ` — ${l.rationale}` : ''}`
              : undefined
            return (
              <span key={l.id} className="group inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border" style={{ color: p.color || '#6366F1', borderColor: `${p.color || '#6366F1'}55`, background: `${p.color || '#6366F1'}12` }} title={aiTitle}>
                {p.name}
                {l.source === 'ai' && <span className="text-[9px] uppercase font-bold tracking-wider opacity-80">AI</span>}
                <button type="button" onClick={() => handleUnlinkPersona(p.id)} aria-label={`Unlink ${p.name}`} className="opacity-50 group-hover:opacity-100 hover:text-status-red">
                  <X size={10} />
                </button>
              </span>
            )
          })}
          {personas.filter(p => !linkedPersonaIds.has(p.id)).length > 0 && (
            <select value="" onChange={e => handleLinkPersona(e.target.value)} aria-label="Link persona" className={CHIP_SELECT_CLASSES}>
              <option value="">+ persona</option>
              {personas.filter(p => !linkedPersonaIds.has(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      </CollapsibleSection>
    </div>
  )
}
