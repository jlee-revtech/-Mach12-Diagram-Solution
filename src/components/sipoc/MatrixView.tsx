'use client'

import { useMemo, useState } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { EmptyState } from '@/components/common'
import { useSIPOCStore, type SystemEdge } from '@/lib/sipoc/store'
import type { LogicalSystem } from '@/lib/sipoc/types'
import { SYSTEM_TEMPLATES } from '@/lib/diagram/types'

// Light-theme heatmap ramp (brand blue family) + fixed chrome hexes for SVG
// text/grid (SVG attrs cannot take Tailwind classes).
const HEAT_LOW = '#DBEAFE'
const HEAT_HIGH = '#1D4ED8'
const SVG_TEXT = '#1b1b1b'
const SVG_TEXT_SECONDARY = '#5e5e5e'
const SVG_TEXT_TERTIARY = '#595959'
const SVG_BORDER = '#e2e2e2'
const SVG_CELL_EMPTY = '#ffffff'

type ColorBy = 'l3s' | 'ips'
type SortMode = 'volume' | 'name' | 'type'

function getSystemColor(s: LogicalSystem): string {
  const tmpl = SYSTEM_TEMPLATES.find(t => t.type === s.system_type)
  return s.color || tmpl?.color || '#64748B'
}

function getSystemTypeLabel(s: LogicalSystem): string {
  const tmpl = SYSTEM_TEMPLATES.find(t => t.type === s.system_type)
  return tmpl?.label || 'OTHER'
}

// Linear interpolate between two hex colors
function lerpColor(c1: string, c2: string, t: number): string {
  const hex = (c: string) => {
    const m = c.replace('#', '').match(/.{2}/g)
    return m ? m.map(x => parseInt(x, 16)) : [0, 0, 0]
  }
  const a = hex(c1), b = hex(c2)
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

export default function MatrixView() {
  const caps = useSIPOCStore(s => s.capabilities)
  const inputs = useSIPOCStore(s => s.inputs)
  const outputs = useSIPOCStore(s => s.outputs)
  const network = useMemo(() => useSIPOCStore.getState().getSystemNetwork(), [caps, inputs, outputs])

  const [sortMode, setSortMode] = useState<SortMode>('volume')
  const [colorBy, setColorBy] = useState<ColorBy>('l3s')
  const [showIps, setShowIps] = useState(false)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<{ from: LogicalSystem; to: LogicalSystem; edge: SystemEdge } | null>(null)

  // Connection counts
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    network.systems.forEach(s => m.set(s.id, 0))
    network.edges.forEach(e => {
      m.set(e.from, (m.get(e.from) || 0) + 1)
      m.set(e.to, (m.get(e.to) || 0) + 1)
    })
    return m
  }, [network])

  // Ordered system list
  const orderedSystems = useMemo(() => {
    let list = [...network.systems]
    if (filter.trim()) {
      const q = filter.toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(q) || getSystemTypeLabel(s).toLowerCase().includes(q))
    }
    if (sortMode === 'volume') list.sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0))
    else if (sortMode === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
    else list.sort((a, b) => getSystemTypeLabel(a).localeCompare(getSystemTypeLabel(b)) || a.name.localeCompare(b.name))
    return list
  }, [network.systems, sortMode, filter, counts])

  // Edge lookup
  const edgeMap = useMemo(() => {
    const m = new Map<string, SystemEdge>()
    network.edges.forEach(e => m.set(`${e.from}->${e.to}`, e))
    return m
  }, [network])

  // Max value for color scale
  const maxValue = useMemo(() => {
    return network.edges.reduce((acc, e) => {
      const v = colorBy === 'l3s' ? e.l3s.length : e.totalIps
      return Math.max(acc, v)
    }, 1)
  }, [network.edges, colorBy])

  // Cell size
  const cellSize = Math.max(28, Math.min(42, 720 / Math.max(orderedSystems.length, 1)))
  const headerW = 180
  const headerH = 180

  return (
    <div className="flex h-full">
      {/* Main matrix area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center gap-3 p-3 border-b border-border bg-white">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter systems..."
            className="h-8 px-3 rounded-lg border border-border bg-surface-input text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 w-56"
          />

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-tertiary font-mono uppercase">Sort</span>
            <div className="flex gap-0.5 bg-surface-muted rounded-md p-0.5">
              {([
                { id: 'volume', label: 'Volume' },
                { id: 'name', label: 'Name' },
                { id: 'type', label: 'Type' },
              ] as const).map(s => (
                <button
                  key={s.id}
                  onClick={() => setSortMode(s.id)}
                  className={`text-[10px] uppercase tracking-wider font-mono font-bold py-1 px-2 rounded transition-colors ${
                    sortMode === s.id
                      ? 'bg-brand-500 text-white'
                      : 'text-text-secondary hover:bg-white'
                  }`}
                >{s.label}</button>
              ))}
            </div>
          </div>

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-tertiary font-mono uppercase">Color By</span>
            <div className="flex gap-0.5 bg-surface-muted rounded-md p-0.5">
              {([
                { id: 'l3s', label: 'L3 Count' },
                { id: 'ips', label: 'IP Count' },
              ] as const).map(s => (
                <button
                  key={s.id}
                  onClick={() => setColorBy(s.id)}
                  className={`text-[10px] uppercase tracking-wider font-mono font-bold py-1 px-2 rounded transition-colors ${
                    colorBy === s.id
                      ? 'bg-brand-500 text-white'
                      : 'text-text-secondary hover:bg-white'
                  }`}
                >{s.label}</button>
              ))}
            </div>
          </div>

          <div className="flex-1" />

          <div className="text-[10px] text-text-tertiary font-mono">
            {orderedSystems.length} × {orderedSystems.length} · {network.edges.length} connections
          </div>
        </div>

        {/* Matrix scrollable area */}
        <div className="flex-1 overflow-auto bg-surface-muted">
          {orderedSystems.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState variant="inline" compact title="No systems to display" />
            </div>
          ) : (
            <div className="p-6 inline-block">
              <svg
                width={headerW + orderedSystems.length * cellSize + 20}
                height={headerH + orderedSystems.length * cellSize + 40}
              >
                {/* Column headers (rotated labels = destination systems) */}
                {orderedSystems.map((s, i) => {
                  const x = headerW + i * cellSize + cellSize / 2
                  const color = getSystemColor(s)
                  return (
                    <g key={`ch-${s.id}`}>
                      <line x1={x} y1={headerH - 4} x2={x} y2={headerH} stroke={color} strokeWidth={3} />
                      <text
                        x={x}
                        y={headerH - 8}
                        fontSize="10"
                        fill={SVG_TEXT_SECONDARY}
                        transform={`rotate(-45, ${x}, ${headerH - 8})`}
                        textAnchor="start"
                      >
                        {s.name.length > 22 ? s.name.slice(0, 20) + '…' : s.name}
                      </text>
                    </g>
                  )
                })}
                {/* Row headers (source systems) */}
                {orderedSystems.map((s, i) => {
                  const y = headerH + i * cellSize + cellSize / 2
                  const color = getSystemColor(s)
                  return (
                    <g key={`rh-${s.id}`}>
                      <line x1={headerW - 4} y1={y} x2={headerW} y2={y} stroke={color} strokeWidth={3} />
                      <text
                        x={headerW - 8}
                        y={y + 3}
                        fontSize="10"
                        fill={SVG_TEXT_SECONDARY}
                        textAnchor="end"
                      >
                        {s.name.length > 22 ? s.name.slice(0, 20) + '…' : s.name}
                      </text>
                    </g>
                  )
                })}

                {/* Axis labels */}
                <text x={headerW + orderedSystems.length * cellSize / 2} y={18} fontSize="9" fontWeight="700" fill={SVG_TEXT_TERTIARY} fontFamily="monospace" letterSpacing="1.5" textAnchor="middle">
                  TO (DESTINATION) →
                </text>
                <text
                  x={18}
                  y={headerH + orderedSystems.length * cellSize / 2}
                  fontSize="9" fontWeight="700" fill={SVG_TEXT_TERTIARY} fontFamily="monospace" letterSpacing="1.5"
                  transform={`rotate(-90, 18, ${headerH + orderedSystems.length * cellSize / 2})`}
                  textAnchor="middle"
                >
                  FROM (SOURCE) →
                </text>

                {/* Cells */}
                {orderedSystems.map((fromSys, r) => (
                  orderedSystems.map((toSys, c) => {
                    const x = headerW + c * cellSize
                    const y = headerH + r * cellSize
                    const edge = edgeMap.get(`${fromSys.id}->${toSys.id}`)
                    const isDiagonal = fromSys.id === toSys.id
                    const isSelected = selected && selected.from.id === fromSys.id && selected.to.id === toSys.id

                    if (!edge) {
                      return (
                        <rect
                          key={`cell-${r}-${c}`}
                          x={x} y={y} width={cellSize} height={cellSize}
                          fill={isDiagonal ? SVG_BORDER : SVG_CELL_EMPTY}
                          stroke={SVG_BORDER}
                          strokeWidth="0.3"
                          opacity={isDiagonal ? 0.3 : 0.5}
                        />
                      )
                    }

                    const value = colorBy === 'l3s' ? edge.l3s.length : edge.totalIps
                    const t = Math.min(1, value / maxValue)
                    const fill = lerpColor(HEAT_LOW, HEAT_HIGH, t)

                    return (
                      <g key={`cell-${r}-${c}`}>
                        <rect
                          x={x} y={y} width={cellSize} height={cellSize}
                          fill={fill}
                          stroke={isSelected ? '#2563EB' : SVG_BORDER}
                          strokeWidth={isSelected ? 2 : 0.3}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelected({ from: fromSys, to: toSys, edge })}
                        >
                          <title>{fromSys.name} → {toSys.name}: {edge.l3s.length} L3{edge.l3s.length !== 1 ? 's' : ''}, {edge.totalIps} IP{edge.totalIps !== 1 ? 's' : ''}</title>
                        </rect>
                        {cellSize >= 24 && (
                          <text
                            x={x + cellSize / 2}
                            y={y + cellSize / 2 + 3}
                            fontSize="9"
                            fontWeight="700"
                            fill={t > 0.5 ? 'white' : SVG_TEXT}
                            textAnchor="middle"
                            style={{ pointerEvents: 'none' }}
                          >
                            {value}
                          </text>
                        )}
                      </g>
                    )
                  })
                ))}
              </svg>
              {/* Legend */}
              <div className="mt-4 flex items-center gap-2 text-[10px] text-text-tertiary font-mono uppercase">
                <span>None</span>
                <div className="flex h-3">
                  {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => (
                    <div key={i} className="w-6 h-full" style={{ backgroundColor: lerpColor(HEAT_LOW, HEAT_HIGH, t) }} />
                  ))}
                </div>
                <span>Max</span>
                <span className="ml-2 normal-case italic">(cell value = {colorBy === 'l3s' ? 'number of L3s flowing' : 'number of unique IPs flowing'})</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side panel for cell details */}
      {selected && (
        <aside className="w-[380px] shrink-0 border-l border-border bg-white flex flex-col overflow-hidden animate-slide-in-right">
          <div className="p-4 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary font-bold">Connection Detail</div>
              <button onClick={() => setSelected(null)} aria-label="Close" className="text-text-tertiary hover:text-text-primary transition-colors">
                <X size={12} />
              </button>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: getSystemColor(selected.from) }} />
                <span className="font-semibold text-text-primary truncate">{selected.from.name}</span>
              </div>
              <ArrowRight size={12} className="shrink-0 text-text-tertiary" />
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: getSystemColor(selected.to) }} />
                <span className="font-semibold text-text-primary truncate">{selected.to.name}</span>
              </div>
            </div>
            <div className="mt-2 flex gap-3 text-[10px] text-text-tertiary font-mono">
              <span><span className="text-text-primary font-bold">{selected.edge.l3s.length}</span> L3 flow{selected.edge.l3s.length !== 1 ? 's' : ''}</span>
              <span><span className="text-text-primary font-bold">{selected.edge.totalIps}</span> IP{selected.edge.totalIps !== 1 ? 's' : ''}</span>
            </div>
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showIps}
                onChange={e => setShowIps(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#2563EB]"
              />
              <span className="text-[10px] text-text-secondary">Show IPs per L3</span>
            </label>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {selected.edge.l3s.map((l3, i) => (
              <div key={l3.capability.id} className="border border-border rounded-lg bg-surface-muted p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] bg-brand-50 text-brand-600 rounded px-1.5 py-0.5 font-mono">L3</span>
                  <span className="text-[11px] font-semibold text-text-primary flex-1">{l3.capability.name}</span>
                  <span className="text-[10px] text-text-tertiary font-mono">{l3.ips.length} IP{l3.ips.length !== 1 ? 's' : ''}</span>
                </div>
                {showIps && l3.ips.length > 0 && (
                  <div className="mt-2 space-y-0.5 pl-3 border-l border-border">
                    {l3.ips.map(ip => (
                      <div key={ip.id} className="text-[10px] text-text-secondary">
                        • {ip.name}
                        {ip.category && <span className="ml-1 text-[10px] text-text-tertiary font-mono uppercase">{ip.category}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  )
}
