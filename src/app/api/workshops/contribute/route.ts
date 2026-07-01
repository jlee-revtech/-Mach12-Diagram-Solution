import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  runAgentTurn, createKnowledgeClient, personaForCode, getWorkstream, buildWorkstreamPersona,
  SEARCH_KNOWLEDGE, ARCHITECTURE_TOOLS, REALIZATION_TOOLS,
  type ToolContext, type AgentTool, type Citation, type KnowledgeClient,
} from '@jlee-revtech/agent-core'
import { sapRealizationFromEnv } from '@/lib/agents/sapRealization'

// A workstream specialist contributes live in the workshop. Reuses the shared
// agent loop + tool belt (architecture-read + knowledge + SAP realization when
// wired, so PoC/demo focus can introspect live config), grounded in the running
// transcript. Returns the specialist's contribution text for the transcript.

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

const knowledge: KnowledgeClient = createKnowledgeClient({
  url: process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY,
  voyageKey: process.env.VOYAGE_API_KEY,
  voyageModel: process.env.VOYAGE_MODEL,
})
const realization = sapRealizationFromEnv()

export async function POST(req: NextRequest) {
  try {
    const { workshopId, orgId, workstreamCode, focus, transcript, artifactContext } = await req.json()
    if (!orgId || !workstreamCode) return json({ error: 'orgId and workstreamCode are required' }, 400)
    const auth = req.headers.get('authorization') || ''

    const userDb = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: auth ? { Authorization: auth } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Confirm the workshop is the caller's and gather topic + roster.
    let topic = '', customer = ''
    if (workshopId) {
      const { data: ws } = await userDb.from('workshops').select('title,topic,customer_name').eq('id', workshopId).maybeSingle()
      if (ws) { topic = ws.topic || ws.title || ''; customer = ws.customer_name || '' }
    }
    const { data: wsRows } = await userDb.from('workstreams').select('id, code, name').eq('organization_id', orgId)
    const wsByCode = new Map<string, { id: string; name: string }>((wsRows || []).map((w) => [w.code, { id: w.id, name: w.name }]))
    const wsName = wsByCode.get(workstreamCode)?.name || workstreamCode

    const persona = personaForCode(workstreamCode)
      || (getWorkstream(workstreamCode) ? buildWorkstreamPersona(getWorkstream(workstreamCode)!) : 'You are a world-class SAP S/4HANA + Dassian A&D consultant.')

    const convo = Array.isArray(transcript) && transcript.length
      ? transcript.map((l: { speaker?: string; role?: string; content: string }) => `${l.speaker || l.role || 'participant'}: ${l.content}`).join('\n')
      : '(the conversation is just getting started)'

    const instruction = `You are the ${wsName} specialist, contributing live in a workshop${customer ? ` for ${customer}` : ''} on "${topic || 'the topic at hand'}".${focus ? ` The current focus is ${focus}.` : ''}${artifactContext ? `\n\nArtifact in focus:\n${artifactContext}` : ''}

Recent conversation:
${convo}

Contribute now as if speaking in the room: the key considerations for the current focus, the realistic options with trade-offs, and your recommendation. Ground it in ${customer || 'the customer'}'s actual architecture — use your tools to check their processes, data, systems, and (for a PoC/demo focus) the live SAP configuration — and in SAP S/4HANA + Dassian A&D best practice. Be concise and specific; this is spoken input, not a document.`

    const citations: Citation[] = []
    const tools: AgentTool[] = [SEARCH_KNOWLEDGE, ...ARCHITECTURE_TOOLS, ...(realization ? REALIZATION_TOOLS : [])]
    const ctx: ToolContext = {
      modelDb: userDb, orgId, agentWorkstreamCode: workstreamCode, wsByCode, knowledge, citations, realization,
    }
    const turn = await runAgentTurn({
      persona, tools, ctx,
      history: [{ role: 'user', content: instruction }],
      anthropicApiKey: ANTHROPIC_KEY,
      maxIters: 5,
      maxTokens: 1400,
    })
    return json({ text: turn.text, workstreamName: wsName, recommendations: turn.recommendations, citations: turn.citations }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
