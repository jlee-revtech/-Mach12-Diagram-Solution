// Client-side recap export: a Word doc and a PowerPoint deck from the workshop
// recap. Uses the app's existing docx + pptxgenjs deps (dynamic-imported so they
// stay out of the server bundle).

import type { WorkshopRecapData, WorkshopSlide, WorkshopSlideBlock } from '@jlee-revtech/agent-core'
import { renderDocumentHtml } from '@jlee-revtech/agent-core'
import type PptxGenJSType from 'pptxgenjs'
import type { Workshop } from '@/lib/workshop/types'
import { renderWorkshopDiagramSvg } from '@/lib/workshop/diagramSvg'
import { sectionBlocks, type SectionBlock } from '@/lib/deliverables/blocks'

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

// ─── Mach12.ai branding ──────────────────────────────────────────────────────
// The Tesseract brand mark (src/app/icon.svg), inlined so the deck is fully
// self-contained, plus a blue→cyan gradient rule. Both are rasterized to PNG via
// the existing svgToPngDataUrl helper and reused across every slide.
const MACH12_BLUE = '2563EB'

const MACH12_ICON_SVG = `<svg width="76" height="76" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="m12" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2563EB"/><stop offset="100%" stop-color="#06B6D4"/></linearGradient></defs><rect width="76" height="76" rx="16" fill="white"/><g transform="translate(38, 38)"><rect x="-26" y="-26" width="52" height="52" fill="none" stroke="url(#m12)" stroke-width="1.8" opacity="0.2"/><rect x="-12" y="-12" width="24" height="24" fill="none" stroke="url(#m12)" stroke-width="1.8" opacity="0.7"/><line x1="-26" y1="-26" x2="-12" y2="-12" stroke="url(#m12)" stroke-width="1.1" opacity="0.25"/><line x1="26" y1="-26" x2="12" y2="-12" stroke="url(#m12)" stroke-width="1.1" opacity="0.25"/><line x1="26" y1="26" x2="12" y2="12" stroke="url(#m12)" stroke-width="1.1" opacity="0.25"/><line x1="-26" y1="26" x2="-12" y2="12" stroke="url(#m12)" stroke-width="1.1" opacity="0.25"/><polygon points="-26,-26 26,-26 12,-12 -12,-12" fill="#2563EB" opacity="0.22"/><polygon points="26,-26 26,26 12,12 12,-12" fill="#3B82F6" opacity="0.16"/><polygon points="-26,26 26,26 12,12 -12,12" fill="#06B6D4" opacity="0.12"/><polygon points="-26,-26 -26,26 -12,12 -12,-12" fill="#1D4ED8" opacity="0.18"/><rect x="-12" y="-12" width="24" height="24" fill="url(#m12)" opacity="0.12"/><rect x="-5" y="-5" width="10" height="10" rx="1.5" fill="url(#m12)" opacity="0.9"/><circle cx="-26" cy="-26" r="2" fill="#2563EB" opacity="0.45"/><circle cx="26" cy="-26" r="2" fill="#3B82F6" opacity="0.45"/><circle cx="26" cy="26" r="2" fill="#06B6D4" opacity="0.45"/><circle cx="-26" cy="26" r="2" fill="#1D4ED8" opacity="0.45"/><circle cx="-12" cy="-12" r="1.2" fill="#2563EB" opacity="0.6"/><circle cx="12" cy="-12" r="1.2" fill="#3B82F6" opacity="0.6"/><circle cx="12" cy="12" r="1.2" fill="#06B6D4" opacity="0.6"/><circle cx="-12" cy="12" r="1.2" fill="#1D4ED8" opacity="0.6"/></g></svg>`

const mach12BarSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="10" viewBox="0 0 240 10"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2563EB"/><stop offset="1" stop-color="#06B6D4"/></linearGradient></defs><rect width="240" height="10" rx="5" fill="url(#g)"/></svg>`

interface BrandAssets { logo: string; bar: string }

async function loadBrandAssets(): Promise<BrandAssets> {
  const [logo, bar] = await Promise.all([
    svgToPngDataUrl(MACH12_ICON_SVG, 76, 76),
    svgToPngDataUrl(mach12BarSvg(), 240, 10),
  ])
  return { logo, bar }
}

// A slim Mach12.ai footer painted on every slide: a full-width gradient rule, the
// brand mark + wordmark bottom-left, and optional context (customer · deck) with a
// page number bottom-right. Slide layout is 13.333 x 7.5in.
function addBrandFooter(
  s: PptxGenJSType.Slide,
  assets: BrandAssets,
  opts: { context?: string; page?: number; total?: number } = {},
) {
  const GREY = '64748B'
  if (assets.bar) s.addImage({ data: assets.bar, x: 0.6, y: 7.0, w: 12.13, h: 0.035 })
  if (assets.logo) s.addImage({ data: assets.logo, x: 0.6, y: 7.08, w: 0.26, h: 0.26 })
  s.addText('Mach12.ai', { x: 0.92, y: 7.08, w: 2, h: 0.26, fontSize: 10, bold: true, color: MACH12_BLUE, valign: 'middle' })
  const right = [opts.context, opts.page ? `${opts.page}${opts.total ? ` / ${opts.total}` : ''}` : '']
    .filter(Boolean)
    .join('     ')
  if (right) s.addText(right, { x: 6.0, y: 7.08, w: 6.73, h: 0.26, fontSize: 9, color: GREY, align: 'right', valign: 'middle' })
}

// The branded title lockup for the top of a title slide: mark + MACH12.AI wordmark.
function addBrandLockup(s: PptxGenJSType.Slide, assets: BrandAssets) {
  if (assets.logo) s.addImage({ data: assets.logo, x: 0.6, y: 0.55, w: 0.62, h: 0.62 })
  s.addText('MACH12.AI', { x: 1.32, y: 0.55, w: 6, h: 0.62, fontSize: 18, bold: true, color: MACH12_BLUE, charSpacing: 3, valign: 'middle' })
}

export async function exportRecapDocx(ws: Workshop, recap: WorkshopRecapData): Promise<void> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx')
  const P = (text: string, opts: { bullet?: boolean; bold?: boolean } = {}) =>
    new Paragraph({ children: [new TextRun({ text, bold: opts.bold })], ...(opts.bullet ? { bullet: { level: 0 } } : {}) })
  const H = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } })
  const list = (title: string, items: string[]) => (items?.length ? [H(title), ...items.map((i) => P(i, { bullet: true }))] : [])

  const children = [
    new Paragraph({ text: ws.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: [ws.customer_name, recap.headline].filter(Boolean).join(': '), italics: true })] }),
    new Paragraph({ text: '' }),
    P(recap.summary),
    ...list('Decisions', recap.decisions),
    ...(recap.actions?.length ? [H('Actions'), ...recap.actions.map((a) => P(`${a.title}${a.owner ? ` (${a.owner})` : ''}${a.due ? ` (due ${a.due})` : ''}`, { bullet: true }))] : []),
    ...list('Deliverables', recap.deliverables),
    ...list('Risks', recap.risks),
    ...list('Open questions', recap.openQuestions),
    ...list('Next steps', recap.nextSteps),
  ]
  const doc = new Document({ sections: [{ children }] })
  download(await Packer.toBlob(doc), `${safe(ws.title)}-recap.docx`)
}

// ─── Consulting deliverables (Workpackage K2) ────────────────────────────────
// The same docx plumbing, reused (not forked) for the documents the workstream
// agents and the Solution Architect generate. Sections carry markdown, so this
// renders headings, bullets, tables, and paragraphs, then appends the provenance
// appendix: which evidence slot was filled by which tool. In GovCon the appendix
// is the point, not an afterthought.

export interface DeliverableDoc {
  title: string
  dtype: string
  workstream_code: string
  subject?: string | null
  status?: string | null
  created_at?: string | null
  content: { sections?: { key: string; title: string; content: string; blocks?: SectionBlock[] }[] }
  evidence?: { key: string; tool: string; ok: boolean; reason?: string }[]
}

// ─── Enrichment blocks in exports (graceful degradation) ─────────────────────
// Agent-added blocks (tables, SVG visuals, Data Studio diagram refs) ride along
// as markdown appended to the section body: tables become REAL tables everywhere
// (the docx/pptx/html pipelines already parse markdown tables), diagram refs
// become a pointer line, and SVG visuals become a caption line except in the
// PPTX export, which embeds them as rasterized slides when possible.

function tableMarkdown(b: Extract<SectionBlock, { kind: 'table' }>): string {
  const esc = (s: string) => s.replace(/\|/g, '/').replace(/\r?\n/g, ' ')
  const lines = [
    ...(b.title ? [`### ${b.title}`] : []),
    `| ${b.columns.map(esc).join(' | ')} |`,
    `| ${b.columns.map(() => '---').join(' | ')} |`,
    ...b.rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
  ]
  return lines.join('\n')
}

function blockFallbackMarkdown(b: SectionBlock, opts: { svgCaptions: boolean }): string {
  if (b.kind === 'table') return tableMarkdown(b)
  if (b.kind === 'svg') return opts.svgCaptions ? `(Visual: ${b.title || 'diagram'} - see Mach12 Studio)` : ''
  return `(Diagram: ${b.title || 'data architecture'} - open in Mach12 Studio, Data Studio)`
}

/** A section's body with its blocks appended as export-friendly markdown. */
function sectionExportContent(
  s: { content: string; blocks?: SectionBlock[] },
  opts: { svgCaptions: boolean } = { svgCaptions: true },
): string {
  const extras = sectionBlocks(s).map((b) => blockFallbackMarkdown(b, opts)).filter(Boolean)
  return extras.length ? `${s.content}\n\n${extras.join('\n\n')}` : s.content
}

/** Intrinsic SVG dimensions from viewBox (or width/height attrs), for
 *  aspect-correct rasterization. Defaults to the authoring-rule 1200x675. */
function svgDims(svg: string): { w: number; h: number } {
  const vb = svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
  if (vb) {
    const w = parseFloat(vb[1])
    const h = parseFloat(vb[2])
    if (w > 0 && h > 0) return { w, h }
  }
  const wm = svg.match(/\bwidth\s*=\s*["']([\d.]+)/i)
  const hm = svg.match(/\bheight\s*=\s*["']([\d.]+)/i)
  const w = wm ? parseFloat(wm[1]) : 0
  const h = hm ? parseFloat(hm[1]) : 0
  return w > 0 && h > 0 ? { w, h } : { w: 1200, h: 675 }
}

/** Split a markdown block into docx paragraphs and tables. */
async function markdownToDocx(md: string) {
  const { Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType } = await import('docx')
  type Child = InstanceType<typeof Paragraph> | InstanceType<typeof Table>
  const out: Child[] = []
  const lines = md.replace(/\r\n/g, '\n').split('\n')

  // Strip inline markdown emphasis; docx runs carry the styling instead.
  const clean = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1').trim()
  const cellsOf = (row: string) =>
    row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => clean(c))
  const isDivider = (row: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(row) && row.includes('-')

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()

    // Table: a pipe row followed by a divider row.
    if (t.startsWith('|') && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const header = cellsOf(t)
      i += 2
      const body: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        body.push(cellsOf(lines[i]))
        i++
      }
      const width = { size: 100, type: WidthType.PERCENTAGE }
      const mkRow = (cells: string[], bold: boolean) =>
        new TableRow({
          children: cells.map(
            (c) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: c, bold, size: 18 })] })],
              })
          ),
        })
      out.push(new Table({ width, rows: [mkRow(header, true), ...body.map((r) => mkRow(r, false))] }))
      out.push(new Paragraph({ text: '' }))
      continue
    }

    if (!t) {
      i++
      continue
    }
    if (t.startsWith('### ')) out.push(new Paragraph({ text: clean(t.slice(4)), heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 60 } }))
    else if (t.startsWith('## ')) out.push(new Paragraph({ text: clean(t.slice(3)), heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }))
    else if (t.startsWith('# ')) out.push(new Paragraph({ text: clean(t.slice(2)), heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } }))
    else if (/^[-*]\s+/.test(t)) out.push(new Paragraph({ children: [new TextRun({ text: clean(t.replace(/^[-*]\s+/, '')) })], bullet: { level: 0 } }))
    else if (/^\d+[.)]\s+/.test(t)) out.push(new Paragraph({ children: [new TextRun({ text: clean(t) })], bullet: { level: 0 } }))
    else out.push(new Paragraph({ children: [new TextRun({ text: clean(t) })], spacing: { after: 60 } }))
    i++
  }
  return out
}

export async function exportDeliverableDocx(d: DeliverableDoc): Promise<void> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx')
  const sections = d.content?.sections ?? []
  const meta = [d.workstream_code, d.dtype, d.status].filter(Boolean).join(' | ')

  const children: (InstanceType<typeof Paragraph> | Awaited<ReturnType<typeof markdownToDocx>>[number])[] = [
    new Paragraph({ text: d.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: meta, italics: true })] }),
    ...(d.subject ? [new Paragraph({ children: [new TextRun({ text: d.subject, italics: true })] })] : []),
    new Paragraph({ text: '' }),
  ]

  for (const s of sections) {
    children.push(new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_1, spacing: { before: 260, after: 100 } }))
    // Enrichment blocks ride along as markdown: tables render as real Word
    // tables; SVG visuals and diagram refs degrade to caption lines.
    children.push(...(await markdownToDocx(sectionExportContent(s))))
  }

  const ev = d.evidence ?? []
  if (ev.length) {
    children.push(new Paragraph({ text: 'Provenance', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } }))
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${ev.filter((e) => e.ok).length} of ${ev.length} evidence slots were filled. Every factual claim in this document traces to the evidence below.`,
          }),
        ],
        spacing: { after: 100 },
      })
    )
    for (const e of ev) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${e.key} (via ${e.tool}): ${e.ok ? 'gathered' : `NOT gathered, ${e.reason || 'unavailable'}`}` })],
          bullet: { level: 0 },
        })
      )
    }
  }

  const doc = new Document({ sections: [{ children }] })
  download(await Packer.toBlob(doc), `${safe(d.title)}.docx`)
}

/** Download a deliverable (typed or free-form) as a standalone, brand-styled HTML
 *  file. Uses the shared agent-core renderer so HTML and DOCX stay in step. */
export function exportDeliverableHtml(d: DeliverableDoc): void {
  const ev = d.evidence ?? []
  const footer = ev.length
    ? `Provenance: ${ev.filter((e) => e.ok).length} of ${ev.length} evidence slots filled. ${d.workstream_code} / ${d.dtype}.`
    : `${d.workstream_code} / ${d.dtype}.`
  const html = renderDocumentHtml({
    title: d.title,
    subtitle: [d.workstream_code, d.subject].filter(Boolean).join(': ') || undefined,
    // Enrichment blocks degrade to markdown: tables render as real HTML tables,
    // visuals and diagram refs become caption lines.
    sections: (d.content?.sections ?? []).map((s) => ({ title: s.title, content: sectionExportContent(s) })),
    footer,
  })
  download(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safe(d.title)}.html`)
}

// ─── Consulting deliverable → PowerPoint ─────────────────────────────────────
// The third output format for agent documents (HTML and Word above). One slide
// per document section; long sections spill onto continuation slides and markdown
// tables render as real PowerPoint tables, chunked with a repeated header so no
// slide overflows. Same Mach12.ai brand frame as the workshop decks.

type PptxDocBlock =
  | { kind: 'h3'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'table'; header: string[]; rows: string[][] }

/** Parse a section's markdown into slide-renderable blocks. Inline emphasis is
 *  stripped; pptx runs carry the styling. */
function markdownToPptxBlocks(md: string): PptxDocBlock[] {
  const clean = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
  const cellsOf = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => clean(c))
  const isDivider = (row: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(row) && row.includes('-')
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n')
  const out: PptxDocBlock[] = []
  let i = 0
  while (i < lines.length) {
    const t = lines[i].trim()
    if (t.startsWith('|') && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const header = cellsOf(t)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(cellsOf(lines[i]))
        i++
      }
      out.push({ kind: 'table', header, rows })
      continue
    }
    if (!t) { i++; continue }
    if (/^#{1,4}\s+/.test(t)) out.push({ kind: 'h3', text: clean(t.replace(/^#{1,4}\s+/, '')) })
    else if (/^[-*]\s+/.test(t)) out.push({ kind: 'bullet', text: clean(t.replace(/^[-*]\s+/, '')) })
    else if (/^\d+[.)]\s+/.test(t)) out.push({ kind: 'bullet', text: clean(t) })
    else out.push({ kind: 'para', text: clean(t) })
    i++
  }
  return out
}

export async function exportDeliverablePptx(d: DeliverableDoc): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 })
  pptx.layout = 'W'
  const BLUE = '2563EB', DARK = '0F172A', GREY = '475569'
  const assets = await loadBrandAssets()
  const footerContext = [d.workstream_code, 'Consulting document'].filter(Boolean).join('  ·  ')

  // Title slide
  const t = pptx.addSlide()
  t.background = { color: 'FFFFFF' }
  addBrandLockup(t, assets)
  if (assets.bar) t.addImage({ data: assets.bar, x: 0.6, y: 2.15, w: 2.4, h: 0.08 })
  t.addText(d.title, { x: 0.6, y: 2.4, w: 12.1, h: 1.4, fontSize: 32, bold: true, color: DARK, valign: 'top', fit: 'shrink' })
  t.addText([d.workstream_code, d.subject].filter(Boolean).join('  ·  '), { x: 0.6, y: 3.9, w: 12.1, h: 0.6, fontSize: 16, color: BLUE, fit: 'shrink' })
  addBrandFooter(t, assets, { context: 'Consulting document' })

  const MAX_Y = 6.85
  const BODY_X = 0.7, BODY_W = 12.0

  // A fresh content slide with the section heading (and "(cont.)" past the first).
  const newSlide = (heading: string, cont: boolean) => {
    const s = pptx.addSlide()
    s.background = { color: 'FFFFFF' }
    addBrandFooter(s, assets, { context: footerContext })
    s.addText(cont ? `${heading} (cont.)` : heading, { x: 0.6, y: 0.4, w: 12.1, h: 0.7, fontSize: 22, bold: true, color: DARK, fit: 'shrink' })
    return s
  }

  // Rough per-block line estimate at ~110 chars per rendered line, fontSize 13.
  const linesOf = (b: PptxDocBlock) =>
    b.kind === 'table' ? 0 : Math.max(1, Math.ceil(b.text.length / 110)) + (b.kind === 'h3' ? 1 : 0)
  const LINE_H = 0.3
  const LINES_PER_SLIDE = Math.floor((MAX_Y - 1.3) / LINE_H) // ≈ 18

  const runFor = (b: Exclude<PptxDocBlock, { kind: 'table' }>) => {
    if (b.kind === 'h3') return { text: b.text, options: { bold: true, color: DARK, fontSize: 15, paraSpaceBefore: 10, paraSpaceAfter: 4, breakLine: true } }
    if (b.kind === 'bullet') return { text: b.text, options: { bullet: true, color: DARK, fontSize: 13, paraSpaceAfter: 5, breakLine: true } }
    return { text: b.text, options: { color: GREY, fontSize: 13, paraSpaceAfter: 8, breakLine: true } }
  }

  const TABLE_ROWS_PER_SLIDE = 9

  for (const section of d.content?.sections ?? []) {
    const heading = section.title || 'Section'
    // Table and diagram-ref blocks ride along as markdown (tables become real
    // PowerPoint tables); SVG visuals are embedded as their own slides below.
    const svgVisuals = sectionBlocks(section).filter((b): b is Extract<SectionBlock, { kind: 'svg' }> => b.kind === 'svg')
    const blocks = markdownToPptxBlocks(sectionExportContent(section, { svgCaptions: false }))
    if (!blocks.length && !svgVisuals.length) continue

    let cont = false
    let pendingText: Exclude<PptxDocBlock, { kind: 'table' }>[] = []
    let pendingLines = 0

    const flushText = () => {
      if (!pendingText.length) return
      const s = newSlide(heading, cont)
      cont = true
      s.addText(pendingText.map(runFor), { x: BODY_X, y: 1.3, w: BODY_W, h: MAX_Y - 1.3, valign: 'top', fit: 'shrink' })
      pendingText = []
      pendingLines = 0
    }

    for (const b of blocks) {
      if (b.kind === 'table') {
        flushText()
        for (let r = 0; r < Math.max(1, b.rows.length); r += TABLE_ROWS_PER_SLIDE) {
          const s = newSlide(heading, cont)
          cont = true
          const chunk = b.rows.slice(r, r + TABLE_ROWS_PER_SLIDE)
          const mkCell = (text: string, bold: boolean) => ({
            text,
            options: { bold, fontSize: 11, color: bold ? DARK : GREY, fill: { color: bold ? 'F1F5F9' : 'FFFFFF' } },
          })
          s.addTable([b.header.map((c) => mkCell(c, true)), ...chunk.map((row) => row.map((c) => mkCell(c, false)))], {
            x: 0.6, y: 1.3, w: 12.13,
            border: { type: 'solid', pt: 0.5, color: 'CBD5E1' },
            valign: 'top',
            autoPage: false,
          })
        }
        continue
      }
      const l = linesOf(b)
      if (pendingLines + l > LINES_PER_SLIDE) flushText()
      pendingText.push(b)
      pendingLines += l
    }
    flushText()

    // Agent-authored SVG visuals: one slide each, rasterized with the existing
    // helper and contain-fit. Rasterization failure degrades to a caption line.
    for (const v of svgVisuals) {
      const { w, h } = svgDims(v.svg)
      const data = await svgToPngDataUrl(v.svg, w, h)
      const s = newSlide(v.title || heading, cont)
      cont = true
      if (data) {
        const boxX = 0.6, boxY = 1.3, boxW = 12.13, boxH = MAX_Y - 1.3
        let iw = boxW
        let ih = h > 0 ? iw * (h / w) : boxH
        if (ih > boxH) { ih = boxH; iw = w > 0 ? ih * (w / h) : boxW }
        s.addImage({ data, x: boxX + (boxW - iw) / 2, y: boxY + (boxH - ih) / 2, w: iw, h: ih })
      } else {
        s.addText(`(Visual: ${v.title || 'diagram'} - see Mach12 Studio)`, {
          x: BODY_X, y: 1.3, w: BODY_W, h: 0.6, fontSize: 13, color: GREY, valign: 'top',
        })
      }
    }
  }

  // Provenance: in GovCon the evidence trail is part of the document.
  const ev = d.evidence ?? []
  if (ev.length) {
    const s = newSlide('Provenance', false)
    const runs = [
      { text: `${ev.filter((e) => e.ok).length} of ${ev.length} evidence slots were filled. Every factual claim traces to the evidence below.`, options: { color: GREY, fontSize: 13, paraSpaceAfter: 10, breakLine: true } },
      ...ev.map((e) => ({
        text: `${e.key} (via ${e.tool}): ${e.ok ? 'gathered' : `NOT gathered, ${e.reason || 'unavailable'}`}`,
        options: { bullet: true, color: e.ok ? DARK : GREY, fontSize: 12, paraSpaceAfter: 4, breakLine: true },
      })),
    ]
    s.addText(runs, { x: BODY_X, y: 1.3, w: BODY_W, h: MAX_Y - 1.3, valign: 'top', fit: 'shrink' })
  }

  const out = (await pptx.write({ outputType: 'blob' })) as Blob
  download(out, `${safe(d.title)}.pptx`)
}

export async function exportRecapPptx(ws: Workshop, recap: WorkshopRecapData): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 })
  pptx.layout = 'W'
  const BLUE = '2563EB', DARK = '0F172A'
  const assets = await loadBrandAssets()
  const footerContext = [ws.customer_name, 'Workshop recap'].filter(Boolean).join('  ·  ')

  // Title
  const t = pptx.addSlide()
  t.background = { color: 'FFFFFF' }
  addBrandLockup(t, assets)
  if (assets.bar) t.addImage({ data: assets.bar, x: 0.6, y: 2.15, w: 2.4, h: 0.08 })
  t.addText(ws.title, { x: 0.6, y: 2.4, w: 12, h: 1, fontSize: 34, bold: true, color: DARK })
  t.addText([ws.customer_name, recap.headline].filter(Boolean).join('  ·  '), { x: 0.6, y: 3.5, w: 12, h: 0.6, fontSize: 16, color: BLUE })
  addBrandFooter(t, assets, { context: 'Workshop recap' })

  const bulletSlide = (title: string, items: string[]) => {
    if (!items?.length) return
    const s = pptx.addSlide()
    s.addText(title, { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 24, bold: true, color: DARK })
    s.addText(items.map((i) => ({ text: i, options: { bullet: true, color: DARK, fontSize: 15, paraSpaceAfter: 6 } })),
      { x: 0.7, y: 1.3, w: 12, h: 5.4, valign: 'top', fit: 'shrink' })
    addBrandFooter(s, assets, { context: footerContext })
  }

  const summary = pptx.addSlide()
  summary.addText('Summary', { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 24, bold: true, color: DARK })
  summary.addText(recap.summary, { x: 0.7, y: 1.3, w: 12, h: 5, fontSize: 16, color: DARK, valign: 'top', fit: 'shrink' })
  addBrandFooter(summary, assets, { context: footerContext })

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
  const assets = await loadBrandAssets()
  const footerContext = [meta.customerName, 'Facilitation deck'].filter(Boolean).join('  ·  ')

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

  const MAX_Y = 6.85 // bottom bound so content clears the Mach12.ai brand footer

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

  let pageNum = 0
  const totalPages = slides.length
  for (const slide of slides) {
    const s = pptx.addSlide()
    s.background = { color: 'FFFFFF' }
    pageNum += 1

    if (slide.kind === 'title') {
      addBrandLockup(s, assets)
      if (assets.bar) s.addImage({ data: assets.bar, x: 0.6, y: 2.15, w: 2.4, h: 0.08 })
      else s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 2.15, w: 2, h: 0.09, fill: { color: BLUE } })
      s.addText(slide.heading, { x: 0.6, y: 2.4, w: 12.1, h: 1.4, fontSize: 34, bold: true, color: DARK, valign: 'top', fit: 'shrink' })
      if (slide.subheading) s.addText(slide.subheading, { x: 0.6, y: 3.9, w: 12.1, h: 0.7, fontSize: 16, color: BLUE, fit: 'shrink' })
      addBrandFooter(s, assets, { context: 'Facilitation deck' })
      addNotesIfAny(s, slide.facilitatorNotes)
      continue
    }

    // Mach12.ai brand footer on every content slide (drawn first; content is
    // bounded by MAX_Y so it never collides).
    addBrandFooter(s, assets, { context: footerContext, page: pageNum, total: totalPages })

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
