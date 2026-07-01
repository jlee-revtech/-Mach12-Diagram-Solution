import { NextRequest } from 'next/server'
import { generateRecap } from '@jlee-revtech/agent-core'
import { serverModelDb, loadWorkshopForOrg, recentTranscript } from '@/lib/workshop/server'

// Generate the executive recap from the transcript + captures and store it on
// workshops.recap. The client renders + exports it.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const { workshopId, orgId } = await req.json()
    if (!workshopId || !orgId) return json({ error: 'workshopId and orgId are required' }, 400)
    const db = serverModelDb()
    const ws = await loadWorkshopForOrg(db, workshopId, orgId)
    if (!ws) return json({ error: 'Workshop not found' }, 404)

    const [transcript, capsRes] = await Promise.all([
      recentTranscript(db, workshopId, { limit: 80 }),
      db.from('workshop_captures').select('capture_type,title,detail,owner,due_date,status').eq('workshop_id', workshopId),
    ])
    const captures = (capsRes.data || [])
      .filter((c) => c.status !== 'dismissed')
      .map((c) => ({ captureType: c.capture_type as string, title: c.title as string, detail: (c.detail as string) || undefined, owner: (c.owner as string) || undefined, dueDate: (c.due_date as string) || undefined, status: c.status as string }))

    const recap = await generateRecap({
      topic: ws.topic || ws.title,
      objective: ws.objective || undefined,
      customerName: ws.customer_name || undefined,
      transcript,
      captures,
      anthropicApiKey: ANTHROPIC_KEY,
    })
    if (!recap) return json({ error: 'Failed to generate recap' }, 502)
    await db.from('workshops').update({ recap }).eq('id', workshopId)
    return json({ recap }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
