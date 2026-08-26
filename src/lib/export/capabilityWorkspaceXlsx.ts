// ─── Capability Map workspace → Excel export ───────────
// Downloads the capability list as a dimensional workbook built for pivoting,
// not just for reading. Used by the "Download" action in CapabilityMapWorkspace
// and on the read-only share view.
//
//   Capabilities        one row per capability, every dimension its own column
//   Capability x System one row per capability→system pair (long format), so a
//                       PivotTable can slice by system without splitting cells
//   By Value Stream     capability + group counts per stream
//   Scope Summary       stream x scope bucket, with a fit roll-up beneath
//   By Responsible Org  owner x scope, with an ARICEFW count
//   Dimensions          the vocabulary behind every column, so a reader knows
//                       the full set of values even when none are in use yet
//
// The flat sheets carry pre-collapsed helper columns (Scope Status, Assessed,
// Needs ARICEFW, Mapped) because pivoting across three interdependent columns —
// scope, priority, future phase — is awkward, and one label is what people
// actually want on a row or column axis.

import * as XLSX from 'xlsx'
import type { CapabilityWithSystems, ResponsibleOrg } from '@/lib/capmap/types'
import type { Workstream } from '@/lib/workstream/types'
import type { BedrockSystemWithPhysicals } from '@/lib/bedrock/types'
import {
  scopeBucket, bucketExportLabel, bucketLabel, fitLabel,
  priorityLabel, SCOPE_BUCKETS, SCOPE_PRIORITIES, FIT_TYPES,
} from '@/lib/capmap/scope'

function sanitizeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_') || 'capability-map'
}

function boldHeader(ws: XLSX.WorkSheet, colCount: number) {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = { font: { bold: true } }
  }
}

// Autofilter + frozen header on any flat sheet, so it behaves like a data table
// the moment it opens.
function asTable(ws: XLSX.WorkSheet, rowCount: number, colCount: number) {
  if (rowCount > 1) {
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowCount - 1, c: colCount - 1 } }) }
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  }
  boldHeader(ws, colCount)
}

// Short value-stream label: drop the parenthetical qualifier so
// "Plan-to-Perform (Program & Portfolio Management)" reads as "Plan-to-Perform".
function workstreamLabel(ws?: Workstream | null): string {
  if (!ws) return 'Unaligned'
  return ws.name.split('(')[0].trim() || ws.name
}

const UNGROUPED = 'Other capabilities'
const NO_OWNER = 'No owner'
const YES = 'Yes'
const NO = 'No'

export function downloadCapabilityMapXlsx(
  caps: CapabilityWithSystems[],
  workstreams: Workstream[],
  catalog: BedrockSystemWithPhysicals[],
  title = 'Capability Map',
  respOrgs: ResponsibleOrg[] = [],
): void {
  const respById = new Map(respOrgs.map(o => [o.id, o]))
  const ownerOf = (c: CapabilityWithSystems) =>
    (c.responsible_org_id && respById.get(c.responsible_org_id)?.name) || NO_OWNER
  const ownerCodeOf = (c: CapabilityWithSystems) =>
    (c.responsible_org_id && respById.get(c.responsible_org_id)?.code) || ''

  const catById = new Map(catalog.map(c => [c.id, c]))
  // Keyed on the parent's id, not its label: labels are user-editable and two
  // logical systems could be renamed to the same string.
  const physById = new Map<string, { name: string; parentId: string; parentLabel: string }>()
  for (const c of catalog) for (const p of c.physicals) physById.set(p.id, { name: p.name, parentId: c.id, parentLabel: c.label })

  const wsById = new Map(workstreams.map(w => [w.id, w]))
  // Value-stream display order: defined order first, Unaligned last.
  const wsOrder = new Map<string | null, number>()
  workstreams.forEach((w, i) => wsOrder.set(w.id, i))
  const orderOf = (id: string | null) => (id != null && wsOrder.has(id) ? wsOrder.get(id)! : Number.MAX_SAFE_INTEGER)

  const sorted = [...caps].sort((a, b) => {
    const oa = orderOf(a.workstream_id), ob = orderOf(b.workstream_id)
    if (oa !== ob) return oa - ob
    const da = (a.domain || '').toLowerCase(), db = (b.domain || '').toLowerCase()
    if (da !== db) return da < db ? -1 : 1
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name)
  })

  // ─── Sheet 1: Capabilities (the fact table) ───
  const header = [
    'Value Stream', 'Value Stream Code',
    'Responsible Org', 'Org Code',
    'Capability Group', 'Capability', 'Description',
    'Scope', 'Priority', 'Fit', 'Future Phase',
    'Scope Status', 'Assessed', 'Needs ARICEFW',
    'Scope Note', 'Source',
    'Logical Systems', 'Logical System Count',
    'Physical Systems', 'Physical System Count', 'Mapped',
  ]
  const rows: (string | number)[][] = [header]
  for (const c of sorted) {
    const ws = c.workstream_id ? wsById.get(c.workstream_id) : null
    const bucket = scopeBucket(c)
    const logical = c.logicalSystemIds.map(id => catById.get(id)?.label).filter(Boolean)
    const physical = c.physicalSystemIds.map(id => physById.get(id)?.name).filter(Boolean)
    rows.push([
      workstreamLabel(ws),
      ws?.code || '',
      ownerOf(c),
      ownerCodeOf(c),
      (c.domain && c.domain.trim()) || UNGROUPED,
      c.name,
      c.description || '',
      // The three raw scope columns, each blank where it does not apply, so a
      // filter on "Priority = Required" never picks up an out-of-scope row.
      c.scope === 'in' ? 'In Scope' : c.scope === 'out' ? 'Out of Scope' : 'Not Assessed',
      c.scope === 'in' ? bucketLabel(bucket) : '',
      c.scope === 'in' ? (c.fit ? fitLabel(c.fit) : 'Not Set') : '',
      c.scope === 'out' && c.future_phase ? YES : '',
      // …and the collapsed one, which is what belongs on a pivot axis.
      bucketExportLabel(bucket),
      c.scope ? YES : NO,
      c.scope === 'in' && c.fit === 'aricefw' ? YES : NO,
      c.scope_note || '',
      c.source === 'ai' ? 'AI' : c.source === 'standard' ? 'Standard' : c.source === 'copied' ? 'Copied' : 'Manual',
      logical.join('; '),
      logical.length,
      physical.join('; '),
      physical.length,
      logical.length + physical.length > 0 ? YES : NO,
    ])
  }
  const ws1 = XLSX.utils.aoa_to_sheet(rows)
  ws1['!cols'] = [
    { wch: 26 }, { wch: 20 }, { wch: 24 }, { wch: 10 },
    { wch: 38 }, { wch: 46 }, { wch: 52 },
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 13 },
    { wch: 28 }, { wch: 10 }, { wch: 15 },
    { wch: 40 }, { wch: 10 },
    { wch: 28 }, { wch: 19 }, { wch: 30 }, { wch: 21 }, { wch: 8 },
  ]
  asTable(ws1, rows.length, header.length)

  // ─── Sheet 2: Capability x System (long format) ───
  // One row per capability→system pair. The joined columns on sheet 1 read well
  // but cannot be pivoted; this sheet is what you point a PivotTable at when the
  // question is "how many capabilities land on MES, by value stream".
  const linkHeader = [
    'Value Stream', 'Responsible Org', 'Capability Group', 'Capability',
    'Scope Status', 'Needs ARICEFW',
    'System Tier', 'Logical System', 'Physical System',
  ]
  const linkRows: (string | number)[][] = [linkHeader]
  for (const c of sorted) {
    const ws = c.workstream_id ? wsById.get(c.workstream_id) : null
    const base = [
      workstreamLabel(ws), ownerOf(c), (c.domain && c.domain.trim()) || UNGROUPED, c.name,
      bucketExportLabel(scopeBucket(c)),
      c.scope === 'in' && c.fit === 'aricefw' ? YES : NO,
    ]
    // Physical rows carry their parent logical system too, so a pivot can drill
    // logical -> physical without a second lookup.
    for (const pid of c.physicalSystemIds) {
      const p = physById.get(pid)
      if (p) linkRows.push([...base, 'Physical', p.parentLabel, p.name])
    }
    // A logical mapping with no physical under it still deserves a row.
    for (const sid of c.logicalSystemIds) {
      const s = catById.get(sid)
      if (!s) continue
      const hasPhysical = c.physicalSystemIds.some(pid => physById.get(pid)?.parentId === s.id)
      if (!hasPhysical) linkRows.push([...base, 'Logical', s.label, ''])
    }
    // And an unmapped capability must appear, or the sheet silently under-counts.
    if (c.logicalSystemIds.length === 0 && c.physicalSystemIds.length === 0) {
      linkRows.push([...base, 'Unmapped', '', ''])
    }
  }
  const ws2 = XLSX.utils.aoa_to_sheet(linkRows)
  ws2['!cols'] = [{ wch: 26 }, { wch: 24 }, { wch: 38 }, { wch: 46 }, { wch: 28 }, { wch: 15 }, { wch: 12 }, { wch: 24 }, { wch: 28 }]
  asTable(ws2, linkRows.length, linkHeader.length)

  // ─── Sheet 3: Summary by value stream ───
  const byWs = new Map<string, { label: string; groups: Set<string>; count: number; order: number }>()
  for (const c of sorted) {
    const ws = c.workstream_id ? wsById.get(c.workstream_id) : null
    const key = ws ? ws.id : '__unaligned__'
    if (!byWs.has(key)) byWs.set(key, { label: workstreamLabel(ws), groups: new Set(), count: 0, order: orderOf(c.workstream_id) })
    const entry = byWs.get(key)!
    entry.count++
    entry.groups.add((c.domain && c.domain.trim()) || UNGROUPED)
  }
  const summaryHeader = ['Value Stream', 'Capability Groups', 'Capabilities']
  const summaryRows: (string | number)[][] = [summaryHeader]
  for (const e of Array.from(byWs.values()).sort((a, b) => a.order - b.order)) {
    summaryRows.push([e.label, e.groups.size, e.count])
  }
  summaryRows.push(['Total', new Set(sorted.map(c => `${c.workstream_id}|${c.domain || UNGROUPED}`)).size, sorted.length])
  const ws3 = XLSX.utils.aoa_to_sheet(summaryRows)
  ws3['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 14 }]
  boldHeader(ws3, summaryHeader.length)

  // ─── Sheet 4: Scope roll-up (value stream x scope bucket) ───
  const scopeHeader = ['Value Stream', ...SCOPE_BUCKETS.map(bucketExportLabel), 'Total']
  const scopeRows: (string | number)[][] = [scopeHeader]
  const tally = new Map<string, { label: string; order: number; counts: Map<string, number>; total: number }>()
  for (const c of sorted) {
    const ws = c.workstream_id ? wsById.get(c.workstream_id) : null
    const key = ws ? ws.id : '__unaligned__'
    if (!tally.has(key)) tally.set(key, { label: workstreamLabel(ws), order: orderOf(c.workstream_id), counts: new Map(), total: 0 })
    const e = tally.get(key)!
    const b = scopeBucket(c)
    e.counts.set(b, (e.counts.get(b) || 0) + 1)
    e.total++
  }
  for (const e of Array.from(tally.values()).sort((a, b) => a.order - b.order)) {
    scopeRows.push([e.label, ...SCOPE_BUCKETS.map(b => e.counts.get(b) || 0), e.total])
  }
  scopeRows.push([
    'Total',
    ...SCOPE_BUCKETS.map(b => sorted.filter(c => scopeBucket(c) === b).length),
    sorted.length,
  ])

  // Fit roll-up beneath the scope table — the follow-on question ("of what IS
  // in scope, how much needs development?"), counting in-scope rows only.
  const inScope = sorted.filter(c => c.scope === 'in')
  scopeRows.push([])
  scopeRows.push(['Fit (in-scope capabilities only)', ...FIT_TYPES.map(fitLabel), 'Not Set', 'Total'])
  const fitTally = new Map<string, { label: string; order: number; counts: Map<string, number>; total: number }>()
  for (const c of inScope) {
    const ws = c.workstream_id ? wsById.get(c.workstream_id) : null
    const key = ws ? ws.id : '__unaligned__'
    if (!fitTally.has(key)) fitTally.set(key, { label: workstreamLabel(ws), order: orderOf(c.workstream_id), counts: new Map(), total: 0 })
    const e = fitTally.get(key)!
    const k = c.fit || 'unset'
    e.counts.set(k, (e.counts.get(k) || 0) + 1)
    e.total++
  }
  for (const e of Array.from(fitTally.values()).sort((a, b) => a.order - b.order)) {
    scopeRows.push([e.label, ...FIT_TYPES.map(f => e.counts.get(f) || 0), e.counts.get('unset') || 0, e.total])
  }
  scopeRows.push([
    'Total',
    ...FIT_TYPES.map(f => inScope.filter(c => c.fit === f).length),
    inScope.filter(c => !c.fit).length,
    inScope.length,
  ])
  const ws4 = XLSX.utils.aoa_to_sheet(scopeRows)
  ws4['!cols'] = [{ wch: 34 }, ...SCOPE_BUCKETS.map(() => ({ wch: 20 })), { wch: 10 }]
  boldHeader(ws4, scopeHeader.length)

  // ─── Sheet 5: By Responsible Org (owner x scope) ───
  // Written only when ownership is in use, so the workbook does not carry an
  // empty sheet for a client who has not assigned owners yet.
  const anyOwner = sorted.some(c => c.responsible_org_id && respById.has(c.responsible_org_id))
  let ws5: XLSX.WorkSheet | null = null
  if (anyOwner) {
    const ownerHeader = ['Responsible Org', 'Code', ...SCOPE_BUCKETS.map(bucketExportLabel), 'ARICEFW', 'Total']
    const ownerRows: (string | number)[][] = [ownerHeader]
    const order = new Map(respOrgs.map((o, i) => [o.id, i]))
    const groups = new Map<string, CapabilityWithSystems[]>()
    for (const c of sorted) {
      const key = c.responsible_org_id && respById.has(c.responsible_org_id) ? c.responsible_org_id : '__none__'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(c)
    }
    const keys = Array.from(groups.keys()).sort((a, b) => {
      if (a === '__none__') return 1
      if (b === '__none__') return -1
      return (order.get(a) ?? 0) - (order.get(b) ?? 0)
    })
    for (const k of keys) {
      const list = groups.get(k)!
      const o = k === '__none__' ? null : respById.get(k)
      ownerRows.push([
        o?.name || NO_OWNER,
        o?.code || '',
        ...SCOPE_BUCKETS.map(b => list.filter(c => scopeBucket(c) === b).length),
        list.filter(c => c.scope === 'in' && c.fit === 'aricefw').length,
        list.length,
      ])
    }
    ownerRows.push([
      'Total', '',
      ...SCOPE_BUCKETS.map(b => sorted.filter(c => scopeBucket(c) === b).length),
      sorted.filter(c => c.scope === 'in' && c.fit === 'aricefw').length,
      sorted.length,
    ])
    ws5 = XLSX.utils.aoa_to_sheet(ownerRows)
    ws5['!cols'] = [{ wch: 28 }, { wch: 8 }, ...SCOPE_BUCKETS.map(() => ({ wch: 20 })), { wch: 12 }, { wch: 10 }]
    boldHeader(ws5, ownerHeader.length)
  }

  // ─── Sheet 6: Dimensions (the vocabulary) ───
  // Lists every value each dimension can take, including ones not yet used, so
  // a reader can tell "nobody picked Preferred" from "Preferred is not an
  // option". Doubles as the source range for data validation or slicers.
  const dimHeader = ['Dimension', 'Value', 'Code', 'Capabilities']
  const dimRows: (string | number)[][] = [dimHeader]
  const countBy = (fn: (c: CapabilityWithSystems) => boolean) => sorted.filter(fn).length

  for (const w of workstreams) {
    dimRows.push(['Value Stream', workstreamLabel(w), w.code || '', countBy(c => c.workstream_id === w.id)])
  }
  dimRows.push(['Value Stream', 'Unaligned', '', countBy(c => !c.workstream_id || !wsById.has(c.workstream_id))])

  for (const o of respOrgs) {
    dimRows.push([
      `Responsible Org${o.archived_at ? ' (archived)' : ''}`,
      o.name, o.code || '', countBy(c => c.responsible_org_id === o.id),
    ])
  }
  dimRows.push(['Responsible Org', NO_OWNER, '', countBy(c => !c.responsible_org_id || !respById.has(c.responsible_org_id))])

  dimRows.push(['Scope', 'In Scope', '', countBy(c => c.scope === 'in')])
  dimRows.push(['Scope', 'Out of Scope', '', countBy(c => c.scope === 'out')])
  dimRows.push(['Scope', 'Not Assessed', '', countBy(c => !c.scope)])

  for (const p of SCOPE_PRIORITIES) {
    dimRows.push(['Priority', priorityLabel(p), '', countBy(c => c.scope === 'in' && c.scope_priority === p)])
  }
  for (const f of FIT_TYPES) {
    dimRows.push(['Fit', fitLabel(f), '', countBy(c => c.scope === 'in' && c.fit === f)])
  }
  dimRows.push(['Fit', 'Not Set', '', countBy(c => c.scope === 'in' && !c.fit)])
  dimRows.push(['Future Phase', YES, '', countBy(c => c.scope === 'out' && c.future_phase)])

  for (const s of catalog) {
    dimRows.push(['Logical System', s.label, s.system_type, countBy(c => c.logicalSystemIds.includes(s.id))])
  }
  for (const s of catalog) for (const p of s.physicals) {
    dimRows.push(['Physical System', p.name, s.label, countBy(c => c.physicalSystemIds.includes(p.id))])
  }
  const ws6 = XLSX.utils.aoa_to_sheet(dimRows)
  ws6['!cols'] = [{ wch: 26 }, { wch: 34 }, { wch: 20 }, { wch: 14 }]
  asTable(ws6, dimRows.length, dimHeader.length)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Capabilities')
  XLSX.utils.book_append_sheet(wb, ws2, 'Capability x System')
  XLSX.utils.book_append_sheet(wb, ws3, 'By Value Stream')
  XLSX.utils.book_append_sheet(wb, ws4, 'Scope Summary')
  if (ws5) XLSX.utils.book_append_sheet(wb, ws5, 'By Responsible Org')
  XLSX.utils.book_append_sheet(wb, ws6, 'Dimensions')

  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${sanitizeFilename(title)}_${stamp}.xlsx`)
}
