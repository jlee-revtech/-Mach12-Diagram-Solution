import type { Workstream, WorkstreamRollup, WorkstreamEntityType, WorkstreamAlignment } from '@/lib/workstream/types'
import { STANDARD_WORKSTREAMS } from '@/lib/workstream/catalog'

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

// ─── Workstreams CRUD ──────────────────────────────────

export async function listWorkstreams(orgId: string, includeArchived = false): Promise<Workstream[]> {
  const archiveFilter = includeArchived ? '' : '&archived_at=is.null'
  const res = await fetch(
    `${URL}/rest/v1/workstreams?organization_id=eq.${orgId}${archiveFilter}&select=*&order=sort_order.asc,name.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function getWorkstreamRollups(orgId: string): Promise<WorkstreamRollup[]> {
  const res = await fetch(
    `${URL}/rest/v1/workstream_rollup?organization_id=eq.${orgId}&select=*`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createWorkstream(
  orgId: string,
  userId: string,
  data: { code: string; name: string; description?: string; color?: string; icon?: string; sort_order?: number }
): Promise<Workstream> {
  const res = await fetch(`${URL}/rest/v1/workstreams`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, created_by: userId, ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create workstream')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateWorkstream(
  id: string,
  updates: Partial<Pick<Workstream, 'name' | 'description' | 'color' | 'icon' | 'sort_order' | 'archived_at'>>
): Promise<void> {
  await fetch(`${URL}/rest/v1/workstreams?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
}

export async function archiveWorkstream(id: string): Promise<void> {
  return updateWorkstream(id, { archived_at: new Date().toISOString() })
}

// Idempotently seed the 10 standard workstreams for an org. Uses PostgREST
// upsert with resolution=ignore-duplicates on (organization_id, code) so it
// never clobbers a stream the user already created or renamed.
export async function seedStandardWorkstreams(orgId: string, userId: string): Promise<Workstream[]> {
  const rows = STANDARD_WORKSTREAMS.map((w) => ({
    organization_id: orgId,
    created_by: userId,
    code: w.code,
    name: w.name,
    description: w.description,
    color: w.color,
    icon: w.icon,
    sort_order: w.sortOrder,
    is_standard: true,
  }))
  const res = await fetch(
    `${URL}/rest/v1/workstreams?on_conflict=organization_id,code`,
    {
      method: 'POST',
      headers: { ...headers(), 'Prefer': 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(rows),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to seed standard workstreams')
  }
  // Return the full current set (seeded inserts + pre-existing rows).
  return listWorkstreams(orgId)
}

// ─── Home workstream FK on a pillar entity ─────────────

const ENTITY_TABLE: Record<string, string> = {
  persona: 'personas',
  role: 'process_roles',
  data_element: 'system_data_elements',
  information_product: 'information_products',
  logical_system: 'logical_systems',
  process_model: 'process_models',
  process_node: 'process_nodes',
  capability: 'capabilities',
  capability_map: 'capability_maps',
  diagram: 'diagrams',
}

export type AlignableTable = keyof typeof ENTITY_TABLE

// Set (or clear, when workstreamId is null) the home workstream of one entity.
export async function setEntityWorkstream(
  entity: AlignableTable,
  id: string,
  workstreamId: string | null
): Promise<void> {
  const table = ENTITY_TABLE[entity]
  await fetch(`${URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ workstream_id: workstreamId }),
  })
}

// ─── Cross-workstream alignments (polymorphic) ─────────

export async function listAlignmentsForEntity(
  entityType: WorkstreamEntityType,
  entityId: string
): Promise<WorkstreamAlignment[]> {
  const res = await fetch(
    `${URL}/rest/v1/workstream_alignments?entity_type=eq.${entityType}&entity_id=eq.${entityId}&select=*`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function addAlignment(
  orgId: string,
  userId: string,
  workstreamId: string,
  entityType: WorkstreamEntityType,
  entityId: string
): Promise<void> {
  await fetch(`${URL}/rest/v1/workstream_alignments?on_conflict=workstream_id,entity_type,entity_id`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      organization_id: orgId,
      created_by: userId,
      workstream_id: workstreamId,
      entity_type: entityType,
      entity_id: entityId,
    }),
  })
}

export async function removeAlignment(
  workstreamId: string,
  entityType: WorkstreamEntityType,
  entityId: string
): Promise<void> {
  await fetch(
    `${URL}/rest/v1/workstream_alignments?workstream_id=eq.${workstreamId}&entity_type=eq.${entityType}&entity_id=eq.${entityId}`,
    { method: 'DELETE', headers: { ...headers(), 'Prefer': 'return=minimal' } }
  )
}
