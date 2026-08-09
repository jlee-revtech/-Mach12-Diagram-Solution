// ─── Security Design Studio + Explore & Govern (060) ───────
// Browser CRUD for the eight tables added by 060: design sessions, guidance and
// options (F1 Design Advisory) and governed systems, explorations, plans, role
// map and artifacts (F2 Explore & Govern).
//
// Same fetch conventions as security-roles.ts (sbFetch + localStorage token).
// Exploration itself runs SERVER-SIDE only (src/lib/security/explore.ts via
// /api/security/explore) — nothing here ever reaches a governed system.

import type {
  DesignSession,
  DesignGuidance,
  DesignOption,
  DesignApproach,
  GovernedSystem,
  GovernedKind,
  GovernedStatus,
  GovernanceExploration,
  GovernancePlan,
  GovernancePlanDoc,
  GovernanceRoleMapEntry,
  GovernanceArtifact,
  ExplorationFindings,
  PlanStatus,
  RoleHarmonization,
} from '@/lib/security/types'

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

async function one<T>(res: Response, failure: string): Promise<T> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { message?: string }).message || failure)
  return (Array.isArray(body) ? body[0] : body) as T
}

async function ok(res: Response, failure: string): Promise<void> {
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { message?: string }).message || failure) }
}

// ─── Design sessions (security_design_sessions) ────────

export async function listDesignSessions(orgId: string): Promise<DesignSession[]> {
  return fetchAllPaginated<DesignSession>(
    `${URL}/rest/v1/security_design_sessions?organization_id=eq.${orgId}&select=*&order=created_at.desc`,
    headers()
  )
}

export async function createDesignSession(
  orgId: string,
  fields: { title: string; scope?: string | null; workstream_id?: string | null },
): Promise<DesignSession> {
  const res = await sbFetch(`${URL}/rest/v1/security_design_sessions`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ organization_id: orgId, ...fields }),
  })
  return one<DesignSession>(res, 'Failed to create design session')
}

export async function updateDesignSession(
  sessionId: string,
  fields: Partial<Pick<DesignSession, 'title' | 'scope' | 'workstream_id' | 'status'>>,
): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/security_design_sessions?id=eq.${sessionId}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  })
  await ok(res, 'Failed to update design session')
}

export async function deleteDesignSession(sessionId: string): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/security_design_sessions?id=eq.${sessionId}`, { method: 'DELETE', headers: headers() })
  await ok(res, 'Failed to delete design session')
}

// ─── Guidance (security_design_guidance) ───────────────

export async function listDesignGuidance(orgId: string, sessionId?: string): Promise<DesignGuidance[]> {
  const scope = sessionId ? `&session_id=eq.${sessionId}` : ''
  return fetchAllPaginated<DesignGuidance>(
    `${URL}/rest/v1/security_design_guidance?organization_id=eq.${orgId}${scope}&select=*&order=sort_order.asc,created_at.asc`,
    headers()
  )
}

export async function addDesignGuidance(
  orgId: string,
  sessionId: string,
  item: { topic: string; body: string; citations?: { sourceCode?: string; sourceTitle?: string }[]; sort_order?: number },
): Promise<DesignGuidance> {
  const res = await sbFetch(`${URL}/rest/v1/security_design_guidance`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      organization_id: orgId,
      session_id: sessionId,
      topic: item.topic,
      body: item.body,
      citations: item.citations ?? [],
      sort_order: item.sort_order ?? 0,
    }),
  })
  return one<DesignGuidance>(res, 'Failed to add design guidance')
}

export async function removeDesignGuidance(id: string): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/security_design_guidance?id=eq.${id}`, { method: 'DELETE', headers: headers() })
  await ok(res, 'Failed to remove design guidance')
}

// ─── Options (security_design_options) ─────────────────

export async function listDesignOptions(orgId: string, sessionId?: string): Promise<DesignOption[]> {
  const scope = sessionId ? `&session_id=eq.${sessionId}` : ''
  return fetchAllPaginated<DesignOption>(
    `${URL}/rest/v1/security_design_options?organization_id=eq.${orgId}${scope}&select=*&order=sort_order.asc,created_at.asc`,
    headers()
  )
}

export async function addDesignOption(
  orgId: string,
  sessionId: string,
  option: {
    name: string
    summary?: string | null
    approach?: DesignApproach
    pros?: string[]
    cons?: string[]
    effort?: string | null
    risk?: string | null
    recommended?: boolean
    sort_order?: number
  },
): Promise<DesignOption> {
  const res = await sbFetch(`${URL}/rest/v1/security_design_options`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      organization_id: orgId,
      session_id: sessionId,
      name: option.name,
      summary: option.summary ?? null,
      approach: option.approach ?? 'standard',
      pros: option.pros ?? [],
      cons: option.cons ?? [],
      effort: option.effort ?? null,
      risk: option.risk ?? null,
      recommended: option.recommended ?? false,
      sort_order: option.sort_order ?? 0,
    }),
  })
  return one<DesignOption>(res, 'Failed to add design option')
}

export async function updateDesignOption(
  optionId: string,
  fields: Partial<Pick<DesignOption,
    'name' | 'summary' | 'approach' | 'pros' | 'cons' | 'effort' | 'risk' | 'recommended' | 'decision' | 'decision_rationale' | 'sort_order'>>,
): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/security_design_options?id=eq.${optionId}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  })
  await ok(res, 'Failed to update design option')
}

export async function removeDesignOption(id: string): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/security_design_options?id=eq.${id}`, { method: 'DELETE', headers: headers() })
  await ok(res, 'Failed to remove design option')
}

// ─── Governed systems (governed_systems) ───────────────

export async function listGovernedSystems(orgId: string): Promise<GovernedSystem[]> {
  return fetchAllPaginated<GovernedSystem>(
    `${URL}/rest/v1/governed_systems?organization_id=eq.${orgId}&select=*&order=name.asc`,
    headers()
  )
}

export async function createGovernedSystem(
  orgId: string,
  fields: {
    name: string
    kind?: GovernedKind
    vendor?: string | null
    base_url?: string | null
    source_path?: string | null
    description?: string | null
    criticality?: 'low' | 'medium' | 'high' | null
  },
): Promise<GovernedSystem> {
  // Upsert on (organization_id, name) so re-registering refreshes the details.
  const res = await sbFetch(`${URL}/rest/v1/governed_systems?on_conflict=organization_id,name`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({ organization_id: orgId, kind: fields.kind ?? 'custom', ...fields }),
  })
  return one<GovernedSystem>(res, 'Failed to register governed system')
}

export async function updateGovernedSystem(
  systemId: string,
  fields: Partial<Pick<GovernedSystem,
    'name' | 'kind' | 'vendor' | 'base_url' | 'source_path' | 'description' | 'criticality' | 'status'>>,
): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/governed_systems?id=eq.${systemId}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  })
  await ok(res, 'Failed to update governed system')
}

export async function deleteGovernedSystem(systemId: string): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/governed_systems?id=eq.${systemId}`, { method: 'DELETE', headers: headers() })
  await ok(res, 'Failed to delete governed system')
}

// ─── Explorations (governance_explorations) ────────────

export async function listExplorations(orgId: string, systemId?: string): Promise<GovernanceExploration[]> {
  const scope = systemId ? `&system_id=eq.${systemId}` : ''
  return fetchAllPaginated<GovernanceExploration>(
    `${URL}/rest/v1/governance_explorations?organization_id=eq.${orgId}${scope}&select=*&order=created_at.desc`,
    headers()
  )
}

/** Newest exploration for a system, or null when it has never been explored. */
export async function getLatestExploration(orgId: string, systemId: string): Promise<GovernanceExploration | null> {
  const res = await sbFetch(
    `${URL}/rest/v1/governance_explorations?organization_id=eq.${orgId}&system_id=eq.${systemId}&select=*&order=created_at.desc&limit=1`,
    { headers: headers() }
  )
  if (!res.ok) return null
  const rows = (await res.json()) as GovernanceExploration[]
  return rows[0] ?? null
}

/** Convenience: the findings of the newest exploration, or null. Never fabricates. */
export async function getLatestFindings(orgId: string, systemId: string): Promise<ExplorationFindings | null> {
  const row = await getLatestExploration(orgId, systemId)
  if (!row || !row.findings || !('scanned' in row.findings)) return null
  return row.findings as ExplorationFindings
}

// ─── Plans (governance_plans) ──────────────────────────

export async function listPlans(orgId: string, systemId?: string): Promise<GovernancePlan[]> {
  const scope = systemId ? `&system_id=eq.${systemId}` : ''
  return fetchAllPaginated<GovernancePlan>(
    `${URL}/rest/v1/governance_plans?organization_id=eq.${orgId}${scope}&select=*&order=created_at.desc`,
    headers()
  )
}

export async function getPlan(orgId: string, planId: string): Promise<GovernancePlan | null> {
  const res = await sbFetch(
    `${URL}/rest/v1/governance_plans?organization_id=eq.${orgId}&id=eq.${planId}&select=*&limit=1`,
    { headers: headers() }
  )
  if (!res.ok) return null
  const rows = (await res.json()) as GovernancePlan[]
  return rows[0] ?? null
}

/**
 * Move a plan through draft → review → approved | rejected (and 'built', which
 * the build route sets). Approving stamps approved_at; building stamps built_at.
 * The fail-closed build gate itself lives in the API route, not here.
 */
export async function updatePlanStatus(planId: string, status: PlanStatus): Promise<void> {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status, updated_at: now }
  if (status === 'approved') patch.approved_at = now
  if (status === 'built') patch.built_at = now
  const res = await sbFetch(`${URL}/rest/v1/governance_plans?id=eq.${planId}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(patch),
  })
  await ok(res, 'Failed to update plan status')
}

export async function updatePlanDoc(planId: string, plan: GovernancePlanDoc): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/governance_plans?id=eq.${planId}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ plan, updated_at: new Date().toISOString() }),
  })
  await ok(res, 'Failed to update plan')
}

// ─── Role map (governance_role_map) ────────────────────

export async function listRoleMap(orgId: string, planId?: string): Promise<GovernanceRoleMapEntry[]> {
  const scope = planId ? `&plan_id=eq.${planId}` : ''
  return fetchAllPaginated<GovernanceRoleMapEntry>(
    `${URL}/rest/v1/governance_role_map?organization_id=eq.${orgId}${scope}&select=*&order=external_role.asc`,
    headers()
  )
}

/** Upsert on (plan_id, external_role) so a re-run refreshes the harmonization. */
export async function upsertRoleMap(
  orgId: string,
  planId: string,
  entries: RoleHarmonization[],
): Promise<GovernanceRoleMapEntry[]> {
  if (entries.length === 0) return []
  const rows = entries.map(e => ({
    organization_id: orgId,
    plan_id: planId,
    external_role: e.externalRole,
    role_id: e.roleId ?? null,
    persona_id: e.personaId ?? null,
    disposition: e.disposition,
    confidence: e.confidence,
    rationale: e.rationale,
  }))
  const res = await sbFetch(`${URL}/rest/v1/governance_role_map?on_conflict=plan_id,external_role`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  })
  const body = await res.json().catch(() => ([]))
  if (!res.ok) throw new Error((body as { message?: string }).message || 'Failed to save role map')
  return body as GovernanceRoleMapEntry[]
}

export async function removeRoleMapEntry(id: string): Promise<void> {
  const res = await sbFetch(`${URL}/rest/v1/governance_role_map?id=eq.${id}`, { method: 'DELETE', headers: headers() })
  await ok(res, 'Failed to remove role map entry')
}

// ─── Artifacts (governance_artifacts) ──────────────────

export async function listArtifacts(orgId: string, planId?: string): Promise<GovernanceArtifact[]> {
  const scope = planId ? `&plan_id=eq.${planId}` : ''
  return fetchAllPaginated<GovernanceArtifact>(
    `${URL}/rest/v1/governance_artifacts?organization_id=eq.${orgId}${scope}&select=*&order=created_at.asc`,
    headers()
  )
}
