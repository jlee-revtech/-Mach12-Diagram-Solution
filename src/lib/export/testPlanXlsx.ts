import * as XLSX from 'xlsx'
import { SYSTEM_KIND_LABEL, type TestPlan } from '@/lib/process/testPlan'

function sanitizeFilename(title: string): string {
  return (title || 'process').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').substring(0, 80) || 'process'
}

const setCols = (ws: XLSX.WorkSheet, widths: number[]) => { ws['!cols'] = widths.map(w => ({ wch: w })) }

// Excel test script: a cover sheet, an executable Test Cases grid (one row per
// tester action with blank Actual/Status columns to fill during execution), a
// system traceability sheet, and a coverage summary.
export function exportTestPlanXlsx(plan: TestPlan) {
  const wb = XLSX.utils.book_new()

  // ── Cover ──
  const cover: (string | number)[][] = [
    ['Functional Test Plan'],
    ['Process', plan.processName],
    ...(plan.modelTitle ? [['Model', plan.modelTitle]] : []),
    ['Generated', new Date().toISOString().slice(0, 10)],
    ['Total Test Cases', plan.testCases.length],
    [],
    ['Objective'], [plan.objective || '—'],
    [],
    ['In Scope'], ...(plan.scope.length ? plan.scope.map(s => ['• ' + s]) : [['—']]),
    [],
    ['Out of Scope'], ...(plan.outOfScope.length ? plan.outOfScope.map(s => ['• ' + s]) : [['—']]),
    [],
    ['Prerequisites'], ...(plan.prerequisites.length ? plan.prerequisites.map(s => ['• ' + s]) : [['—']]),
  ]
  const wsCover = XLSX.utils.aoa_to_sheet(cover)
  setCols(wsCover, [22, 90])
  XLSX.utils.book_append_sheet(wb, wsCover, 'Cover')

  // ── Test Cases (executable grid) ──
  const head = [
    'Test Case', 'Title', 'Process Step', 'System Type', 'System / Tile', 'Fiori App', 'T-code',
    'Type', 'Priority', 'Preconditions', 'Step #', 'Tester Action', 'Test Data', 'Expected Result',
    'Actual Result', 'Status', 'Tester', 'Date', 'Comments',
  ]
  const rows: (string | number)[][] = []
  for (const tc of plan.testCases) {
    const tdSummary = tc.testData.map(d => `${d.field}: ${d.value}`).join('\n')
    tc.steps.forEach((st, idx) => {
      const first = idx === 0
      rows.push([
        first ? tc.id : '',
        first ? tc.title : '',
        first ? tc.processStep : '',
        first ? SYSTEM_KIND_LABEL[tc.systemKind] : '',
        first ? (tc.fioriTile || tc.systemLabel) : '',
        first ? (tc.fioriAppId || '') : '',
        first ? (tc.tcode || '') : '',
        first ? tc.type : '',
        first ? tc.priority : '',
        first ? tc.preconditions.join('\n') : '',
        st.no,
        st.action,
        st.testData || (first ? tdSummary : ''),
        st.expected,
        '', '', '', '', '', // Actual / Status / Tester / Date / Comments — filled at execution
      ])
    })
  }
  const wsCases = XLSX.utils.aoa_to_sheet([head, ...rows])
  setCols(wsCases, [10, 28, 24, 16, 26, 10, 10, 9, 8, 32, 6, 40, 28, 40, 28, 12, 12, 12, 28])
  if (rows.length) wsCases['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: head.length - 1 } }) }
  XLSX.utils.book_append_sheet(wb, wsCases, 'Test Cases')

  // ── Traceability ──
  const trace = [
    ['Test Case', 'Title', 'Process Step', 'System Type', 'System / Tile', 'Fiori App', 'T-code', 'Type', 'Priority', '# Steps'],
    ...plan.testCases.map(tc => [
      tc.id, tc.title, tc.processStep, SYSTEM_KIND_LABEL[tc.systemKind],
      tc.fioriTile || tc.systemLabel, tc.fioriAppId || '', tc.tcode || '', tc.type, tc.priority, tc.steps.length,
    ]),
  ]
  const wsTrace = XLSX.utils.aoa_to_sheet(trace)
  setCols(wsTrace, [10, 30, 26, 18, 28, 10, 10, 9, 8, 8])
  XLSX.utils.book_append_sheet(wb, wsTrace, 'Traceability')

  // ── Summary (coverage) ──
  const byKind = new Map<string, number>()
  const byPriority = new Map<string, number>()
  const byType = new Map<string, number>()
  for (const tc of plan.testCases) {
    byKind.set(SYSTEM_KIND_LABEL[tc.systemKind], (byKind.get(SYSTEM_KIND_LABEL[tc.systemKind]) || 0) + 1)
    byPriority.set(tc.priority, (byPriority.get(tc.priority) || 0) + 1)
    byType.set(tc.type, (byType.get(tc.type) || 0) + 1)
  }
  const summary: (string | number)[][] = [
    ['Coverage Summary'], [],
    ['By System Type', 'Count'], ...[...byKind.entries()].map(([k, v]) => [k, v]), [],
    ['By Priority', 'Count'], ...[...byPriority.entries()].map(([k, v]) => [k, v]), [],
    ['By Type', 'Count'], ...[...byType.entries()].map(([k, v]) => [k, v]),
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summary)
  setCols(wsSummary, [24, 10])
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  XLSX.writeFile(wb, `${sanitizeFilename(plan.processName)}_TestPlan.xlsx`)
}
