'use client'

import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'

// Swimlane = a non-interactive, full-width horizontal band rendered behind the
// BPMN elements. Same approach as the diagram's SystemGroupNode: pointer-events
// are disabled on the lane body (re-enabled only on the label gutter), so clicks
// pass through to elements and edges. Lane geometry/label live in graph_data;
// the label gutter selects the lane for system binding in the inspector.
export interface LaneNodeData extends Record<string, unknown> {
  label: string
  laneColor?: string
  systemLabel?: string | null
}

function LaneNodeComponent({ data, selected }: NodeProps & { data: LaneNodeData }) {
  const color = data.laneColor || 'var(--m12-border)'
  return (
    <div
      className="relative h-full w-full"
      style={{
        borderTop: `1px solid ${color}40`,
        borderBottom: `1px solid ${color}40`,
        background: selected ? `${color}0C` : `${color}06`,
        pointerEvents: 'none',
      }}
    >
      {/* Left gutter: vertical label band — the only interactive part */}
      <div
        data-lane-gutter="true"
        className="absolute left-0 top-0 bottom-0 w-9 flex items-center justify-center cursor-pointer"
        style={{ background: `${color}1A`, borderRight: `1px solid ${color}40`, pointerEvents: 'auto' }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--m12-text-secondary)] font-[family-name:var(--font-space-mono)] whitespace-nowrap"
          style={{ transform: 'rotate(180deg)', writingMode: 'vertical-rl' }}
        >
          {data.label}
          {data.systemLabel ? ` · ${data.systemLabel}` : ''}
        </span>
      </div>
    </div>
  )
}

export default memo(LaneNodeComponent)
