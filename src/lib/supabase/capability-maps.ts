import type {
  CapabilityMapRow,
  Capability,
  CapabilityInput,
  CapabilityOutput,
  Persona,
  InformationProduct,
  LogicalSystem,
  CapabilityTemplateRow,
  Tag,
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

export async function createCapability(
  mapId: string,
  name: string,
  sortOrder: number,
  parentId?: string | null,
  level?: number,
  color?: string | null,
): Promise<Capability> {
  const res = await fetch(`${URL}/rest/v1/capabilities`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      capability_map_id: mapId,
      name,
      sort_order: sortOrder,
      parent_id: parentId || null,
      level: level ?? 3,
      color: color || null,
    }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create capability')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateCapability(id: string, updates: Partial<Pick<Capability, 'name' | 'description' | 'system_id' | 'sort_order' | 'parent_id' | 'level' | 'color' | 'features'>>): Promise<void> {
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
  updates: Partial<Pick<CapabilityInput, 'supplier_persona_ids' | 'source_system_ids' | 'feeding_system_id' | 'dimensions' | 'tag_ids' | 'sort_order'>>
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
  updates: Partial<Pick<CapabilityOutput, 'consumer_persona_ids' | 'destination_system_ids' | 'dimensions' | 'tag_ids' | 'sort_order'>>
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

// ─── Tags (org-scoped) ─────────────────────────────────

export async function listTags(orgId: string): Promise<Tag[]> {
  const res = await fetch(
    `${URL}/rest/v1/tags?organization_id=eq.${orgId}&select=*&order=name.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createTag(orgId: string, data: { name: string; color?: string; description?: string }): Promise<Tag> {
  const res = await fetch(`${URL}/rest/v1/tags`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create tag')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateTag(id: string, updates: Partial<Pick<Tag, 'name' | 'color' | 'description'>>): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/tags?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to update tag')
  }
}

export async function deleteTag(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/tags?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete tag')
  }
}

// ─── Capability Templates (org-scoped) ─────────────────

export async function listCapabilityTemplates(orgId: string): Promise<CapabilityTemplateRow[]> {
  const res = await fetch(
    `${URL}/rest/v1/capability_templates?organization_id=eq.${orgId}&select=*&order=name.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createCapabilityTemplate(
  orgId: string,
  userId: string,
  name: string,
  description: string | null,
  templateData: CapabilityTemplateRow['template_data']
): Promise<CapabilityTemplateRow> {
  const res = await fetch(`${URL}/rest/v1/capability_templates`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, name, description, created_by: userId, template_data: templateData }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to save template')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function deleteCapabilityTemplate(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/capability_templates?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete template')
  }
}

// ─── Capability Map Shares (read-only links) ──────────

export interface CapabilityMapShare {
  id: string
  capability_map_id: string
  organization_id: string
  code: string
  created_by: string | null
  expires_at: string | null
  created_at: string
}

function generateShareCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 12; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function createCapabilityMapShare(
  mapId: string,
  orgId: string,
  userId: string,
  expiresAt?: string | null
): Promise<CapabilityMapShare> {
  const res = await fetch(`${URL}/rest/v1/capability_map_shares`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      capability_map_id: mapId,
      organization_id: orgId,
      code: generateShareCode(),
      created_by: userId,
      expires_at: expiresAt || null,
    }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create share link')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function listCapabilityMapShares(mapId: string): Promise<CapabilityMapShare[]> {
  const res = await fetch(
    `${URL}/rest/v1/capability_map_shares?capability_map_id=eq.${mapId}&select=*&order=created_at.desc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function deleteCapabilityMapShare(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/capability_map_shares?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to revoke share link')
  }
}

export async function getShareByCode(code: string): Promise<(CapabilityMapShare & { map_title?: string }) | null> {
  // Fetch share — anon key works here (RLS allows public SELECT on shares)
  const res = await fetch(
    `${URL}/rest/v1/capability_map_shares?code=eq.${code}&select=*`,
    { headers: { 'Content-Type': 'application/json', 'apikey': ANON, 'Accept': 'application/json' } }
  )
  if (!res.ok) return null
  const arr = await res.json()
  if (!arr.length) return null
  const share = arr[0] as CapabilityMapShare
  if (share.expires_at && new Date(share.expires_at) < new Date()) return null
  return share
}

// ─── Anon data fetchers (for shared read-only views) ───

function anonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'apikey': ANON, 'Accept': 'application/json' }
}

export async function getCapabilityMapAnon(id: string): Promise<CapabilityMapRow | null> {
  const res = await fetch(`${URL}/rest/v1/capability_maps?id=eq.${id}&select=*`, { headers: anonHeaders() })
  if (!res.ok) return null
  const arr = await res.json()
  return arr.length ? arr[0] : null
}

export async function listCapabilitiesAnon(mapId: string): Promise<Capability[]> {
  const res = await fetch(
    `${URL}/rest/v1/capabilities?capability_map_id=eq.${mapId}&select=*&order=sort_order.asc`,
    { headers: anonHeaders() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function listCapabilityInputsAnon(capId: string): Promise<CapabilityInput[]> {
  const res = await fetch(
    `${URL}/rest/v1/capability_inputs?capability_id=eq.${capId}&select=*&order=sort_order.asc`,
    { headers: anonHeaders() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function listCapabilityOutputsAnon(capId: string): Promise<CapabilityOutput[]> {
  const res = await fetch(
    `${URL}/rest/v1/capability_outputs?capability_id=eq.${capId}&select=*&order=sort_order.asc`,
    { headers: anonHeaders() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function listPersonasAnon(orgId: string): Promise<Persona[]> {
  const res = await fetch(`${URL}/rest/v1/personas?organization_id=eq.${orgId}&select=*&order=name.asc`, { headers: anonHeaders() })
  if (!res.ok) return []
  return res.json()
}

export async function listInformationProductsAnon(orgId: string): Promise<InformationProduct[]> {
  const res = await fetch(`${URL}/rest/v1/information_products?organization_id=eq.${orgId}&select=*&order=name.asc`, { headers: anonHeaders() })
  if (!res.ok) return []
  return res.json()
}

export async function listLogicalSystemsAnon(orgId: string): Promise<LogicalSystem[]> {
  const res = await fetch(`${URL}/rest/v1/logical_systems?organization_id=eq.${orgId}&select=*&order=name.asc`, { headers: anonHeaders() })
  if (!res.ok) return []
  return res.json()
}

export async function listTagsAnon(orgId: string): Promise<Tag[]> {
  const res = await fetch(`${URL}/rest/v1/tags?organization_id=eq.${orgId}&select=*&order=name.asc`, { headers: anonHeaders() })
  if (!res.ok) return []
  return res.json()
}

// ─── Duplicate an entire Capability Map ────────────────
export async function duplicateCapabilityMap(
  sourceMapId: string,
  orgId: string,
  userId: string
): Promise<CapabilityMapRow> {
  // 1. Fetch source map metadata
  const sourceMap = await getCapabilityMap(sourceMapId)
  if (!sourceMap) throw new Error('Source map not found')

  // 2. Create new map
  const newMap = await createCapabilityMap(orgId, userId, `${sourceMap.title} (Copy)`)
  if (sourceMap.description) {
    await updateCapabilityMap(newMap.id, userId, { description: sourceMap.description })
    newMap.description = sourceMap.description
  }

  // 3. Fetch all capabilities from source
  const sourceCaps = await listCapabilities(sourceMapId)
  if (sourceCaps.length === 0) return newMap

  // 4. Sort so parents come before children (by level then sort_order)
  sourceCaps.sort((a, b) => a.level - b.level || a.sort_order - b.sort_order)

  // 5. Create capabilities in new map, mapping old IDs → new IDs
  const idMap = new Map<string, string>()
  for (const cap of sourceCaps) {
    const newParentId = cap.parent_id ? (idMap.get(cap.parent_id) || null) : null
    const newCap = await createCapability(
      newMap.id,
      cap.name,
      cap.sort_order,
      newParentId,
      cap.level,
      cap.color || null
    )
    if (cap.description || cap.features || cap.system_id) {
      await updateCapability(newCap.id, {
        description: cap.description,
        features: cap.features,
        system_id: cap.system_id,
      })
    }
    idMap.set(cap.id, newCap.id)
  }

  // 6. Copy inputs + outputs for each capability
  for (const cap of sourceCaps) {
    const newCapId = idMap.get(cap.id)!

    const inputs = await listCapabilityInputs(cap.id)
    for (const inp of inputs) {
      const newInp = await createCapabilityInput(
        newCapId,
        inp.information_product_id,
        inp.sort_order,
        inp.supplier_persona_ids,
        inp.source_system_ids
      )
      // Copy feeding_system, dimensions, tags
      const updates: Record<string, unknown> = {}
      if (inp.feeding_system_id) updates.feeding_system_id = inp.feeding_system_id
      if (inp.dimensions && inp.dimensions.length > 0) updates.dimensions = inp.dimensions
      if (inp.tag_ids && inp.tag_ids.length > 0) updates.tag_ids = inp.tag_ids
      if (Object.keys(updates).length > 0) {
        await updateCapabilityInput(newInp.id, updates as any)
      }
    }

    const outputs = await listCapabilityOutputs(cap.id)
    for (const out of outputs) {
      const newOut = await createCapabilityOutput(
        newCapId,
        out.information_product_id,
        out.sort_order,
        out.consumer_persona_ids
      )
      const updates: Record<string, unknown> = {}
      if (out.destination_system_ids && out.destination_system_ids.length > 0) updates.destination_system_ids = out.destination_system_ids
      if (out.dimensions && out.dimensions.length > 0) updates.dimensions = out.dimensions
      if (Object.keys(updates).length > 0) {
        await updateCapabilityOutput(newOut.id, updates as any)
      }
    }
  }

  return newMap
}
