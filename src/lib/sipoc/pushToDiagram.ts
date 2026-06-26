import { v4 as uuid } from 'uuid'
import type { HydratedCapability, LogicalSystem, SystemDataElement, InformationProduct } from './types'
import type { SystemNode, SystemGroupNode, DataFlowEdge, DataElement } from '@/lib/diagram/types'
import { createDiagram, saveDiagram } from '@/lib/supabase/diagrams'

const SYSTEM_W = 180
const SYSTEM_H = 80
const COL_GAP = 90
const ROW_GAP = 24
const PAD_X = 30
const PAD_TOP = 56
const PAD_BOTTOM = 30

interface SeedResult {
  nodes: SystemNode[]
  edges: DataFlowEdge[]
  groups: SystemGroupNode[]
}

interface BuildOptions {
  baseX?: number
  baseY?: number
  /** Org-scoped system data elements; used to populate per-IP attributes. */
  systemDataElements?: SystemDataElement[]
}

/**
 * Build a canvas seed (nodes/edges/group) representing one L3 SIPOC.
 *
 * Layout (left to right, one row per input):
 *   [Source systems] → [Feeding system] → [Capability host system]
 *
 * Each information product flows along the chain as a `DataElement` on every
 * edge it traverses (source→feeding, feeding→host). Edges are coalesced per
 * (source, target) pair so multiple inputs sharing the same wire show as a
 * single edge with multiple data elements rather than parallel edges.
 *
 * Systems are deduped by LogicalSystem.id within the push so the same system
 * appears as a single box even when reused across inputs (e.g. capability host).
 */
export function buildL3GroupCanvasData(
  hydrated: HydratedCapability,
  options: BuildOptions = {},
): SeedResult {
  const baseX = options.baseX ?? 100
  const baseY = options.baseY ?? 100
  const sdesById = new Map(
    (options.systemDataElements ?? []).map(s => [s.id, s] as const),
  )

  const nodes: SystemNode[] = []
  const systemIdToNodeId = new Map<string, string>()

  const colSourceX = baseX + PAD_X
  const colFeedingX = colSourceX + SYSTEM_W + COL_GAP
  const colHostX = colFeedingX + SYSTEM_W + COL_GAP

  // Place a system node, deduping by logical-system id.
  const placeSystem = (sys: LogicalSystem, x: number, y: number): string => {
    const cached = systemIdToNodeId.get(sys.id)
    if (cached) return cached
    const id = `system-${uuid()}`
    nodes.push({
      id,
      type: 'system',
      position: { x, y },
      data: {
        label: sys.name,
        systemType: sys.system_type ?? 'custom',
      },
    })
    systemIdToNodeId.set(sys.id, id)
    return id
  }

  // Build a fresh DataElement from an InformationProduct. Each edge gets its
  // own copy (own ids) so edits on one edge don't bleed onto another.
  const buildDataElement = (ip: InformationProduct): DataElement => {
    const attributes = (ip.data_element_ids || [])
      .map(sid => sdesById.get(sid))
      .filter((s): s is SystemDataElement => !!s)
      .map(s => ({ id: uuid(), name: s.name, description: s.description }))
    return {
      id: uuid(),
      name: ip.name,
      elementType: 'data_object',
      ...(ip.description ? { description: ip.description } : {}),
      ...(attributes.length > 0 ? { attributes } : {}),
    }
  }

  // Place the capability's host system once, vertically centered later
  let hostNodeId: string | null = null

  const activeInputs = hydrated.inputs.filter(i => !i.archived_at)
  let cursorY = baseY + PAD_TOP

  // First pass: drop source/feeding systems per input row, collect rows for edge wiring
  type Row = { sourceIds: string[]; feedingId: string | null; ip: InformationProduct }
  const rows: Row[] = []

  for (const input of activeInputs) {
    let rowY = cursorY
    const sourceIds: string[] = []
    for (const src of input.sourceSystems) {
      sourceIds.push(placeSystem(src, colSourceX, rowY))
      rowY += SYSTEM_H + ROW_GAP
    }

    const feedingId = input.feedingSystem
      ? placeSystem(input.feedingSystem, colFeedingX, cursorY)
      : null

    rows.push({ sourceIds, feedingId, ip: input.informationProduct })

    const sourceColEndY = sourceIds.length > 0 ? rowY : cursorY + SYSTEM_H
    const feedingColEndY = feedingId ? cursorY + SYSTEM_H : cursorY
    cursorY = Math.max(sourceColEndY, feedingColEndY) + ROW_GAP
  }

  // Place the host system roughly vertically centered in the column
  if (hydrated.system) {
    const totalHeight = Math.max(SYSTEM_H, cursorY - (baseY + PAD_TOP) - ROW_GAP)
    const hostY = baseY + PAD_TOP + Math.max(0, (totalHeight - SYSTEM_H) / 2)
    hostNodeId = placeSystem(hydrated.system, colHostX, hostY)
  }

  // Coalesce edges by (source, target). Each input's IP becomes a DataElement
  // on every edge along its path through the chain.
  const edgeByKey = new Map<string, DataFlowEdge>()

  const addToEdge = (source: string, target: string, ip: InformationProduct) => {
    const key = `${source}->${target}`
    let edge = edgeByKey.get(key)
    if (!edge) {
      edge = {
        id: `edge-${uuid()}`,
        source,
        target,
        type: 'dataFlow',
        data: { label: '', dataElements: [], direction: 'forward' },
      }
      edgeByKey.set(key, edge)
    }
    const list = edge.data!.dataElements
    // Dedup by IP name (case-insensitive) within a single edge — the same IP
    // shouldn't appear twice on one wire even if multiple input rows land here.
    const exists = list.some(d => d.name.trim().toLowerCase() === ip.name.trim().toLowerCase())
    if (!exists) list.push(buildDataElement(ip))
  }

  for (const row of rows) {
    if (row.feedingId) {
      for (const sid of row.sourceIds) {
        addToEdge(sid, row.feedingId, row.ip)
      }
      if (hostNodeId) {
        addToEdge(row.feedingId, hostNodeId, row.ip)
      }
    } else if (hostNodeId) {
      // No feeding system declared — sources go straight to host
      for (const sid of row.sourceIds) {
        addToEdge(sid, hostNodeId, row.ip)
      }
    }
  }

  // Finalize edges: when a wire carries exactly one data element, set its
  // label to that element's name so it's visible without selecting the edge.
  // Multi-element edges leave the label blank — the elements panel reveals them.
  const edges: DataFlowEdge[] = []
  for (const edge of edgeByKey.values()) {
    const list = edge.data!.dataElements
    if (list.length === 1) {
      edge.data!.label = list[0].name
    }
    edges.push(edge)
  }

  // Compute group dimensions
  const lastY = Math.max(cursorY, baseY + PAD_TOP + SYSTEM_H + PAD_BOTTOM)
  const width = colHostX + SYSTEM_W + PAD_X - baseX
  const height = lastY + PAD_BOTTOM - baseY

  const group: SystemGroupNode = {
    id: `group-${uuid()}`,
    type: 'systemGroup',
    position: { x: baseX, y: baseY },
    zIndex: -1,
    style: {
      width,
      height: Math.max(220, height),
      pointerEvents: 'none' as const,
    },
    focusable: false,
    data: {
      label: hydrated.name,
      color: hydrated.color || '#374A5E',
    },
  }

  return { nodes, edges, groups: [group] }
}

/**
 * Create a brand-new diagram for the org and seed it from the L3.
 * Returns the new diagram's id for navigation.
 */
export async function pushL3ToNewDiagram(
  hydrated: HydratedCapability,
  orgId: string,
  userId: string,
  mapTitle: string | undefined,
  systemDataElements?: SystemDataElement[],
): Promise<string> {
  const seed = buildL3GroupCanvasData(hydrated, { systemDataElements })
  const title = mapTitle
    ? `${mapTitle} — ${hydrated.name}`
    : hydrated.name

  const diagram = await createDiagram(orgId, userId, title)
  await saveDiagram(diagram.id, userId, {
    canvas_data: {
      nodes: seed.nodes,
      edges: seed.edges,
      groups: seed.groups,
      artifacts: [],
    },
  })
  return diagram.id
}

// ─── Whole-map (deduplicated, layered) data-architecture build ───
// Sizing/spacing tuned for the SystemNode (min-w 180, ~72-92px tall) and the wide
// data-element edge labels that sit between columns. Generous, consistent gaps.
const MAP_SYSTEM_W = 180
const MAP_SYSTEM_H = 92
const MAP_LAYER_GAP = 240 // horizontal gap between layers — room for edge labels
const MAP_ROW_GAP = 64
const MAP_BASE_X = 120
const MAP_BASE_Y = 120

/**
 * Build ONE clean data-architecture canvas from every L3 SIPOC (leaf capability)
 * in a map. Unlike a per-L3 stack, systems are deduplicated to a single node each
 * and laid out left → right by their role in the flow (sources → feeding → hosts)
 * via longest-path layering, so the diagram reads as a proper system-integration
 * lineage with orthogonal (smoothstep) edges and no overlaps.
 *
 *   - One SystemNode per distinct logical system (deduped by id).
 *   - One DataFlowEdge per (source, target) pair, carrying every information
 *     product that flows between them as DataElements (deduped by name).
 *   - Columns assigned by longest path from the pure-source systems; each column
 *     is vertically centered for a balanced, designed look.
 */
export function buildSipocSystemDiagram(
  leaves: HydratedCapability[],
  systemDataElements: SystemDataElement[] = [],
): { nodes: SystemNode[]; edges: DataFlowEdge[] } {
  const sdesById = new Map(systemDataElements.map(s => [s.id, s] as const))
  const systems = new Map<string, LogicalSystem>()
  const reg = (s?: LogicalSystem | null) => { if (s) systems.set(s.id, s) }

  const buildDataElement = (ip: InformationProduct): DataElement => {
    const attributes = (ip.data_element_ids || [])
      .map(sid => sdesById.get(sid))
      .filter((s): s is SystemDataElement => !!s)
      .map(s => ({ id: uuid(), name: s.name, description: s.description }))
    return {
      id: uuid(),
      name: ip.name,
      elementType: 'data_object',
      ...(ip.description ? { description: ip.description } : {}),
      ...(attributes.length > 0 ? { attributes } : {}),
    }
  }

  // Coalesce edges per (source → target) system pair across the whole map.
  type E = { source: string; target: string; els: DataElement[]; ctx: Set<string> }
  const edgeMap = new Map<string, E>()
  const addFlow = (src: LogicalSystem, tgt: LogicalSystem, ip: InformationProduct, l3: string) => {
    if (src.id === tgt.id) return
    reg(src); reg(tgt)
    const key = `${src.id}->${tgt.id}`
    let e = edgeMap.get(key)
    if (!e) { e = { source: src.id, target: tgt.id, els: [], ctx: new Set() }; edgeMap.set(key, e) }
    e.ctx.add(l3)
    if (!e.els.some(d => d.name.trim().toLowerCase() === ip.name.trim().toLowerCase())) e.els.push(buildDataElement(ip))
  }

  for (const leaf of leaves) {
    reg(leaf.system)
    for (const input of leaf.inputs.filter(i => !i.archived_at)) {
      const ip = input.informationProduct
      const feeding = input.feedingSystem
      const host = leaf.system
      for (const src of input.sourceSystems) {
        if (feeding) addFlow(src, feeding, ip, leaf.name)
        else if (host) addFlow(src, host, ip, leaf.name)
      }
      if (feeding && host) addFlow(feeding, host, ip, leaf.name)
    }
  }

  const sysIds = [...systems.keys()]
  const edgesArr = [...edgeMap.values()]

  // Longest-path layering (left → right). Iteration-capped so cycles can't hang.
  const layer = new Map<string, number>(sysIds.map(id => [id, 0]))
  for (let iter = 0; iter < sysIds.length; iter++) {
    let changed = false
    for (const e of edgesArr) {
      const nl = (layer.get(e.source) ?? 0) + 1
      if (nl > (layer.get(e.target) ?? 0)) { layer.set(e.target, nl); changed = true }
    }
    if (!changed) break
  }

  // Bucket by layer, order within a layer by system name (stable, deterministic).
  const byLayer = new Map<number, string[]>()
  for (const id of sysIds) {
    const l = layer.get(id) ?? 0
    if (!byLayer.has(l)) byLayer.set(l, [])
    byLayer.get(l)!.push(id)
  }
  for (const arr of byLayer.values()) arr.sort((a, b) => systems.get(a)!.name.localeCompare(systems.get(b)!.name))

  const layers = [...byLayer.keys()].sort((a, b) => a - b)
  const colHeight = (n: number) => Math.max(0, n * MAP_SYSTEM_H + (n - 1) * MAP_ROW_GAP)
  const maxH = Math.max(MAP_SYSTEM_H, ...layers.map(l => colHeight(byLayer.get(l)!.length)))

  const nodes: SystemNode[] = []
  for (const l of layers) {
    const col = byLayer.get(l)!
    const startY = MAP_BASE_Y + (maxH - colHeight(col.length)) / 2
    col.forEach((id, row) => {
      const sys = systems.get(id)!
      nodes.push({
        id: `system-${id}`,
        type: 'system',
        position: { x: MAP_BASE_X + l * (MAP_SYSTEM_W + MAP_LAYER_GAP), y: startY + row * (MAP_SYSTEM_H + MAP_ROW_GAP) },
        data: { label: sys.name, systemType: sys.system_type ?? 'custom' },
      })
    })
  }

  const edges: DataFlowEdge[] = []
  for (const key of [...edgeMap.keys()].sort()) {
    const e = edgeMap.get(key)!
    const ctx = [...e.ctx].sort()
    edges.push({
      id: `edge-${key}`,
      source: `system-${e.source}`,
      target: `system-${e.target}`,
      type: 'dataFlow',
      data: {
        label: e.els.length === 1 ? e.els[0].name : `${e.els.length} data objects`,
        dataElements: e.els,
        direction: 'forward',
        ...(ctx.length ? { processContext: ctx.join(', ') } : {}),
      },
    })
  }

  return { nodes, edges }
}

/**
 * Create ONE new diagram seeded from a whole SIPOC map (all L3 leaves), laid out as
 * a clean left → right system-integration lineage. Returns the new diagram's id.
 */
export async function pushMapToNewDiagram(
  leaves: HydratedCapability[],
  orgId: string,
  userId: string,
  mapTitle: string | undefined,
  systemDataElements?: SystemDataElement[],
): Promise<string> {
  const { nodes, edges } = buildSipocSystemDiagram(leaves, systemDataElements ?? [])
  const title = mapTitle ? `${mapTitle} — Data Architecture` : 'SIPOC Data Architecture'
  const diagram = await createDiagram(orgId, userId, title)
  await saveDiagram(diagram.id, userId, {
    canvas_data: { nodes, edges, groups: [], artifacts: [] },
  })
  return diagram.id
}
