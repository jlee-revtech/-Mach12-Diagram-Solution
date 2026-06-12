'use client'

import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
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

function SequenceFlowEdgeComponent({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps & { data?: SequenceFlowData }) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 8,
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
        style={{
          stroke,
          strokeWidth: selected ? 2 : 1.4,
          strokeDasharray: isDefault ? '6 3' : undefined,
        }}
      />
      {/* Default-flow slash marker near the source */}
      {isDefault && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${sourceX + (labelX - sourceX) * 0.18}px,${sourceY + (labelY - sourceY) * 0.18}px)`,
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
