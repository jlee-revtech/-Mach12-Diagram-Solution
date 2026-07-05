import { NextRequest } from 'next/server'
import {
  generateSectionContent, createKnowledgeClient,
  type SectionKind, type SectionContent, type WorkstreamSectionContent,
  type ClarifyingQuestion, type KbGap, type WorkshopFocus, type KnowledgeClient,
} from '@jlee-revtech/agent-core'
import { serverModelDb, assemblePreRead, workstreamName } from '@/lib/workshop/server'

// Generate (or revise) the facilitation content for one agenda section.
// Branches by section_kind: overview (no grounding), workstream (arch pre-read +
// RAG grounding), evaluation (reads the workstream sections' recommended
// decisions). Server-side compute + persistence with the service key, scoped by
// organization_id (the route validates the workshop belongs to the org). Mirrors
// brief/route.ts for auth + client construction.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

const knowledge: KnowledgeClient = createKnowledgeClient({
  url: process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY,
  voyageKey: process.env.VOYAGE_API_KEY,
  voyageModel: process.env.VOYAGE_MODEL,
})

const KB_CHARS_CAP = 9000

type AgendaItemRow = {
  id: string
  title: string
  objective: string | null
  section_kind: SectionKind | null
  workstream_code: string | null
  timebox_minutes: number | null
  focus_type: WorkshopFocus | null
}

type ContentRow = {
  agenda_item_id: string
  section_kind: SectionKind | null
  content: SectionContent | null
  version: number | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      workshopId,
      orgId,
      agendaItemId,
      feedback,
      clarificationAnswers,
    }: {
      workshopId: string
      orgId: string
      agendaItemId: string
      feedback?: string
      clarificationAnswers?: { question: string; answer: string }[]
    } = body

    if (!orgId || !workshopId || !agendaItemId) {
      return json({ error: 'orgId, workshopId, and agendaItemId are required' }, 400)
    }

    const db = serverModelDb()

    // Load + org-scope the workshop.
    const { data: ws } = await db
      .from('workshops')
      .select('id, topic, title, customer_name, objective, duration_minutes, workstream_codes, facilitation_prompt')
      .eq('id', workshopId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!ws) return json({ error: 'Workshop not found for this organization' }, 404)

    // Load the agenda item (must belong to the workshop).
    const { data: item } = await db
      .from('workshop_agenda_items')
      .select('id, title, objective, section_kind, workstream_code, timebox_minutes, focus_type')
      .eq('id', agendaItemId)
      .eq('workshop_id', workshopId)
      .maybeSingle<AgendaItemRow>()
    if (!item) return json({ error: 'Agenda item not found for this workshop' }, 404)

    const topic = (ws.topic as string) || (ws.title as string) || ''
    const customerName = (ws.customer_name as string) || undefined
    const durationMinutes = (ws.duration_minutes as number) || undefined
    // Workshop-level guidance (047): threaded into every section generate as
    // `guidance`, SEPARATE from the per-section `feedback` revise instruction.
    const guidance = ((ws.facilitation_prompt as string | null) || '').trim() || undefined
    const sectionKind: SectionKind = (item.section_kind as SectionKind) || 'overview'
    const timeboxMinutes = item.timebox_minutes ?? undefined
    const focus = (item.focus_type as WorkshopFocus) || undefined
    const objective = item.objective || undefined

    // Prior content for the revise path.
    const { data: priorRow } = await db
      .from('workshop_agenda_content')
      .select('agenda_item_id, section_kind, content, version')
      .eq('agenda_item_id', agendaItemId)
      .maybeSingle<ContentRow>()
    const priorContent = (priorRow?.content as SectionContent | null) || undefined

    // ─── Grounding, branched by section kind ──────────────────────
    let modelContext: string | undefined
    let knowledgeContext: string | undefined
    let knowledgeThin = false
    let wsName: string | undefined
    let workstreamDecisions:
      | {
          workstreamCode: string
          workstreamName?: string
          decisions: { title: string; recommendation: string; rationale?: string }[]
        }[]
      | undefined

    if (sectionKind === 'workstream') {
      const code = item.workstream_code || ''
      wsName = code ? await workstreamName(db, orgId, code) : undefined
      if (code) {
        // (a) architecture pre-read scoped to this single workstream.
        modelContext = (await assemblePreRead(db, orgId, [code])) || undefined
        // (b) RAG grounding scoped to this workstream.
        const query = [item.title, objective, topic, wsName].filter(Boolean).join(' — ')
        try {
          const { hits } = await knowledge.search({ query, workstreams: [code], limit: 6 })
          if (hits.length) {
            let blob = ''
            for (const h of hits) {
              if (blob.length >= KB_CHARS_CAP) break
              blob += (blob ? '\n\n' : '') + h.content
            }
            knowledgeContext = blob.slice(0, KB_CHARS_CAP) || undefined
          }
          knowledgeThin = hits.length < 2
        } catch {
          // Retrieval failed (kb unconfigured / transient): treat as thin grounding.
          knowledgeThin = true
        }
      } else {
        knowledgeThin = true
      }
    } else if (sectionKind === 'evaluation') {
      // Gather every workstream section's recommended decisions.
      const { data: rows } = await db
        .from('workshop_agenda_content')
        .select('agenda_item_id, section_kind, content, version')
        .eq('workshop_id', workshopId)
      const wsRows = (rows || []).filter(
        (r): r is ContentRow =>
          r.section_kind === 'workstream' && !!r.content && (r.content as SectionContent).kind === 'workstream',
      )
      const decisionsByCode = new Map<
        string,
        { workstreamCode: string; workstreamName?: string; decisions: { title: string; recommendation: string; rationale?: string }[] }
      >()
      for (const r of wsRows) {
        const c = r.content as WorkstreamSectionContent
        const code = c.workstreamCode
        const entry = decisionsByCode.get(code) || {
          workstreamCode: code,
          workstreamName: c.workstreamName || (await workstreamName(db, orgId, code)),
          decisions: [],
        }
        for (const d of c.keyDecisions || []) {
          entry.decisions.push({
            title: d.title,
            recommendation: d.recommendedDecision.recommendation,
            rationale: d.recommendedDecision.rationale,
          })
        }
        decisionsByCode.set(code, entry)
      }
      workstreamDecisions = Array.from(decisionsByCode.values())
    }
    // overview: no grounding.

    // ─── Generate ──────────────────────────────────────────────────
    const result = await generateSectionContent({
      sectionKind,
      title: item.title,
      objective,
      topic,
      customerName,
      workstream: sectionKind === 'workstream' && item.workstream_code
        ? { code: item.workstream_code, name: wsName || item.workstream_code }
        : undefined,
      focus,
      timeboxMinutes,
      durationMinutes,
      modelContext,
      knowledgeContext,
      knowledgeThin,
      priorContent,
      feedback: feedback || undefined,
      guidance,
      clarificationAnswers: clarificationAnswers?.length ? clarificationAnswers : undefined,
      workstreamDecisions,
      anthropicApiKey: ANTHROPIC_KEY,
    })
    if (!result) return json({ error: 'Failed to generate section content' }, 502)

    // ─── App-side KB-gap injection (PLAN §5 step 7) ────────────────
    let kbGaps: KbGap[] = result.kbGaps || []
    if (kbGaps.length === 0 && knowledgeThin && sectionKind === 'workstream' && item.workstream_code) {
      kbGaps = [
        {
          workstreamCode: item.workstream_code,
          topic: objective || item.title,
          rationale:
            'No customer or A&D-specific knowledge was retrieved for this workstream topic; seed a vibe-skill bundle to ground it.',
        },
      ]
    }

    const clarifyingQuestions: ClarifyingQuestion[] = result.clarifyingQuestions || []
    const status =
      clarifyingQuestions.length > 0 && !feedback && !(clarificationAnswers?.length)
        ? 'needs_input'
        : 'final'

    // ─── Persist (upsert on agenda_item_id; bump version on update) ─
    const persisted = await upsertAgendaContentServer(db, {
      workshopId,
      agendaItemId,
      sectionKind,
      content: result.content,
      clarifyingQuestions,
      kbGaps,
      status,
      priorVersion: priorRow?.version ?? null,
    })

    return json(
      {
        content: result.content,
        clarifyingQuestions,
        kbGaps,
        groundingUsed: result.groundingUsed,
        version: persisted.version,
        status: persisted.status,
      },
      200,
    )
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

// Service-key upsert of a section content row (server-side twin of the browser
// upsertAgendaContent in src/lib/supabase/workshops.ts; that one reads the JWT
// from localStorage and cannot run server-side). Read-then-write on the
// agenda_item_id UNIQUE key, bumping version on update.
async function upsertAgendaContentServer(
  db: ReturnType<typeof serverModelDb>,
  data: {
    workshopId: string
    agendaItemId: string
    sectionKind: SectionKind
    content: SectionContent
    clarifyingQuestions: ClarifyingQuestion[]
    kbGaps: KbGap[]
    status: 'needs_input' | 'final'
    priorVersion: number | null
  },
): Promise<{ version: number; status: string }> {
  const nowIso = new Date().toISOString()
  const row = {
    workshop_id: data.workshopId,
    agenda_item_id: data.agendaItemId,
    section_kind: data.sectionKind,
    content: data.content,
    clarifying_questions: data.clarifyingQuestions,
    kb_gaps: data.kbGaps,
    status: data.status,
    updated_at: nowIso,
  }

  if (data.priorVersion != null) {
    const { data: updated, error } = await db
      .from('workshop_agenda_content')
      .update({ ...row, version: data.priorVersion + 1 })
      .eq('agenda_item_id', data.agendaItemId)
      .select('version, status')
      .maybeSingle<{ version: number; status: string }>()
    if (error) throw new Error(error.message)
    return { version: updated?.version ?? data.priorVersion + 1, status: updated?.status ?? data.status }
  }

  const { data: inserted, error } = await db
    .from('workshop_agenda_content')
    .insert({ ...row, version: 1, created_at: nowIso })
    .select('version, status')
    .maybeSingle<{ version: number; status: string }>()
  if (error) throw new Error(error.message)
  return { version: inserted?.version ?? 1, status: inserted?.status ?? data.status }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
