// ─── Security Design Studio: shared UI plumbing ────────
// Auth headers for the /api/security/* + /api/deliverables calls, and
// normalisers for the two jsonb payloads (exploration findings, governance plan)
// so the panels render an honest empty section instead of crashing when an
// exploration degraded or a plan was written with a sparse shape.

import type {
  ExplorationFindings, GovernanceExploration, GovernancePlan, GovernancePlanDoc,
} from '@/lib/security/types'

// ─── Auth header ───────────────────────────────────────
// Same localStorage-token idiom the deliverables page and AutoMapPanel use.

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    return JSON.parse(localStorage.getItem(key) || '{}')?.access_token ?? null
  } catch {
    return null
  }
}

export function authHeaders(): Record<string, string> {
  const t = getToken()
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }
}

/** Read `error`/`message` off an API response body without assuming its shape. */
export function apiError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const d = data as { error?: unknown; message?: unknown }
    if (typeof d.error === 'string' && d.error) return d.error
    if (typeof d.message === 'string' && d.message) return d.message
  }
  return fallback
}

// ─── jsonb normalisers ─────────────────────────────────

const EMPTY_FINDINGS: ExplorationFindings = {
  authModel: { notes: [] },
  discoveredRoles: [],
  permissions: [],
  surfaces: [],
  posture: { securityHeaders: {}, cookieFlags: [], authLibraries: [] },
  risks: [],
  evidence: [],
  unreachable: [],
  scanned: { urls: 0, files: 0 },
}

export function asFindings(row: GovernanceExploration | null | undefined): ExplorationFindings {
  const raw = row?.findings
  if (!raw || typeof raw !== 'object') return EMPTY_FINDINGS
  const f = raw as Partial<ExplorationFindings>
  return {
    authModel: {
      mechanism: f.authModel?.mechanism,
      idp: f.authModel?.idp,
      mfa: f.authModel?.mfa ?? null,
      notes: f.authModel?.notes ?? [],
    },
    discoveredRoles: f.discoveredRoles ?? [],
    permissions: f.permissions ?? [],
    surfaces: f.surfaces ?? [],
    posture: {
      securityHeaders: f.posture?.securityHeaders ?? {},
      cookieFlags: f.posture?.cookieFlags ?? [],
      framework: f.posture?.framework,
      authLibraries: f.posture?.authLibraries ?? [],
    },
    risks: f.risks ?? [],
    evidence: f.evidence ?? [],
    unreachable: f.unreachable ?? [],
    scanned: { urls: f.scanned?.urls ?? 0, files: f.scanned?.files ?? 0 },
  }
}

export function asPlanDoc(row: GovernancePlan | null | undefined): GovernancePlanDoc {
  const raw = row?.plan
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<GovernancePlanDoc>
  return {
    objective: p.objective ?? '',
    identity: { target: p.identity?.target ?? '', steps: p.identity?.steps ?? [] },
    roleModel: p.roleModel ?? [],
    controls: p.controls ?? [],
    sod: p.sod ?? [],
    remediation: p.remediation ?? [],
    buildPlan: p.buildPlan ?? [],
    openQuestions: p.openQuestions ?? [],
  }
}

/** Newest-first by created_at, tolerant of a missing timestamp. */
export function newestFirst<T extends { created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
}
