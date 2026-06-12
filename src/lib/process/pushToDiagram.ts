import { v4 as uuid } from 'uuid'
import type { ProcessNode, ProcessGraph } from '@/lib/process/types'
import type { LogicalSystem } from '@/lib/sipoc/types'
import type { SystemNode, SystemGroupNode, DataFlowEdge, DataElement } from '@/lib/diagram/types'
import { createDiagram, saveDiagram } from '@/lib/supabase/diagrams'

const SYSTEM_W = 180
const SYSTEM_H = 80
const COL_GAP = 110
const PAD_X = 40
const PAD_TOP = 56
const PAD_BOTTOM = 40

interface SeedResult {
  nodes: SystemNode[]
  edges: DataFlowEdge[]
  groups: SystemGroupNode[]
  systemCount: number
}

/**
 * Scaffold a data-architecture diagram from a leaf process's BPMN graph.
 *
 * Mapping:
 *   - Each swimlane bound to a logical system → one SystemNode (deduped by system).
 *   - Each sequence flow whose source and target elements sit in *different*
 *     system-bound lanes → a DataFlowEdge between those systems, carrying the
 *     target element's label as a DataElement (the work/data handed over).
 *
 * Edges are coalesced per (source, target) system pair.
 */
export function buildProcessScaffold(
  graph: ProcessGraph,
  systems: LogicalSystem[],
  groupLabel: string,
  baseX = 100,
  baseY = 100,
): SeedResult {
  const systemsById = new Map(systems.map(s => [s.id, s]))
  const laneById = new Map(graph.lanes.map(l => [l.id, l]))

  // element id → laneId
  const elementLane = new Map<string, string | undefined>()
  for (const n of graph.nodes) {
    elementLane.set(n.id, (n.data as any)?.laneId)
  }
  // element id → label (for edge data element naming)
  const elementLabel = new Map<string, string>()
  for (const n of graph.nodes) {
    elementLabel.set(n.id, (n.data as any)?.label || 'Step')
  }

  // Place one SystemNode per distinct bound system, ordered by lane order.
  const systemNodeId = new Map<string, string>()  // systemId → node id
  const nodes: SystemNode[] = []
  const orderedLanes = [...graph.lanes].sort((a, b) => a.order - b.order)
  let col = 0
  for (const lane of orderedLanes) {
    if (!lane.systemId) continue
    if (systemNodeId.has(lane.systemId)) continue
    const sys = systemsById.get(lane.systemId)
    if (!sys) continue
    const id = `system-${uuid()}`
    nodes.push({
      id,
      type: 'system',
      position: { x: baseX + PAD_X + col * (SYSTEM_W + COL_GAP), y: baseY + PAD_TOP },
      data: { label: sys.name, systemType: sys.system_type ?? 'custom' },
    })
    systemNodeId.set(lane.systemId, id)
    col++
  }

  // laneId → systemNodeId (resolve through the lane's bound system)
  const laneSystemNode = (laneId?: string): string | null => {
    if (!laneId) return null
    const lane = laneById.get(laneId)
    if (!lane?.systemId) return null
    return systemNodeId.get(lane.systemId) ?? null
  }

  // Coalesce edges per (source, target) system pair.
  const edgeByKey = new Map<string, DataFlowEdge>()
  const addToEdge = (source: string, target: string, label: string) => {
    if (source === target) return
    const key = `${source}->${target}`
    let edge = edgeByKey.get(key)
    if (!edge) {
      edge = { id: `edge-${uuid()}`, source, target, type: 'dataFlow', data: { label: '', dataElements: [], direction: 'forward' } }
      edgeByKey.set(key, edge)
    }
    const list = edge.data!.dataElements
    if (!list.some(d => d.name.trim().toLowerCase() === label.trim().toLowerCase())) {
      const de: DataElement = { id: uuid(), name: label, elementType: 'document' }
      list.push(de)
    }
  }

  for (const e of graph.edges) {
    const srcNode = laneSystemNode(elementLane.get(e.source as string))
    const tgtNode = laneSystemNode(elementLane.get(e.target as string))
    if (!srcNode || !tgtNode) continue
    addToEdge(srcNode, tgtNode, elementLabel.get(e.target as string) || 'Handoff')
  }

  const edges: DataFlowEdge[] = []
  for (const edge of edgeByKey.values()) {
    const list = edge.data!.dataElements
    if (list.length === 1) edge.data!.label = list[0].name
    edges.push(edge)
  }

  // Group wrapper
  const width = Math.max(SYSTEM_W + 2 * PAD_X, PAD_X * 2 + col * SYSTEM_W + (col - 1) * COL_GAP)
  const height = PAD_TOP + SYSTEM_H + PAD_BOTTOM
  const group: SystemGroupNode = {
    id: `group-${uuid()}`,
    type: 'systemGroup',
    position: { x: baseX, y: baseY },
    zIndex: -1,
    style: { width, height: Math.max(220, height), pointerEvents: 'none' as const },
    focusable: false,
    data: { label: groupLabel, color: '#0EA5E9' },
  }

  return { nodes, edges, groups: [group], systemCount: nodes.length }
}

/**
 * Create a new data diagram for the org seeded from the leaf process. Returns
 * the new diagram id, or throws if the leaf has no system-bound lanes.
 */
export async function pushProcessLeafToNewDiagram(
  node: ProcessNode,
  systems: LogicalSystem[],
  orgId: string,
  userId: string,
  modelTitle?: string,
): Promise<string> {
  const graph = node.graph_data
  if (!graph || !graph.lanes?.length) {
    throw new Error('This process has no swimlanes yet. Add lanes and bind them to systems first.')
  }
  const seed = buildProcessScaffold(graph, systems, node.name)
  if (seed.systemCount === 0) {
    throw new Error('Bind at least one swimlane to a system before scaffolding a data diagram.')
  }

  const title = modelTitle ? `${modelTitle} — ${node.name}` : node.name
  const diagram = await createDiagram(orgId, userId, title)
  await saveDiagram(diagram.id, userId, {
    canvas_data: { nodes: seed.nodes, edges: seed.edges, groups: seed.groups, artifacts: [] },
    process_context: node.name,
  })
  return diagram.id
}
