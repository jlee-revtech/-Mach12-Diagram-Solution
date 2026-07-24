import { NextRequest } from 'next/server'
import { generateBrief, type WorkshopFocus, type SectionKind, type WorkshopArchetype } from '@jlee-revtech/agent-core'
import { serverModelDb, workstreamRoster, assemblePreRead, assembleAttachmentsContext } from '@/lib/workshop/server'

// Generate a pre-workshop Brief: a timeboxed agenda, a pre-read of the customer's
// real architecture for the topic, the gaps/decisions to drive, and the probing
// questions to prepare. The extended generateBrief classifies each agenda item
// (section_kind + workstream_code), appends a final evaluation item for 2+
// workstreams, and normalizes timeboxes to sum to durationMinutes.
//
// When a workshopId is supplied, the route also persists the result server-side
// (agenda items with section metadata, duration on the workshop, and the brief)
// with the service key, scoped by organization_id. Without a workshopId it stays
// read-only compute and the caller persists the returned brief.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      orgId,
      workshopId,
      topic,
      objective,
      customerName,
      workstreamCodes,
      primaryWorkstreamCodes,
      archetype,
      focusAreas,
      systemsInScope,
      scenarios,
      durationMinutes,
      guidance,
    }: {
      orgId: string
      workshopId?: string
      topic: string
      objective?: string
      customerName?: string
      workstreamCodes?: string[]
      primaryWorkstreamCodes?: string[]
      archetype?: WorkshopArchetype
      focusAreas?: WorkshopFocus[]
      systemsInScope?: string[]
      scenarios?: { title: string; description?: string; focusType?: WorkshopFocus }[]
      durationMinutes?: number
      guidance?: string
    } = body
    if (!orgId || !topic) return json({ error: 'orgId and topic are required' }, 400)

    const db = serverModelDb()
    const codes = workstreamCodes || []
    const workstreams = await workstreamRoster(db, orgId, codes)
    const modelPreRead = await assemblePreRead(db, orgId, codes)

    // Workshop-level guidance (047): honor the persisted facilitation_prompt when a
    // workshop id is supplied, else the guidance passed in the body. Threaded into
    // generateBrief so "Regenerate brief" honors the same steer as every section.
    // 055: the same workshop read supplies primary_workstream_codes; attachments
    // are assembled into facilitator-provided context.
    let effectiveGuidance = (guidance || '').trim() || undefined
    let primaryCodes = (primaryWorkstreamCodes || []).filter((c) => codes.includes(c))
    let effectiveArchetype: WorkshopArchetype = normalizeArchetype(archetype)
    let effectiveSystems: string[] = (systemsInScope || []).filter(Boolean)
    let attachmentsContext: string | undefined
    if (workshopId) {
      const { data: gws } = await db
        .from('workshops')
        .select('facilitation_prompt, primary_workstream_codes, archetype, systems_in_scope')
        .eq('id', workshopId)
        .eq('organization_id', orgId)
        .maybeSingle<{ facilitation_prompt: string | null; primary_workstream_codes: string[] | null; archetype: string | null; systems_in_scope: string[] | null }>()
      if (!effectiveGuidance) effectiveGuidance = (gws?.facilitation_prompt || '').trim() || undefined
      if (!primaryCodes.length) {
        primaryCodes = (gws?.primary_workstream_codes || []).filter((c) => codes.includes(c))
      }
      if (!archetype) effectiveArchetype = normalizeArchetype(gws?.archetype)
      if (!effectiveSystems.length) effectiveSystems = (gws?.systems_in_scope || []).filter(Boolean)
      attachmentsContext = await assembleAttachmentsContext(db, workshopId)
    }
    const rosterByCode = new Map(workstreams.map((w) => [w.code, w]))
    const primaryWorkstreams = primaryCodes.map((c) => rosterByCode.get(c) || { code: c, name: c })

    const brief = await generateBrief({
      topic,
      objective,
      customerName,
      workstreams: workstreams.length ? workstreams : codes.map((c) => ({ code: c, name: c })),
      archetype: effectiveArchetype,
      primaryWorkstreams: primaryWorkstreams.length ? primaryWorkstreams : undefined,
      focusAreas,
      systemsInScope: effectiveSystems.length ? effectiveSystems : undefined,
      scenarios,
      modelPreRead,
      attachmentsContext,
      durationMinutes,
      guidance: effectiveGuidance,
      anthropicApiKey: ANTHROPIC_KEY,
    })
    if (!brief) return json({ error: 'Failed to generate brief' }, 502)

    // Persist server-side when a workshop id is supplied (org-scoped).
    if (workshopId) {
      const { data: ws } = await db
        .from('workshops')
        .select('id')
        .eq('id', workshopId)
        .eq('organization_id', orgId)
        .maybeSingle()
      if (!ws) return json({ error: 'Workshop not found for this organization' }, 404)

      // Replace the agenda, carrying section_kind + workstream_code on each item.
      await db.from('workshop_agenda_items').delete().eq('workshop_id', workshopId)
      const rows = (brief.agenda || []).map(
        (
          it: {
            title: string
            objective?: string
            focusType?: WorkshopFocus
            timeboxMinutes?: number
            sectionKind?: SectionKind
            workstreamCode?: string
          },
          i: number,
        ) => ({
          workshop_id: workshopId,
          sort_order: i,
          title: it.title,
          objective: it.objective ?? null,
          focus_type: it.focusType ?? null,
          timebox_minutes: it.timeboxMinutes ?? null,
          section_kind: it.sectionKind ?? null,
          workstream_code: it.workstreamCode ?? null,
        }),
      )
      if (rows.length) {
        const { error: insErr } = await db.from('workshop_agenda_items').insert(rows)
        if (insErr) throw new Error(insErr.message)
      }

      // Store the brief + duration on the workshop.
      const wsUpdate: Record<string, unknown> = { brief, status: 'scheduled' }
      if (durationMinutes != null) wsUpdate.duration_minutes = durationMinutes
      const { error: updErr } = await db.from('workshops').update(wsUpdate).eq('id', workshopId)
      if (updErr) throw new Error(updErr.message)
    }

    return json({ brief, preRead: modelPreRead, persisted: !!workshopId }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

// Coerce any stored/passed archetype value to a known WorkshopArchetype
// (defaults to 'decision', today's behavior).
function normalizeArchetype(a: string | null | undefined): WorkshopArchetype {
  return a === 'assessment' || a === 'training' ? a : 'decision'
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
