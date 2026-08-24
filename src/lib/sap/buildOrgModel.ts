// Turn a raw dump into the SapEnterpriseModel the canvas already renders.
//
// This is scripts/gen-sap-model-data.mjs ported to run at request time against
// any controlling area, rather than offline against a hardcoded A000. The
// aggregation is deliberately identical so a live pull and the committed
// snapshot are directly comparable.
//
// One fix carried over in passing: the offline script refreshed assignment
// counts from a lookup keyed by relationship label, and four of its keys did not
// match the labels actually in the data ("Company Code -> Profit Center" vs
// "Controlling Area -> Profit Center", and so on), so those rows silently kept
// whatever count was there before. Counts are attached to the catalog directly
// here, so every row is live.

import type {
  DrillTreeNode, PurchasingOrg, SapEnterpriseModel,
} from '@/lib/sap-model/types'
import type { RawDump, RawHierarchy } from './orgModelRaw'

/**
 * Curated labels for the RA keys seen on the reference system. Anything else
 * gets an honest generic label rather than an invented description.
 */
const RA_KEY_LABELS: Record<string, string> = {
  Y00001: 'Customer RA key (chart YCOA) - primary revenue-recognition key',
  '000001': 'SAP standard Results Analysis key',
  YM1205: 'Customer RA key (chart YCOA) - Performance Obligation (POB) revenue recognition',
  Y00005: 'Customer RA key (chart YCOA) - MRO / settlement scenarios',
}

/** The assignment catalog: how each org relationship is configured in SAP. */
const ASSIGNMENT_CATALOG: { relationship: string; via: string; note: string }[] = [
  { relationship: 'Controlling Area → Company Code', via: 'TKA02 (assign company code to controlling area)', note: '1:N — one CO area spans many company codes; FI/CO integration on (TKA01-KOKFI)' },
  { relationship: 'Company Code → Plant', via: 'T001K (valuation area) → T001W', note: 'Plant assigned to company code through its valuation area' },
  { relationship: 'Plant → Storage Location', via: 'T001L', note: 'Inventory-managing sub-locations within a plant' },
  { relationship: 'Company Code → Sales Organization', via: 'TVKO', note: 'Each sales org posts to exactly one company code' },
  { relationship: 'Company Code → Purchasing Organization', via: 'T024E (+ T024W plant assignment)', note: 'Purch. org can be company-code-specific or cross-company' },
  { relationship: 'Controlling Area → Profit Center', via: 'CEPC / CEPC_BUKRS (company-code assignment)', note: 'Profit centers live at CO-area level, assigned to company codes' },
  { relationship: 'Controlling Area → Cost Center', via: 'CSKS (carries BUKRS + PRCTR)', note: 'Each cost center ties to one company code and one profit center' },
  { relationship: 'Controlling Area → Business Area', via: 'TGSB (global, cross-company)', note: 'Business areas are client-wide, not company-code-scoped' },
  { relationship: 'Company Code → Project / WBS', via: 'PROJ-VBUKR / PRPS-PBUKR', note: 'Projects carrying RA-keyed WBS in this controlling area' },
  { relationship: 'WBS → Revenue Recognition (RA)', via: 'PRPS-ABGSL (Results Analysis key)', note: 'RA key set on the WBS element marks the revenue-recognition / results-analysis level' },
]

export interface BuildContext {
  systemLabel: string
  sapClient: string
  controllingArea: string
  pulledVia: 'freestyle' | 'classrun'
  pulledOn: string
}

/** Controlling areas a dump saw, ranked so the busiest is the sensible default. */
export function listControllingAreas(raw: RawDump): { kokrs: string; name: string; companyCodes: number }[] {
  const counts = new Map<string, number>()
  for (const r of raw.coarea_cocode) counts.set(r.kokrs, (counts.get(r.kokrs) ?? 0) + 1)
  return raw.controlling_areas
    .map((c) => ({ kokrs: c.kokrs, name: c.name, companyCodes: counts.get(c.kokrs) ?? 0 }))
    .sort((a, b) => b.companyCodes - a.companyCodes || a.kokrs.localeCompare(b.kokrs))
}

export function buildOrgModel(
  raw: RawDump,
  hierarchy: RawHierarchy | null,
  ctx: BuildContext
): SapEnterpriseModel {
  const kokrs = ctx.controllingArea

  // ── Scope everything to the chosen controlling area ────────────────────────
  const ccSet = new Set(raw.coarea_cocode.filter((r) => r.kokrs === kokrs).map((r) => r.bukrs))
  const co = raw.controlling_areas.find((c) => c.kokrs === kokrs)

  const plants = raw.plants.filter((p) => ccSet.has(p.bukrs))
  const plantSet = new Set(plants.map((p) => p.werks))

  const slocByPlant = new Map<string, string[]>()
  for (const sl of raw.storage_locations) {
    if (!plantSet.has(sl.werks)) continue
    const list = slocByPlant.get(sl.werks) ?? []
    list.push(sl.lgort)
    slocByPlant.set(sl.werks, list)
  }
  for (const v of slocByPlant.values()) v.sort()

  const pcAssign = raw.profit_center_cocode.filter((r) => r.kokrs === kokrs && ccSet.has(r.bukrs))
  const pcInArea = raw.profit_centers.filter((p) => p.kokrs === kokrs)
  const pcName = new Map(pcInArea.map((p) => [p.prctr, p.name]))
  const ccInArea = raw.cost_centers.filter((c) => c.kokrs === kokrs && ccSet.has(c.bukrs))
  const salesOrgs = raw.sales_orgs.filter((s) => ccSet.has(s.bukrs))

  const purchPlants = new Map<string, string[]>()
  for (const r of raw.purchorg_plant) {
    if (!r.ekorg) continue
    const list = purchPlants.get(r.ekorg) ?? []
    list.push(r.werks)
    purchPlants.set(r.ekorg, list)
  }
  const purchasingOrgs: PurchasingOrg[] = raw.purchasing_orgs
    .filter((p) => ccSet.has(p.bukrs) || (purchPlants.get(p.ekorg) ?? []).some((w) => plantSet.has(w)))
    .map((p) => ({
      ekorg: p.ekorg, name: p.name, bukrs: p.bukrs,
      plants: [...(purchPlants.get(p.ekorg) ?? [])].sort(),
    }))

  // The dump filters WBS on an RA key already; scope to the CO area's companies.
  const wbsRa = raw.wbs_ra.filter((w) => (!w.kokrs || w.kokrs === kokrs) && ccSet.has(w.bukrs))

  // ── Per-company-code counts ────────────────────────────────────────────────
  const countBy = <T,>(rows: T[], key: (r: T) => string): Record<string, number> => {
    const m: Record<string, number> = {}
    for (const r of rows) {
      const k = key(r)
      m[k] = (m[k] ?? 0) + 1
    }
    return m
  }
  const pcCountByCC = countBy(pcAssign, (r) => r.bukrs)
  const ccCountByCC = countBy(ccInArea, (r) => r.bukrs)
  const plantCountByCC = countBy(plants, (r) => r.bukrs)
  const wbsCountByCC = countBy(wbsRa, (r) => r.bukrs)

  const companyCodes = raw.company_codes
    .filter((c) => ccSet.has(c.bukrs))
    .map((c) => ({
      bukrs: c.bukrs,
      name: c.name,
      country: c.country,
      currency: c.currency,
      chart: c.chart,
      plantCount: plantCountByCC[c.bukrs] ?? 0,
      profitCenterCount: pcCountByCC[c.bukrs] ?? 0,
      costCenterCount: ccCountByCC[c.bukrs] ?? 0,
      wbsRaCount: wbsCountByCC[c.bukrs] ?? 0,
      salesOrgs: salesOrgs.filter((s) => s.bukrs === c.bukrs).map((s) => s.vkorg).sort(),
      purchasingOrgs: purchasingOrgs.filter((p) => p.bukrs === c.bukrs).map((p) => p.ekorg).sort(),
    }))
    .sort((a, b) => b.wbsRaCount - a.wbsRaCount || a.bukrs.localeCompare(b.bukrs))

  // ── Results Analysis rollups ───────────────────────────────────────────────
  const raKeyAgg = new Map<string, { key: string; count: number; levels: Record<string, number> }>()
  for (const w of wbsRa) {
    const a = raKeyAgg.get(w.ra_key) ?? { key: w.ra_key, count: 0, levels: {} }
    a.count += 1
    a.levels[w.level] = (a.levels[w.level] ?? 0) + 1
    raKeyAgg.set(w.ra_key, a)
  }
  const raKeys = [...raKeyAgg.values()]
    .sort((a, b) => b.count - a.count)
    .map((a) => ({ ...a, label: RA_KEY_LABELS[a.key] ?? `RA key ${a.key}` }))

  const raCCAgg = new Map<string, { bukrs: string; count: number; keys: Record<string, number>; levels: Record<string, number> }>()
  for (const w of wbsRa) {
    const a = raCCAgg.get(w.bukrs) ?? { bukrs: w.bukrs, count: 0, keys: {}, levels: {} }
    a.count += 1
    a.keys[w.ra_key] = (a.keys[w.ra_key] ?? 0) + 1
    a.levels[`L${w.level}`] = (a.levels[`L${w.level}`] ?? 0) + 1
    raCCAgg.set(w.bukrs, a)
  }
  const raByCompanyCode = [...raCCAgg.values()].sort((a, b) => b.count - a.count)

  const raProjAgg = new Map<string, { project: string; name: string; bukrs: string; wbsCount: number; keys: Set<string> }>()
  for (const w of wbsRa) {
    const k = w.project || w.posid
    const a = raProjAgg.get(k) ?? {
      project: k, name: w.project_name || w.name, bukrs: w.bukrs, wbsCount: 0, keys: new Set<string>(),
    }
    a.wbsCount += 1
    a.keys.add(w.ra_key)
    raProjAgg.set(k, a)
  }
  const raProjects = [...raProjAgg.values()]
    .map((a) => ({ project: a.project, name: a.name, bukrs: a.bukrs, wbsCount: a.wbsCount, keys: [...a.keys].sort() }))
    .sort((a, b) => b.wbsCount - a.wbsCount)

  // ── Assignment counts, keyed off the catalog so none can drift ─────────────
  const slocTotal = [...slocByPlant.values()].reduce((n, v) => n + v.length, 0)
  const purchPlantTotal = purchasingOrgs.reduce(
    (n, p) => n + p.plants.filter((w) => plantSet.has(w)).length, 0
  )
  const counts: Record<string, number> = {
    'Controlling Area → Company Code': ccSet.size,
    'Company Code → Plant': plants.length,
    'Plant → Storage Location': slocTotal,
    'Company Code → Sales Organization': salesOrgs.length,
    'Company Code → Purchasing Organization': purchasingOrgs.length,
    'Controlling Area → Profit Center': pcAssign.length,
    'Controlling Area → Cost Center': ccInArea.length,
    // Business areas are client-wide, as the row's own note says, so this counts
    // how many are DEFINED. Whether each is actually used is the `used` flag on
    // the entity itself, not this number.
    'Controlling Area → Business Area': raw.business_areas.length,
    'Company Code → Project / WBS': raProjects.length,
    'WBS → Revenue Recognition (RA)': wbsRa.length,
  }
  const assignments = ASSIGNMENT_CATALOG.map((a) => ({ ...a, count: counts[a.relationship] ?? 0 }))

  // ── Drill lists ────────────────────────────────────────────────────────────
  const profitCentersByCompanyCode: Record<string, { prctr: string; name: string }[]> = {}
  for (const r of pcAssign) {
    ;(profitCentersByCompanyCode[r.bukrs] ??= []).push({ prctr: r.prctr, name: pcName.get(r.prctr) ?? '' })
  }
  for (const v of Object.values(profitCentersByCompanyCode)) v.sort((a, b) => a.prctr.localeCompare(b.prctr))

  const costCentersByCompanyCode: Record<string, { kostl: string; name: string; prctr: string }[]> = {}
  for (const c of ccInArea) {
    ;(costCentersByCompanyCode[c.bukrs] ??= []).push({ kostl: c.kostl, name: c.name, prctr: c.prctr })
  }
  for (const v of Object.values(costCentersByCompanyCode)) v.sort((a, b) => a.kostl.localeCompare(b.kostl))

  return {
    source: {
      system: ctx.systemLabel,
      client: ctx.sapClient,
      controllingArea: kokrs,
      pulledOn: ctx.pulledOn,
      via: ctx.pulledVia === 'classrun'
        ? 'Live ADT pull → ZCL_M12_ORG_MODEL_DUMP'
        : 'Live ADT pull → data preview (read-only SQL)',
    },
    controllingArea: {
      kokrs,
      name: co?.name ?? kokrs,
      currency: co?.currency ?? '',
      chart: co?.chart ?? '',
      fiscalVar: co?.fiscal_var ?? '',
    },
    companyCodes,
    plants: plants.map((p) => ({
      werks: p.werks, name: p.name, bukrs: p.bukrs,
      storageLocations: slocByPlant.get(p.werks) ?? [],
    })),
    salesOrgs: salesOrgs.map((s) => ({ vkorg: s.vkorg, name: s.name, bukrs: s.bukrs })),
    purchasingOrgs,
    businessAreas: raw.business_areas.map((b) => ({
      gsber: b.gsber, name: b.name, used: ccInArea.some((c) => c.gsber === b.gsber),
    })),
    profitCenters: {
      byCompanyCode: pcCountByCC,
      total: pcInArea.length,
      sample: pcInArea.slice(0, 16).map((p) => ({ prctr: p.prctr, name: p.name })),
    },
    costCenters: {
      byCompanyCode: ccCountByCC,
      total: ccInArea.length,
      sample: ccInArea.slice(0, 13).map((c) => ({ kostl: c.kostl, name: c.name, bukrs: c.bukrs, prctr: c.prctr })),
    },
    raKeys,
    raByCompanyCode,
    raProjects,
    assignments,
    profitCentersByCompanyCode,
    costCentersByCompanyCode,
    wbsRa: wbsRa.map((w) => ({
      posid: w.posid, name: w.name, bukrs: w.bukrs, level: w.level, raKey: w.ra_key, project: w.project,
    })),
    profitCenterHierarchy: buildHierarchy(hierarchy, pcName),
  }
}

/**
 * Fold SETNODE/SETLEAF/SETHEADERT into the drill tree the canvas renders.
 * The root is the group that is never anyone's child; cycles are guarded so a
 * malformed set cannot spin forever.
 */
function buildHierarchy(
  raw: RawHierarchy | null,
  pcName: Map<string, string>
): DrillTreeNode {
  const empty: DrillTreeNode = {
    code: '', label: 'No profit center hierarchy found', kind: 'group', children: [],
  }
  if (!raw || raw.groups.length === 0) return empty

  const text = new Map(raw.groups.map((g) => [g.setname, g.text]))
  const childrenOf = new Map<string, string[]>()
  const isChild = new Set<string>()
  for (const e of raw.edges) {
    const list = childrenOf.get(e.parent) ?? []
    list.push(e.child)
    childrenOf.set(e.parent, list)
    isChild.add(e.child)
  }
  const leavesOf = new Map<string, { from: string; to: string }[]>()
  for (const l of raw.leaves) {
    const list = leavesOf.get(l.setname) ?? []
    list.push({ from: l.from, to: l.to })
    leavesOf.set(l.setname, list)
  }

  // A controlling area routinely has several disconnected roots plus orphan
  // groups that were created and never populated. Ranking by subtree size picks
  // the real standard hierarchy; taking the first row would root the tree at
  // whichever empty group the database happened to return first.
  const size = (name: string, seen: Set<string>): number => {
    if (seen.has(name)) return 0
    const next = new Set(seen).add(name)
    const kids = (childrenOf.get(name) ?? []).reduce((n, c) => n + size(c, next), 0)
    return 1 + kids + (leavesOf.get(name)?.length ?? 0)
  }

  const roots = raw.groups
    .map((g) => g.setname)
    .filter((n) => !isChild.has(n))
    .map((n) => ({ name: n, size: size(n, new Set()) }))
    .sort((a, b) => b.size - a.size)

  const rootName = roots[0]?.name
  if (!rootName) return empty

  const walk = (name: string, seen: Set<string>): DrillTreeNode => {
    const node: DrillTreeNode = {
      code: name,
      label: text.get(name) || name,
      kind: 'group',
      children: [],
    }
    if (seen.has(name)) return node
    const next = new Set(seen).add(name)

    for (const child of childrenOf.get(name) ?? []) {
      node.children!.push(walk(child, next))
    }
    for (const l of leavesOf.get(name) ?? []) {
      node.children!.push(...expandLeaf(l, pcName))
    }
    return node
  }

  const root = walk(rootName, new Set())
  // Other populated roots are legitimate (a separate set per company code, say);
  // hang them off the primary so nothing is silently dropped. Empty orphan
  // groups are left out - they carry no configuration and only add noise.
  for (const extra of roots.slice(1)) {
    if (extra.size > 1) root.children!.push(walk(extra.name, new Set()))
  }
  return root
}

/** A SETLEAF row is a single value or a range; resolve it against real PC names. */
function expandLeaf(
  leaf: { from: string; to: string },
  pcName: Map<string, string>
): DrillTreeNode[] {
  const from = leaf.from.trim()
  const to = (leaf.to || '').trim()

  if (!to || to === from) {
    return [{ code: from, label: pcName.get(from) || undefined, kind: 'leaf' }]
  }
  const inRange = [...pcName.keys()].filter((pc) => pc >= from && pc <= to).sort()
  if (inRange.length > 0) {
    return inRange.map((pc) => ({ code: pc, label: pcName.get(pc) || undefined, kind: 'leaf' }))
  }
  // A range that matches nothing currently active is still real configuration.
  return [{ code: `${from} – ${to}`, kind: 'leaf', meta: 'range (no active profit centers)' }]
}
