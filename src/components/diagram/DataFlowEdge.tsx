'use client'

import { memo, useCallback, useMemo, useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  MarkerType,
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
// Use full page URL as base so the browser resolves the fragment correctly.
function markerUrl(markerId: string) {
  if (typeof window === 'undefined') return `url(#${markerId})`
  const base = window.location.href.replace(/#.*$/, '')
  return `url(${base}#${markerId})`
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
  const spotlightNodeId = useDiagramStore((s) => s.spotlightNodeId)
  const spotlightEdgeIds = useDiagramStore((s) => s.spotlightEdgeIds)

  const isSpotlit = spotlightNodeId !== null && spotlightEdgeIds.has(id)
  const isDimmed = spotlightNodeId !== null && !spotlightEdgeIds.has(id)

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  })

  const handleClick = useCallback(() => {
    setSelectedEdge(id)
    setSidebarTab('elements')
  }, [id, setSelectedEdge, setSidebarTab])

  const dataElements = data?.dataElements ?? []
  const isBidirectional = data?.direction === 'bidirectional'
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
          stroke: highlight ? '#06B6D4' : '#64748B',
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

      {/* Data element labels */}
      {dataElements.length > 0 && (
        <EdgeLabelRenderer>
          <div
            onClick={handleClick}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              opacity: isDimmed ? 0.1 : 1,
              transition: 'opacity 0.3s',
            }}
            className="cursor-pointer"
          >
            <div
              className={`bg-[#1F2C3F] border rounded-lg px-3 py-2 shadow-lg transition-all ${
                highlight
                  ? 'border-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'border-[#374A5E]/60 hover:border-[#374A5E]'
              }`}
            >
              <div className="flex flex-col gap-1">
                {visibleElements.map((el) => (
                  <div key={el.id}>
                    <div className="flex items-center gap-1.5">
                      <div
                        style={{
                          backgroundColor:
                            ELEMENT_TYPE_COLORS[el.elementType] ?? '#64748B',
                        }}
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                      />
                      <span className="text-[11px] font-medium text-[#CBD5E1] whitespace-nowrap">
                        {el.name}
                      </span>
                      {el.processContext && (
                        <span className="text-[8px] text-[#64748B] bg-[#151E2E] px-1 py-0.5 rounded whitespace-nowrap">
                          {el.processContext}
                        </span>
                      )}
                    </div>
                    {el.elementType === 'data_object' && el.attributes && el.attributes.length > 0 && (
                      <div className="ml-3 pl-2 border-l border-[#374A5E]/50 mt-0.5 flex flex-col gap-0.5">
                        {el.attributes.map((attr) => (
                          <span key={attr.id} className="text-[10px] text-[#64748B] whitespace-nowrap">
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
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              opacity: isDimmed ? 0.1 : 1,
              transition: 'opacity 0.3s',
            }}
            className="cursor-pointer"
          >
            <div
              className={`bg-[#1F2C3F]/80 border border-dashed rounded-md px-2 py-1 transition-all ${
                selected ? 'border-[#06B6D4]' : 'border-[#374A5E] hover:border-[#64748B]'
              }`}
            >
              <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-space-mono)]">
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
        <marker
          id="marker-default"
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 2 2 L 10 6 L 2 10 z" fill="#64748B" />
        </marker>
        <marker
          id="marker-selected"
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 2 2 L 10 6 L 2 10 z" fill="#06B6D4" />
        </marker>
        <marker
          id="marker-start-default"
          viewBox="0 0 12 12"
          refX="2"
          refY="6"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 10 2 L 2 6 L 10 10 z" fill="#64748B" />
        </marker>
        <marker
          id="marker-start-selected"
          viewBox="0 0 12 12"
          refX="2"
          refY="6"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 10 2 L 2 6 L 10 10 z" fill="#06B6D4" />
        </marker>
      </defs>
    </svg>
  )
}
