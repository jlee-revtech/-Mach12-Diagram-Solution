// ─── Security role design: access items, composite members, link provenance ─
// Browser CRUD for the 059 security-role-design layer on process_roles.
// Same fetch conventions as process-models.ts (sbFetch + localStorage token).

import type { ProcessRole, PersonaRoleLink } from '@/lib/process/types'
import type { RoleAccessItem, RoleAccessType, RoleMemberLink } from '@/lib/security/types'

import { sbFetch } from './fetch'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.access_token ?? null
  } catch {
    return null
  }
}

function headers(): Record<string, string> {
  const t = getToken()
  return {
    'Content-Type': 'application/json',
    'apikey': ANON,
    'Authorization': `Bearer ${t}`,
    'Accept': 'application/json',
  }
}

// PostgREST caps GETs at db-max-rows (1000 on Supabase) — page via Range.
async function fetchAllPaginated<T>(url: string, hdrs: Record<string, string>, pageSize = 1000): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const to = from + pageSize - 1
    const res = await sbFetch(url, {
      headers: { ...hdrs, 'Range-Unit': 'items', 'Range': `${from}-${to}` },
    })
    if (!res.ok) {
      if (res.status === 416) break
      return all
    }
    const chunk = (await res.json()) as T[]
    all.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }
  return all
}

// ─── Role access items (process_role_access) ───────────

export async function listRoleAccess(orgId: string): Promise<RoleAccessItem[]> {
  return fetchAllPaginated<RoleAccessItem>(
    `${URL}/rest/v1/process_role_access?organization_id=eq.${orgId}&select=*&order=access_type.asc,value.asc`,
    headers()
  )
}

export async function addRoleAccess(
  orgId: string,
  roleId: string,
  item: { access_type: RoleAccessType; value: string; title?: string | null; fiori_app_id?: string | null; note?: string | null; source?: 'manual' | 'ai' },
): Promise<RoleAccessItem> {
  // Upsert on (role_id, access_type, value) so re-adding refreshes title/note.
  const res = await sbFetch(`${URL}/rest/v1/process_role_access?on_conflict=role_id,access_type,value`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({ organization_id: orgId, role_id: roleId, ...item }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to add role access')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function removeRoleAccess(id: string): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/process_role_access?id=eq.${id}`, { method: 'DELETE', headers: headers() })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to remove role access') }
}

// ─── Composite membership (process_role_members) ───────

export async function listRoleMembers(orgId: string): Promise<RoleMemberLink[]> {
  // The join table carries no organization_id — scope via the composite role's org.
  const res = await sbFetch(
    `${URL}/rest/v1/process_role_members?select=*,composite:process_roles!process_role_members_composite_role_id_fkey!inner(organization_id)&composite.organization_id=eq.${orgId}`,
    { headers: headers() }
  )
  if (!res.ok) return []
  const rows = await res.json()
  return rows.map((r: { id: string; composite_role_id: string; member_role_id: string; created_at: string }) => ({
    id: r.id, composite_role_id: r.composite_role_id, member_role_id: r.member_role_id, created_at: r.created_at,
  }))
}

export async function addRoleMember(compositeRoleId: string, memberRoleId: string): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/process_role_members`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({ composite_role_id: compositeRoleId, member_role_id: memberRoleId }),
  })
  if (!res.ok && res.status !== 409) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to add member role') }
}

export async function removeRoleMember(compositeRoleId: string, memberRoleId: string): Promise<void> {
  const res = await sbFetch(
    `${URL}/rest/v1/process_role_members?composite_role_id=eq.${compositeRoleId}&member_role_id=eq.${memberRoleId}`,
    { method: 'DELETE', headers: headers() }
  )
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to remove member role') }
}

// ─── Security fields on process_roles ──────────────────

export async function updateSecurityRoleFields(
  roleId: string,
  fields: Partial<Pick<ProcessRole, 'name' | 'description' | 'color' | 'sap_role_name' | 'role_type' | 'derived_from' | 'org_levels'>>,
): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/process_roles?id=eq.${roleId}`, {
    method: 'PATCH', headers: { ...headers(), 'Prefer': 'return=minimal' }, body: JSON.stringify(fields),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to update role') }
}

// ─── AI provenance on persona ↔ role links ─────────────

export async function updatePersonaRoleLink(
  linkId: string,
  fields: Partial<Pick<PersonaRoleLink, 'source' | 'confidence' | 'rationale'>>,
): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/persona_roles?id=eq.${linkId}`, {
    method: 'PATCH', headers: { ...headers(), 'Prefer': 'return=minimal' }, body: JSON.stringify(fields),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to update persona-role link') }
}
