import type {
  ProcessModelRow,
  ProcessNode,
  ProcessNodeLane,
  ProcessGraph,
  ReferenceLibraryRow,
  ReferenceScenario,
  ProcessOverlay,
  OverlayKind,
  OverlayPayload,
  RicefwItem,
  RicefwType,
  RicefwStatus,
  ProcessInterface,
  ProcessRole,
  PersonaRoleLink,
} from '@/lib/process/types'

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

function anonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'apikey': ANON, 'Accept': 'application/json' }
}

// PostgREST caps GETs at db-max-rows (1000 on Supabase). For pools that can
// exceed that (large node trees, reference catalog), page via Range.
async function fetchAllPaginated<T>(url: string, hdrs: Record<string, string>, pageSize = 1000): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const to = from + pageSize - 1
    const res = await fetch(url, {
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

// ─── Process Models ────────────────────────────────────

export async function listProcessModels(orgId: string, includeArchived = false): Promise<ProcessModelRow[]> {
  const archiveFilter = includeArchived ? '' : '&archived_at=is.null'
  const res = await fetch(
    `${URL}/rest/v1/process_models?organization_id=eq.${orgId}${archiveFilter}&select=*&order=updated_at.desc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function getProcessModel(id: string): Promise<ProcessModelRow | null> {
  const res = await fetch(
    `${URL}/rest/v1/process_models?id=eq.${id}&select=*`,
    { headers: headers() }
  )
  if (!res.ok) return null
  const arr = await res.json()
  return arr.length ? arr[0] : null
}

export async function createProcessModel(orgId: string, userId: string, title?: string): Promise<ProcessModelRow> {
  const res = await fetch(`${URL}/rest/v1/process_models`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      organization_id: orgId,
      title: title || 'Untitled Process Model',
      created_by: userId,
      updated_by: userId,
    }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create process model')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateProcessModel(
  id: string,
  userId: string,
  updates: { title?: string; description?: string; source_reference_id?: string | null }
): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_models?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ...updates, updated_by: userId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to update process model')
  }
}

export async function archiveProcessModel(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_models?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ archived_at: new Date().toISOString() }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to archive process model')
  }
}

export async function restoreProcessModel(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_models?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ archived_at: null }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to restore process model')
  }
}

// ─── Process Nodes ─────────────────────────────────────

export async function listProcessNodes(modelId: string): Promise<ProcessNode[]> {
  return fetchAllPaginated<ProcessNode>(
    `${URL}/rest/v1/process_nodes?process_model_id=eq.${modelId}&select=*&order=sort_order.asc`,
    headers()
  )
}

/**
 * Leaf-node count per model, across many models in one pass. A "leaf" is the
 * unit process (a node no other node parents) — the BPMN-flow-bearing process.
 * Used on the dashboard so Process Studio counts individual processes, like Data
 * Studio counts individual diagrams. Returns a map of modelId → leaf count.
 */
export async function listProcessLeafCounts(modelIds: string[]): Promise<Record<string, number>> {
  if (modelIds.length === 0) return {}
  const inList = modelIds.map(id => `"${id}"`).join(',')
  const rows = await fetchAllPaginated<{ id: string; process_model_id: string; parent_id: string | null }>(
    `${URL}/rest/v1/process_nodes?process_model_id=in.(${inList})&select=id,process_model_id,parent_id`,
    headers()
  )
  const parents = new Set(rows.map(r => r.parent_id).filter((p): p is string => !!p))
  const counts: Record<string, number> = {}
  for (const r of rows) if (!parents.has(r.id)) counts[r.process_model_id] = (counts[r.process_model_id] || 0) + 1
  return counts
}

export async function createProcessNode(
  modelId: string,
  name: string,
  sortOrder: number,
  parentId?: string | null,
  level?: number,
  nodeKind?: string,
  color?: string | null,
): Promise<ProcessNode> {
  const lvl = level ?? 1
  const isLeaf = lvl >= 3
  const res = await fetch(`${URL}/rest/v1/process_nodes`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      process_model_id: modelId,
      name,
      sort_order: sortOrder,
      parent_id: parentId || null,
      level: lvl,
      node_kind: nodeKind || (lvl === 1 ? 'scenario' : lvl === 2 ? 'process_group' : 'process'),
      is_leaf: isLeaf,
      color: color || null,
    }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create process node')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateProcessNode(
  id: string,
  updates: Partial<Pick<ProcessNode, 'name' | 'description' | 'color' | 'parent_id' | 'level' | 'node_kind' | 'sort_order' | 'is_leaf' | 'sipoc_capability_id' | 'scope_item_ref' | 'lifecycle' | 'variant_label'>>
): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_nodes?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to update process node')
  }
}

export async function deleteProcessNode(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_nodes?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete process node')
  }
}

// ─── Leaf BPMN graph (single jsonb blob, like saveDiagram) ─

export async function saveProcessGraph(nodeId: string, graph: ProcessGraph): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_nodes?id=eq.${nodeId}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ graph_data: graph }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to save process graph')
  }
}

// ─── Process Node Lanes (normalized lane → system map) ─

export async function listProcessNodeLanes(nodeId: string): Promise<ProcessNodeLane[]> {
  const res = await fetch(
    `${URL}/rest/v1/process_node_lanes?process_node_id=eq.${nodeId}&select=*&order=sort_order.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function upsertProcessNodeLane(
  nodeId: string,
  laneKey: string,
  data: { logical_system_id?: string | null; persona_id?: string | null; role_id?: string | null; label?: string | null; sort_order?: number }
): Promise<ProcessNodeLane> {
  // PostgREST upsert keyed on (process_node_id, lane_key) requires a unique
  // constraint; we keep it simple — delete-then-insert on the (node, key) pair.
  await fetch(
    `${URL}/rest/v1/process_node_lanes?process_node_id=eq.${nodeId}&lane_key=eq.${encodeURIComponent(laneKey)}`,
    { method: 'DELETE', headers: headers() }
  )
  const res = await fetch(`${URL}/rest/v1/process_node_lanes`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ process_node_id: nodeId, lane_key: laneKey, ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to save lane')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function deleteProcessNodeLane(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_node_lanes?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete lane')
  }
}

// ─── Duplicate (parent-before-child idMap, mirrors duplicateCapabilityMap) ─

export async function duplicateProcessModel(
  sourceModelId: string,
  orgId: string,
  userId: string
): Promise<ProcessModelRow> {
  const source = await getProcessModel(sourceModelId)
  if (!source) throw new Error('Source process model not found')

  const newModel = await createProcessModel(orgId, userId, `${source.title} (Copy)`)
  const metaUpdates: { description?: string; source_reference_id?: string | null } = {}
  if (source.description) metaUpdates.description = source.description
  if (source.source_reference_id) metaUpdates.source_reference_id = source.source_reference_id
  if (Object.keys(metaUpdates).length > 0) {
    await updateProcessModel(newModel.id, userId, metaUpdates)
    Object.assign(newModel, metaUpdates)
  }

  const sourceNodes = await listProcessNodes(sourceModelId)
  if (sourceNodes.length === 0) return newModel

  // Parents before children
  sourceNodes.sort((a, b) => a.level - b.level || a.sort_order - b.sort_order)

  const idMap = new Map<string, string>()
  for (const node of sourceNodes) {
    const newParentId = node.parent_id ? (idMap.get(node.parent_id) || null) : null
    const newNode = await createProcessNode(
      newModel.id,
      node.name,
      node.sort_order,
      newParentId,
      node.level,
      node.node_kind,
      node.color || null,
    )
    const updates: Record<string, unknown> = {}
    if (node.description) updates.description = node.description
    if (node.scope_item_ref) updates.scope_item_ref = node.scope_item_ref
    if (Object.keys(updates).length > 0) {
      await updateProcessNode(newNode.id, updates as Partial<ProcessNode>)
    }
    // Copy the leaf BPMN graph blob verbatim
    if (node.graph_data) {
      await saveProcessGraph(newNode.id, node.graph_data)
    }
    idMap.set(node.id, newNode.id)
  }

  // Copy lanes
  for (const node of sourceNodes) {
    const lanes = await listProcessNodeLanes(node.id)
    const newNodeId = idMap.get(node.id)!
    for (const lane of lanes) {
      await upsertProcessNodeLane(newNodeId, lane.lane_key, {
        logical_system_id: lane.logical_system_id,
        persona_id: lane.persona_id,
        role_id: lane.role_id,
        label: lane.label,
        sort_order: lane.sort_order,
      })
    }
  }

  return newModel
}

// ─── Process Model Shares (read-only links) ────────────

export interface ProcessModelShare {
  id: string
  process_model_id: string
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

export async function createProcessModelShare(
  modelId: string,
  orgId: string,
  userId: string,
  expiresAt?: string | null
): Promise<ProcessModelShare> {
  const res = await fetch(`${URL}/rest/v1/process_model_shares`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      process_model_id: modelId,
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

export async function listProcessModelShares(modelId: string): Promise<ProcessModelShare[]> {
  const res = await fetch(
    `${URL}/rest/v1/process_model_shares?process_model_id=eq.${modelId}&select=*&order=created_at.desc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function deleteProcessModelShare(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_model_shares?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to revoke share link')
  }
}

export async function getProcessShareByCode(code: string): Promise<ProcessModelShare | null> {
  const res = await fetch(
    `${URL}/rest/v1/process_model_shares?code=eq.${code}&select=*`,
    { headers: anonHeaders() }
  )
  if (!res.ok) return null
  const arr = await res.json()
  if (!arr.length) return null
  const share = arr[0] as ProcessModelShare
  if (share.expires_at && new Date(share.expires_at) < new Date()) return null
  return share
}

// ─── Reference library (shared, global catalog) ───────

export async function listReferenceLibraries(activeOnly = true): Promise<ReferenceLibraryRow[]> {
  const filter = activeOnly ? '&is_active=eq.true' : ''
  const res = await fetch(
    `${URL}/rest/v1/process_reference_libraries?select=*${filter}&order=published_at.desc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function listReferenceScenarios(libraryId: string): Promise<ReferenceScenario[]> {
  // Full catalog can exceed the 1000-row PostgREST cap — page through.
  return fetchAllPaginated<ReferenceScenario>(
    `${URL}/rest/v1/process_reference_scenarios?library_id=eq.${libraryId}&select=*&order=level.asc,sort_order.asc`,
    headers()
  )
}

export async function getReferenceScenario(id: string): Promise<ReferenceScenario | null> {
  const res = await fetch(`${URL}/rest/v1/process_reference_scenarios?id=eq.${id}&select=*`, { headers: headers() })
  if (!res.ok) return null
  const arr = await res.json()
  return arr.length ? arr[0] : null
}

export async function listReferenceOverlays(libraryId: string): Promise<ProcessOverlay[]> {
  // Overlays joined to scenarios of this library. PostgREST embedded filter.
  const res = await fetch(
    `${URL}/rest/v1/process_reference_overlays?select=*,process_reference_scenarios!inner(library_id)&process_reference_scenarios.library_id=eq.${libraryId}`,
    { headers: headers() }
  )
  if (!res.ok) return []
  const rows = await res.json()
  // Normalize to ProcessOverlay shape (reference_scenario_id stands in for process_node_id)
  return rows.map((r: { id: string; reference_scenario_id: string; overlay_kind: string; payload: unknown; sort_order: number }) => ({
    id: r.id,
    process_node_id: r.reference_scenario_id,
    overlay_kind: r.overlay_kind,
    payload: r.payload,
    sort_order: r.sort_order,
    created_at: '',
    updated_at: '',
  })) as ProcessOverlay[]
}

/**
 * Copy a reference scenario subtree into a NEW, editable, org-scoped process
 * model. Parent-before-child idMap (mirrors duplicateProcessModel). Records
 * lineage on process_models.source_reference_id.
 */
export async function instantiateReferenceScenario(
  scenarioId: string,
  orgId: string,
  userId: string,
): Promise<ProcessModelRow> {
  const root = await getReferenceScenario(scenarioId)
  if (!root) throw new Error('Reference scenario not found')

  const all = await listReferenceScenarios(root.library_id)
  const byParent = new Map<string | null, ReferenceScenario[]>()
  for (const s of all) {
    const key = s.parent_id ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(s)
  }
  // Collect the subtree rooted at `root` (inclusive)
  const subtree: ReferenceScenario[] = []
  const walk = (node: ReferenceScenario) => {
    subtree.push(node)
    ;(byParent.get(node.id) || []).forEach(walk)
  }
  walk(root)

  const model = await createProcessModel(orgId, userId, root.name)
  await updateProcessModel(model.id, userId, {
    source_reference_id: root.id,
    ...(root.description ? { description: root.description } : {}),
  })

  // Parents before children
  subtree.sort((a, b) => a.level - b.level || a.sort_order - b.sort_order)
  const idMap = new Map<string, string>()
  for (const s of subtree) {
    const newParent = s.id === root.id ? null : (idMap.get(s.parent_id || '') || null)
    const node = await createProcessNode(model.id, s.name, s.sort_order, newParent, s.level, s.node_kind, null)
    const updates: Record<string, unknown> = {}
    if (s.description) updates.description = s.description
    if (s.scope_item_ref) updates.scope_item_ref = s.scope_item_ref
    if (s.lifecycle) updates.lifecycle = s.lifecycle
    if (s.variant_label) updates.variant_label = s.variant_label
    // A node with children is not a BPMN leaf, regardless of level.
    if ((byParent.get(s.id) || []).length > 0) updates.is_leaf = false
    if (Object.keys(updates).length) await updateProcessNode(node.id, updates as Partial<ProcessNode>)
    if (s.graph_data) await saveProcessGraph(node.id, s.graph_data)
    idMap.set(s.id, node.id)
  }

  return model
}

// ─── Process overlays (org-scoped A&D know-how) ────────

export async function listProcessOverlays(nodeId: string): Promise<ProcessOverlay[]> {
  const res = await fetch(
    `${URL}/rest/v1/process_overlays?process_node_id=eq.${nodeId}&select=*&order=sort_order.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createProcessOverlay(
  nodeId: string,
  overlayKind: OverlayKind,
  payload: OverlayPayload,
  sortOrder = 0,
): Promise<ProcessOverlay> {
  const res = await fetch(`${URL}/rest/v1/process_overlays`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ process_node_id: nodeId, overlay_kind: overlayKind, payload, sort_order: sortOrder }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create overlay')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateProcessOverlay(id: string, payload: OverlayPayload): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_overlays?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ payload }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to update overlay')
  }
}

export async function deleteProcessOverlay(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_overlays?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete overlay')
  }
}

export async function listProcessOverlaysAnon(nodeId: string): Promise<ProcessOverlay[]> {
  const res = await fetch(
    `${URL}/rest/v1/process_overlays?process_node_id=eq.${nodeId}&select=*&order=sort_order.asc`,
    { headers: anonHeaders() }
  )
  if (!res.ok) return []
  return res.json()
}

// ─── Persona Catalog: roles + persona↔role links ──────

export async function listProcessRoles(orgId: string): Promise<ProcessRole[]> {
  return fetchAllPaginated<ProcessRole>(
    `${URL}/rest/v1/process_roles?organization_id=eq.${orgId}&select=*&order=name.asc`,
    headers()
  )
}

export async function listProcessRolesAnon(orgId: string): Promise<ProcessRole[]> {
  return fetchAllPaginated<ProcessRole>(
    `${URL}/rest/v1/process_roles?organization_id=eq.${orgId}&select=*&order=name.asc`,
    anonHeaders()
  )
}

export async function createProcessRole(orgId: string, data: { name: string; description?: string; color?: string }): Promise<ProcessRole> {
  const res = await fetch(`${URL}/rest/v1/process_roles`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create role')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateProcessRole(id: string, updates: Partial<Pick<ProcessRole, 'name' | 'description' | 'color'>>): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_roles?id=eq.${id}`, {
    method: 'PATCH', headers: { ...headers(), 'Prefer': 'return=minimal' }, body: JSON.stringify(updates),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to update role') }
}

export async function deleteProcessRole(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_roles?id=eq.${id}`, { method: 'DELETE', headers: headers() })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to delete role') }
}

export async function listPersonaRoleLinks(orgId: string): Promise<PersonaRoleLink[]> {
  // Links for personas in this org (filter via embedded persona).
  const res = await fetch(
    `${URL}/rest/v1/persona_roles?select=*,personas!inner(organization_id)&personas.organization_id=eq.${orgId}`,
    { headers: headers() }
  )
  if (!res.ok) return []
  const rows = await res.json()
  return rows.map((r: { id: string; persona_id: string; role_id: string; created_at: string }) => ({
    id: r.id, persona_id: r.persona_id, role_id: r.role_id, created_at: r.created_at,
  }))
}

export async function addPersonaRole(personaId: string, roleId: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/persona_roles`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({ persona_id: personaId, role_id: roleId }),
  })
  if (!res.ok && res.status !== 409) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to link role') }
}

export async function removePersonaRole(personaId: string, roleId: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/persona_roles?persona_id=eq.${personaId}&role_id=eq.${roleId}`, {
    method: 'DELETE', headers: headers(),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to unlink role') }
}

// ─── RICEFW register (org-scoped build-object catalog) ──

export async function listRicefw(orgId: string, nodeId?: string): Promise<RicefwItem[]> {
  const nodeFilter = nodeId ? `&process_node_id=eq.${nodeId}` : ''
  return fetchAllPaginated<RicefwItem>(
    `${URL}/rest/v1/process_ricefw?organization_id=eq.${orgId}${nodeFilter}&select=*&order=code.asc`,
    headers()
  )
}

export async function createRicefw(
  orgId: string,
  data: { code: string; ricefw_type: RicefwType; title: string; description?: string; status?: RicefwStatus; complexity?: string; process_node_id?: string | null },
): Promise<RicefwItem> {
  const res = await fetch(`${URL}/rest/v1/process_ricefw`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, status: 'identified', ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create RICEFW item')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function updateRicefw(
  id: string,
  updates: Partial<Pick<RicefwItem, 'code' | 'ricefw_type' | 'title' | 'description' | 'status' | 'complexity' | 'process_node_id'>>,
): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_ricefw?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to update RICEFW item') }
}

export async function deleteRicefw(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_ricefw?id=eq.${id}`, { method: 'DELETE', headers: headers() })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to delete RICEFW item') }
}

// ─── Interface / integration register (per node) ───────

export async function listProcessInterfaces(nodeId: string): Promise<ProcessInterface[]> {
  const res = await fetch(
    `${URL}/rest/v1/process_interfaces?process_node_id=eq.${nodeId}&select=*&order=sort_order.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createProcessInterface(
  nodeId: string,
  data: Partial<Pick<ProcessInterface, 'source_system_id' | 'target_system_id' | 'direction' | 'frequency' | 'integration_tech' | 'interface_ref' | 'description' | 'sort_order'>>,
): Promise<ProcessInterface> {
  const res = await fetch(`${URL}/rest/v1/process_interfaces`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ process_node_id: nodeId, ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create interface')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function deleteProcessInterface(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_interfaces?id=eq.${id}`, { method: 'DELETE', headers: headers() })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to delete interface') }
}

export async function listProcessInterfacesAnon(nodeId: string): Promise<ProcessInterface[]> {
  const res = await fetch(
    `${URL}/rest/v1/process_interfaces?process_node_id=eq.${nodeId}&select=*&order=sort_order.asc`,
    { headers: anonHeaders() }
  )
  if (!res.ok) return []
  return res.json()
}

// ─── Cross-pillar links (process_node_links) ───────────

export interface ProcessNodeLink {
  id: string
  process_node_id: string
  link_kind: string
  target_id: string
  label: string | null
  created_by: string | null
  created_at: string
}

export async function listProcessNodeLinks(nodeId: string): Promise<ProcessNodeLink[]> {
  const res = await fetch(
    `${URL}/rest/v1/process_node_links?process_node_id=eq.${nodeId}&select=*&order=created_at.desc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function createProcessNodeLink(
  nodeId: string,
  linkKind: string,
  targetId: string,
  userId: string,
  label?: string | null,
): Promise<ProcessNodeLink> {
  const res = await fetch(`${URL}/rest/v1/process_node_links`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ process_node_id: nodeId, link_kind: linkKind, target_id: targetId, label: label ?? null, created_by: userId }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create link')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function deleteProcessNodeLink(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/process_node_links?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete link')
  }
}

export async function listProcessNodeLinksAnon(nodeId: string): Promise<ProcessNodeLink[]> {
  const res = await fetch(
    `${URL}/rest/v1/process_node_links?process_node_id=eq.${nodeId}&select=*&order=created_at.desc`,
    { headers: anonHeaders() }
  )
  if (!res.ok) return []
  return res.json()
}

// ─── Anon fetchers (shared read-only views) ────────────

export async function getProcessModelAnon(id: string): Promise<ProcessModelRow | null> {
  const res = await fetch(`${URL}/rest/v1/process_models?id=eq.${id}&select=*`, { headers: anonHeaders() })
  if (!res.ok) return null
  const arr = await res.json()
  return arr.length ? arr[0] : null
}

export async function listProcessNodesAnon(modelId: string): Promise<ProcessNode[]> {
  return fetchAllPaginated<ProcessNode>(
    `${URL}/rest/v1/process_nodes?process_model_id=eq.${modelId}&select=*&order=sort_order.asc`,
    anonHeaders()
  )
}

export async function listProcessNodeLanesAnon(nodeId: string): Promise<ProcessNodeLane[]> {
  const res = await fetch(
    `${URL}/rest/v1/process_node_lanes?process_node_id=eq.${nodeId}&select=*&order=sort_order.asc`,
    { headers: anonHeaders() }
  )
  if (!res.ok) return []
  return res.json()
}
