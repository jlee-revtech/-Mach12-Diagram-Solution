// Standalone HTML / PDF export of the Live Configuration (A000) org diagram.
// Renders the same pruned instance tree the canvas shows as a self-contained SVG
// (elbow connectors only, light theme) so the file can be emailed as-is.
import type { SapEnterpriseModel, OrgNodeData, OrgEntityKind } from './types'
import { buildInstanceGraph, buildInstanceTree, estHeight, type InstanceTreeNode } from './buildModelDiagram'
import { ENTITY_META } from './entityMeta'

const NODE_W = 220
const MARGIN = 32
const EDGE_COLOR = '#5b6b86'

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function countTree(n: InstanceTreeNode): number {
  return 1 + n.children.reduce((acc, c) => acc + countTree(c), 0)
}

// ── SVG node (mirrors OrgNode.tsx, light theme) ─────────────────────────────
function svgNode(x: number, y: number, d: OrgNodeData): string {
  const meta = ENTITY_META[d.kind]
  const c = meta.color
  const h = estHeight(d)
  const parts: string[] = []

  parts.push(`<rect x="${x}" y="${y}" width="${NODE_W}" height="${h}" rx="12" fill="#ffffff" stroke="${c}55" stroke-width="1.2"/>`)
  // kind chip
  parts.push(`<rect x="${x + 14}" y="${y + 10}" width="32" height="32" rx="8" fill="${c}22"/>`)
  parts.push(`<text x="${x + 30}" y="${y + 30}" text-anchor="middle" class="abbr" fill="${c}">${esc(meta.abbr)}</text>`)
  // code + badge
  parts.push(`<text x="${x + 56}" y="${y + 23}" class="code">${esc(clip(d.code, d.badge ? 12 : 19))}</text>`)
  if (d.badge) {
    const bw = d.badge.length * 5 + 10
    const bx = x + NODE_W - 12 - bw
    parts.push(`<rect x="${bx}" y="${y + 13}" width="${bw}" height="13" rx="3" fill="none" stroke="${c}55" stroke-width="1"/>`)
    parts.push(`<text x="${bx + bw / 2}" y="${y + 22.5}" text-anchor="middle" class="badge" fill="${c}">${esc(d.badge)}</text>`)
  }
  parts.push(`<text x="${x + 56}" y="${y + 37}" class="title">${esc(clip(d.title, 27))}</text>`)
  parts.push(`<text x="${x + 56}" y="${y + 49}" class="kind">${esc(meta.label.toUpperCase())}</text>`)

  let cy = y + 52
  if (d.subtitle) {
    parts.push(`<text x="${x + 14}" y="${cy + 12}" class="sub">${esc(clip(d.subtitle, 38))}</text>`)
    cy += 14
  }
  if (d.meta?.length) {
    parts.push(`<path d="M ${x + 14} ${cy + 3} H ${x + NODE_W - 14}" stroke="#e2e2e2" stroke-width="1"/>`)
    for (const line of d.meta) {
      parts.push(`<text x="${x + 14}" y="${cy + 13}" class="meta">${esc(clip(line, 37))}</text>`)
      cy += 14
    }
  }
  return parts.join('\n')
}

// ── Full diagram SVG ────────────────────────────────────────────────────────
export function renderLiveConfigSvg(m: SapEnterpriseModel, hidden?: ReadonlySet<string>): { svg: string; width: number; height: number; kinds: OrgEntityKind[] } {
  const { nodes, edges } = buildInstanceGraph(m, hidden)

  const minX = Math.min(...nodes.map((n) => n.position.x))
  const maxX = Math.max(...nodes.map((n) => n.position.x + NODE_W))
  const maxY = Math.max(...nodes.map((n) => n.position.y + estHeight(n.data as OrgNodeData)))
  const width = Math.round(maxX - minX + MARGIN * 2)
  const height = Math.round(maxY + MARGIN * 2)
  const ox = MARGIN - minX
  const oy = MARGIN

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const edgePaths: string[] = []
  for (const e of edges) {
    const s = byId.get(e.source)!
    const t = byId.get(e.target)!
    const sx = s.position.x + ox + NODE_W / 2
    const sy = s.position.y + oy + estHeight(s.data as OrgNodeData)
    const tx = t.position.x + ox + NODE_W / 2
    const ty = t.position.y + oy - 5 // arrowhead gap before the target face
    const midY = t.position.y + oy - 35 // shared bus line between ranks
    const path = sx === tx ? `M ${sx} ${sy} V ${ty}` : `M ${sx} ${sy} V ${midY} H ${tx} V ${ty}`
    edgePaths.push(`<path d="${path}" fill="none" stroke="${EDGE_COLOR}" stroke-width="1.4" marker-end="url(#arw)"/>`)
  }

  const nodeShapes = nodes.map((n) => svgNode(n.position.x + ox, n.position.y + oy, n.data as OrgNodeData))
  const kinds = [...new Set(nodes.map((n) => (n.data as OrgNodeData).kind))]

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <marker id="arw" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse">
    <path d="M 0 0 L 7 4 L 0 8 Z" fill="${EDGE_COLOR}"/>
  </marker>
  <style>
    .abbr  { font: 700 10px ${MONO}; }
    .code  { font: 700 13px ${MONO}; fill: #1b1b1b; }
    .badge { font: 500 8px ${MONO}; letter-spacing: 0.4px; }
    .title { font: 500 11px ${SANS}; fill: #5e5e5e; }
    .kind  { font: 400 7.5px ${MONO}; fill: #8a8a8a; letter-spacing: 0.6px; }
    .sub   { font: 400 10px ${SANS}; fill: #8a8a8a; }
    .meta  { font: 400 9px ${MONO}; fill: #8a8a8a; }
  </style>
</defs>
<rect width="${width}" height="${height}" fill="#f6f6f6"/>
${edgePaths.join('\n')}
${nodeShapes.join('\n')}
</svg>`

  return { svg, width, height, kinds }
}

// ── Shared bits ─────────────────────────────────────────────────────────────
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function baseFilename(m: SapEnterpriseModel): string {
  return `SAP_Live_Configuration_${m.controllingArea.kokrs}_${new Date().toISOString().slice(0, 10)}`
}

function filterNote(m: SapEnterpriseModel, hidden?: ReadonlySet<string>): string | null {
  if (!hidden?.size) return null
  const full = buildInstanceTree(m)
  const total = countTree(full)
  const shown = total - hidden.size
  return `Filtered view — ${shown} of ${total} org elements shown (${hidden.size} hidden)`
}

// ── HTML export ─────────────────────────────────────────────────────────────
export function buildLiveConfigHtml(m: SapEnterpriseModel, hidden?: ReadonlySet<string>): string {
  const { svg, kinds } = renderLiveConfigSvg(m, hidden)
  const note = filterNote(m, hidden)
  const exported = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const legend = kinds
    .map((k) => {
      const it = ENTITY_META[k]
      return `<span class="lg"><span class="sw" style="background:${it.color}"></span>${esc(it.label)}</span>`
    })
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SAP Live Configuration — ${esc(m.controllingArea.kokrs)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ${SANS}; background: #ffffff; color: #1b1b1b; padding: 32px 40px; }
  header { border-bottom: 2px solid #2563EB; padding-bottom: 14px; margin-bottom: 14px; }
  h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
  .prov { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-size: 11px; color: #5e5e5e; }
  .prov b { color: #1b1b1b; }
  .prov .mono { font-family: ${MONO}; }
  .note { display: inline-block; margin-top: 10px; font-size: 11px; color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 3px 10px; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0 0 14px; }
  .lg { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; color: #5e5e5e; }
  .sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
  main { overflow-x: auto; border: 1px solid #e2e2e2; border-radius: 12px; }
  main svg { display: block; }
  footer { margin-top: 14px; font-size: 10px; color: #8a8a8a; display: flex; justify-content: space-between; }
  @media print {
    body { padding: 0; }
    main { border: none; overflow: visible; }
    main svg { max-width: 100%; height: auto; }
  }
  @page { size: A3 landscape; margin: 12mm; }
</style>
</head>
<body>
<header>
  <h1>SAP Live Configuration — Controlling Area ${esc(m.controllingArea.kokrs)}</h1>
  <div class="prov">
    <span>System <b class="mono">${esc(m.source.system)}</b></span>
    <span>Client <b class="mono">${esc(m.source.client)}</b></span>
    <span>Chart <b class="mono">${esc(m.controllingArea.chart)}</b> · <b class="mono">${esc(m.controllingArea.currency)}</b> · FY <b class="mono">${esc(m.controllingArea.fiscalVar)}</b></span>
    <span>Snapshot pulled <b>${esc(m.source.pulledOn)}</b></span>
    <span class="mono">${esc(m.source.via)}</span>
  </div>
  ${note ? `<span class="note">${esc(note)}</span>` : ''}
</header>
<div class="legend">${legend}</div>
<main>${svg}</main>
<footer><span>Mach12.ai — Solution Architecture Studio</span><span>Exported ${esc(exported)}</span></footer>
</body>
</html>`
}

export function exportLiveConfigHtml(m: SapEnterpriseModel, hidden?: ReadonlySet<string>): void {
  const html = buildLiveConfigHtml(m, hidden)
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${baseFilename(m)}.html`)
}

// ── PDF export ──────────────────────────────────────────────────────────────
export async function exportLiveConfigPdf(m: SapEnterpriseModel, hidden?: ReadonlySet<string>): Promise<void> {
  const { svg, width, height, kinds } = renderLiveConfigSvg(m, hidden)
  const note = filterNote(m, hidden)

  // Rasterize the SVG at 2x for a crisp embed.
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('SVG rasterization failed'))
  })
  // 2x for crispness, but stay under the ~32k-px browser canvas dimension cap.
  const scale = Math.min(2, 32000 / width, 32000 / height)
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f6f6f6'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const png = canvas.toDataURL('image/png')

  const { jsPDF } = await import('jspdf')
  const M = 36
  const headerH = 92
  const pageW = Math.max(width + M * 2, 620)
  const pageH = height + headerH + M * 2
  const pdf = new jsPDF({ orientation: pageW > pageH ? 'landscape' : 'portrait', unit: 'px', format: [pageW, pageH] })

  // Header
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, pageW, pageH, 'F')
  pdf.setTextColor(27, 27, 27)
  pdf.setFontSize(17)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`SAP Live Configuration — Controlling Area ${m.controllingArea.kokrs}`, M, M + 6)
  pdf.setFontSize(8.5)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(94, 94, 94)
  pdf.text(
    `${m.source.system} · client ${m.source.client} · chart ${m.controllingArea.chart} · ${m.controllingArea.currency} · FY ${m.controllingArea.fiscalVar} · snapshot ${m.source.pulledOn} · ${m.source.via}`,
    M, M + 22
  )
  if (note) {
    pdf.setTextColor(146, 64, 14)
    pdf.text(note, M, M + 34)
  }
  // Legend
  let lx = M
  const ly = M + (note ? 48 : 40)
  pdf.setFontSize(7.5)
  for (const k of kinds) {
    const it = ENTITY_META[k]
    const r = parseInt(it.color.slice(1, 3), 16)
    const g = parseInt(it.color.slice(3, 5), 16)
    const b = parseInt(it.color.slice(5, 7), 16)
    pdf.setFillColor(r, g, b)
    pdf.roundedRect(lx, ly - 6, 7, 7, 1.5, 1.5, 'F')
    pdf.setTextColor(94, 94, 94)
    pdf.text(it.label, lx + 10, ly)
    lx += 10 + pdf.getTextWidth(it.label) + 14
  }
  pdf.setDrawColor(37, 99, 235)
  pdf.setLineWidth(1.2)
  pdf.line(M, M + headerH - 26, pageW - M, M + headerH - 26)

  // Diagram — 'FAST' Flate-compresses the embedded image (default 'NONE' stores
  // the raw bitmap and balloons a diagram this size to ~45 MB).
  pdf.addImage(png, 'PNG', (pageW - width) / 2, M + headerH - 14, width, height, undefined, 'FAST')

  // Footer
  pdf.setFontSize(7.5)
  pdf.setTextColor(138, 138, 138)
  pdf.text('Mach12.ai — Solution Architecture Studio', M, pageH - 14)
  const stamp = `Exported ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
  pdf.text(stamp, pageW - M - pdf.getTextWidth(stamp), pageH - 14)

  pdf.save(`${baseFilename(m)}.pdf`)
}
