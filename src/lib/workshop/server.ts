// Server-side helpers for the workshop API routes. The model and the knowledge
// fabric live in the same Supabase project, so we read/write server-side with the
// service key scoped explicitly by organization_id (the route validates the org).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { TranscriptLine } from '@jlee-revtech/agent-core'

const MODEL_URL = process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY!

export function serverModelDb(): SupabaseClient {
  return createClient(MODEL_URL, SERVICE, { auth: { persistSession: false } })
}

/** Confirm a workshop belongs to the given org; returns the row or null. */
export async function loadWorkshopForOrg(db: SupabaseClient, workshopId: string, orgId: string) {
  const { data } = await db.from('workshops').select('*').eq('id', workshopId).eq('organization_id', orgId).maybeSingle()
  return data
}

/** code -> name for the org's workstreams. */
export async function workstreamRoster(
  db: SupabaseClient,
  orgId: string,
  codes: string[],
): Promise<{ code: string; name: string }[]> {
  if (!codes.length) return []
  const { data } = await db.from('workstreams').select('code,name').eq('organization_id', orgId).in('code', codes)
  return (data || []).map((w) => ({ code: w.code as string, name: w.name as string }))
}

/** Assemble a compact pre-read of the customer's current architecture for the
 *  workstreams in scope: the homed process model + its L2 groups, and rollup
 *  counts. Grounds the brief in the customer's real model. */
export async function assemblePreRead(db: SupabaseClient, orgId: string, codes: string[]): Promise<string> {
  if (!codes.length) return ''
  const { data: ws } = await db.from('workstreams').select('id,code,name').eq('organization_id', orgId).in('code', codes)
  const { data: ru } = await db.from('workstream_rollup').select('*').eq('organization_id', orgId).in('code', codes)
  const ruBy: Record<string, Record<string, number>> = {}
  for (const r of ru || []) ruBy[r.code as string] = r as unknown as Record<string, number>
  const lines: string[] = []
  for (const w of ws || []) {
    const r = ruBy[w.code as string] || {}
    let procLine = 'no process model homed yet'
    const { data: pm } = await db
      .from('process_models')
      .select('id,title')
      .eq('workstream_id', w.id)
      .is('archived_at', null)
      .limit(1)
    if (pm?.[0]) {
      const { data: groups } = await db
        .from('process_nodes')
        .select('name')
        .eq('process_model_id', pm[0].id)
        .eq('level', 2)
        .order('sort_order')
        .limit(14)
      procLine = `process model "${pm[0].title}"${groups?.length ? ` — groups: ${groups.map((g) => g.name).join(', ')}` : ''}`
    }
    lines.push(
      `${w.name}: ${procLine}. Model coverage: ${r.capabilities || 0} capabilities, ${r.personas || 0} personas, ${r.data_elements || 0} data objects, ${r.systems || 0} systems, ${r.integrations || 0} integrations.`,
    )
  }
  return lines.join('\n')
}

/** Resolve a single workstream code to its display name for the org. */
export async function workstreamName(db: SupabaseClient, orgId: string, code: string): Promise<string> {
  if (!code) return code
  const { data } = await db.from('workstreams').select('name').eq('organization_id', orgId).eq('code', code).maybeSingle()
  return (data?.name as string) || code
}

/** Recent transcript lines for facilitation/capture, oldest-first. */
export async function recentTranscript(
  db: SupabaseClient,
  workshopId: string,
  opts: { limit?: number; sinceSeq?: number } = {},
): Promise<TranscriptLine[]> {
  let q = db.from('workshop_messages').select('speaker_name,speaker_role,content,source,seq').eq('workshop_id', workshopId)
  if (opts.sinceSeq) q = q.gt('seq', opts.sinceSeq)
  const { data } = await q.order('seq', { ascending: false }).limit(opts.limit ?? 24)
  return (data || [])
    .reverse()
    .map((m) => ({
      speaker: (m.speaker_name as string) || (m.speaker_role as string) || 'participant',
      role: (m.speaker_role as string) || undefined,
      content: m.content as string,
      source: (m.source as string) || undefined,
    }))
}
