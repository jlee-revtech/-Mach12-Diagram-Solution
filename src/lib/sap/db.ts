// Supabase access for the SAP system registry and org-model snapshots.
//
// Every query runs under the CALLER's JWT so RLS does the org scoping, matching
// how the workstreams / agents routes already work here. No service key.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SapEnterpriseModel } from '@/lib/sap-model/types'
import type { PullDiagnostic, SapSystem, SapSystemInput, SnapshotSummary } from './types'

type Row = Record<string, unknown>

export function orgClient(req: Request): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const auth = req.headers.get('authorization') ?? ''
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: auth ? { Authorization: auth } : {} },
  })
}

function toSystem(r: Row): SapSystem {
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    name: r.name as string,
    mode: (r.mode as SapSystem['mode']) ?? 'direct',
    host: (r.host as string) ?? null,
    port: (r.port as number) ?? null,
    useSsl: r.use_ssl !== false,
    client: (r.client as string) ?? null,
    language: (r.language as string) ?? null,
    username: (r.username as string) ?? null,
    destinationName: (r.destination_name as string) ?? null,
    defaultControllingArea: (r.default_controlling_area as string) ?? null,
    description: (r.description as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

export async function listSystems(db: SupabaseClient, orgId: string): Promise<SapSystem[]> {
  const { data, error } = await db
    .from('sap_systems')
    .select('*')
    .eq('organization_id', orgId)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(toSystem)
}

export async function getSystem(
  db: SupabaseClient,
  orgId: string,
  id: string
): Promise<SapSystem | null> {
  const { data, error } = await db
    .from('sap_systems')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toSystem(data as Row) : null
}

function toColumns(input: SapSystemInput): Row {
  const direct = input.mode === 'direct'
  return {
    name: input.name.trim(),
    mode: input.mode,
    host: direct ? (input.host?.trim() || null) : null,
    port: direct ? (input.port ?? null) : null,
    use_ssl: input.useSsl !== false,
    client: direct ? (input.client?.trim() || null) : (input.client?.trim() || null),
    language: (input.language?.trim() || 'EN'),
    username: direct ? (input.username?.trim() || null) : null,
    destination_name: direct ? null : (input.destinationName?.trim() || null),
    default_controlling_area: input.defaultControllingArea?.trim().toUpperCase() || null,
    description: input.description?.trim() || null,
  }
}

export async function createSystem(
  db: SupabaseClient,
  orgId: string,
  userId: string | null,
  input: SapSystemInput
): Promise<SapSystem> {
  const { data, error } = await db
    .from('sap_systems')
    .insert({ ...toColumns(input), organization_id: orgId, created_by: userId })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return toSystem(data as Row)
}

export async function updateSystem(
  db: SupabaseClient,
  orgId: string,
  id: string,
  input: SapSystemInput
): Promise<SapSystem> {
  const { data, error } = await db
    .from('sap_systems')
    .update(toColumns(input))
    .eq('organization_id', orgId)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return toSystem(data as Row)
}

export async function deleteSystem(db: SupabaseClient, orgId: string, id: string): Promise<void> {
  const { error } = await db.from('sap_systems').delete().eq('organization_id', orgId).eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Snapshots ───────────────────────────────────────────────────────────────

export async function saveSnapshot(
  db: SupabaseClient,
  orgId: string,
  userId: string | null,
  snapshot: {
    systemId: string
    systemLabel: string
    sapClient: string
    controllingArea: string
    pulledVia: string
    model: SapEnterpriseModel
    diagnostics: PullDiagnostic[]
  }
): Promise<SnapshotSummary> {
  const { data, error } = await db
    .from('sap_org_snapshots')
    .insert({
      organization_id: orgId,
      system_id: snapshot.systemId,
      system_label: snapshot.systemLabel,
      sap_client: snapshot.sapClient,
      controlling_area: snapshot.controllingArea,
      pulled_via: snapshot.pulledVia,
      pulled_by: userId,
      model: snapshot.model,
      diagnostics: snapshot.diagnostics,
    })
    .select('id, system_id, system_label, sap_client, controlling_area, pulled_via, pulled_at')
    .single()
  if (error) throw new Error(error.message)
  return toSummary(data as Row)
}

export async function listSnapshots(
  db: SupabaseClient,
  orgId: string,
  limit = 50
): Promise<SnapshotSummary[]> {
  const { data, error } = await db
    .from('sap_org_snapshots')
    .select('id, system_id, system_label, sap_client, controlling_area, pulled_via, pulled_at')
    .eq('organization_id', orgId)
    .order('pulled_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => toSummary(r as Row))
}

export async function getSnapshot(
  db: SupabaseClient,
  orgId: string,
  id: string
): Promise<{ summary: SnapshotSummary; model: SapEnterpriseModel; diagnostics: PullDiagnostic[] } | null> {
  const { data, error } = await db
    .from('sap_org_snapshots')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const r = data as Row
  return {
    summary: toSummary(r),
    model: r.model as SapEnterpriseModel,
    diagnostics: (r.diagnostics as PullDiagnostic[]) ?? [],
  }
}

export async function deleteSnapshot(db: SupabaseClient, orgId: string, id: string): Promise<void> {
  const { error } = await db
    .from('sap_org_snapshots')
    .delete()
    .eq('organization_id', orgId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

function toSummary(r: Row): SnapshotSummary {
  return {
    id: r.id as string,
    systemId: (r.system_id as string) ?? null,
    systemLabel: r.system_label as string,
    sapClient: (r.sap_client as string) ?? null,
    controllingArea: r.controlling_area as string,
    pulledVia: (r.pulled_via as string) ?? 'freestyle',
    pulledAt: r.pulled_at as string,
  }
}
