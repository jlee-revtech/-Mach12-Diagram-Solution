import { NextRequest } from 'next/server'
import { runCapture } from '@jlee-revtech/agent-core'
import { serverModelDb, loadWorkshopForOrg, recentTranscript } from '@/lib/workshop/server'

// Scribe pass: extract structured captures (decision/action/deliverable/risk/
// question/architecture_change) from the latest transcript and persist them as
// 'proposed' for the room to confirm. architecture_change captures are
// recommendations, applied to the model only on confirm.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const { workshopId, orgId, sinceSeq, agendaItemId } = await req.json()
    if (!workshopId || !orgId) return json({ error: 'workshopId and orgId are required' }, 400)

    const db = serverModelDb()
    const ws = await loadWorkshopForOrg(db, workshopId, orgId)
    if (!ws) return json({ error: 'Workshop not found' }, 404)

    const transcript = await recentTranscript(db, workshopId, { limit: 16, sinceSeq: sinceSeq || 0 })
    if (!transcript.length) return json({ captures: [] }, 200)

    const { data: existing } = await db.from('workshop_captures').select('title').eq('workshop_id', workshopId)
    const drafts = await runCapture({
      transcript,
      existingTitles: (existing || []).map((c) => c.title as string),
      workstreamCodes: ws.workstream_codes || [],
      anthropicApiKey: ANTHROPIC_KEY,
    })
    if (!drafts.length) return json({ captures: [] }, 200)

    const rows = drafts.map((d) => ({
      workshop_id: workshopId,
      agenda_item_id: agendaItemId || null,
      capture_type: d.captureType,
      title: d.title,
      detail: d.detail || (d.sourceQuote ? `"${d.sourceQuote}"` : null),
      owner: d.owner || null,
      due_date: d.dueDate || null,
      status: 'proposed',
      workstream_code: d.workstreamCode || null,
      payload: d.payload || null,
      created_by_kind: 'agent',
    }))
    const { data: created, error } = await db.from('workshop_captures').insert(rows).select('*')
    if (error) return json({ error: error.message }, 500)
    return json({ captures: created }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
