import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  createKnowledgeClient,
  createCriteriaClient,
  personaForCode,
  DELIVERABLE_BY_TYPE,
  deliverableTypesFor,
  GENERATE_DELIVERABLE,
  type ToolContext,
  type GeneratedDeliverable,
  type KnowledgeClient,
} from '@jlee-revtech/agent-core'
import { sapRealizationFromEnv } from '@/lib/agents/sapRealization'

// The Deliverables Engine surface (Workpackage K2).
//
//   GET    /api/deliverables?orgId=&workstreamCode=&dtype=   list documents
//   POST   /api/deliverables                                 generate one
//   PATCH  /api/deliverables                                 change status
//
// Generation resolves the deliverable type's REQUIRED evidence slots first. If a
// required slot cannot be filled (no live SAP session, no architecture model, no
// executed-config log), the engine refuses and returns what is missing. It never
// writes generic filler: in GovCon, a document that cannot be walked back to its
// evidence is worse than no document at all.
//
// RLS (the caller's auth header) scopes every read and write to the user's org.
// There is no service-role bypass on this route.

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

const knowledge: KnowledgeClient = createKnowledgeClient({
  url: process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY,
  voyageKey: process.env.VOYAGE_API_KEY,
  voyageModel: process.env.VOYAGE_MODEL,
})
const criteria = createCriteriaClient({
  url: process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY,
})
const realization = sapRealizationFromEnv()

const LIST_COLUMNS = 'id, workstream_code, dtype, title, subject, status, content, evidence, version, created_at, updated_at'

function dbFor(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  return createClient(SUPA_URL, SUPA_ANON, {
    global: { headers: auth ? { Authorization: auth } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId')
  if (!orgId) return json({ error: 'orgId is required' }, 400)
  const workstreamCode = url.searchParams.get('workstreamCode')
  const dtype = url.searchParams.get('dtype')
  const id = url.searchParams.get('id')

  const db = dbFor(req)
  let q = db.from('deliverables').select(LIST_COLUMNS).eq('organization_id', orgId).order('created_at', { ascending: false })
  if (id) q = q.eq('id', id)
  if (workstreamCode) q = q.eq('workstream_code', workstreamCode)
  if (dtype) q = q.eq('dtype', dtype)
  const { data, error } = await q.limit(200)
  if (error) return json({ error: error.message }, 500)
  return json({
    deliverables: data ?? [],
    // The catalog, so the UI can offer only what an agent can actually produce.
    types: deliverableTypesFor(true).map((d) => ({
      type: d.type,
      title: d.title,
      purpose: d.purpose,
      audience: d.audience,
      dimensions: d.dimensions,
      architectOnly: !!d.architectOnly,
      requiredEvidence: d.evidence.filter((e) => e.required).map((e) => e.tool),
    })),
  })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad request' }, 400)
  }
  const orgId = String(body.orgId || '')
  const type = String(body.type || '')
  const subject = String(body.subject || '')
  const workstreamCode = String(body.workstreamCode || '')
  if (!orgId || !type || !subject || !workstreamCode) {
    return json({ error: 'orgId, type, subject, and workstreamCode are required' }, 400)
  }
  const def = DELIVERABLE_BY_TYPE[type]
  if (!def) return json({ error: `Unknown deliverable type "${type}"` }, 400)

  const isArchitect = workstreamCode === 'enterprise'
  if (def.architectOnly && !isArchitect) {
    return json({ error: `${def.title} is produced by the Solution Architect (workstreamCode "enterprise").` }, 400)
  }

  const db = dbFor(req)
  const { data: wsRows } = await db.from('workstreams').select('id, code, name').eq('organization_id', orgId)
  const wsByCode = new Map<string, { id: string; name: string }>((wsRows || []).map((w) => [w.code, { id: w.id, name: w.name }]))

  let saved: { id?: string } | null = null
  const persistDeliverable = async (doc: GeneratedDeliverable) => {
    const { data, error } = await db
      .from('deliverables')
      .insert({
        organization_id: orgId,
        workstream_id: wsByCode.get(doc.workstreamCode)?.id ?? null,
        workstream_code: doc.workstreamCode,
        dtype: doc.type,
        title: doc.title,
        subject: doc.subject,
        status: 'draft',
        content: { sections: doc.sections },
        evidence: doc.evidence,
        created_by: (body.userId as string | undefined) ?? null,
      })
      .select('id')
      .single()
    if (error || !data) return null
    saved = { id: (data as { id: string }).id }
    return saved
  }

  const ctx: ToolContext = {
    modelDb: db,
    orgId,
    agentWorkstreamCode: workstreamCode,
    wsByCode,
    knowledge,
    citations: [],
    tenantKey: (body.tenantKey as string | null) ?? null,
    realization,
    criteria,
    anthropicApiKey: ANTHROPIC_KEY,
    persistDeliverable,
    isArchitect,
  }

  try {
    const result = await GENERATE_DELIVERABLE.execute(
      {
        type,
        subject,
        workstream_code: workstreamCode,
        notes: body.notes ? String(body.notes) : undefined,
        process_node_id: body.processNodeId ? String(body.processNodeId) : undefined,
      },
      ctx
    )
    // The tool returns a refusal string (not a throw) when required evidence is
    // missing. Surface that honestly rather than pretending a document exists.
    if (!saved) return json({ ok: false, message: result }, 422)
    return json({ ok: true, id: (saved as { id?: string }).id, message: result })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'generation failed' }, 500)
  }
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad request' }, 400)
  }
  const id = String(body.id || '')
  const status = String(body.status || '')
  if (!id || !['draft', 'review', 'final'].includes(status)) {
    return json({ error: 'id and status (draft | review | final) are required' }, 400)
  }
  const db = dbFor(req)
  const { error } = await db.from('deliverables').update({ status }).eq('id', id)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return json({ error: 'id is required' }, 400)
  const db = dbFor(req)
  const { error } = await db.from('deliverables').delete().eq('id', id)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
}
