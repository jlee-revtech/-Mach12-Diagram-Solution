'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  MarkerType,
  useReactFlow,
} from '@xyflow/react'
import type { DataFlowData } from '@/lib/diagram/types'
import { useDiagramStore } from '@/lib/diagram/store'

const ELEMENT_TYPE_COLORS: Record<string, string> = {
  transaction: '#2563EB',
  master_data: '#06B6D4',
  document: '#F97316',
  event: '#10B981',
  data_object: '#EAB308',
  custom: '#A855F7',
}

// Fix for Next.js: url(#id) breaks with client-side routing.
function markerUrl(markerId: string) {
  if (typeof window === 'undefined') return `url(#${markerId})`
  const base = window.location.href.replace(/#.*$/, '')
  return `url(${base}#${markerId})`
}

// ─── Path position helpers ──────────────────────────────
let _reusablePath: SVGPathElement | null = null
function getReusablePath(d: string): SVGPathElement {
  if (!_reusablePath) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none'
    _reusablePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    svg.appendChild(_reusablePath)
    document.body.appendChild(svg)
  }
  _reusablePath.setAttribute('d', d)
  return _reusablePath
}

function getPointAtRatio(d: string, ratio: number): { x: number; y: number } {
  const path = getReusablePath(d)
  const pt = path.getPointAtLength(ratio * path.getTotalLength())
  return { x: pt.x, y: pt.y }
}

function closestRatioOnPath(d: string, px: number, py: number): number {
  const path = getReusablePath(d)
  const totalLen = path.getTotalLength()
  let bestDist = Infinity
  let bestRatio = 0.5
  const COARSE = 40
  for (let i = 0; i <= COARSE; i++) {
    const r = i / COARSE
    const pt = path.getPointAtLength(r * totalLen)
    const dist = (pt.x - px) ** 2 + (pt.y - py) ** 2
    if (dist < bestDist) { bestDist = dist; bestRatio = r }
  }
  const step = 1 / COARSE
  const lo = Math.max(0, bestRatio - step)
  const hi = Math.min(1, bestRatio + step)
  const FINE = 30
  for (let i = 0; i <= FINE; i++) {
    const r = lo + (hi - lo) * (i / FINE)
    const pt = path.getPointAtLength(r * totalLen)
    const dist = (pt.x - px) ** 2 + (pt.y - py) ** 2
    if (dist < bestDist) { bestDist = dist; bestRatio = r }
  }
  return bestRatio
}

function DataFlowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps & { data?: DataFlowData }) {
  const setSelectedEdge = useDiagramStore((s) => s.setSelectedEdge)
  const setSidebarTab = useDiagramStore((s) => s.setSidebarTab)
  const updateEdgeLabelPosition = useDiagramStore((s) => s.updateEdgeLabelPosition)
  const spotlightNodeId = useDiagramStore((s) => s.spotlightNodeId)
  const spotlightEdgeIds = useDiagramStore((s) => s.spotlightEdgeIds)
  const spotlightArtifactId = useDiagramStore((s) => s.spotlightArtifactId)
  const { screenToFlowPosition } = useReactFlow()

  const isSpotlit = spotlightNodeId !== null && spotlightEdgeIds.has(id)
  const isDimmed = spotlightNodeId !== null && !spotlightEdgeIds.has(id)

  const [edgePath, defaultLabelX, defaultLabelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  })

  const labelRatio = data?.labelPosition ?? 0.5
  const labelPos = useMemo(() => {
    if (typeof document === 'undefined') return { x: defaultLabelX, y: defaultLabelY }
    if (labelRatio === 0.5) return { x: defaultLabelX, y: defaultLabelY }
    return getPointAtRatio(edgePath, labelRatio)
  }, [edgePath, labelRatio, defaultLabelX, defaultLabelY])

  const [dragging, setDragging] = useState(false)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef(false)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!selected) return
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = true
    setDragging(true)

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return
      const flowPos = screenToFlowPosition({ x: me.clientX, y: me.clientY })
      setDragPos(flowPos)
    }
    const onUp = (me: MouseEvent) => {
      dragRef.current = false
      setDragging(false)
      setDragPos(null)
      const flowPos = screenToFlowPosition({ x: me.clientX, y: me.clientY })
      const ratio = closestRatioOnPath(edgePath, flowPos.x, flowPos.y)
      updateEdgeLabelPosition(id, ratio)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [selected, id, edgePath, screenToFlowPosition, updateEdgeLabelPosition])

  const liveLabelPos = useMemo(() => {
    if (!dragging || !dragPos || typeof document === 'undefined') return null
    const ratio = closestRatioOnPath(edgePath, dragPos.x, dragPos.y)
    return getPointAtRatio(edgePath, ratio)
  }, [dragging, dragPos, edgePath])

  const displayX = liveLabelPos?.x ?? labelPos.x
  const displayY = liveLabelPos?.y ?? labelPos.y

  const handleClick = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedEdge(id)
    setSidebarTab('elements')
  }, [id, setSelectedEdge, setSidebarTab])

  const dataElements = data?.dataElements ?? []
  const isBidirectional = data?.direction === 'bidirectional'
  const displaySequence = spotlightArtifactId && data?.artifactSequences?.[spotlightArtifactId]
    ? data.artifactSequences[spotlightArtifactId]
    : data?.sequence ?? null
  const [expanded, setExpanded] = useState(false)
  const VISIBLE_LIMIT = 10
  const hasOverflow = dataElements.length > VISIBLE_LIMIT
  const visibleElements = expanded ? dataElements : dataElements.slice(0, VISIBLE_LIMIT)
  const hiddenCount = dataElements.length - VISIBLE_LIMIT

  const highlight = selected || isSpotlit
  const endMarker = useMemo(
    () => markerUrl(`marker-${highlight ? 'selected' : 'default'}`),
    [highlight]
  )
  const startMarker = useMemo(
    () =>
      isBidirectional
        ? markerUrl(`marker-start-${highlight ? 'selected' : 'default'}`)
        : undefined,
    [isBidirectional, highlight]
  )

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: highlight ? '#06B6D4' : 'var(--m12-edge-default)',
          strokeWidth: highlight ? 2.5 : 2,
          opacity: isDimmed ? 0.1 : 1,
          cursor: 'pointer',
          transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.3s',
        }}
        markerEnd={endMarker}
        markerStart={startMarker}
        interactionWidth={20}
      />

      {/* Invisible wider hit area for click */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      />

      {/* Sequence badge */}
      {displaySequence != null && (
        <EdgeLabelRenderer>
          <div
            onClick={handleClick}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${
                typeof document !== 'undefined'
                  ? getPointAtRatio(edgePath, 0.12).x
                  : sourceX
              }px,${
                typeof document !== 'undefined'
                  ? getPointAtRatio(edgePath, 0.12).y
                  : sourceY
              }px)`,
              pointerEvents: 'all',
              opacity: isDimmed ? 0.1 : 1,
              transition: 'opacity 0.3s',
            }}
            className="cursor-pointer"
          >
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold font-[family-name:var(--font-space-mono)] shadow-md transition-all ${
                highlight
                  ? 'bg-[#06B6D4] text-[#0F172A] shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                  : 'bg-[var(--m12-border)] text-[var(--m12-text)]'
              }`}
            >
              {displaySequence}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Data element labels */}
      {dataElements.length > 0 && (
        <EdgeLabelRenderer>
          <div
            onClick={handleClick}
            onMouseDown={handleDragStart}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${displayX}px,${displayY}px)`,
              pointerEvents: 'all',
              opacity: isDimmed ? 0.1 : dragging ? 0.85 : 1,
              transition: dragging ? 'none' : 'opacity 0.3s',
              cursor: selected ? (dragging ? 'grabbing' : 'grab') : 'pointer',
            }}
            className={selected ? 'nopan' : ''}
          >
            <div
              style={{ backgroundColor: 'var(--m12-edge-label-bg)' }}
              className={`backdrop-blur-sm border-l-2 border rounded-lg px-3 py-2 shadow-lg transition-all ${
                dragging
                  ? 'border-[#06B6D4] border-l-[#06B6D4] shadow-[0_0_16px_rgba(6,182,212,0.3)] scale-[1.02]'
                  : highlight
                    ? 'border-[#06B6D4]/60 border-l-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                    : 'border-[var(--m12-border)]/40 border-l-[var(--m12-text-muted)] hover:border-[var(--m12-border)]/60'
              }`}
            >
              {/* Drag indicator when selected */}
              {selected && !dragging && (
                <div className="flex justify-center mb-1 -mt-0.5">
                  <div className="flex gap-0.5">
                    <div className="w-1 h-1 rounded-full bg-[#06B6D4]/40" />
                    <div className="w-1 h-1 rounded-full bg-[#06B6D4]/40" />
                    <div className="w-1 h-1 rounded-full bg-[#06B6D4]/40" />
                  </div>
                </div>
              )}
              {/* Condition badge */}
              {data?.condition && (
                <div className="flex items-center gap-1 mb-1.5 -mx-0.5">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-[#EAB308] bg-[#EAB308]/10 border border-[#EAB308]/30 px-1.5 py-0.5 rounded font-[family-name:var(--font-space-mono)]">IF</span>
                  <span className="text-[9px] text-[#EAB308]/90 font-medium italic">{data.condition}</span>
                </div>
              )}
              <div className="flex flex-col gap-1">
                {visibleElements.map((el) => (
                  <div key={el.id}>
                    <div className="flex items-center gap-1.5">
                      <div
                        style={{
                          backgroundColor:
                            ELEMENT_TYPE_COLORS[el.elementType] ?? 'var(--m12-text-muted)',
                        }}
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                      />
                      <span className="text-[11px] font-medium text-[var(--m12-text-secondary)] whitespace-nowrap">
                        {el.name}
                      </span>
                      {el.processContext && (
                        <span className="text-[8px] text-[var(--m12-text-muted)] bg-[var(--m12-bg)] px-1 py-0.5 rounded whitespace-nowrap">
                          {el.processContext}
                        </span>
                      )}
                    </div>
                    {el.elementType === 'data_object' && el.attributes && el.attributes.length > 0 && (
                      <div className="ml-3 pl-2 border-l border-[var(--m12-border)]/50 mt-0.5 flex flex-col gap-0.5">
                        {el.attributes.map((attr) => (
                          <span key={attr.id} className="text-[10px] text-[var(--m12-text-muted)] whitespace-nowrap">
                            {attr.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {hasOverflow && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
                    className="flex items-center gap-1 mt-0.5 text-[10px] text-[#06B6D4] hover:text-[#67E8F9] transition-colors font-[family-name:var(--font-space-mono)]"
                  >
                    <svg
                      width="10" height="10" viewBox="0 0 10 10" fill="none"
                      className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                    >
                      <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {expanded ? 'Show less' : `+${hiddenCount} more`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Empty edge click hint */}
      {dataElements.length === 0 && (
        <EdgeLabelRenderer>
          <div
            onClick={handleClick}
            onMouseDown={handleDragStart}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${displayX}px,${displayY}px)`,
              pointerEvents: 'all',
              opacity: isDimmed ? 0.1 : 1,
              transition: dragging ? 'none' : 'opacity 0.3s',
              cursor: selected ? (dragging ? 'grabbing' : 'grab') : 'pointer',
              backgroundColor: 'var(--m12-edge-label-bg)',
            }}
            className={`rounded-md ${selected ? 'nopan' : ''}`}
          >
            <div
              className={`border border-dashed rounded-md px-2 py-1 transition-all ${
                dragging
                  ? 'border-[#06B6D4]'
                  : selected ? 'border-[#06B6D4]' : 'border-[var(--m12-border)] hover:border-[var(--m12-text-muted)]'
              }`}
            >
              <span className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
                + data elements
              </span>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(DataFlowEdgeComponent)

// ─── Custom SVG Markers ────────────────────────────────
export function EdgeMarkerDefs() {
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        <marker id="marker-default" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 2 2 L 10 6 L 2 10 z" fill="var(--m12-marker-default)" />
        </marker>
        <marker id="marker-selected" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 2 2 L 10 6 L 2 10 z" fill="#06B6D4" />
        </marker>
        <marker id="marker-start-default" viewBox="0 0 12 12" refX="2" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 10 2 L 2 6 L 10 10 z" fill="var(--m12-marker-default)" />
        </marker>
        <marker id="marker-start-selected" viewBox="0 0 12 12" refX="2" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 10 2 L 2 6 L 10 10 z" fill="#06B6D4" />
        </marker>
      </defs>
    </svg>
  )
}
