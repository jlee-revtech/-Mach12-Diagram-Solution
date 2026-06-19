'use client'

import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
  type Node,
} from '@xyflow/react'
import type { SequenceFlowData } from '@/lib/process/types'

// Next.js client-routing fix for url(#id) marker references.
function markerUrl(markerId: string) {
  if (typeof window === 'undefined') return `url(#${markerId})`
  const base = window.location.href.replace(/#.*$/, '')
  return `url(${base}#${markerId})`
}

export function SequenceFlowMarkerDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <marker id="seqflow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M1 1L8 5L1 9" fill="none" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>
    </svg>
  )
}

// ─── Floating attachment geometry ──────────────────────
// The connector attaches to the point on each task's perimeter that faces the
// other task, and picks the facing side so the path stays orthogonal (elbow).
// As tasks move, the attachment point slides along the shape automatically.
interface Rect { x: number; y: number; w: number; h: number; cx: number; cy: number }

function rectOf(node: InternalNode<Node>): Rect {
  const w = node.measured?.width ?? 120
  const h = node.measured?.height ?? 64
  const x = node.internals.positionAbsolute.x
  const y = node.internals.positionAbsolute.y
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }
}

function borderPoint(r: Rect, toward: { x: number; y: number }): { x: number; y: number; pos: Position } {
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

function SequenceFlowEdgeComponent({
  id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected,
}: EdgeProps & { data?: SequenceFlowData }) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  // Floating params when both nodes are available; otherwise fall back to the
  // handle-anchored coordinates React Flow provides (e.g. while connecting).
  let sx = sourceX, sy = sourceY, tx = targetX, ty = targetY
  let sPos = sourcePosition, tPos = targetPosition
  if (sourceNode && targetNode) {
    const sr = rectOf(sourceNode)
    const tr = rectOf(targetNode)
    const sp = borderPoint(sr, { x: tr.cx, y: tr.cy })
    const tp = borderPoint(tr, { x: sr.cx, y: sr.cy })
    sx = sp.x; sy = sp.y; sPos = sp.pos
    tx = tp.x; ty = tp.y; tPos = tp.pos
  }

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
    sourcePosition: sPos, targetPosition: tPos, borderRadius: 10,
  })

  const kind = data?.kind || 'sequence'
  const isDefault = kind === 'default'
  const isConditional = kind === 'conditional'
  const stroke = selected ? '#0EA5E9' : '#94A3B8'

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerUrl('seqflow-arrow')}
        interactionWidth={18}
        style={{
          stroke,
          strokeWidth: selected ? 2.2 : 1.4,
          strokeDasharray: isDefault ? '6 3' : undefined,
        }}
      />
      {isDefault && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${sx + (labelX - sx) * 0.18}px,${sy + (labelY - sy) * 0.18}px)`,
              pointerEvents: 'none',
            }}
            className="text-[12px] text-[#94A3B8] font-bold"
          >
            /
          </div>
        </EdgeLabelRenderer>
      )}
      {(data?.label || isConditional) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
            }}
            className="nodrag nopan px-1.5 py-0.5 rounded bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 text-[9px] text-[var(--m12-text-secondary)] max-w-[140px] truncate"
          >
            {isConditional && <span className="text-[#EAB308] mr-1">◇</span>}
            {data?.label || data?.condition || 'condition'}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(SequenceFlowEdgeComponent)
