'use client'

import { useMemo } from 'react'
import {
  getSmoothStepPath,
  useStore,
  useReactFlow,
  ViewportPortal,
  type ReactFlowState,
} from '@xyflow/react'
import { getFloatingParams } from './edges/floating'

interface Pt { x: number; y: number }

// Parse an orthogonal smoothstep path (borderRadius 0 → only M/L commands)
// into a polyline of corner points.
function pathToPoints(d: string): Pt[] {
  const pts: Pt[] = []
  const re = /[ML]\s*(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) pts.push({ x: parseFloat(m[1]), y: parseFloat(m[2]) })
  return pts
}

// Proper segment intersection (excludes shared endpoints / collinear touches).
function segCross(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r = { x: b.x - a.x, y: b.y - a.y }
  const s = { x: d.x - c.x, y: d.y - c.y }
  const denom = r.x * s.y - r.y * s.x
  if (Math.abs(denom) < 1e-6) return null // parallel/collinear
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom
  const eps = 0.02
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null // endpoint touch, not a crossing
  return { x: a.x + t * r.x, y: a.y + t * r.y }
}

const nodeInternalsSelector = (s: ReactFlowState) => s.nodeLookup

/**
 * Overlay that flags connector crossings. The auto-layout already minimizes
 * crossings; where they remain (sometimes unavoidable), each crossing is shown
 * with an amber "hop" marker so overlaps are clearly called out in the UI.
 */
export default function CrossingMarkers() {
  const nodeLookup = useStore(nodeInternalsSelector)
  const edges = useStore((s: ReactFlowState) => s.edges)
  const { getInternalNode } = useReactFlow()

  const crossings = useMemo<Pt[]>(() => {
    const seqEdges = edges.filter(e => e.type === 'sequenceFlow' || e.type === undefined)
    if (seqEdges.length < 2) return []
    // Build each edge's polyline from floating params + a square smoothstep path.
    const polys: { src: string; tgt: string; pts: Pt[] }[] = []
    for (const e of seqEdges) {
      const sn = getInternalNode(e.source)
      const tn = getInternalNode(e.target)
      if (!sn || !tn) continue
      const p = getFloatingParams(sn, tn)
      const [d] = getSmoothStepPath({
        sourceX: p.sx, sourceY: p.sy, targetX: p.tx, targetY: p.ty,
        sourcePosition: p.sPos, targetPosition: p.tPos, borderRadius: 0,
      })
      const pts = pathToPoints(d)
      if (pts.length >= 2) polys.push({ src: e.source, tgt: e.target, pts })
    }
    const out: Pt[] = []
    for (let i = 0; i < polys.length; i++) {
      for (let j = i + 1; j < polys.length; j++) {
        const A = polys[i], B = polys[j]
        // skip edges that share a node (they legitimately meet there)
        if (A.src === B.src || A.src === B.tgt || A.tgt === B.src || A.tgt === B.tgt) continue
        for (let a = 0; a < A.pts.length - 1; a++) {
          for (let b = 0; b < B.pts.length - 1; b++) {
            const x = segCross(A.pts[a], A.pts[a + 1], B.pts[b], B.pts[b + 1])
            if (x) out.push(x)
          }
        }
      }
    }
    // de-dupe near-coincident crossings
    const dedup: Pt[] = []
    for (const c of out) {
      if (!dedup.some(d => Math.abs(d.x - c.x) < 6 && Math.abs(d.y - c.y) < 6)) dedup.push(c)
    }
    return dedup
    // nodeLookup in deps so markers re-evaluate when nodes move/resize
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, nodeLookup])

  if (crossings.length === 0) return null

  return (
    <ViewportPortal>
      {crossings.map((c, i) => (
        <div
          key={i}
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(${c.x - 7}px, ${c.y - 7}px)`,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--m12-bg)',
            border: '1.5px solid #F59E0B',
            boxShadow: '0 0 0 2px var(--m12-bg)',
            pointerEvents: 'none',
            zIndex: 6,
          }}
          title="Connectors cross here"
        />
      ))}
    </ViewportPortal>
  )
}
