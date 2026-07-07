import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { ProcessGraph } from '@/lib/process/types'
import type { LogicalSystem } from '@/lib/sipoc/types'
import { SYSTEM_TEMPLATES } from '@/lib/diagram/types'
import {
  buildDeterministicArchSpec, mergeArchSpecs, archSpecToCanvas, sanitizeAiSpec,
  type ArchCapabilityInput, type ArchSpec,
} from '@/lib/process/dataArchitecture'

// Workstream DATA ARCHITECTURE, generated from the L3 process flows aligned to a
// workstream plus the capabilities assigned to them. Three actions:
//   GET  ?orgId&workstreamId              -> list the workstream's L3 flows with
//                                            their build status + whether a data
//                                            architecture already exists.
//   POST { step:'clarify', processNodeIds }  -> AI clarifying questions needed to
//                                            build the diagram(s) for the selected
//                                            L3 flows (empty when confident).
//   POST { step:'generate', processNodeIds, clarificationAnswers } -> hybrid
//                                            deterministic + AI build of ONE
//                                            diagram for the given L3 flow(s),
//                                            persisted + linked back.
// Org-scoped by the caller's JWT (RLS), like the agents route.

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
const MODEL = process.env.WORKSTREAM_MODEL || 'claude-sonnet-4-6'

const SYSTEM_TYPE_ENUM = SYSTEM_TEMPLATES.map((t) => t.type)

const STR = { type: 'string' } as const
const STR_ARR = { type: 'array', items: STR } as const

type Row = Record<string, unknown>
interface ClarifyingQuestion { id: string; question: string; why?: string }

// ─── GET: list the workstream's L3 flows + build status ──────────────────────
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId')
    const workstreamId = req.nextUrl.searchParams.get('workstreamId')
    if (!orgId || !workstreamId) return json({ error: 'orgId and workstreamId are required' }, 400)
    const db = orgClient(req)

    const { data: ws } = await db.from('workstreams').select('id').eq('id', workstreamId).eq('organization_id', orgId).maybeSingle()
    if (!ws) return json({ error: 'Workstream not found for this organization' }, 404)

    const { data: nodeRows } = await db
      .from('process_nodes')
      .select('id, name, graph_data, sipoc_capability_id, is_leaf, level')
      .eq('workstream_id', workstreamId)
    const leaves = (nodeRows || []).filter((n: Row) => n.is_leaf === true || n.level === 3)
    const nodeIds = leaves.map((n: Row) => n.id as string)

    // Links: capability assignments (count) + existing data-architecture diagrams.
    const capCountByNode = new Map<string, Set<string>>()
    const diagramByNode = new Map<string, string>()
    if (nodeIds.length) {
      const { data: links } = await db
        .from('process_node_links')
        .select('process_node_id, target_id, link_kind, created_at')
        .in('process_node_id', nodeIds)
        .order('created_at', { ascending: false })
      for (const l of (links || []) as Row[]) {
        const nid = l.process_node_id as string
        if (l.link_kind === 'sipoc_capability') {
          const set = capCountByNode.get(nid) ?? new Set<string>()
          set.add(l.target_id as string); capCountByNode.set(nid, set)
        } else if (l.link_kind === 'data_diagram' && !diagramByNode.has(nid)) {
          diagramByNode.set(nid, l.target_id as string)
        }
      }
    }
    // Only surface data-diagram links that still resolve to a live diagram.
    const targetIds = Array.from(new Set(Array.from(diagramByNode.values())))
    const liveDiagrams = new Set<string>()
    if (targetIds.length) {
      const { data: diags } = await db.from('diagrams').select('id').in('id', targetIds).is('archived_at', null)
      for (const d of (diags || []) as Row[]) liveDiagrams.add(d.id as string)
    }

    const processes = leaves.map((n: Row) => {
      const nid = n.id as string
      const caps = capCountByNode.get(nid) ?? new Set<string>()
      if (n.sipoc_capability_id) caps.add(n.sipoc_capability_id as string)
      const graph = n.graph_data as ProcessGraph | null
      const hasSystemLanes = !!graph?.lanes?.some((l) => !!l.systemId)
      const existing = diagramByNode.get(nid)
      return {
        id: nid,
        name: n.name as string,
        capabilityCount: caps.size,
        hasSystemLanes,
        buildable: caps.size > 0 || hasSystemLanes,
        existingDiagramId: existing && liveDiagrams.has(existing) ? existing : null,
      }
    })

    return json({ processes }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

// ─── POST: clarify | generate ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { step = 'generate', orgId, workstreamId, userId, processNodeIds, clarificationAnswers } = body as {
      step?: 'clarify' | 'generate'
      orgId?: string
      workstreamId?: string
      userId?: string
      processNodeIds?: string[]
      clarificationAnswers?: { question: string; answer: string }[]
    }
    if (!orgId || !workstreamId) return json({ error: 'orgId and workstreamId are required' }, 400)
    if (!ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)

    const db = orgClient(req)
    const ctx = await gather(db, orgId, workstreamId, processNodeIds)
    if (!ctx) return json({ error: 'Workstream not found for this organization' }, 404)
    if (ctx.base.systems.length === 0) {
      return json({
        error: 'Nothing to build from for the selected process(es). Assign capabilities to their L3 flows (or bind swimlanes to systems), then generate.',
      }, 422)
    }

    if (step === 'clarify') {
      const clarifyingQuestions = await clarify(ctx).catch(() => [] as ClarifyingQuestion[])
      return json({ clarifyingQuestions }, 200)
    }

    // generate
    if (!userId) return json({ error: 'userId is required' }, 400)
    let merged: ArchSpec = ctx.base
    try {
      const ai = await enrich(ctx, clarificationAnswers)
      merged = mergeArchSpecs(ctx.base, sanitizeAiSpec(ai))
    } catch {
      merged = ctx.base
    }

    const canvas = archSpecToCanvas(merged)
    const single = ctx.leaves.length === 1 ? (ctx.leaves[0].name as string) : null
    const title = single ? `${single}: Data Architecture` : `${ctx.wsName}: Data Architecture`

    const { data: created, error: insErr } = await db
      .from('diagrams')
      .insert({
        organization_id: orgId,
        title,
        description: merged.description ?? null,
        created_by: userId,
        updated_by: userId,
        workstream_id: workstreamId,
        process_context: single ?? ctx.wsName,
        canvas_data: { nodes: canvas.nodes, edges: canvas.edges, groups: canvas.groups, artifacts: [] },
      })
      .select('id')
      .single()
    if (insErr || !created) return json({ error: insErr?.message || 'Failed to save the diagram' }, 500)
    const diagramId = (created as Row).id as string

    if (ctx.nodeIds.length) {
      const linkRows = ctx.nodeIds.map((id) => ({ process_node_id: id, link_kind: 'data_diagram', target_id: diagramId, label: title, created_by: userId }))
      await db.from('process_node_links').insert(linkRows)
    }

    return json({
      diagramId,
      title,
      systemCount: canvas.nodes.length,
      flowCount: canvas.edges.length,
      groupCount: canvas.groups.length,
      processCount: ctx.leaves.length,
    }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

// ─── Context gathering (shared by clarify + generate) ────────────────────────
interface GatherResult {
  wsName: string
  leaves: Row[]
  nodeIds: string[]
  processNames: string[]
  capabilities: ArchCapabilityInput[]
  base: ArchSpec
}

async function gather(
  db: SupabaseClient,
  orgId: string,
  workstreamId: string,
  processNodeIds?: string[],
): Promise<GatherResult | null> {
  const { data: ws } = await db.from('workstreams').select('id, name, code').eq('id', workstreamId).eq('organization_id', orgId).maybeSingle()
  if (!ws) return null
  const wsName = (ws.name as string) || (ws.code as string) || 'Workstream'

  const { data: nodeRows } = await db
    .from('process_nodes')
    .select('id, name, graph_data, sipoc_capability_id, is_leaf, level')
    .eq('workstream_id', workstreamId)
  let leaves = (nodeRows || []).filter((n: Row) => n.is_leaf === true || n.level === 3)
  if (processNodeIds?.length) {
    const want = new Set(processNodeIds)
    leaves = leaves.filter((n: Row) => want.has(n.id as string))
  }
  const nodeIds = leaves.map((n: Row) => n.id as string)

  const capIdSet = new Set<string>()
  for (const n of leaves) if (n.sipoc_capability_id) capIdSet.add(n.sipoc_capability_id as string)
  if (nodeIds.length) {
    const { data: links } = await db
      .from('process_node_links')
      .select('process_node_id, target_id, link_kind')
      .in('process_node_id', nodeIds)
      .eq('link_kind', 'sipoc_capability')
    for (const l of (links || []) as Row[]) capIdSet.add(l.target_id as string)
  }
  const capIds = Array.from(capIdSet)

  const [{ data: sysRows }, { data: ipRows }] = await Promise.all([
    db.from('logical_systems').select('id, name, system_type').eq('organization_id', orgId),
    db.from('information_products').select('id, name').eq('organization_id', orgId),
  ])
  const systems: LogicalSystem[] = (sysRows || []) as unknown as LogicalSystem[]
  const sysNameById = new Map<string, string>((sysRows || []).map((s: Row) => [s.id as string, s.name as string]))
  const ipNameById = new Map<string, string>((ipRows || []).map((p: Row) => [p.id as string, p.name as string]))

  const capabilities: ArchCapabilityInput[] = []
  if (capIds.length) {
    const { data: caps } = await db.from('capabilities').select('id, name, color, parent_id, system_id').in('id', capIds)
    const capList = (caps || []) as Row[]
    const parentIds = Array.from(new Set(capList.map((c) => c.parent_id as string).filter(Boolean)))
    const parentById = new Map<string, Row>()
    if (parentIds.length) {
      const { data: parents } = await db.from('capabilities').select('id, name, color').in('id', parentIds)
      for (const p of (parents || []) as Row[]) parentById.set(p.id as string, p)
    }
    const [{ data: inputs }, { data: outputs }] = await Promise.all([
      db.from('capability_inputs').select('capability_id, information_product_id, source_system_ids, feeding_system_id, archived_at').in('capability_id', capIds),
      db.from('capability_outputs').select('capability_id, information_product_id, destination_system_ids, archived_at').in('capability_id', capIds),
    ])
    const inByCap = new Map<string, Row[]>()
    for (const i of (inputs || []) as Row[]) if (!i.archived_at) push(inByCap, i.capability_id as string, i)
    const outByCap = new Map<string, Row[]>()
    for (const o of (outputs || []) as Row[]) if (!o.archived_at) push(outByCap, o.capability_id as string, o)

    for (const c of capList) {
      const parent = c.parent_id ? parentById.get(c.parent_id as string) : null
      const sysName = (id: unknown) => (id ? sysNameById.get(String(id)) ?? null : null)
      capabilities.push({
        id: c.id as string,
        name: c.name as string,
        groupLabel: (parent?.name as string) || (c.name as string),
        groupColor: (parent?.color as string) || (c.color as string) || null,
        homeSystemName: sysName(c.system_id),
        inputs: (inByCap.get(c.id as string) || []).map((i) => ({
          product: ipNameById.get(String(i.information_product_id)) || 'Data',
          sourceSystems: [...((i.source_system_ids as string[]) || []), ...(i.feeding_system_id ? [i.feeding_system_id as string] : [])]
            .map((id) => sysNameById.get(id)).filter((x): x is string => !!x),
        })),
        outputs: (outByCap.get(c.id as string) || []).map((o) => ({
          product: ipNameById.get(String(o.information_product_id)) || 'Data',
          destSystems: ((o.destination_system_ids as string[]) || []).map((id) => sysNameById.get(id)).filter((x): x is string => !!x),
        })),
      })
    }
  }

  const processes = leaves.map((n: Row) => ({ id: n.id as string, name: n.name as string, graph: (n.graph_data as ProcessGraph | null) ?? null }))
  const base = buildDeterministicArchSpec({ workstreamName: wsName, systems, processes, capabilities })

  return { wsName, leaves, nodeIds, processNames: processes.map((p) => p.name), capabilities, base }
}

// ─── AI: clarifying questions ────────────────────────────────────────────────
const CLARIFY_TOOL = {
  name: 'clarify',
  description: 'Return clarifying questions needed to build a strong data-architecture diagram. Empty when the context is sufficient.',
  input_schema: {
    type: 'object',
    properties: {
      clarifyingQuestions: {
        type: 'array',
        description: 'Ask ONLY when a genuine ambiguity would change the diagram (systems of record, whether to show middleware/warehouse, grouping, integration pattern, direction). 0 to 4 items; empty when confident.',
        items: {
          type: 'object',
          properties: { id: STR, question: STR, why: { type: 'string', description: 'Why the answer changes the diagram.' } },
          required: ['id', 'question'],
        },
      },
    },
    required: ['clarifyingQuestions'],
  },
} as const

async function clarify(ctx: GatherResult): Promise<ClarifyingQuestion[]> {
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })
  const system = `You are a world-class SAP S/4HANA + Dassian Aerospace & Defense enterprise data architect preparing to draw a data-architecture diagram for one or more L3 process flows. Ask clarifying questions ONLY when a real ambiguity would change the systems, flows, or capability groupings. If the provided context is enough, return an empty list. Keep questions short and specific. Never use em-dashes or en-dashes.`
  const user = `${contextSummary(ctx)}

Deterministic backbone so far:
${JSON.stringify(ctx.base)}

Return only the clarifying questions that genuinely matter.`
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 900,
    temperature: 0.2,
    system,
    tools: [{ ...CLARIFY_TOOL, input_schema: CLARIFY_TOOL.input_schema as unknown as Anthropic.Tool['input_schema'] }],
    tool_choice: { type: 'tool', name: CLARIFY_TOOL.name },
    messages: [{ role: 'user', content: user }],
  })
  const block = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  const out = (block?.input as { clarifyingQuestions?: ClarifyingQuestion[] } | undefined)?.clarifyingQuestions ?? []
  return out.filter((q) => q && q.question).slice(0, 4)
}

// ─── AI: enrich the deterministic backbone ───────────────────────────────────
const ARCH_TOOL = {
  name: 'data_architecture',
  description: 'Return the enriched data-architecture spec: systems, data flows between them, and capability grouping bands.',
  input_schema: {
    type: 'object',
    properties: {
      title: STR,
      description: { type: 'string', description: 'One or two sentences describing the data architecture.' },
      systems: {
        type: 'array',
        description: 'Every system. Keep all provided systems and add connective ones the flows imply (middleware, data warehouse, analytics).',
        items: { type: 'object', properties: { name: STR, systemType: { type: 'string', enum: SYSTEM_TYPE_ENUM }, description: STR }, required: ['name', 'systemType'] },
      },
      flows: {
        type: 'array',
        description: 'Directed data flows between systems (by system name). Name the data element(s) that move on each flow.',
        items: { type: 'object', properties: { from: STR, to: STR, dataElements: STR_ARR, label: STR }, required: ['from', 'to', 'dataElements'] },
      },
      groups: {
        type: 'array',
        description: 'Capability grouping bands. Each groups the systems that realize one capability grouping (by system name). Keep the provided groupings and ensure every system belongs to one.',
        items: { type: 'object', properties: { label: STR, color: STR, systems: STR_ARR }, required: ['label', 'systems'] },
      },
    },
    required: ['systems', 'flows', 'groups'],
  },
} as const

async function enrich(ctx: GatherResult, clarificationAnswers?: { question: string; answer: string }[]): Promise<unknown> {
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })
  const system = `You are a world-class SAP S/4HANA + Dassian Aerospace & Defense enterprise data architect. You are given a DETERMINISTIC backbone of a data architecture (systems, data flows, capability grouping bands) derived from process flows and the capabilities assigned to them. Enrich it into a clean, presentation-ready data architecture:
- Keep every provided system, flow, and grouping. Do not drop anything.
- Add only genuinely implied connective systems (integration middleware, data warehouse, analytics) when flows clearly need them.
- Give every data flow a concrete data element name (the document or data object that moves, e.g. Purchase Order, Bill of Materials, Cost Estimate), not a step name.
- Ensure every system belongs to exactly one capability grouping band; put shared/cross-cutting systems in a "Shared Services" band.
- Keep labels short. Never use em-dashes or en-dashes; use commas, colons, parentheses, or periods.`
  const answers = clarificationAnswers?.length
    ? `\nAnswers to clarifying questions (honor these):\n${clarificationAnswers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n')}\n`
    : ''
  const user = `${contextSummary(ctx)}${answers}
Deterministic backbone to enrich (return the SAME shape, keeping all of it):
${JSON.stringify(ctx.base)}

Return the enriched data-architecture spec.`
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3200,
    temperature: 0.3,
    system,
    tools: [{ ...ARCH_TOOL, input_schema: ARCH_TOOL.input_schema as unknown as Anthropic.Tool['input_schema'] }],
    tool_choice: { type: 'tool', name: ARCH_TOOL.name },
    messages: [{ role: 'user', content: user }],
  })
  const block = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  return block?.input ?? null
}

function contextSummary(ctx: GatherResult): string {
  const capLines = ctx.capabilities.map((c) => {
    const ins = c.inputs.map((i) => `${i.product} from [${i.sourceSystems.join(', ') || '?'}]`).join('; ')
    const outs = c.outputs.map((o) => `${o.product} to [${o.destSystems.join(', ') || '?'}]`).join('; ')
    return `- ${c.name} (grouping: ${c.groupLabel}${c.homeSystemName ? `, system: ${c.homeSystemName}` : ''})${ins ? ` | inputs: ${ins}` : ''}${outs ? ` | outputs: ${outs}` : ''}`
  }).join('\n')
  return `Workstream: ${ctx.wsName}
L3 process flow(s) in scope: ${ctx.processNames.join('; ') || '(none modeled)'}

Assigned capabilities (the grouping structure):
${capLines || '(none assigned)'}`
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function orgClient(req: NextRequest): SupabaseClient {
  const auth = req.headers.get('authorization') || ''
  return createClient(SUPA_URL, SUPA_ANON, {
    global: { headers: auth ? { Authorization: auth } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function push<T>(m: Map<string, T[]>, k: string, v: T) {
  const a = m.get(k)
  if (a) a.push(v)
  else m.set(k, [v])
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
