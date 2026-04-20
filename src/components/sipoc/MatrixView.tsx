'use client'

import { useMemo, useState } from 'react'
import { useSIPOCStore, type SystemEdge } from '@/lib/sipoc/store'
import type { LogicalSystem } from '@/lib/sipoc/types'
import { SYSTEM_TEMPLATES } from '@/lib/diagram/types'

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
        <div className="shrink-0 flex items-center gap-3 p-3 border-b border-[var(--m12-border)]/30 bg-[var(--m12-bg-card)]">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter systems..."
            className="bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-1.5 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60 w-56"
          />

          <div className="h-5 w-px bg-[var(--m12-border)]/40" />

          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase">Sort</span>
            <div className="flex gap-0.5 bg-[var(--m12-bg)] rounded-md p-0.5">
              {([
                { id: 'volume', label: 'Volume' },
                { id: 'name', label: 'Name' },
                { id: 'type', label: 'Type' },
              ] as const).map(s => (
                <button
                  key={s.id}
                  onClick={() => setSortMode(s.id)}
                  className={`text-[9px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] font-bold py-1 px-2 rounded transition-colors ${
                    sortMode === s.id
                      ? 'bg-[var(--m12-bg-card)] text-[var(--m12-text)]'
                      : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
                  }`}
                >{s.label}</button>
              ))}
            </div>
          </div>

          <div className="h-5 w-px bg-[var(--m12-border)]/40" />

          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase">Color By</span>
            <div className="flex gap-0.5 bg-[var(--m12-bg)] rounded-md p-0.5">
              {([
                { id: 'l3s', label: 'L3 Count' },
                { id: 'ips', label: 'IP Count' },
              ] as const).map(s => (
                <button
                  key={s.id}
                  onClick={() => setColorBy(s.id)}
                  className={`text-[9px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] font-bold py-1 px-2 rounded transition-colors ${
                    colorBy === s.id
                      ? 'bg-[var(--m12-bg-card)] text-[var(--m12-text)]'
                      : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
                  }`}
                >{s.label}</button>
              ))}
            </div>
          </div>

          <div className="flex-1" />

          <div className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
            {orderedSystems.length} × {orderedSystems.length} · {network.edges.length} connections
          </div>
        </div>

        {/* Matrix scrollable area */}
        <div className="flex-1 overflow-auto bg-[var(--m12-bg)]">
          {orderedSystems.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[var(--m12-text-muted)] text-sm italic">
              No systems to display.
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
                        fill="var(--m12-text-secondary)"
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
                        fill="var(--m12-text-secondary)"
                        textAnchor="end"
                      >
                        {s.name.length > 22 ? s.name.slice(0, 20) + '…' : s.name}
                      </text>
                    </g>
                  )
                })}

                {/* Axis labels */}
                <text x={headerW + orderedSystems.length * cellSize / 2} y={18} fontSize="9" fontWeight="700" fill="var(--m12-text-muted)" fontFamily="monospace" letterSpacing="1.5" textAnchor="middle">
                  TO (DESTINATION) →
                </text>
                <text
                  x={18}
                  y={headerH + orderedSystems.length * cellSize / 2}
                  fontSize="9" fontWeight="700" fill="var(--m12-text-muted)" fontFamily="monospace" letterSpacing="1.5"
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
                          fill={isDiagonal ? 'var(--m12-border)' : 'var(--m12-bg-card)'}
                          stroke="var(--m12-border)"
                          strokeWidth="0.3"
                          opacity={isDiagonal ? 0.3 : 0.5}
                        />
                      )
                    }

                    const value = colorBy === 'l3s' ? edge.l3s.length : edge.totalIps
                    const t = Math.min(1, value / maxValue)
                    const fill = lerpColor('#1E3A5F', '#60A5FA', t)

                    return (
                      <g key={`cell-${r}-${c}`}>
                        <rect
                          x={x} y={y} width={cellSize} height={cellSize}
                          fill={fill}
                          stroke={isSelected ? '#2563EB' : 'var(--m12-border)'}
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
                            fill={t > 0.5 ? 'white' : 'var(--m12-text)'}
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
              <div className="mt-4 flex items-center gap-2 text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase">
                <span>None</span>
                <div className="flex h-3">
                  {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => (
                    <div key={i} className="w-6 h-full" style={{ backgroundColor: lerpColor('#1E3A5F', '#60A5FA', t) }} />
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
        <aside className="w-[380px] shrink-0 border-l border-[var(--m12-border)]/30 bg-[var(--m12-bg-card)] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[var(--m12-border)]/20 shrink-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-widest text-[var(--m12-text-muted)] font-bold">Connection Detail</div>
              <button onClick={() => setSelected(null)} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: getSystemColor(selected.from) }} />
                <span className="font-semibold text-[var(--m12-text)] truncate">{selected.from.name}</span>
              </div>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" className="shrink-0 text-[var(--m12-text-muted)]">
                <path d="M0 5h11M9 2l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: getSystemColor(selected.to) }} />
                <span className="font-semibold text-[var(--m12-text)] truncate">{selected.to.name}</span>
              </div>
            </div>
            <div className="mt-2 flex gap-3 text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
              <span><span className="text-[var(--m12-text)] font-bold">{selected.edge.l3s.length}</span> L3 flow{selected.edge.l3s.length !== 1 ? 's' : ''}</span>
              <span><span className="text-[var(--m12-text)] font-bold">{selected.edge.totalIps}</span> IP{selected.edge.totalIps !== 1 ? 's' : ''}</span>
            </div>
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showIps}
                onChange={e => setShowIps(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              <span className="text-[10px] text-[var(--m12-text-secondary)]">Show IPs per L3</span>
            </label>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {selected.edge.l3s.map((l3, i) => (
              <div key={l3.capability.id} className="border border-[var(--m12-border)]/30 rounded-lg bg-[var(--m12-bg)] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] bg-[#2563EB]/10 text-[#93C5FD] rounded px-1.5 py-0.5 font-[family-name:var(--font-space-mono)]">L3</span>
                  <span className="text-[11px] font-semibold text-[var(--m12-text)] flex-1">{l3.capability.name}</span>
                  <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">{l3.ips.length} IP{l3.ips.length !== 1 ? 's' : ''}</span>
                </div>
                {showIps && l3.ips.length > 0 && (
                  <div className="mt-2 space-y-0.5 pl-3 border-l border-[var(--m12-border)]/30">
                    {l3.ips.map(ip => (
                      <div key={ip.id} className="text-[10px] text-[var(--m12-text-secondary)]">
                        • {ip.name}
                        {ip.category && <span className="ml-1 text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] uppercase">{ip.category}</span>}
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
