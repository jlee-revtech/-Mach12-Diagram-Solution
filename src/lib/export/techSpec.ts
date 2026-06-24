// ─────────────────────────────────────────────────────────────────────────────
// Technical Spec context assembly + document export helpers.
//
// The context builder is PURE and DETERMINISTIC: given the same diagram (or
// group) it produces the same normalized payload, with systems and integrations
// sorted by stable keys and integration IDs assigned in that fixed order. That
// payload is what gets handed to the AI (temperature 0) so re-runs reproduce the
// same functional + technical integration specification.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SystemNode,
  SystemGroupNode,
  DataFlowEdge,
  DiagramMeta,
} from '@/lib/diagram/types'

// Nominal node footprint used to find a node's centre when React Flow has not
// measured it yet (store nodes don't always carry width/height).
const NOMINAL_W = 180
const NOMINAL_H = 80

export type TechSpecScope =
  | { kind: 'diagram' }
  | { kind: 'group'; groupId: string; groupLabel: string }

export interface TechSpecSystemCtx {
  id: string
  label: string
  systemType: string
  physicalSystem?: string
  description?: string
  modules?: { name: string; description?: string }[]
  /** false = referenced by a boundary integration but outside the chosen group */
  inScope: boolean
}

export interface TechSpecDataObjectCtx {
  name: string
  elementType: string
  description?: string
  sapObject?: string
  processContext?: string
  attributes?: string[]
  technicalProperties?: { key: string; value: string }[]
}

export interface TechSpecIntegrationCtx {
  id: string
  sourceLabel: string
  sourceType: string
  sourcePhysical?: string
  targetLabel: string
  targetType: string
  targetPhysical?: string
  direction: string
  processContext?: string
  /** true when the flow crosses the chosen group's boundary */
  boundary: boolean
  dataObjects: TechSpecDataObjectCtx[]
}

export interface TechSpecContext {
  diagramTitle: string
  scopeLabel: string
  processContext?: string
  description?: string
  notes?: string
  systems: TechSpecSystemCtx[]
  integrations: TechSpecIntegrationCtx[]
}

export interface TechSpecAnswer {
  questionId: string
  question: string
  category: string
  answer: string
}

// ─── Group geometry ────────────────────────────────────────────────────────
function nodeCentre(n: SystemNode): { x: number; y: number } {
  const w = (n as { width?: number }).width ?? (n.measured?.width as number | undefined) ?? NOMINAL_W
  const h = (n as { height?: number }).height ?? (n.measured?.height as number | undefined) ?? NOMINAL_H
  return { x: n.position.x + w / 2, y: n.position.y + h / 2 }
}

function isNodeInGroup(n: SystemNode, group: SystemGroupNode): boolean {
  const gx = group.position.x
  const gy = group.position.y
  const gw = (group.style?.width as number | undefined) ?? 500
  const gh = (group.style?.height as number | undefined) ?? 400
  const c = nodeCentre(n)
  return c.x >= gx && c.x <= gx + gw && c.y >= gy && c.y <= gy + gh
}

// ─── Context builder ───────────────────────────────────────────────────────
export function buildTechSpecContext(args: {
  meta: DiagramMeta
  nodes: SystemNode[]
  edges: DataFlowEdge[]
  groups: SystemGroupNode[]
  scope: TechSpecScope
}): TechSpecContext {
  const { meta, nodes, edges, scope } = args

  const inScopeIds = new Set<string>()
  if (scope.kind === 'group') {
    const group = args.groups.find((g) => g.id === scope.groupId)
    if (group) {
      for (const n of nodes) if (isNodeInGroup(n, group)) inScopeIds.add(n.id)
    }
  } else {
    for (const n of nodes) inScopeIds.add(n.id)
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  // Edges relevant to the scope. Internal = both ends in scope. Boundary = one
  // end in scope (a cross-system interface worth documenting for a group spec).
  const relevantEdges: { edge: DataFlowEdge; boundary: boolean }[] = []
  for (const e of edges) {
    const srcIn = inScopeIds.has(e.source)
    const tgtIn = inScopeIds.has(e.target)
    if (!srcIn && !tgtIn) continue
    if (!nodeById.has(e.source) || !nodeById.has(e.target)) continue
    relevantEdges.push({ edge: e, boundary: !(srcIn && tgtIn) })
  }

  // Systems referenced by relevant edges (plus any in-scope node, even if
  // unconnected). Boundary edges pull their external endpoint in as inScope:false.
  const referenced = new Set<string>(inScopeIds)
  for (const { edge } of relevantEdges) {
    referenced.add(edge.source)
    referenced.add(edge.target)
  }

  const systems: TechSpecSystemCtx[] = [...referenced]
    .map((id) => nodeById.get(id))
    .filter((n): n is SystemNode => !!n)
    .map((n) => ({
      id: n.id,
      label: n.data.label,
      systemType: n.data.systemType,
      physicalSystem: n.data.physicalSystem,
      description: n.data.description,
      modules: n.data.modules?.map((m) => ({ name: m.name, description: m.description })),
      inScope: inScopeIds.has(n.id),
    }))
    .sort(
      (a, b) =>
        Number(b.inScope) - Number(a.inScope) ||
        a.systemType.localeCompare(b.systemType) ||
        a.label.localeCompare(b.label),
    )

  const integrations: TechSpecIntegrationCtx[] = relevantEdges
    .map(({ edge, boundary }) => {
      const src = nodeById.get(edge.source)!
      const tgt = nodeById.get(edge.target)!
      return {
        sourceLabel: src.data.label,
        sourceType: src.data.systemType,
        sourcePhysical: src.data.physicalSystem,
        targetLabel: tgt.data.label,
        targetType: tgt.data.systemType,
        targetPhysical: tgt.data.physicalSystem,
        direction: edge.data?.direction ?? 'forward',
        processContext: edge.data?.processContext,
        boundary,
        dataObjects: (edge.data?.dataElements ?? []).map((el) => ({
          name: el.name,
          elementType: el.elementType,
          description: el.description,
          sapObject: el.sapObject,
          processContext: el.processContext,
          attributes: el.attributes?.map((a) => a.name).filter(Boolean),
          technicalProperties: el.technicalProperties?.map((p) => ({ key: p.key, value: p.value })),
        })),
      }
    })
    // Stable ordering → stable integration IDs → deterministic spec.
    .sort(
      (a, b) =>
        a.sourceType.localeCompare(b.sourceType) ||
        a.targetType.localeCompare(b.targetType) ||
        a.sourceLabel.localeCompare(b.sourceLabel) ||
        a.targetLabel.localeCompare(b.targetLabel),
    )
    .map((it, i) => ({ id: `INT-${String(i + 1).padStart(3, '0')}`, ...it }))

  return {
    diagramTitle: meta.title,
    scopeLabel: scope.kind === 'group' ? scope.groupLabel : 'Entire Diagram',
    processContext: meta.processContext,
    description: meta.description,
    notes: meta.notes,
    systems,
    integrations,
  }
}

// ─── Minimal Markdown → HTML (headings, tables, lists, inline) ──────────────
// Scoped to the constructs the spec generator is instructed to emit. Good enough
// for an on-screen preview and a Word/print-ready document, with no extra deps.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let i = 0
  let listType: 'ul' | 'ol' | null = null

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`)
      listType = null
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // Table: a row of pipes followed by a separator row of dashes.
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      closeList()
      const header = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
        i++
      }
      html.push('<table><thead><tr>')
      header.forEach((c) => html.push(`<th>${inlineMd(c)}</th>`))
      html.push('</tr></thead><tbody>')
      rows.forEach((r) => {
        html.push('<tr>')
        header.forEach((_, ci) => html.push(`<td>${inlineMd(r[ci] ?? '')}</td>`))
        html.push('</tr>')
      })
      html.push('</tbody></table>')
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = heading[1].length
      html.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`)
      i++
      continue
    }

    if (/^\s*(---|___|\*\*\*)\s*$/.test(line)) {
      closeList()
      html.push('<hr/>')
      i++
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      closeList()
      html.push(`<blockquote>${inlineMd(line.replace(/^\s*>\s?/, ''))}</blockquote>`)
      i++
      continue
    }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/)
    const ul = line.match(/^\s*[-*]\s+(.*)$/)
    if (ol || ul) {
      const want: 'ul' | 'ol' = ol ? 'ol' : 'ul'
      if (listType !== want) {
        closeList()
        listType = want
        html.push(`<${want}>`)
      }
      html.push(`<li>${inlineMd((ol ?? ul)![1])}</li>`)
      i++
      continue
    }

    if (line.trim() === '') {
      closeList()
      i++
      continue
    }

    closeList()
    html.push(`<p>${inlineMd(line)}</p>`)
    i++
  }
  closeList()
  return html.join('\n')
}

// ─── Document styling shared by preview / Word / print ──────────────────────
const DOC_CSS = `
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; line-height: 1.5; max-width: 920px; margin: 0 auto; padding: 48px 56px; }
  h1 { font-size: 26px; border-bottom: 3px solid #2563EB; padding-bottom: 8px; margin: 0 0 4px; color: #0f172a; }
  h2 { font-size: 20px; margin: 28px 0 8px; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 16px; margin: 20px 0 6px; color: #1e40af; }
  h4 { font-size: 14px; margin: 14px 0 4px; color: #334155; }
  p, li { font-size: 12.5px; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 11.5px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #eff6ff; color: #1e3a8a; font-weight: 600; }
  tr:nth-child(even) td { background: #f8fafc; }
  code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-family: 'Consolas', monospace; font-size: 11px; color: #be185d; }
  blockquote { border-left: 3px solid #93c5fd; margin: 8px 0; padding: 4px 14px; color: #475569; background: #f8fafc; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 18px 0; }
  ul, ol { margin: 6px 0 6px 4px; padding-left: 22px; }
  a { color: #2563EB; }
`

function sanitizeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_') || 'technical-spec'
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadSpecMarkdown(markdown: string, title: string) {
  triggerDownload(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), `${sanitizeFilename(title)}.md`)
}

export function downloadSpecWord(markdown: string, title: string) {
  const body = markdownToHtml(markdown)
  const doc = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${DOC_CSS}</style></head><body>${body}</body></html>`
  triggerDownload(new Blob([doc], { type: 'application/msword;charset=utf-8' }), `${sanitizeFilename(title)}.doc`)
}

export function printSpec(markdown: string, title: string) {
  const body = markdownToHtml(markdown)
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${DOC_CSS} @media print { body { padding: 0; } }</style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`,
  )
  w.document.close()
}
