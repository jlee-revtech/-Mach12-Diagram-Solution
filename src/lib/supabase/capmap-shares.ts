// ─── Capability Map (workspace) read-only share links ───
// Org-level read-only sharing for the Capability Map workspace: a code grants
// anon (logged-out) READ of the org's capability list + logical/physical system
// mappings + value streams, gated by RLS on cm_capability_shares (migration 039).

import type { CapabilityWithSystems, CapabilitySystemLink, Capability } from '@/lib/capmap/types'
import type { BedrockSystem, BedrockPhysicalSystem, BedrockSystemWithPhysicals } from '@/lib/bedrock/types'
import type { Workstream } from '@/lib/workstream/types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)?.access_token ?? null
  } catch {
    return null
  }
}

function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'apikey': ANON, 'Authorization': `Bearer ${getToken()}`, 'Accept': 'application/json' }
}
function anonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'apikey': ANON, 'Accept': 'application/json' }
}

// PostgREST caps GETs at db-max-rows (1000). Page via Range for pools that exceed it.
async function fetchAllPaginated<T>(url: string, hdrs: Record<string, string>, pageSize = 1000): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const res = await fetch(url, { headers: { ...hdrs, 'Range-Unit': 'items', 'Range': `${from}-${from + pageSize - 1}` } })
    if (!res.ok) { if (res.status === 416) break; return all }
    const chunk = (await res.json()) as T[]
    all.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }
  return all
}

export interface CmCapabilityShare {
  id: string
  organization_id: string
  code: string
  created_by: string | null
  expires_at: string | null
  created_at: string
}

function generateShareCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 14; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// ─── Authed CRUD (org members) ─────────────────────────

export async function createCmCapabilityShare(orgId: string, userId: string, expiresAt?: string | null): Promise<CmCapabilityShare> {
  const res = await fetch(`${URL}/rest/v1/cm_capability_shares`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, code: generateShareCode(), created_by: userId || null, expires_at: expiresAt || null }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error((Array.isArray(arr) ? arr[0]?.message : arr?.message) || 'Failed to create share link')
  return Array.isArray(arr) ? arr[0] : arr
}

export async function listCmCapabilityShares(orgId: string): Promise<CmCapabilityShare[]> {
  const res = await fetch(
    `${URL}/rest/v1/cm_capability_shares?organization_id=eq.${orgId}&select=*&order=created_at.desc`,
    { headers: authHeaders() }
  )
  if (!res.ok) return []
  return res.json()
}

export async function deleteCmCapabilityShare(id: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/cm_capability_shares?id=eq.${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'Prefer': 'return=minimal' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to revoke share link')
  }
}

// ─── Anon (public read-only via code) ──────────────────

export async function getCmShareByCode(code: string): Promise<CmCapabilityShare | null> {
  const res = await fetch(`${URL}/rest/v1/cm_capability_shares?code=eq.${encodeURIComponent(code)}&select=*`, { headers: anonHeaders() })
  if (!res.ok) return null
  const arr = await res.json()
  if (!arr.length) return null
  const share = arr[0] as CmCapabilityShare
  if (share.expires_at && new Date(share.expires_at) < new Date()) return null
  return share
}

export async function listCapabilityMapAnon(orgId: string): Promise<CapabilityWithSystems[]> {
  const [caps, links] = await Promise.all([
    fetchAllPaginated<Capability>(`${URL}/rest/v1/cm_capabilities?organization_id=eq.${orgId}&archived_at=is.null&select=*&order=sort_order.asc,name.asc`, anonHeaders()),
    fetchAllPaginated<CapabilitySystemLink>(`${URL}/rest/v1/cm_capability_systems?organization_id=eq.${orgId}&select=*`, anonHeaders()),
  ])
  const logicalBy = new Map<string, string[]>()
  const physicalBy = new Map<string, string[]>()
  const push = (m: Map<string, string[]>, k: string, v: string) => {
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(v)
  }
  for (const l of links) {
    if (l.bedrock_system_id) push(logicalBy, l.capability_id, l.bedrock_system_id)
    else if (l.physical_system_id) push(physicalBy, l.capability_id, l.physical_system_id)
  }
  return caps.map(c => ({ ...c, logicalSystemIds: logicalBy.get(c.id) || [], physicalSystemIds: physicalBy.get(c.id) || [] }))
}

export async function listBedrockCatalogAnon(orgId: string): Promise<BedrockSystemWithPhysicals[]> {
  const [sysRes, physRes] = await Promise.all([
    fetch(`${URL}/rest/v1/bedrock_systems?organization_id=eq.${orgId}&archived_at=is.null&select=*&order=sort_order.asc,label.asc`, { headers: anonHeaders() }),
    fetch(`${URL}/rest/v1/bedrock_physical_systems?select=*,bedrock_systems!inner(organization_id)&bedrock_systems.organization_id=eq.${orgId}&order=sort_order.asc`, { headers: anonHeaders() }),
  ])
  if (!sysRes.ok) return []
  const systems: BedrockSystem[] = await sysRes.json()
  const physRows = physRes.ok ? await physRes.json() : []
  const physicals: BedrockPhysicalSystem[] = (physRows as (BedrockPhysicalSystem & { bedrock_systems?: unknown })[]).map(({ bedrock_systems, ...rest }) => rest)
  const byParent = new Map<string, BedrockPhysicalSystem[]>()
  for (const p of physicals) {
    if (!byParent.has(p.bedrock_system_id)) byParent.set(p.bedrock_system_id, [])
    byParent.get(p.bedrock_system_id)!.push(p)
  }
  return systems.map(s => ({
    ...s,
    physicals: (byParent.get(s.id) || []).sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order),
  }))
}

export async function listWorkstreamsAnon(orgId: string): Promise<Workstream[]> {
  const res = await fetch(
    `${URL}/rest/v1/workstreams?organization_id=eq.${orgId}&archived_at=is.null&select=*&order=sort_order.asc,name.asc`,
    { headers: anonHeaders() }
  )
  if (!res.ok) return []
  return res.json()
}
