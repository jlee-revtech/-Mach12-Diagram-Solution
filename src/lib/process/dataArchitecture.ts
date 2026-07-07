import { v4 as uuid } from 'uuid'
import type { ProcessGraph } from '@/lib/process/types'
import type { LogicalSystem } from '@/lib/sipoc/types'
import type {
  SystemNode, SystemGroupNode, DataFlowEdge, DataElement, SystemType,
} from '@/lib/diagram/types'
import { SYSTEM_TEMPLATES } from '@/lib/diagram/types'

// ─── Data-architecture synthesis ─────────────────────────────────────────────
// Turns a workstream's L3 process flows + the capabilities assigned to them into
// a data-architecture diagram (systems, data flows carrying data elements, and
// capability grouping bands). The pipeline is HYBRID:
//   1. buildDeterministicArchSpec — a reproducible backbone from the SIPOC
//      capability inputs/outputs (system -> product -> system) and the BPMN
//      swimlane -> system handoffs, grouped by capability.
//   2. (route) an AI pass returns an enriched ArchSpec (same shape).
//   3. mergeArchSpecs — union so the AI can add/rename but never drop the backbone.
//   4. archSpecToCanvas — lays it out into the diagram canvas model with
//      SystemGroup bands per capability grouping.
// Everything here is pure (no I/O, no React) so it runs in the route.

const VALID_SYSTEM_TYPES = new Set<SystemType>(SYSTEM_TEMPLATES.map((t) => t.type))

// ─── Name-based intermediate spec (what the AI also speaks) ──────────────────
export interface ArchSystem { name: string; systemType: SystemType; description?: string }
/** from/to reference system names. */
export interface ArchFlow { from: string; to: string; dataElements: string[]; label?: string }
/** systems reference system names. */
export interface ArchGroup { label: string; color?: string; systems: string[] }
export interface ArchSpec {
  systems: ArchSystem[]
  flows: ArchFlow[]
  groups: ArchGroup[]
  title?: string
  description?: string
}

// ─── Resolved input the route assembles ──────────────────────────────────────
export interface ArchCapabilityInput {
  id: string
  name: string
  groupLabel: string          // the L2 grouping name, or the capability itself
  groupColor?: string | null
  homeSystemName?: string | null
  inputs: { product: string; sourceSystems: string[] }[]
  outputs: { product: string; destSystems: string[] }[]
}

export interface ArchBuildInput {
  workstreamName: string
  systems: LogicalSystem[]     // org logical systems (name -> type resolution)
  processes: { id: string; name: string; graph?: ProcessGraph | null }[]
  capabilities: ArchCapabilityInput[]
}

const norm = (s: string) => s.trim().toLowerCase()
const clean = (s: string) => s.trim()

function coerceType(t: string | undefined | null): SystemType {
  const v = (t || '').trim() as SystemType
  return VALID_SYSTEM_TYPES.has(v) ? v : 'custom'
}

// ─── 1. Deterministic backbone ───────────────────────────────────────────────
export function buildDeterministicArchSpec(input: ArchBuildInput): ArchSpec {
  const typeByName = new Map<string, SystemType>()
  for (const s of input.systems) typeByName.set(norm(s.name), (s.system_type as SystemType) ?? 'custom')

  const systems = new Map<string, ArchSystem>()   // norm -> system
  const addSystem = (name?: string | null) => {
    const n = clean(name || '')
    if (!n) return null
    const key = norm(n)
    if (!systems.has(key)) systems.set(key, { name: n, systemType: typeByName.get(key) ?? 'custom' })
    return n
  }

  // Flows coalesced per (from,to).
  const flows = new Map<string, ArchFlow>()
  const addFlow = (from?: string | null, to?: string | null, dataElement?: string) => {
    const f = clean(from || ''), t = clean(to || '')
    if (!f || !t || norm(f) === norm(t)) return
    addSystem(f); addSystem(t)
    const key = `${norm(f)}->${norm(t)}`
    let flow = flows.get(key)
    if (!flow) { flow = { from: f, to: t, dataElements: [] }; flows.set(key, flow) }
    const de = clean(dataElement || '')
    if (de && !flow.dataElements.some((d) => norm(d) === norm(de))) flow.dataElements.push(de)
  }

  // (a) SIPOC capabilities: inputs (source -> home) and outputs (home -> dest),
  //     each carrying the information product as the data element.
  const groupBySystems = new Map<string, { label: string; color?: string; systems: Set<string> }>()
  const groupFor = (label: string, color?: string | null) => {
    const key = norm(label)
    let g = groupBySystems.get(key)
    if (!g) { g = { label: clean(label), ...(color ? { color } : {}), systems: new Set() }; groupBySystems.set(key, g) }
    return g
  }

  for (const cap of input.capabilities) {
    const home = addSystem(cap.homeSystemName)
    const g = groupFor(cap.groupLabel || cap.name, cap.groupColor)
    if (home) g.systems.add(home)
    for (const inp of cap.inputs) {
      for (const src of inp.sourceSystems) {
        const s = addSystem(src)
        if (s) g.systems.add(s)
        if (home) addFlow(src, home, inp.product)
      }
    }
    for (const out of cap.outputs) {
      for (const dst of out.destSystems) {
        const d = addSystem(dst)
        if (d) g.systems.add(d)
        if (home) addFlow(home, dst, out.product)
      }
    }
  }

  // (b) BPMN swimlane -> system handoffs across every process flow.
  for (const proc of input.processes) {
    const g = proc.graph
    if (!g?.lanes?.length) continue
    const laneById = new Map(g.lanes.map((l) => [l.id, l]))
    const sysById = new Map(input.systems.map((s) => [s.id, s]))
    const elementLane = new Map<string, string | undefined>()
    const elementLabel = new Map<string, string>()
    for (const n of g.nodes) {
      const d = n.data as Record<string, unknown> | undefined
      elementLane.set(n.id, d?.laneId as string | undefined)
      elementLabel.set(n.id, (d?.label as string) || 'Step')
    }
    const laneSystemName = (laneId?: string): string | null => {
      if (!laneId) return null
      const lane = laneById.get(laneId)
      if (!lane?.systemId) return null
      return sysById.get(lane.systemId)?.name ?? null
    }
    for (const e of g.edges) {
      const src = laneSystemName(elementLane.get(e.source as string))
      const tgt = laneSystemName(elementLane.get(e.target as string))
      if (!src || !tgt) continue
      addFlow(src, tgt, elementLabel.get(e.target as string) || 'Handoff')
    }
  }

  const flowList = Array.from(flows.values()).map((f) => ({
    ...f,
    label: f.dataElements.length === 1 ? f.dataElements[0] : '',
  }))

  const groups: ArchGroup[] = Array.from(groupBySystems.values())
    .filter((g) => g.systems.size > 0)
    .map((g) => ({ label: g.label, ...(g.color ? { color: g.color } : {}), systems: Array.from(g.systems) }))

  return {
    systems: Array.from(systems.values()),
    flows: flowList,
    groups,
    title: `${input.workstreamName} — Data Architecture`,
  }
}

// ─── 2/3. Merge the AI enrichment onto the deterministic backbone ─────────────
// Union everything so the AI can add systems/flows, name data elements, and refine
// groupings, but can never drop the reproducible backbone.
export function mergeArchSpecs(base: ArchSpec, ai: Partial<ArchSpec> | null | undefined): ArchSpec {
  if (!ai) return base
  const systems = new Map<string, ArchSystem>()
  for (const s of base.systems) systems.set(norm(s.name), s)
  for (const s of ai.systems ?? []) {
    const n = clean(s.name || '')
    if (!n) continue
    const key = norm(n)
    if (!systems.has(key)) systems.set(key, { name: n, systemType: coerceType(s.systemType), ...(s.description ? { description: clean(s.description) } : {}) })
    else if (s.description && !systems.get(key)!.description) systems.get(key)!.description = clean(s.description)
  }

  const flows = new Map<string, ArchFlow>()
  const putFlow = (f: ArchFlow) => {
    const from = clean(f.from || ''), to = clean(f.to || '')
    if (!from || !to || norm(from) === norm(to)) return
    const key = `${norm(from)}->${norm(to)}`
    let flow = flows.get(key)
    if (!flow) { flow = { from, to, dataElements: [] }; flows.set(key, flow) }
    for (const de of f.dataElements ?? []) {
      const d = clean(de)
      if (d && !flow.dataElements.some((x) => norm(x) === norm(d))) flow.dataElements.push(d)
    }
  }
  for (const f of base.flows) putFlow(f)
  for (const f of ai.flows ?? []) putFlow(f)

  const groups = new Map<string, ArchGroup>()
  const putGroup = (g: ArchGroup) => {
    const label = clean(g.label || '')
    if (!label) return
    const key = norm(label)
    let grp = groups.get(key)
    if (!grp) { grp = { label, ...(g.color ? { color: g.color } : {}), systems: [] }; groups.set(key, grp) }
    for (const s of g.systems ?? []) {
      const n = clean(s)
      if (n && !grp.systems.some((x) => norm(x) === norm(n))) grp.systems.push(n)
    }
  }
  for (const g of base.groups) putGroup(g)
  for (const g of ai.groups ?? []) putGroup(g)

  return {
    systems: Array.from(systems.values()),
    flows: Array.from(flows.values()).map((f) => ({ ...f, label: f.label || (f.dataElements.length === 1 ? f.dataElements[0] : '') })),
    groups: Array.from(groups.values()),
    title: clean(ai.title || '') || base.title,
    description: clean(ai.description || '') || base.description,
  }
}

// ─── 4. Layout: spec -> diagram canvas model ─────────────────────────────────
const SYSTEM_W = 190
const SYSTEM_H = 84
const SYS_GAP_X = 90
const SYS_GAP_Y = 60
const MAX_PER_ROW = 4
const BAND_X = 60
const BAND_TOP = 60
const BAND_PAD_X = 40
const BAND_PAD_TOP = 56
const BAND_PAD_BOTTOM = 30
const BAND_GAP_Y = 60
const GROUP_COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#F43F5E', '#14B8A6']

export interface ArchCanvas {
  nodes: (SystemNode | SystemGroupNode)[]
  edges: DataFlowEdge[]
  groups: SystemGroupNode[]
}

export function archSpecToCanvas(spec: ArchSpec): ArchCanvas {
  const systemByName = new Map<string, ArchSystem>()
  for (const s of spec.systems) systemByName.set(norm(s.name), s)

  // Assign each system to the first group that references it; leftovers form a
  // trailing "Shared systems" band.
  const placed = new Set<string>()
  const bands: { label: string; color: string; systems: ArchSystem[] }[] = []
  spec.groups.forEach((g, gi) => {
    const members: ArchSystem[] = []
    for (const name of g.systems) {
      const key = norm(name)
      const sys = systemByName.get(key)
      if (sys && !placed.has(key)) { placed.add(key); members.push(sys) }
    }
    if (members.length) bands.push({ label: g.label, color: g.color || GROUP_COLORS[gi % GROUP_COLORS.length], systems: members })
  })
  const leftovers = spec.systems.filter((s) => !placed.has(norm(s.name)))
  if (leftovers.length) bands.push({ label: 'Shared systems', color: '#64748B', systems: leftovers })

  const systemNodes: SystemNode[] = []
  const groupNodes: SystemGroupNode[] = []
  const nodeIdByName = new Map<string, string>()

  let cursorY = BAND_TOP
  for (const band of bands) {
    const count = band.systems.length
    const perRow = Math.min(MAX_PER_ROW, count)
    const rows = Math.ceil(count / perRow)
    const width = BAND_PAD_X * 2 + perRow * SYSTEM_W + (perRow - 1) * SYS_GAP_X
    const height = BAND_PAD_TOP + rows * SYSTEM_H + (rows - 1) * SYS_GAP_Y + BAND_PAD_BOTTOM

    groupNodes.push({
      id: `group-${uuid()}`,
      type: 'systemGroup',
      position: { x: BAND_X, y: cursorY },
      zIndex: -1,
      style: { width, height, pointerEvents: 'none' as const },
      focusable: false,
      data: { label: band.label, color: band.color },
    })

    band.systems.forEach((sys, i) => {
      const row = Math.floor(i / perRow)
      const col = i % perRow
      const id = `system-${uuid()}`
      nodeIdByName.set(norm(sys.name), id)
      systemNodes.push({
        id,
        type: 'system',
        position: {
          x: BAND_X + BAND_PAD_X + col * (SYSTEM_W + SYS_GAP_X),
          y: cursorY + BAND_PAD_TOP + row * (SYSTEM_H + SYS_GAP_Y),
        },
        data: { label: sys.name, systemType: sys.systemType, ...(sys.description ? { description: sys.description } : {}) },
      })
    })

    cursorY += height + BAND_GAP_Y
  }

  const edges: DataFlowEdge[] = []
  for (const f of spec.flows) {
    const source = nodeIdByName.get(norm(f.from))
    const target = nodeIdByName.get(norm(f.to))
    if (!source || !target || source === target) continue
    const dataElements: DataElement[] = (f.dataElements.length ? f.dataElements : ['Data'])
      .map((name) => ({ id: uuid(), name, elementType: 'document' as const }))
    edges.push({
      id: `edge-${uuid()}`,
      source,
      target,
      type: 'dataFlow',
      data: { label: f.label || (dataElements.length === 1 ? dataElements[0].name : ''), dataElements, direction: 'forward' },
    })
  }

  return { nodes: [...systemNodes], edges, groups: groupNodes }
}

// Sanitize an AI-returned object into a partial ArchSpec (defensive: the tool
// schema enforces shape, but guard types so bad data never crashes the layout).
export function sanitizeAiSpec(raw: unknown): Partial<ArchSpec> | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const systems: ArchSystem[] = Array.isArray(r.systems)
    ? r.systems.map((s) => {
        const o = (s ?? {}) as Record<string, unknown>
        return { name: String(o.name ?? ''), systemType: coerceType(o.systemType as string), ...(o.description ? { description: String(o.description) } : {}) }
      }).filter((s) => s.name.trim())
    : []
  const flows: ArchFlow[] = Array.isArray(r.flows)
    ? r.flows.map((f) => {
        const o = (f ?? {}) as Record<string, unknown>
        return {
          from: String(o.from ?? ''),
          to: String(o.to ?? ''),
          dataElements: Array.isArray(o.dataElements) ? o.dataElements.map(String) : [],
          ...(o.label ? { label: String(o.label) } : {}),
        }
      }).filter((f) => f.from.trim() && f.to.trim())
    : []
  const groups: ArchGroup[] = Array.isArray(r.groups)
    ? r.groups.map((g) => {
        const o = (g ?? {}) as Record<string, unknown>
        return { label: String(o.label ?? ''), ...(o.color ? { color: String(o.color) } : {}), systems: Array.isArray(o.systems) ? o.systems.map(String) : [] }
      }).filter((g) => g.label.trim())
    : []
  return { systems, flows, groups, ...(r.title ? { title: String(r.title) } : {}), ...(r.description ? { description: String(r.description) } : {}) }
}
