'use client'

import { useMemo, useState, useEffect } from 'react'
import { useSIPOCStore, type SystemEdge } from '@/lib/sipoc/store'
import type { LogicalSystem } from '@/lib/sipoc/types'
import { SYSTEM_TEMPLATES } from '@/lib/diagram/types'

type SortMode = 'volume' | 'name' | 'type'

function getSystemColor(s: LogicalSystem): string {
  const tmpl = SYSTEM_TEMPLATES.find(t => t.type === s.system_type)
  return s.color || tmpl?.color || '#64748B'
}

function getSystemTypeLabel(s: LogicalSystem): string {
  const tmpl = SYSTEM_TEMPLATES.find(t => t.type === s.system_type)
  return tmpl?.label || 'OTHER'
}

// ─── Arc layout: arrange nodes along a semicircle ───────
function arcPositions(count: number, side: 'left' | 'right', centerX: number, centerY: number, radius: number) {
  if (count === 0) return []
  const angleSpread = Math.min(Math.PI * 0.85, Math.PI * 0.25 + count * 0.08)
  const startAngle = side === 'left' ? Math.PI - angleSpread / 2 : -angleSpread / 2
  const step = count === 1 ? 0 : angleSpread / (count - 1)
  return Array.from({ length: count }, (_, i) => {
    const a = startAngle + i * step
    return {
      x: centerX + Math.cos(a) * radius,
      y: centerY + Math.sin(a) * radius,
      angle: a,
    }
  })
}

// ─── Bezier curve ───────────────────────────────────────
function bezierTo(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1)
  const cp = Math.max(40, dx * 0.45)
  return `M ${x1},${y1} C ${x1 + (x2 > x1 ? cp : -cp)},${y1} ${x2 - (x2 > x1 ? cp : -cp)},${y2} ${x2},${y2}`
}

// ─── Main component ─────────────────────────────────────
export default function NeighborhoodView() {
  const caps = useSIPOCStore(s => s.capabilities)
  const inputs = useSIPOCStore(s => s.inputs)
  const outputs = useSIPOCStore(s => s.outputs)
  const network = useMemo(() => useSIPOCStore.getState().getSystemNetwork(), [caps, inputs, outputs])

  // Compute connection count per system
  const connectionCounts = useMemo(() => {
    const counts = new Map<string, { inCount: number; outCount: number; total: number }>()
    network.systems.forEach(s => counts.set(s.id, { inCount: 0, outCount: 0, total: 0 }))
    network.edges.forEach(e => {
      const from = counts.get(e.from); if (from) { from.outCount++; from.total++ }
      const to = counts.get(e.to); if (to) { to.inCount++; to.total++ }
    })
    return counts
  }, [network])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('volume')
  const [showIps, setShowIps] = useState(false)
  const [filter, setFilter] = useState('')
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)

  // Default selection: most-connected system
  useEffect(() => {
    if (!selectedId && network.systems.length > 0) {
      const top = [...network.systems].sort((a, b) => (connectionCounts.get(b.id)?.total || 0) - (connectionCounts.get(a.id)?.total || 0))[0]
      setSelectedId(top.id)
    }
  }, [network.systems, connectionCounts, selectedId])

  // Sorted sidebar list
  const sortedSystems = useMemo(() => {
    let list = [...network.systems]
    if (filter.trim()) {
      const q = filter.toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(q) || getSystemTypeLabel(s).toLowerCase().includes(q))
    }
    if (sortMode === 'volume') {
      list.sort((a, b) => (connectionCounts.get(b.id)?.total || 0) - (connectionCounts.get(a.id)?.total || 0))
    } else if (sortMode === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      list.sort((a, b) => {
        const ta = getSystemTypeLabel(a), tb = getSystemTypeLabel(b)
        return ta.localeCompare(tb) || a.name.localeCompare(b.name)
      })
    }
    return list
  }, [network.systems, sortMode, filter, connectionCounts])

  const selected = network.systems.find(s => s.id === selectedId) || null

  // Compute neighborhood for selected system
  const neighborhood = useMemo(() => {
    if (!selected) return { upstream: [], downstream: [] }
    const upstream = new Map<string, SystemEdge>()
    const downstream = new Map<string, SystemEdge>()
    network.edges.forEach(e => {
      if (e.to === selected.id) upstream.set(e.from, e)
      if (e.from === selected.id) downstream.set(e.to, e)
    })
    return {
      upstream: [...upstream.values()].map(e => ({ edge: e, system: network.systems.find(s => s.id === e.from)! })).filter(x => x.system),
      downstream: [...downstream.values()].map(e => ({ edge: e, system: network.systems.find(s => s.id === e.to)! })).filter(x => x.system),
    }
  }, [selected, network])

  // Canvas layout
  const centerX = 600
  const centerY = 450
  const nodeW = 170
  const nodeH = 56
  const radius = Math.max(260, Math.max(neighborhood.upstream.length, neighborhood.downstream.length) * 30)

  const upstreamPos = useMemo(() =>
    arcPositions(neighborhood.upstream.length, 'left', centerX, centerY, radius),
    [neighborhood.upstream.length, radius]
  )
  const downstreamPos = useMemo(() =>
    arcPositions(neighborhood.downstream.length, 'right', centerX, centerY, radius),
    [neighborhood.downstream.length, radius]
  )

  const canvasWidth = centerX * 2
  const canvasHeight = Math.max(900, radius * 2 + 160)

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 border-r border-[var(--m12-border)]/30 bg-[var(--m12-bg-card)] flex flex-col">
        <div className="p-3 border-b border-[var(--m12-border)]/20 space-y-2">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search systems..."
            className="w-full bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-1.5 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60"
          />
          <div className="flex gap-1 bg-[var(--m12-bg)] rounded-md p-0.5">
            {([
              { id: 'volume', label: 'Volume' },
              { id: 'name', label: 'Name' },
              { id: 'type', label: 'Type' },
            ] as const).map(s => (
              <button
                key={s.id}
                onClick={() => setSortMode(s.id)}
                className={`flex-1 text-[9px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] font-bold py-1 rounded transition-colors ${
                  sortMode === s.id
                    ? 'bg-[var(--m12-bg-card)] text-[var(--m12-text)]'
                    : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
                }`}
              >{s.label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {sortedSystems.length === 0 ? (
            <div className="text-[10px] text-[var(--m12-text-muted)] italic text-center py-8">No systems match</div>
          ) : (
            sortedSystems.map(s => {
              const counts = connectionCounts.get(s.id) || { inCount: 0, outCount: 0, total: 0 }
              const isSelected = s.id === selectedId
              const color = getSystemColor(s)
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-[#2563EB]/10 border-l-2 border-[#2563EB]'
                      : 'border-l-2 border-transparent hover:bg-[var(--m12-bg)]'
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-medium truncate ${isSelected ? 'text-[var(--m12-text)]' : 'text-[var(--m12-text-secondary)]'}`}>{s.name}</div>
                    <div className="text-[8px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase tracking-wider">{getSystemTypeLabel(s)}</div>
                  </div>
                  <div className="shrink-0 text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
                    ↓{counts.inCount} ↑{counts.outCount}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* Main canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-[var(--m12-border)]/30 bg-[var(--m12-bg-card)]/40">
          {selected ? (
            <>
              <div className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase tracking-widest">Focused</div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getSystemColor(selected) }} />
                <span className="text-sm font-semibold text-[var(--m12-text)]">{selected.name}</span>
                <span className="text-[9px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] uppercase">{getSystemTypeLabel(selected)}</span>
              </div>
              <div className="h-5 w-px bg-[var(--m12-border)]/40" />
              <div className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
                {neighborhood.upstream.length} UPSTREAM · {neighborhood.downstream.length} DOWNSTREAM
              </div>
            </>
          ) : (
            <div className="text-[11px] text-[var(--m12-text-muted)] italic">Select a system from the sidebar</div>
          )}
          <div className="flex-1" />
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
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-[var(--m12-bg)]">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-[var(--m12-text-muted)] text-sm italic">
              {network.systems.length === 0 ? 'No systems with SIPOC data yet.' : 'Select a system to view its connections.'}
            </div>
          ) : neighborhood.upstream.length === 0 && neighborhood.downstream.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
              <div className="w-24 h-24 rounded-full border-4 flex items-center justify-center" style={{ borderColor: getSystemColor(selected) + '40' }}>
                <div className="w-12 h-12 rounded-md" style={{ backgroundColor: getSystemColor(selected) }} />
              </div>
              <div>
                <div className="text-base font-semibold text-[var(--m12-text)]">{selected.name}</div>
                <div className="text-xs text-[var(--m12-text-muted)] mt-1">This system has no connections to other systems in the map.</div>
              </div>
            </div>
          ) : (
            <svg width={canvasWidth} height={canvasHeight} className="mx-auto">
              <defs>
                <marker id="nb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                </marker>
                <pattern id="nb-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--m12-border)" strokeWidth="0.3" opacity="0.25" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#nb-grid)" />

              {/* Edges: upstream → center */}
              {neighborhood.upstream.map((n, i) => {
                const pos = upstreamPos[i]
                const key = `u-${n.edge.from}`
                const emphasized = hoveredEdge === key
                const color = getSystemColor(n.system)
                const x1 = pos.x + nodeW / 2
                const y1 = pos.y
                const x2 = centerX - nodeW / 2
                const y2 = centerY
                return (
                  <g key={key} style={{ color }}>
                    <path
                      d={bezierTo(x1, y1, x2, y2)}
                      stroke={color}
                      strokeWidth={emphasized ? 3 : 2}
                      fill="none"
                      opacity={emphasized ? 1 : 0.6}
                      markerEnd="url(#nb-arrow)"
                    />
                    <path
                      d={bezierTo(x1, y1, x2, y2)}
                      stroke="transparent"
                      strokeWidth={18}
                      fill="none"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredEdge(key)}
                      onMouseLeave={() => setHoveredEdge(null)}
                    />
                    <EdgeLabel edge={n.edge} x={(x1 + x2) / 2} y={(y1 + y2) / 2} showIps={showIps} emphasized={emphasized} />
                  </g>
                )
              })}
              {/* Edges: center → downstream */}
              {neighborhood.downstream.map((n, i) => {
                const pos = downstreamPos[i]
                const key = `d-${n.edge.to}`
                const emphasized = hoveredEdge === key
                const color = getSystemColor(selected)
                const x1 = centerX + nodeW / 2
                const y1 = centerY
                const x2 = pos.x - nodeW / 2
                const y2 = pos.y
                return (
                  <g key={key} style={{ color }}>
                    <path
                      d={bezierTo(x1, y1, x2, y2)}
                      stroke={color}
                      strokeWidth={emphasized ? 3 : 2}
                      fill="none"
                      opacity={emphasized ? 1 : 0.6}
                      markerEnd="url(#nb-arrow)"
                    />
                    <path
                      d={bezierTo(x1, y1, x2, y2)}
                      stroke="transparent"
                      strokeWidth={18}
                      fill="none"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredEdge(key)}
                      onMouseLeave={() => setHoveredEdge(null)}
                    />
                    <EdgeLabel edge={n.edge} x={(x1 + x2) / 2} y={(y1 + y2) / 2} showIps={showIps} emphasized={emphasized} />
                  </g>
                )
              })}

              {/* Upstream nodes */}
              {neighborhood.upstream.map((n, i) => {
                const pos = upstreamPos[i]
                return <SystemNode key={`un-${n.system.id}`} system={n.system} x={pos.x - nodeW / 2} y={pos.y - nodeH / 2} w={nodeW} h={nodeH} onClick={() => setSelectedId(n.system.id)} />
              })}
              {/* Downstream nodes */}
              {neighborhood.downstream.map((n, i) => {
                const pos = downstreamPos[i]
                return <SystemNode key={`dn-${n.system.id}`} system={n.system} x={pos.x - nodeW / 2} y={pos.y - nodeH / 2} w={nodeW} h={nodeH} onClick={() => setSelectedId(n.system.id)} />
              })}
              {/* Center node (focused) */}
              <SystemNode system={selected} x={centerX - nodeW / 2} y={centerY - nodeH / 2} w={nodeW} h={nodeH} focused />

              {/* Labels for sides */}
              <text x={centerX - radius - 40} y={centerY - radius - 20} fontSize="9" fontWeight="700" fill="var(--m12-text-muted)" fontFamily="monospace" letterSpacing="1.5">UPSTREAM</text>
              <text x={centerX + radius - 40} y={centerY - radius - 20} fontSize="9" fontWeight="700" fill="var(--m12-text-muted)" fontFamily="monospace" letterSpacing="1.5">DOWNSTREAM</text>
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── System node ────────────────────────────────────────
function SystemNode({ system, x, y, w, h, focused, onClick }: {
  system: LogicalSystem
  x: number; y: number; w: number; h: number
  focused?: boolean
  onClick?: () => void
}) {
  const color = getSystemColor(system)
  const tmpl = SYSTEM_TEMPLATES.find(t => t.type === system.system_type)
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <rect
        width={w}
        height={h}
        rx="8"
        fill="var(--m12-bg-card)"
        stroke={focused ? '#2563EB' : color}
        strokeWidth={focused ? 3 : 1.5}
      />
      {focused && (
        <rect
          x={-6}
          y={-6}
          width={w + 12}
          height={h + 12}
          rx={10}
          fill="none"
          stroke="#2563EB"
          strokeWidth="2"
          strokeDasharray="4 2"
          opacity="0.3"
        />
      )}
      <rect width="4" height={h} rx="2" fill={color} />
      <text x="14" y="22" fontSize="12" fontWeight="600" fill="var(--m12-text)">
        {system.name.length > 22 ? system.name.slice(0, 20) + '…' : system.name}
      </text>
      {tmpl && (
        <text x="14" y="37" fontSize="8" fill="var(--m12-text-muted)" fontFamily="monospace" letterSpacing="0.5">
          {tmpl.label.toUpperCase()}
        </text>
      )}
      {focused && (
        <text x="14" y="50" fontSize="7" fill="#2563EB" fontWeight="700" fontFamily="monospace" letterSpacing="1">
          FOCUSED
        </text>
      )}
    </g>
  )
}

// ─── Edge label ─────────────────────────────────────────
function EdgeLabel({ edge, x, y, showIps, emphasized }: {
  edge: SystemEdge
  x: number; y: number
  showIps: boolean
  emphasized: boolean
}) {
  const maxShow = emphasized ? edge.l3s.length : Math.min(edge.l3s.length, 3)
  const shown = edge.l3s.slice(0, maxShow)
  const hidden = edge.l3s.length - maxShow

  let lineCount = shown.length
  if (showIps) {
    shown.forEach(l => { lineCount += emphasized ? l.ips.length : Math.min(l.ips.length, 2) })
  }
  if (hidden > 0) lineCount += 1

  const labelW = showIps ? 210 : 170
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
        opacity={emphasized ? 0.98 : 0.92}
      />
      {(() => {
        let yOff = padding + 9
        const nodes: React.ReactNode[] = []
        shown.forEach((l3, i) => {
          nodes.push(
            <text key={`cap-${i}`} x={padding} y={yOff} fontSize="9" fontWeight="600" fill="var(--m12-text)">
              {l3.capability.name.length > 30 ? l3.capability.name.slice(0, 28) + '…' : l3.capability.name}
            </text>
          )
          yOff += lineH
          if (showIps) {
            const ipsShown = emphasized ? l3.ips : l3.ips.slice(0, 2)
            ipsShown.forEach((ip, j) => {
              nodes.push(
                <text key={`ip-${i}-${j}`} x={padding + 8} y={yOff} fontSize="8" fill="var(--m12-text-muted)">
                  • {ip.name.length > 30 ? ip.name.slice(0, 28) + '…' : ip.name}
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
              +{hidden} more L3{hidden === 1 ? '' : 's'} (hover to expand)
            </text>
          )
        }
        return nodes
      })()}
    </g>
  )
}
