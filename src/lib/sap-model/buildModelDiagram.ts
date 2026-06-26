import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { OrgNodeData, SapEnterpriseModel } from './types'
import { ENTITY_META } from './entityMeta'

export type OrgNode = Node<OrgNodeData, 'org'>
export type OrgGraph = { nodes: OrgNode[]; edges: Edge[] }

const NODE_W = 220

// Elbow / orthogonal edges only (never diagonal). One shared edge style.
function edge(source: string, target: string, label?: string, dashed = false): Edge {
  const color = dashed ? '#64748B' : '#5b6b86'
  return {
    id: `${source}__${target}`,
    source,
    target,
    type: 'smoothstep',
    label,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
    style: { stroke: color, strokeWidth: 1.4, strokeDasharray: dashed ? '5 4' : undefined },
    labelStyle: { fill: 'var(--m12-text-muted)', fontSize: 9, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' },
    labelBgStyle: { fill: 'var(--m12-bg-card)', fillOpacity: 0.92 },
    labelBgPadding: [4, 2],
    labelBgBorderRadius: 4,
  }
}

// ── Estimated node height (for overlap-free rank spacing) ──
function estHeight(d: OrgNodeData): number {
  let h = 58
  if (d.subtitle) h += 14
  if (d.meta) h += d.meta.length * 14
  if (d.badge) h += 4
  return h
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA VIEW — one node per org-structure entity TYPE, real counts, edges
// labeled by the SAP config object that wires each assignment.
// ─────────────────────────────────────────────────────────────────────────────
export function buildSchemaGraph(m: SapEnterpriseModel): OrgGraph {
  const totalSloc = m.plants.reduce((n, p) => n + p.storageLocations.length, 0)
  const wbsTotal = m.raByCompanyCode.reduce((n, r) => n + r.count, 0)

  const N = (id: string, data: OrgNodeData, x: number, y: number): OrgNode => ({
    id, type: 'org', position: { x, y }, data, width: NODE_W,
  })

  const nodes: OrgNode[] = [
    N('s_ca', { kind: 'controlling_area', code: m.controllingArea.kokrs, title: m.controllingArea.name,
      subtitle: `${m.controllingArea.currency} · chart ${m.controllingArea.chart}`, badge: '1 area' }, 420, 0),

    N('s_cc', { kind: 'company_code', code: `${m.companyCodes.length}`, title: 'Company Codes',
      subtitle: 'legal / financial entity', meta: m.companyCodes.map(c => `${c.bukrs} · ${c.currency}`) }, 780, 200),
    N('s_pc', { kind: 'profit_center', code: `${m.profitCenters.total}`, title: 'Profit Centers',
      subtitle: 'CO-area scoped', badge: 'CEPC_BUKRS' }, 40, 200),
    N('s_ks', { kind: 'cost_center', code: `${m.costCenters.total}`, title: 'Cost Centers',
      subtitle: 'carries CC + profit center', badge: 'CSKS' }, 290, 200),
    N('s_ba', { kind: 'business_area', code: m.businessAreas[0]?.gsber ?? '—', title: 'Business Area',
      subtitle: 'client-wide (cross-company)', badge: m.businessAreas.every(b => !b.used) ? 'configured · unused' : 'in use' }, 540, 200),

    N('s_pl', { kind: 'plant', code: `${m.plants.length}`, title: 'Plants',
      subtitle: 'logistics / valuation', badge: 'T001K' }, 470, 420),
    N('s_vk', { kind: 'sales_org', code: `${m.salesOrgs.length}`, title: 'Sales Orgs', badge: 'TVKO' }, 700, 420),
    N('s_ek', { kind: 'purchasing_org', code: `${m.purchasingOrgs.length}`, title: 'Purchasing Orgs', badge: 'T024E' }, 930, 420),
    N('s_wbs', { kind: 'wbs_ra', code: `${wbsTotal}`, title: 'Projects / WBS (RA)',
      subtitle: `${m.raProjects.length} projects`, badge: 'PRPS-ABGSL' }, 1160, 420),

    N('s_sl', { kind: 'storage_location', code: `${totalSloc}`, title: 'Storage Locations', badge: 'T001L' }, 470, 620),
  ]

  const edges: Edge[] = [
    edge('s_ca', 's_cc', 'TKA02'),
    edge('s_ca', 's_pc', 'CEPC'),
    edge('s_ca', 's_ks', 'CSKS'),
    edge('s_ca', 's_ba', 'TGSB'),
    edge('s_cc', 's_pl', 'T001K'),
    edge('s_cc', 's_vk', 'TVKO'),
    edge('s_cc', 's_ek', 'T024E'),
    edge('s_cc', 's_wbs', 'PROJ / PRPS'),
    edge('s_pl', 's_sl', 'T001L'),
    // cross-assignment (dashed = "carries", not a hierarchy edge)
    edge('s_ks', 's_pc', 'carries', true),
    edge('s_wbs', 's_pc', 'settles to', true),
    edge('s_pl', 's_ek', 'T024W', true),
  ]

  return { nodes, edges }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCE VIEW — the real A000 tree: controlling area → company codes →
// plants / storage locations / sales orgs / purchasing orgs / RA-keyed WBS.
// ─────────────────────────────────────────────────────────────────────────────
type Tree = { id: string; data: OrgNodeData; children: Tree[] }

export function buildInstanceGraph(m: SapEnterpriseModel): OrgGraph {
  const salesByCode = new Map(m.salesOrgs.map(s => [s.vkorg, s]))
  const purchByCode = new Map(m.purchasingOrgs.map(p => [p.ekorg, p]))
  const raByCc = new Map(m.raByCompanyCode.map(r => [r.bukrs, r]))

  const root: Tree = {
    id: 't_ca',
    data: { kind: 'controlling_area', code: m.controllingArea.kokrs, title: m.controllingArea.name,
      subtitle: `${m.controllingArea.currency} · chart ${m.controllingArea.chart} · FY ${m.controllingArea.fiscalVar}` },
    children: [],
  }

  for (const cc of m.companyCodes) {
    const ccNode: Tree = {
      id: `t_cc_${cc.bukrs}`,
      data: { kind: 'company_code', code: cc.bukrs, title: cc.name,
        subtitle: `${cc.country} · ${cc.currency} · ${cc.chart}`,
        meta: [`${cc.profitCenterCount} PC · ${cc.costCenterCount} cost ctr`] },
      children: [],
    }

    // plants (with storage-location children)
    for (const p of m.plants.filter(x => x.bukrs === cc.bukrs)) {
      const plantNode: Tree = {
        id: `t_pl_${p.werks}`,
        data: { kind: 'plant', code: p.werks, title: p.name },
        children: [],
      }
      if (p.storageLocations.length) {
        const shown = p.storageLocations.slice(0, 6)
        const extra = p.storageLocations.length - shown.length
        plantNode.children.push({
          id: `t_sl_${p.werks}`,
          data: { kind: 'storage_location', code: `${p.storageLocations.length}`, title: 'Storage locations',
            meta: [shown.join(', ') + (extra > 0 ? ` +${extra}` : '')] },
          children: [],
        })
      }
      ccNode.children.push(plantNode)
    }

    // sales orgs
    for (const code of cc.salesOrgs) {
      const so = salesByCode.get(code)
      ccNode.children.push({ id: `t_vk_${cc.bukrs}_${code}`,
        data: { kind: 'sales_org', code, title: so?.name ?? 'Sales org' }, children: [] })
    }

    // purchasing orgs
    for (const code of cc.purchasingOrgs) {
      const po = purchByCode.get(code)
      ccNode.children.push({ id: `t_ek_${cc.bukrs}_${code}`,
        data: { kind: 'purchasing_org', code, title: po?.name ?? 'Purch. org',
          subtitle: po?.plants.length ? `plants ${po.plants.join(', ')}` : undefined }, children: [] })
    }

    // RA-keyed WBS rollup for this company code
    const ra = raByCc.get(cc.bukrs)
    if (ra) {
      const keys = Object.entries(ra.keys).map(([k, n]) => `${k}×${n}`).join('  ')
      const levels = Object.entries(ra.levels).sort().map(([l, n]) => `${l}:${n}`).join('  ')
      ccNode.children.push({
        id: `t_wbs_${cc.bukrs}`,
        data: { kind: 'wbs_ra', code: `${ra.count} WBS`, title: 'Projects / WBS (RA)',
          subtitle: 'PRPS-ABGSL set', meta: [`keys ${keys}`, `levels ${levels}`] },
        children: [],
      })
    }

    root.children.push(ccNode)
  }

  // CO-area-wide controlling objects (shared across all company codes)
  root.children.push({
    id: 't_pc',
    data: { kind: 'profit_center', code: `${m.profitCenters.total}`, title: 'Profit Centers',
      subtitle: 'CEPC · assigned via CEPC_BUKRS',
      meta: m.companyCodes.map((c) => `${c.bukrs}: ${m.profitCenters.byCompanyCode[c.bukrs] ?? 0}`) },
    children: [],
  })
  root.children.push({
    id: 't_ks',
    data: { kind: 'cost_center', code: `${m.costCenters.total}`, title: 'Cost Centers',
      subtitle: 'CSKS · per company code',
      meta: m.companyCodes.map((c) => `${c.bukrs}: ${m.costCenters.byCompanyCode[c.bukrs] ?? 0}`) },
    children: [],
  })
  const ba0 = m.businessAreas[0]
  if (ba0) {
    root.children.push({
      id: 't_ba',
      data: { kind: 'business_area', code: ba0.gsber, title: ba0.name,
        subtitle: 'client-wide (cross-company)', badge: ba0.used ? 'in use' : 'configured · unused' },
      children: [],
    })
  }

  // ── tidy layered layout (overlap-free): leaf-packed x, depth-banded y ──
  const SLOT = 248
  const V_GAP = 70
  const ranksH: number[] = []
  ;(function scan(n: Tree, d: number) {
    ranksH[d] = Math.max(ranksH[d] ?? 0, estHeight(n.data))
    n.children.forEach((c) => scan(c, d + 1))
  })(root, 0)
  const rankY: number[] = []
  let acc = 0
  for (let d = 0; d < ranksH.length; d++) { rankY[d] = acc; acc += ranksH[d] + V_GAP }

  const pos = new Map<string, { x: number; y: number }>()
  let leaf = 0
  ;(function place(n: Tree, d: number): number {
    let x: number
    if (n.children.length === 0) { x = leaf * SLOT; leaf++ }
    else {
      const xs = n.children.map((c) => place(c, d + 1))
      x = (Math.min(...xs) + Math.max(...xs)) / 2
    }
    pos.set(n.id, { x, y: rankY[d] })
    return x
  })(root, 0)

  const nodes: OrgNode[] = []
  const edges: Edge[] = []
  ;(function emit(n: Tree, parent?: string) {
    const p = pos.get(n.id)!
    nodes.push({ id: n.id, type: 'org', position: p, data: n.data, width: NODE_W })
    if (parent) edges.push(edge(parent, n.id))
    n.children.forEach((c) => emit(c, n.id))
  })(root)

  return { nodes, edges }
}

export { ENTITY_META }
