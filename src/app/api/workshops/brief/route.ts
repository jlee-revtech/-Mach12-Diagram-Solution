import { NextRequest } from 'next/server'
import { generateBrief, type WorkshopFocus } from '@jlee-revtech/agent-core'
import { serverModelDb, workstreamRoster, assemblePreRead } from '@/lib/workshop/server'

// Generate a pre-workshop Brief: a timeboxed agenda, a pre-read of the customer's
// real architecture for the topic, the gaps/decisions to drive, and the probing
// questions to prepare. Read-only compute — the client persists the result to the
// workshop (brief + agenda) under RLS.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      orgId,
      topic,
      objective,
      customerName,
      workstreamCodes,
      focusAreas,
      scenarios,
    }: {
      orgId: string
      topic: string
      objective?: string
      customerName?: string
      workstreamCodes?: string[]
      focusAreas?: WorkshopFocus[]
      scenarios?: { title: string; description?: string; focusType?: WorkshopFocus }[]
    } = body
    if (!orgId || !topic) return json({ error: 'orgId and topic are required' }, 400)

    const db = serverModelDb()
    const codes = workstreamCodes || []
    const workstreams = await workstreamRoster(db, orgId, codes)
    const modelPreRead = await assemblePreRead(db, orgId, codes)

    const brief = await generateBrief({
      topic,
      objective,
      customerName,
      workstreams: workstreams.length ? workstreams : codes.map((c) => ({ code: c, name: c })),
      focusAreas,
      scenarios,
      modelPreRead,
      anthropicApiKey: ANTHROPIC_KEY,
    })
    if (!brief) return json({ error: 'Failed to generate brief' }, 502)
    return json({ brief, preRead: modelPreRead }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
