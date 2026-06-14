import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import PptxGenJS from 'pptxgenjs'

// ─── Playbook data (mirrors the process-playbook AI JSON) ──
export interface ProcessPlaybook {
  narrative: string
  steps: { step: string; role?: string; system?: string | null; description?: string }[]
  raci: { activity: string; responsible?: string; accountable?: string; consulted?: string; informed?: string }[]
  controls: { framework?: string; control: string; requirement?: string }[]
  systems: { system: string; role?: string }[]
  kpis: { kpi: string; target?: string; rationale?: string }[]
  complianceNotes: string[]
}

function sanitizeFilename(title: string): string {
  return (title || 'process').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').substring(0, 80) || 'process'
}

// ─── Excel ─────────────────────────────────────────────
export function exportPlaybookXlsx(processName: string, pb: ProcessPlaybook) {
  const wb = XLSX.utils.book_new()

  const overview = [
    ['Process Playbook'],
    ['Process', processName],
    [],
    ['Narrative'],
    ...pb.narrative.split(/\n+/).filter(Boolean).map(p => [p]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overview), 'Overview')

  const steps = [['#', 'Step', 'Role', 'System', 'Description'],
    ...pb.steps.map((s, i) => [i + 1, s.step, s.role || '', s.system || '', s.description || ''])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(steps), 'Steps')

  const raci = [['Activity', 'Responsible', 'Accountable', 'Consulted', 'Informed'],
    ...pb.raci.map(r => [r.activity, r.responsible || '', r.accountable || '', r.consulted || '', r.informed || ''])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raci), 'RACI')

  const controls = [['Framework', 'Control', 'Requirement'],
    ...pb.controls.map(c => [c.framework || '', c.control, c.requirement || ''])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(controls), 'Controls')

  const systems = [['System', 'Role'], ...pb.systems.map(s => [s.system, s.role || ''])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(systems), 'Systems')

  const kpis = [['KPI', 'Target', 'Rationale'], ...pb.kpis.map(k => [k.kpi, k.target || '', k.rationale || ''])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpis), 'KPIs')

  if (pb.complianceNotes?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Compliance Notes'], ...pb.complianceNotes.map(n => [n])]), 'Compliance')
  }

  XLSX.writeFile(wb, `${sanitizeFilename(processName)}_Playbook.xlsx`)
}

// ─── PDF ───────────────────────────────────────────────
export function exportPlaybookPdf(processName: string, pb: ProcessPlaybook) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const M = 40
  let y = M

  const ensure = (h: number) => { if (y + h > pdf.internal.pageSize.getHeight() - M) { pdf.addPage(); y = M } }
  const heading = (t: string) => { ensure(28); pdf.setFontSize(13); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold'); pdf.text(t, M, y); y += 18 }
  const body = (t: string, indent = 0) => {
    pdf.setFontSize(9.5); pdf.setTextColor(51, 65, 85); pdf.setFont('helvetica', 'normal')
    const lines = pdf.splitTextToSize(t, W - 2 * M - indent) as string[]
    for (const ln of lines) { ensure(13); pdf.text(ln, M + indent, y); y += 13 }
  }

  pdf.setFontSize(18); pdf.setTextColor(14, 165, 233); pdf.setFont('helvetica', 'bold')
  pdf.text('Process Playbook', M, y); y += 22
  pdf.setFontSize(12); pdf.setTextColor(15, 23, 42); pdf.text(processName, M, y); y += 24

  heading('Narrative')
  pb.narrative.split(/\n+/).filter(Boolean).forEach(p => { body(p); y += 4 })
  y += 6

  heading('Process Steps')
  pb.steps.forEach((s, i) => {
    body(`${i + 1}. ${s.step}${s.role ? `  —  ${s.role}` : ''}${s.system ? `  [${s.system}]` : ''}`)
    if (s.description) body(s.description, 14)
  })
  y += 6

  heading('RACI')
  pb.raci.forEach(r => body(`${r.activity}:  R=${r.responsible || '-'}  A=${r.accountable || '-'}  C=${r.consulted || '-'}  I=${r.informed || '-'}`))
  y += 6

  heading('Controls & Compliance')
  pb.controls.forEach(c => { body(`[${c.framework || 'Other'}] ${c.control}`); if (c.requirement) body(c.requirement, 14) })
  ;(pb.complianceNotes || []).forEach(n => body(`• ${n}`, 4))
  y += 6

  heading('Systems')
  pb.systems.forEach(s => body(`${s.system}${s.role ? ` — ${s.role}` : ''}`))
  y += 6

  heading('KPIs')
  pb.kpis.forEach(k => body(`${k.kpi}${k.target ? `  (target: ${k.target})` : ''}${k.rationale ? ` — ${k.rationale}` : ''}`))

  pdf.save(`${sanitizeFilename(processName)}_Playbook.pdf`)
}

// ─── PowerPoint ────────────────────────────────────────
export function exportPlaybookPptx(processName: string, pb: ProcessPlaybook) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  const NAVY = '0F172A', BLUE = '0EA5E9', SLATE = '475569', LIGHT = 'F1F5F9'

  // Title
  const title = pptx.addSlide()
  title.background = { color: NAVY }
  title.addText('MACH12 · Process Studio', { x: 0.6, y: 2.4, fontSize: 16, color: BLUE, bold: true, fontFace: 'Arial' })
  title.addText(processName, { x: 0.6, y: 2.9, fontSize: 32, color: 'FFFFFF', bold: true, fontFace: 'Arial' })
  title.addText('Process Playbook', { x: 0.6, y: 3.9, fontSize: 14, color: 'CBD5E1', fontFace: 'Arial' })

  const header = (s: PptxGenJS.Slide, label: string) => {
    s.addText(label, { x: 0.5, y: 0.35, fontSize: 20, color: NAVY, bold: true, fontFace: 'Arial' })
    s.addShape('line' as PptxGenJS.ShapeType, { x: 0.5, y: 0.95, w: 12.3, h: 0, line: { color: BLUE, width: 2 } })
  }

  // Narrative
  const nar = pptx.addSlide()
  header(nar, 'Overview')
  nar.addText(pb.narrative, { x: 0.5, y: 1.2, w: 12.3, h: 5.5, fontSize: 13, color: SLATE, fontFace: 'Arial', valign: 'top' })

  const tableSlide = (label: string, head: string[], rows: string[][]) => {
    if (!rows.length) return
    const s = pptx.addSlide()
    header(s, label)
    const tableRows = [
      head.map(h => ({ text: h, options: { bold: true, color: 'FFFFFF', fill: { color: BLUE }, fontSize: 11, fontFace: 'Arial' } })),
      ...rows.map(r => r.map(c => ({ text: c, options: { color: NAVY, fontSize: 10, fontFace: 'Arial', fill: { color: LIGHT } } }))),
    ]
    s.addTable(tableRows as PptxGenJS.TableRow[], { x: 0.5, y: 1.2, w: 12.3, border: { type: 'solid', color: 'E2E8F0', pt: 0.5 }, autoPage: true })
  }

  tableSlide('Process Steps', ['#', 'Step', 'Role', 'System'], pb.steps.map((s, i) => [String(i + 1), s.step, s.role || '', s.system || '']))
  tableSlide('RACI', ['Activity', 'R', 'A', 'C', 'I'], pb.raci.map(r => [r.activity, r.responsible || '', r.accountable || '', r.consulted || '', r.informed || '']))
  tableSlide('Controls & Compliance', ['Framework', 'Control', 'Requirement'], pb.controls.map(c => [c.framework || 'Other', c.control, c.requirement || '']))
  tableSlide('Systems', ['System', 'Role'], pb.systems.map(s => [s.system, s.role || '']))
  tableSlide('KPIs', ['KPI', 'Target', 'Rationale'], pb.kpis.map(k => [k.kpi, k.target || '', k.rationale || '']))

  pptx.writeFile({ fileName: `${sanitizeFilename(processName)}_Playbook.pptx` })
}
