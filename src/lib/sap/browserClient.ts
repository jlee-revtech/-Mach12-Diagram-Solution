'use client'

// Browser-side calls into this app's /api/sap routes.
//
// The httpOnly credential cookie rides along automatically (same-origin), so
// nothing here ever handles a password beyond posting it once at logon.

import type { SapEnterpriseModel } from '@/lib/sap-model/types'
import type {
  PullDiagnostic, SapConnectionStatus, SapSystem, SapSystemInput, SnapshotSummary,
} from './types'

export interface SapCapabilities {
  directAvailable: boolean
  bridgeAvailable: boolean
  destinations: { name: string; description?: string }[]
}

export interface PullResult {
  model: SapEnterpriseModel
  snapshot: SnapshotSummary | null
  diagnostics: PullDiagnostic[]
  controllingAreas: { kokrs: string; name: string; companyCodes: number }[]
  controllingArea: string
  pulledVia: 'freestyle' | 'classrun'
  elapsedMs: number
}

function headers(token: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`The server returned an unreadable response (HTTP ${res.status}).`)
  }
  if (!res.ok) {
    const err = new Error(
      typeof json.error === 'string' ? json.error : `Request failed (HTTP ${res.status}).`
    ) as Error & { needsLogon?: boolean; diagnostics?: PullDiagnostic[] }
    if (json.needsLogon === true) err.needsLogon = true
    if (Array.isArray(json.diagnostics)) err.diagnostics = json.diagnostics as PullDiagnostic[]
    throw err
  }
  return json as T
}

export async function fetchSystems(
  token: string | null,
  orgId: string
): Promise<{ systems: SapSystem[]; capabilities: SapCapabilities }> {
  const res = await fetch(`/api/sap/systems?orgId=${encodeURIComponent(orgId)}`, {
    headers: headers(token),
    cache: 'no-store',
  })
  return unwrap(res)
}

export async function createSystem(
  token: string | null,
  orgId: string,
  userId: string,
  input: SapSystemInput
): Promise<SapSystem> {
  const res = await fetch('/api/sap/systems', {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ orgId, userId, ...input }),
  })
  return (await unwrap<{ system: SapSystem }>(res)).system
}

export async function updateSystem(
  token: string | null,
  orgId: string,
  id: string,
  input: SapSystemInput
): Promise<SapSystem> {
  const res = await fetch(`/api/sap/systems/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ orgId, ...input }),
  })
  return (await unwrap<{ system: SapSystem }>(res)).system
}

export async function deleteSystem(
  token: string | null,
  orgId: string,
  id: string
): Promise<void> {
  const res = await fetch(`/api/sap/systems/${id}?orgId=${encodeURIComponent(orgId)}`, {
    method: 'DELETE',
    headers: headers(token),
  })
  await unwrap(res)
}

export async function fetchSignedIn(token: string | null): Promise<string[]> {
  const res = await fetch('/api/sap/connect', { headers: headers(token), cache: 'no-store' })
  const json = await unwrap<{ signedInSystemIds?: string[] }>(res)
  return json.signedInSystemIds ?? []
}

export async function connectSystem(
  token: string | null,
  orgId: string,
  systemId: string,
  credentials?: { username: string; password: string }
): Promise<SapConnectionStatus> {
  const res = await fetch('/api/sap/connect', {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ orgId, systemId, ...credentials }),
  })
  const json = await unwrap<{ status: SapConnectionStatus }>(res)
  return json.status
}

export async function disconnectSystem(token: string | null, systemId: string): Promise<void> {
  await fetch(`/api/sap/connect?systemId=${encodeURIComponent(systemId)}`, {
    method: 'DELETE',
    headers: headers(token),
  })
}

export async function pullOrgModel(
  token: string | null,
  orgId: string,
  userId: string,
  systemId: string,
  controllingArea?: string
): Promise<PullResult> {
  const res = await fetch('/api/sap/org-model/pull', {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ orgId, userId, systemId, controllingArea }),
  })
  return unwrap<PullResult>(res)
}

export async function fetchSnapshots(
  token: string | null,
  orgId: string
): Promise<SnapshotSummary[]> {
  const res = await fetch(`/api/sap/org-model/snapshots?orgId=${encodeURIComponent(orgId)}`, {
    headers: headers(token),
    cache: 'no-store',
  })
  return (await unwrap<{ snapshots: SnapshotSummary[] }>(res)).snapshots
}

export async function fetchSnapshot(
  token: string | null,
  orgId: string,
  id: string
): Promise<{ summary: SnapshotSummary; model: SapEnterpriseModel; diagnostics: PullDiagnostic[] }> {
  const res = await fetch(
    `/api/sap/org-model/snapshots?orgId=${encodeURIComponent(orgId)}&id=${encodeURIComponent(id)}`,
    { headers: headers(token), cache: 'no-store' }
  )
  return unwrap(res)
}

export async function deleteSnapshot(
  token: string | null,
  orgId: string,
  id: string
): Promise<void> {
  const res = await fetch(
    `/api/sap/org-model/snapshots?orgId=${encodeURIComponent(orgId)}&id=${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: headers(token) }
  )
  await unwrap(res)
}
