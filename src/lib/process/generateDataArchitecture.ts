// Client helper: kick off the workstream data-architecture generation route and
// return the new diagram id (the route persists + links it back to the L3s).
// Shared by the /workstreams cards and the agent chat panel.

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    return JSON.parse(localStorage.getItem(key) || '{}')?.access_token ?? null
  } catch { return null }
}

export interface DataArchResult {
  diagramId: string
  title: string
  systemCount: number
  flowCount: number
  groupCount: number
  processCount: number
  capabilityCount: number
}

export async function generateWorkstreamDataArchitecture(
  orgId: string,
  workstreamId: string,
  userId: string,
): Promise<DataArchResult> {
  const res = await fetch('/api/workstreams/data-architecture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ orgId, workstreamId, userId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Data-architecture generation failed')
  return data as DataArchResult
}
