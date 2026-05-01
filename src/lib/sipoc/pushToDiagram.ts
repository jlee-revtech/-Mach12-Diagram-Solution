import { v4 as uuid } from 'uuid'
import type { HydratedCapability, LogicalSystem } from './types'
import type { SystemNode, SystemGroupNode, DataFlowEdge } from '@/lib/diagram/types'
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

/**
 * Build a canvas seed (nodes/edges/group) representing one L3 SIPOC.
 *
 * Layout (left to right, one row per input):
 *   [Source systems] → [Feeding system] → [Capability host system]
 *
 * Each `feeding → host` edge is labeled with the input information product name.
 * Systems are deduped by LogicalSystem.id within the push so the same system
 * appears as a single box even when reused across inputs (e.g. capability host).
 */
export function buildL3GroupCanvasData(
  hydrated: HydratedCapability,
  baseX = 100,
  baseY = 100,
): SeedResult {
  const nodes: SystemNode[] = []
  const edges: DataFlowEdge[] = []
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

  // Place the capability's host system once, vertically centered later
  let hostNodeId: string | null = null

  const activeInputs = hydrated.inputs.filter(i => !i.archived_at)
  let cursorY = baseY + PAD_TOP

  // First pass: drop source/feeding systems per input row, collect rows for edge wiring
  type Row = { sourceIds: string[]; feedingId: string | null; ipName: string }
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

    rows.push({ sourceIds, feedingId, ipName: input.informationProduct.name })

    // Advance cursor by the taller of the two columns for this row
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

  // Wire edges
  for (const row of rows) {
    if (row.feedingId) {
      // Sources → Feeding (no label)
      for (const sid of row.sourceIds) {
        edges.push({
          id: `edge-${uuid()}`,
          source: sid,
          target: row.feedingId,
          type: 'dataFlow',
          data: { label: '', dataElements: [], direction: 'forward' },
        })
      }
      // Feeding → Host (label = IP name)
      if (hostNodeId) {
        edges.push({
          id: `edge-${uuid()}`,
          source: row.feedingId,
          target: hostNodeId,
          type: 'dataFlow',
          data: { label: row.ipName, dataElements: [], direction: 'forward' },
        })
      }
    } else if (hostNodeId) {
      // No feeding system declared — sources go straight to host with the IP label
      for (const sid of row.sourceIds) {
        edges.push({
          id: `edge-${uuid()}`,
          source: sid,
          target: hostNodeId,
          type: 'dataFlow',
          data: { label: row.ipName, dataElements: [], direction: 'forward' },
        })
      }
    }
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
  mapTitle?: string,
): Promise<string> {
  const seed = buildL3GroupCanvasData(hydrated)
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
