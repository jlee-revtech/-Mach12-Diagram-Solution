import type { ResponsibleOrg } from '@/lib/capmap/types'

// ─── Responsible Org catalog ───────────────────────────
// The per-tenant list of BUSINESS organizations that own capabilities —
// Finance, Supply Chain, Program Management, and so on. Distinct from
// `organizations`, which is the tenant itself (RevTech, Codan).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw)?.access_token ?? null) : null
  } catch {
    return null
  }
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: ANON,
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/json',
  }
}

export async function listResponsibleOrgs(orgId: string, includeArchived = false): Promise<ResponsibleOrg[]> {
  const archived = includeArchived ? '' : '&archived_at=is.null'
  const res = await fetch(
    `${URL}/rest/v1/cm_responsible_orgs?organization_id=eq.${orgId}${archived}&select=*&order=sort_order.asc,name.asc`,
    { headers: headers() },
  )
  if (!res.ok) return []
  return res.json()
}

export async function createResponsibleOrg(
  orgId: string,
  userId: string,
  data: { name: string; code?: string | null; description?: string | null; color?: string | null; sort_order?: number },
): Promise<ResponsibleOrg> {
  const res = await fetch(`${URL}/rest/v1/cm_responsible_orgs`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, ...(userId ? { created_by: userId } : {}), ...data }),
  })
  const body = await res.json()
  if (!res.ok) {
    // The unique index is on lower(name), so a case-variant duplicate lands here.
    const msg = (body as { message?: string }).message || ''
    throw new Error(/duplicate key|uq_cm_resp_orgs_name/i.test(msg)
      ? `"${data.name}" is already in the catalog.`
      : msg || 'Failed to add the organization')
  }
  return Array.isArray(body) ? body[0] : body
}

export async function updateResponsibleOrg(
  id: string,
  updates: Partial<Pick<ResponsibleOrg, 'name' | 'code' | 'description' | 'color' | 'sort_order' | 'archived_at'>>,
): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/cm_responsible_orgs?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = (body as { message?: string }).message || ''
    throw new Error(/duplicate key|uq_cm_resp_orgs_name/i.test(msg)
      ? `"${updates.name}" is already in the catalog.`
      : msg || 'Failed to rename the organization')
  }
}

// Hard delete. The capability FK is ON DELETE SET NULL, so this un-assigns the
// org from its capabilities rather than taking the capabilities with it.
export async function deleteResponsibleOrg(id: string): Promise<void> {
  await fetch(`${URL}/rest/v1/cm_responsible_orgs?id=eq.${id}`, {
    method: 'DELETE',
    headers: { ...headers(), Prefer: 'return=minimal' },
  })
}

export const archiveResponsibleOrg = (id: string) =>
  updateResponsibleOrg(id, { archived_at: new Date().toISOString() })

export const restoreResponsibleOrg = (id: string) =>
  updateResponsibleOrg(id, { archived_at: null })

// Assign (or clear, with null) the owning organization for one capability.
export async function setCapabilityResponsibleOrg(capabilityId: string, responsibleOrgId: string | null): Promise<void> {
  await fetch(`${URL}/rest/v1/cm_capabilities?id=eq.${capabilityId}`, {
    method: 'PATCH',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify({ responsible_org_id: responsibleOrgId }),
  })
}

// Assign many at once — used by the board's bulk "set owner" action.
export async function setResponsibleOrgForMany(capabilityIds: string[], responsibleOrgId: string | null): Promise<void> {
  for (let i = 0; i < capabilityIds.length; i += 100) {
    const ids = capabilityIds.slice(i, i + 100).join(',')
    await fetch(`${URL}/rest/v1/cm_capabilities?id=in.(${ids})`, {
      method: 'PATCH',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify({ responsible_org_id: responsibleOrgId }),
    })
  }
}
