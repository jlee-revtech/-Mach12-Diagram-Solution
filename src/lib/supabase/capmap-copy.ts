// ─── Cross-org capability copy (client side) ───────────
// Thin wrapper over POST /api/capmap/copy. The copy itself has to run on the
// server: cm_capabilities RLS scopes on the caller's *active* org, so the
// browser can never read the base library and write the client org in one
// session. See src/app/api/capmap/copy/route.ts.

export interface CopyPreview {
  dryRun: true
  targetOrgId?: string
  targetOrgName: string
  willCreateOrg?: string
  sourceTotal: number
  willCopy: number
  willSkip: number
  systemLinks: number
  willAddMembers: number
}

export interface CopyResult {
  targetOrgId: string
  targetOrgName: string
  createdOrg: boolean
  copied: number
  skipped: number
  systemLinks: number
  workstreamsSeeded: number
  systemsSeeded: number
  membersAdded: number
  message?: string
}

export interface CopyRequest {
  sourceOrgId: string
  targetOrgId?: string
  newOrgName?: string
  includeLogicalSystems: boolean
  includeMembers: boolean
}

function accessToken(): string | null {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw)?.access_token ?? null) : null
  } catch {
    return null
  }
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const token = accessToken()
  const res = await fetch('/api/capmap/copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Copy failed')
  return data as T
}

export const previewCapabilityCopy = (req: CopyRequest) => post<CopyPreview>({ ...req, dryRun: true })
export const copyCapabilitiesToOrg = (req: CopyRequest) => post<CopyResult>({ ...req })
