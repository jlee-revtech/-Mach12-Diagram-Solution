import type { Capability, CapabilitySystemLink, CapabilityWithSystems } from '@/lib/capmap/types'

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

// ─── Capabilities ──────────────────────────────────────

export async function listCapabilities(orgId: string, includeArchived = false): Promise<Capability[]> {
  const archiveFilter = includeArchived ? '' : '&archived_at=is.null'
  const res = await fetch(
    `${URL}/rest/v1/cm_capabilities?organization_id=eq.${orgId}${archiveFilter}&select=*&order=sort_order.asc,name.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function listCapabilitySystems(orgId: string): Promise<CapabilitySystemLink[]> {
  const res = await fetch(
    `${URL}/rest/v1/cm_capability_systems?organization_id=eq.${orgId}&select=*`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

// Capabilities merged with their logical + physical system ids.
export async function listCapabilityMap(orgId: string): Promise<CapabilityWithSystems[]> {
  const [caps, links] = await Promise.all([listCapabilities(orgId), listCapabilitySystems(orgId)])
  const logicalBy = new Map<string, string[]>()
  const physicalBy = new Map<string, string[]>()
  for (const l of links) {
    if (l.bedrock_system_id) {
      if (!logicalBy.has(l.capability_id)) logicalBy.set(l.capability_id, [])
      logicalBy.get(l.capability_id)!.push(l.bedrock_system_id)
    } else if (l.physical_system_id) {
      if (!physicalBy.has(l.capability_id)) physicalBy.set(l.capability_id, [])
      physicalBy.get(l.capability_id)!.push(l.physical_system_id)
    }
  }
  return caps.map(c => ({
    ...c,
    logicalSystemIds: logicalBy.get(c.id) || [],
    physicalSystemIds: physicalBy.get(c.id) || [],
  }))
}

export async function createCapability(
  orgId: string,
  userId: string,
  data: { name: string; description?: string; domain?: string; color?: string; sort_order?: number; source?: string }
): Promise<Capability> {
  const res = await fetch(`${URL}/rest/v1/cm_capabilities`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, ...(userId ? { created_by: userId } : {}), ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create capability')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateCapability(
  id: string,
  updates: Partial<Pick<Capability, 'name' | 'description' | 'domain' | 'color' | 'sort_order' | 'archived_at'>>
): Promise<void> {
  await fetch(`${URL}/rest/v1/cm_capabilities?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
}

export async function deleteCapability(id: string): Promise<void> {
  await fetch(`${URL}/rest/v1/cm_capabilities?id=eq.${id}`, {
    method: 'DELETE',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
  })
}

// ─── Capability ↔ System mappings ──────────────────────

export async function addCapabilityLogicalSystem(orgId: string, userId: string, capabilityId: string, bedrockSystemId: string): Promise<void> {
  await fetch(`${URL}/rest/v1/cm_capability_systems`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ organization_id: orgId, ...(userId ? { created_by: userId } : {}), capability_id: capabilityId, bedrock_system_id: bedrockSystemId }),
  })
}

export async function removeCapabilityLogicalSystem(capabilityId: string, bedrockSystemId: string): Promise<void> {
  await fetch(
    `${URL}/rest/v1/cm_capability_systems?capability_id=eq.${capabilityId}&bedrock_system_id=eq.${bedrockSystemId}`,
    { method: 'DELETE', headers: { ...headers(), 'Prefer': 'return=minimal' } }
  )
}

export async function addCapabilityPhysicalSystem(orgId: string, userId: string, capabilityId: string, physicalSystemId: string): Promise<void> {
  await fetch(`${URL}/rest/v1/cm_capability_systems`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ organization_id: orgId, ...(userId ? { created_by: userId } : {}), capability_id: capabilityId, physical_system_id: physicalSystemId }),
  })
}

export async function removeCapabilityPhysicalSystem(capabilityId: string, physicalSystemId: string): Promise<void> {
  await fetch(
    `${URL}/rest/v1/cm_capability_systems?capability_id=eq.${capabilityId}&physical_system_id=eq.${physicalSystemId}`,
    { method: 'DELETE', headers: { ...headers(), 'Prefer': 'return=minimal' } }
  )
}

// Bulk-create AI-drafted capabilities and their logical-system mappings.
export async function bulkCreateCapabilities(
  orgId: string,
  userId: string,
  items: { name: string; description?: string; domain?: string; bedrockSystemIds: string[] }[]
): Promise<Capability[]> {
  if (items.length === 0) return []
  const rows = items.map((it, i) => ({
    organization_id: orgId,
    ...(userId ? { created_by: userId } : {}),
    name: it.name,
    description: it.description,
    domain: it.domain,
    source: 'ai',
    sort_order: i,
  }))
  const res = await fetch(`${URL}/rest/v1/cm_capabilities`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify(rows),
  })
  const created: Capability[] = await res.json()
  if (!res.ok) throw new Error((created as unknown as { message?: string }).message || 'Failed to create capabilities')

  const links: Record<string, unknown>[] = []
  created.forEach((cap, i) => {
    for (const sysId of items[i].bedrockSystemIds) {
      links.push({ organization_id: orgId, ...(userId ? { created_by: userId } : {}), capability_id: cap.id, bedrock_system_id: sysId })
    }
  })
  if (links.length) {
    await fetch(`${URL}/rest/v1/cm_capability_systems`, {
      method: 'POST',
      headers: { ...headers(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(links),
    })
  }
  return created
}
