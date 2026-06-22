import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { knowledgeAdmin } from '@/lib/knowledge/sharedClient'
import { searchKnowledge } from '@/lib/knowledge/search'
import { buildSystemPrompt, runAgentLoop, extractRecommendations } from '@/lib/agents/run'
import type { AgentDef, Citation } from '@/lib/agents/types'
import type { ToolCtx } from '@/lib/agents/tools'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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
}

function agentFromRow(r: Record<string, unknown>): AgentDef {
  return {
    code: r.code as string, display_name: r.display_name as string, tagline: r.tagline as string | null,
    system_persona: r.system_persona as string | null, sap_modules: (r.sap_modules as string[]) || [],
    dassian_modules: (r.dassian_modules as string[]) || [], knowledge_source_codes: (r.knowledge_source_codes as string[]) || [],
    model: r.model as string | null, temperature: r.temperature as number | null, is_orchestrator: !!r.is_orchestrator,
  }
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
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || ''

    // Pre-fetch a little baseline knowledge to seed grounding.
    let prefetched = ''
    try {
      const wsFilter = agent.is_orchestrator ? null : [agentCode]
      const res = await searchKnowledge({ query: String(lastUser), workstreams: wsFilter, tenantKey: tenantKey ?? null, limit: 3 })
      for (const h of res.hits) if (h.sourceCode && !citations.find((c) => c.sourceCode === h.sourceCode)) citations.push({ sourceCode: h.sourceCode, sourceTitle: h.sourceTitle })
      prefetched = res.hits.map((h, i) => `[${i + 1}] (${h.sourceTitle}) ${h.content.slice(0, 700)}`).join('\n\n')
    } catch { /* knowledge optional */ }

    const systemPrompt = buildSystemPrompt(agent, { pageContext, prefetched })

    // Orchestrator sub-agent runner: consult a specialist workstream agent.
    const runSubAgent = async (code: string, question: string): Promise<string> => {
      const { data: subRow } = await kb.from('kb_workstream_agents').select('*').eq('code', code).maybeSingle()
      if (!subRow) return `No consultant agent exists for workstream "${code}".`
      const sub = agentFromRow(subRow)
      const subCtx: ToolCtx = { userDb, orgId, agentWorkstreamCode: code, wsByCode, citations, tenantKey: tenantKey ?? null, _systemPrompt: buildSystemPrompt(sub, {}) }
      return runAgentLoop(sub, [{ role: 'user', content: question }], subCtx, { maxIters: 4, maxTokens: 1500 })
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        try {
          const ctx: ToolCtx = {
            userDb, orgId, agentWorkstreamCode: agentCode, wsByCode, citations,
            tenantKey: tenantKey ?? null, _systemPrompt: systemPrompt,
            runSubAgent: agent.is_orchestrator ? runSubAgent : undefined,
          }
          const history = messages.map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content }))
          const raw = await runAgentLoop(agent, history, ctx, {
            maxIters: agent.is_orchestrator ? 8 : 6,
            maxTokens: 3000,
            onTool: (name) => send('status', { label: TOOL_LABELS[name] || name, tool: name }),
          })
          const { text, recommendations } = extractRecommendations(raw)
          send('message', { text, recommendations, citations })
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
