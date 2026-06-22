import type { SystemType } from '@/lib/diagram/types'
import { SYSTEM_TEMPLATES } from '@/lib/diagram/types'
import {
  DEFAULT_PHYSICAL_SYSTEMS,
  type BedrockSystem,
  type BedrockPhysicalSystem,
  type BedrockSystemWithPhysicals,
} from '@/lib/bedrock/types'

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

// ─── Logical Bedrock Systems ───────────────────────────

export async function listBedrockSystems(orgId: string, includeArchived = false): Promise<BedrockSystem[]> {
  const archiveFilter = includeArchived ? '' : '&archived_at=is.null'
  const res = await fetch(
    `${URL}/rest/v1/bedrock_systems?organization_id=eq.${orgId}${archiveFilter}&select=*&order=sort_order.asc,label.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function listBedrockPhysicalSystems(orgId: string): Promise<BedrockPhysicalSystem[]> {
  // Fetch all physical systems for the org via the parent FK (one round-trip).
  const res = await fetch(
    `${URL}/rest/v1/bedrock_physical_systems?select=*,bedrock_systems!inner(organization_id)&bedrock_systems.organization_id=eq.${orgId}&order=sort_order.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  const rows = await res.json()
  // Strip the embedded parent before returning.
  return (rows as (BedrockPhysicalSystem & { bedrock_systems?: unknown })[]).map(({ bedrock_systems, ...rest }) => rest)
}

export async function listBedrockCatalog(orgId: string): Promise<BedrockSystemWithPhysicals[]> {
  const [systems, physicals] = await Promise.all([
    listBedrockSystems(orgId),
    listBedrockPhysicalSystems(orgId),
  ])
  const byParent = new Map<string, BedrockPhysicalSystem[]>()
  for (const p of physicals) {
    if (!byParent.has(p.bedrock_system_id)) byParent.set(p.bedrock_system_id, [])
    byParent.get(p.bedrock_system_id)!.push(p)
  }
  return systems.map(s => ({
    ...s,
    physicals: (byParent.get(s.id) || []).sort(
      (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order
    ),
  }))
}

export async function createBedrockSystem(
  orgId: string,
  userId: string,
  data: { system_type: SystemType; label: string; description?: string; color?: string; sort_order?: number }
): Promise<BedrockSystem> {
  const res = await fetch(`${URL}/rest/v1/bedrock_systems`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, ...(userId ? { created_by: userId } : {}), ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create bedrock system')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateBedrockSystem(
  id: string,
  updates: Partial<Pick<BedrockSystem, 'label' | 'description' | 'color' | 'sort_order' | 'workstream_id' | 'archived_at'>>
): Promise<void> {
  await fetch(`${URL}/rest/v1/bedrock_systems?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
}

export async function deleteBedrockSystem(id: string): Promise<void> {
  await fetch(`${URL}/rest/v1/bedrock_systems?id=eq.${id}`, {
    method: 'DELETE',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
  })
}

// ─── Physical Systems ──────────────────────────────────

export async function createPhysicalSystem(
  bedrockSystemId: string,
  data: { name: string; vendor?: string; is_primary?: boolean; sort_order?: number }
): Promise<BedrockPhysicalSystem> {
  const res = await fetch(`${URL}/rest/v1/bedrock_physical_systems`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ bedrock_system_id: bedrockSystemId, ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to add physical system')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updatePhysicalSystem(
  id: string,
  updates: Partial<Pick<BedrockPhysicalSystem, 'name' | 'vendor' | 'is_primary' | 'sort_order'>>
): Promise<void> {
  await fetch(`${URL}/rest/v1/bedrock_physical_systems?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
}

export async function deletePhysicalSystem(id: string): Promise<void> {
  await fetch(`${URL}/rest/v1/bedrock_physical_systems?id=eq.${id}`, {
    method: 'DELETE',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
  })
}

// Make one physical system the primary for its logical system (clear siblings).
export async function setPrimaryPhysicalSystem(bedrockSystemId: string, physicalId: string): Promise<void> {
  // Clear all siblings first, then set the chosen one.
  await fetch(`${URL}/rest/v1/bedrock_physical_systems?bedrock_system_id=eq.${bedrockSystemId}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ is_primary: false }),
  })
  await fetch(`${URL}/rest/v1/bedrock_physical_systems?id=eq.${physicalId}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ is_primary: true }),
  })
}

// ─── Idempotent seed ───────────────────────────────────

// Seed the 19 logical bedrock systems from the Systems palette + default
// physical systems. Upsert on (organization_id, system_type) so re-seeding
// never duplicates or clobbers a system the user renamed; physical defaults are
// only added for logical systems that have no physical children yet.
export async function seedBedrockSystems(orgId: string, userId: string): Promise<BedrockSystemWithPhysicals[]> {
  const rows = SYSTEM_TEMPLATES.map((t, i) => ({
    organization_id: orgId,
    ...(userId ? { created_by: userId } : {}),
    system_type: t.type,
    label: t.label,
    description: t.description,
    color: t.color,
    sort_order: i,
    is_standard: true,
  }))
  const res = await fetch(
    `${URL}/rest/v1/bedrock_systems?on_conflict=organization_id,system_type`,
    {
      method: 'POST',
      headers: { ...headers(), 'Prefer': 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(rows),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to seed bedrock systems')
  }

  // Insert default physical systems only where none exist yet.
  const catalog = await listBedrockCatalog(orgId)
  const inserts: { bedrock_system_id: string; name: string; vendor?: string; is_primary: boolean; sort_order: number }[] = []
  for (const sys of catalog) {
    if (sys.physicals.length > 0) continue
    const defaults = DEFAULT_PHYSICAL_SYSTEMS[sys.system_type] || []
    defaults.forEach((d, i) => {
      inserts.push({ bedrock_system_id: sys.id, name: d.name, vendor: d.vendor, is_primary: i === 0, sort_order: i })
    })
  }
  if (inserts.length) {
    await fetch(`${URL}/rest/v1/bedrock_physical_systems`, {
      method: 'POST',
      headers: { ...headers(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(inserts),
    })
  }

  return listBedrockCatalog(orgId)
}

// ─── Diagram tagging (lineage / kind) ──────────────────

// Tag a diagram as a bedrock integration and record its source process model.
// Dedicated PATCH so the shared saveDiagram() signature stays untouched.
export async function tagBedrockDiagram(
  id: string,
  fields: { source_process_model_id?: string | null; diagram_kind?: string; workstream_id?: string | null }
): Promise<void> {
  await fetch(`${URL}/rest/v1/diagrams?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(fields),
  })
}
