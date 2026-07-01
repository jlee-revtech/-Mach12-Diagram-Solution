import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { knowledgeAdmin } from '@/lib/knowledge/sharedClient'
import {
  runAgentTurn,
  createKnowledgeClient,
  buildWorkstreamPersona,
  getWorkstream,
  SEARCH_KNOWLEDGE,
  ARCHITECTURE_TOOLS,
  ORCHESTRATOR_TOOLS,
  REALIZATION_TOOLS,
  type ToolContext,
  type AgentTool,
  type Citation,
  type KnowledgeClient,
} from '@jlee-revtech/agent-core'
import { sapRealizationFromEnv } from '@/lib/agents/sapRealization'

// The Super Consultant agents now run on the shared @jlee-revtech/agent-core
// brain: one loop + one tool belt for both apps. This route wires the diagram
// app's environment into it (org-scoped model client, shared-kb knowledge client,
// Anthropic key) and streams the turn. SAP-realization tools are added once an
// HTTP-to-Solution-Studio SapRealization is injected; until then workstream
// agents get the read-only architecture + knowledge tools (unchanged behavior).

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

const knowledge: KnowledgeClient = createKnowledgeClient({
  url: process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY,
  voyageKey: process.env.VOYAGE_API_KEY,
  voyageModel: process.env.VOYAGE_MODEL,
})

// Live-SAP realization (HTTP to Solution Studio). Undefined when unconfigured, so
// the realization tools stay off and workstream agents keep the read-only set.
const realization = sapRealizationFromEnv()

const TOOL_LABELS: Record<string, string> = {
  search_knowledge: 'Searching the SAP / Dassian knowledge base',
  get_workstream_overview: 'Reading the workstream overview',
  list_processes: 'Reading your processes',
  get_process: 'Inspecting a process in detail',
  list_personas: 'Reading your personas',
  list_systems: 'Reading your systems',
  list_data: 'Reading your data objects',
  list_integrations: 'Reading your integrations',
  list_workstreams: 'Reviewing your workstreams',
  ask_workstream_agent: 'Consulting a specialist workstream agent',
  introspect_live_config: 'Inspecting live SAP configuration',
  list_activities: 'Listing SAP configuration activities',
  compose_config_plan: 'Composing a SAP configuration plan',
  prepare_config: 'Preparing a configuration change',
  execute_config: 'Executing a configuration change',
}

interface AgentRow {
  code: string
  system_persona: string | null
  model: string | null
  temperature: number | null
  is_orchestrator: boolean
}

function agentFromRow(r: Record<string, unknown>): AgentRow {
  return {
    code: r.code as string,
    system_persona: (r.system_persona as string | null) ?? null,
    model: (r.model as string | null) ?? null,
    temperature: (r.temperature as number | null) ?? null,
    is_orchestrator: !!r.is_orchestrator,
  }
}

function personaFor(agent: AgentRow): string {
  if (agent.system_persona) return agent.system_persona
  const ws = getWorkstream(agent.code)
  return ws
    ? buildWorkstreamPersona(ws)
    : 'You are a world-class SAP S/4HANA and Dassian Aerospace & Defense functional consultant.'
}

function toolsForAgent(isOrchestrator: boolean): AgentTool[] {
  if (isOrchestrator) return ORCHESTRATOR_TOOLS
  // Workstream agents get architecture + knowledge tools, plus the live-SAP
  // realization tools when a realization backend is wired.
  return [SEARCH_KNOWLEDGE, ...ARCHITECTURE_TOOLS, ...(realization ? REALIZATION_TOOLS : [])]
}

export async function POST(req: NextRequest) {
  const enc = new TextEncoder()
  try {
    const { agentCode, orgId, messages, pageContext, tenantKey } = await req.json()
    const auth = req.headers.get('authorization') || ''
    if (!agentCode || !orgId) return json({ error: 'agentCode and orgId are required' }, 400)
    if (!Array.isArray(messages) || messages.length === 0) return json({ error: 'messages required' }, 400)

    const kb = knowledgeAdmin()
    const { data: agentRow } = await kb.from('kb_workstream_agents').select('*').eq('code', agentCode).maybeSingle()
    if (!agentRow) return json({ error: `Unknown agent: ${agentCode}` }, 404)
    const agent = agentFromRow(agentRow)

    // Org-scoped client (RLS) for reading the customer's live model.
    const userDb = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: auth ? { Authorization: auth } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: wsRows } = await userDb.from('workstreams').select('id, code, name').eq('organization_id', orgId)
    const wsByCode = new Map<string, { id: string; name: string }>((wsRows || []).map((w) => [w.code, { id: w.id, name: w.name }]))

    const citations: Citation[] = []
    const tenant = (tenantKey as string | null) ?? null
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || ''

    // Pre-fetch a little baseline knowledge to seed grounding.
    let prefetched = ''
    try {
      const wsFilter = agent.is_orchestrator ? null : [agentCode]
      const res = await knowledge.search({ query: String(lastUser), workstreams: wsFilter, tenantKey: tenant, limit: 3 })
      for (const h of res.hits) if (h.sourceCode && !citations.find((c) => c.sourceCode === h.sourceCode)) citations.push({ sourceCode: h.sourceCode, sourceTitle: h.sourceTitle })
      prefetched = res.hits.map((h, i) => `[${i + 1}] (${h.sourceTitle}) ${h.content.slice(0, 700)}`).join('\n\n')
    } catch { /* knowledge optional */ }

    // Orchestrator sub-agent runner: consult a specialist workstream agent.
    const runSubAgent = async (code: string, question: string): Promise<string> => {
      const { data: subRow } = await kb.from('kb_workstream_agents').select('*').eq('code', code).maybeSingle()
      if (!subRow) return `No consultant agent exists for workstream "${code}".`
      const sub = agentFromRow(subRow)
      const subCtx: ToolContext = { modelDb: userDb, orgId, agentWorkstreamCode: code, wsByCode, knowledge, citations, tenantKey: tenant, realization }
      const turn = await runAgentTurn({
        persona: personaFor(sub),
        tools: toolsForAgent(false),
        ctx: subCtx,
        history: [{ role: 'user', content: question }],
        anthropicApiKey: ANTHROPIC_KEY,
        model: sub.model ?? undefined,
        temperature: sub.temperature ?? undefined,
        maxIters: 4,
        maxTokens: 1500,
      })
      return turn.text
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        try {
          const ctx: ToolContext = {
            modelDb: userDb, orgId, agentWorkstreamCode: agentCode, wsByCode, knowledge, citations,
            tenantKey: tenant, realization, runSubAgent: agent.is_orchestrator ? runSubAgent : undefined,
          }
          const history = messages.map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content }))
          const turn = await runAgentTurn({
            persona: personaFor(agent),
            tools: toolsForAgent(agent.is_orchestrator),
            ctx,
            history,
            anthropicApiKey: ANTHROPIC_KEY,
            model: agent.model ?? undefined,
            temperature: agent.temperature ?? undefined,
            maxIters: agent.is_orchestrator ? 8 : 6,
            maxTokens: 3000,
            pageContext,
            prefetchedKnowledge: prefetched,
            onTool: (name) => send('status', { label: TOOL_LABELS[name] || name, tool: name }),
          })
          send('message', { text: turn.text, recommendations: turn.recommendations, citations: turn.citations })
          send('done', {})
        } catch (e) {
          send('error', { error: e instanceof Error ? e.message : 'agent failed' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
