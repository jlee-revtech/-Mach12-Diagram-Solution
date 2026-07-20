import { NextRequest } from 'next/server'
import { buildFacilitatorPersona, runFacilitation, type WorkshopFocus } from '@jlee-revtech/agent-core'
import { serverModelDb, loadWorkshopForOrg, workstreamRoster, recentTranscript } from '@/lib/workshop/server'

// One live facilitation beat: read the running transcript + agenda and return the
// facilitator's next question, coverage note, whether to advance, and whether to
// pull in a specialist. The client posts just { workshopId, orgId, ... }.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const { workshopId, orgId, activeItemTitle, focus, artifactContext } = await req.json()
    if (!workshopId || !orgId) return json({ error: 'workshopId and orgId are required' }, 400)

    const db = serverModelDb()
    const ws = await loadWorkshopForOrg(db, workshopId, orgId)
    if (!ws) return json({ error: 'Workshop not found' }, 404)

    const roster = await workstreamRoster(db, orgId, ws.workstream_codes || [])
    const persona = buildFacilitatorPersona({
      topic: ws.topic || ws.title,
      objective: ws.objective || undefined,
      customerName: ws.customer_name || undefined,
      workstreams: roster,
      primaryWorkstreamCodes: (ws.primary_workstream_codes || []) as string[],
      focusAreas: (ws.focus_areas || []) as WorkshopFocus[],
    })

    const [transcript, agendaRows] = await Promise.all([
      recentTranscript(db, workshopId, { limit: 24 }),
      db.from('workshop_agenda_items').select('title,focus_type,status,sort_order').eq('workshop_id', workshopId).order('sort_order'),
    ])
    if (!transcript.length) return json({ result: null, note: 'No conversation yet.' }, 200)

    const agenda = (agendaRows.data || []).map((a) => ({
      title: a.title as string,
      focusType: (a.focus_type as WorkshopFocus) || undefined,
      status: (a.status as 'pending' | 'active' | 'done' | 'skipped') || undefined,
    }))

    const result = await runFacilitation({
      persona,
      agenda,
      activeItemTitle,
      focus: focus as WorkshopFocus | undefined,
      transcript,
      artifactContext,
      anthropicApiKey: ANTHROPIC_KEY,
    })
    return json({ result }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
