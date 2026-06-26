import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, ShadingType, PageBreak,
} from 'docx'
import {
  SYSTEM_KIND_LABEL, MOCKUP_WIDTH, MOCKUP_HEIGHT, type TestPlan, type TestCase,
} from '@/lib/process/testPlan'
import { dataUrlToUint8Array } from '@/lib/process/mockupRender'

// ─── Brand palette (hex without #) ──────────────────────
const NAVY = '0F172A'
const BLUE = '0EA5E9'
const SLATE = '475569'
const HEADERFILL = '354A5F'   // SAP shell-bar blue, used for table header rows
const LIGHT = 'F1F5F9'
const BORDER = 'E2E8F0'

function sanitizeFilename(title: string): string {
  return (title || 'process').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').substring(0, 80) || 'process'
}

const thin = { style: BorderStyle.SINGLE, size: 4, color: BORDER }
const cellBorders = { top: thin, bottom: thin, left: thin, right: thin }

function txt(text: string, opts: { bold?: boolean; color?: string; size?: number } = {}): TextRun {
  return new TextRun({ text, bold: opts.bold, color: opts.color, size: (opts.size ?? 9) * 2, font: 'Calibri' })
}

function cell(children: Paragraph[], opts: { fill?: string; width?: number } = {}): TableCell {
  return new TableCell({
    children,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    borders: cellBorders,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
  })
}

const para = (runs: TextRun[], opts: { spacingAfter?: number } = {}) =>
  new Paragraph({ children: runs, spacing: { after: opts.spacingAfter ?? 40 } })

function headerRow(labels: string[], widths?: number[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: labels.map((l, i) => cell([para([txt(l, { bold: true, color: 'FFFFFF' })])], { fill: HEADERFILL, width: widths?.[i] })),
  })
}

function bulletList(items: string[], fallback = '—'): Paragraph[] {
  if (!items.length) return [para([txt(fallback, { color: SLATE })])]
  return items.map(s => new Paragraph({ children: [txt(s)], bullet: { level: 0 }, spacing: { after: 20 } }))
}

function caseHeading(tc: TestCase): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    children: [
      txt(`${tc.id}  `, { bold: true, color: BLUE, size: 12 }),
      txt(tc.title, { bold: true, color: NAVY, size: 12 }),
    ],
  })
}

function propsTable(tc: TestCase): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell([para([txt('System Type', { bold: true, color: SLATE })])], { fill: LIGHT, width: 22 }),
          cell([para([txt(SYSTEM_KIND_LABEL[tc.systemKind])])], { width: 28 }),
          cell([para([txt('Priority / Type', { bold: true, color: SLATE })])], { fill: LIGHT, width: 22 }),
          cell([para([txt(`${tc.priority} · ${tc.type}`)])], { width: 28 }),
        ],
      }),
      new TableRow({
        children: [
          cell([para([txt('System / Tile', { bold: true, color: SLATE })])], { fill: LIGHT }),
          cell([para([txt(tc.fioriTile || tc.systemLabel)])]),
          cell([para([txt('Tester Role', { bold: true, color: SLATE })])], { fill: LIGHT }),
          cell([para([txt(tc.role || '—')])]),
        ],
      }),
      new TableRow({
        children: [
          cell([para([txt('Fiori App', { bold: true, color: SLATE })])], { fill: LIGHT }),
          cell([para([txt(tc.fioriAppId || '—')])]),
          cell([para([txt('T-code', { bold: true, color: SLATE })])], { fill: LIGHT }),
          cell([para([txt(tc.tcode || '—')])]),
        ],
      }),
    ],
  })
}

function stepsTable(tc: TestCase): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow(['#', 'Tester Action', 'Expected Result'], [6, 50, 44]),
      ...tc.steps.map(st => new TableRow({
        children: [
          cell([para([txt(String(st.no))])], { width: 6 }),
          cell([para([txt(st.action)]), ...(st.testData ? [para([txt(`Data: ${st.testData}`, { color: SLATE, size: 8 })])] : [])], { width: 50 }),
          cell([para([txt(st.expected)])], { width: 44 }),
        ],
      })),
    ],
  })
}

function testDataTable(tc: TestCase): Table | null {
  if (!tc.testData.length) return null
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow(['Field', 'Value'], [40, 60]),
      ...tc.testData.map(d => new TableRow({
        children: [cell([para([txt(d.field)])], { width: 40 }), cell([para([txt(d.value)])], { width: 60 })],
      })),
    ],
  })
}

function screenshotBlock(tc: TestCase): Paragraph[] {
  if (!tc.screenshotDataUrl) return []
  const displayW = 600
  const displayH = Math.round(displayW * (MOCKUP_HEIGHT / MOCKUP_WIDTH))
  try {
    const data = dataUrlToUint8Array(tc.screenshotDataUrl)
    return [
      new Paragraph({ spacing: { before: 100, after: 20 }, children: [txt('Reference screen (AI-rendered mockup):', { color: SLATE, size: 8 })] }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new ImageRun({ type: 'png', data, transformation: { width: displayW, height: displayH } })],
      }),
    ]
  } catch {
    return []
  }
}

// Build the executable Word test script. Screenshots, when present on the
// cases, are embedded under each case (an AI-rendered Fiori mockup).
export async function exportTestPlanDocx(plan: TestPlan) {
  const sectionLabel = (t: string) =>
    new Paragraph({ spacing: { before: 160, after: 60 }, children: [txt(t, { bold: true, color: NAVY, size: 11 })] })

  const caseBlocks: (Paragraph | Table)[] = []
  plan.testCases.forEach((tc, idx) => {
    if (idx > 0) caseBlocks.push(new Paragraph({ children: [], spacing: { after: 80 } }))
    caseBlocks.push(caseHeading(tc))
    caseBlocks.push(para([txt('Traces to process step: ', { bold: true, color: SLATE, size: 8 }), txt(tc.processStep || '—', { color: SLATE, size: 8 })]))
    caseBlocks.push(propsTable(tc))
    if (tc.preconditions.length) {
      caseBlocks.push(new Paragraph({ spacing: { before: 80, after: 20 }, children: [txt('Preconditions', { bold: true, color: SLATE, size: 9 })] }))
      caseBlocks.push(...bulletList(tc.preconditions))
    }
    const tdt = testDataTable(tc)
    if (tdt) {
      caseBlocks.push(new Paragraph({ spacing: { before: 80, after: 20 }, children: [txt('Test Data', { bold: true, color: SLATE, size: 9 })] }))
      caseBlocks.push(tdt)
    }
    caseBlocks.push(new Paragraph({ spacing: { before: 80, after: 20 }, children: [txt('Test Steps', { bold: true, color: SLATE, size: 9 })] }))
    caseBlocks.push(stepsTable(tc))
    if (tc.expectedResult) {
      caseBlocks.push(para([txt('Overall expected result: ', { bold: true, color: NAVY }), txt(tc.expectedResult)], { spacingAfter: 40 }))
    }
    caseBlocks.push(...screenshotBlock(tc))
  })

  const doc = new Document({
    creator: 'Mach12 Process Studio',
    title: `${plan.processName} — Test Plan`,
    styles: { default: { document: { run: { font: 'Calibri', size: 18 } } } },
    sections: [{
      properties: {},
      children: [
        // ── Title block ──
        new Paragraph({ spacing: { after: 40 }, children: [txt('MACH12 · PROCESS STUDIO', { bold: true, color: BLUE, size: 11 })] }),
        new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 60 }, children: [txt('Functional Test Plan', { bold: true, color: NAVY, size: 24 })] }),
        new Paragraph({ spacing: { after: 20 }, children: [txt(plan.processName, { bold: true, color: NAVY, size: 14 })] }),
        ...(plan.modelTitle ? [new Paragraph({ spacing: { after: 20 }, children: [txt(`Model: ${plan.modelTitle}`, { color: SLATE })] })] : []),
        new Paragraph({ spacing: { after: 40 }, children: [txt(`Generated ${new Date().toISOString().slice(0, 10)} · ${plan.testCases.length} test cases`, { color: SLATE, size: 8 })] }),

        sectionLabel('1. Objective'),
        para([txt(plan.objective || '—')]),
        sectionLabel('2. In Scope'),
        ...bulletList(plan.scope),
        sectionLabel('3. Out of Scope'),
        ...bulletList(plan.outOfScope),
        sectionLabel('4. Prerequisites'),
        ...bulletList(plan.prerequisites),

        new Paragraph({ children: [new PageBreak()] }),
        sectionLabel('5. Test Cases'),
        ...caseBlocks,
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(plan.processName)}_TestPlan.docx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
