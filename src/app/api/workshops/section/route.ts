import { NextRequest } from 'next/server'
import {
  generateSectionContent, createKnowledgeClient,
  type SectionKind, type SectionContent, type WorkstreamSectionContent,
  type AssessmentSectionContent, type OpportunityItem,
  type ClarifyingQuestion, type KbGap, type WorkshopFocus, type KnowledgeClient,
} from '@jlee-revtech/agent-core'
import { serverModelDb, assemblePreRead, workstreamName, assembleAttachmentsContext, primaryRoster } from '@/lib/workshop/server'

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
      .select('id, topic, title, customer_name, objective, duration_minutes, workstream_codes, primary_workstream_codes, facilitation_prompt')
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

    // 055: the primary-workstream lens + facilitator attachments, threaded into
    // every section kind.
    const primaries = await primaryRoster(db, orgId, ws as { workstream_codes?: string[] | null; primary_workstream_codes?: string[] | null })
    const primaryCodes = primaries.map((p) => p.code)
    const attachmentsContext = await assembleAttachmentsContext(db, workshopId)

    // ─── Grounding, branched by section kind ──────────────────────
    let modelContext: string | undefined
    let knowledgeContext: string | undefined
    let knowledgeThin = false
    let wsName: string | undefined
    let isPrimary = false
    let workstreamDecisions:
      | {
          workstreamCode: string
          workstreamName?: string
          decisions: { title: string; recommendation: string; rationale?: string }[]
        }[]
      | undefined
    let primaryDecisions: typeof workstreamDecisions
    // roadmap only (056): every assessment section's candidate opportunities.
    let workstreamOpportunities:
      | {
          workstreamCode: string
          workstreamName?: string
          opportunities: {
            title: string
            dimension: 'process' | 'data' | 'technology'
            summary?: string
            painPoints?: string[]
            impact?: string
            effort?: string
          }[]
        }[]
      | undefined

    // Gather workstream sections' recommended decisions from the authored
    // content, restricted to the given codes (evaluation: every active
    // workstream; integrated sections: the primary workstream(s) only).
    const gatherDecisions = async (codeFilter: Set<string>, includeUncoded = false) => {
      const { data: rows } = await db
        .from('workshop_agenda_content')
        .select('agenda_item_id, section_kind, content, version')
        .eq('workshop_id', workshopId)
      const wsRows = (rows || []).filter(
        (r): r is ContentRow =>
          r.section_kind === 'workstream' && !!r.content && (r.content as SectionContent).kind === 'workstream' &&
          ((r.content as WorkstreamSectionContent).workstreamCode
            ? codeFilter.has((r.content as WorkstreamSectionContent).workstreamCode)
            : includeUncoded),
      )
      const byCode = new Map<
        string,
        { workstreamCode: string; workstreamName?: string; decisions: { title: string; recommendation: string; rationale?: string }[] }
      >()
      for (const r of wsRows) {
        const c = r.content as WorkstreamSectionContent
        const code = c.workstreamCode
        const entry = byCode.get(code) || {
          workstreamCode: code,
          workstreamName: c.workstreamName || (await workstreamName(db, orgId, code)),
          decisions: [],
        }
        for (const d of c.keyDecisions || []) {
          // recommendedDecision.rationale is string[] (content reframe); the
          // decisions contract expects a single string, so join the bullets.
          // Defensive against old rows that persisted a plain string.
          const rat = d.recommendedDecision?.rationale
          entry.decisions.push({
            title: d.title,
            recommendation: d.recommendedDecision?.recommendation,
            rationale: Array.isArray(rat) ? rat.join('; ') : (rat || undefined),
          })
        }
        byCode.set(code, entry)
      }
      return Array.from(byCode.values())
    }

    // 056: gather every assessment section's candidate opportunities for the
    // roadmap synthesis, restricted to the active workstream codes.
    const gatherOpportunities = async (codeFilter: Set<string>) => {
      const { data: rows } = await db
        .from('workshop_agenda_content')
        .select('agenda_item_id, section_kind, content, version')
        .eq('workshop_id', workshopId)
      const aRows = (rows || []).filter(
        (r): r is ContentRow =>
          r.section_kind === 'assessment' && !!r.content && (r.content as SectionContent).kind === 'assessment' &&
          (!(r.content as AssessmentSectionContent).workstreamCode || codeFilter.has((r.content as AssessmentSectionContent).workstreamCode)),
      )
      const out: NonNullable<typeof workstreamOpportunities> = []
      for (const r of aRows) {
        const c = r.content as AssessmentSectionContent
        const pack = (items: OpportunityItem[] | undefined, dimension: 'process' | 'data' | 'technology') =>
          (items || []).map((o) => ({
            title: o.title,
            dimension,
            ...(o.summary ? { summary: o.summary } : {}),
            ...(o.painPoints?.length ? { painPoints: o.painPoints } : {}),
            ...(o.impact ? { impact: o.impact } : {}),
            ...(o.effort ? { effort: o.effort } : {}),
          }))
        const opportunities = [
          ...pack(c.processOpportunities, 'process'),
          ...pack(c.dataOpportunities, 'data'),
          ...pack(c.technologyOpportunities, 'technology'),
        ]
        if (!opportunities.length) continue
        out.push({
          workstreamCode: c.workstreamCode || 'unknown',
          workstreamName: c.workstreamName || (c.workstreamCode ? await workstreamName(db, orgId, c.workstreamCode) : undefined),
          opportunities,
        })
      }
      return out
    }

    if (sectionKind === 'workstream' || sectionKind === 'assessment') {
      const code = item.workstream_code || ''
      wsName = code ? await workstreamName(db, orgId, code) : undefined
      isPrimary = !!code && primaryCodes.includes(code)
      // Integrated decision section: ground it on the primary sections' decisions
      // so far (assessment sections carry questions, not decisions).
      if (sectionKind === 'workstream' && code && !isPrimary && primaryCodes.length) {
        const gathered = await gatherDecisions(new Set(primaryCodes))
        primaryDecisions = gathered.length ? gathered : undefined
      }
      if (code) {
        // (a) architecture pre-read: this workstream, plus the primary
        // workstream(s) when this is an integrated section so the model sees
        // the architecture it is framing its input against.
        const preReadCodes = isPrimary || !primaryCodes.length
          ? [code]
          : [code, ...primaryCodes.filter((c) => c !== code)]
        modelContext = (await assemblePreRead(db, orgId, preReadCodes)) || undefined
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
      // Gather every active workstream section's recommended decisions
      // (excludes hidden workstreams removed from the workshop's active set).
      workstreamDecisions = await gatherDecisions(new Set((ws.workstream_codes as string[] | null) || []), true)
    } else if (sectionKind === 'roadmap') {
      // 056: gather every active assessment section's opportunities for sequencing.
      const gathered = await gatherOpportunities(new Set((ws.workstream_codes as string[] | null) || []))
      workstreamOpportunities = gathered.length ? gathered : undefined
    }
    // overview: no model/RAG grounding (attachments still apply).

    // ─── Generate ──────────────────────────────────────────────────
    const result = await generateSectionContent({
      sectionKind,
      title: item.title,
      objective,
      topic,
      customerName,
      workstream: (sectionKind === 'workstream' || sectionKind === 'assessment') && item.workstream_code
        ? { code: item.workstream_code, name: wsName || item.workstream_code }
        : undefined,
      primaryWorkstreams: primaries.length ? primaries : undefined,
      isPrimary,
      primaryDecisions,
      workstreamOpportunities,
      focus,
      timeboxMinutes,
      durationMinutes,
      modelContext,
      knowledgeContext,
      attachmentsContext,
      knowledgeThin,
      priorContent,
      feedback: feedback || undefined,
      guidance,
      clarificationAnswers: clarificationAnswers?.length ? clarificationAnswers : undefined,
      workstreamDecisions,
      anthropicApiKey: ANTHROPIC_KEY,
    })
    if (!result) return json({ error: 'Failed to generate section content' }, 502)

    // Carry the app-level "Notes & Considerations" through a regenerate (agent-core
    // does not model it, so it would otherwise be lost on every regeneration).
    const priorNotes = (priorContent as unknown as { notesAndConsiderations?: unknown })?.notesAndConsiderations
    if (Array.isArray(priorNotes) && priorNotes.length) {
      (result.content as unknown as { notesAndConsiderations?: unknown[] }).notesAndConsiderations = priorNotes
    }

    // ─── App-side KB-gap injection (PLAN §5 step 7) ────────────────
    let kbGaps: KbGap[] = result.kbGaps || []
    if (kbGaps.length === 0 && knowledgeThin && (sectionKind === 'workstream' || sectionKind === 'assessment') && item.workstream_code) {
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
