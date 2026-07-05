import { NextRequest } from 'next/server'
import { generateBrief, type WorkshopFocus, type SectionKind } from '@jlee-revtech/agent-core'
import { serverModelDb, workstreamRoster, assemblePreRead } from '@/lib/workshop/server'

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
      focusAreas,
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
      focusAreas?: WorkshopFocus[]
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
    let effectiveGuidance = (guidance || '').trim() || undefined
    if (workshopId && !effectiveGuidance) {
      const { data: gws } = await db
        .from('workshops')
        .select('facilitation_prompt')
        .eq('id', workshopId)
        .eq('organization_id', orgId)
        .maybeSingle<{ facilitation_prompt: string | null }>()
      effectiveGuidance = (gws?.facilitation_prompt || '').trim() || undefined
    }

    const brief = await generateBrief({
      topic,
      objective,
      customerName,
      workstreams: workstreams.length ? workstreams : codes.map((c) => ({ code: c, name: c })),
      focusAreas,
      scenarios,
      modelPreRead,
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

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
