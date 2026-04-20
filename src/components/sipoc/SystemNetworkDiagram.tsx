'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useSIPOCStore, type SystemEdge } from '@/lib/sipoc/store'
import type { LogicalSystem } from '@/lib/sipoc/types'
import { SYSTEM_TEMPLATES } from '@/lib/diagram/types'

// ─── Layered DAG layout (Sugiyama-style, simplified) ────
// Assign each system to a layer based on longest path from a pure source.
// Within a layer, sort to minimize edge crossings (greedy by in/out degree).
function computeLayout(
  systems: LogicalSystem[],
  edges: SystemEdge[],
  canvas: { width: number; height: number }
): Map<string, { x: number; y: number }> {
  const ids = systems.map(s => s.id)
  const idSet = new Set(ids)
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  ids.forEach(id => { outgoing.set(id, []); incoming.set(id, []) })
  edges.forEach(e => {
    if (idSet.has(e.from) && idSet.has(e.to)) {
      outgoing.get(e.from)!.push(e.to)
      incoming.get(e.to)!.push(e.from)
    }
  })

  // Compute layer by longest path from pure sources (using DFS with memoization)
  const layer = new Map<string, number>()
  const visiting = new Set<string>()
  const computeLayer = (id: string): number => {
    if (layer.has(id)) return layer.get(id)!
    if (visiting.has(id)) return 0 // cycle: break
    visiting.add(id)
    const parents = incoming.get(id) || []
    let max = 0
    if (parents.length === 0) {
      max = 0
    } else {
      for (const p of parents) {
        const pl = computeLayer(p)
        if (pl + 1 > max) max = pl + 1
      }
    }
    visiting.delete(id)
    layer.set(id, max)
    return max
  }
  ids.forEach(id => computeLayer(id))

  // Group by layer
  const layerGroups = new Map<number, string[]>()
  let maxLayer = 0
  layer.forEach((l, id) => {
    if (!layerGroups.has(l)) layerGroups.set(l, [])
    layerGroups.get(l)!.push(id)
    if (l > maxLayer) maxLayer = l
  })

  // Sort within each layer by connection count (descending) for aesthetics
  layerGroups.forEach(group => {
    group.sort((a, b) => {
      const da = (outgoing.get(a)!.length + incoming.get(a)!.length)
      const db = (outgoing.get(b)!.length + incoming.get(b)!.length)
      return db - da
    })
  })

  // Place nodes
  const positions = new Map<string, { x: number; y: number }>()
  const layerCount = maxLayer + 1
  const colGap = layerCount > 1 ? (canvas.width - 200) / (layerCount - 1) : 0
  const startX = 100

  layerGroups.forEach((group, l) => {
    const x = startX + l * colGap
    const rowGap = group.length > 1 ? Math.min(120, (canvas.height - 120) / (group.length - 1)) : 0
    const totalH = (group.length - 1) * rowGap
    const startY = canvas.height / 2 - totalH / 2
    group.forEach((id, i) => {
      positions.set(id, { x, y: startY + i * rowGap })
    })
  })

  return positions
}

// ─── Bezier curve helper ────────────────────────────────
function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1)
  const cpOffset = Math.max(60, dx * 0.4)
  return `M ${x1},${y1} C ${x1 + cpOffset},${y1} ${x2 - cpOffset},${y2} ${x2},${y2}`
}

// ─── Main component ─────────────────────────────────────
export default function SystemNetworkDiagram() {
  const caps = useSIPOCStore(s => s.capabilities)
  const inputs = useSIPOCStore(s => s.inputs)
  const outputs = useSIPOCStore(s => s.outputs)
  const network = useMemo(() => useSIPOCStore.getState().getSystemNetwork(), [caps, inputs, outputs])

  const canvasSize = { width: 1400, height: 900 }
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(
    () => computeLayout(network.systems, network.edges, canvasSize)
  )
  const [showIps, setShowIps] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [focusedSystem, setFocusedSystem] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const [filter, setFilter] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)

  // Re-layout if systems change
  useEffect(() => {
    setPositions(computeLayout(network.systems, network.edges, canvasSize))
  }, [network.systems.length, network.edges.length])

  const autoLayout = () => {
    setPositions(computeLayout(network.systems, network.edges, canvasSize))
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const nodeW = 170
  const nodeH = 54

  // Convert screen coords to SVG coords accounting for zoom + pan
  const screenToSvg = (sx: number, sy: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const x = (sx - rect.left - pan.x) / zoom
    const y = (sy - rect.top - pan.y) / zoom
    return { x, y }
  }

  const handleNodeMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const pos = positions.get(id)
    if (!pos) return
    setDraggingNode(id)
    setDragStart({ mouseX: e.clientX, mouseY: e.clientY, nodeX: pos.x, nodeY: pos.y })
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggingNode && dragStart) {
      const dx = (e.clientX - dragStart.mouseX) / zoom
      const dy = (e.clientY - dragStart.mouseY) / zoom
      setPositions(prev => {
        const next = new Map(prev)
        next.set(draggingNode, { x: dragStart.nodeX + dx, y: dragStart.nodeY + dy })
        return next
      })
    } else if (panning && panStart) {
      setPan({ x: panStart.panX + (e.clientX - panStart.x), y: panStart.panY + (e.clientY - panStart.y) })
    }
  }, [draggingNode, dragStart, panning, panStart, zoom])

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null)
    setDragStart(null)
    setPanning(false)
    setPanStart(null)
  }, [])

  useEffect(() => {
    if (draggingNode || panning) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [draggingNode, panning, handleMouseMove, handleMouseUp])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.001
    setZoom(z => Math.max(0.3, Math.min(2.5, z + delta)))
  }

  // Filtering / focusing
  const systemMatchesFilter = (s: LogicalSystem) => {
    if (!filter.trim()) return true
    const q = filter.toLowerCase()
    return s.name.toLowerCase().includes(q) ||
           (s.system_type || '').toLowerCase().includes(q)
  }

  const edgeIsVisible = (e: SystemEdge) => {
    if (focusedSystem) {
      return e.from === focusedSystem || e.to === focusedSystem
    }
    if (filter.trim()) {
      const fromSys = network.systems.find(s => s.id === e.from)
      const toSys = network.systems.find(s => s.id === e.to)
      return (fromSys && systemMatchesFilter(fromSys)) || (toSys && systemMatchesFilter(toSys))
    }
    return true
  }

  const systemIsVisible = (s: LogicalSystem) => {
    if (focusedSystem) {
      if (s.id === focusedSystem) return true
      // Check if system is connected to focused via any edge
      return network.edges.some(e =>
        (e.from === focusedSystem && e.to === s.id) ||
        (e.to === focusedSystem && e.from === s.id)
      )
    }
    return true
  }

  const maxTotalIps = Math.max(...network.edges.map(e => e.totalIps), 1)

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3 p-3 border-b border-[var(--m12-border)]/30 bg-[var(--m12-bg-card)]">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search systems..."
          className="bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-1.5 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60 w-56"
        />

        <div className="h-5 w-px bg-[var(--m12-border)]/40" />

        <button
          onClick={() => setShowIps(!showIps)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium font-[family-name:var(--font-space-mono)] uppercase tracking-wider border transition-colors ${
            showIps
              ? 'bg-[#2563EB]/10 border-[#2563EB]/40 text-[#93C5FD]'
              : 'border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:border-[var(--m12-border)] hover:text-[var(--m12-text-secondary)]'
          }`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1" />
            <path d="M3 4h4M3 6h2.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
          </svg>
          {showIps ? 'Hide' : 'Show'} Info Products
        </button>

        <div className="h-5 w-px bg-[var(--m12-border)]/40" />

        <button
          onClick={autoLayout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium font-[family-name:var(--font-space-mono)] uppercase tracking-wider border border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:border-[var(--m12-border)] hover:text-[var(--m12-text-secondary)] transition-colors"
          title="Re-run auto-layout"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1h3v3M6 1h3v3M1 6v3h3M9 6v3H6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          Auto-layout
        </button>

        {focusedSystem && (
          <button
            onClick={() => setFocusedSystem(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 transition-colors"
          >
            Clear Focus: {network.systems.find(s => s.id === focusedSystem)?.name}
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 2l4 4M6 2l-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          </button>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}
            className="w-7 h-7 rounded flex items-center justify-center text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)] transition-colors"
            title="Zoom out"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <span className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}
            className="w-7 h-7 rounded flex items-center justify-center text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)] transition-colors"
            title="Zoom in"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="shrink-0 px-3 py-1.5 border-b border-[var(--m12-border)]/20 bg-[var(--m12-bg)]/30 flex items-center gap-4 text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
        <span>{network.systems.length} SYSTEMS</span>
        <span>·</span>
        <span>{network.edges.length} CONNECTIONS</span>
        <span>·</span>
        <span>{network.edges.reduce((a, e) => a + e.l3s.length, 0)} L3 FLOWS</span>
        <div className="flex-1" />
        <span className="italic normal-case text-[9px]">Drag systems to reposition · Click to focus · Scroll to zoom · Drag canvas to pan</span>
      </div>

      {/* SVG canvas */}
      <div
        className="flex-1 overflow-hidden relative bg-[var(--m12-bg)]"
        onWheel={handleWheel}
        style={{ cursor: panning ? 'grabbing' : 'default' }}
      >
        {network.systems.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--m12-text-muted)] text-sm italic">
            No systems with SIPOC data yet. Add systems to your inputs/outputs to see the architecture.
          </div>
        ) : (
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            onMouseDown={handleCanvasMouseDown}
            style={{ cursor: panning ? 'grabbing' : 'grab', userSelect: 'none' }}
          >
            {/* Background grid */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--m12-border)" strokeWidth="0.3" opacity="0.3" />
              </pattern>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
              <marker id="arrow-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" opacity="0.3" />
              </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Content group — zoomed + panned */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Edges layer (below nodes) */}
              {network.edges.map((e, i) => {
                const from = positions.get(e.from)
                const to = positions.get(e.to)
                if (!from || !to) return null
                const fromSys = network.systems.find(s => s.id === e.from)
                const visible = edgeIsVisible(e)
                const emphasized = hoveredEdge === `${e.from}->${e.to}` || focusedSystem === e.from || focusedSystem === e.to
                const opacity = visible ? (emphasized ? 1 : 0.7) : 0.1
                const thickness = 1 + (e.totalIps / maxTotalIps) * 4
                const edgeColor = fromSys?.color || SYSTEM_TEMPLATES.find(t => t.type === fromSys?.system_type)?.color || '#64748B'

                const x1 = from.x + nodeW / 2
                const y1 = from.y
                const x2 = to.x - nodeW / 2
                const y2 = to.y
                const path = bezier(x1, y1, x2, y2)
                const midX = (x1 + x2) / 2
                const midY = (y1 + y2) / 2

                return (
                  <g key={`${e.from}->${e.to}-${i}`} opacity={opacity} style={{ pointerEvents: visible ? 'all' : 'none' }}>
                    <path
                      d={path}
                      stroke={edgeColor}
                      strokeWidth={emphasized ? thickness + 1 : thickness}
                      fill="none"
                      markerEnd={`url(#${emphasized ? 'arrow' : 'arrow-dim'})`}
                      style={{ color: edgeColor, cursor: 'pointer', transition: 'stroke-width 0.15s' }}
                      onMouseEnter={() => setHoveredEdge(`${e.from}->${e.to}`)}
                      onMouseLeave={() => setHoveredEdge(null)}
                    />
                    {/* Invisible thick hit-area for easier hover */}
                    <path
                      d={path}
                      stroke="transparent"
                      strokeWidth={16}
                      fill="none"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredEdge(`${e.from}->${e.to}`)}
                      onMouseLeave={() => setHoveredEdge(null)}
                    />
                    {/* Edge label */}
                    <EdgeLabel
                      edge={e}
                      x={midX}
                      y={midY}
                      showIps={showIps}
                      emphasized={emphasized}
                    />
                  </g>
                )
              })}

              {/* Nodes layer (above edges) */}
              {network.systems.map(s => {
                const pos = positions.get(s.id)
                if (!pos) return null
                const visible = systemIsVisible(s) && systemMatchesFilter(s)
                const tmpl = SYSTEM_TEMPLATES.find(t => t.type === s.system_type)
                const color = s.color || tmpl?.color || '#64748B'
                const isFocused = focusedSystem === s.id
                const opacity = visible ? 1 : 0.2
                const outgoingCount = network.edges.filter(e => e.from === s.id).length
                const incomingCount = network.edges.filter(e => e.to === s.id).length

                return (
                  <g
                    key={s.id}
                    transform={`translate(${pos.x - nodeW / 2}, ${pos.y - nodeH / 2})`}
                    opacity={opacity}
                    style={{ cursor: draggingNode === s.id ? 'grabbing' : 'pointer' }}
                    onMouseDown={(e) => handleNodeMouseDown(s.id, e)}
                    onClick={(e) => {
                      e.stopPropagation()
                      setFocusedSystem(prev => prev === s.id ? null : s.id)
                    }}
                  >
                    <rect
                      width={nodeW}
                      height={nodeH}
                      rx="8"
                      fill="var(--m12-bg-card)"
                      stroke={isFocused ? '#2563EB' : color}
                      strokeWidth={isFocused ? 2.5 : 1.5}
                    />
                    <rect width="4" height={nodeH} rx="2" fill={color} />
                    <text x="14" y="20" fontSize="12" fontWeight="600" fill="var(--m12-text)">
                      {s.name.length > 22 ? s.name.slice(0, 20) + '…' : s.name}
                    </text>
                    {tmpl && (
                      <text x="14" y="34" fontSize="8" fill="var(--m12-text-muted)" fontFamily="monospace">
                        {tmpl.label.toUpperCase()}
                      </text>
                    )}
                    <text x="14" y="47" fontSize="8" fill="var(--m12-text-faint)" fontFamily="monospace">
                      ↓{incomingCount}  ↑{outgoingCount}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>
        )}
      </div>
    </div>
  )
}

// ─── Edge label: L3s and optionally IPs ─────────────────
function EdgeLabel({ edge, x, y, showIps, emphasized }: {
  edge: SystemEdge
  x: number
  y: number
  showIps: boolean
  emphasized: boolean
}) {
  const l3s = edge.l3s
  const maxShow = emphasized ? l3s.length : Math.min(l3s.length, 3)
  const shown = l3s.slice(0, maxShow)
  const hidden = l3s.length - maxShow

  // Approx label height
  let lineCount = shown.length
  if (showIps) {
    shown.forEach(l => { lineCount += Math.min(l.ips.length, emphasized ? l.ips.length : 2) })
  }
  if (hidden > 0) lineCount += 1

  const labelW = showIps ? 200 : 160
  const lineH = 13
  const padding = 6
  const labelH = lineCount * lineH + padding * 2

  return (
    <g transform={`translate(${x - labelW / 2}, ${y - labelH / 2})`} style={{ pointerEvents: 'none' }}>
      <rect
        width={labelW}
        height={labelH}
        rx="4"
        fill="var(--m12-bg-card)"
        stroke="var(--m12-border)"
        strokeWidth="0.5"
        opacity={emphasized ? 0.98 : 0.9}
      />
      {(() => {
        let yOff = padding + 9
        const nodes: React.ReactNode[] = []
        shown.forEach((l3, i) => {
          nodes.push(
            <text key={`cap-${i}`} x={padding} y={yOff} fontSize="9" fontWeight="600" fill="var(--m12-text)">
              {l3.capability.name.length > 28 ? l3.capability.name.slice(0, 26) + '…' : l3.capability.name}
            </text>
          )
          yOff += lineH
          if (showIps) {
            const ipsShown = l3.ips.slice(0, emphasized ? l3.ips.length : 2)
            ipsShown.forEach((ip, j) => {
              nodes.push(
                <text key={`ip-${i}-${j}`} x={padding + 8} y={yOff} fontSize="8" fill="var(--m12-text-muted)">
                  • {ip.name.length > 28 ? ip.name.slice(0, 26) + '…' : ip.name}
                </text>
              )
              yOff += lineH
            })
            if (!emphasized && l3.ips.length > 2) {
              nodes.push(
                <text key={`ipmore-${i}`} x={padding + 8} y={yOff} fontSize="8" fill="var(--m12-text-faint)" fontStyle="italic">
                  +{l3.ips.length - 2} more
                </text>
              )
              yOff += lineH
            }
          }
        })
        if (hidden > 0) {
          nodes.push(
            <text key="more" x={padding} y={yOff} fontSize="8" fill="var(--m12-text-faint)" fontStyle="italic">
              +{hidden} more L3{hidden === 1 ? '' : 's'} (hover edge to expand)
            </text>
          )
        }
        return nodes
      })()}
    </g>
  )
}
