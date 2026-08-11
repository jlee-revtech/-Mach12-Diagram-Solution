// ─── Persona Catalog → Excel export ────────────────────
// Downloads the persona catalog grouped by value stream, with each persona's
// determination: is it a PRIMARY persona for that stream (executes / owns the
// work) or a STAKEHOLDER / RECEIVER (consumes its data, governs it, or feeds it
// from another stream)? Used by the "Download" action on /process/personas.

import * as XLSX from 'xlsx'
import type { Persona } from '@/lib/sipoc/types'
import type { ProcessRole, PersonaRoleLink } from '@/lib/process/types'
import type { Workstream } from '@/lib/workstream/types'

const UNALIGNED = 'Unaligned'

function boldHeader(ws: XLSX.WorkSheet, colCount: number) {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = { font: { bold: true } }
  }
}

// Short value-stream label: drop the parenthetical qualifier so
// "Plan-to-Perform (Program & Portfolio Management)" reads as "Plan-to-Perform".
function workstreamLabel(ws?: Workstream | null): string {
  if (!ws) return UNALIGNED
  return ws.name.split('(')[0].trim() || ws.name
}

export function personaRoleLabel(role: Persona['workstream_role']): string {
  if (role === 'primary') return 'Primary'
  if (role === 'stakeholder') return 'Stakeholder / Receiver'
  return 'Undetermined'
}

export function downloadPersonaCatalogXlsx(
  personas: Persona[],
  workstreams: Workstream[],
  roles: ProcessRole[],
  links: PersonaRoleLink[],
  title = 'Persona Catalog',
): void {
  const wsById = new Map(workstreams.map(w => [w.id, w]))
  const roleById = new Map(roles.map(r => [r.id, r]))
  const rolesFor = (personaId: string) =>
    links.filter(l => l.persona_id === personaId)
      .map(l => roleById.get(l.role_id)?.name)
      .filter((n): n is string => !!n)
      .sort((a, b) => a.localeCompare(b))

  // Value-stream display order: workstream sort_order, Unaligned last.
  const wsOrder = new Map<string, number>()
  ;[...workstreams]
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
    .forEach((w, i) => wsOrder.set(w.id, i))
  const orderOf = (id?: string | null) => (id && wsOrder.has(id) ? wsOrder.get(id)! : Number.MAX_SAFE_INTEGER)
  // Primary personas ahead of stakeholders inside each stream.
  const roleOrder = (p: Persona) => (p.workstream_role === 'primary' ? 0 : p.workstream_role === 'stakeholder' ? 1 : 2)

  const sorted = [...personas].sort((a, b) => {
    const oa = orderOf(a.workstream_id), ob = orderOf(b.workstream_id)
    if (oa !== ob) return oa - ob
    const ra = roleOrder(a), rb = roleOrder(b)
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name)
  })

  // ─── Sheet 1: Personas ───
  const header = ['Value Stream', 'Persona', 'Type', 'Basis for determination', 'Role / Function', 'Description', 'Process Roles']
  const rows: string[][] = [header]
  for (const p of sorted) {
    rows.push([
      workstreamLabel(p.workstream_id ? wsById.get(p.workstream_id) : null),
      p.name,
      personaRoleLabel(p.workstream_role),
      p.workstream_role_note || '',
      p.role || '',
      p.description || '',
      rolesFor(p.id).join('; '),
    ])
  }
  const sheet1 = XLSX.utils.aoa_to_sheet(rows)
  sheet1['!cols'] = [{ wch: 26 }, { wch: 34 }, { wch: 22 }, { wch: 70 }, { wch: 40 }, { wch: 48 }, { wch: 30 }]
  sheet1['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: header.length - 1 } }) }
  if (rows.length > 1) sheet1['!freeze'] = { xSplit: 0, ySplit: 1 }
  boldHeader(sheet1, header.length)

  // ─── Sheet 2: Summary by value stream ───
  const byWs = new Map<string, { label: string; order: number; primary: number; stakeholder: number; undetermined: number }>()
  for (const p of sorted) {
    const key = p.workstream_id && wsById.has(p.workstream_id) ? p.workstream_id : '__unaligned__'
    if (!byWs.has(key)) {
      byWs.set(key, {
        label: workstreamLabel(p.workstream_id ? wsById.get(p.workstream_id) : null),
        order: orderOf(p.workstream_id),
        primary: 0, stakeholder: 0, undetermined: 0,
      })
    }
    const e = byWs.get(key)!
    if (p.workstream_role === 'primary') e.primary++
    else if (p.workstream_role === 'stakeholder') e.stakeholder++
    else e.undetermined++
  }
  const summaryHeader = ['Value Stream', 'Primary', 'Stakeholder / Receiver', 'Undetermined', 'Total']
  const summaryRows: (string | number)[][] = [summaryHeader]
  let tp = 0, ts = 0, tu = 0
  for (const e of [...byWs.values()].sort((a, b) => a.order - b.order)) {
    summaryRows.push([e.label, e.primary, e.stakeholder, e.undetermined, e.primary + e.stakeholder + e.undetermined])
    tp += e.primary; ts += e.stakeholder; tu += e.undetermined
  }
  summaryRows.push(['Total', tp, ts, tu, tp + ts + tu])
  const sheet2 = XLSX.utils.aoa_to_sheet(summaryRows)
  sheet2['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 10 }]
  boldHeader(sheet2, summaryHeader.length)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet1, 'Personas')
  XLSX.utils.book_append_sheet(wb, sheet2, 'By Value Stream')

  const stamp = new Date().toISOString().slice(0, 10)
  const base = title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_') || 'persona-catalog'
  XLSX.writeFile(wb, `${base}_${stamp}.xlsx`)
}

// ─── CSV (single flat sheet, same columns as sheet 1) ───
export function downloadPersonaCatalogCsv(
  personas: Persona[],
  workstreams: Workstream[],
  roles: ProcessRole[],
  links: PersonaRoleLink[],
  title = 'Persona Catalog',
): void {
  const wsById = new Map(workstreams.map(w => [w.id, w]))
  const roleById = new Map(roles.map(r => [r.id, r]))
  const wsOrder = new Map<string, number>()
  ;[...workstreams]
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
    .forEach((w, i) => wsOrder.set(w.id, i))
  const orderOf = (id?: string | null) => (id && wsOrder.has(id) ? wsOrder.get(id)! : Number.MAX_SAFE_INTEGER)
  const roleOrder = (p: Persona) => (p.workstream_role === 'primary' ? 0 : p.workstream_role === 'stakeholder' ? 1 : 2)
  const sorted = [...personas].sort((a, b) => {
    const oa = orderOf(a.workstream_id), ob = orderOf(b.workstream_id)
    if (oa !== ob) return oa - ob
    const ra = roleOrder(a), rb = roleOrder(b)
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name)
  })

  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [['Value Stream', 'Persona', 'Type', 'Basis for determination', 'Role / Function', 'Description', 'Process Roles'].join(',')]
  for (const p of sorted) {
    const ws = p.workstream_id ? wsById.get(p.workstream_id) : null
    lines.push([
      ws ? (ws.name.split('(')[0].trim() || ws.name) : UNALIGNED,
      p.name,
      personaRoleLabel(p.workstream_role),
      p.workstream_role_note || '',
      p.role || '',
      p.description || '',
      links.filter(l => l.persona_id === p.id).map(l => roleById.get(l.role_id)?.name).filter(Boolean).join('; '),
    ].map(v => cell(String(v))).join(','))
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const base = title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_') || 'persona-catalog'
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${base}_${stamp}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
