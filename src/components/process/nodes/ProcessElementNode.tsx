'use client'

import { memo, useState, useCallback, useEffect } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import type { ProcessElementData, BpmnElementType } from '@/lib/process/types'

// One component handles every BPMN element type, switching shape by elementType.
// Tasks/sub-processes = rounded rects; events = circles; gateways = diamonds.

// Connectors float to the optimal point on the perimeter, so the bound handle
// id is irrelevant to rendering. Under ConnectionMode.Loose a single source
// handle per side acts as both source and target, so four large, easy-to-grab
// points let the user connect from/to any side of the shape.
const handleClass =
  '!border-2 !rounded-full !w-3.5 !h-3.5 !bg-[var(--m12-handle-bg)] !border-[#0EA5E9] hover:!bg-[#0EA5E9] hover:!w-4 hover:!h-4 transition-all duration-150 opacity-0 group-hover:opacity-100'

function FourSideHandles() {
  return (
    <>
      <Handle type="source" position={Position.Top} id="t" className={handleClass} />
      <Handle type="source" position={Position.Right} id="r" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="b" className={handleClass} />
      <Handle type="source" position={Position.Left} id="l" className={handleClass} />
    </>
  )
}

const EVENT_TYPES: BpmnElementType[] = ['startEvent', 'endEvent', 'intermediateEvent', 'boundaryEvent']
const GATEWAY_TYPES: BpmnElementType[] = ['exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway']

function gatewaySymbol(t: BpmnElementType): string {
  switch (t) {
    case 'exclusiveGateway': return '✕'
    case 'parallelGateway': return '＋'
    case 'inclusiveGateway': return '◯'
    case 'eventBasedGateway': return '◈'
    default: return ''
  }
}

function taskIcon(t: BpmnElementType) {
  // small glyph in the corner of an activity
  switch (t) {
    case 'userTask':
      return <path d="M7 6.2a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2zM3.5 11c0-2 1.6-3.2 3.5-3.2S10.5 9 10.5 11" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
    case 'serviceTask':
      return <path d="M7 4.6a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8zm0 1.4a1 1 0 110 2 1 1 0 010-2z" fill="currentColor" />
    case 'manualTask':
      return <path d="M3 7c1-1.4 2.4-2.2 4-2.2S10 5.6 11 7" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
    default:
      return null
  }
}

function ProcessElementNodeComponent({ id, data, selected }: NodeProps & { data: ProcessElementData }) {
  const { updateNodeData } = useReactFlow()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(data.label)
  useEffect(() => { setValue(data.label) }, [data.label])

  const isEvent = EVENT_TYPES.includes(data.elementType)
  const isGateway = GATEWAY_TYPES.includes(data.elementType)
  const isStart = data.elementType === 'startEvent'
  const isEnd = data.elementType === 'endEvent'

  const commit = useCallback(() => {
    const next = value.trim()
    if (next && next !== data.label) updateNodeData(id, { label: next })
    setEditing(false)
  }, [value, data.label, id, updateNodeData])

  const ring = selected ? '#0EA5E9' : 'var(--m12-border)'

  // ─── Events: circle ───
  if (isEvent) {
    const border = isStart ? '#10B981' : isEnd ? '#EF4444' : '#F59E0B'
    return (
      <div className="group relative" style={{ width: 56, height: 56 }}>
        <FourSideHandles />
        <div
          className="rounded-full flex items-center justify-center bg-[var(--m12-bg-card)]"
          style={{
            width: 56, height: 56,
            border: `${isEnd ? 3 : isStart ? 1.5 : 2}px solid ${border}`,
            boxShadow: selected ? `0 0 0 2px ${ring}55` : 'none',
            outline: data.elementType === 'intermediateEvent' ? `1.5px solid ${border}` : 'none',
            outlineOffset: '-5px',
          }}
        >
          <span className="text-[10px]" style={{ color: border }}>
            {isStart ? '▶' : isEnd ? '■' : '◷'}
          </span>
        </div>
        <NodeLabel value={data.label} below />
      </div>
    )
  }

  // ─── Gateways: diamond ───
  if (isGateway) {
    return (
      <div className="group relative" style={{ width: 52, height: 52 }}>
        <FourSideHandles />
        <div
          className="flex items-center justify-center bg-[var(--m12-bg-card)]"
          style={{
            width: 38, height: 38, margin: 7,
            transform: 'rotate(45deg)',
            border: `1.5px solid #EAB308`,
            borderRadius: 4,
            boxShadow: selected ? `0 0 0 2px ${ring}55` : 'none',
          }}
        >
          <span className="text-[14px] text-[#EAB308]" style={{ transform: 'rotate(-45deg)' }}>
            {gatewaySymbol(data.elementType)}
          </span>
        </div>
        <NodeLabel value={data.label} below />
      </div>
    )
  }

  // ─── Activities: rounded rect ───
  const isSub = data.elementType === 'subProcess'
  return (
    <div
      className="group relative bg-[var(--m12-bg-card)] flex items-center justify-center px-3"
      style={{
        width: 150, minHeight: 64,
        border: `1.5px solid ${selected ? '#0EA5E9' : 'var(--m12-border)'}`,
        borderRadius: 8,
        boxShadow: selected ? `0 0 0 2px ${ring}40` : 'none',
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <FourSideHandles />
      <div className="absolute top-1.5 left-1.5 text-[var(--m12-text-muted)]">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">{taskIcon(data.elementType)}</svg>
      </div>
      {isSub && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[var(--m12-text-muted)] text-[10px] leading-none border border-[var(--m12-border)] rounded-sm w-3 h-3 flex items-center justify-center">+</div>
      )}
      {editing ? (
        <input
          autoFocus
          aria-label="Element label"
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(data.label); setEditing(false) } }}
          className="w-full bg-transparent text-center text-[11px] text-[var(--m12-text)] outline-none border-b border-[#0EA5E9]"
        />
      ) : (
        <span className="text-[11px] font-medium text-[var(--m12-text)] text-center leading-tight">{data.label}</span>
      )}
    </div>
  )
}

function NodeLabel({ value, below }: { value: string; below?: boolean }) {
  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 ${below ? 'top-full mt-1' : ''} whitespace-nowrap text-[10px] text-[var(--m12-text-secondary)] text-center pointer-events-none`}
      style={{ maxWidth: 120 }}
    >
      {value}
    </div>
  )
}

export default memo(ProcessElementNodeComponent)
