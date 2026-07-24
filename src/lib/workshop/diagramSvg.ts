// Pure, DOM-free renderer that turns a typed WorkshopDiagram (from agent-core)
// into a self-contained SVG string. ONE representation drives every surface: the
// section editor + the Workshop Experience walkthrough inject this SVG, and the
// PPTX exporter rasterizes the SAME SVG to PNG (svgToPngDataUrl in export.ts).
//
// Follows the `diagrams` skill rules: elbow / orthogonal connectors only (never a
// diagonal), connections dock to face centers with a small arrowhead gap, boxes are
// sized to their measured text so nothing overlaps, consistent sizing + grid
// alignment, layered spacing, and the enterprise brand palette. No external CSS or
// fonts (system font stack, inline attributes) so the string embeds anywhere and
// rasterizes deterministically.

import type { WorkshopDiagram } from '@jlee-revtech/agent-core'

// ─── Brand palette + type scale ──────────────────────────────────────────────
const BRAND = {
  blue: '#2563EB',
  cyan: '#06B6D4',
  ink: '#0F172A',
  slate: '#475569',
  muted: '#94A3B8',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  surface: '#FFFFFF',
  panel: '#F8FAFC',
  panelAlt: '#EEF2F7',
  blueTint: '#EFF3FE',
  blueBorder: '#9DB8F5',
  green: '#059669',
  amber: '#D97706',
  red: '#DC2626',
  violet: '#7C3AED',
} as const

const FONT =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

// Rough monospace-ish estimate: average glyph advance is ~0.58em for this stack.
const CHAR_W = 0.58

function estTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_W
}

// XML-escape any text that lands inside an SVG text node or attribute.
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Greedy word-wrap to at most `maxLines` lines that each fit `maxWidth` px. The
// last line is ellipsized if the text overflows. Returns the wrapped lines.
function wrapText(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const clean = String(text ?? '').trim()
  if (!clean) return ['']
  const words = clean.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (estTextWidth(candidate, fontSize) <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = w
      if (lines.length === maxLines - 1) break
    }
  }
  if (lines.length < maxLines) lines.push(line)
  // If there is still unplaced text, ellipsize the final line.
  const placed = lines.join(' ')
  if (placed.length < clean.length) {
    let last = lines[lines.length - 1] ?? ''
    while (last && estTextWidth(`${last}…`, fontSize) > maxWidth) {
      last = last.replace(/\s*\S*$/, '')
    }
    lines[lines.length - 1] = `${last.trimEnd()}…`
  }
  return lines.filter((_, i) => i < maxLines)
}

// Truncate a single line to fit maxWidth px, adding an ellipsis when it overflows.
function ellipsize(text: string, fontSize: number, maxWidth: number): string {
  const t = String(text ?? '')
  if (estTextWidth(t, fontSize) <= maxWidth) return t
  let s = t
  while (s && estTextWidth(`${s}…`, fontSize) > maxWidth) s = s.slice(0, -1)
  return `${s.trimEnd()}…`
}

// One <text> with tspan lines centered on (cx, topY). Line height = fontSize*1.25.
function textLines(
  lines: string[],
  cx: number,
  topY: number,
  fontSize: number,
  color: string,
  opts: { weight?: number; anchor?: 'middle' | 'start' | 'end' } = {},
): string {
  const lh = fontSize * 1.25
  const anchor = opts.anchor ?? 'middle'
  const weight = opts.weight ?? 400
  const tspans = lines
    .map(
      (ln, i) =>
        `<tspan x="${cx.toFixed(1)}" y="${(topY + fontSize + i * lh).toFixed(1)}">${esc(ln)}</tspan>`,
    )
    .join('')
  return `<text text-anchor="${anchor}" font-family="${FONT}" font-size="${fontSize}" font-weight="${weight}" fill="${color}">${tspans}</text>`
}

// A single left-anchored line of text (no wrap).
function textLine(
  s: string,
  x: number,
  baseline: number,
  fontSize: number,
  color: string,
  opts: { weight?: number; anchor?: 'middle' | 'start' | 'end'; spacing?: number } = {},
): string {
  const anchor = opts.anchor ?? 'start'
  const weight = opts.weight ?? 400
  const spacing = opts.spacing ? ` letter-spacing="${opts.spacing}"` : ''
  return `<text x="${x.toFixed(1)}" y="${baseline.toFixed(1)}" text-anchor="${anchor}" font-family="${FONT}" font-size="${fontSize}" font-weight="${weight}"${spacing} fill="${color}">${esc(s)}</text>`
}

function roundRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke: string,
  strokeWidth = 1,
): string {
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`
}

// The reusable arrowhead marker (filled triangle) used by every connector.
const ARROW_ID = 'wd-arrow'
function defs(): string {
  return `<defs><marker id="${ARROW_ID}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0.5,0.5 L9.5,5 L0.5,9.5 z" fill="${BRAND.slate}" /></marker></defs>`
}

// Orthogonal connector as an H/V-only <path>. Never a diagonal segment.
function elbowPath(d: string): string {
  return `<path d="${d}" fill="none" stroke="${BRAND.slate}" stroke-width="1.5" marker-end="url(#${ARROW_ID})" />`
}

// A short opaque label chip centered on (cx, cy) so an edge label never sits
// transparently on a line or a box.
function edgeLabelChip(label: string, cx: number, cy: number, fontSize = 11, width?: number): string {
  const w = width ?? estTextWidth(label, fontSize) + 12
  const h = fontSize + 7
  // Ellipsize to the chip so text never spills past the opaque background.
  const shown = ellipsize(label, fontSize, w - 12)
  return (
    roundRect(cx - w / 2, cy - h / 2, w, h, 3, BRAND.surface, BRAND.border, 1) +
    textLine(shown, cx, cy + fontSize * 0.35, fontSize, BRAND.slate, { anchor: 'middle' })
  )
}

// ─── Shared frame: title band + caption + white surface ──────────────────────
interface Frame {
  padX: number
  titleY: number // baseline of title (0 if none)
  contentTop: number
  captionH: number
}

function frameFor(d: WorkshopDiagram): Frame {
  const padX = 24
  const hasTitle = !!(d.title && d.title.trim())
  const titleY = hasTitle ? 40 : 0
  const contentTop = hasTitle ? 58 : 24
  const captionH = d.caption && d.caption.trim() ? 30 : 0
  return { padX, titleY, contentTop, captionH }
}

function shell(inner: string, width: number, height: number, d: WorkshopDiagram, f: Frame): SvgResult {
  const titleEl = d.title && d.title.trim()
    ? textLine(d.title.trim(), f.padX, f.titleY, 17, BRAND.ink, { weight: 700 })
    : ''
  const captionEl = d.caption && d.caption.trim()
    ? textLine(d.caption.trim(), f.padX, height - 12, 12, BRAND.slate, { weight: 400 })
    : ''
  const accent = d.title && d.title.trim()
    ? `<rect x="${f.padX}" y="${f.titleY + 8}" width="34" height="3" rx="1.5" fill="${BRAND.blue}" />`
    : ''
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"${d.title ? ` aria-label="${esc(d.title)}"` : ''}>` +
    defs() +
    roundRect(0.5, 0.5, width - 1, height - 1, 12, BRAND.surface, BRAND.border, 1) +
    titleEl +
    accent +
    inner +
    captionEl +
    `</svg>`
  return { svg, width, height }
}

export interface SvgResult {
  svg: string
  width: number
  height: number
}

// ─── flow ────────────────────────────────────────────────────────────────────
// A row of rounded-rect step boxes left to right, wrapping after ~4 per row.
// Elbow arrows connect consecutive steps; a wrapped row connects down-then-into
// the first box of the next row.
function renderFlow(d: WorkshopDiagram, requestedWidth: number, f: Frame): SvgResult {
  const steps = (d.steps ?? []).filter((s) => s && (s.label || s.sublabel))
  if (steps.length === 0) return renderEmpty(d, requestedWidth, f, 'No steps to show')

  const LABEL_FS = 13
  const SUB_FS = 11
  const PAD_X = 14
  const PAD_Y = 12
  const GAP_X = 44 // horizontal gap (room for the elbow arrow)
  const GAP_Y = 56 // vertical gap between wrapped rows
  const MAX_PER_ROW = 4
  const MIN_BOX_W = 120
  const MAX_BOX_W = 220

  // Measure every box first (skill rule: size to content before layout).
  const boxes = steps.map((s) => {
    const labelMax = MAX_BOX_W - PAD_X * 2
    const labelLines = wrapText(s.label ?? '', LABEL_FS, labelMax, 2)
    const subLines = s.sublabel ? wrapText(s.sublabel, SUB_FS, labelMax, 1) : []
    const contentW = Math.max(
      ...labelLines.map((l) => estTextWidth(l, LABEL_FS)),
      ...subLines.map((l) => estTextWidth(l, SUB_FS)),
      0,
    )
    const w = Math.max(MIN_BOX_W, Math.min(MAX_BOX_W, Math.ceil(contentW) + PAD_X * 2))
    const h =
      PAD_Y * 2 +
      labelLines.length * (LABEL_FS * 1.25) +
      (subLines.length ? subLines.length * (SUB_FS * 1.3) + 4 : 0)
    return { labelLines, subLines, w, h }
  })

  // Uniform box height + width per column band keeps the grid crisp.
  const boxH = Math.max(...boxes.map((b) => b.h))
  const perRow = Math.min(MAX_PER_ROW, boxes.length)

  // Grow the SVG so the widest per-row grouping fits instead of clipping. Measure
  // each row's natural width using the same per-row grouping the layout uses below.
  let maxRowW = 0
  for (let r = 0; r < boxes.length; r += perRow) {
    const rowBoxes = boxes.slice(r, r + perRow)
    const rowW = rowBoxes.reduce((acc, b) => acc + b.w, 0) + GAP_X * Math.max(0, rowBoxes.length - 1)
    if (rowW > maxRowW) maxRowW = rowW
  }
  const naturalWidth = f.padX * 2 + maxRowW
  const width = Math.min(1600, Math.max(requestedWidth, Math.ceil(naturalWidth)))

  // Lay boxes into rows; center each row horizontally in the available width.
  const availW = width - f.padX * 2
  const rows: { x: number; y: number; w: number; h: number; idx: number }[][] = []
  let i = 0
  let rowTop = f.contentTop
  while (i < boxes.length) {
    const rowBoxes = boxes.slice(i, i + perRow)
    const rowW = rowBoxes.reduce((acc, b) => acc + b.w, 0) + GAP_X * (rowBoxes.length - 1)
    let x = f.padX + Math.max(0, (availW - rowW) / 2)
    const placed = rowBoxes.map((b, k) => {
      const box = { x, y: rowTop, w: b.w, h: boxH, idx: i + k }
      x += b.w + GAP_X
      return box
    })
    rows.push(placed)
    rowTop += boxH + GAP_Y
    i += perRow
  }

  const flat = rows.flat()
  const height = rowTop - GAP_Y + PAD_Y + f.captionH + 10

  // Boxes.
  let out = ''
  flat.forEach((box, k) => {
    const b = boxes[k]!
    const isFirst = k === 0
    out += roundRect(
      box.x,
      box.y,
      box.w,
      box.h,
      10,
      isFirst ? BRAND.blueTint : BRAND.panel,
      isFirst ? BRAND.blueBorder : BRAND.borderStrong,
      1.25,
    )
    // Step number chip top-left.
    const numR = 9
    out += `<circle cx="${(box.x + numR + 4).toFixed(1)}" cy="${(box.y + numR + 4).toFixed(1)}" r="${numR}" fill="${BRAND.blue}" />`
    out += textLine(String(k + 1), box.x + numR + 4, box.y + numR + 4 + 3.5, 10, BRAND.surface, {
      anchor: 'middle',
      weight: 700,
    })
    const labelH = b.labelLines.length * (LABEL_FS * 1.25)
    const contentH = labelH + (b.subLines.length ? b.subLines.length * (SUB_FS * 1.3) + 4 : 0)
    const cy = box.y + (box.h - contentH) / 2
    out += textLines(b.labelLines, box.x + box.w / 2, cy, LABEL_FS, BRAND.ink, { weight: 600 })
    if (b.subLines.length) {
      out += textLines(b.subLines, box.x + box.w / 2, cy + labelH + 2, SUB_FS, BRAND.slate)
    }
  })

  // Connectors: consecutive steps. Within a row, right-face -> left-face (H).
  // Wrapping to a new row: down from the last box, across, and up-into the first
  // box of the next row via an orthogonal Z-elbow (no diagonal).
  const GAP = 6
  for (let k = 0; k < flat.length - 1; k++) {
    const a = flat[k]!
    const b = flat[k + 1]!
    const sameRow = Math.abs(a.y - b.y) < 1
    if (sameRow) {
      const y = a.y + a.h / 2
      out += elbowPath(`M ${(a.x + a.w).toFixed(1)} ${y.toFixed(1)} H ${(b.x - GAP).toFixed(1)}`)
    } else {
      // Route from the bottom-center of `a` down to a mid gutter, across to the
      // top-center of `b`, then into it. All H/V segments.
      const ax = a.x + a.w / 2
      const ay = a.y + a.h
      const bx = b.x + b.w / 2
      const by = b.y
      const midY = ay + GAP_Y / 2
      out += elbowPath(
        `M ${ax.toFixed(1)} ${ay.toFixed(1)} V ${midY.toFixed(1)} H ${bx.toFixed(1)} V ${(by - GAP).toFixed(1)}`,
      )
    }
  }

  return shell(out, width, Math.ceil(height), d, f)
}

// ─── matrix ──────────────────────────────────────────────────────────────────
// A table: header row (columns) + a left header column (rows[].label). Cells from
// rows[].cells. Even column widths sized to the widest cell; zebra header shading.
function renderMatrix(d: WorkshopDiagram, requestedWidth: number, f: Frame): SvgResult {
  const columns = (d.columns ?? []).map((c) => String(c ?? ''))
  const rows = (d.rows ?? []).filter((r) => r && (r.label || (r.cells && r.cells.length)))
  if (columns.length === 0 && rows.length === 0)
    return renderEmpty(d, requestedWidth, f, 'No table data to show')

  const FS = 12.5
  const HEAD_FS = 12.5
  const CELL_PAD_X = 12
  const CELL_PAD_Y = 9
  const nCols = columns.length
  const nDataCols = nCols // right-side value columns

  // Label column sized to widest row label.
  const labelTexts = rows.map((r) => String(r.label ?? ''))
  const labelColW = Math.max(
    110,
    Math.min(
      240,
      Math.ceil(Math.max(0, ...labelTexts.map((t) => estTextWidth(t, FS)))) + CELL_PAD_X * 2,
    ),
  )

  // Grow the SVG so every data column keeps a comfortable, readable width instead of
  // being squeezed (or overflowing) at a fixed canvas size.
  const desiredDataColW = 150
  const naturalWidth = f.padX * 2 + labelColW + desiredDataColW * nDataCols
  const width = Math.min(1600, Math.max(requestedWidth, Math.ceil(naturalWidth)))

  const availW = width - f.padX * 2
  // Data columns fill the (now sufficient) remaining width evenly.
  const dataColW = nDataCols > 0 ? Math.max(desiredDataColW, (availW - labelColW) / nDataCols) : 0

  // Wrap every cell to its column width, then row height = tallest cell.
  const wrapCol = (text: string, colW: number, fs: number) =>
    wrapText(text, fs, colW - CELL_PAD_X * 2, 3)

  const headerLines = columns.map((c) => wrapCol(c, dataColW, HEAD_FS))
  const headerCornerLines = wrapCol('', labelColW, HEAD_FS)
  const headerH =
    Math.max(1, ...headerLines.map((l) => l.length), headerCornerLines.length) * (HEAD_FS * 1.25) +
    CELL_PAD_Y * 2

  const rowData = rows.map((r) => {
    const labelLines = wrapCol(String(r.label ?? ''), labelColW, FS)
    const cells = Array.from({ length: nDataCols }, (_, c) =>
      wrapCol(String((r.cells ?? [])[c] ?? ''), dataColW, FS),
    )
    const nLines = Math.max(1, labelLines.length, ...cells.map((cl) => cl.length))
    const h = nLines * (FS * 1.25) + CELL_PAD_Y * 2
    return { labelLines, cells, h }
  })

  const tableW = labelColW + dataColW * nDataCols
  const x0 = f.padX + Math.max(0, (availW - tableW) / 2)
  const y0 = f.contentTop
  let y = y0
  let out = ''

  // Header band.
  out += roundRect(x0, y, tableW, headerH, 6, BRAND.blue, BRAND.blue, 1)
  // Corner (empty) cell just carries the band color.
  // Header column labels.
  let cx = x0 + labelColW
  headerLines.forEach((lines, c) => {
    const centerX = cx + dataColW / 2
    const th = lines.length * (HEAD_FS * 1.25)
    const top = y + (headerH - th) / 2
    out += textLines(lines, centerX, top, HEAD_FS, BRAND.surface, { weight: 700 })
    cx += dataColW
    // vertical divider between header cells
    if (c < nDataCols - 1)
      out += `<line x1="${cx.toFixed(1)}" y1="${(y + 6).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(y + headerH - 6).toFixed(1)}" stroke="${BRAND.surface}" stroke-opacity="0.35" stroke-width="1" />`
  })
  y += headerH

  // Data rows.
  rowData.forEach((rd, ri) => {
    const zebra = ri % 2 === 1
    out += `<rect x="${x0.toFixed(1)}" y="${y.toFixed(1)}" width="${tableW.toFixed(1)}" height="${rd.h.toFixed(1)}" fill="${zebra ? BRAND.panel : BRAND.surface}" />`
    // Left label cell (tinted).
    out += `<rect x="${x0.toFixed(1)}" y="${y.toFixed(1)}" width="${labelColW.toFixed(1)}" height="${rd.h.toFixed(1)}" fill="${BRAND.panelAlt}" />`
    const lth = rd.labelLines.length * (FS * 1.25)
    out += textLines(rd.labelLines, x0 + labelColW / 2, y + (rd.h - lth) / 2, FS, BRAND.ink, {
      weight: 600,
    })
    // Data cells.
    let dxx = x0 + labelColW
    rd.cells.forEach((cl) => {
      const cth = cl.length * (FS * 1.25)
      out += textLines(cl, dxx + dataColW / 2, y + (rd.h - cth) / 2, FS, BRAND.slate)
      dxx += dataColW
    })
    // Row bottom border.
    out += `<line x1="${x0.toFixed(1)}" y1="${(y + rd.h).toFixed(1)}" x2="${(x0 + tableW).toFixed(1)}" y2="${(y + rd.h).toFixed(1)}" stroke="${BRAND.border}" stroke-width="1" />`
    y += rd.h
  })

  // Vertical column dividers over the data area.
  let vx = x0 + labelColW
  for (let c = 0; c <= nDataCols; c++) {
    out += `<line x1="${vx.toFixed(1)}" y1="${(y0 + headerH).toFixed(1)}" x2="${vx.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${BRAND.border}" stroke-width="1" />`
    vx += dataColW
  }
  // Outer table border.
  out += roundRect(x0, y0, tableW, y - y0, 6, 'none', BRAND.borderStrong, 1.25)

  const height = y + 14 + f.captionH
  return shell(out, width, Math.ceil(height), d, f)
}

// ─── quadrant ─────────────────────────────────────────────────────────────────
// A square plot; two axes cross at center; the four low/high labels sit at the
// axis ends; faint quadrant fills; points plotted at (x,y) in 0..1 (y up).
function renderQuadrant(d: WorkshopDiagram, requestedWidth: number, f: Frame): SvgResult {
  const points = (d.points ?? []).filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number')
  const hasAxes = !!(d.xAxis || d.yAxis)
  if (points.length === 0 && !hasAxes) return renderEmpty(d, requestedWidth, f, 'No plot data to show')

  const AX_FS = 11
  const LBL_FS = 11

  // Size the left/right gutters to the horizontal axis-end labels (wrapped) so they
  // never clip off the frame; then grow the SVG so plot + both gutters always fit.
  const GUT_MIN = 56
  const GUT_MAX = 170
  const wrapAx = (t?: string) => (t && t.trim() ? wrapText(t.trim(), AX_FS, GUT_MAX - 14, 2) : [])
  const xLowLines = wrapAx(d.xAxis?.low)
  const xHighLines = wrapAx(d.xAxis?.high)
  const gutFor = (lines: string[]) =>
    lines.length
      ? Math.min(GUT_MAX, Math.max(GUT_MIN, Math.ceil(Math.max(0, ...lines.map((l) => estTextWidth(l, AX_FS)))) + 14))
      : GUT_MIN
  const leftGut = gutFor(xLowLines)
  const rightGut = gutFor(xHighLines)

  const PLOT_TARGET = 380
  const naturalWidth = f.padX * 2 + leftGut + rightGut + PLOT_TARGET
  const width = Math.min(1100, Math.max(requestedWidth, Math.ceil(naturalWidth)))
  const availW = width - f.padX * 2
  const plot = Math.max(220, Math.min(PLOT_TARGET + 80, availW - leftGut - rightGut))
  const plotX = f.padX + leftGut + Math.max(0, (availW - leftGut - rightGut - plot) / 2)
  const plotY = f.contentTop + AX_FS + 8 // room for the top y-axis label
  const cx = plotX + plot / 2
  const cy = plotY + plot / 2

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
  const px = (x: number) => plotX + clamp01(x) * plot
  const py = (y: number) => plotY + (1 - clamp01(y)) * plot // y up

  let out = ''
  // Faint quadrant fills (checkerboard tint).
  const half = plot / 2
  const fills = [
    { x: plotX, y: plotY, c: BRAND.panel }, // top-left
    { x: cx, y: plotY, c: BRAND.blueTint }, // top-right (favored)
    { x: plotX, y: cy, c: BRAND.surface }, // bottom-left
    { x: cx, y: cy, c: BRAND.panel }, // bottom-right
  ]
  fills.forEach((q) => {
    out += `<rect x="${q.x.toFixed(1)}" y="${q.y.toFixed(1)}" width="${half.toFixed(1)}" height="${half.toFixed(1)}" fill="${q.c}" fill-opacity="0.7" />`
  })
  out += roundRect(plotX, plotY, plot, plot, 8, 'none', BRAND.borderStrong, 1.25)
  out += `<line x1="${plotX.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(plotX + plot).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${BRAND.slate}" stroke-width="1.25" />`
  out += `<line x1="${cx.toFixed(1)}" y1="${plotY.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(plotY + plot).toFixed(1)}" stroke="${BRAND.slate}" stroke-width="1.25" />`

  // Axis-end labels, kept inside the sized gutters (x wraps, centered on the axis).
  const lh = AX_FS * 1.25
  if (xLowLines.length) out += textLines(xLowLines, plotX - 8, cy - (xLowLines.length * lh) / 2, AX_FS, BRAND.slate, { anchor: 'end', weight: 600 })
  if (xHighLines.length) out += textLines(xHighLines, plotX + plot + 8, cy - (xHighLines.length * lh) / 2, AX_FS, BRAND.slate, { anchor: 'start', weight: 600 })
  if (d.yAxis?.high) out += textLine(ellipsize(String(d.yAxis.high), AX_FS, plot - 12), cx, plotY - 8, AX_FS, BRAND.slate, { anchor: 'middle', weight: 600 })
  if (d.yAxis?.low) out += textLine(ellipsize(String(d.yAxis.low), AX_FS, plot - 12), cx, plotY + plot + AX_FS + 8, AX_FS, BRAND.slate, { anchor: 'middle', weight: 600 })

  // Dots first (so labels + leaders sit on top).
  const R = 6
  points.forEach((p) => {
    out += `<circle cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="${R}" fill="${BRAND.blue}" stroke="${BRAND.surface}" stroke-width="1.5" />`
  })

  // Labels with greedy vertical de-collision + orthogonal leader lines, so clustered
  // points never render their labels on top of each other.
  const chipH = LBL_FS + 6
  const placed: { x1: number; y1: number; x2: number; y2: number }[] = []
  const hit = (a: { x1: number; y1: number; x2: number; y2: number }) =>
    placed.some((c) => a.x1 < c.x2 && a.x2 > c.x1 && a.y1 < c.y2 && a.y2 > c.y1)
  const minY = plotY + 1
  const maxY = plotY + plot - chipH - 1
  const labeled = points.map((p, i) => ({ p, i })).filter((o) => String(o.p.label ?? '').trim())
  labeled.sort((a, b) => py(a.p.y) - py(b.p.y) || px(a.p.x) - px(b.p.x))
  labeled.forEach(({ p }) => {
    const x = px(p.x)
    const y = py(p.y)
    const rightHalf = p.x >= 0.5
    const label = ellipsize(String(p.label), LBL_FS, 150)
    const lw = estTextWidth(label, LBL_FS) + 10
    const gap = R + 6
    let chipX = rightHalf ? x - gap - lw : x + gap
    chipX = Math.max(f.padX + 1, Math.min(width - f.padX - lw - 1, chipX))
    const baseY = Math.max(minY, Math.min(maxY, y - chipH / 2))
    let chipY = baseY
    for (let t = 1; t <= 60 && hit({ x1: chipX, y1: chipY, x2: chipX + lw, y2: chipY + chipH }); t++) {
      const off = Math.ceil(t / 2) * (chipH + 3) * (t % 2 ? 1 : -1)
      chipY = Math.max(minY, Math.min(maxY, baseY + off))
    }
    const chipCenterY = chipY + chipH / 2
    const chipInnerX = rightHalf ? chipX + lw : chipX
    // Orthogonal leader only when the chip was nudged off the dot's line.
    if (Math.abs(chipCenterY - y) > 3) {
      const midX = rightHalf ? Math.min(chipInnerX + 8, x) : Math.max(chipInnerX - 8, x)
      out += `<path d="M ${x.toFixed(1)} ${y.toFixed(1)} H ${midX.toFixed(1)} V ${chipCenterY.toFixed(1)} H ${chipInnerX.toFixed(1)}" fill="none" stroke="${BRAND.borderStrong}" stroke-width="1" />`
    }
    out += roundRect(chipX, chipY, lw, chipH, 3, BRAND.surface, BRAND.border, 1)
    out += textLine(label, rightHalf ? chipX + lw - 5 : chipX + 5, chipCenterY + LBL_FS * 0.35, LBL_FS, BRAND.ink, { anchor: rightHalf ? 'end' : 'start', weight: 600 })
    placed.push({ x1: chipX, y1: chipY, x2: chipX + lw, y2: chipY + chipH })
  })

  const height = plotY + plot + AX_FS + 22 + f.captionH
  return shell(out, width, Math.ceil(height), d, f)
}

// ─── layers ───────────────────────────────────────────────────────────────────
// Horizontal bands top to bottom; each band has a left label + its nodes as a row
// of boxes. connections[] are drawn between named nodes as orthogonal elbow
// connectors: leave the source bottom-center, route V-then-H-then-V, enter the
// target top-center. Edge labels get an opaque chip.
function renderLayers(d: WorkshopDiagram, requestedWidth: number, f: Frame): SvgResult {
  const layers = (d.layers ?? []).filter((l) => l && (l.label || (l.nodes && l.nodes.length)))
  if (layers.length === 0) return renderEmpty(d, requestedWidth, f, 'No layers to show')

  const LABEL_GUTTER = 128 // reserved left column for band labels (skill: gutter)
  const NODE_FS = 12
  const BAND_LABEL_FS = 11
  const NODE_PAD_X = 12
  const NODE_PAD_Y = 10
  const NODE_GAP = 20
  const NODE_H = 40
  const MIN_NODE_W = 84
  const MAX_NODE_W = 190
  const CHIP_FS = 11
  const CHIP_H = CHIP_FS + 7 // matches edgeLabelChip height
  const LANE_STEP = CHIP_H + 5 // vertical pitch when edge labels must stack
  const MIN_BAND_GAP = 44 // floor; grows below to fit stacked edge labels

  // Measure every band's node widths FIRST (node width logic unchanged), then grow
  // the SVG so the widest row fits instead of clipping off the right edge.
  const measuredBands = layers.map((layer) => {
    const names = (layer.nodes ?? []).map((n) => String(n ?? '')).filter(Boolean)
    const measured = names.map((name) => {
      const lines = wrapText(name, NODE_FS, MAX_NODE_W - NODE_PAD_X * 2, 2)
      const w = Math.max(
        MIN_NODE_W,
        Math.min(MAX_NODE_W, Math.ceil(Math.max(0, ...lines.map((l) => estTextWidth(l, NODE_FS)))) + NODE_PAD_X * 2),
      )
      return { name, lines, w }
    })
    const rowW = measured.reduce((acc, m) => acc + m.w, 0) + NODE_GAP * Math.max(0, measured.length - 1)
    return { label: String(layer.label ?? ''), measured, rowW }
  })

  const maxRowW = Math.max(0, ...measuredBands.map((b) => b.rowW))
  const naturalWidth = f.padX * 2 + LABEL_GUTTER + maxRowW
  const width = Math.min(1600, Math.max(requestedWidth, Math.ceil(naturalWidth)))

  const availW = width - f.padX * 2 - LABEL_GUTTER
  const bandX = f.padX + LABEL_GUTTER

  // Place node X positions first (independent of Y). Index node-label ->
  // { box, band } for the first occurrence so connections dock to face centers and
  // labels know which gap they cross. Y is assigned after the gap height is known.
  interface NodeBox { x: number; y: number; w: number; h: number; lines: string[] }
  const nodeInfoByLabel = new Map<string, { box: NodeBox; band: number }>()
  const bands: { label: string; y: number; nodes: NodeBox[] }[] = measuredBands.map((mb, bi) => {
    // Center the row within the band area (the SVG is now wide enough to hold it).
    let x = bandX + Math.max(0, (availW - mb.rowW) / 2)
    const nodes: NodeBox[] = mb.measured.map((m) => {
      const box: NodeBox = { x, y: 0, w: m.w, h: NODE_H, lines: m.lines }
      x += m.w + NODE_GAP
      if (!nodeInfoByLabel.has(m.name)) nodeInfoByLabel.set(m.name, { box, band: bi })
      return box
    })
    return { label: mb.label, y: 0, nodes }
  })

  // Edge labels: assign every labeled cross-band connection to a horizontal lane in
  // the gap below its UPPER band, so chips never overlap each other or sit on an
  // intermediate band's nodes (skill 2.6 / 3.4). Computed here because it drives how
  // tall the band gap must be. Placement is independent of Y.
  interface Chip { cx: number; w: number; gap: number; lane: number; label: string }
  const conns = (d.connections ?? []).filter((c) => c && c.from && c.to)
  const chips: Chip[] = []
  for (const c of conns) {
    if (!c.label) continue
    const A = nodeInfoByLabel.get(String(c.from))
    const B = nodeInfoByLabel.get(String(c.to))
    if (!A || !B || A.band === B.band) continue
    const w = Math.min(estTextWidth(String(c.label), CHIP_FS) + 12, Math.max(80, availW))
    const rawCx = (A.box.x + A.box.w / 2 + B.box.x + B.box.w / 2) / 2
    const cx = Math.max(f.padX + w / 2 + 2, Math.min(width - f.padX - w / 2 - 2, rawCx))
    chips.push({ cx, w, gap: Math.min(A.band, B.band), lane: 0, label: String(c.label) })
  }
  const lanesInGap = new Map<number, number>()
  const chipsByGap = new Map<number, Chip[]>()
  for (const ch of chips) {
    const arr = chipsByGap.get(ch.gap) ?? []
    arr.push(ch)
    chipsByGap.set(ch.gap, arr)
  }
  let maxLanes = 1
  for (const [g, arr] of chipsByGap) {
    arr.sort((p, q) => p.cx - q.cx) // left-to-right, then greedily stack overlaps
    const laneRight: number[] = [] // rightmost edge used in each lane so far
    for (const ch of arr) {
      let lane = 0
      while (lane < laneRight.length && ch.cx - ch.w / 2 < laneRight[lane] + 10) lane++
      ch.lane = lane
      laneRight[lane] = ch.cx + ch.w / 2
    }
    lanesInGap.set(g, laneRight.length)
    maxLanes = Math.max(maxLanes, laneRight.length)
  }

  // Uniform band gap tall enough to hold the deepest label stack (keeps the grid).
  const BAND_GAP = Math.max(MIN_BAND_GAP, maxLanes * LANE_STEP + NODE_PAD_Y + 12)

  // Assign Y now that the gap height is known.
  let y = f.contentTop
  bands.forEach((band) => {
    band.y = y
    band.nodes.forEach((n) => { n.y = y })
    y += NODE_H + BAND_GAP
  })

  const bottom = y - BAND_GAP
  const height = bottom + 16 + f.captionH

  let out = ''
  // Band backgrounds + labels + nodes.
  bands.forEach((band) => {
    // Faint band background across the full content width.
    out += `<rect x="${f.padX.toFixed(1)}" y="${(band.y - NODE_PAD_Y / 2).toFixed(1)}" width="${(width - f.padX * 2).toFixed(1)}" height="${(NODE_H + NODE_PAD_Y).toFixed(1)}" rx="8" fill="${BRAND.panel}" fill-opacity="0.6" />`
    // Band label in the reserved gutter (vertically centered), never over a node.
    if (band.label) {
      const lines = wrapText(band.label, BAND_LABEL_FS, LABEL_GUTTER - 16, 2)
      const th = lines.length * (BAND_LABEL_FS * 1.25)
      out += textLines(lines, f.padX + LABEL_GUTTER / 2 - 4, band.y + (NODE_H - th) / 2, BAND_LABEL_FS, BRAND.slate, { weight: 700 })
    }
    band.nodes.forEach((n) => {
      out += roundRect(n.x, n.y, n.w, n.h, 8, BRAND.surface, BRAND.borderStrong, 1.25)
      const th = n.lines.length * (NODE_FS * 1.25)
      out += textLines(n.lines, n.x + n.w / 2, n.y + (n.h - th) / 2, NODE_FS, BRAND.ink, { weight: 600 })
    })
  })

  // Connectors: orthogonal V-H-V routing between bands. Labels are drawn separately
  // (below) in their assigned lanes so multiple edges never collide.
  const GAP = 6
  for (const c of conns) {
    const A = nodeInfoByLabel.get(String(c.from))
    const B = nodeInfoByLabel.get(String(c.to))
    if (!A || !B) continue
    const a = A.box
    const b = B.box
    const ax = a.x + a.w / 2
    const bx = b.x + b.w / 2
    if (A.band === B.band) {
      // Same band: route down-out, across the gap below, and back up-in so the
      // connector never runs through the sibling nodes between them.
      const ay = a.y + a.h
      const midY = ay + BAND_GAP / 2
      out += elbowPath(`M ${ax.toFixed(1)} ${ay.toFixed(1)} V ${midY.toFixed(1)} H ${bx.toFixed(1)} V ${(b.y + b.h + GAP).toFixed(1)}`)
      continue
    }
    const downward = b.y > a.y
    const ay = downward ? a.y + a.h : a.y
    const by = downward ? b.y : b.y + b.h
    const midY = (ay + by) / 2
    out += elbowPath(`M ${ax.toFixed(1)} ${ay.toFixed(1)} V ${midY.toFixed(1)} H ${bx.toFixed(1)} V ${(by + (downward ? -GAP : GAP)).toFixed(1)}`)
  }

  // Edge label chips, drawn last (on top of the connectors), each at its lane's Y so
  // stacked labels in the same gap never overlap.
  const gapCenterY = (g: number) => bands[g].y + NODE_H + BAND_GAP / 2
  for (const ch of chips) {
    const lanes = lanesInGap.get(ch.gap) ?? 1
    const stackTop = gapCenterY(ch.gap) - (lanes * LANE_STEP) / 2 + LANE_STEP / 2
    const cy = stackTop + ch.lane * LANE_STEP
    out += edgeLabelChip(ch.label, ch.cx, cy, CHIP_FS, ch.w)
  }

  return shell(out, width, Math.ceil(height), d, f)
}

// ─── empty / fallback ─────────────────────────────────────────────────────────
function renderEmpty(d: WorkshopDiagram, width: number, f: Frame, msg: string): SvgResult {
  const height = f.contentTop + 60 + f.captionH
  const out =
    roundRect(f.padX, f.contentTop, width - f.padX * 2, 48, 8, BRAND.panel, BRAND.border, 1) +
    textLine(msg, width / 2, f.contentTop + 30, 12, BRAND.muted, { anchor: 'middle' })
  return shell(out, width, Math.ceil(height), d, f)
}

// ─── public entry ─────────────────────────────────────────────────────────────
export function renderWorkshopDiagramSvg(
  d: WorkshopDiagram,
  opts?: { width?: number; theme?: 'light' | 'dark' },
): SvgResult {
  // theme is accepted for forward-compat; the current palette is a light surface
  // (renders well embedded in white PPTX slides + the light editor cards).
  const width = Math.max(360, Math.min(1100, Math.round(opts?.width ?? 720)))
  const safe: WorkshopDiagram = d && typeof d === 'object' ? d : ({ type: 'flow' } as WorkshopDiagram)
  const f = frameFor(safe)
  try {
    switch (safe.type) {
      case 'flow':
        return renderFlow(safe, width, f)
      case 'matrix':
        return renderMatrix(safe, width, f)
      case 'quadrant':
        return renderQuadrant(safe, width, f)
      case 'layers':
        return renderLayers(safe, width, f)
      default:
        return renderEmpty(safe, width, f, 'Unsupported diagram')
    }
  } catch {
    // Never throw out of the renderer; degrade to an empty frame.
    return renderEmpty(safe, width, f, 'Diagram could not be rendered')
  }
}
