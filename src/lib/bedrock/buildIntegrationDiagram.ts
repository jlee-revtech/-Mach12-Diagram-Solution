import type { SystemType, SystemNode, SystemGroupNode, DataFlowEdge, DataElement, DataElementType, FlowDirection } from '@/lib/diagram/types'
import type { BedrockSystemWithPhysicals } from '@/lib/bedrock/types'

// One inter-system integration for a single L3 process (post-merge across the
// per-L1 AI calls). The builder coalesces these into one wire per system pair.
export interface MergedIntegration {
  l1: string
  l2: string
  l3: string
  sourceSystemType: SystemType
  targetSystemType: SystemType
  direction: FlowDirection
  dataObjects: { name: string; elementType?: string; description?: string }[]
  frequency?: string
  integrationPattern?: string
  trigger?: string
  workstream?: string | null
}

export interface BuildResult {
  nodes: SystemNode[]
  edges: DataFlowEdge[]
  groups: SystemGroupNode[]
  systemCount: number
}

const SYSTEM_W = 180
const SYSTEM_H = 80
const COL_GAP = 110
const ROW_GAP = 60
const COLS_PER_BAND = 4
const BAND_PAD_X = 30
const BAND_PAD_TOP = 50
const BAND_PAD_BOTTOM = 30
const BAND_GAP = 50
const BASE_X = 100
const BASE_Y = 100

const ELEMENT_TYPES: DataElementType[] = ['transaction', 'master_data', 'document', 'event', 'data_object', 'custom']
function coerceElementType(t?: string): DataElementType {
  return ELEMENT_TYPES.includes(t as DataElementType) ? (t as DataElementType) : 'data_object'
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
}

function primaryPhysical(sys: BedrockSystemWithPhysicals): string | undefined {
  const prim = sys.physicals.find(p => p.is_primary) || sys.physicals[0]
  return prim?.name
}

/**
 * Build a data-architecture diagram from merged bedrock integrations. Pure and
 * deterministic: stable ids, sorted inputs, grid layout grouped by workstream.
 *   - One SystemNode per distinct referenced systemType (label + primary
 *     physical resolved from the bedrock catalog).
 *   - One DataFlowEdge per (source, target) systemType pair, carrying every
 *     data object that flows between them as DataElements.
 *   - One SystemGroupNode band per workstream.
 */
export function buildIntegrationDiagram(
  integrations: MergedIntegration[],
  catalog: BedrockSystemWithPhysicals[],
  workstreams: { id: string; name: string; color?: string | null }[],
): BuildResult {
  const catalogByType = new Map<string, BedrockSystemWithPhysicals>()
  for (const c of catalog) catalogByType.set(c.system_type, c)

  // Which systemTypes are actually referenced (and exist in the catalog).
  const referenced = new Set<SystemType>()
  for (const it of integrations) {
    if (it.sourceSystemType === it.targetSystemType) continue
    if (catalogByType.has(it.sourceSystemType)) referenced.add(it.sourceSystemType)
    if (catalogByType.has(it.targetSystemType)) referenced.add(it.targetSystemType)
  }

  // ─── Band assignment by workstream ───
  const wsOrder = workstreams.map(w => w.id)
  const wsById = new Map(workstreams.map(w => [w.id, w]))
  // band key -> ordered list of systemTypes
  const bands = new Map<string, SystemType[]>()
  const SHARED = '__shared__'
  const typesSorted = [...referenced].sort((a, b) => {
    const sa = catalogByType.get(a)!.sort_order, sb = catalogByType.get(b)!.sort_order
    return sa - sb
  })
  for (const t of typesSorted) {
    const sys = catalogByType.get(t)!
    // Place each system in one band by its PRIMARY value stream (workstream_id),
    // falling back to the first of workstream_ids for multi-aligned systems.
    const wsId = sys.workstream_id || sys.workstream_ids?.[0] || SHARED
    const key = wsById.has(wsId) ? wsId : SHARED
    if (!bands.has(key)) bands.set(key, [])
    bands.get(key)!.push(t)
  }
  // Order bands: by workstream sort order, shared last.
  const bandKeys = [...bands.keys()].sort((a, b) => {
    if (a === SHARED) return 1
    if (b === SHARED) return -1
    return wsOrder.indexOf(a) - wsOrder.indexOf(b)
  })

  // ─── Lay out nodes + group bands ───
  const nodes: SystemNode[] = []
  const groups: SystemGroupNode[] = []
  let y = BASE_Y
  for (const key of bandKeys) {
    const types = bands.get(key)!
    const cols = Math.min(types.length, COLS_PER_BAND)
    const rows = Math.ceil(types.length / COLS_PER_BAND)
    const bandW = BAND_PAD_X * 2 + cols * SYSTEM_W + (cols - 1) * COL_GAP
    const bandH = BAND_PAD_TOP + rows * SYSTEM_H + (rows - 1) * ROW_GAP + BAND_PAD_BOTTOM
    const ws = wsById.get(key)
    groups.push({
      id: `group-${key === SHARED ? 'shared' : key}`,
      type: 'systemGroup',
      position: { x: BASE_X, y },
      zIndex: -1,
      style: { width: bandW, height: bandH, pointerEvents: 'none' as const },
      focusable: false,
      data: { label: ws ? ws.name : 'Shared / Cross-Workstream', color: ws?.color || '#64748B' },
    })
    types.forEach((t, i) => {
      const col = i % COLS_PER_BAND
      const row = Math.floor(i / COLS_PER_BAND)
      const cat = catalogByType.get(t)!
      nodes.push({
        id: `system-${t}`,
        type: 'system',
        position: {
          x: BASE_X + BAND_PAD_X + col * (SYSTEM_W + COL_GAP),
          y: y + BAND_PAD_TOP + row * (SYSTEM_H + ROW_GAP),
        },
        data: {
          label: cat.label,
          systemType: t,
          physicalSystem: primaryPhysical(cat),
          description: cat.description ?? undefined,
        },
      })
    })
    y += bandH + BAND_GAP
  }

  // ─── Coalesce edges per (source, target) systemType pair ───
  const edgeByKey = new Map<string, DataFlowEdge>()
  const contexts = new Map<string, Set<string>>()
  for (const it of integrations) {
    const src = it.sourceSystemType, tgt = it.targetSystemType
    if (src === tgt) continue
    if (!referenced.has(src) || !referenced.has(tgt)) continue
    const key = `${src}->${tgt}`
    let edge = edgeByKey.get(key)
    if (!edge) {
      edge = {
        id: `edge-${src}-${tgt}`,
        source: `system-${src}`,
        target: `system-${tgt}`,
        type: 'dataFlow',
        data: { label: '', dataElements: [], direction: 'forward' },
      }
      edgeByKey.set(key, edge)
      contexts.set(key, new Set())
    }
    if (it.direction === 'bidirectional') edge.data!.direction = 'bidirectional'
    if (it.l3) contexts.get(key)!.add(it.l3)
    const meta = [it.integrationPattern, it.frequency, it.trigger].filter(Boolean).join(' · ')
    const list = edge.data!.dataElements
    for (const obj of it.dataObjects || []) {
      const name = (obj.name || '').trim()
      if (!name) continue
      if (list.some(d => d.name.trim().toLowerCase() === name.toLowerCase())) continue
      const desc = [obj.description, meta].filter(Boolean).join(' — ')
      const de: DataElement = {
        id: `de-${key}-${slug(name)}`,
        name,
        elementType: coerceElementType(obj.elementType),
        ...(desc ? { description: desc } : {}),
        ...(it.l3 ? { processContext: it.l3 } : {}),
      }
      list.push(de)
    }
  }

  const edges: DataFlowEdge[] = []
  // Deterministic edge order: by source then target systemType.
  for (const key of [...edgeByKey.keys()].sort()) {
    const edge = edgeByKey.get(key)!
    const list = edge.data!.dataElements
    const ctx = [...(contexts.get(key) || [])].sort()
    if (ctx.length) edge.data!.processContext = ctx.join(', ')
    edge.data!.label = list.length === 1 ? list[0].name : `${list.length} data objects`
    edges.push(edge)
  }

  return { nodes, edges, groups, systemCount: nodes.length }
}
