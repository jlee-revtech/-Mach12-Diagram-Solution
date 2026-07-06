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
      { x: 0.7, y: 1.3, w: 12, h: 5.6, valign: 'top', fit: 'shrink' })
  }

  const summary = pptx.addSlide()
  summary.addText('Summary', { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 24, bold: true, color: DARK })
  summary.addText(recap.summary, { x: 0.7, y: 1.3, w: 12, h: 5, fontSize: 16, color: DARK, valign: 'top', fit: 'shrink' })

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

  const MAX_Y = 7.15 // bottom bound so nothing runs off the 7.5in slide

  // Does this slide carry any renderable text (beyond a title slide's heading)?
  const slideHasText = (slide: WorkshopSlide): boolean => {
    const blockText = (slide.blocks ?? []).some(
      (b) => !!b.body || (b.bullets?.length ?? 0) > 0 || (b.pros?.length ?? 0) > 0 || (b.cons?.length ?? 0) > 0,
    )
    const bulletText = (slide.bullets?.length ?? 0) > 0 && slide.kind !== 'title'
    return blockText || bulletText
  }

  // Estimate a single card's height by SUMMING every content part it carries
  // (body + bullets + pros/cons can all coexist, e.g. an option with a summary
  // plus pros/cons, or a recommendation with a line plus rationale bullets).
  const bodyLines = (b: WorkshopSlideBlock, w: number) =>
    b.body ? Math.max(0.3, Math.ceil(b.body.length / (w * 7)) * 0.26) : 0
  const estCardHeight = (b: WorkshopSlideBlock, w: number): number => {
    let h = 0.14 + (b.label ? 0.34 : 0)
    h += bodyLines(b, w)
    if (isBulletBlock(b)) h += (b.bullets?.length ?? 0) * 0.28
    if (isProsConsBlock(b)) h += 0.3 + Math.max(b.pros?.length ?? 0, b.cons?.length ?? 0) * 0.28
    return h + 0.16
  }

  // Paint one block card at (x,y) with width w, bounded so its bottom never passes
  // maxY. Renders ALL present content parts (body, then bullets, then pros/cons)
  // stacked, each with fit:'shrink'. Returns the next y.
  const paintCard = (
    s: ReturnType<typeof pptx.addSlide>,
    b: WorkshopSlideBlock,
    x: number,
    y: number,
    w: number,
    maxY: number,
  ): number => {
    const rec = isRecommendationBlock(b)
    const h = Math.max(0.4, Math.min(estCardHeight(b, w), maxY - y))
    const bottom = y + h - 0.1
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h, rectRadius: 0.06,
      fill: { color: rec ? REC_FILL : PANEL },
      line: { color: rec ? REC_BORDER : PANEL_BORDER, width: 1 },
    })
    const ix = x + 0.18, iw = w - 0.36
    let iy = y + 0.14
    if (b.label) {
      s.addText(b.label.toUpperCase(), { x: ix, y: iy, w: iw, h: 0.3, fontSize: 10, bold: true, color: rec ? BLUE : GREY, charSpacing: 1 })
      iy += 0.34
    }
    if (b.body && iy < bottom) {
      const bh = Math.min(Math.max(0.3, bodyLines(b, w)), bottom - iy)
      s.addText(b.body, { x: ix, y: iy, w: iw, h: bh, fontSize: 13, color: DARK, valign: 'top', paraSpaceAfter: 4, fit: 'shrink' })
      iy += bh + 0.06
    }
    if (isBulletBlock(b) && iy < bottom) {
      const bh = Math.min((b.bullets?.length ?? 0) * 0.28, bottom - iy)
      s.addText(bulletRuns(b.bullets ?? [], { color: DARK, fontSize: 12.5 }), { x: ix, y: iy, w: iw, h: bh, valign: 'top', fit: 'shrink' })
      iy += bh + 0.06
    }
    if (isProsConsBlock(b) && iy < bottom) {
      const halfW = (w - 0.5) / 2
      const px = ix, cx = ix + halfW + 0.14
      s.addText('PROS', { x: px, y: iy, w: halfW, h: 0.26, fontSize: 9, bold: true, color: GREEN, charSpacing: 1 })
      s.addText('CONS', { x: cx, y: iy, w: halfW, h: 0.26, fontSize: 9, bold: true, color: RED, charSpacing: 1 })
      const listY = iy + 0.3, listH = Math.max(0.3, bottom - listY)
      const runs = (arr?: string[]) => (arr ?? []).map((t) => ({ text: t, options: { bullet: { characterCode: '2022' }, color: DARK, fontSize: 11.5, paraSpaceAfter: 4 } }))
      const pros = runs(b.pros), cons = runs(b.cons)
      if (pros.length) s.addText(pros, { x: px, y: listY, w: halfW, h: listH, valign: 'top', fit: 'shrink' })
      else s.addText('None', { x: px, y: listY, w: halfW, h: 0.3, fontSize: 11, color: '94A3B8' })
      if (cons.length) s.addText(cons, { x: cx, y: listY, w: halfW, h: listH, valign: 'top', fit: 'shrink' })
      else s.addText('None', { x: cx, y: listY, w: halfW, h: 0.3, fontSize: 11, color: '94A3B8' })
    }
    return y + h + 0.16
  }

  // Render a slide's text into the box (x, y, w) never passing maxY. Single-column
  // stacked cards (robust against overflow) for block slides; context body for a
  // context slide; plain bullets otherwise. Everything shrink-fits.
  const renderTextArea = (
    s: ReturnType<typeof pptx.addSlide>,
    slide: WorkshopSlide,
    x: number,
    y: number,
    w: number,
    maxY: number,
  ) => {
    const blocks = slide.blocks ?? []
    const hasBlockContent = blocks.some(
      (b) => !!b.body || (b.bullets?.length ?? 0) > 0 || (b.pros?.length ?? 0) > 0 || (b.cons?.length ?? 0) > 0,
    )
    if (hasBlockContent) {
      let cy = y
      for (const b of blocks) {
        if (cy >= maxY - 0.3) break
        cy = paintCard(s, b, x, cy, w, maxY)
      }
      return
    }
    if (slide.kind === 'context') {
      const body = blocks.map((b) => b.body).filter(Boolean).join('\n\n')
      const text = body || (slide.bullets ?? []).join('\n')
      if (text) s.addText(text, { x, y, w, h: maxY - y, fontSize: 16, color: DARK, valign: 'top', paraSpaceAfter: 10, fit: 'shrink' })
      return
    }
    const items = (slide.bullets ?? []).filter(Boolean)
    if (items.length) s.addText(bulletRuns(items), { x, y, w, h: maxY - y, valign: 'top', fit: 'shrink' })
  }

  // Contain-fit an image into a box preserving aspect ratio, centered, never larger.
  const placeDiagram = (
    s: ReturnType<typeof pptx.addSlide>,
    data: string,
    aspect: number,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
  ) => {
    if (!data || boxW <= 0 || boxH <= 0) return
    let w = boxW
    let h = w / aspect
    if (h > boxH) { h = boxH; w = h * aspect }
    const x = boxX + (boxW - w) / 2
    const y = boxY + (boxH - h) / 2
    s.addImage({ data, x, y, w, h })
  }

  for (const slide of slides) {
    const s = pptx.addSlide()
    s.background = { color: 'FFFFFF' }

    if (slide.kind === 'title') {
      s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 2.15, w: 2, h: 0.09, fill: { color: BLUE } })
      s.addText(slide.heading, { x: 0.6, y: 2.4, w: 12.1, h: 1.4, fontSize: 34, bold: true, color: DARK, valign: 'top', fit: 'shrink' })
      if (slide.subheading) s.addText(slide.subheading, { x: 0.6, y: 3.9, w: 12.1, h: 0.7, fontSize: 16, color: BLUE, fit: 'shrink' })
      const footer = [meta.customerName, 'Workshop facilitation deck'].filter(Boolean).join('  ·  ')
      s.addText(footer, { x: 0.6, y: 6.6, w: 12.1, h: 0.4, fontSize: 12, color: GREY })
      addNotesIfAny(s, slide.facilitatorNotes)
      continue
    }

    const bodyY = heading(s, slide)
    const hasText = slideHasText(slide)
    const hasDiagram = !!slide.diagram
    const AREA_X = 0.6, AREA_W = 12.13

    if (hasDiagram && hasText) {
      // Rasterize the SAME SVG the HTML surfaces render; lay text + diagram so BOTH
      // show. Rasterization failure skips the image (never throws).
      const { svg, width: dw, height: dh } = renderWorkshopDiagramSvg(slide.diagram!, { width: 1000 })
      const data = await svgToPngDataUrl(svg, dw, dh)
      const aspect = dh > 0 ? dw / dh : 1.6

      if (aspect >= 2.0) {
        // Wide diagram (e.g. layers): text band on top, diagram full-width below.
        const TEXT_H = 2.6
        const textMaxY = Math.min(bodyY + TEXT_H, MAX_Y)
        renderTextArea(s, slide, 0.7, bodyY, AREA_W, textMaxY)
        const diagY = textMaxY + 0.1
        placeDiagram(s, data, aspect, AREA_X, diagY, AREA_W, MAX_Y - diagY)
      } else {
        // Squarer diagram: text in the left column, diagram in the right column.
        const TEXT_W = 6.6
        const GAP = 0.2
        renderTextArea(s, slide, 0.7, bodyY, TEXT_W - 0.1, MAX_Y)
        const rightX = AREA_X + TEXT_W + GAP
        const rightW = AREA_X + AREA_W - rightX
        placeDiagram(s, data, aspect, rightX, bodyY, rightW, MAX_Y - bodyY)
      }
      addNotesIfAny(s, slide.facilitatorNotes)
      continue
    }

    if (hasDiagram && !hasText) {
      // Diagram-only: contain-fit full-width below the heading.
      const { svg, width: dw, height: dh } = renderWorkshopDiagramSvg(slide.diagram!, { width: 1000 })
      const data = await svgToPngDataUrl(svg, dw, dh)
      const aspect = dh > 0 ? dw / dh : 1.6
      placeDiagram(s, data, aspect, AREA_X, bodyY, AREA_W, MAX_Y - bodyY)
      addNotesIfAny(s, slide.facilitatorNotes)
      continue
    }

    // No diagram: render the text full-width below the heading.
    renderTextArea(s, slide, 0.7, bodyY, AREA_W, MAX_Y)
    addNotesIfAny(s, slide.facilitatorNotes)
  }

  const out = (await pptx.write({ outputType: 'blob' })) as Blob
  download(out, `${safe(title)}-facilitation.pptx`)
}
