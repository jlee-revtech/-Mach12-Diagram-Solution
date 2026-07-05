// Client-side recap export: a Word doc and a PowerPoint deck from the workshop
// recap. Uses the app's existing docx + pptxgenjs deps (dynamic-imported so they
// stay out of the server bundle).

import type { WorkshopRecapData, WorkshopSlide, WorkshopSlideBlock } from '@jlee-revtech/agent-core'
import type { Workshop } from '@/lib/workshop/types'
import { renderWorkshopDiagramSvg } from '@/lib/workshop/diagramSvg'

// Rasterize an SVG string to a PNG data URL via an offscreen canvas at 2x for
// crispness. Browser-only (uses Image + canvas). Returns '' on any failure so the
// PPTX export can skip the image instead of throwing.
async function svgToPngDataUrl(svg: string, width: number, height: number): Promise<string> {
  try {
    const scale = 2
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = () => reject(new Error('svg image load failed'))
      im.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}

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

// ─── Facilitation deck (Phase 5) ─────────────────────────────────────────────
// One PPTX slide per WorkshopSlide (the normalized model shared with the HTML
// "Workshop Experience"). Same 16:9 layout + brand palette as the recap deck.
// slide.facilitatorNotes go into PowerPoint speaker notes. Block/bullet/pros/cons
// are all optional, so rendering stays defensive.

type FacilitationMeta = { title: string; customerName?: string; topic?: string; durationMinutes?: number }

// A prose block (body-only, or the recommendation) spans both columns; pros/cons
// and bullet lists sit in one column so options render side by side. Mirrors the
// present view's blockSpan() so the deck and the walkthrough stay consistent.
function isProsConsBlock(b: WorkshopSlideBlock): boolean {
  return (!!b.pros && b.pros.length > 0) || (!!b.cons && b.cons.length > 0)
}
function isBulletBlock(b: WorkshopSlideBlock): boolean {
  return !!b.bullets && b.bullets.length > 0
}
function isRecommendationBlock(b: WorkshopSlideBlock): boolean {
  return (b.label || '').toLowerCase().startsWith('recommend')
}

export async function exportFacilitationPptx(meta: FacilitationMeta, slides: WorkshopSlide[]): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 })
  pptx.layout = 'W'
  const BLUE = '2563EB', DARK = '0F172A', GREY = '475569'
  const GREEN = '059669', RED = 'DC2626', PURPLE = '7C3AED'
  const PANEL = 'F8FAFC', PANEL_BORDER = 'E2E8F0', REC_FILL = 'EFF3FE', REC_BORDER = '9DB8F5'

  const title = meta.title || 'Workshop'

  const addNotesIfAny = (s: ReturnType<typeof pptx.addSlide>, notes?: string) => {
    if (notes && notes.trim()) s.addNotes(notes)
  }

  // Heading band shared by every non-title slide (kicker + heading).
  const heading = (s: ReturnType<typeof pptx.addSlide>, slide: WorkshopSlide) => {
    let y = 0.4
    if (slide.subheading) {
      s.addText(slide.subheading.toUpperCase(), { x: 0.6, y, w: 12.1, h: 0.4, fontSize: 12, bold: true, color: BLUE, charSpacing: 2 })
      y += 0.5
    }
    s.addText(slide.heading, { x: 0.6, y, w: 12.1, h: 0.9, fontSize: 24, bold: true, color: DARK })
    return y + 1.0
  }

  const bulletRuns = (items: string[], opts: { color?: string; fontSize?: number } = {}) =>
    items.map((t) => ({ text: t, options: { bullet: true, color: opts.color ?? DARK, fontSize: opts.fontSize ?? 15, paraSpaceAfter: 6 } }))

  for (const slide of slides) {
    const s = pptx.addSlide()
    s.background = { color: 'FFFFFF' }

    if (slide.kind === 'title') {
      s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 2.15, w: 2, h: 0.09, fill: { color: BLUE } })
      s.addText(slide.heading, { x: 0.6, y: 2.4, w: 12.1, h: 1.4, fontSize: 34, bold: true, color: DARK, valign: 'top' })
      if (slide.subheading) s.addText(slide.subheading, { x: 0.6, y: 3.9, w: 12.1, h: 0.7, fontSize: 16, color: BLUE })
      const footer = [meta.customerName, 'Workshop facilitation deck'].filter(Boolean).join('  ·  ')
      s.addText(footer, { x: 0.6, y: 6.6, w: 12.1, h: 0.4, fontSize: 12, color: GREY })
      addNotesIfAny(s, slide.facilitatorNotes)
      continue
    }

    const bodyY = heading(s, slide)

    // Diagram slide: rasterize the SAME SVG the HTML surfaces render, then place it
    // centered below the heading, preserving aspect ratio. Any caption bullets sit
    // at the bottom. Rasterization failure skips the image (never throws).
    if (slide.diagram) {
      const { svg, width: dw, height: dh } = renderWorkshopDiagramSvg(slide.diagram, { width: 960 })
      const data = await svgToPngDataUrl(svg, dw, dh)
      const captionItems = (slide.bullets ?? []).filter(Boolean)
      const captionH = captionItems.length ? 0.9 : 0
      const areaX = 0.6, areaW = 12.13
      const areaY = bodyY
      const areaH = 7.2 - areaY - captionH
      if (data && areaH > 0.5) {
        const aspect = dw / dh
        let w = areaW
        let h = w / aspect
        if (h > areaH) { h = areaH; w = h * aspect }
        const x = areaX + (areaW - w) / 2
        const y = areaY + (areaH - h) / 2
        s.addImage({ data, x, y, w, h })
      }
      if (captionItems.length) {
        s.addText(bulletRuns(captionItems, { color: GREY, fontSize: 13 }), { x: 0.7, y: 7.2 - captionH + 0.05, w: 12, h: captionH, valign: 'top' })
      }
      addNotesIfAny(s, slide.facilitatorNotes)
      continue
    }

    if (slide.kind === 'agenda' || slide.kind === 'bullets') {
      const items = slide.bullets ?? []
      if (items.length) {
        s.addText(bulletRuns(items), { x: 0.7, y: bodyY, w: 12, h: 7.4 - bodyY - 0.3, valign: 'top' })
      }
      addNotesIfAny(s, slide.facilitatorNotes)
      continue
    }

    if (slide.kind === 'context') {
      const body = (slide.blocks ?? []).map((b) => b.body).filter(Boolean).join('\n\n')
      const text = body || (slide.bullets ?? []).join('\n')
      if (text) s.addText(text, { x: 0.7, y: bodyY, w: 12, h: 7.4 - bodyY - 0.3, fontSize: 16, color: DARK, valign: 'top', paraSpaceAfter: 10 })
      addNotesIfAny(s, slide.facilitatorNotes)
      continue
    }

    // decision + evaluation: render blocks as a 2-column card grid. Prose /
    // recommendation blocks span the full width; pros/cons + bullet blocks sit in
    // a column so options render side by side.
    renderBlocks(s, slide.blocks ?? [], bodyY)
    addNotesIfAny(s, slide.facilitatorNotes)
  }

  function renderBlocks(s: ReturnType<typeof pptx.addSlide>, blocks: WorkshopSlideBlock[], startY: number) {
    const LEFT = 0.6, FULL_W = 12.13, COL_W = 5.96, GAP = 0.21, RIGHT_X = LEFT + COL_W + GAP
    const MAX_Y = 7.2
    let yFull = startY               // running y for full-width (spanning) blocks
    let colY = -1                    // running y once we start a 2-column band (shared top)
    let side: 0 | 1 = 0              // which column comes next
    let yLeft = startY, yRight = startY

    const estHeight = (b: WorkshopSlideBlock, w: number): number => {
      let h = b.label ? 0.35 : 0
      if (b.body) h += Math.max(0.5, Math.ceil(b.body.length / (w * 8)) * 0.28)
      const lines = (b.bullets?.length ?? 0) + (b.pros?.length ?? 0) + (b.cons?.length ?? 0)
      if (isProsConsBlock(b)) h += 0.4 + Math.ceil(Math.max(b.pros?.length ?? 0, b.cons?.length ?? 0)) * 0.3
      else h += lines * 0.3
      return h + 0.4
    }

    const paintCard = (b: WorkshopSlideBlock, x: number, y: number, w: number): number => {
      const rec = isRecommendationBlock(b)
      const h = Math.min(estHeight(b, w), MAX_Y - y)
      s.addShape(pptx.ShapeType.roundRect, {
        x, y, w, h, rectRadius: 0.06,
        fill: { color: rec ? REC_FILL : PANEL },
        line: { color: rec ? REC_BORDER : PANEL_BORDER, width: 1 },
      })
      let iy = y + 0.14
      if (b.label) {
        s.addText(b.label.toUpperCase(), { x: x + 0.18, y: iy, w: w - 0.36, h: 0.3, fontSize: 10, bold: true, color: rec ? BLUE : GREY, charSpacing: 1 })
        iy += 0.34
      }
      if (b.body) {
        s.addText(b.body, { x: x + 0.18, y: iy, w: w - 0.36, h: h - (iy - y) - 0.12, fontSize: 13, color: DARK, valign: 'top', paraSpaceAfter: 6 })
      } else if (isBulletBlock(b)) {
        s.addText(bulletRuns(b.bullets ?? [], { color: DARK, fontSize: 12.5 }), { x: x + 0.18, y: iy, w: w - 0.36, h: h - (iy - y) - 0.12, valign: 'top' })
      } else if (isProsConsBlock(b)) {
        const halfW = (w - 0.5) / 2
        const px = x + 0.18, cx = x + 0.18 + halfW + 0.14
        s.addText('PROS', { x: px, y: iy, w: halfW, h: 0.26, fontSize: 9, bold: true, color: GREEN, charSpacing: 1 })
        s.addText('CONS', { x: cx, y: iy, w: halfW, h: 0.26, fontSize: 9, bold: true, color: RED, charSpacing: 1 })
        const listY = iy + 0.3, listH = h - (listY - y) - 0.12
        const pros = (b.pros ?? []).map((t) => ({ text: t, options: { bullet: { characterCode: '2022' }, color: DARK, fontSize: 11.5, paraSpaceAfter: 4 } }))
        const cons = (b.cons ?? []).map((t) => ({ text: t, options: { bullet: { characterCode: '2022' }, color: DARK, fontSize: 11.5, paraSpaceAfter: 4 } }))
        if (pros.length) s.addText(pros, { x: px, y: listY, w: halfW, h: listH, valign: 'top' })
        else s.addText('None', { x: px, y: listY, w: halfW, h: 0.3, fontSize: 11, color: '94A3B8' })
        if (cons.length) s.addText(cons, { x: cx, y: listY, w: halfW, h: listH, valign: 'top' })
        else s.addText('None', { x: cx, y: listY, w: halfW, h: 0.3, fontSize: 11, color: '94A3B8' })
      }
      return y + h + 0.16
    }

    // A spanning block flushes any open 2-column band first, then paints full width.
    const flushColumns = () => {
      yFull = Math.max(yFull, yLeft, yRight)
      colY = -1; side = 0
    }

    for (const b of blocks) {
      if (colY < 0) { yLeft = yFull; yRight = yFull }
      const span = !isProsConsBlock(b) && !isBulletBlock(b)
      if (span) {
        flushColumns()
        if (yFull >= MAX_Y - 0.4) continue
        yFull = paintCard(b, LEFT, yFull, FULL_W)
        yLeft = yFull; yRight = yFull
      } else {
        colY = Math.min(yLeft, yRight)
        if (side === 0) {
          if (yLeft >= MAX_Y - 0.4) continue
          yLeft = paintCard(b, LEFT, yLeft, COL_W)
          side = 1
        } else {
          if (yRight >= MAX_Y - 0.4) continue
          yRight = paintCard(b, RIGHT_X, yRight, COL_W)
          side = 0
        }
      }
    }
  }

  const out = (await pptx.write({ outputType: 'blob' })) as Blob
  download(out, `${safe(title)}-facilitation.pptx`)
}
