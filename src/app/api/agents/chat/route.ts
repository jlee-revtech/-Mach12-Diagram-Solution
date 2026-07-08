import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { knowledgeAdmin } from '@/lib/knowledge/sharedClient'
import {
  runAgentTurn,
  createKnowledgeClient,
  createCriteriaClient,
  personaForCode,
  SEARCH_KNOWLEDGE,
  ARCHITECTURE_TOOLS,
  REALIZATION_TOOLS,
  CONSULTANT_TOOLS,
  SOLUTION_ARCHITECT_TOOLS,
  type ToolContext,
  type AgentTool,
  type Citation,
  type DepthMode,
  type GeneratedDeliverable,
  type KnowledgeClient,
  type KnowledgeGap,
} from '@jlee-revtech/agent-core'
import { sapRealizationFromEnv } from '@/lib/agents/sapRealization'

// The Super Consultant agents run on the shared @jlee-revtech/agent-core brain:
// one loop + one tool belt for both apps. This route wires the diagram app's
// environment into it (org-scoped model client, shared-kb knowledge client, the
// RevTech template criteria store, the Anthropic key, and a deliverable
// persister) and streams the turn.
//
// v0.8: the orchestrator is now the Solution Architect (unscoped model reads,
// parallel specialist fan-out with seam-backed adjudication, deterministic
// consistency scan, blueprint generation). Specialists gain the conformance and
// deliverables tools. Depth mode `engagement` raises the budgets and escalates to
// the deep model for billable design work. Knowledge gaps the agents log are
// persisted as the training backlog.

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

const knowledge: KnowledgeClient = createKnowledgeClient({
  url: process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY,
  voyageKey: process.env.VOYAGE_API_KEY,
  voyageModel: process.env.VOYAGE_MODEL,
})

// The RevTech S/4HANA template criteria (kb_criteria). Powers
// check_template_conformance. Unconfigured -> the tool says so rather than
// implying a design conforms.
const criteria = createCriteriaClient({
  url: process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY,
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
  consult_specialists: 'Consulting the workstream specialists in parallel',
  check_cross_stream_consistency: 'Scanning the whole design for cross-stream defects',
  check_template_conformance: 'Scoring the design against the RevTech template criteria',
  list_deliverable_types: 'Reviewing the document types available',
  generate_deliverable: 'Drafting a consulting document from the evidence',
  generate_solution_blueprint: 'Composing the Solution Architecture Document',
  compose_cross_stream_program: 'Sequencing a cross-stream realization program',
  log_knowledge_gap: 'Recording a knowledge gap',
  introspect_live_config: 'Inspecting live SAP configuration',
  list_activities: 'Listing SAP configuration activities',
  list_config_log: 'Reading the executed-configuration log',
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
  // personaForCode resolves 'enterprise' to the Solution Architect persona and any
  // canonical/legacy stream code to its 8-dimension specialist persona.
  return (
    personaForCode(agent.code) ??
    'You are a world-class SAP S/4HANA and Dassian Aerospace & Defense functional consultant.'
  )
}

function toolsForAgent(isOrchestrator: boolean): AgentTool[] {
  // The Solution Architect: unscoped architecture reads, parallel specialist
  // fan-out, the deterministic consistency scan, conformance, and the blueprint.
  // Its realization tools are read/plan only; it never writes config itself.
  if (isOrchestrator) {
    return realization
      ? SOLUTION_ARCHITECT_TOOLS
      : SOLUTION_ARCHITECT_TOOLS.filter(
          (t) => !['introspect_live_config', 'list_activities', 'compose_config_plan', 'compose_cross_stream_program'].includes(t.name)
        )
  }
  // Workstream specialists: architecture + knowledge + conformance + documents,
  // plus the live-SAP realization tools when a realization backend is wired.
  return [
    SEARCH_KNOWLEDGE,
    ...ARCHITECTURE_TOOLS,
    ...(realization ? REALIZATION_TOOLS : []),
    ...CONSULTANT_TOOLS,
  ]
}

/** Persist a generated document. Best-effort: a storage failure must not lose the
 *  document, which the tool result still carries back to the user. */
function deliverablePersister(
  userDb: SupabaseClient,
  orgId: string,
  wsByCode: Map<string, { id: string; name: string }>,
  threadId: string | null,
  userId?: string
) {
  return async (doc: GeneratedDeliverable): Promise<{ id?: string } | null> => {
    const { data, error } = await userDb
      .from('deliverables')
      .insert({
        organization_id: orgId,
        workstream_id: wsByCode.get(doc.workstreamCode)?.id ?? null,
        workstream_code: doc.workstreamCode,
        dtype: doc.type,
        title: doc.title,
        subject: doc.subject,
        status: 'draft',
        content: { sections: doc.sections },
        evidence: doc.evidence,
        thread_id: threadId,
        created_by: userId ?? null,
      })
      .select('id')
      .single()
    if (error || !data) return null
    return { id: (data as { id: string }).id }
  }
}

/** The training backlog: gaps an agent admitted to during the turn. */
async function persistGaps(
  userDb: SupabaseClient,
  orgId: string,
  threadId: string | null,
  gaps: KnowledgeGap[]
) {
  if (!gaps.length) return
  try {
    await userDb.from('agent_knowledge_gaps').insert(
      gaps.map((g) => ({
        organization_id: orgId,
        workstream_code: g.workstreamCode,
        topic: g.topic,
        note: g.note ?? null,
        thread_id: threadId,
      }))
    )
  } catch {
    /* the backlog is a nice-to-have; never fail a turn over it */
  }
}

export async function POST(req: NextRequest) {
  const enc = new TextEncoder()
  try {
    const { agentCode, orgId, messages, pageContext, tenantKey, threadId: reqThreadId, userId, depthMode: reqDepth } = await req.json()
    // Workpackage C: `quick` is the chat default and keeps the historical budgets.
    // `engagement` is billable design work: more iterations, more tokens, deep model.
    const depthMode: DepthMode = reqDepth === 'engagement' ? 'engagement' : 'quick'
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

    // Thread persistence (best-effort; chat is no longer ephemeral). Create a
    // thread lazily on the first turn, persist the incoming user message now so
    // it survives even if the model call fails, and stamp the assistant turn
    // after it completes. RLS (auth header) scopes every write to the org.
    const wsId = wsByCode.get(agentCode)?.id ?? null
    let threadId: string | null = typeof reqThreadId === 'string' && reqThreadId ? reqThreadId : null
    try {
      if (!threadId) {
        const { data: t } = await userDb
          .from('agent_threads')
          .insert({
            organization_id: orgId,
            agent_code: agentCode,
            workstream_id: wsId,
            title: String(lastUser).slice(0, 80) || 'New conversation',
            created_by: (userId as string | undefined) ?? null,
          })
          .select('id')
          .single()
        threadId = t?.id ?? null
      }
      if (threadId) {
        await userDb.from('agent_messages').insert({ thread_id: threadId, role: 'user', content: { text: String(lastUser) } })
      }
    } catch {
      /* persistence optional — never block the turn */
    }

    // Pre-fetch a little baseline knowledge to seed grounding.
    let prefetched = ''
    try {
      const wsFilter = agent.is_orchestrator ? null : [agentCode]
      const res = await knowledge.search({ query: String(lastUser), workstreams: wsFilter, tenantKey: tenant, limit: 3 })
      for (const h of res.hits) if (h.sourceCode && !citations.find((c) => c.sourceCode === h.sourceCode)) citations.push({ sourceCode: h.sourceCode, sourceTitle: h.sourceTitle })
      prefetched = res.hits.map((h, i) => `[${i + 1}] (${h.sourceTitle}) ${h.content.slice(0, 700)}`).join('\n\n')
    } catch { /* knowledge optional */ }

    const kbGaps: KnowledgeGap[] = []
    const persistDeliverable = deliverablePersister(userDb, orgId, wsByCode, threadId, userId as string | undefined)

    // Sub-agent runner: consult a specialist workstream agent. The architect's
    // consult_specialists calls this CONCURRENTLY, so it must be re-entrant.
    // Sub-agents get the read-only belt (knowledge + architecture): they inform the
    // architect's ruling, they do not write config or generate documents.
    const runSubAgent = async (code: string, question: string): Promise<string> => {
      const { data: subRow } = await kb.from('kb_workstream_agents').select('*').eq('code', code).maybeSingle()
      if (!subRow) return `No consultant agent exists for workstream "${code}".`
      const sub = agentFromRow(subRow)
      const subCtx: ToolContext = {
        modelDb: userDb,
        orgId,
        agentWorkstreamCode: code,
        wsByCode,
        knowledge,
        // Sub-agent citations flow into the parent turn, so the architect's answer
        // carries the sources its specialists actually read.
        citations,
        tenantKey: tenant,
        realization,
        criteria,
        kbGaps,
        anthropicApiKey: ANTHROPIC_KEY,
      }
      const turn = await runAgentTurn({
        persona: personaFor(sub),
        tools: [SEARCH_KNOWLEDGE, ...ARCHITECTURE_TOOLS],
        ctx: subCtx,
        history: [{ role: 'user', content: question }],
        anthropicApiKey: ANTHROPIC_KEY,
        model: sub.model ?? undefined,
        temperature: sub.temperature ?? undefined,
        depthMode,
        agentKind: 'subagent',
      })
      return turn.text
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        try {
          if (threadId) send('thread', { threadId })
          const ctx: ToolContext = {
            modelDb: userDb, orgId, agentWorkstreamCode: agentCode, wsByCode, knowledge, citations,
            tenantKey: tenant, realization, runSubAgent: agent.is_orchestrator ? runSubAgent : undefined,
            criteria, kbGaps, anthropicApiKey: ANTHROPIC_KEY, persistDeliverable,
            isArchitect: agent.is_orchestrator, depthMode,
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
            depthMode,
            agentKind: agent.is_orchestrator ? 'architect' : 'specialist',
            pageContext,
            prefetchedKnowledge: prefetched,
            onTool: (name) => send('status', { label: TOOL_LABELS[name] || name, tool: name }),
          })
          if (threadId) {
            try {
              await userDb.from('agent_messages').insert({
                thread_id: threadId,
                role: 'assistant',
                content: {
                  text: turn.text,
                  citations: turn.citations,
                  recommendations: turn.recommendations,
                  grounded: turn.grounded,
                  kbGaps: turn.kbGaps,
                },
              })
              await userDb.from('agent_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)
            } catch {
              /* persistence optional */
            }
          }
          // Honest degradation becomes a work queue: whatever the agent admitted it
          // did not know is now the training backlog (Workpackage D2 / I harvest).
          await persistGaps(userDb, orgId, threadId, turn.kbGaps ?? [])
          send('message', {
            text: turn.text,
            recommendations: turn.recommendations,
            citations: turn.citations,
            grounded: turn.grounded,
            kbGaps: turn.kbGaps,
          })
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
