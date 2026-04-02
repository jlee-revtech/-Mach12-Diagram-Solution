import type { DiagramRow } from './types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getToken(): string | null {
  try {
    // Supabase stores token under sb-<ref>-auth-token
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

function headers(token?: string): Record<string, string> {
  const t = token || getToken()
  return {
    'Content-Type': 'application/json',
    'apikey': ANON,
    'Authorization': `Bearer ${t}`,
    'Accept': 'application/json',
  }
}

export async function listDiagrams(orgId: string, includeArchived = false): Promise<DiagramRow[]> {
  const archiveFilter = includeArchived ? '' : '&archived_at=is.null'
  const res = await fetch(
    `${URL}/rest/v1/diagrams?organization_id=eq.${orgId}${archiveFilter}&select=*&order=updated_at.desc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function getDiagram(id: string): Promise<DiagramRow | null> {
  const res = await fetch(
    `${URL}/rest/v1/diagrams?id=eq.${id}&select=*`,
    { headers: headers() }
  )
  if (!res.ok) return null
  const arr = await res.json()
  return arr.length ? arr[0] : null
}

export async function createDiagram(orgId: string, userId: string, title?: string): Promise<DiagramRow> {
  const res = await fetch(`${URL}/rest/v1/diagrams`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      organization_id: orgId,
      title: title || 'Untitled Diagram',
      created_by: userId,
      updated_by: userId,
    }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create diagram')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function saveDiagram(
  id: string,
  userId: string,
  updates: {
    title?: string
    description?: string
    process_context?: string
    canvas_data?: { nodes: unknown[]; edges: unknown[]; notes?: string; artifacts?: unknown[]; groups?: unknown[] }
  }
): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/diagrams?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ ...updates, updated_by: userId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to save diagram')
  }
  const rows = await res.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Save failed: diagram not found in database')
  }
}

export async function archiveDiagram(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/diagrams?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ archived_at: new Date().toISOString() }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to archive diagram')
  }
}

export async function restoreDiagram(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/diagrams?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ archived_at: null }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to restore diagram')
  }
}

// ─── Permissions ────────────────────────────────────────
export async function getDiagramPermissions(diagramId: string) {
  const res = await fetch(
    `${URL}/rest/v1/diagram_permissions?diagram_id=eq.${diagramId}&select=*,profiles(email,display_name)`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function setDiagramPermission(
  diagramId: string,
  userId: string,
  permission: 'viewer' | 'editor' | 'owner',
  grantedBy: string
) {
  const res = await fetch(`${URL}/rest/v1/diagram_permissions`, {
    method: 'POST',
    headers: {
      ...headers(),
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      diagram_id: diagramId,
      user_id: userId,
      permission,
      granted_by: grantedBy,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to set permission')
  }
}

export async function removeDiagramPermission(diagramId: string, userId: string) {
  const res = await fetch(
    `${URL}/rest/v1/diagram_permissions?diagram_id=eq.${diagramId}&user_id=eq.${userId}`,
    { method: 'DELETE', headers: headers() }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to remove permission')
  }
}

// ─── Org Invites ────────────────────────────────────────
export async function createInviteCode(orgId: string, userId: string): Promise<string> {
  const code = Math.random().toString(36).substring(2, 10).toUpperCase()
  const res = await fetch(`${URL}/rest/v1/org_invites`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      organization_id: orgId,
      code,
      created_by: userId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to create invite')
  }
  return code
}

export async function getOrgMembers(orgId: string) {
  const res = await fetch(
    `${URL}/rest/v1/profiles?organization_id=eq.${orgId}&select=id,email,display_name,role`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

// ─── Group Templates ───────────────────────────────────
export interface GroupTemplateRow {
  id: string
  organization_id: string
  name: string
  description: string | null
  created_by: string | null
  template_data: {
    group: { label: string; color?: string; width: number; height: number }
    systems: { label: string; systemType: string; physicalSystem?: string; modules?: unknown[]; relativeX: number; relativeY: number; width?: number; height?: number }[]
    edges: { sourceIdx: number; targetIdx: number; data: unknown }[]
  }
  created_at: string
  updated_at: string
}

export async function listGroupTemplates(orgId: string): Promise<GroupTemplateRow[]> {
  const res = await fetch(
    `${URL}/rest/v1/group_templates?organization_id=eq.${orgId}&select=*&order=name.asc`,
    { headers: headers() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function saveGroupTemplate(
  orgId: string,
  userId: string,
  name: string,
  description: string | null,
  templateData: GroupTemplateRow['template_data']
): Promise<GroupTemplateRow> {
  const res = await fetch(`${URL}/rest/v1/group_templates`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      organization_id: orgId,
      name,
      description,
      created_by: userId,
      template_data: templateData,
    }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to save template')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function deleteGroupTemplate(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/group_templates?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to delete template')
  }
}
