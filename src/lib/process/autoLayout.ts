import type { Node, Edge } from '@xyflow/react'
import type { BpmnElementType } from '@/lib/process/types'

// ─────────────────────────────────────────────────────────────
// Swimlane-aware layered auto-layout for the BPMN leaf editor.
//
// Goals (per product requirements):
//  1. Generous, even spacing between elements.
//  2. Minimize connector crossings (barycenter ordering within lanes).
//  3. Keep every element inside its swimlane; expand lanes vertically and
//     horizontally to fit their contents.
//  4. Clean left-to-right layered flow that is easy to follow.
// ─────────────────────────────────────────────────────────────

const COL_GAP = 80          // horizontal gap between layers
const ROW_GAP = 40          // vertical gap between stacked tracks in a lane
const LANE_GUTTER = 36      // left label gutter inside a lane
const START_X = LANE_GUTTER + 28
const LANE_PAD_TOP = 30
const LANE_PAD_BOTTOM = 22
const LANE_MIN_H = 120
const LANE_MIN_W = 640

const EVENT_TYPES = new Set<BpmnElementType>(['startEvent', 'endEvent', 'intermediateEvent', 'boundaryEvent'])
const GATEWAY_TYPES = new Set<BpmnElementType>(['exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway'])

function sizeOf(n: Node): { w: number; h: number } {
  const t = (n.data as { elementType?: BpmnElementType })?.elementType
  if (t && EVENT_TYPES.has(t)) return { w: n.measured?.width ?? 56, h: n.measured?.height ?? 56 }
  if (t && GATEWAY_TYPES.has(t)) return { w: n.measured?.width ?? 52, h: n.measured?.height ?? 52 }
  return { w: n.measured?.width ?? 150, h: n.measured?.height ?? 64 }
}

/**
 * Re-layout the element nodes into clean layered columns within their lanes,
 * and resize/reposition the lane bands to contain them. Returns a new node
 * array (lane nodes resized + element nodes repositioned); edges are unchanged.
 */
export function autoLayoutProcess(nodes: Node[], edges: Edge[]): Node[] {
  const laneNodes = nodes.filter(n => n.type === 'processLane').sort((a, b) => a.position.y - b.position.y)
  const elements = nodes.filter(n => n.type === 'processElement')
  if (elements.length === 0) return nodes

  // Lane index by bare id (lane node id is `lane-<bareId>`)
  const laneOrder = new Map<string, number>()
  laneNodes.forEach((ln, i) => laneOrder.set(ln.id.replace(/^lane-/, ''), i))
  const laneCount = Math.max(1, laneNodes.length)
  const laneOf = (n: Node): number => {
    const lid = (n.data as { laneId?: string })?.laneId
    const idx = lid != null ? laneOrder.get(lid) : undefined
    return idx ?? 0
  }

  // ── Adjacency (element → element), with back-edges removed ──
  // Rework loops (e.g. a "Rejected"/"Rework" gateway branch pointing back to an
  // earlier task) are cycles. Longest-path layering on a cyclic graph inflates
  // the column count and blows the flow across the canvas. So we first drop
  // back-edges (edges to an ancestor on the DFS stack) and layer the resulting
  // DAG; the back-edges still render, they just don't drive the layout.
  const ids = new Set(elements.map(n => n.id))
  const rawOut = new Map<string, string[]>()
  elements.forEach(n => rawOut.set(n.id, []))
  for (const e of edges) {
    if (ids.has(e.source) && ids.has(e.target) && e.source !== e.target) {
      rawOut.get(e.source)!.push(e.target)
    }
  }
  const STATE = new Map<string, 0 | 1 | 2>() // 0 unseen, 1 on-stack, 2 done
  const backEdges = new Set<string>()
  const dfs = (root: string) => {
    const stack: { id: string; i: number }[] = [{ id: root, i: 0 }]
    STATE.set(root, 1)
    while (stack.length) {
      const top = stack[stack.length - 1]
      const kids = rawOut.get(top.id) || []
      if (top.i < kids.length) {
        const v = kids[top.i++]
        const st = STATE.get(v) ?? 0
        if (st === 1) backEdges.add(`${top.id}->${v}`)        // edge to ancestor → cycle
        else if (st === 0) { STATE.set(v, 1); stack.push({ id: v, i: 0 }) }
      } else { STATE.set(top.id, 2); stack.pop() }
    }
  }
  for (const n of elements) if ((STATE.get(n.id) ?? 0) === 0) dfs(n.id)

  const outE = new Map<string, string[]>()
  const inE = new Map<string, string[]>()
  elements.forEach(n => { outE.set(n.id, []); inE.set(n.id, []) })
  for (const [s, tgts] of rawOut) {
    for (const t of tgts) {
      if (backEdges.has(`${s}->${t}`)) continue
      outE.get(s)!.push(t)
      inE.get(t)!.push(s)
    }
  }

  // ── Longest-path layering (columns) on the DAG ──
  const layer = new Map<string, number>()
  const queue: string[] = []
  for (const n of elements) if (inE.get(n.id)!.length === 0) { layer.set(n.id, 0); queue.push(n.id) }
  if (queue.length === 0 && elements.length) { layer.set(elements[0].id, 0); queue.push(elements[0].id) }
  let head = 0
  let guard = 0
  const maxIter = elements.length * elements.length + elements.length + 10
  while (head < queue.length && guard++ < maxIter) {
    const nid = queue[head++]
    const ml = layer.get(nid)!
    for (const t of outE.get(nid) ?? []) {
      const prev = layer.get(t)
      if (prev === undefined || prev < ml + 1) { layer.set(t, ml + 1); queue.push(t) }
    }
  }
  for (const n of elements) if (!layer.has(n.id)) layer.set(n.id, 0)

  const maxLayer = Math.max(0, ...elements.map(n => layer.get(n.id)!))

  // ── Column widths (max element width per layer) + cumulative x ──
  const colW: number[] = new Array(maxLayer + 1).fill(0)
  for (const n of elements) {
    const l = layer.get(n.id)!
    colW[l] = Math.max(colW[l], sizeOf(n).w)
  }
  const colX: number[] = new Array(maxLayer + 1).fill(0)
  let cx = START_X
  for (let l = 0; l <= maxLayer; l++) { colX[l] = cx; cx += colW[l] + COL_GAP }
  const contentRight = cx - COL_GAP

  // ── Track assignment within each lane (keep chains straight, reduce crossings) ──
  // track[nodeId] = vertical slot within its lane band.
  const track = new Map<string, number>()
  const laneTracks: number[] = new Array(laneCount).fill(0)

  // Process in layer order; within a layer, order by barycenter of predecessors'
  // tracks so related elements line up and crossings drop.
  const byLayer: string[][] = Array.from({ length: maxLayer + 1 }, () => [])
  for (const n of elements) byLayer[layer.get(n.id)!].push(n.id)

  const nodeById = new Map(elements.map(n => [n.id, n]))
  for (let l = 0; l <= maxLayer; l++) {
    // barycenter sort using predecessor tracks (already assigned in earlier layers)
    byLayer[l].sort((a, b) => {
      const ba = baryc(a, inE, track)
      const bb = baryc(b, inE, track)
      if (ba !== bb) return ba - bb
      return 0
    })
    for (const nid of byLayer[l]) {
      const lane = laneOf(nodeById.get(nid)!)
      // desired track = a same-lane predecessor's track, else barycenter rounded
      let desired = 0
      const preds = inE.get(nid) ?? []
      const samePred = preds.find(p => laneOf(nodeById.get(p)!) === lane && track.has(p))
      if (samePred !== undefined) desired = track.get(samePred)!
      else {
        const bc = baryc(nid, inE, track)
        desired = Number.isFinite(bc) ? Math.max(0, Math.round(bc)) : 0
      }
      // find a free track >= desired in this (lane, layer) cell
      let tk = desired
      const used = new Set<number>()
      for (const other of byLayer[l]) {
        if (other === nid) continue
        if (laneOf(nodeById.get(other)!) === lane && track.has(other)) used.add(track.get(other)!)
      }
      while (used.has(tk)) tk++
      track.set(nid, tk)
      laneTracks[lane] = Math.max(laneTracks[lane], tk + 1)
    }
  }

  // ── Lane geometry (heights from track counts, stacked vertically) ──
  const rowH = (lane: number) => {
    // tallest element in this lane (so tracks don't collide), default activity height
    let h = 64
    for (const n of elements) if (laneOf(n) === lane) h = Math.max(h, sizeOf(n).h)
    return h + ROW_GAP
  }
  const laneHeights: number[] = new Array(laneCount).fill(LANE_MIN_H)
  const laneTops: number[] = new Array(laneCount).fill(0)
  for (let i = 0; i < laneCount; i++) {
    const tracks = Math.max(1, laneTracks[i])
    laneHeights[i] = Math.max(LANE_MIN_H, LANE_PAD_TOP + tracks * rowH(i) - ROW_GAP + LANE_PAD_BOTTOM)
  }
  let topAcc = 0
  for (let i = 0; i < laneCount; i++) { laneTops[i] = topAcc; topAcc += laneHeights[i] }
  const laneW = Math.max(LANE_MIN_W, contentRight + 60)

  // ── Emit positioned nodes ──
  const out: Node[] = []
  laneNodes.forEach((ln, i) => {
    out.push({
      ...ln,
      position: { x: 0, y: laneTops[i] },
      width: laneW,
      height: laneHeights[i],
      style: { ...(ln.style || {}), width: laneW, height: laneHeights[i] },
    })
  })
  for (const n of elements) {
    const l = layer.get(n.id)!
    const lane = laneOf(n)
    const tk = track.get(n.id) ?? 0
    const { w, h } = sizeOf(n)
    const rh = rowH(lane)
    const x = colX[l] + (colW[l] - w) / 2
    const y = laneTops[lane] + LANE_PAD_TOP + tk * rh + (rh - ROW_GAP - h) / 2
    out.push({ ...n, position: { x: Math.round(x), y: Math.round(y) } })
  }
  return out
}

function baryc(nid: string, inE: Map<string, string[]>, track: Map<string, number>): number {
  const preds = (inE.get(nid) ?? []).map(p => track.get(p)).filter((v): v is number => v !== undefined)
  if (preds.length === 0) return Number.POSITIVE_INFINITY
  return preds.reduce((a, b) => a + b, 0) / preds.length
}
