import type { SystemType } from '@/lib/diagram/types'
import type { ProcessNode } from '@/lib/process/types'
import type { BedrockSystemWithPhysicals } from '@/lib/bedrock/types'
import { getProcessModel, listProcessNodes } from '@/lib/supabase/process-models'
import { listLogicalSystems } from '@/lib/supabase/capability-maps'
import { listBedrockCatalog, seedBedrockSystems, tagBedrockDiagram } from '@/lib/supabase/bedrock-systems'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import { createDiagram, saveDiagram } from '@/lib/supabase/diagrams'
import { buildIntegrationDiagram, type MergedIntegration } from './buildIntegrationDiagram'

interface AiIntegration {
  l2?: string
  l3?: string
  sourceSystemType?: string
  targetSystemType?: string
  direction?: string
  dataObjects?: { name: string; elementType?: string; description?: string }[]
  frequency?: string
  integrationPattern?: string
  trigger?: string
}

/**
 * Generate (or regenerate) a Bedrock Data Integration diagram from a Process
 * Studio model's BPML. AI-deterministic (temperature 0), one call per L1
 * scenario, merged into a single editable data-architecture diagram grounded in
 * the org's bedrock systems catalog and grouped by workstream.
 */
export async function generateBedrockIntegrationDiagram(
  modelId: string,
  orgId: string,
  userId: string,
  opts: { workstreamId?: string | null; existingDiagramId?: string } = {},
): Promise<string> {
  const [model, nodes, logicalSystems, workstreams] = await Promise.all([
    getProcessModel(modelId),
    listProcessNodes(modelId),
    listLogicalSystems(orgId),
    listWorkstreams(orgId),
  ])
  if (!nodes.length) throw new Error('This process model has no processes yet. Build the BPML hierarchy first.')

  let catalog = await listBedrockCatalog(orgId)
  if (catalog.length === 0) catalog = await seedBedrockSystems(orgId, userId)
  const catalogTypes = new Set(catalog.map(c => c.system_type))
  if (catalogTypes.size === 0) throw new Error('No bedrock systems are defined. Seed the Bedrock Systems catalog first.')

  const modelTitle = model?.title || 'Process Model'
  const wsNameById = new Map(workstreams.map(w => [w.id, w.name]))
  const logicalById = new Map(logicalSystems.map(s => [s.id, s]))

  // ─── Build the L1 → L2 → L3 tree from the flat node list ───
  const childrenOf = (id: string | null) =>
    nodes.filter(n => (n.parent_id ?? null) === id).sort((a, b) => a.sort_order - b.sort_order)
  const roots = nodes.filter(n => n.parent_id == null || n.level === 1).sort((a, b) => a.sort_order - b.sort_order)
  const l1s = roots.length ? roots : nodes.filter(n => n.level === 1)

  const boundSystemsFor = (leaf: ProcessNode): { systemType: string; name: string }[] => {
    const lanes = leaf.graph_data?.lanes || []
    const out: { systemType: string; name: string }[] = []
    const seen = new Set<string>()
    for (const lane of lanes) {
      if (!lane.systemId) continue
      const sys = logicalById.get(lane.systemId)
      if (!sys?.system_type) continue
      if (!catalogTypes.has(sys.system_type)) continue
      if (seen.has(sys.system_type)) continue
      seen.add(sys.system_type)
      out.push({ systemType: sys.system_type, name: sys.name })
    }
    return out
  }

  // ─── Per-L1 AI calls (deterministic order), merged ───
  const catalogCtx = catalog.map(c => ({
    systemType: c.system_type,
    label: c.label,
    primaryPhysical: (c.physicals.find(p => p.is_primary) || c.physicals[0])?.name,
    physicals: c.physicals.map(p => p.name),
  }))

  const merged: MergedIntegration[] = []

  for (const l1 of l1s) {
    const groups = childrenOf(l1.id).map(g => {
      const leaves = childrenOf(g.id)
      const processes = (leaves.length ? leaves : [g]).map(p => ({
        name: p.name,
        description: p.description,
        scopeItemRef: p.scope_item_ref ?? null,
        boundSystems: boundSystemsFor(p),
      }))
      return { name: g.name, description: g.description, processes }
    })
    // Scenarios with no children still get a single process (themselves).
    const effectiveGroups = groups.length ? groups : [{ name: l1.name, description: l1.description, processes: [{ name: l1.name, description: l1.description, scopeItemRef: l1.scope_item_ref ?? null, boundSystems: boundSystemsFor(l1) }] }]
    const wsName = l1.workstream_id ? wsNameById.get(l1.workstream_id) ?? null : null

    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bedrock-integrations',
        context: {
          modelTitle,
          scenario: { name: l1.name, description: l1.description, workstream: wsName, groups: effectiveGroups },
          catalog: catalogCtx,
        },
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `AI generation failed for "${l1.name}"`)
    }
    const data = await res.json() as { integrations?: AiIntegration[] }
    for (const it of data.integrations || []) {
      const src = it.sourceSystemType as SystemType | undefined
      const tgt = it.targetSystemType as SystemType | undefined
      if (!src || !tgt || src === tgt) continue
      if (!catalogTypes.has(src) || !catalogTypes.has(tgt)) continue
      merged.push({
        l1: l1.name,
        l2: it.l2 || '',
        l3: it.l3 || '',
        sourceSystemType: src,
        targetSystemType: tgt,
        direction: it.direction === 'bidirectional' ? 'bidirectional' : 'forward',
        dataObjects: it.dataObjects || [],
        frequency: it.frequency,
        integrationPattern: it.integrationPattern,
        trigger: it.trigger,
        workstream: wsName,
      })
    }
  }

  if (merged.length === 0) {
    throw new Error('No inter-system integrations could be derived. Add bound swimlanes or richer process descriptions, then try again.')
  }

  const seed = buildIntegrationDiagram(merged, catalog as BedrockSystemWithPhysicals[], workstreams.map(w => ({ id: w.id, name: w.name, color: w.color })))

  // ─── Persist ───
  if (opts.existingDiagramId) {
    await saveDiagram(opts.existingDiagramId, userId, {
      canvas_data: { nodes: seed.nodes, edges: seed.edges, groups: seed.groups, artifacts: [] },
    })
    return opts.existingDiagramId
  }

  const diagram = await createDiagram(orgId, userId, `${modelTitle} — Bedrock Integrations`)
  await saveDiagram(diagram.id, userId, {
    canvas_data: { nodes: seed.nodes, edges: seed.edges, groups: seed.groups, artifacts: [] },
    process_context: modelTitle,
  })
  await tagBedrockDiagram(diagram.id, {
    diagram_kind: 'bedrock_integration',
    source_process_model_id: modelId,
    workstream_id: opts.workstreamId ?? null,
  })
  return diagram.id
}
