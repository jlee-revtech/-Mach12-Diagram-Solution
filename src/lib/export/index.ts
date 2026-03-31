import { toPng, toSvg } from 'html-to-image'
import { jsPDF } from 'jspdf'
import type { SystemNode, DataFlowEdge, DiagramMeta } from '@/lib/diagram/types'
import { generateBpmn } from './bpmn'

function getFlowElement(): HTMLElement | null {
  return document.querySelector('.react-flow') as HTMLElement | null
}

function downloadFile(data: string | Blob, filename: string) {
  const url = typeof data === 'string'
    ? data
    : URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  if (typeof data !== 'string') URL.revokeObjectURL(url)
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_') || 'diagram'
}

// ─── PNG Export ─────────────────────────────────────────
export async function exportPng(title: string): Promise<void> {
  const el = getFlowElement()
  if (!el) return

  const dataUrl = await toPng(el, {
    backgroundColor: '#151E2E',
    pixelRatio: 2,
    filter: (node) => {
      // Exclude minimap and toolbar from export
      const cls = node.classList?.toString() || ''
      return !cls.includes('react-flow__minimap') &&
             !cls.includes('react-flow__controls') &&
             !node.closest?.('[class*="absolute top-4"]')
    },
  })

  downloadFile(dataUrl, `${sanitizeFilename(title)}.png`)
}

// ─── SVG Export ─────────────────────────────────────────
export async function exportSvg(title: string): Promise<void> {
  const el = getFlowElement()
  if (!el) return

  const dataUrl = await toSvg(el, {
    backgroundColor: '#151E2E',
    filter: (node) => {
      const cls = node.classList?.toString() || ''
      return !cls.includes('react-flow__minimap') &&
             !cls.includes('react-flow__controls') &&
             !node.closest?.('[class*="absolute top-4"]')
    },
  })

  downloadFile(dataUrl, `${sanitizeFilename(title)}.svg`)
}

// ─── PDF Export ─────────────────────────────────────────
export async function exportPdf(title: string): Promise<void> {
  const el = getFlowElement()
  if (!el) return

  const dataUrl = await toPng(el, {
    backgroundColor: '#151E2E',
    pixelRatio: 2,
    filter: (node) => {
      const cls = node.classList?.toString() || ''
      return !cls.includes('react-flow__minimap') &&
             !cls.includes('react-flow__controls') &&
             !node.closest?.('[class*="absolute top-4"]')
    },
  })

  const img = new Image()
  img.src = dataUrl
  await new Promise((resolve) => { img.onload = resolve })

  const pdf = new jsPDF({
    orientation: img.width > img.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [img.width / 2, img.height / 2],
  })

  // Title header
  pdf.setFontSize(16)
  pdf.setTextColor(248, 250, 252)
  pdf.setFillColor(21, 30, 46)
  pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F')
  pdf.text(title, 20, 30)

  // Subtitle
  pdf.setFontSize(8)
  pdf.setTextColor(100, 116, 139)
  pdf.text(`Exported ${new Date().toLocaleDateString()} | Mach12.ai`, 20, 42)

  // Diagram image
  pdf.addImage(dataUrl, 'PNG', 0, 50, img.width / 2, img.height / 2)

  pdf.save(`${sanitizeFilename(title)}.pdf`)
}

// ─── JSON Schema Export ─────────────────────────────────
export function exportJson(
  meta: DiagramMeta,
  nodes: SystemNode[],
  edges: DataFlowEdge[]
): void {
  const schema = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    exportedFrom: 'Mach12.ai',
    diagram: {
      id: meta.id,
      title: meta.title,
      description: meta.description,
      processContext: meta.processContext,
    },
    systems: nodes.map((n) => ({
      id: n.id,
      label: n.data.label,
      systemType: n.data.systemType,
      physicalSystem: n.data.physicalSystem,
      position: n.position,
    })),
    dataFlows: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      direction: e.data?.direction,
      dataElements: (e.data?.dataElements || []).map((el) => ({
        name: el.name,
        elementType: el.elementType,
        description: el.description,
        attributes: el.attributes?.map((a) => ({ name: a.name })),
      })),
    })),
  }

  const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' })
  downloadFile(blob, `${sanitizeFilename(meta.title)}.json`)
}

// ─── BPMN 2.0 XML Export (for SAP Signavio) ─────────────
export function exportBpmn(
  meta: DiagramMeta,
  nodes: SystemNode[],
  edges: DataFlowEdge[]
): void {
  const xml = generateBpmn(meta, nodes, edges)
  const blob = new Blob([xml], { type: 'application/xml' })
  downloadFile(blob, `${sanitizeFilename(meta.title)}.bpmn`)
}
