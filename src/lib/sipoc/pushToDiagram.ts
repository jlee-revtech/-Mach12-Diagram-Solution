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
