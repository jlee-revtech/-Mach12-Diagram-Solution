'use client'

import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useInternalNode,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react'
import type { SequenceFlowData } from '@/lib/process/types'
import { getAnchorParams } from './floating'

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

function SequenceFlowEdgeComponent({
  id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected,
}: EdgeProps & { data?: SequenceFlowData }) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  const { deleteElements } = useReactFlow()

  // Floating params when both nodes are available; otherwise fall back to the
  // handle-anchored coordinates React Flow provides (e.g. while connecting).
  let sx = sourceX, sy = sourceY, tx = targetX, ty = targetY
  let sPos = sourcePosition, tPos = targetPosition
  if (sourceNode && targetNode) {
    const p = getAnchorParams(sourceNode, targetNode)
    sx = p.sx; sy = p.sy; sPos = p.sPos
    tx = p.tx; ty = p.ty; tPos = p.tPos
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
      {/* Delete control on a selected connector */}
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteElements({ edges: [{ id }] }) }}
            title="Delete connector"
            className="nodrag nopan flex items-center justify-center"
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY - 14}px)`,
              width: 18, height: 18, borderRadius: '50%',
              background: 'var(--m12-bg-card)', border: '1.5px solid #EF4444', color: '#EF4444',
              fontSize: 12, lineHeight: 1, cursor: 'pointer', pointerEvents: 'all', zIndex: 10,
            }}
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
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
