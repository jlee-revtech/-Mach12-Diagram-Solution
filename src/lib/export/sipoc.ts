import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import PptxGenJS from 'pptxgenjs'
import type { HydratedCapability } from '@/lib/sipoc/types'

function sanitizeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_') || 'capability-map'
}

// ─── Colors (RGB tuples for jsPDF) — LIGHT THEME ───────
const C = {
  bg: [249, 250, 251] as [number, number, number],
  cardBg: [255, 255, 255] as [number, number, number],
  border: [209, 213, 219] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  textSec: [71, 85, 105] as [number, number, number],
  muted: [148, 163, 184] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
  orange: [249, 115, 22] as [number, number, number],
  yellow: [202, 138, 4] as [number, number, number],
  green: [16, 185, 129] as [number, number, number],
  violet: [139, 92, 246] as [number, number, number],
  cyan: [6, 182, 212] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightYellow: [254, 252, 232] as [number, number, number],
  lightGreen: [236, 253, 245] as [number, number, number],
  lightBlue: [239, 246, 255] as [number, number, number],
}

// ─── PDF Helpers ────────────────────────────────────────
function drawRoundedRect(pdf: jsPDF, x: number, y: number, w: number, h: number, r: number, color: [number, number, number]) {
  pdf.setFillColor(...color)
  pdf.roundedRect(x, y, w, h, r, r, 'F')
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/.{2}/g)
  return m ? [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)] : C.muted
}

function drawPill(pdf: jsPDF, x: number, y: number, text: string, dotColor: [number, number, number]) {
  const tw = pdf.getTextWidth(text)
  const pw = tw + 14
  drawRoundedRect(pdf, x, y, pw, 12, 5, C.white)
  pdf.setDrawColor(...C.border)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(x, y, pw, 12, 5, 5, 'S')
  pdf.setFillColor(...dotColor)
  pdf.circle(x + 6, y + 6, 1.8, 'F')
  pdf.setFontSize(6)
  pdf.setTextColor(...C.text)
  pdf.text(text, x + 11, y + 7.5)
  return pw + 3
}

function drawTagChip(pdf: jsPDF, x: number, y: number, name: string, color: [number, number, number]) {
  pdf.setFontSize(5)
  const tw = pdf.getTextWidth(name)
  const pw = tw + 6
  drawRoundedRect(pdf, x, y, pw, 9, 3, color)
  pdf.setTextColor(255, 255, 255)
  pdf.text(name, x + 3, y + 6)
  return pw + 2
}

function drawIPCard(
  pdf: jsPDF, x: number, y: number, w: number,
  name: string, category: string | undefined,
  dims: { name: string; tags?: { name: string; color: string }[] }[],
  tags: { name: string; color: string }[],
  accentColor: [number, number, number],
  bgColor: [number, number, number]
): number {
  const lineH = 8
  pdf.setFontSize(7.5)
  const lines = pdf.splitTextToSize(name, w - 12)
  const nameH = lines.length * lineH
  const tagH = tags.length > 0 ? 14 : 0
  const dimH = dims.length > 0 ? dims.length * 9 + 6 : 0
  const cardH = nameH + (category ? 8 : 0) + tagH + dimH + 12

  drawRoundedRect(pdf, x, y, w, cardH, 4, bgColor)
  pdf.setDrawColor(...C.border)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(x, y, w, cardH, 4, 4, 'S')
  // Accent left border
  pdf.setFillColor(...accentColor)
  pdf.rect(x, y + 3, 2.5, cardH - 6, 'F')

  // Name
  pdf.setFontSize(7.5)
  pdf.setTextColor(...C.text)
  let cy = y + 10
  lines.forEach((line: string) => {
    pdf.text(line, x + 9, cy)
    cy += lineH
  })

  // Category
  if (category) {
    pdf.setFontSize(5)
    pdf.setTextColor(...C.muted)
    pdf.text(category.toUpperCase(), x + 9, cy)
    cy += 8
  }

  // Tags
  if (tags.length > 0) {
    let tx = x + 9
    tags.forEach(t => {
      const tw = drawTagChip(pdf, tx, cy - 2, t.name, hexToRgb(t.color))
      tx += tw
    })
    cy += 12
  }

  // Dimensions
  if (dims.length > 0) {
    pdf.setDrawColor(...C.border)
    pdf.setLineWidth(0.2)
    pdf.line(x + 9, cy - 3, x + w - 6, cy - 3)
    dims.forEach(dim => {
      pdf.setFontSize(5.5)
      pdf.setTextColor(...C.textSec)
      pdf.text(`• ${dim.name}`, x + 11, cy + 2)
      // Dimension tags
      if (dim.tags && dim.tags.length > 0) {
        let dtx = x + 11 + pdf.getTextWidth(`• ${dim.name}`) + 3
        dim.tags.forEach(t => {
          const tw = drawTagChip(pdf, dtx, cy - 2, t.name, hexToRgb(t.color))
          dtx += tw
        })
      }
      cy += 9
    })
  }

  return cardH
}

// ─── PDF Export (structured document layout) ───────────
export function exportSIPOCPdf(
  title: string,
  capabilities: HydratedCapability[]
): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' })
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  const m = 32 // margin
  const cw = pw - m * 2 // content width
  const footerY = ph - 22
  let y = 0

  const ensureSpace = (need: number) => {
    if (y + need > footerY) {
      pdf.addPage()
      pdf.setFillColor(...C.bg)
      pdf.rect(0, 0, pw, ph, 'F')
      y = m
    }
  }

  const drawFooter = (extra?: string) => {
    pdf.setFontSize(6)
    pdf.setTextColor(...C.muted)
    pdf.text(`${title} | Mach12.ai`, m, ph - 12)
    if (extra) pdf.text(extra, pw - m - pdf.getTextWidth(extra), ph - 12)
  }

  const drawSectionLabel = (label: string, color: [number, number, number]) => {
    ensureSpace(20)
    drawRoundedRect(pdf, m, y, cw, 16, 3, color)
    pdf.setFontSize(7)
    pdf.setTextColor(255, 255, 255)
    pdf.text(label, m + 8, y + 11)
    y += 20
  }

  // ── Cover page ────────────────────────────────────────
  pdf.setFillColor(...C.bg)
  pdf.rect(0, 0, pw, ph, 'F')

  pdf.setFontSize(28)
  pdf.setTextColor(...C.blue)
  pdf.text('MACH12', m, 80)

  pdf.setFontSize(16)
  pdf.setTextColor(...C.text)
  pdf.text(title, m, 110)

  pdf.setFontSize(10)
  pdf.setTextColor(...C.muted)
  pdf.text('SIPOC Capability Map', m, 130)
  pdf.text(`${capabilities.length} Capabilit${capabilities.length === 1 ? 'y' : 'ies'}`, m, 146)
  pdf.text(`Exported ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, m, 162)

  // Capability list
  y = 195
  pdf.setFontSize(8)
  capabilities.forEach((cap, i) => {
    if (y > footerY) return
    pdf.setTextColor(...C.text)
    pdf.text(`${i + 1}. ${cap.name}`, m + 10, y)
    pdf.setTextColor(...C.muted)
    const meta = `${cap.inputs.length} inputs, ${cap.outputs.length} outputs`
    pdf.text(meta, pw - m - pdf.getTextWidth(meta), y)
    y += 14
  })

  drawFooter()

  // ── One section per capability ────────────────────────
  capabilities.forEach((cap, capIdx) => {
    pdf.addPage()
    pdf.setFillColor(...C.bg)
    pdf.rect(0, 0, pw, ph, 'F')
    y = m

    // ── Capability header ──────────────────────────────
    drawRoundedRect(pdf, m, y, cw, 0, 6, C.lightBlue) // measure first
    const capNameLines = (() => { pdf.setFontSize(14); return pdf.splitTextToSize(cap.name, cw - 24) })()
    const features = cap.features || []
    const hdrH = capNameLines.length * 16 + (cap.system ? 16 : 0) + (features.length > 0 ? Math.min(features.length, 6) * 10 + 16 : 0) + 30
    drawRoundedRect(pdf, m, y, cw, hdrH, 6, C.lightBlue)
    pdf.setDrawColor(...C.blue)
    pdf.setLineWidth(0.5)
    pdf.roundedRect(m, y, cw, hdrH, 6, 6, 'S')

    // L3 label
    pdf.setFontSize(7)
    pdf.setTextColor(...C.blue)
    pdf.text('L3 CAPABILITY', m + 12, y + 14)
    pdf.setFontSize(6)
    pdf.setTextColor(...C.muted)
    pdf.text(`${capIdx + 1} of ${capabilities.length}`, pw - m - 40, y + 14)

    // Name
    pdf.setFontSize(14)
    pdf.setTextColor(...C.text)
    let hy = y + 30
    capNameLines.forEach((line: string) => { pdf.text(line, m + 12, hy); hy += 16 })

    // System
    if (cap.system) {
      pdf.setFontSize(8)
      pdf.setTextColor(...C.blue)
      pdf.text(`System: ${cap.system.name}`, m + 12, hy + 2)
      hy += 16
    }

    // Features
    if (features.length > 0) {
      pdf.setDrawColor(...C.border)
      pdf.setLineWidth(0.2)
      pdf.line(m + 12, hy - 4, m + cw - 12, hy - 4)
      pdf.setFontSize(6)
      pdf.setTextColor(...C.muted)
      pdf.text(`FEATURES (${features.length})`, m + 12, hy + 4)
      hy += 12
      pdf.setFontSize(7)
      pdf.setTextColor(...C.textSec)
      features.slice(0, 6).forEach(f => { pdf.text(`•  ${f}`, m + 14, hy); hy += 10 })
      if (features.length > 6) { pdf.text(`... and ${features.length - 6} more`, m + 14, hy); hy += 10 }
    }

    y += hdrH + 12

    // ── INPUTS section ─────────────────────────────────
    if (cap.inputs.length > 0) {
      drawSectionLabel(`INPUTS  (${cap.inputs.length})`, C.yellow)

      cap.inputs.forEach((inp, ii) => {
        ensureSpace(60)

        // IP name + category
        pdf.setFontSize(10)
        pdf.setTextColor(...C.text)
        const ipLines = pdf.splitTextToSize(inp.informationProduct.name, cw - 20)
        const rowStart = y

        drawRoundedRect(pdf, m, y, cw, 0, 0, ii % 2 === 0 ? C.white : C.bg) // bg will be sized after

        ipLines.forEach((line: string) => { pdf.text(line, m + 8, y + 12); y += 12 })
        if (inp.informationProduct.category) {
          pdf.setFontSize(7)
          pdf.setTextColor(...C.muted)
          pdf.text(inp.informationProduct.category.toUpperCase(), m + 8, y + 4)
          y += 10
        }

        // Tags
        const inputTags = inp.tags || []
        if (inputTags.length > 0) {
          let tx = m + 8
          inputTags.forEach(t => { tx += drawTagChip(pdf, tx, y, t.name, hexToRgb(t.color)) })
          y += 14
        }

        // Detail rows (two columns)
        const colL = m + 8
        const colR = m + cw / 2 + 8
        const detailStart = y + 4

        // Left column: Suppliers + Systems
        let leftY = detailStart
        if (inp.supplierPersonas.length > 0) {
          pdf.setFontSize(6)
          pdf.setTextColor(...C.orange)
          pdf.text('SUPPLIERS', colL, leftY)
          leftY += 9
          pdf.setFontSize(8)
          pdf.setTextColor(...C.text)
          inp.supplierPersonas.forEach(p => {
            pdf.setFillColor(...hexToRgb(p.color))
            pdf.circle(colL + 3, leftY - 2.5, 2, 'F')
            pdf.text(p.name, colL + 8, leftY)
            leftY += 11
          })
        }
        if (inp.sourceSystems.length > 0) {
          pdf.setFontSize(6)
          pdf.setTextColor(...C.muted)
          pdf.text('SOURCE SYSTEMS', colL, leftY + 2)
          leftY += 10
          pdf.setFontSize(7)
          pdf.setTextColor(...C.textSec)
          inp.sourceSystems.forEach(s => { pdf.text(`▸  ${s.name}`, colL + 2, leftY); leftY += 9 })
        }
        if (inp.feedingSystem) {
          pdf.setFontSize(6)
          pdf.setTextColor(...C.muted)
          pdf.text('FEEDING SYSTEM', colL, leftY + 2)
          leftY += 10
          pdf.setFontSize(7)
          pdf.setTextColor(...C.textSec)
          pdf.text(`→  ${inp.feedingSystem.name}`, colL + 2, leftY)
          leftY += 9
        }

        // Right column: Dimensions
        let rightY = detailStart
        if (inp.dimensions.length > 0) {
          pdf.setFontSize(6)
          pdf.setTextColor(...C.muted)
          pdf.text('DIMENSIONS', colR, rightY)
          rightY += 9
          pdf.setFontSize(7)
          pdf.setTextColor(...C.textSec)
          inp.dimensions.forEach(d => {
            pdf.text(`•  ${d.name}`, colR + 2, rightY)
            // Dimension tags
            if (d.tags && d.tags.length > 0) {
              let dtx = colR + 4 + pdf.getTextWidth(`•  ${d.name}`) + 3
              d.tags.forEach(t => { dtx += drawTagChip(pdf, dtx, rightY - 5, t.name, hexToRgb(t.color)) })
            }
            rightY += 10
          })
        }

        y = Math.max(leftY, rightY) + 4

        // Separator line between input rows
        pdf.setDrawColor(...C.border)
        pdf.setLineWidth(0.2)
        pdf.line(m, y, m + cw, y)
        y += 6
      })
    }

    // ── OUTPUTS section ────────────────────────────────
    if (cap.outputs.length > 0) {
      y += 8
      drawSectionLabel(`OUTPUTS  (${cap.outputs.length})`, C.green)

      cap.outputs.forEach((out, oi) => {
        ensureSpace(50)

        pdf.setFontSize(10)
        pdf.setTextColor(...C.text)
        const ipLines = pdf.splitTextToSize(out.informationProduct.name, cw - 20)
        ipLines.forEach((line: string) => { pdf.text(line, m + 8, y + 12); y += 12 })
        if (out.informationProduct.category) {
          pdf.setFontSize(7)
          pdf.setTextColor(...C.muted)
          pdf.text(out.informationProduct.category.toUpperCase(), m + 8, y + 4)
          y += 10
        }

        const colL = m + 8
        const colR = m + cw / 2 + 8
        const detailStart = y + 4

        // Left column: Customers
        let leftY = detailStart
        if (out.consumerPersonas.length > 0) {
          pdf.setFontSize(6)
          pdf.setTextColor(...C.violet)
          pdf.text('CUSTOMERS', colL, leftY)
          leftY += 9
          pdf.setFontSize(8)
          pdf.setTextColor(...C.text)
          out.consumerPersonas.forEach(p => {
            pdf.setFillColor(...hexToRgb(p.color))
            pdf.circle(colL + 3, leftY - 2.5, 2, 'F')
            pdf.text(p.name, colL + 8, leftY)
            leftY += 11
          })
        }
        if (out.destinationSystems.length > 0) {
          pdf.setFontSize(6)
          pdf.setTextColor(...C.muted)
          pdf.text('DESTINATION SYSTEMS', colL, leftY + 2)
          leftY += 10
          pdf.setFontSize(7)
          pdf.setTextColor(...C.textSec)
          out.destinationSystems.forEach(s => { pdf.text(`▸  ${s.name}`, colL + 2, leftY); leftY += 9 })
        }

        // Right column: Dimensions
        let rightY = detailStart
        if (out.dimensions.length > 0) {
          pdf.setFontSize(6)
          pdf.setTextColor(...C.muted)
          pdf.text('DIMENSIONS', colR, rightY)
          rightY += 9
          pdf.setFontSize(7)
          pdf.setTextColor(...C.textSec)
          out.dimensions.forEach(d => { pdf.text(`•  ${d.name}`, colR + 2, rightY); rightY += 10 })
        }

        y = Math.max(leftY, rightY) + 4
        pdf.setDrawColor(...C.border)
        pdf.setLineWidth(0.2)
        pdf.line(m, y, m + cw, y)
        y += 6
      })
    }

    drawFooter(`${cap.name}`)
  })

  pdf.save(`${sanitizeFilename(title)}_SIPOC.pdf`)
}

// ─── Excel Export ───────────────────────────────────────
export function exportSIPOCExcel(
  title: string,
  capabilities: HydratedCapability[],
  allPersonas: { id: string; name: string; role?: string; color: string }[],
  allProducts: { id: string; name: string; category?: string }[],
  allSystems: { id: string; name: string; system_type?: string }[]
): void {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Summary ──────────────────────────────────
  const summaryData = [
    ['SIPOC Capability Map', '', '', '', ''],
    ['Title', title, '', '', ''],
    ['Exported', new Date().toLocaleDateString(), '', '', ''],
    ['Capabilities', capabilities.length.toString(), '', '', ''],
    ['', '', '', '', ''],
    ['#', 'Capability', 'System', 'Features', 'Inputs', 'Outputs'],
    ...capabilities.map((cap, i) => [
      (i + 1).toString(),
      cap.name,
      cap.system?.name || '',
      (cap.features || []).join('; '),
      cap.inputs.length.toString(),
      cap.outputs.length.toString(),
    ]),
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 25 }, { wch: 50 }, { wch: 10 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  // ── Sheet 2: Inputs ───────────────────────────────────
  const inputRows: string[][] = [
    ['Capability', 'Features', 'Information Product', 'Category', 'Tags', 'Supplier Personas', 'Source Systems', 'Feeding System', 'Dimensions'],
  ]
  capabilities.forEach(cap => {
    cap.inputs.forEach(inp => {
      inputRows.push([
        cap.name,
        (cap.features || []).join('; '),
        inp.informationProduct.name,
        inp.informationProduct.category || '',
        (inp.tags || []).map(t => t.name).join('; '),
        inp.supplierPersonas.map(p => p.name).join('; '),
        inp.sourceSystems.map(s => s.name).join('; '),
        inp.feedingSystem?.name || '',
        (inp.dimensions || []).map(d => {
          const dimTags = (d.tags || []).map(t => t.name).join(', ')
          return d.name + (dimTags ? ` [${dimTags}]` : '')
        }).join('; '),
      ])
    })
  })
  const wsInputs = XLSX.utils.aoa_to_sheet(inputRows)
  wsInputs['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 35 }, { wch: 18 }, { wch: 20 }, { wch: 35 }, { wch: 30 }, { wch: 25 }, { wch: 45 }]
  XLSX.utils.book_append_sheet(wb, wsInputs, 'Inputs')

  // ── Sheet 3: Outputs ──────────────────────────────────
  const outputRows: string[][] = [
    ['Capability', 'Features', 'Information Product', 'Category', 'Consumer Personas', 'Destination Systems', 'Dimensions'],
  ]
  capabilities.forEach(cap => {
    cap.outputs.forEach(out => {
      outputRows.push([
        cap.name,
        (cap.features || []).join('; '),
        out.informationProduct.name,
        out.informationProduct.category || '',
        out.consumerPersonas.map(p => p.name).join('; '),
        out.destinationSystems.map(s => s.name).join('; '),
        (out.dimensions || []).map(d => d.name).join('; '),
      ])
    })
  })
  const wsOutputs = XLSX.utils.aoa_to_sheet(outputRows)
  wsOutputs['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 35 }, { wch: 18 }, { wch: 35 }, { wch: 30 }, { wch: 45 }]
  XLSX.utils.book_append_sheet(wb, wsOutputs, 'Outputs')

  // ── Sheet 4: Detailed (one row per dimension) ─────────
  const detailRows: string[][] = [
    ['Capability', 'Features', 'Side', 'Information Product', 'Category', 'Tags', 'Dimension', 'Dim Tags', 'Personas', 'Systems', 'Feeding System'],
  ]
  capabilities.forEach(cap => {
    const feats = (cap.features || []).join('; ')
    cap.inputs.forEach(inp => {
      const personas = inp.supplierPersonas.map(p => p.name).join('; ')
      const systems = inp.sourceSystems.map(s => s.name).join('; ')
      const ipTags = (inp.tags || []).map(t => t.name).join('; ')
      const feed = inp.feedingSystem?.name || ''
      if ((inp.dimensions || []).length > 0) {
        (inp.dimensions || []).forEach(dim => {
          const dimTags = (dim.tags || []).map(t => t.name).join('; ')
          detailRows.push([cap.name, feats, 'Input', inp.informationProduct.name, inp.informationProduct.category || '', ipTags, dim.name, dimTags, personas, systems, feed])
        })
      } else {
        detailRows.push([cap.name, feats, 'Input', inp.informationProduct.name, inp.informationProduct.category || '', ipTags, '', '', personas, systems, feed])
      }
    })
    cap.outputs.forEach(out => {
      const consumers = out.consumerPersonas.map(p => p.name).join('; ')
      const destSys = out.destinationSystems.map(s => s.name).join('; ')
      if ((out.dimensions || []).length > 0) {
        (out.dimensions || []).forEach(dim => {
          detailRows.push([cap.name, feats, 'Output', out.informationProduct.name, out.informationProduct.category || '', '', dim.name, '', consumers, destSys, ''])
        })
      } else {
        detailRows.push([cap.name, feats, 'Output', out.informationProduct.name, out.informationProduct.category || '', '', '', '', consumers, destSys, ''])
      }
    })
  })
  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows)
  wsDetail['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 8 }, { wch: 35 }, { wch: 18 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 35 }, { wch: 30 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detailed')

  // ── Sheet 5: Entity Registry ──────────────────────────
  const maxLen = Math.max(allPersonas.length, allProducts.length, allSystems.length)
  const registryRows: string[][] = [
    ['Personas', 'Role', '', 'Information Products', 'Category', '', 'Logical Systems', 'Type'],
  ]
  for (let i = 0; i < maxLen; i++) {
    const p = allPersonas[i]
    const ip = allProducts[i]
    const s = allSystems[i]
    registryRows.push([
      p?.name || '', p?.role || '', '',
      ip?.name || '', ip?.category || '', '',
      s?.name || '', s?.system_type || '',
    ])
  }
  const wsRegistry = XLSX.utils.aoa_to_sheet(registryRows)
  wsRegistry['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 3 }, { wch: 35 }, { wch: 18 }, { wch: 3 }, { wch: 25 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsRegistry, 'Entity Registry')

  XLSX.writeFile(wb, `${sanitizeFilename(title)}_SIPOC.xlsx`)
}

// ─── PowerPoint Export ──────────────────────────────────

const PPTX_COLORS = {
  bg: 'F8FAFC',
  cardBg: 'FFFFFF',
  cardBgSoft: 'F1F5F9',
  border: 'CBD5E1',
  borderLight: 'E2E8F0',
  text: '0F172A',
  textSec: '334155',
  muted: '64748B',
  blue: '2563EB',
  orange: 'F97316',
  yellow: 'EAB308',
  green: '10B981',
  violet: '8B5CF6',
  cyan: '06B6D4',
  white: 'FFFFFF',
}

function stripHash(color: string): string {
  return color.replace('#', '')
}

export function exportSIPOCPptx(
  title: string,
  capabilities: HydratedCapability[]
): void {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches
  pptx.author = 'Mach12.ai'
  pptx.title = title

  const W = 13.33
  const H = 7.5

  // ── Helper: Add footer to every slide ─────────────────
  const addFooter = (slide: PptxGenJS.Slide, subtitle?: string) => {
    slide.addShape(pptx.ShapeType.line, {
      x: 0.4, y: H - 0.45, w: W - 0.8, h: 0,
      line: { color: PPTX_COLORS.borderLight, width: 0.5 },
    })
    slide.addText(
      [
        { text: 'MACH12', options: { fontSize: 7, color: PPTX_COLORS.blue, bold: true, fontFace: 'Arial' } },
        { text: subtitle ? `  |  ${subtitle}` : '', options: { fontSize: 6, color: PPTX_COLORS.muted, fontFace: 'Arial' } },
      ],
      { x: 0.4, y: H - 0.35, w: 6, h: 0.25 }
    )
    slide.addText(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), {
      x: W - 2.5, y: H - 0.35, w: 2.1, h: 0.25, fontSize: 6, color: PPTX_COLORS.muted, fontFace: 'Arial', align: 'right',
    })
  }

  // ── Helper: Add slide header with capability name ─────
  const addSlideHeader = (slide: PptxGenJS.Slide, capName: string, slideLabel: string, accentColor: string) => {
    // Top accent bar
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.04, fill: { color: PPTX_COLORS.blue } })
    // Capability name
    slide.addText(capName, {
      x: 0.4, y: 0.18, w: 8, h: 0.35, fontSize: 14, color: PPTX_COLORS.text, bold: true, fontFace: 'Arial',
    })
    // Slide label badge
    slide.addShape(pptx.ShapeType.roundRect, {
      x: W - 3.2, y: 0.18, w: 2.8, h: 0.32,
      rectRadius: 0.06, fill: { color: accentColor },
    })
    slide.addText(slideLabel, {
      x: W - 3.2, y: 0.18, w: 2.8, h: 0.32,
      fontSize: 8, color: PPTX_COLORS.white, bold: true, fontFace: 'Arial', align: 'center', valign: 'middle',
    })
    // Divider
    slide.addShape(pptx.ShapeType.line, {
      x: 0.4, y: 0.6, w: W - 0.8, h: 0,
      line: { color: PPTX_COLORS.borderLight, width: 0.5 },
    })
  }

  // ── Helper: Draw a persona chip ───────────────────────
  const drawPersonaChip = (slide: PptxGenJS.Slide, x: number, y: number, w: number, chipH: number, name: string, color: string, fontSize: number) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h: chipH,
      rectRadius: chipH / 2, fill: { color: PPTX_COLORS.cardBgSoft },
      line: { color: PPTX_COLORS.border, width: 0.4 },
    })
    const dotSize = Math.min(0.12, chipH * 0.55)
    slide.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.1, y: y + (chipH - dotSize) / 2, w: dotSize, h: dotSize,
      fill: { color: stripHash(color) },
    })
    slide.addText(name, {
      x: x + 0.28, y, w: w - 0.38, h: chipH,
      fontSize, color: PPTX_COLORS.textSec, fontFace: 'Arial', valign: 'middle',
    })
  }

  // ── Helper: Draw an IP card ───────────────────────────
  const drawIPCard = (slide: PptxGenJS.Slide, x: number, y: number, w: number, cardH: number, name: string, category: string | undefined, dims: { name: string }[], accentColor: string, fsName: number, fsCat: number, fsDim: number, dimLineH: number, scale: number) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h: cardH,
      rectRadius: 0.06, fill: { color: PPTX_COLORS.cardBg },
      line: { color: PPTX_COLORS.border, width: 0.4 },
    })
    // Accent bar
    slide.addShape(pptx.ShapeType.rect, {
      x, y: y + 0.06 * scale, w: 0.04, h: cardH - 0.12 * scale,
      fill: { color: accentColor },
    })
    slide.addText(name, {
      x: x + 0.14, y: y + 0.04 * scale, w: w - 0.22, h: 0.25 * scale,
      fontSize: fsName, color: PPTX_COLORS.text, bold: true, fontFace: 'Arial', valign: 'top', wrap: true,
    })
    if (category) {
      slide.addText(category.toUpperCase(), {
        x: x + 0.14, y: y + 0.28 * scale, w: w - 0.22, h: 0.14 * scale,
        fontSize: fsCat, color: PPTX_COLORS.muted, fontFace: 'Arial',
      })
    }
    if (dims.length > 0) {
      dims.forEach((dim, di) => {
        slide.addText(`• ${dim.name}`, {
          x: x + 0.2, y: y + 0.42 * scale + di * dimLineH, w: w - 0.32, h: dimLineH,
          fontSize: fsDim, color: PPTX_COLORS.muted, fontFace: 'Arial', valign: 'middle',
        })
      })
    }
  }

  // ── Slide 1: Title slide ──────────────────────────────
  const titleSlide = pptx.addSlide()
  titleSlide.background = { color: PPTX_COLORS.bg }

  // Accent bar
  titleSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: H, fill: { color: PPTX_COLORS.blue } })

  titleSlide.addText('MACH12', {
    x: 0.6, y: 1.5, w: 5, h: 0.6, fontSize: 32, color: PPTX_COLORS.blue, bold: true, fontFace: 'Arial',
  })
  titleSlide.addText(title, {
    x: 0.6, y: 2.2, w: 8, h: 0.5, fontSize: 22, color: PPTX_COLORS.text, fontFace: 'Arial',
  })
  titleSlide.addText('SIPOC Capability Map', {
    x: 0.6, y: 2.8, w: 5, h: 0.35, fontSize: 12, color: PPTX_COLORS.muted, fontFace: 'Arial',
  })

  // Capability summary
  titleSlide.addText(`${capabilities.length} Capabilit${capabilities.length === 1 ? 'y' : 'ies'}`, {
    x: 0.6, y: 3.5, w: 5, h: 0.3, fontSize: 10, color: PPTX_COLORS.textSec, fontFace: 'Arial',
  })

  capabilities.forEach((cap, i) => {
    const totalInputs = cap.inputs.length
    const totalOutputs = cap.outputs.length
    titleSlide.addText(
      [
        { text: `${i + 1}. `, options: { color: PPTX_COLORS.muted, fontSize: 9 } },
        { text: cap.name, options: { color: PPTX_COLORS.textSec, fontSize: 9 } },
        { text: `   ${totalInputs} inputs, ${totalOutputs} outputs`, options: { color: PPTX_COLORS.muted, fontSize: 7 } },
      ],
      { x: 0.8, y: 3.9 + i * 0.28, w: 8, h: 0.25, fontFace: 'Arial' }
    )
  })

  addFooter(titleSlide)

  // ── Three slides per capability ───────────────────────
  capabilities.forEach(cap => {
    const levelLabel = cap.level === 3 ? 'L3 FUNCTIONALITY' : cap.level === 2 ? 'L2 CAPABILITY' : 'L1 CORE AREA'

    // ════════════════════════════════════════════════════
    // SLIDE A: Capability Definition
    // ════════════════════════════════════════════════════
    const defSlide = pptx.addSlide()
    defSlide.background = { color: PPTX_COLORS.bg }
    addSlideHeader(defSlide, cap.name, 'DEFINITION', PPTX_COLORS.blue)

    // Level label
    defSlide.addText(levelLabel, {
      x: 0.5, y: 0.85, w: 3, h: 0.25,
      fontSize: 8, color: PPTX_COLORS.blue, bold: true, fontFace: 'Arial',
    })

    // Process box
    const procBoxY = 1.25
    const procBoxH = 1.2
    defSlide.addShape(pptx.ShapeType.roundRect, {
      x: 0.5, y: procBoxY, w: W - 1, h: procBoxH,
      rectRadius: 0.12, fill: { color: PPTX_COLORS.cardBg },
      line: { color: PPTX_COLORS.blue, width: 1.5 },
    })
    defSlide.addText(cap.name, {
      x: 0.8, y: procBoxY + 0.15, w: W - 1.6, h: 0.4,
      fontSize: 18, color: PPTX_COLORS.text, bold: true, fontFace: 'Arial',
    })
    if (cap.description) {
      defSlide.addText(cap.description, {
        x: 0.8, y: procBoxY + 0.6, w: W - 1.6, h: 0.45,
        fontSize: 10, color: PPTX_COLORS.textSec, fontFace: 'Arial', wrap: true,
      })
    }

    // Features
    if (cap.features && cap.features.length > 0) {
      defSlide.addText('FEATURES', {
        x: 0.5, y: 2.7, w: 3, h: 0.25,
        fontSize: 8, color: PPTX_COLORS.muted, bold: true, fontFace: 'Arial',
      })
      cap.features.forEach((feat, fi) => {
        defSlide.addShape(pptx.ShapeType.roundRect, {
          x: 0.5, y: 3.0 + fi * 0.35, w: W - 1, h: 0.28,
          rectRadius: 0.04, fill: { color: PPTX_COLORS.cardBgSoft },
        })
        defSlide.addText(`• ${feat}`, {
          x: 0.7, y: 3.0 + fi * 0.35, w: W - 1.4, h: 0.28,
          fontSize: 9, color: PPTX_COLORS.textSec, fontFace: 'Arial', valign: 'middle',
        })
      })
    }

    // System assignment
    if (cap.system) {
      const sysY = cap.features && cap.features.length > 0 ? 3.0 + cap.features.length * 0.35 + 0.35 : 2.7
      defSlide.addText('SYSTEM', {
        x: 0.5, y: sysY, w: 3, h: 0.25,
        fontSize: 8, color: PPTX_COLORS.muted, bold: true, fontFace: 'Arial',
      })
      defSlide.addShape(pptx.ShapeType.roundRect, {
        x: 0.5, y: sysY + 0.28, w: 3, h: 0.32,
        rectRadius: 0.06, fill: { color: PPTX_COLORS.cardBgSoft },
        line: { color: PPTX_COLORS.border, width: 0.4 },
      })
      const sysDotSize = 0.1
      defSlide.addShape(pptx.ShapeType.ellipse, {
        x: 0.65, y: sysY + 0.28 + (0.32 - sysDotSize) / 2, w: sysDotSize, h: sysDotSize,
        fill: { color: stripHash(cap.system.color || '#2563EB') },
      })
      defSlide.addText(cap.system.name, {
        x: 0.85, y: sysY + 0.28, w: 2.5, h: 0.32,
        fontSize: 9, color: PPTX_COLORS.textSec, fontFace: 'Arial', valign: 'middle',
      })
    }

    // Summary stats
    const statsY = 5.8
    const statBoxW = 2.5
    const statsData = [
      { label: 'INPUTS', value: cap.inputs.length.toString(), color: PPTX_COLORS.yellow },
      { label: 'OUTPUTS', value: cap.outputs.length.toString(), color: PPTX_COLORS.green },
      { label: 'SUPPLIERS', value: [...new Set(cap.inputs.flatMap(i => i.supplierPersonas.map(p => p.id)))].length.toString(), color: PPTX_COLORS.orange },
      { label: 'CUSTOMERS', value: [...new Set(cap.outputs.flatMap(o => o.consumerPersonas.map(p => p.id)))].length.toString(), color: PPTX_COLORS.violet },
    ]
    const statsStartX = (W - statsData.length * statBoxW - (statsData.length - 1) * 0.2) / 2
    statsData.forEach((stat, si) => {
      const sx = statsStartX + si * (statBoxW + 0.2)
      defSlide.addShape(pptx.ShapeType.roundRect, {
        x: sx, y: statsY, w: statBoxW, h: 0.9,
        rectRadius: 0.08, fill: { color: PPTX_COLORS.cardBg },
        line: { color: PPTX_COLORS.border, width: 0.4 },
      })
      defSlide.addShape(pptx.ShapeType.rect, {
        x: sx, y: statsY + 0.06, w: 0.04, h: 0.78,
        fill: { color: stat.color },
      })
      defSlide.addText(stat.value, {
        x: sx + 0.15, y: statsY + 0.08, w: statBoxW - 0.3, h: 0.45,
        fontSize: 22, color: PPTX_COLORS.text, bold: true, fontFace: 'Arial', align: 'center',
      })
      defSlide.addText(stat.label, {
        x: sx + 0.15, y: statsY + 0.55, w: statBoxW - 0.3, h: 0.25,
        fontSize: 7, color: PPTX_COLORS.muted, bold: true, fontFace: 'Arial', align: 'center',
      })
    })

    addFooter(defSlide, `${cap.name} — Definition`)

    // ════════════════════════════════════════════════════
    // SLIDE B (1..N): Suppliers & Inputs — with slide breaks
    // ════════════════════════════════════════════════════
    // Fixed sizes — no scaling. 8pt minimum.
    const CHIP_H = 0.26
    const CHIP_GAP = 0.06
    const SYS_H = 0.24
    const CARD_BASE = 0.52
    const DIM_LINE_H = 0.16
    const DIM_EXTRA = 0.14
    const TAG_ROW_H = 0.18
    const LANE_GAP = 0.18
    const CONTENT_START_Y = 1.15
    const MAX_Y = H - 0.55

    const siColX = [0.3, 4.2, 7.5]
    const siColW = [3.7, 3.1, 5.5]

    const addInputSlideHeader = (slide: PptxGenJS.Slide, page: number, total: number) => {
      addSlideHeader(slide, cap.name, `SUPPLIERS & INPUTS${total > 1 ? ` (${page}/${total})` : ''}`, PPTX_COLORS.orange)
      const hdrY = 0.75
      const labels = ['SUPPLIERS', 'INPUTS', 'SOURCE & FEEDING SYSTEMS']
      const colors = [PPTX_COLORS.orange, PPTX_COLORS.yellow, PPTX_COLORS.muted]
      labels.forEach((label, i) => {
        slide.addShape(pptx.ShapeType.roundRect, { x: siColX[i] + 0.02, y: hdrY, w: 0.24, h: 0.24, rectRadius: 0.05, fill: { color: colors[i] } })
        slide.addText(label[0], { x: siColX[i] + 0.02, y: hdrY, w: 0.24, h: 0.24, fontSize: 9, color: PPTX_COLORS.white, bold: true, fontFace: 'Arial', align: 'center', valign: 'middle' })
        slide.addText(label, { x: siColX[i] + 0.32, y: hdrY, w: siColW[i] - 0.35, h: 0.24, fontSize: 8, color: PPTX_COLORS.muted, bold: true, fontFace: 'Arial', valign: 'middle' })
      })
      slide.addShape(pptx.ShapeType.line, { x: 0.3, y: hdrY + 0.32, w: W - 0.6, h: 0, line: { color: PPTX_COLORS.borderLight, width: 0.5 } })
    }

    // Pre-calculate row heights for pagination
    const inputRowHeights = cap.inputs.map(inp => {
      const dims = inp.dimensions || []
      const tags = inp.tags || []
      const cardH = CARD_BASE + (tags.length > 0 ? TAG_ROW_H : 0) + (dims.length > 0 ? dims.length * DIM_LINE_H + DIM_EXTRA : 0)
      const chipH = inp.supplierPersonas.length * (CHIP_H + CHIP_GAP)
      const sysH = (inp.sourceSystems.length + (inp.feedingSystem ? 1 : 0)) * (SYS_H + CHIP_GAP)
      return Math.max(cardH, chipH, sysH) + LANE_GAP
    })

    // Paginate inputs
    const inputPages: number[][] = []
    let pageRows: number[] = []
    let pageH = 0
    cap.inputs.forEach((_, idx) => {
      if (pageH + inputRowHeights[idx] > MAX_Y - CONTENT_START_Y && pageRows.length > 0) {
        inputPages.push(pageRows)
        pageRows = []
        pageH = 0
      }
      pageRows.push(idx)
      pageH += inputRowHeights[idx]
    })
    if (pageRows.length > 0) inputPages.push(pageRows)
    if (inputPages.length === 0) inputPages.push([])

    inputPages.forEach((rowIndices, pageIdx) => {
      const slide = pptx.addSlide()
      slide.background = { color: PPTX_COLORS.bg }
      addInputSlideHeader(slide, pageIdx + 1, inputPages.length)

      if (rowIndices.length === 0) {
        slide.addText('No inputs defined', { x: 0.4, y: 3.2, w: W - 0.8, h: 0.4, fontSize: 11, color: PPTX_COLORS.muted, fontFace: 'Arial', align: 'center', italic: true })
      }

      let laneY = CONTENT_START_Y
      rowIndices.forEach(idx => {
        const inp = cap.inputs[idx]
        const dims = inp.dimensions || []
        const tags = inp.tags || []
        const cardH = CARD_BASE + (tags.length > 0 ? TAG_ROW_H : 0) + (dims.length > 0 ? dims.length * DIM_LINE_H + DIM_EXTRA : 0)

        // Supplier personas
        let chipY = laneY
        inp.supplierPersonas.forEach(p => {
          drawPersonaChip(slide, siColX[0], chipY, siColW[0], CHIP_H, p.name, p.color, 8)
          chipY += CHIP_H + CHIP_GAP
        })

        // Arrow S→I
        const arrowY = laneY + cardH / 2 - 0.02
        slide.addShape(pptx.ShapeType.line, { x: siColX[0] + siColW[0] + 0.05, y: arrowY, w: siColX[1] - siColX[0] - siColW[0] - 0.1, h: 0, line: { color: PPTX_COLORS.border, width: 0.8, endArrowType: 'triangle' } })

        // Input IP card
        drawIPCard(slide, siColX[1], laneY, siColW[1], cardH, inp.informationProduct.name, inp.informationProduct.category, dims, PPTX_COLORS.yellow, 9, 6, 6, DIM_LINE_H, 1)

        // Tags on card (below category, above dims)
        if (tags.length > 0) {
          const tagY = laneY + (inp.informationProduct.category ? 0.38 : 0.28)
          let tagX = siColX[1] + 0.14
          tags.forEach(t => {
            const tw = Math.min(t.name.length * 0.06 + 0.12, 1.0)
            slide.addShape(pptx.ShapeType.roundRect, { x: tagX, y: tagY, w: tw, h: 0.14, rectRadius: 0.03, fill: { color: stripHash(t.color) } })
            slide.addText(t.name, { x: tagX, y: tagY, w: tw, h: 0.14, fontSize: 6, color: PPTX_COLORS.white, fontFace: 'Arial', align: 'center', valign: 'middle' })
            tagX += tw + 0.04
          })
        }

        // Arrow I→Systems
        slide.addShape(pptx.ShapeType.line, { x: siColX[1] + siColW[1] + 0.05, y: arrowY, w: siColX[2] - siColX[1] - siColW[1] - 0.1, h: 0, line: { color: PPTX_COLORS.border, width: 0.6, endArrowType: 'triangle' } })

        // Source systems
        let sysY = laneY
        inp.sourceSystems.forEach(s => {
          slide.addShape(pptx.ShapeType.roundRect, { x: siColX[2], y: sysY, w: siColW[2], h: SYS_H, rectRadius: 0.04, fill: { color: PPTX_COLORS.cardBgSoft }, line: { color: PPTX_COLORS.border, width: 0.3 } })
          slide.addText(`SOURCE: ${s.name}`, { x: siColX[2] + 0.12, y: sysY, w: siColW[2] - 0.2, h: SYS_H, fontSize: 8, color: PPTX_COLORS.textSec, fontFace: 'Arial', valign: 'middle' })
          sysY += SYS_H + CHIP_GAP
        })
        if (inp.feedingSystem) {
          slide.addShape(pptx.ShapeType.roundRect, { x: siColX[2], y: sysY, w: siColW[2], h: SYS_H, rectRadius: 0.04, fill: { color: PPTX_COLORS.cardBgSoft }, line: { color: PPTX_COLORS.blue, width: 0.5 } })
          slide.addText(`FEEDS: ${inp.feedingSystem.name}`, { x: siColX[2] + 0.12, y: sysY, w: siColW[2] - 0.2, h: SYS_H, fontSize: 8, color: PPTX_COLORS.blue, bold: true, fontFace: 'Arial', valign: 'middle' })
        }

        laneY += inputRowHeights[idx]
      })

      addFooter(slide, `${cap.name} — Suppliers & Inputs`)
    })

    // ════════════════════════════════════════════════════
    // SLIDE C (1..N): Outputs & Customers — with slide breaks
    // ════════════════════════════════════════════════════
    const ocColX = [0.3, 5.5, 9.5]
    const ocColW = [5.0, 3.8, 3.5]

    const addOutputSlideHeader = (slide: PptxGenJS.Slide, page: number, total: number) => {
      addSlideHeader(slide, cap.name, `OUTPUTS & CUSTOMERS${total > 1 ? ` (${page}/${total})` : ''}`, PPTX_COLORS.green)
      const hdrY = 0.75
      const labels = ['OUTPUTS', 'CUSTOMERS', 'DESTINATION SYSTEMS']
      const colors = [PPTX_COLORS.green, PPTX_COLORS.violet, PPTX_COLORS.muted]
      labels.forEach((label, i) => {
        slide.addShape(pptx.ShapeType.roundRect, { x: ocColX[i] + 0.02, y: hdrY, w: 0.24, h: 0.24, rectRadius: 0.05, fill: { color: colors[i] } })
        slide.addText(label[0], { x: ocColX[i] + 0.02, y: hdrY, w: 0.24, h: 0.24, fontSize: 9, color: PPTX_COLORS.white, bold: true, fontFace: 'Arial', align: 'center', valign: 'middle' })
        slide.addText(label, { x: ocColX[i] + 0.32, y: hdrY, w: ocColW[i] - 0.35, h: 0.24, fontSize: 8, color: PPTX_COLORS.muted, bold: true, fontFace: 'Arial', valign: 'middle' })
      })
      slide.addShape(pptx.ShapeType.line, { x: 0.3, y: hdrY + 0.32, w: W - 0.6, h: 0, line: { color: PPTX_COLORS.borderLight, width: 0.5 } })
    }

    const outputRowHeights = cap.outputs.map(out => {
      const dims = out.dimensions || []
      const cardH = CARD_BASE + (dims.length > 0 ? dims.length * DIM_LINE_H + DIM_EXTRA : 0)
      const chipH = out.consumerPersonas.length * (CHIP_H + CHIP_GAP)
      const destH = (out.destinationSystems?.length || 0) * (SYS_H + CHIP_GAP)
      return Math.max(cardH, chipH, destH) + LANE_GAP
    })

    const outputPages: number[][] = []
    let oPageRows: number[] = []
    let oPageH = 0
    cap.outputs.forEach((_, idx) => {
      if (oPageH + outputRowHeights[idx] > MAX_Y - CONTENT_START_Y && oPageRows.length > 0) {
        outputPages.push(oPageRows)
        oPageRows = []
        oPageH = 0
      }
      oPageRows.push(idx)
      oPageH += outputRowHeights[idx]
    })
    if (oPageRows.length > 0) outputPages.push(oPageRows)
    if (outputPages.length === 0) outputPages.push([])

    outputPages.forEach((rowIndices, pageIdx) => {
      const slide = pptx.addSlide()
      slide.background = { color: PPTX_COLORS.bg }
      addOutputSlideHeader(slide, pageIdx + 1, outputPages.length)

      if (rowIndices.length === 0) {
        slide.addText('No outputs defined', { x: 0.4, y: 3.2, w: W - 0.8, h: 0.4, fontSize: 11, color: PPTX_COLORS.muted, fontFace: 'Arial', align: 'center', italic: true })
      }

      let laneY = CONTENT_START_Y
      rowIndices.forEach(idx => {
        const out = cap.outputs[idx]
        const dims = out.dimensions || []
        const cardH = CARD_BASE + (dims.length > 0 ? dims.length * DIM_LINE_H + DIM_EXTRA : 0)

        // Output IP card
        drawIPCard(slide, ocColX[0], laneY, ocColW[0], cardH, out.informationProduct.name, out.informationProduct.category, dims, PPTX_COLORS.green, 9, 6, 6, DIM_LINE_H, 1)

        // Arrow O→C
        const arrowY = laneY + cardH / 2 - 0.02
        slide.addShape(pptx.ShapeType.line, { x: ocColX[0] + ocColW[0] + 0.05, y: arrowY, w: ocColX[1] - ocColX[0] - ocColW[0] - 0.1, h: 0, line: { color: PPTX_COLORS.border, width: 0.8, endArrowType: 'triangle' } })

        // Consumer personas
        let chipY = laneY
        out.consumerPersonas.forEach(p => {
          drawPersonaChip(slide, ocColX[1], chipY, ocColW[1], CHIP_H, p.name, p.color, 8)
          chipY += CHIP_H + CHIP_GAP
        })

        // Destination systems
        if (out.destinationSystems && out.destinationSystems.length > 0) {
          slide.addShape(pptx.ShapeType.line, { x: ocColX[1] + ocColW[1] + 0.05, y: arrowY, w: ocColX[2] - ocColX[1] - ocColW[1] - 0.1, h: 0, line: { color: PPTX_COLORS.border, width: 0.6, endArrowType: 'triangle' } })
          let destY = laneY
          out.destinationSystems.forEach(s => {
            slide.addShape(pptx.ShapeType.roundRect, { x: ocColX[2], y: destY, w: ocColW[2], h: SYS_H, rectRadius: 0.04, fill: { color: PPTX_COLORS.cardBgSoft }, line: { color: PPTX_COLORS.border, width: 0.3 } })
            slide.addText(s.name, { x: ocColX[2] + 0.12, y: destY, w: ocColW[2] - 0.2, h: SYS_H, fontSize: 8, color: PPTX_COLORS.textSec, fontFace: 'Arial', valign: 'middle' })
            destY += SYS_H + CHIP_GAP
          })
        }

        laneY += outputRowHeights[idx]
      })

      addFooter(slide, `${cap.name} — Outputs & Customers`)
    })
  })

  pptx.writeFile({ fileName: `${sanitizeFilename(title)}_SIPOC.pptx` })
}

// ─── HTML Export ────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function exportSIPOCHtml(
  title: string,
  capabilities: HydratedCapability[]
): void {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const capSections = capabilities.map((cap, ci) => {
    const inputLanes = cap.inputs.map(inp => {
      const supplierChips = inp.supplierPersonas.map(p =>
        `<span class="persona-chip"><span class="persona-dot" style="background:${escHtml(p.color)}"></span>${escHtml(p.name)}</span>`
      ).join('')
      const sourceChips = inp.sourceSystems.map(s =>
        `<span class="system-chip"><span class="sys-dot" style="background:${escHtml(s.color || '#64748B')}"></span>${escHtml(s.name)}</span>`
      ).join('')
      const feedingHtml = inp.feedingSystem
        ? `<div class="feeding-row"><span class="feeding-label">FEEDS</span><span class="system-chip"><span class="sys-dot" style="background:${escHtml(inp.feedingSystem.color || '#64748B')}"></span>${escHtml(inp.feedingSystem.name)}</span></div>`
        : ''
      const tagChips = (inp.tags || []).map(t =>
        `<span class="tag-chip" style="background:${escHtml(t.color)}">${escHtml(t.name)}</span>`
      ).join('')
      const tagHtml = tagChips ? `<div class="tag-row">${tagChips}</div>` : ''
      const dimHtml = (inp.dimensions || []).length > 0
        ? `<div class="dim-divider"></div>${(inp.dimensions || []).map(d => {
            const dimTagChips = (d.tags || []).map(t =>
              `<span class="tag-chip tag-chip-sm" style="background:${escHtml(t.color)}">${escHtml(t.name)}</span>`
            ).join('')
            return `<div class="dim-item">&bull; ${escHtml(d.name)} ${dimTagChips}</div>`
          }).join('')}`
        : ''
      const catHtml = inp.informationProduct.category
        ? `<div class="ip-category">${escHtml(inp.informationProduct.category.toUpperCase())}</div>`
        : ''

      return `<div class="lane">
        <div class="lane-col supplier-col">
          <div class="persona-stack">${supplierChips || '<span class="empty-note">No suppliers</span>'}</div>
          <div class="source-systems">${sourceChips}</div>
        </div>
        <div class="lane-col arrow-col"><span class="arrow">&rarr;</span></div>
        <div class="lane-col input-col">
          <div class="ip-card input-accent">
            <div class="ip-name">${escHtml(inp.informationProduct.name)}</div>
            ${catHtml}
            ${tagHtml}
            ${dimHtml}
          </div>
          ${feedingHtml}
        </div>
      </div>`
    }).join('')

    const outputLanes = cap.outputs.map(out => {
      const dims = (out.dimensions || []).map(d => d.name)
      const consumerChips = out.consumerPersonas.map(p =>
        `<span class="persona-chip"><span class="persona-dot" style="background:${escHtml(p.color)}"></span>${escHtml(p.name)}</span>`
      ).join('')
      const destChips = out.destinationSystems ? out.destinationSystems.map(s =>
        `<span class="system-chip"><span class="sys-dot" style="background:${escHtml(s.color || '#64748B')}"></span>${escHtml(s.name)}</span>`
      ).join('') : ''
      const destHtml = destChips
        ? `<div class="dest-row"><span class="dest-label">AVAILABLE IN</span>${destChips}</div>`
        : ''
      const dimHtml = dims.length > 0
        ? `<div class="dim-divider"></div>${dims.map(d => `<div class="dim-item">&bull; ${escHtml(d)}</div>`).join('')}`
        : ''
      const catHtml = out.informationProduct.category
        ? `<div class="ip-category">${escHtml(out.informationProduct.category.toUpperCase())}</div>`
        : ''

      return `<div class="lane">
        <div class="lane-col output-col">
          <div class="ip-card output-accent">
            <div class="ip-name">${escHtml(out.informationProduct.name)}</div>
            ${catHtml}
            ${dimHtml}
          </div>
          ${destHtml}
        </div>
        <div class="lane-col arrow-col"><span class="arrow">&rarr;</span></div>
        <div class="lane-col consumer-col">
          <div class="persona-stack">${consumerChips || '<span class="empty-note">No consumers</span>'}</div>
        </div>
      </div>`
    }).join('')

    const sysLabel = cap.system ? `<span class="cap-system">${escHtml(cap.system.name)}</span>` : ''
    const featuresHtml = (cap.features || []).length > 0
      ? `<div class="features-block"><span class="features-label">FEATURES</span>${(cap.features || []).map(f => `<span class="feature-item">${escHtml(f)}</span>`).join('')}</div>`
      : ''

    return `<section class="capability-section">
      <div class="cap-header">
        <div class="cap-header-left">
          <span class="cap-number">${ci + 1}</span>
          <span class="cap-name">${escHtml(cap.name)}</span>
        </div>
        <div class="cap-header-right">
          <span class="cap-io">${cap.inputs.length} inputs &middot; ${cap.outputs.length} outputs</span>
          ${sysLabel}
        </div>
      </div>
      <div class="sipoc-columns">
        <div class="col-header"><span class="col-badge badge-s">S</span><span class="col-label">SUPPLIERS</span></div>
        <div class="col-header"><span class="col-badge badge-i">I</span><span class="col-label">INPUTS</span></div>
        <div class="col-header"><span class="col-badge badge-p">P</span><span class="col-label">PROCESS</span></div>
        <div class="col-header"><span class="col-badge badge-o">O</span><span class="col-label">OUTPUTS</span></div>
        <div class="col-header"><span class="col-badge badge-c">C</span><span class="col-label">CUSTOMERS</span></div>
      </div>
      <div class="sipoc-flow">
        <div class="flow-side flow-left">
          ${inputLanes || '<div class="empty-note">No inputs defined</div>'}
        </div>
        <div class="flow-center">
          <div class="process-block">
            <div class="process-level">L${cap.level} ${cap.level === 3 ? 'FUNCTIONALITY' : cap.level === 2 ? 'CAPABILITY' : 'CORE AREA'}</div>
            <div class="process-name">${escHtml(cap.name)}</div>
            ${featuresHtml}
          </div>
        </div>
        <div class="flow-side flow-right">
          ${outputLanes || '<div class="empty-note">No outputs defined</div>'}
        </div>
      </div>
    </section>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MACH12 / ${escHtml(title)} - SIPOC</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #F9FAFB;
    color: #1E293B;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
    line-height: 1.5;
    padding: 32px;
  }
  .page-header {
    margin-bottom: 32px;
    border-bottom: 1px solid #E2E8F0;
    padding-bottom: 16px;
  }
  .page-title {
    font-size: 24px;
    font-weight: 700;
  }
  .page-title .brand { color: #2563EB; font-family: monospace; }
  .page-title .slash { color: #64748B; margin: 0 8px; }
  .page-meta {
    font-size: 11px;
    color: #64748B;
    font-family: monospace;
    margin-top: 4px;
  }
  .capability-section {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    margin-bottom: 24px;
    overflow: hidden;
  }
  .cap-header {
    background: #F8FAFC;
    padding: 12px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #E2E8F0;
  }
  .cap-header-left { display: flex; align-items: center; gap: 10px; }
  .cap-number {
    background: #2563EB;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    width: 24px; height: 24px;
    border-radius: 6px;
    display: inline-flex; align-items: center; justify-content: center;
    font-family: monospace;
  }
  .cap-name { font-size: 15px; font-weight: 600; color: #1E293B; }
  .cap-header-right { display: flex; align-items: center; gap: 12px; }
  .cap-io { font-size: 11px; color: #64748B; font-family: monospace; }
  .cap-system {
    font-size: 10px;
    color: #2563EB;
    background: rgba(37,99,235,0.1);
    padding: 2px 8px;
    border-radius: 4px;
  }
  .sipoc-columns {
    display: flex;
    justify-content: space-around;
    padding: 12px 20px 8px;
    border-bottom: 1px solid #E2E8F0;
  }
  .col-header { display: flex; align-items: center; gap: 8px; }
  .col-badge {
    width: 24px; height: 24px; border-radius: 6px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: #fff;
  }
  .badge-s { background: #F97316; }
  .badge-i { background: #EAB308; }
  .badge-p { background: #2563EB; }
  .badge-o { background: #10B981; }
  .badge-c { background: #8B5CF6; }
  .col-label { font-size: 9px; font-weight: 700; color: #64748B; font-family: monospace; letter-spacing: 0.5px; }
  .sipoc-flow {
    display: flex;
    padding: 16px 12px;
    gap: 8px;
    align-items: flex-start;
  }
  .flow-side { flex: 2; display: flex; flex-direction: column; gap: 10px; }
  .flow-center { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding-top: 4px; }
  .process-block {
    background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
    border: 1.5px solid #2563EB;
    border-radius: 8px;
    padding: 16px 14px;
    text-align: center;
    width: 100%;
    min-height: 80px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .process-level { font-size: 8px; font-weight: 700; color: #2563EB; font-family: monospace; letter-spacing: 1px; margin-bottom: 6px; }
  .process-name { font-size: 13px; font-weight: 700; color: #1E293B; }
  .lane {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 4px 0;
  }
  .lane-col { display: flex; flex-direction: column; gap: 4px; }
  .supplier-col, .consumer-col { flex: 1; min-width: 0; }
  .input-col, .output-col { flex: 1.3; min-width: 0; }
  .arrow-col {
    flex: 0 0 28px;
    display: flex; align-items: center; justify-content: center;
    padding-top: 8px;
  }
  .arrow { color: #E2E8F0; font-size: 16px; opacity: 0.6; }
  .persona-stack { display: flex; flex-direction: column; gap: 4px; }
  .persona-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-radius: 12px;
    padding: 3px 10px 3px 6px;
    font-size: 11px;
    color: #475569;
  }
  .persona-dot {
    width: 10px; height: 10px; border-radius: 50%;
    display: inline-block; flex-shrink: 0;
  }
  .source-systems { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .system-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 10px;
    color: #475569;
  }
  .sys-dot {
    width: 8px; height: 8px; border-radius: 2px;
    display: inline-block; flex-shrink: 0;
  }
  .ip-card {
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-radius: 6px;
    padding: 10px 12px;
    border-left: 3px solid transparent;
  }
  .input-accent { border-left-color: #EAB308; }
  .output-accent { border-left-color: #10B981; }
  .ip-name { font-size: 12px; font-weight: 600; color: #1E293B; }
  .ip-category { font-size: 9px; color: #64748B; font-family: monospace; text-transform: uppercase; margin-top: 2px; }
  .dim-divider { border-top: 1px solid #E2E8F0; margin: 6px 0; }
  .dim-item { font-size: 10px; color: #64748B; line-height: 1.6; }
  .feeding-row, .dest-row {
    display: flex; align-items: center; gap: 6px;
    margin-top: 4px;
  }
  .feeding-label, .dest-label {
    font-size: 8px; font-weight: 700; color: #64748B;
    font-family: monospace; letter-spacing: 0.5px;
  }
  .empty-note { font-size: 10px; color: #64748B; font-style: italic; }
  .tag-row { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
  .tag-chip { font-size: 9px; color: #fff; padding: 1px 6px; border-radius: 3px; display: inline-block; }
  .tag-chip-sm { font-size: 8px; padding: 0 4px; margin-left: 4px; vertical-align: middle; }
  .features-block { margin-top: 10px; border-top: 1px solid #E2E8F0; padding-top: 8px; }
  .features-label { font-size: 8px; font-weight: 700; color: #2563EB; font-family: monospace; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
  .feature-item { font-size: 10px; color: #475569; display: block; line-height: 1.6; }
  .feature-item::before { content: "• "; color: #94A3B8; }
  .page-footer {
    text-align: center;
    font-size: 10px;
    color: #E2E8F0;
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #E2E8F0;
    font-family: monospace;
  }

  @media print {
    body { background: #fff; color: #1a1a1a; padding: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .capability-section { break-inside: avoid; page-break-inside: avoid; border-color: #ddd; background: #f9f9fb; }
    .cap-header { background: #eef1f6; }
    .ip-card { background: #f5f6fa; }
    .process-block { background: #e8edf6; border-color: #2563EB; }
    .persona-chip, .system-chip { background: #eef1f6; }
    .page-footer { color: #999; border-color: #ddd; }
  }
</style>
</head>
<body>
  <div class="page-header">
    <div class="page-title"><span class="brand">MACH12</span><span class="slash">/</span>${escHtml(title)}</div>
    <div class="page-meta">${capabilities.length} Capabilit${capabilities.length === 1 ? 'y' : 'ies'} &middot; SIPOC Export &middot; ${escHtml(dateStr)}</div>
  </div>
  ${capSections}
  <div class="page-footer">Generated by Mach12.ai</div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(title)}_SIPOC.html`
  a.click()
  URL.revokeObjectURL(url)
}
