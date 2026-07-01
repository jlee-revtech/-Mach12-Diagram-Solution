// Client-side recap export: a Word doc and a PowerPoint deck from the workshop
// recap. Uses the app's existing docx + pptxgenjs deps (dynamic-imported so they
// stay out of the server bundle).

import type { WorkshopRecapData } from '@jlee-revtech/agent-core'
import type { Workshop } from '@/lib/workshop/types'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'workshop'

export async function exportRecapDocx(ws: Workshop, recap: WorkshopRecapData): Promise<void> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx')
  const P = (text: string, opts: { bullet?: boolean; bold?: boolean } = {}) =>
    new Paragraph({ children: [new TextRun({ text, bold: opts.bold })], ...(opts.bullet ? { bullet: { level: 0 } } : {}) })
  const H = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } })
  const list = (title: string, items: string[]) => (items?.length ? [H(title), ...items.map((i) => P(i, { bullet: true }))] : [])

  const children = [
    new Paragraph({ text: ws.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: [ws.customer_name, recap.headline].filter(Boolean).join(' — '), italics: true })] }),
    new Paragraph({ text: '' }),
    P(recap.summary),
    ...list('Decisions', recap.decisions),
    ...(recap.actions?.length ? [H('Actions'), ...recap.actions.map((a) => P(`${a.title}${a.owner ? ` — ${a.owner}` : ''}${a.due ? ` (due ${a.due})` : ''}`, { bullet: true }))] : []),
    ...list('Deliverables', recap.deliverables),
    ...list('Risks', recap.risks),
    ...list('Open questions', recap.openQuestions),
    ...list('Next steps', recap.nextSteps),
  ]
  const doc = new Document({ sections: [{ children }] })
  download(await Packer.toBlob(doc), `${safe(ws.title)}-recap.docx`)
}

export async function exportRecapPptx(ws: Workshop, recap: WorkshopRecapData): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 })
  pptx.layout = 'W'
  const BLUE = '2563EB', DARK = '0F172A', GREY = '475569'

  // Title
  const t = pptx.addSlide()
  t.background = { color: 'FFFFFF' }
  t.addText(ws.title, { x: 0.6, y: 2.4, w: 12, h: 1, fontSize: 34, bold: true, color: DARK })
  t.addText([ws.customer_name, recap.headline].filter(Boolean).join('  ·  '), { x: 0.6, y: 3.5, w: 12, h: 0.6, fontSize: 16, color: BLUE })
  t.addText('Workshop recap', { x: 0.6, y: 6.6, w: 12, h: 0.4, fontSize: 12, color: GREY })

  const bulletSlide = (title: string, items: string[]) => {
    if (!items?.length) return
    const s = pptx.addSlide()
    s.addText(title, { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 24, bold: true, color: DARK })
    s.addText(items.map((i) => ({ text: i, options: { bullet: true, color: DARK, fontSize: 15, paraSpaceAfter: 6 } })),
      { x: 0.7, y: 1.3, w: 12, h: 5.6, valign: 'top' })
  }

  const summary = pptx.addSlide()
  summary.addText('Summary', { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 24, bold: true, color: DARK })
  summary.addText(recap.summary, { x: 0.7, y: 1.3, w: 12, h: 5, fontSize: 16, color: DARK, valign: 'top' })

  bulletSlide('Decisions', recap.decisions)
  bulletSlide('Actions', (recap.actions || []).map((a) => `${a.title}${a.owner ? ` — ${a.owner}` : ''}${a.due ? ` (due ${a.due})` : ''}`))
  bulletSlide('Deliverables', recap.deliverables)
  bulletSlide('Risks & open questions', [...(recap.risks || []), ...(recap.openQuestions || [])])
  bulletSlide('Next steps', recap.nextSteps)

  const out = (await pptx.write({ outputType: 'blob' })) as Blob
  download(out, `${safe(ws.title)}-recap.pptx`)
}
