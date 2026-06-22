import type { SupabaseClient } from '@supabase/supabase-js'
import type { Citation } from './types'
import { searchKnowledge } from '@/lib/knowledge/search'

// Read-only tool registry for the workstream agents. Every tool queries the
// org's LIVE model through a user-scoped Supabase client (RLS enforces org
// scoping) or the shared knowledge repo. No tool ever writes.

export interface ToolCtx {
  userDb: SupabaseClient                 // org-scoped (user JWT)
  orgId: string
  agentWorkstreamCode: string            // the agent's own workstream, or 'enterprise'
  wsByCode: Map<string, { id: string; name: string }>
  citations: Citation[]                  // accumulated across the conversation
  tenantKey: string | null
  _systemPrompt: string                  // resolved system prompt for the running agent
  runSubAgent?: (code: string, question: string) => Promise<string>
}

export interface AgentTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
  execute: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<string>
}

// Resolve a workstream code arg to its org workstream_id, defaulting to the
// agent's own workstream. Returns null for the enterprise agent / no match.
function resolveWsId(ctx: ToolCtx, codeArg?: string): string | null {
  const code = (codeArg as string) || ctx.agentWorkstreamCode
  if (!code || code === 'enterprise') return null
  return ctx.wsByCode.get(code)?.id ?? null
}

function wsCodesFor(ctx: ToolCtx, codeArg?: string): string[] | null {
  const code = (codeArg as string) || ctx.agentWorkstreamCode
  if (!code || code === 'enterprise') return null
  return [code]
}

const J = (v: unknown) => JSON.stringify(v, null, 2)

const WS_PROP = { workstream_code: { type: 'string', description: "Workstream code to scope to (e.g. 'source-to-pay'). Defaults to this agent's workstream." } }

export const SEARCH_KNOWLEDGE: AgentTool = {
  name: 'search_knowledge',
  description: 'Search the shared SAP S/4HANA + Dassian knowledge base (skills, baselines, and customer-specific docs) for relevant guidance. Use this to ground answers in the baseline frameworks before recommending.',
  input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Natural-language search query.' }, ...WS_PROP }, required: ['query'] },
  async execute(args, ctx) {
    const ws = wsCodesFor(ctx, args.workstream_code as string)
    const res = await searchKnowledge({ query: String(args.query), workstreams: ws, tenantKey: ctx.tenantKey, limit: 6 })
    for (const h of res.hits) {
      if (h.sourceCode && !ctx.citations.find((c) => c.sourceCode === h.sourceCode)) {
        ctx.citations.push({ sourceCode: h.sourceCode, sourceTitle: h.sourceTitle })
      }
    }
    if (!res.hits.length) return 'No matching knowledge found.'
    return res.hits.map((h, i) => `[${i + 1}] (${h.sourceTitle || h.sourceCode})\n${h.content.slice(0, 1100)}`).join('\n\n---\n\n')
  },
}

export const GET_WORKSTREAM_OVERVIEW: AgentTool = {
  name: 'get_workstream_overview',
  description: "Get the customer's counts of processes, capabilities, personas, data elements, systems, and integrations aligned to a workstream.",
  input_schema: { type: 'object', properties: { ...WS_PROP }, required: [] },
  async execute(args, ctx) {
    const wsId = resolveWsId(ctx, args.workstream_code as string)
    if (!wsId) return 'No specific workstream resolved; ask for a workstream_code.'
    const { data } = await ctx.userDb.from('workstream_rollup').select('*').eq('workstream_id', wsId).maybeSingle()
    const meta = [...ctx.wsByCode.entries()].find(([, v]) => v.id === wsId)
    return J({ workstream: meta?.[0], name: meta?.[1].name, counts: data ?? 'none' })
  },
}

export const LIST_PROCESSES: AgentTool = {
  name: 'list_processes',
  description: "List the customer's process models and process nodes (scenarios, groups, leaf processes) aligned to a workstream.",
  input_schema: { type: 'object', properties: { ...WS_PROP }, required: [] },
  async execute(args, ctx) {
    const wsId = resolveWsId(ctx, args.workstream_code as string)
    let q = ctx.userDb.from('process_nodes').select('id, name, level, node_kind, is_leaf, workstream_id, process_model_id').limit(60)
    if (wsId) q = q.eq('workstream_id', wsId)
    const { data, error } = await q
    if (error) return `Error: ${error.message}`
    if (!data?.length) return 'No process nodes aligned to this workstream yet.'
    return J(data.map((n) => ({ id: n.id, name: n.name, level: n.level, kind: n.node_kind, leaf: n.is_leaf })))
  },
}

export const GET_PROCESS: AgentTool = {
  name: 'get_process',
  description: 'Get the full detail of one process node: its BPMN lanes (systems/personas/roles), integrations, RICEFW build objects, and compliance/control overlays.',
  input_schema: { type: 'object', properties: { process_node_id: { type: 'string' } }, required: ['process_node_id'] },
  async execute(args, ctx) {
    const id = String(args.process_node_id)
    const [node, lanes, interfaces, ricefw, overlays] = await Promise.all([
      ctx.userDb.from('process_nodes').select('id, name, description, level, node_kind, is_leaf, scope_item_ref, lifecycle').eq('id', id).maybeSingle(),
      ctx.userDb.from('process_node_lanes').select('label, lane_key, logical_system_id, persona_id, role_id').eq('process_node_id', id),
      ctx.userDb.from('process_interfaces').select('direction, frequency, integration_tech, interface_ref, description, source_system_id, target_system_id').eq('process_node_id', id),
      ctx.userDb.from('process_ricefw').select('code, ricefw_type, title, status, complexity').eq('process_node_id', id),
      ctx.userDb.from('process_overlays').select('overlay_kind, payload').eq('process_node_id', id),
    ])
    return J({ node: node.data, lanes: lanes.data, interfaces: interfaces.data, ricefw: ricefw.data, overlays: overlays.data })
  },
}

export const LIST_PERSONAS: AgentTool = {
  name: 'list_personas',
  description: "List the customer's personas (and their roles) aligned to a workstream — the People pillar.",
  input_schema: { type: 'object', properties: { ...WS_PROP }, required: [] },
  async execute(args, ctx) {
    const wsId = resolveWsId(ctx, args.workstream_code as string)
    let q = ctx.userDb.from('personas').select('id, name, role, description, workstream_id').limit(80)
    if (wsId) q = q.eq('workstream_id', wsId)
    const { data, error } = await q
    if (error) return `Error: ${error.message}`
    return data?.length ? J(data.map((p) => ({ name: p.name, role: p.role, description: p.description }))) : 'No personas aligned to this workstream yet.'
  },
}

export const LIST_SYSTEMS: AgentTool = {
  name: 'list_systems',
  description: "List the customer's logical systems / platforms aligned to a workstream — the Technology pillar.",
  input_schema: { type: 'object', properties: { ...WS_PROP }, required: [] },
  async execute(args, ctx) {
    const wsId = resolveWsId(ctx, args.workstream_code as string)
    let q = ctx.userDb.from('logical_systems').select('id, name, system_type, description, workstream_id').limit(80)
    if (wsId) q = q.eq('workstream_id', wsId)
    const { data, error } = await q
    if (error) return `Error: ${error.message}`
    return data?.length ? J(data.map((s) => ({ name: s.name, type: s.system_type, description: s.description }))) : 'No systems aligned to this workstream yet.'
  },
}

export const LIST_DATA: AgentTool = {
  name: 'list_data',
  description: "List the customer's data elements and information products aligned to a workstream — the Data pillar.",
  input_schema: { type: 'object', properties: { ...WS_PROP }, required: [] },
  async execute(args, ctx) {
    const wsId = resolveWsId(ctx, args.workstream_code as string)
    let de = ctx.userDb.from('system_data_elements').select('name, description, workstream_id').limit(80)
    let ip = ctx.userDb.from('information_products').select('name, category, description, workstream_id').limit(80)
    if (wsId) { de = de.eq('workstream_id', wsId); ip = ip.eq('workstream_id', wsId) }
    const [dataElements, infoProducts] = await Promise.all([de, ip])
    return J({ data_elements: dataElements.data ?? [], information_products: infoProducts.data ?? [] })
  },
}

export const LIST_INTEGRATIONS: AgentTool = {
  name: 'list_integrations',
  description: "List the customer's system-to-system integrations (interfaces) aligned to a workstream, including direction, tech, and frequency.",
  input_schema: { type: 'object', properties: { ...WS_PROP }, required: [] },
  async execute(args, ctx) {
    const wsId = resolveWsId(ctx, args.workstream_code as string)
    const { data, error } = await ctx.userDb
      .from('process_interfaces')
      .select('direction, frequency, integration_tech, interface_ref, description, source:logical_systems!source_system_id(name), target:logical_systems!target_system_id(name), node:process_nodes!process_node_id(name, workstream_id)')
      .limit(120)
    if (error) return `Error: ${error.message}`
    let rows = data ?? []
    if (wsId) rows = rows.filter((r) => (r.node as { workstream_id?: string } | null)?.workstream_id === wsId)
    if (!rows.length) return 'No integrations aligned to this workstream yet.'
    return J(rows.slice(0, 60).map((r) => ({
      from: (r.source as { name?: string } | null)?.name, to: (r.target as { name?: string } | null)?.name,
      direction: r.direction, tech: r.integration_tech, frequency: r.frequency, ref: r.interface_ref, description: r.description,
      process: (r.node as { name?: string } | null)?.name,
    })))
  },
}

// ─── Orchestrator-only tools ───────────────────────────
export const LIST_WORKSTREAMS: AgentTool = {
  name: 'list_workstreams',
  description: 'List all of the customer\'s workstreams (value streams) with their codes and names, so you can decide which specialist(s) to consult.',
  input_schema: { type: 'object', properties: {}, required: [] },
  async execute(_args, ctx) {
    return J([...ctx.wsByCode.entries()].map(([code, v]) => ({ code, name: v.name })))
  },
}

export const ASK_WORKSTREAM_AGENT: AgentTool = {
  name: 'ask_workstream_agent',
  description: 'Consult a specialist workstream consultant agent with a focused question and get its expert answer. Use this to gather input from the relevant value streams before synthesizing.',
  input_schema: { type: 'object', properties: { workstream_code: { type: 'string' }, question: { type: 'string' } }, required: ['workstream_code', 'question'] },
  async execute(args, ctx) {
    if (!ctx.runSubAgent) return 'Sub-agent consultation is unavailable.'
    return ctx.runSubAgent(String(args.workstream_code), String(args.question))
  },
}

export const WORKSTREAM_TOOLS: AgentTool[] = [
  SEARCH_KNOWLEDGE, GET_WORKSTREAM_OVERVIEW, LIST_PROCESSES, GET_PROCESS,
  LIST_PERSONAS, LIST_SYSTEMS, LIST_DATA, LIST_INTEGRATIONS,
]

export const ORCHESTRATOR_TOOLS: AgentTool[] = [
  SEARCH_KNOWLEDGE, LIST_WORKSTREAMS, ASK_WORKSTREAM_AGENT, GET_WORKSTREAM_OVERVIEW, LIST_INTEGRATIONS,
]

export function toolsFor(agent: { is_orchestrator?: boolean }): AgentTool[] {
  return agent.is_orchestrator ? ORCHESTRATOR_TOOLS : WORKSTREAM_TOOLS
}

export function anthropicToolSchemas(tools: AgentTool[]) {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }))
}
