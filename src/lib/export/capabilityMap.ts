import * as XLSX from 'xlsx'
import type {
  Capability,
  CapabilityTreeNode,
  HydratedCapability,
  InformationProduct,
  LogicalSystem,
  Persona,
  SystemDataElement,
} from '@/lib/sipoc/types'

function sanitizeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_') || 'capability-map'
}

function boldHeader(ws: XLSX.WorkSheet, rowIdx: number, colCount: number) {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c })
    if (ws[addr]) ws[addr].s = { font: { bold: true } }
  }
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

function joinSemi(values: (string | undefined | null)[]): string {
  return values.filter((v): v is string => !!v && v.length > 0).join('; ')
}

// Short, presentation-friendly workstream label: drop the parenthetical
// qualifier so "Plan-to-Perform (Program & Portfolio Management)" reads as
// "Plan-to-Perform" in a spreadsheet cell.
function workstreamLabel(ws?: { code: string; name: string }): string {
  if (!ws) return ''
  const base = ws.name.split('(')[0].trim()
  return base || ws.name
}

interface CapabilityWithPath {
  cap: Capability
  l1Name: string
  l2Name: string
  l3Name: string
}

// Walk the tree in display order and produce a flat row per capability with
// fully-qualified L1/L2/L3 path.
function flattenTree(tree: CapabilityTreeNode[]): CapabilityWithPath[] {
  const rows: CapabilityWithPath[] = []
  const sortedL1 = [...tree.filter(n => n.level === 1)].sort((a, b) => a.sort_order - b.sort_order)
  for (const l1 of sortedL1) {
    rows.push({ cap: l1, l1Name: l1.name, l2Name: '', l3Name: '' })
    const sortedL2 = [...l1.children].sort((a, b) => a.sort_order - b.sort_order)
    for (const l2 of sortedL2) {
      rows.push({ cap: l2, l1Name: l1.name, l2Name: l2.name, l3Name: '' })
      const sortedL3 = [...l2.children].sort((a, b) => a.sort_order - b.sort_order)
      for (const l3 of sortedL3) {
        rows.push({ cap: l3, l1Name: l1.name, l2Name: l2.name, l3Name: l3.name })
      }
    }
  }
  return rows
}

// Build a map from capability id to its L1/L2/L3 path so any sheet can attach
// hierarchy columns to a SIPOC row.
function buildPathIndex(tree: CapabilityTreeNode[]): Map<string, { l1: string; l2: string; l3: string }> {
  const idx = new Map<string, { l1: string; l2: string; l3: string }>()
  for (const l1 of tree.filter(n => n.level === 1)) {
    idx.set(l1.id, { l1: l1.name, l2: '', l3: '' })
    for (const l2 of l1.children) {
      idx.set(l2.id, { l1: l1.name, l2: l2.name, l3: '' })
      for (const l3 of l2.children) {
        idx.set(l3.id, { l1: l1.name, l2: l2.name, l3: l3.name })
      }
    }
  }
  return idx
}

export function exportCapabilityMapWorkbook(opts: {
  title: string
  tree: CapabilityTreeNode[]
  hydrated: HydratedCapability[]
  informationProducts: InformationProduct[]
  systemDataElements: SystemDataElement[]
  logicalSystems: LogicalSystem[]
  personas: Persona[]
  workstreams?: { id: string; code: string; name: string }[]
}): void {
  const { title, tree, hydrated, informationProducts, systemDataElements, logicalSystems, personas, workstreams = [] } = opts

  const wb = XLSX.utils.book_new()
  const flat = flattenTree(tree)
  const pathIdx = buildPathIndex(tree)
  const sdeMap = new Map(systemDataElements.map(s => [s.id, s]))
  const ipMap = new Map(informationProducts.map(ip => [ip.id, ip]))
  const hydratedById = new Map(hydrated.map(h => [h.id, h]))
  const wsById = new Map(workstreams.map(w => [w.id, w]))
  const wsLabel = (id?: string | null): string => (id ? workstreamLabel(wsById.get(id)) : '')

  const counts = {
    l1: flat.filter(r => r.cap.level === 1).length,
    l2: flat.filter(r => r.cap.level === 2).length,
    l3: flat.filter(r => r.cap.level === 3).length,
  }

  // ── Sheet 1: Summary ──────────────────────────────────────
  const summary: (string | number)[][] = [
    ['Capability Map Export'],
    ['Title', title],
    ['Exported', new Date().toLocaleString()],
    ['Source', 'Mach12.ai'],
    [],
    ['Counts'],
    ['L1 Core Areas', counts.l1],
    ['L2 Capabilities', counts.l2],
    ['L3 Functionalities (SIPOC)', counts.l3],
    ['Information Products', informationProducts.length],
    ['Data Elements', systemDataElements.length],
    ['Logical Systems', logicalSystems.length],
    ['Personas', personas.length],
    [],
    ['Workbook Contents'],
    ['Hierarchy', 'Every capability with its L1 / L2 / L3 path, workstream, system, description, features, use cases'],
    ['SIPOC by IP', 'One row per information product touchpoint (input or output) on every L3'],
    ['Information Products', 'Distinct IPs with their data elements and where they are produced and consumed'],
    ['Data Elements', 'Distinct data elements and which IPs / L3s reference them'],
    ['Use Cases', 'One row per use case across the hierarchy'],
    ['Features', 'One row per feature across the hierarchy'],
    ['Systems', 'Distinct logical systems and where they participate'],
    ['Personas', 'Distinct personas and where they appear as supplier or consumer'],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summary)
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 80 }]
  boldHeader(wsSummary, 0, 2)
  boldHeader(wsSummary, 5, 2)
  boldHeader(wsSummary, 14, 2)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  // ── Sheet 2: Hierarchy ────────────────────────────────────
  const hierarchyRows: (string | number)[][] = [
    ['#', 'L1 Core Area', 'L2 Capability', 'L3 Functionality', 'Level', 'Workstream', 'System', 'Description', 'Features', 'Use Cases', 'Inputs', 'Outputs'],
  ]
  flat.forEach((row, i) => {
    const h = hydratedById.get(row.cap.id)
    hierarchyRows.push([
      i + 1,
      row.l1Name,
      row.l2Name,
      row.l3Name,
      `L${row.cap.level}`,
      wsLabel(row.cap.workstream_id),
      h?.system?.name || '',
      row.cap.description || '',
      (row.cap.features || []).join('; '),
      (row.cap.use_cases || []).join('; '),
      h?.inputs.length ?? 0,
      h?.outputs.length ?? 0,
    ])
  })
  const wsHier = XLSX.utils.aoa_to_sheet(hierarchyRows)
  wsHier['!cols'] = [
    { wch: 5 }, { wch: 28 }, { wch: 28 }, { wch: 32 },
    { wch: 6 }, { wch: 18 }, { wch: 22 }, { wch: 50 }, { wch: 50 }, { wch: 50 },
    { wch: 7 }, { wch: 7 },
  ]
  boldHeader(wsHier, 0, 12)
  wsHier['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, wsHier, 'Hierarchy')

  // ── Sheet 3: SIPOC by IP ──────────────────────────────────
  const sipocRows: (string | number)[][] = [
    ['L1 Core Area', 'L2 Capability', 'L3 Functionality', 'Workstream', 'Side', 'Information Product', 'Category', 'Data Elements', 'IP Tags', 'Personas', 'Source / Destination Systems', 'Feeding System', 'Dimensions', 'Dimension Tags'],
  ]

  const elementsForIP = (ip: InformationProduct | undefined): string => {
    if (!ip || !ip.data_element_ids) return ''
    return joinSemi(ip.data_element_ids.map(id => sdeMap.get(id)?.name || ''))
  }

  hydrated.forEach(h => {
    const path = pathIdx.get(h.id)
    if (!path) return
    h.inputs.forEach(inp => {
      const ip = ipMap.get(inp.information_product_id) || inp.informationProduct
      sipocRows.push([
        path.l1, path.l2, path.l3, wsLabel(h.workstream_id), 'Input',
        inp.informationProduct.name,
        inp.informationProduct.category || '',
        elementsForIP(ip),
        joinSemi((inp.tags || []).map(t => t.name)),
        joinSemi(inp.supplierPersonas.map(p => p.name)),
        joinSemi(inp.sourceSystems.map(s => s.name)),
        inp.feedingSystem?.name || '',
        joinSemi((inp.dimensions || []).map(d => d.name)),
        joinSemi((inp.dimensions || []).flatMap(d => (d.tags || []).map(t => `${d.name}:${t.name}`))),
      ])
    })
    h.outputs.forEach(out => {
      const ip = ipMap.get(out.information_product_id) || out.informationProduct
      sipocRows.push([
        path.l1, path.l2, path.l3, wsLabel(h.workstream_id), 'Output',
        out.informationProduct.name,
        out.informationProduct.category || '',
        elementsForIP(ip),
        joinSemi((out.tags || []).map(t => t.name)),
        joinSemi(out.consumerPersonas.map(p => p.name)),
        joinSemi(out.destinationSystems.map(s => s.name)),
        '',
        joinSemi((out.dimensions || []).map(d => d.name)),
        joinSemi((out.dimensions || []).flatMap(d => (d.tags || []).map(t => `${d.name}:${t.name}`))),
      ])
    })
  })
  const wsSipoc = XLSX.utils.aoa_to_sheet(sipocRows)
  wsSipoc['!cols'] = [
    { wch: 26 }, { wch: 26 }, { wch: 30 }, { wch: 18 }, { wch: 8 },
    { wch: 32 }, { wch: 16 }, { wch: 40 }, { wch: 22 },
    { wch: 32 }, { wch: 32 }, { wch: 22 }, { wch: 36 }, { wch: 36 },
  ]
  boldHeader(wsSipoc, 0, 14)
  wsSipoc['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, wsSipoc, 'SIPOC by IP')

  // ── Sheet 4: Information Products ─────────────────────────
  type IPRollup = {
    ip: InformationProduct
    producingL3s: Set<string>
    consumingL3s: Set<string>
    supplierPersonas: Set<string>
    consumerPersonas: Set<string>
    sourceSystems: Set<string>
    destSystems: Set<string>
    feedingSystems: Set<string>
  }
  const rollup = new Map<string, IPRollup>()
  const ensure = (id: string): IPRollup | null => {
    const ip = ipMap.get(id)
    if (!ip) return null
    let r = rollup.get(id)
    if (!r) {
      r = {
        ip,
        producingL3s: new Set(), consumingL3s: new Set(),
        supplierPersonas: new Set(), consumerPersonas: new Set(),
        sourceSystems: new Set(), destSystems: new Set(), feedingSystems: new Set(),
      }
      rollup.set(id, r)
    }
    return r
  }
  hydrated.forEach(h => {
    const path = pathIdx.get(h.id)
    const l3Label = path && path.l3 ? `${path.l1} / ${path.l2} / ${path.l3}` : h.name
    h.outputs.forEach(out => {
      const r = ensure(out.information_product_id)
      if (!r) return
      r.producingL3s.add(l3Label)
      out.consumerPersonas.forEach(p => r.consumerPersonas.add(p.name))
      out.destinationSystems.forEach(s => r.destSystems.add(s.name))
    })
    h.inputs.forEach(inp => {
      const r = ensure(inp.information_product_id)
      if (!r) return
      r.consumingL3s.add(l3Label)
      inp.supplierPersonas.forEach(p => r.supplierPersonas.add(p.name))
      inp.sourceSystems.forEach(s => r.sourceSystems.add(s.name))
      if (inp.feedingSystem) r.feedingSystems.add(inp.feedingSystem.name)
    })
  })
  // Include IPs that exist in the org but aren't yet referenced.
  informationProducts.forEach(ip => { ensure(ip.id) })

  const ipRows: (string | number)[][] = [
    ['Information Product', 'Category', 'Data Elements', 'Producing L3s', 'Consuming L3s', '# Producers', '# Consumers', 'Supplier Personas', 'Consumer Personas', 'Source Systems', 'Destination Systems', 'Feeding Systems'],
  ]
  Array.from(rollup.values())
    .sort((a, b) => a.ip.name.localeCompare(b.ip.name))
    .forEach(r => {
      ipRows.push([
        r.ip.name,
        r.ip.category || '',
        elementsForIP(r.ip),
        Array.from(r.producingL3s).sort().join(' | '),
        Array.from(r.consumingL3s).sort().join(' | '),
        r.producingL3s.size,
        r.consumingL3s.size,
        Array.from(r.supplierPersonas).sort().join('; '),
        Array.from(r.consumerPersonas).sort().join('; '),
        Array.from(r.sourceSystems).sort().join('; '),
        Array.from(r.destSystems).sort().join('; '),
        Array.from(r.feedingSystems).sort().join('; '),
      ])
    })
  const wsIP = XLSX.utils.aoa_to_sheet(ipRows)
  wsIP['!cols'] = [
    { wch: 32 }, { wch: 16 }, { wch: 40 },
    { wch: 50 }, { wch: 50 }, { wch: 12 }, { wch: 12 },
    { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 24 },
  ]
  boldHeader(wsIP, 0, 12)
  wsIP['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, wsIP, 'Information Products')

  // ── Sheet 5: Data Elements ────────────────────────────────
  // For each SDE, find IPs that reference it, and L3s that touch those IPs.
  const ipsBySde = new Map<string, Set<string>>()
  informationProducts.forEach(ip => {
    (ip.data_element_ids || []).forEach(deId => {
      let s = ipsBySde.get(deId)
      if (!s) { s = new Set(); ipsBySde.set(deId, s) }
      s.add(ip.id)
    })
  })
  const l3sByIp = new Map<string, Set<string>>()
  hydrated.forEach(h => {
    const path = pathIdx.get(h.id)
    const l3Label = path && path.l3 ? `${path.l1} / ${path.l2} / ${path.l3}` : h.name
    const refIps = new Set<string>()
    h.inputs.forEach(i => refIps.add(i.information_product_id))
    h.outputs.forEach(o => refIps.add(o.information_product_id))
    refIps.forEach(ipId => {
      let s = l3sByIp.get(ipId)
      if (!s) { s = new Set(); l3sByIp.set(ipId, s) }
      s.add(l3Label)
    })
  })

  const deRows: (string | number)[][] = [
    ['Data Element', 'Description', 'Information Products', '# IPs', 'L3s Referencing', '# L3s'],
  ]
  systemDataElements
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(de => {
      const ipIds = Array.from(ipsBySde.get(de.id) || [])
      const ipNames = ipIds.map(id => ipMap.get(id)?.name || '').filter(Boolean).sort()
      const l3s = uniq(ipIds.flatMap(id => Array.from(l3sByIp.get(id) || []))).sort()
      deRows.push([
        de.name,
        de.description || '',
        ipNames.join('; '),
        ipNames.length,
        l3s.join(' | '),
        l3s.length,
      ])
    })
  const wsDE = XLSX.utils.aoa_to_sheet(deRows)
  wsDE['!cols'] = [{ wch: 28 }, { wch: 50 }, { wch: 45 }, { wch: 7 }, { wch: 60 }, { wch: 7 }]
  boldHeader(wsDE, 0, 6)
  wsDE['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, wsDE, 'Data Elements')

  // ── Sheet 6: Use Cases ────────────────────────────────────
  const useCaseRows: (string | number)[][] = [
    ['L1 Core Area', 'L2 Capability', 'L3 Functionality', 'Level', 'Use Case'],
  ]
  flat.forEach(row => {
    (row.cap.use_cases || []).forEach(uc => {
      useCaseRows.push([row.l1Name, row.l2Name, row.l3Name, `L${row.cap.level}`, uc])
    })
  })
  const wsUC = XLSX.utils.aoa_to_sheet(useCaseRows)
  wsUC['!cols'] = [{ wch: 26 }, { wch: 26 }, { wch: 30 }, { wch: 6 }, { wch: 70 }]
  boldHeader(wsUC, 0, 5)
  wsUC['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, wsUC, 'Use Cases')

  // ── Sheet 7: Features ─────────────────────────────────────
  const featureRows: (string | number)[][] = [
    ['L1 Core Area', 'L2 Capability', 'L3 Functionality', 'Level', 'Feature'],
  ]
  flat.forEach(row => {
    (row.cap.features || []).forEach(f => {
      featureRows.push([row.l1Name, row.l2Name, row.l3Name, `L${row.cap.level}`, f])
    })
  })
  const wsFeat = XLSX.utils.aoa_to_sheet(featureRows)
  wsFeat['!cols'] = [{ wch: 26 }, { wch: 26 }, { wch: 30 }, { wch: 6 }, { wch: 70 }]
  boldHeader(wsFeat, 0, 5)
  wsFeat['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, wsFeat, 'Features')

  // ── Sheet 8: Systems ──────────────────────────────────────
  type SysUse = {
    sys: LogicalSystem
    asSource: Set<string>
    asDest: Set<string>
    asFeeding: Set<string>
    asProcessing: Set<string>  // capability.system_id
  }
  const sysUse = new Map<string, SysUse>()
  const ensureSys = (s: LogicalSystem): SysUse => {
    let u = sysUse.get(s.id)
    if (!u) {
      u = { sys: s, asSource: new Set(), asDest: new Set(), asFeeding: new Set(), asProcessing: new Set() }
      sysUse.set(s.id, u)
    }
    return u
  }
  hydrated.forEach(h => {
    const path = pathIdx.get(h.id)
    const l3Label = path && path.l3 ? `${path.l1} / ${path.l2} / ${path.l3}` : h.name
    if (h.system) ensureSys(h.system).asProcessing.add(l3Label)
    h.inputs.forEach(inp => {
      inp.sourceSystems.forEach(s => ensureSys(s).asSource.add(l3Label))
      if (inp.feedingSystem) ensureSys(inp.feedingSystem).asFeeding.add(l3Label)
    })
    h.outputs.forEach(out => {
      out.destinationSystems.forEach(s => ensureSys(s).asDest.add(l3Label))
    })
  })
  logicalSystems.forEach(s => { ensureSys(s) })

  const sysRows: (string | number)[][] = [
    ['System', 'Type', 'Description', 'As Source (L3s)', 'As Feeding (L3s)', 'As Destination (L3s)', 'Owns Process (L3s)', '# Touchpoints'],
  ]
  Array.from(sysUse.values())
    .sort((a, b) => a.sys.name.localeCompare(b.sys.name))
    .forEach(u => {
      const total = u.asSource.size + u.asDest.size + u.asFeeding.size + u.asProcessing.size
      sysRows.push([
        u.sys.name,
        u.sys.system_type || '',
        u.sys.description || '',
        Array.from(u.asSource).sort().join(' | '),
        Array.from(u.asFeeding).sort().join(' | '),
        Array.from(u.asDest).sort().join(' | '),
        Array.from(u.asProcessing).sort().join(' | '),
        total,
      ])
    })
  const wsSys = XLSX.utils.aoa_to_sheet(sysRows)
  wsSys['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 40 }, { wch: 50 }, { wch: 50 }, { wch: 50 }, { wch: 50 }, { wch: 14 }]
  boldHeader(wsSys, 0, 8)
  wsSys['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, wsSys, 'Systems')

  // ── Sheet 9: Personas ─────────────────────────────────────
  type PersonaUse = { p: Persona; asSupplier: Set<string>; asConsumer: Set<string> }
  const personaUse = new Map<string, PersonaUse>()
  const ensureP = (p: Persona): PersonaUse => {
    let u = personaUse.get(p.id)
    if (!u) { u = { p, asSupplier: new Set(), asConsumer: new Set() }; personaUse.set(p.id, u) }
    return u
  }
  hydrated.forEach(h => {
    const path = pathIdx.get(h.id)
    const l3Label = path && path.l3 ? `${path.l1} / ${path.l2} / ${path.l3}` : h.name
    h.inputs.forEach(inp => inp.supplierPersonas.forEach(p => ensureP(p).asSupplier.add(l3Label)))
    h.outputs.forEach(out => out.consumerPersonas.forEach(p => ensureP(p).asConsumer.add(l3Label)))
  })
  personas.forEach(p => { ensureP(p) })

  const personaRows: (string | number)[][] = [
    ['Persona', 'Role', 'Description', 'As Supplier (L3s)', 'As Consumer (L3s)', '# Touchpoints'],
  ]
  Array.from(personaUse.values())
    .sort((a, b) => a.p.name.localeCompare(b.p.name))
    .forEach(u => {
      personaRows.push([
        u.p.name,
        u.p.role || '',
        u.p.description || '',
        Array.from(u.asSupplier).sort().join(' | '),
        Array.from(u.asConsumer).sort().join(' | '),
        u.asSupplier.size + u.asConsumer.size,
      ])
    })
  const wsPersona = XLSX.utils.aoa_to_sheet(personaRows)
  wsPersona['!cols'] = [{ wch: 24 }, { wch: 22 }, { wch: 40 }, { wch: 50 }, { wch: 50 }, { wch: 14 }]
  boldHeader(wsPersona, 0, 6)
  wsPersona['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, wsPersona, 'Personas')

  XLSX.writeFile(wb, `${sanitizeFilename(title)}_CapabilityMap.xlsx`)
}
