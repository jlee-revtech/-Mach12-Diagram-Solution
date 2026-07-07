import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { ProcessGraph } from '@/lib/process/types'
import type { LogicalSystem } from '@/lib/sipoc/types'
import { SYSTEM_TEMPLATES } from '@/lib/diagram/types'
import {
  buildDeterministicArchSpec, mergeArchSpecs, archSpecToCanvas, sanitizeAiSpec,
  type ArchCapabilityInput, type ArchSpec,
} from '@/lib/process/dataArchitecture'

// Generate a workstream's DATA ARCHITECTURE diagram from the L3 process flows
// aligned to it plus the capabilities assigned to those flows. Hybrid pipeline:
// a deterministic backbone (SIPOC capability inputs/outputs + BPMN swimlane
// handoffs, grouped by capability) then an AI enrichment pass, merged so the AI
// can add/rename but never drops the backbone. Persists a new diagram (with
// capability grouping bands), links it back to each source L3 process, and
// returns its id. Org-scoped by the caller's JWT (RLS), like the agents route.

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
const MODEL = process.env.WORKSTREAM_MODEL || 'claude-sonnet-4-6'

const SYSTEM_TYPE_ENUM = SYSTEM_TEMPLATES.map((t) => t.type)

const STR = { type: 'string' } as const
const STR_ARR = { type: 'array', items: STR } as const

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
        description: 'Every system in the architecture. Keep all the provided systems and add connective ones the flows imply (middleware, data warehouse, analytics).',
        items: {
          type: 'object',
          properties: {
            name: STR,
            systemType: { type: 'string', enum: SYSTEM_TYPE_ENUM, description: 'Best-fit system type.' },
            description: STR,
          },
          required: ['name', 'systemType'],
        },
      },
      flows: {
        type: 'array',
        description: 'Directed data flows between systems (by system name). Name the data element(s) that move on each flow.',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Source system name.' },
            to: { type: 'string', description: 'Target system name.' },
            dataElements: { type: 'array', items: STR, description: 'The data objects / documents that flow (e.g. Purchase Order, BOM).' },
            label: STR,
          },
          required: ['from', 'to', 'dataElements'],
        },
      },
      groups: {
        type: 'array',
        description: 'Capability grouping bands. Each groups the systems that realize one capability grouping (by system name). Keep the provided groupings and ensure every system belongs to one.',
        items: {
          type: 'object',
          properties: { label: STR, color: STR, systems: STR_ARR },
          required: ['label', 'systems'],
        },
      },
    },
    required: ['systems', 'flows', 'groups'],
  },
} as const

type Row = Record<string, unknown>

export async function POST(req: NextRequest) {
  try {
    const { orgId, workstreamId, userId } = await req.json()
    const auth = req.headers.get('authorization') || ''
    if (!orgId || !workstreamId) return json({ error: 'orgId and workstreamId are required' }, 400)
    if (!userId) return json({ error: 'userId is required' }, 400)
    if (!ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)

    const db = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: auth ? { Authorization: auth } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Workstream (org-scoped).
    const { data: ws } = await db.from('workstreams').select('id, name, code').eq('id', workstreamId).eq('organization_id', orgId).maybeSingle()
    if (!ws) return json({ error: 'Workstream not found for this organization' }, 404)
    const wsName = (ws.name as string) || (ws.code as string) || 'Workstream'

    // L3 process leaves aligned to the workstream.
    const { data: nodeRows } = await db
      .from('process_nodes')
      .select('id, name, graph_data, sipoc_capability_id, is_leaf, level')
      .eq('workstream_id', workstreamId)
    const leaves = (nodeRows || []).filter((n: Row) => n.is_leaf === true || n.level === 3)
    const nodeIds = leaves.map((n: Row) => n.id as string)

    // Capability assignments: primary sipoc_capability_id + the multi-assign links.
    const capIdSet = new Set<string>()
    for (const n of leaves) if (n.sipoc_capability_id) capIdSet.add(n.sipoc_capability_id as string)
    if (nodeIds.length) {
      const { data: links } = await db
        .from('process_node_links')
        .select('process_node_id, target_id, link_kind')
        .in('process_node_id', nodeIds)
        .eq('link_kind', 'sipoc_capability')
      for (const l of links || []) capIdSet.add((l as Row).target_id as string)
    }
    const capIds = Array.from(capIdSet)

    // Org data used to resolve names.
    const [{ data: sysRows }, { data: ipRows }] = await Promise.all([
      db.from('logical_systems').select('id, name, system_type').eq('organization_id', orgId),
      db.from('information_products').select('id, name').eq('organization_id', orgId),
    ])
    const systems: LogicalSystem[] = (sysRows || []) as unknown as LogicalSystem[]
    const sysNameById = new Map<string, string>((sysRows || []).map((s: Row) => [s.id as string, s.name as string]))
    const ipNameById = new Map<string, string>((ipRows || []).map((p: Row) => [p.id as string, p.name as string]))

    // Capabilities + their L2 parent (the grouping) + inputs/outputs.
    const capabilities: ArchCapabilityInput[] = []
    if (capIds.length) {
      const { data: caps } = await db.from('capabilities').select('id, name, color, parent_id, system_id').in('id', capIds)
      const capList = (caps || []) as Row[]
      const parentIds = Array.from(new Set(capList.map((c) => c.parent_id as string).filter(Boolean)))
      const parentById = new Map<string, Row>()
      if (parentIds.length) {
        const { data: parents } = await db.from('capabilities').select('id, name, color').in('id', parentIds)
        for (const p of parents || []) parentById.set((p as Row).id as string, p as Row)
      }
      const [{ data: inputs }, { data: outputs }] = await Promise.all([
        db.from('capability_inputs').select('capability_id, information_product_id, source_system_ids, feeding_system_id, archived_at').in('capability_id', capIds),
        db.from('capability_outputs').select('capability_id, information_product_id, destination_system_ids, archived_at').in('capability_id', capIds),
      ])
      const inByCap = new Map<string, Row[]>()
      for (const i of inputs || []) if (!(i as Row).archived_at) push(inByCap, (i as Row).capability_id as string, i as Row)
      const outByCap = new Map<string, Row[]>()
      for (const o of outputs || []) if (!(o as Row).archived_at) push(outByCap, (o as Row).capability_id as string, o as Row)

      for (const c of capList) {
        const parent = c.parent_id ? parentById.get(c.parent_id as string) : null
        const sysName = (nameOf: unknown) => (nameOf ? sysNameById.get(String(nameOf)) ?? null : null)
        capabilities.push({
          id: c.id as string,
          name: c.name as string,
          groupLabel: (parent?.name as string) || (c.name as string),
          groupColor: (parent?.color as string) || (c.color as string) || null,
          homeSystemName: sysName(c.system_id),
          inputs: (inByCap.get(c.id as string) || []).map((i) => ({
            product: ipNameById.get(String(i.information_product_id)) || 'Data',
            sourceSystems: [
              ...((i.source_system_ids as string[]) || []),
              ...(i.feeding_system_id ? [i.feeding_system_id as string] : []),
            ].map((id) => sysNameById.get(id)).filter((x): x is string => !!x),
          })),
          outputs: (outByCap.get(c.id as string) || []).map((o) => ({
            product: ipNameById.get(String(o.information_product_id)) || 'Data',
            destSystems: ((o.destination_system_ids as string[]) || []).map((id) => sysNameById.get(id)).filter((x): x is string => !!x),
          })),
        })
      }
    }

    const processes = leaves.map((n: Row) => ({
      id: n.id as string,
      name: n.name as string,
      graph: (n.graph_data as ProcessGraph | null) ?? null,
    }))

    // Deterministic backbone.
    const base = buildDeterministicArchSpec({ workstreamName: wsName, systems, processes, capabilities })
    if (base.systems.length === 0) {
      return json({
        error: 'Nothing to build from yet. Assign capabilities to this workstream\'s L3 process flows (or bind swimlanes to systems), then generate.',
      }, 422)
    }

    // AI enrichment.
    let merged: ArchSpec = base
    try {
      const ai = await enrich(base, wsName, processes.map((p) => p.name), capabilities)
      merged = mergeArchSpecs(base, sanitizeAiSpec(ai))
    } catch {
      // AI optional: fall back to the deterministic backbone rather than failing.
      merged = base
    }

    const canvas = archSpecToCanvas(merged)
    const title = merged.title || `${wsName} — Data Architecture`

    // Persist the diagram (RLS via the caller's JWT) and link it back to each L3.
    const { data: created, error: insErr } = await db
      .from('diagrams')
      .insert({
        organization_id: orgId,
        title,
        description: merged.description ?? null,
        created_by: userId,
        updated_by: userId,
        workstream_id: workstreamId,
        process_context: wsName,
        canvas_data: { nodes: canvas.nodes, edges: canvas.edges, groups: canvas.groups, artifacts: [] },
      })
      .select('id')
      .single()
    if (insErr || !created) return json({ error: insErr?.message || 'Failed to save the diagram' }, 500)
    const diagramId = (created as Row).id as string

    if (nodeIds.length) {
      const linkRows = nodeIds.map((id) => ({ process_node_id: id, link_kind: 'data_diagram', target_id: diagramId, label: title, created_by: userId }))
      // Best-effort: a failed back-link should not lose the generated diagram.
      await db.from('process_node_links').insert(linkRows)
    }

    return json({
      diagramId,
      title,
      systemCount: canvas.nodes.length,
      flowCount: canvas.edges.length,
      groupCount: canvas.groups.length,
      processCount: processes.length,
      capabilityCount: capabilities.length,
    }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function push<T>(m: Map<string, T[]>, k: string, v: T) {
  const a = m.get(k)
  if (a) a.push(v)
  else m.set(k, [v])
}

async function enrich(
  base: ArchSpec,
  workstreamName: string,
  processNames: string[],
  capabilities: ArchCapabilityInput[],
): Promise<unknown> {
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })
  const system = `You are a world-class SAP S/4HANA + Dassian Aerospace & Defense enterprise data architect. You are given a DETERMINISTIC backbone of a workstream's data architecture (systems, data flows, capability grouping bands) derived from its process flows and the capabilities assigned to them. Enrich it into a clean, presentation-ready data architecture:
- Keep every provided system, flow, and grouping. Do not drop anything.
- Add only genuinely implied connective systems (integration middleware, data warehouse, analytics) when flows clearly need them.
- Give every data flow a concrete data element name (the document or data object that moves, e.g. Purchase Order, Bill of Materials, Cost Estimate), not a step name.
- Ensure every system belongs to exactly one capability grouping band; put shared/cross-cutting systems in a "Shared Services" band.
- Keep labels short. Never use em-dashes or en-dashes; use commas, colons, parentheses, or periods.`

  const capLines = capabilities.map((c) => {
    const ins = c.inputs.map((i) => `${i.product} from [${i.sourceSystems.join(', ') || '?'}]`).join('; ')
    const outs = c.outputs.map((o) => `${o.product} to [${o.destSystems.join(', ') || '?'}]`).join('; ')
    return `- ${c.name} (grouping: ${c.groupLabel}${c.homeSystemName ? `, system: ${c.homeSystemName}` : ''})${ins ? ` | inputs: ${ins}` : ''}${outs ? ` | outputs: ${outs}` : ''}`
  }).join('\n')

  const user = `Workstream: ${workstreamName}
Process flows in scope: ${processNames.join('; ') || '(none modeled)'}

Assigned capabilities (the grouping structure):
${capLines || '(none assigned)'}

Deterministic backbone to enrich (return the SAME shape, keeping all of it):
${JSON.stringify(base)}

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

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
