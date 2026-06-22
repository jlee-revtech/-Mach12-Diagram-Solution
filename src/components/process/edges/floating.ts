import { Position, type InternalNode, type Node } from '@xyflow/react'

// Shared floating-attachment geometry, used by both the sequence-flow edge
// (for rendering) and the crossing-overlay (for detecting connector overlaps).
// A connector attaches to the point on each task's perimeter facing the other
// task, and picks the facing side so the path stays orthogonal (elbow).

export interface Rect { x: number; y: number; w: number; h: number; cx: number; cy: number }

export function rectOf(node: InternalNode<Node>): Rect {
  const w = node.measured?.width ?? 120
  const h = node.measured?.height ?? 64
  const x = node.internals.positionAbsolute.x
  const y = node.internals.positionAbsolute.y
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }
}

export function borderPoint(r: Rect, toward: { x: number; y: number }): { x: number; y: number; pos: Position } {
  const dx = toward.x - r.cx
  const dy = toward.y - r.cy
  if (dx === 0 && dy === 0) return { x: r.cx, y: r.y, pos: Position.Top }
  const w2 = r.w / 2
  const h2 = r.h / 2
  const scale = 1 / Math.max(Math.abs(dx) / w2, Math.abs(dy) / h2)
  const x = r.cx + dx * scale
  const y = r.cy + dy * scale
  const eps = 0.5
  let pos: Position
  if (Math.abs(x - r.x) <= eps) pos = Position.Left
  else if (Math.abs(x - (r.x + r.w)) <= eps) pos = Position.Right
  else if (Math.abs(y - r.y) <= eps) pos = Position.Top
  else pos = Position.Bottom
  return { x, y, pos }
}

export interface FloatingParams { sx: number; sy: number; sPos: Position; tx: number; ty: number; tPos: Position }

export function getFloatingParams(source: InternalNode<Node>, target: InternalNode<Node>): FloatingParams {
  const sr = rectOf(source)
  const tr = rectOf(target)
  const sp = borderPoint(sr, { x: tr.cx, y: tr.cy })
  const tp = borderPoint(tr, { x: sr.cx, y: sr.cy })
  return { sx: sp.x, sy: sp.y, sPos: sp.pos, tx: tp.x, ty: tp.y, tPos: tp.pos }
}

// ─── Facing-side anchors (bind to a real handle) ───────
// We anchor each connector to the midpoint of the side facing the other node.
// That side maps to a real handle id (t/r/b/l), so React Flow draws the edge,
// places its reconnect handles, AND keeps the endpoint exactly on the box.
export type Side = 't' | 'r' | 'b' | 'l'

export function facingSide(from: Rect, toward: { x: number; y: number }): Side {
  const dx = toward.x - from.cx
  const dy = toward.y - from.cy
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'r' : 'l'
  return dy >= 0 ? 'b' : 't'
}

function sideAnchor(r: Rect, side: Side): { x: number; y: number; pos: Position } {
  switch (side) {
    case 'r': return { x: r.x + r.w, y: r.cy, pos: Position.Right }
    case 'l': return { x: r.x, y: r.cy, pos: Position.Left }
    case 't': return { x: r.cx, y: r.y, pos: Position.Top }
    case 'b': return { x: r.cx, y: r.y + r.h, pos: Position.Bottom }
  }
}

export function getAnchorParams(source: InternalNode<Node>, target: InternalNode<Node>): FloatingParams {
  const sr = rectOf(source)
  const tr = rectOf(target)
  const sp = sideAnchor(sr, facingSide(sr, { x: tr.cx, y: tr.cy }))
  const tp = sideAnchor(tr, facingSide(tr, { x: sr.cx, y: sr.cy }))
  return { sx: sp.x, sy: sp.y, sPos: sp.pos, tx: tp.x, ty: tp.y, tPos: tp.pos }
}

// Handle ids each end should bind to, given current node geometry.
export function anchorHandles(source: InternalNode<Node>, target: InternalNode<Node>): { sourceHandle: Side; targetHandle: Side } {
  const sr = rectOf(source)
  const tr = rectOf(target)
  return {
    sourceHandle: facingSide(sr, { x: tr.cx, y: tr.cy }),
    targetHandle: facingSide(tr, { x: sr.cx, y: sr.cy }),
  }
}
