// Client helpers for the workstream data-architecture flow: list the L3 flows +
// their status, ask clarifying questions for a selection, and generate a diagram
// for the selected L3 flow(s). Shared by the /workstreams cards and agent panel.

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    return JSON.parse(localStorage.getItem(key) || '{}')?.access_token ?? null
  } catch { return null }
}

const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` })

export interface DataArchProcess {
  id: string
  name: string
  capabilityCount: number
  hasSystemLanes: boolean
  buildable: boolean
  existingDiagramId: string | null
}

export interface ClarifyingQuestion { id: string; question: string; why?: string }

export interface DataArchResult {
  diagramId: string
  title: string
  systemCount: number
  flowCount: number
  groupCount: number
  processCount: number
}

// List the workstream's L3 process flows with build status + whether each already
// has a data architecture.
export async function listWorkstreamDataArchProcesses(orgId: string, workstreamId: string): Promise<DataArchProcess[]> {
  const res = await fetch(`/api/workstreams/data-architecture?orgId=${encodeURIComponent(orgId)}&workstreamId=${encodeURIComponent(workstreamId)}`, {
    headers: authHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to load process flows')
  return (data.processes ?? []) as DataArchProcess[]
}

// Clarifying questions needed to build the diagram(s) for the selected L3 flows.
export async function clarifyDataArchitecture(orgId: string, workstreamId: string, processNodeIds: string[]): Promise<ClarifyingQuestion[]> {
  const res = await fetch('/api/workstreams/data-architecture', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ step: 'clarify', orgId, workstreamId, processNodeIds }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to prepare clarifying questions')
  return (data.clarifyingQuestions ?? []) as ClarifyingQuestion[]
}

// Generate + persist one data-architecture diagram for the given L3 flow(s),
// honoring any clarifying answers. Pass a single node id for a per-L3 diagram.
export async function generateWorkstreamDataArchitecture(
  orgId: string,
  workstreamId: string,
  userId: string,
  processNodeIds?: string[],
  clarificationAnswers?: { question: string; answer: string }[],
): Promise<DataArchResult> {
  const res = await fetch('/api/workstreams/data-architecture', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ step: 'generate', orgId, workstreamId, userId, processNodeIds, clarificationAnswers }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Data-architecture generation failed')
  return data as DataArchResult
}
