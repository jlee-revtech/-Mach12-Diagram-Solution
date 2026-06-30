// ─── Capability Map workspace → Excel export ───────────
// Downloads the Capability Map (value stream → capability group → capability)
// as a structured .xlsx workbook. Two sheets: a flat capability list and a
// value-stream summary. Used by the "Download" action in CapabilityMapWorkspace.

import * as XLSX from 'xlsx'
import type { CapabilityWithSystems } from '@/lib/capmap/types'
import type { Workstream } from '@/lib/workstream/types'
import type { BedrockSystemWithPhysicals } from '@/lib/bedrock/types'

function sanitizeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_') || 'capability-map'
}

function boldHeader(ws: XLSX.WorkSheet, colCount: number) {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = { font: { bold: true } }
  }
}

// Short value-stream label: drop the parenthetical qualifier so
// "Plan-to-Perform (Program & Portfolio Management)" reads as "Plan-to-Perform".
function workstreamLabel(ws?: Workstream | null): string {
  if (!ws) return 'Unaligned'
  return ws.name.split('(')[0].trim() || ws.name
}

const UNGROUPED = 'Other capabilities'

export function downloadCapabilityMapXlsx(
  caps: CapabilityWithSystems[],
  workstreams: Workstream[],
  catalog: BedrockSystemWithPhysicals[],
  title = 'Capability Map',
): void {
  const catById = new Map(catalog.map(c => [c.id, c]))
  const physById = new Map<string, string>()
  for (const c of catalog) for (const p of c.physicals) physById.set(p.id, p.name)

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

  // ─── Sheet 1: Capabilities ───
  const header = ['Value Stream', 'Capability Group', 'Capability', 'Description', 'Source', 'Logical Systems', 'Physical Systems']
  const rows: (string | undefined)[][] = [header]
  for (const c of sorted) {
    const ws = c.workstream_id ? wsById.get(c.workstream_id) : null
    const logical = c.logicalSystemIds.map(id => catById.get(id)?.label).filter(Boolean).join('; ')
    const physical = c.physicalSystemIds.map(id => physById.get(id)).filter(Boolean).join('; ')
    rows.push([
      workstreamLabel(ws),
      (c.domain && c.domain.trim()) || UNGROUPED,
      c.name,
      c.description || '',
      c.source === 'ai' ? 'AI' : c.source === 'standard' ? 'Standard' : 'Manual',
      logical,
      physical,
    ])
  }
  const ws1 = XLSX.utils.aoa_to_sheet(rows)
  ws1['!cols'] = [{ wch: 26 }, { wch: 38 }, { wch: 46 }, { wch: 52 }, { wch: 10 }, { wch: 28 }, { wch: 30 }]
  ws1['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: header.length - 1 } }) }
  if (rows.length > 1) ws1['!freeze'] = { xSplit: 0, ySplit: 1 }
  boldHeader(ws1, header.length)

  // ─── Sheet 2: Summary by value stream ───
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
  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows)
  ws2['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 14 }]
  boldHeader(ws2, summaryHeader.length)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Capabilities')
  XLSX.utils.book_append_sheet(wb, ws2, 'By Value Stream')

  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${sanitizeFilename(title)}_${stamp}.xlsx`)
}
