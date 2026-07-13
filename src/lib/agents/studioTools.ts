// Studio write tools (v1): the Super Consultant agents can create and update
// artifacts in Process Studio (process_models / process_nodes), Data Studio
// (diagrams), Capability Studio (capabilities), and the Persona Catalog
// (personas) when, and ONLY when, the user explicitly asks for it.
//
// Same AgentTool contract as @jlee-revtech/agent-core: execute(args, ctx) where
// ctx.modelDb is the caller's RLS org-scoped Supabase client. RLS already fences
// every statement to the user's org; each tool ALSO verifies the target row's
// organization before writing (belt and suspenders), because a wrong-id write
// must fail closed with a clear message, not lean on the database alone.
//
// v1 is deliberately conservative:
//   - create and update only; nothing is ever deleted or archived
//   - batch caps: <= 60 process nodes, <= 40 systems, <= 80 flows per call
//   - every result returns ids, names, and app links so the reply can cite them

import type { AgentTool, ToolContext } from '@jlee-revtech/agent-core'
import { SYSTEM_TEMPLATES, type SystemType, type SystemNode, type DataFlowEdge, type DataElement } from '@/lib/diagram/types'

/** The chat route stamps the signed-in user here so studio writes carry a real
 *  created_by / updated_by (several tables gate UPDATE on created_by via RLS). */
export interface StudioToolContext extends ToolContext {
  studioUserId?: string | null
}

const J = (v: unknown) => JSON.stringify(v, null, 2)

const ONLY_ON_REQUEST =
  'Use this tool ONLY when the user has explicitly asked you to create or change this content in the studio. ' +
  'Never call it speculatively, never to "improve" the model unasked, and never while answering a purely informational question. ' +
  'Confirm scope with the user first if their request is ambiguous.'

const WS_PROP = {
  workstream_code: {
    type: 'string',
    description: "Workstream code to home the new content to (e.g. 'plan-to-produce'). Defaults to this agent's own workstream; omit for none.",
  },
} as const

function userIdOf(ctx: ToolContext): string | null {
  return (ctx as StudioToolContext).studioUserId ?? null
}

/** Resolve the workstream to home new content to. Mirrors agent-core's codeFor:
 *  explicit arg wins, else the agent's own stream, and 'enterprise' means none.
 *  An explicit code that does not exist in the org is reported, not guessed. */
function resolveWs(ctx: ToolContext, codeArg: unknown): { code: string | null; id: string | null; warning?: string } {
  const code = (typeof codeArg === 'string' && codeArg.trim()) || ctx.agentWorkstreamCode
  if (!code || code === 'enterprise') return { code: null, id: null }
  const ws = ctx.wsByCode.get(code)
  if (!ws) {
    return typeof codeArg === 'string' && codeArg.trim()
      ? { code: null, id: null, warning: `Workstream code "${codeArg}" does not exist in this organization; the content was created without a workstream home.` }
      : { code: null, id: null }
  }
  return { code, id: ws.id }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const optStr = (v: unknown): string | null => {
  const s = str(v)
  return s ? s : null
}

// ─── Process Studio ─────────────────────────────────────────────────────────

const MAX_NODES = 60

interface NodeSpec {
  name: string
  description?: string | null
  children: NodeSpec[]
}

function parseNodeSpecs(raw: unknown, depth: number): NodeSpec[] {
  if (!Array.isArray(raw) || depth <= 0) return []
  const out: NodeSpec[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const name = item.trim()
      if (name) out.push({ name, description: null, children: [] })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const name = str(o.name)
    if (!name) continue
    // create_process_model speaks scenarios/groups/processes; add_process_nodes
    // speaks children. Accept whichever nesting key is present.
    const kids = o.children ?? o.groups ?? o.processes
    out.push({ name, description: optStr(o.description), children: parseNodeSpecs(kids, depth - 1) })
  }
  return out
}

function countSpecs(specs: NodeSpec[]): number {
  return specs.reduce((n, s) => n + 1 + countSpecs(s.children), 0)
}

function specDepth(specs: NodeSpec[]): number {
  if (!specs.length) return 0
  return 1 + Math.max(...specs.map((s) => specDepth(s.children)))
}

const KIND_BY_LEVEL = (level: number): string => (level === 1 ? 'scenario' : level === 2 ? 'process_group' : 'process')

/** Insert a spec tree level by level (parents before children). Returns counts
 *  per level. Levels follow the Process Studio schema: L1 Scenario, L2 Process
 *  Group, L3+ Process; a node at level >= 3 with no children is a BPMN leaf. */
async function insertNodeTree(
  ctx: ToolContext,
  modelId: string,
  workstreamId: string | null,
  specs: NodeSpec[],
  parentId: string | null,
  level: number,
  sortStart: number,
): Promise<Record<number, number>> {
  if (!specs.length) return {}
  const rows = specs.map((s, i) => ({
    process_model_id: modelId,
    parent_id: parentId,
    level,
    node_kind: KIND_BY_LEVEL(level),
    name: s.name,
    description: s.description ?? null,
    sort_order: sortStart + i,
    is_leaf: level >= 3 && s.children.length === 0,
    workstream_id: workstreamId,
  }))
  const { data, error } = await ctx.modelDb.from('process_nodes').insert(rows).select('id')
  if (error) throw new Error(`Failed to create level-${level} nodes: ${error.message}`)
  const created = (data ?? []) as { id: string }[]
  if (created.length !== specs.length) throw new Error(`Level-${level} insert returned ${created.length} of ${specs.length} rows.`)
  const counts: Record<number, number> = { [level]: specs.length }
  for (let i = 0; i < specs.length; i++) {
    const childCounts = await insertNodeTree(ctx, modelId, workstreamId, specs[i].children, created[i].id, level + 1, 0)
    for (const [lvl, n] of Object.entries(childCounts)) counts[Number(lvl)] = (counts[Number(lvl)] ?? 0) + n
  }
  return counts
}

export const CREATE_PROCESS_MODEL: AgentTool = {
  name: 'create_process_model',
  description:
    `Create a NEW process model in Process Studio, optionally seeded with an L1 > L2 > L3 hierarchy (Scenario > Process Group > Process). ${ONLY_ON_REQUEST} ` +
    `Keep it surgical: create exactly what the user asked for, nothing more. Maximum ${MAX_NODES} hierarchy nodes per call. Returns the ids and a /process/{id} link to cite in your reply.`,
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The process model title.' },
      description: { type: 'string', description: 'Optional one or two sentence description.' },
      ...WS_PROP,
      scenarios: {
        type: 'array',
        description: 'Optional initial hierarchy: L1 scenarios, each with L2 process groups, each with L3 leaf process names.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            groups: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  processes: { type: 'array', items: { type: 'string' }, description: 'L3 leaf process names.' },
                },
                required: ['name'],
              },
            },
          },
          required: ['name'],
        },
      },
    },
    required: ['title'],
  },
  async execute(args, ctx) {
    const title = str(args.title)
    if (!title) return 'A process model needs a title. Provide one and call create_process_model again.'
    const scenarios = parseNodeSpecs(args.scenarios, 3)
    const total = countSpecs(scenarios)
    if (total > MAX_NODES) return `That hierarchy has ${total} nodes; the cap is ${MAX_NODES} per call. Create the model with the core structure first, then extend it with add_process_nodes.`

    const ws = resolveWs(ctx, args.workstream_code)
    const uid = userIdOf(ctx)
    const { data: model, error } = await ctx.modelDb
      .from('process_models')
      .insert({
        organization_id: ctx.orgId,
        title,
        description: optStr(args.description),
        created_by: uid,
        updated_by: uid,
        workstream_id: ws.id,
      })
      .select('id, title')
      .single()
    if (error || !model) return `Failed to create the process model: ${error?.message ?? 'no row returned'}.`
    const modelId = (model as { id: string }).id

    let counts: Record<number, number> = {}
    try {
      counts = await insertNodeTree(ctx, modelId, ws.id, scenarios, null, 1, 0)
    } catch (e) {
      return `The process model "${title}" was created (id ${modelId}, link /process/${modelId}), but seeding its hierarchy failed: ${e instanceof Error ? e.message : 'insert failed'}. Tell the user, and use add_process_nodes to finish it.`
    }
    return J({
      created: 'process_model',
      id: modelId,
      title,
      link: `/process/${modelId}`,
      workstream: ws.code ?? undefined,
      nodes: { scenarios: counts[1] ?? 0, process_groups: counts[2] ?? 0, processes: counts[3] ?? 0 },
      ...(ws.warning ? { warning: ws.warning } : {}),
      note: 'Cite the link so the user can open it in Process Studio.',
    })
  },
}

export const ADD_PROCESS_NODES: AgentTool = {
  name: 'add_process_nodes',
  description:
    `Append hierarchy nodes to an EXISTING process model in Process Studio. Without parent_node_id the nodes become L1 scenarios; with one they become children of that node (level = parent level + 1, maximum depth 5). Nested children go one and two levels deeper. ${ONLY_ON_REQUEST} ` +
    `Maximum ${MAX_NODES} nodes per call. Nothing is deleted or moved; nodes are only added.`,
  input_schema: {
    type: 'object',
    properties: {
      process_model_id: { type: 'string', description: 'The process model to extend (from list_processes or a create_process_model result).' },
      parent_node_id: { type: 'string', description: 'Optional parent node id. Omit to add top-level L1 scenarios.' },
      nodes: {
        type: 'array',
        description: 'The nodes to append, optionally nested via children (up to two levels below each listed node).',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            children: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  children: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: { name: { type: 'string' }, description: { type: 'string' } },
                      required: ['name'],
                    },
                  },
                },
                required: ['name'],
              },
            },
          },
          required: ['name'],
        },
      },
    },
    required: ['process_model_id', 'nodes'],
  },
  async execute(args, ctx) {
    const modelId = str(args.process_model_id)
    if (!modelId) return 'process_model_id is required.'
    const specs = parseNodeSpecs(args.nodes, 3)
    if (!specs.length) return 'Provide at least one node with a name.'
    const total = countSpecs(specs)
    if (total > MAX_NODES) return `That adds ${total} nodes; the cap is ${MAX_NODES} per call. Split the request.`

    // Org ownership: the model must belong to this organization.
    const { data: model, error: mErr } = await ctx.modelDb
      .from('process_models')
      .select('id, title, workstream_id')
      .eq('id', modelId)
      .eq('organization_id', ctx.orgId)
      .maybeSingle()
    if (mErr) return `Error reading the process model: ${mErr.message}`
    if (!model) return "No such process model in this organization's model. Do not guess ids; call list_processes first."
    const modelRow = model as { id: string; title: string; workstream_id: string | null }

    let baseLevel = 1
    let parentId: string | null = null
    let parentWasLeaf = false
    if (str(args.parent_node_id)) {
      const { data: parent, error: pErr } = await ctx.modelDb
        .from('process_nodes')
        .select('id, name, level, is_leaf')
        .eq('id', str(args.parent_node_id))
        .eq('process_model_id', modelId)
        .maybeSingle()
      if (pErr) return `Error reading the parent node: ${pErr.message}`
      if (!parent) return 'The parent_node_id does not belong to that process model. Check the id and call again.'
      const p = parent as { id: string; level: number; is_leaf: boolean }
      parentId = p.id
      baseLevel = (p.level ?? 1) + 1
      parentWasLeaf = !!p.is_leaf
    }
    const deepest = baseLevel + specDepth(specs) - 1
    if (deepest > 5) return `That nesting would reach level ${deepest}; the hierarchy stops at level 5 (L1 Scenario, L2 Process Group, L3 Process, L4 Sub-Process, L5 Step). Flatten the request.`

    // Append after the existing siblings.
    let sib = ctx.modelDb.from('process_nodes').select('id', { count: 'exact', head: true }).eq('process_model_id', modelId)
    sib = parentId ? sib.eq('parent_id', parentId) : sib.is('parent_id', null)
    const { count } = await sib
    const sortStart = count ?? 0

    let counts: Record<number, number> = {}
    try {
      counts = await insertNodeTree(ctx, modelId, modelRow.workstream_id ?? null, specs, parentId, baseLevel, sortStart)
    } catch (e) {
      return `Adding nodes to "${modelRow.title}" failed: ${e instanceof Error ? e.message : 'insert failed'}.`
    }
    // A parent that gained children is no longer a BPMN leaf.
    if (parentId && parentWasLeaf) {
      await ctx.modelDb.from('process_nodes').update({ is_leaf: false }).eq('id', parentId)
    }
    return J({
      updated: 'process_model',
      id: modelId,
      title: modelRow.title,
      link: `/process/${modelId}`,
      added_by_level: counts,
      total_added: total,
      note: 'Cite the link so the user can open it in Process Studio.',
    })
  },
}

// ─── Data Studio (diagrams) ─────────────────────────────────────────────────

const MAX_SYSTEMS = 40
const MAX_FLOWS = 80
const VALID_SYSTEM_TYPES = new Set<SystemType>(SYSTEM_TEMPLATES.map((t) => t.type))
const SYSTEM_TYPE_LIST = SYSTEM_TEMPLATES.map((t) => t.type).join(', ')

// Grid layout constants, matching the data-architecture generator's spacing so
// agent-created diagrams land with the same density and never overlap.
const SYSTEM_W = 190
const SYSTEM_H = 84
const SYS_GAP_X = 90
const SYS_GAP_Y = 60
const GRID_PER_ROW = 4
const GRID_X = 60
const GRID_Y = 60

const norm = (s: string) => s.trim().toLowerCase()

export const CREATE_DIAGRAM: AgentTool = {
  name: 'create_diagram',
  description:
    `Create a NEW data-architecture diagram in Data Studio from a list of systems and the data flows between them. Systems are laid out on a non-overlapping grid; flows become labeled data-flow edges carrying their data elements (the editor renders them with orthogonal elbow connectors). ${ONLY_ON_REQUEST} ` +
    `Maximum ${MAX_SYSTEMS} systems and ${MAX_FLOWS} flows per call. System types: ${SYSTEM_TYPE_LIST} (anything else becomes 'custom'). Returns a /diagram/{id} link to cite.`,
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The diagram title.' },
      description: { type: 'string', description: 'Optional one or two sentence description.' },
      ...WS_PROP,
      systems: {
        type: 'array',
        description: 'The systems to place on the canvas.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string', description: `One of: ${SYSTEM_TYPE_LIST}. Defaults to custom.` },
            description: { type: 'string' },
          },
          required: ['name'],
        },
      },
      flows: {
        type: 'array',
        description: 'Directed data flows between systems, referenced by system name.',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Source system name (must appear in systems).' },
            to: { type: 'string', description: 'Target system name (must appear in systems).' },
            label: { type: 'string', description: 'Short flow label.' },
            data_elements: { type: 'array', items: { type: 'string' }, description: 'The concrete data objects that move (e.g. Purchase Order, WBS Element).' },
            direction: { type: 'string', enum: ['forward', 'bidirectional'], description: 'Defaults to forward.' },
          },
          required: ['from', 'to'],
        },
      },
    },
    required: ['title', 'systems'],
  },
  async execute(args, ctx) {
    const title = str(args.title)
    if (!title) return 'A diagram needs a title.'
    const rawSystems = Array.isArray(args.systems) ? args.systems : []
    const rawFlows = Array.isArray(args.flows) ? args.flows : []
    if (rawFlows.length > MAX_FLOWS) return `That is ${rawFlows.length} flows; the cap is ${MAX_FLOWS} per call.`

    // De-duplicate systems by name, coerce types.
    const systems: { name: string; systemType: SystemType; description?: string }[] = []
    const seen = new Set<string>()
    for (const s of rawSystems) {
      if (!s || typeof s !== 'object') continue
      const o = s as Record<string, unknown>
      const name = str(o.name)
      if (!name || seen.has(norm(name))) continue
      seen.add(norm(name))
      const t = str(o.type) as SystemType
      systems.push({ name, systemType: VALID_SYSTEM_TYPES.has(t) ? t : 'custom', ...(optStr(o.description) ? { description: optStr(o.description)! } : {}) })
    }
    if (!systems.length) return 'Provide at least one system with a name.'
    if (systems.length > MAX_SYSTEMS) return `That is ${systems.length} systems; the cap is ${MAX_SYSTEMS} per call.`

    // Grid layout: fixed cell size, no overlaps.
    const nodeIdByName = new Map<string, string>()
    const nodes: SystemNode[] = systems.map((s, i) => {
      const id = `system-${crypto.randomUUID()}`
      nodeIdByName.set(norm(s.name), id)
      return {
        id,
        type: 'system' as const,
        position: {
          x: GRID_X + (i % GRID_PER_ROW) * (SYSTEM_W + SYS_GAP_X),
          y: GRID_Y + Math.floor(i / GRID_PER_ROW) * (SYSTEM_H + SYS_GAP_Y),
        },
        data: { label: s.name, systemType: s.systemType, ...(s.description ? { description: s.description } : {}) },
      }
    })

    const edges: DataFlowEdge[] = []
    const skipped: string[] = []
    for (const f of rawFlows) {
      if (!f || typeof f !== 'object') continue
      const o = f as Record<string, unknown>
      const from = str(o.from)
      const to = str(o.to)
      const source = nodeIdByName.get(norm(from))
      const target = nodeIdByName.get(norm(to))
      if (!source || !target || source === target) {
        if (from || to) skipped.push(`${from || '?'} -> ${to || '?'}`)
        continue
      }
      const names = (Array.isArray(o.data_elements) ? o.data_elements : []).map((d) => str(d)).filter(Boolean)
      const dataElements: DataElement[] = (names.length ? names : ['Data']).map((name) => ({
        id: crypto.randomUUID(),
        name,
        elementType: 'document' as const,
      }))
      edges.push({
        id: `edge-${crypto.randomUUID()}`,
        source,
        target,
        type: 'dataFlow' as const,
        data: {
          label: str(o.label) || (dataElements.length === 1 ? dataElements[0].name : ''),
          dataElements,
          direction: o.direction === 'bidirectional' ? ('bidirectional' as const) : ('forward' as const),
        },
      })
    }

    const ws = resolveWs(ctx, args.workstream_code)
    const uid = userIdOf(ctx)
    const { data: created, error } = await ctx.modelDb
      .from('diagrams')
      .insert({
        organization_id: ctx.orgId,
        title,
        description: optStr(args.description),
        created_by: uid,
        updated_by: uid,
        workstream_id: ws.id,
        canvas_data: { nodes, edges, groups: [], artifacts: [] },
      })
      .select('id')
      .single()
    if (error || !created) return `Failed to create the diagram: ${error?.message ?? 'no row returned'}.`
    const id = (created as { id: string }).id
    return J({
      created: 'diagram',
      id,
      title,
      link: `/diagram/${id}`,
      workstream: ws.code ?? undefined,
      systems: nodes.length,
      flows: edges.length,
      ...(skipped.length ? { skipped_flows: skipped, skipped_reason: 'source or target system name did not match a listed system' } : {}),
      ...(ws.warning ? { warning: ws.warning } : {}),
      note: 'Cite the link so the user can open it in Data Studio.',
    })
  },
}

// ─── Capability Studio ──────────────────────────────────────────────────────

const CAP_LEVEL_LABEL: Record<number, string> = { 1: 'Core Area', 2: 'Capability', 3: 'Functionality' }

interface CapRow {
  id: string
  name: string
  level: number
  status: string | null
  capability_map_id: string
  capability_maps: { organization_id: string; title: string } | null
}

export const UPDATE_CAPABILITY_STATUS: AgentTool = {
  name: 'update_capability_status',
  description:
    `Update the review status of one capability in Capability Studio: not_started, in_progress, or done. An optional note is recorded as a comment on the capability. ${ONLY_ON_REQUEST}`,
  input_schema: {
    type: 'object',
    properties: {
      capability_id: { type: 'string', description: 'The capability to update.' },
      status: { type: 'string', enum: ['not_started', 'in_progress', 'done'], description: 'The new review status.' },
      note: { type: 'string', description: 'Optional review note; stored as a comment on the capability.' },
    },
    required: ['capability_id', 'status'],
  },
  async execute(args, ctx) {
    const id = str(args.capability_id)
    const status = str(args.status)
    if (!id) return 'capability_id is required.'
    if (!['not_started', 'in_progress', 'done'].includes(status)) return "status must be one of: not_started, in_progress, done."

    const { data, error } = await ctx.modelDb
      .from('capabilities')
      .select('id, name, level, status, capability_map_id, capability_maps!inner(organization_id, title)')
      .eq('id', id)
      .maybeSingle()
    if (error) return `Error reading the capability: ${error.message}`
    const cap = data as unknown as CapRow | null
    if (!cap || cap.capability_maps?.organization_id !== ctx.orgId) {
      return "No such capability in this organization's model. Do not guess ids."
    }

    const newStatus = status === 'not_started' ? null : status
    const { error: upErr } = await ctx.modelDb.from('capabilities').update({ status: newStatus }).eq('id', id)
    if (upErr) return `Failed to update the capability status: ${upErr.message}`

    let noteResult: string | undefined
    const note = optStr(args.note)
    if (note) {
      const { error: cErr } = await ctx.modelDb.from('sipoc_comments').insert({
        capability_map_id: cap.capability_map_id,
        capability_id: id,
        region: 'P',
        item_type: null,
        item_id: null,
        author_name: 'Mach12 Consultant Agent',
        body: note,
      })
      noteResult = cErr ? `The status was updated, but the note could not be saved as a comment: ${cErr.message}` : 'The note was saved as a comment on the capability.'
    }
    return J({
      updated: 'capability',
      id,
      name: cap.name,
      level: CAP_LEVEL_LABEL[cap.level] ?? `L${cap.level}`,
      previous_status: cap.status ?? 'not_started',
      status,
      map: cap.capability_maps?.title,
      link: `/capability-map/${cap.capability_map_id}`,
      ...(noteResult ? { note: noteResult } : {}),
    })
  },
}

export const ADD_CAPABILITY: AgentTool = {
  name: 'add_capability',
  description:
    `Add ONE capability to an existing capability map in Capability Studio. Levels: 1 = Core Area (no parent), 2 = Capability (parent is a level-1 Core Area), 3 = Functionality (parent is a level-2 Capability; L3 is where SIPOC detail lives). ${ONLY_ON_REQUEST}`,
  input_schema: {
    type: 'object',
    properties: {
      map_id: { type: 'string', description: 'The capability map to add to.' },
      parent_id: { type: 'string', description: 'Required for level 2 and 3: the parent capability (one level up, same map).' },
      name: { type: 'string', description: 'The capability name.' },
      level: { type: 'number', enum: [1, 2, 3], description: '1 Core Area, 2 Capability, 3 Functionality.' },
      description: { type: 'string' },
    },
    required: ['map_id', 'name', 'level'],
  },
  async execute(args, ctx) {
    const mapId = str(args.map_id)
    const name = str(args.name)
    const level = typeof args.level === 'number' ? args.level : Number(args.level)
    if (!mapId || !name) return 'map_id and name are required.'
    if (![1, 2, 3].includes(level)) return 'level must be 1, 2, or 3.'

    const { data: map, error: mErr } = await ctx.modelDb
      .from('capability_maps')
      .select('id, title')
      .eq('id', mapId)
      .eq('organization_id', ctx.orgId)
      .maybeSingle()
    if (mErr) return `Error reading the capability map: ${mErr.message}`
    if (!map) return "No such capability map in this organization's model. Do not guess ids."
    const mapRow = map as { id: string; title: string }

    let parentId: string | null = null
    if (level > 1) {
      const pid = str(args.parent_id)
      if (!pid) return `A level-${level} ${CAP_LEVEL_LABEL[level]} needs a parent_id (a level-${level - 1} ${CAP_LEVEL_LABEL[level - 1]} in the same map).`
      const { data: parent, error: pErr } = await ctx.modelDb
        .from('capabilities')
        .select('id, name, level')
        .eq('id', pid)
        .eq('capability_map_id', mapId)
        .maybeSingle()
      if (pErr) return `Error reading the parent capability: ${pErr.message}`
      if (!parent) return 'The parent_id does not belong to that capability map.'
      const p = parent as { id: string; name: string; level: number }
      if (p.level !== level - 1) return `The parent "${p.name}" is level ${p.level}; a level-${level} node needs a level-${level - 1} parent.`
      parentId = p.id
    } else if (str(args.parent_id)) {
      return 'A level-1 Core Area has no parent; omit parent_id or use level 2/3.'
    }

    let sib = ctx.modelDb.from('capabilities').select('id', { count: 'exact', head: true }).eq('capability_map_id', mapId)
    sib = parentId ? sib.eq('parent_id', parentId) : sib.is('parent_id', null)
    const { count } = await sib

    const { data: created, error } = await ctx.modelDb
      .from('capabilities')
      .insert({
        capability_map_id: mapId,
        parent_id: parentId,
        level,
        name,
        description: optStr(args.description),
        sort_order: count ?? 0,
      })
      .select('id, name')
      .single()
    if (error || !created) return `Failed to create the capability: ${error?.message ?? 'no row returned'}.`
    return J({
      created: 'capability',
      id: (created as { id: string }).id,
      name,
      level: CAP_LEVEL_LABEL[level],
      map: mapRow.title,
      link: `/capability-map/${mapId}`,
      note: 'Cite the link so the user can open it in Capability Studio.',
    })
  },
}

// ─── Persona Studio (Persona Catalog) ───────────────────────────────────────

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export const CREATE_PERSONA: AgentTool = {
  name: 'create_persona',
  description:
    `Create a NEW persona in the Persona Catalog (the People pillar): a named user archetype with an optional role title and description, homed to a workstream. ${ONLY_ON_REQUEST}`,
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: "The persona name (e.g. 'Program Cost Analyst')." },
      role: { type: 'string', description: 'Optional short role or job title.' },
      role_description: { type: 'string', description: 'Optional description of what this persona does day to day.' },
      color: { type: 'string', description: 'Optional hex accent color like #6366F1.' },
      ...WS_PROP,
    },
    required: ['name'],
  },
  async execute(args, ctx) {
    const name = str(args.name)
    if (!name) return 'A persona needs a name.'
    const ws = resolveWs(ctx, args.workstream_code)
    const color = str(args.color)
    const { data, error } = await ctx.modelDb
      .from('personas')
      .insert({
        organization_id: ctx.orgId,
        name,
        role: optStr(args.role),
        description: optStr(args.role_description) ?? optStr(args.description),
        ...(HEX_COLOR.test(color) ? { color } : {}),
        workstream_id: ws.id,
      })
      .select('id, name')
      .single()
    if (error || !data) return `Failed to create the persona: ${error?.message ?? 'no row returned'}.`
    return J({
      created: 'persona',
      id: (data as { id: string }).id,
      name,
      workstream: ws.code ?? undefined,
      link: '/process/personas',
      ...(ws.warning ? { warning: ws.warning } : {}),
      note: 'Cite the link so the user can open the Persona Catalog.',
    })
  },
}

export const UPDATE_PERSONA: AgentTool = {
  name: 'update_persona',
  description:
    `Update an existing persona in the Persona Catalog: name, role title, description, color, or workstream home. Only the fields you pass are changed. ${ONLY_ON_REQUEST}`,
  input_schema: {
    type: 'object',
    properties: {
      persona_id: { type: 'string', description: 'The persona to update (from list_personas).' },
      name: { type: 'string' },
      role: { type: 'string', description: 'Short role or job title.' },
      role_description: { type: 'string', description: 'What this persona does day to day.' },
      color: { type: 'string', description: 'Hex accent color like #6366F1.' },
      ...WS_PROP,
    },
    required: ['persona_id'],
  },
  async execute(args, ctx) {
    const id = str(args.persona_id)
    if (!id) return 'persona_id is required.'
    const { data: existing, error: rErr } = await ctx.modelDb
      .from('personas')
      .select('id, name, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (rErr) return `Error reading the persona: ${rErr.message}`
    const row = existing as { id: string; name: string; organization_id: string } | null
    if (!row || row.organization_id !== ctx.orgId) return "No such persona in this organization's model. Call list_personas first."

    const updates: Record<string, unknown> = {}
    if (str(args.name)) updates.name = str(args.name)
    if (typeof args.role === 'string') updates.role = optStr(args.role)
    if (typeof args.role_description === 'string') updates.description = optStr(args.role_description)
    const color = str(args.color)
    if (color) {
      if (!HEX_COLOR.test(color)) return 'color must be a 6-digit hex value like #6366F1.'
      updates.color = color
    }
    if (typeof args.workstream_code === 'string' && args.workstream_code.trim()) {
      const ws = ctx.wsByCode.get(args.workstream_code.trim())
      if (!ws) return `Workstream code "${args.workstream_code}" does not exist in this organization. Call list_workstreams for the valid codes.`
      updates.workstream_id = ws.id
    }
    if (!Object.keys(updates).length) return 'Nothing to update: pass at least one of name, role, role_description, color, or workstream_code.'

    const { error } = await ctx.modelDb.from('personas').update(updates).eq('id', id).eq('organization_id', ctx.orgId)
    if (error) return `Failed to update the persona: ${error.message}`
    return J({
      updated: 'persona',
      id,
      previous_name: row.name,
      changed_fields: Object.keys(updates),
      link: '/process/personas',
    })
  },
}

// ─── The belt ───────────────────────────────────────────────────────────────

export const STUDIO_WRITE_TOOLS: AgentTool[] = [
  CREATE_PROCESS_MODEL,
  ADD_PROCESS_NODES,
  CREATE_DIAGRAM,
  UPDATE_CAPABILITY_STATUS,
  ADD_CAPABILITY,
  CREATE_PERSONA,
  UPDATE_PERSONA,
]
