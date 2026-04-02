import type {
  CapabilityMapRow,
  Capability,
  CapabilityInput,
  CapabilityOutput,
  Persona,
  InformationProduct,
  LogicalSystem,
} from '@/lib/sipoc/types'

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

// ─── Capability Maps ───────────────────────────────────

export async function listCapabilityMaps(orgId: string, includeArchived = false): Promise<CapabilityMapRow[]> {
  const archiveFilter = includeArchived ? '' : '&archived_at=is.null'
  const res = await fetch(
    `${URL}/rest/v1/capability_maps?organization_id=eq.${orgId}${archiveFilter}&select=*&order=updated_at.desc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function getCapabilityMap(id: string): Promise<CapabilityMapRow | null> {
  const res = await fetch(
    `${URL}/rest/v1/capability_maps?id=eq.${id}&select=*`,
    { headers: headers() }
  )
  if (!res.ok) return null
  const arr = await res.json()
  return arr.length ? arr[0] : null
}

export async function createCapabilityMap(orgId: string, userId: string, title?: string): Promise<CapabilityMapRow> {
  const res = await fetch(`${URL}/rest/v1/capability_maps`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      organization_id: orgId,
      title: title || 'Untitled Capability Map',
      created_by: userId,
      updated_by: userId,
    }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create capability map')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateCapabilityMap(
  id: string,
  userId: string,
  updates: { title?: string; description?: string }
): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/capability_maps?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ...updates, updated_by: userId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to update capability map')
  }
}

export async function archiveCapabilityMap(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/capability_maps?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ archived_at: new Date().toISOString() }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to archive capability map')
  }
}

export async function restoreCapabilityMap(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/capability_maps?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ archived_at: null }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to restore capability map')
  }
}

// ─── Capabilities ──────────────────────────────────────

export async function listCapabilities(mapId: string): Promise<Capability[]> {
  const res = await fetch(
    `${URL}/rest/v1/capabilities?capability_map_id=eq.${mapId}&select=*&order=sort_order.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createCapability(mapId: string, name: string, sortOrder: number): Promise<Capability> {
  const res = await fetch(`${URL}/rest/v1/capabilities`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ capability_map_id: mapId, name, sort_order: sortOrder }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create capability')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateCapability(id: string, updates: Partial<Pick<Capability, 'name' | 'description' | 'sort_order'>>): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/capabilities?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to update capability')
  }
}

export async function deleteCapability(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/capabilities?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete capability')
  }
}

// ─── Capability Inputs ─────────────────────────────────

export async function listCapabilityInputs(capabilityId: string): Promise<CapabilityInput[]> {
  const res = await fetch(
    `${URL}/rest/v1/capability_inputs?capability_id=eq.${capabilityId}&select=*&order=sort_order.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createCapabilityInput(
  capabilityId: string,
  informationProductId: string,
  sortOrder: number,
  supplierPersonaIds: string[] = [],
  sourceSystemIds: string[] = []
): Promise<CapabilityInput> {
  const res = await fetch(`${URL}/rest/v1/capability_inputs`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      capability_id: capabilityId,
      information_product_id: informationProductId,
      supplier_persona_ids: supplierPersonaIds,
      source_system_ids: sourceSystemIds,
      sort_order: sortOrder,
    }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create capability input')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateCapabilityInput(
  id: string,
  updates: Partial<Pick<CapabilityInput, 'supplier_persona_ids' | 'source_system_ids' | 'dimensions' | 'sort_order'>>
): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/capability_inputs?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to update capability input')
  }
}

export async function deleteCapabilityInput(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/capability_inputs?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete capability input')
  }
}

// ─── Capability Outputs ────────────────────────────────

export async function listCapabilityOutputs(capabilityId: string): Promise<CapabilityOutput[]> {
  const res = await fetch(
    `${URL}/rest/v1/capability_outputs?capability_id=eq.${capabilityId}&select=*&order=sort_order.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createCapabilityOutput(
  capabilityId: string,
  informationProductId: string,
  sortOrder: number,
  consumerPersonaIds: string[] = []
): Promise<CapabilityOutput> {
  const res = await fetch(`${URL}/rest/v1/capability_outputs`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      capability_id: capabilityId,
      information_product_id: informationProductId,
      consumer_persona_ids: consumerPersonaIds,
      sort_order: sortOrder,
    }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create capability output')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateCapabilityOutput(
  id: string,
  updates: Partial<Pick<CapabilityOutput, 'consumer_persona_ids' | 'dimensions' | 'sort_order'>>
): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/capability_outputs?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to update capability output')
  }
}

export async function deleteCapabilityOutput(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/capability_outputs?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete capability output')
  }
}

// ─── Personas (org-scoped) ─────────────────────────────

export async function listPersonas(orgId: string): Promise<Persona[]> {
  const res = await fetch(
    `${URL}/rest/v1/personas?organization_id=eq.${orgId}&select=*&order=name.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createPersona(orgId: string, data: { name: string; role?: string; description?: string; color?: string }): Promise<Persona> {
  const res = await fetch(`${URL}/rest/v1/personas`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create persona')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updatePersona(id: string, updates: Partial<Pick<Persona, 'name' | 'role' | 'description' | 'color'>>): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/personas?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to update persona')
  }
}

export async function deletePersona(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/personas?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete persona')
  }
}

// ─── Information Products (org-scoped) ─────────────────

export async function listInformationProducts(orgId: string): Promise<InformationProduct[]> {
  const res = await fetch(
    `${URL}/rest/v1/information_products?organization_id=eq.${orgId}&select=*&order=name.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createInformationProduct(orgId: string, data: { name: string; description?: string; category?: string }): Promise<InformationProduct> {
  const res = await fetch(`${URL}/rest/v1/information_products`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create information product')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateInformationProduct(id: string, updates: Partial<Pick<InformationProduct, 'name' | 'description' | 'category'>>): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/information_products?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to update information product')
  }
}

export async function deleteInformationProduct(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/information_products?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete information product')
  }
}

// ─── Logical Systems (org-scoped) ──────────────────────

export async function listLogicalSystems(orgId: string): Promise<LogicalSystem[]> {
  const res = await fetch(
    `${URL}/rest/v1/logical_systems?organization_id=eq.${orgId}&select=*&order=name.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createLogicalSystem(orgId: string, data: { name: string; system_type?: string; description?: string; color?: string }): Promise<LogicalSystem> {
  const res = await fetch(`${URL}/rest/v1/logical_systems`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create logical system')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateLogicalSystem(id: string, updates: Partial<Pick<LogicalSystem, 'name' | 'system_type' | 'description' | 'color'>>): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/logical_systems?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to update logical system')
  }
}

export async function deleteLogicalSystem(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/logical_systems?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete logical system')
  }
}
