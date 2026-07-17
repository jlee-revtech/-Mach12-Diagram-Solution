'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X, Waypoints, ArrowRight } from 'lucide-react'
import { Button, EmptyState } from '@/components/common'
import { useSIPOCStore } from '@/lib/sipoc/store'

// ─── Layout constants ───────────────────────────────────
const NODE_W = 210
const NODE_H = 56
const COL_GAP = 120   // horizontal room between columns (elbow + label channel)
const ROW_GAP = 30
const MARGIN = 48
const COL_PITCH = NODE_W + COL_GAP
const ROW_PITCH = NODE_H + ROW_GAP

interface FlowNode {
  id: string
  name: string
  mapId: string
  mapTitle: string
  isCurrent: boolean
  col: number
  row: number
  x: number
  y: number
}
interface FlowEdge {
  from: string
  to: string
  ipName: string
  d: string
  labelX: number
  labelY: number
}

// Cross-map process sequence diagram. Nodes = processes (L3), edges = explicit
// output→input links (labeled by the information product), scoped to links that
// touch the currently-loaded map. Left→right = upstream→downstream. All
// connectors are orthogonal (H/V only) — never diagonal.
export default function ProcessFlowView({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const map = useSIPOCStore(s => s.map)
  const capabilities = useSIPOCStore(s => s.capabilities)
  const inputs = useSIPOCStore(s => s.inputs)
  const outputs = useSIPOCStore(s => s.outputs)
  const informationProducts = useSIPOCStore(s => s.informationProducts)
  const inputSources = useSIPOCStore(s => s.inputSources)
  const outputDownstream = useSIPOCStore(s => s.outputDownstream)

  const { nodes, edges, canvasW, canvasH, mapCount } = useMemo(() => {
    const currentMapId = map?.id || ''
    const currentMapTitle = map?.title || 'This map'
    const ipMap = new Map(informationProducts.map(ip => [ip.id, ip.name]))
    const capName = (id: string) => capabilities.find(c => c.id === id)?.name || '(process)'

    const meta = new Map<string, { name: string; mapId: string; mapTitle: string; isCurrent: boolean }>()
    const addNode = (id: string, name: string, mapId: string, mapTitle: string, isCurrent: boolean) => {
      const existing = meta.get(id)
      if (!existing) meta.set(id, { name, mapId, mapTitle, isCurrent })
      else if (isCurrent && !existing.isCurrent) meta.set(id, { name, mapId, mapTitle, isCurrent })
    }

    const edgeMap = new Map<string, { from: string; to: string; ipName: string }>()
    const addEdge = (from: string, to: string, ipName: string) => {
      if (!from || !to) return
      const key = `${from}::${to}::${ipName}`
      if (!edgeMap.has(key)) edgeMap.set(key, { from, to, ipName })
    }

    // Inputs in this map fed by an upstream output → edge upstream ➜ this process
    for (const [capId, list] of Object.entries(inputs)) {
      for (const inp of list) {
        if (inp.archived_at || !inp.source_output_id) continue
        const src = inputSources[inp.source_output_id]
        if (!src) continue
        const ipName = ipMap.get(inp.information_product_id) || 'data'
        addNode(src.capabilityId, src.capabilityName, src.mapId, src.mapTitle, src.mapId === currentMapId)
        addNode(capId, capName(capId), currentMapId, currentMapTitle, true)
        addEdge(src.capabilityId, capId, ipName)
      }
    }
    // Outputs in this map feeding downstream inputs → edge this process ➜ downstream
    for (const [capId, list] of Object.entries(outputs)) {
      for (const out of list) {
        if (out.archived_at) continue
        const ds = outputDownstream[out.id]
        if (!ds || ds.length === 0) continue
        const ipName = ipMap.get(out.information_product_id) || 'data'
        addNode(capId, capName(capId), currentMapId, currentMapTitle, true)
        for (const d of ds) {
          addNode(d.capabilityId, d.capabilityName, d.mapId, d.mapTitle, d.mapId === currentMapId)
          addEdge(capId, d.capabilityId, ipName)
        }
      }
    }

    const rawEdges = [...edgeMap.values()]

    // Column = longest-path depth (cycle-guarded).
    const depth = new Map<string, number>()
    meta.forEach((_, id) => depth.set(id, 0))
    const N = meta.size
    for (let iter = 0; iter < N + 1; iter++) {
      let changed = false
      for (const e of rawEdges) {
        const dFrom = depth.get(e.from) ?? 0
        const dTo = depth.get(e.to) ?? 0
        if (dTo < dFrom + 1) { depth.set(e.to, dFrom + 1); changed = true }
      }
      if (!changed) break
    }

    // Group by column, stable order by name, assign rows.
    const byCol = new Map<number, string[]>()
    ;[...meta.keys()]
      .sort((a, b) => (meta.get(a)!.name).localeCompare(meta.get(b)!.name))
      .forEach(id => {
        const col = depth.get(id) ?? 0
        if (!byCol.has(col)) byCol.set(col, [])
        byCol.get(col)!.push(id)
      })

    const pos = new Map<string, { col: number; row: number; x: number; y: number }>()
    let maxRows = 0
    let maxCol = 0
    byCol.forEach((ids, col) => {
      maxCol = Math.max(maxCol, col)
      maxRows = Math.max(maxRows, ids.length)
      ids.forEach((id, row) => {
        pos.set(id, {
          col, row,
          x: MARGIN + col * COL_PITCH,
          y: MARGIN + row * ROW_PITCH,
        })
      })
    })

    const nodes: FlowNode[] = [...meta.entries()].map(([id, m]) => {
      const p = pos.get(id)!
      return { id, ...m, col: p.col, row: p.row, x: p.x, y: p.y }
    })

    const edges: FlowEdge[] = rawEdges.map(e => {
      const s = pos.get(e.from)!
      const t = pos.get(e.to)!
      const sx = s.x + NODE_W
      const syc = s.y + NODE_H / 2
      const tx = t.x
      const tyc = t.y + NODE_H / 2
      // Orthogonal Z-elbow: right → vertical channel in the gap → into target.
      const midX = t.col > s.col ? (sx + tx) / 2 : sx + COL_GAP / 2
      const d = `M ${sx + 2} ${syc} H ${midX} V ${tyc} H ${tx - 6}`
      return { ...e, d, labelX: midX, labelY: (syc + tyc) / 2 }
    })

    const canvasW = MARGIN * 2 + (maxCol + 1) * NODE_W + maxCol * COL_GAP
    const canvasH = MARGIN * 2 + Math.max(1, maxRows) * ROW_PITCH
    const mapCount = new Set([...meta.values()].map(m => m.mapId)).size

    return { nodes, edges, canvasW, canvasH, mapCount }
  }, [map, capabilities, inputs, outputs, informationProducts, inputSources, outputDownstream])

  const openNode = (mapId: string, capId: string) => {
    if (map && mapId === map.id) {
      useSIPOCStore.getState().setSelectedCapability(capId)
      onClose()
    } else {
      router.push(`/capability-map/${mapId}?cap=${capId}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-surface-muted z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Waypoints size={16} />
          </div>
          <div>
            <div className="text-heading-sm font-display text-text-primary">Process Sequence</div>
            <div className="text-body-sm text-text-secondary">
              {edges.length} link{edges.length !== 1 ? 's' : ''} · {nodes.length} process{nodes.length !== 1 ? 'es' : ''}
              {mapCount > 1 && ` · ${mapCount} maps`} · output → input flow touching this map
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" iconOnly aria-label="Close" onClick={onClose} icon={<X size={18} />} />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-white shrink-0 text-[11px] text-text-secondary">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-white border border-brand-300 inline-block" />
          This map
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-surface-muted border border-border inline-block" />
          Other map
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowRight size={12} className="text-indigo-500" />
          feeds (labeled by information product)
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-6">
        {edges.length === 0 ? (
          <div className="max-w-xl mx-auto mt-10">
            <EmptyState
              variant="inline"
              title="No process links yet"
              description="Open a process, and under Inputs choose “Link an upstream output” to connect one process's output to another's input. Those links appear here as a sequence."
            />
          </div>
        ) : (
          <div className="relative mx-auto" style={{ width: canvasW, height: canvasH, minWidth: canvasW }}>
            {/* Edge layer (orthogonal connectors) */}
            <svg
              width={canvasW}
              height={canvasH}
              className="absolute inset-0 pointer-events-none"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <marker id="pf-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0L10 5L0 10z" fill="#6366F1" />
                </marker>
              </defs>
              {edges.map((e, i) => (
                <path
                  key={i}
                  d={e.d}
                  fill="none"
                  stroke="#6366F1"
                  strokeWidth={1.5}
                  strokeOpacity={0.75}
                  markerEnd="url(#pf-arrow)"
                />
              ))}
            </svg>

            {/* Edge labels (opaque chips over the vertical channel) */}
            {edges.map((e, i) => (
              <div
                key={`l${i}`}
                className="absolute z-10 pointer-events-none"
                style={{ left: e.labelX, top: e.labelY, transform: 'translate(-50%, -50%)' }}
              >
                <span className="inline-block whitespace-nowrap rounded border border-indigo-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 shadow-xs max-w-[160px] truncate">
                  {e.ipName}
                </span>
              </div>
            ))}

            {/* Node layer */}
            {nodes.map(n => (
              <button
                key={n.id}
                type="button"
                onClick={() => openNode(n.mapId, n.id)}
                className={`absolute z-20 rounded-lg border px-3 py-2 flex flex-col justify-center text-left shadow-card transition-shadow hover:shadow-card-hover ${
                  n.isCurrent
                    ? 'bg-white border-brand-300 hover:border-brand-400'
                    : 'bg-surface-muted border-border hover:border-border-strong'
                }`}
                style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
                title={`${n.name}${n.isCurrent ? '' : ` · ${n.mapTitle}`}`}
              >
                <span className="text-[11px] font-semibold text-text-primary leading-tight line-clamp-2">{n.name}</span>
                {!n.isCurrent && (
                  <span className="text-[9px] text-text-tertiary font-mono uppercase tracking-wider truncate mt-0.5">
                    {n.mapTitle}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
