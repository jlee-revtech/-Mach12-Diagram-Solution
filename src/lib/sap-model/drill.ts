import type { DrillData, DrillGroup, SapEnterpriseModel } from './types'

// Builders that turn an aggregate count into the actual list of values behind it.
// Pass a company code (or plant) to scope to one parent; omit for the full set
// grouped by company code / plant.

export function drillCompanyCodes(m: SapEnterpriseModel): DrillData {
  return {
    kind: 'company_code',
    title: 'Company Codes',
    subtitle: `assigned to controlling area ${m.controllingArea.kokrs} via TKA02`,
    count: m.companyCodes.length,
    items: m.companyCodes.map((c) => ({ code: c.bukrs, label: c.name, meta: `${c.country} · ${c.currency} · ${c.chart}` })),
  }
}

export function drillProfitCenters(m: SapEnterpriseModel, cc?: string): DrillData {
  if (cc) {
    const list = m.profitCentersByCompanyCode[cc] ?? []
    return { kind: 'profit_center', title: 'Profit Centers', subtitle: `company code ${cc} · CEPC_BUKRS`, count: list.length,
      items: list.map((p) => ({ code: p.prctr, label: p.name })) }
  }
  const groups: DrillGroup[] = m.companyCodes
    .map((c) => ({ name: `CC ${c.bukrs}`, caption: c.name, items: (m.profitCentersByCompanyCode[c.bukrs] ?? []).map((p) => ({ code: p.prctr, label: p.name })) }))
    .filter((g) => g.items.length)
  return { kind: 'profit_center', title: 'Profit Centers', subtitle: 'CEPC · assigned to company codes via CEPC_BUKRS', count: m.profitCenters.total, groups }
}

export function drillCostCenters(m: SapEnterpriseModel, cc?: string): DrillData {
  if (cc) {
    const list = m.costCentersByCompanyCode[cc] ?? []
    return { kind: 'cost_center', title: 'Cost Centers', subtitle: `company code ${cc} · CSKS`, count: list.length,
      items: list.map((c) => ({ code: c.kostl, label: c.name, meta: `PC ${c.prctr}` })) }
  }
  const groups: DrillGroup[] = m.companyCodes
    .map((c) => ({ name: `CC ${c.bukrs}`, caption: c.name, items: (m.costCentersByCompanyCode[c.bukrs] ?? []).map((x) => ({ code: x.kostl, label: x.name, meta: `PC ${x.prctr}` })) }))
    .filter((g) => g.items.length)
  return { kind: 'cost_center', title: 'Cost Centers', subtitle: 'CSKS · each carries a company code + profit center', count: m.costCenters.total, groups }
}

export function drillStorageLocations(m: SapEnterpriseModel, werks?: string): DrillData {
  if (werks) {
    const p = m.plants.find((x) => x.werks === werks)
    const list = p?.storageLocations ?? []
    return { kind: 'storage_location', title: 'Storage Locations', subtitle: `plant ${werks}${p ? ` · ${p.name}` : ''} · T001L`, count: list.length,
      items: list.map((l) => ({ code: l })) }
  }
  const groups: DrillGroup[] = m.plants.filter((p) => p.storageLocations.length)
    .map((p) => ({ name: `Plant ${p.werks}`, caption: p.name, items: p.storageLocations.map((l) => ({ code: l })) }))
  const total = m.plants.reduce((n, p) => n + p.storageLocations.length, 0)
  return { kind: 'storage_location', title: 'Storage Locations', subtitle: 'T001L · inventory sub-locations within a plant', count: total, groups }
}

export function drillPlants(m: SapEnterpriseModel, cc?: string): DrillData {
  const list = cc ? m.plants.filter((p) => p.bukrs === cc) : m.plants
  return { kind: 'plant', title: 'Plants', subtitle: cc ? `company code ${cc} · T001K` : 'T001K · valuation area → company code', count: list.length,
    items: list.map((p) => ({ code: p.werks, label: p.name, meta: `CC ${p.bukrs} · ${p.storageLocations.length} sloc` })) }
}

export function drillSalesOrgs(m: SapEnterpriseModel, cc?: string): DrillData {
  const list = cc ? m.salesOrgs.filter((s) => s.bukrs === cc) : m.salesOrgs
  return { kind: 'sales_org', title: 'Sales Organizations', subtitle: 'TVKO · one company code each', count: list.length,
    items: list.map((s) => ({ code: s.vkorg, label: s.name, meta: `CC ${s.bukrs}` })) }
}

export function drillPurchOrgs(m: SapEnterpriseModel, cc?: string): DrillData {
  const list = cc ? m.purchasingOrgs.filter((p) => p.bukrs === cc) : m.purchasingOrgs
  return { kind: 'purchasing_org', title: 'Purchasing Organizations', subtitle: 'T024E (+ T024W plant assignment)', count: list.length,
    items: list.map((p) => ({ code: p.ekorg, label: p.name, meta: p.plants.length ? `plants ${p.plants.join(', ')}` : `CC ${p.bukrs}` })) }
}

export function drillBusinessAreas(m: SapEnterpriseModel): DrillData {
  return { kind: 'business_area', title: 'Business Areas', subtitle: 'TGSB · client-wide (cross-company)', count: m.businessAreas.length,
    items: m.businessAreas.map((b) => ({ code: b.gsber, label: b.name, meta: b.used ? 'in use' : 'configured · unused' })) }
}

export function drillWbs(m: SapEnterpriseModel, cc?: string): DrillData {
  if (cc) {
    const list = m.wbsRa.filter((w) => w.bukrs === cc)
    return { kind: 'wbs_ra', title: 'RA-keyed WBS elements', subtitle: `company code ${cc} · PRPS-ABGSL`, count: list.length,
      items: list.map((w) => ({ code: w.posid, label: w.name, meta: `L${w.level} · ${w.raKey}` })) }
  }
  const groups: DrillGroup[] = m.companyCodes
    .map((c) => ({ name: `CC ${c.bukrs}`, caption: c.name, items: m.wbsRa.filter((w) => w.bukrs === c.bukrs).map((w) => ({ code: w.posid, label: w.name, meta: `L${w.level} · ${w.raKey}` })) }))
    .filter((g) => g.items.length)
  return { kind: 'wbs_ra', title: 'RA-keyed WBS elements', subtitle: 'PRPS-ABGSL · revenue-recognition level', count: m.wbsRa.length, groups }
}
