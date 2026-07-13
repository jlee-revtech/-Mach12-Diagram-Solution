// Deliverable enrichment tools: the Super Consultant agents can read the org's
// Documents (deliverables) and, on explicit user request, enrich them with new
// sections, tables, agent-authored SVG visuals, and references to Data Studio
// diagrams.
//
// The content model is the agent-core GeneratedDeliverable shape persisted at
// deliverables.content = { sections: [{ key, title, content }] }, extended
// APP-SIDE with an optional blocks array per section (src/lib/deliverables/
// blocks.ts). Old documents have no blocks; nothing here ever rewrites a
// section's existing prose unless the user asked for exactly that.
//
// Every write verifies the deliverable belongs to ctx.orgId before touching it
// (RLS is the backstop, not the check). The deliverables table has an
// updated_at trigger, so a content update bumps the timestamp automatically.

import type { AgentTool, ToolContext } from '@jlee-revtech/agent-core'
import type { DeliverableSection, SectionBlock } from '@/lib/deliverables/blocks'

const J = (v: unknown) => JSON.stringify(v, null, 2)

const ONLY_ON_REQUEST =
  'Use this tool ONLY when the user has explicitly asked you to add or change content in this document. ' +
  'Never enrich a document speculatively.'

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

// ─── Load / save helpers ────────────────────────────────────────────────────

interface DeliverableRow {
  id: string
  title: string
  dtype: string
  status: string
  workstream_code: string
  content: { sections?: DeliverableSection[] } & Record<string, unknown>
  created_at: string | null
  updated_at: string | null
}

async function loadDeliverable(
  ctx: ToolContext,
  id: string,
): Promise<{ row: DeliverableRow; sections: DeliverableSection[] } | string> {
  if (!id) return 'A deliverable id is required. Call list_deliverables first.'
  const { data, error } = await ctx.modelDb
    .from('deliverables')
    .select('id, title, dtype, status, workstream_code, content, created_at, updated_at')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .maybeSingle()
  if (error) return `Error reading the deliverable: ${error.message}`
  if (!data) return "No such deliverable in this organization. Do not guess ids; call list_deliverables first."
  const row = data as unknown as DeliverableRow
  const sections = Array.isArray(row.content?.sections) ? row.content.sections : []
  return { row, sections }
}

async function saveSections(ctx: ToolContext, row: DeliverableRow, sections: DeliverableSection[]): Promise<string | null> {
  const { error } = await ctx.modelDb
    .from('deliverables')
    .update({ content: { ...(row.content ?? {}), sections } })
    .eq('id', row.id)
    .eq('organization_id', ctx.orgId)
  return error ? `Failed to save the document: ${error.message}` : null
}

function sectionAt(sections: DeliverableSection[], idxArg: unknown): { idx: number; section: DeliverableSection } | string {
  const idx = typeof idxArg === 'number' ? idxArg : Number(idxArg)
  if (!Number.isInteger(idx) || idx < 0 || idx >= sections.length) {
    return `section_index must be a 0-based integer between 0 and ${sections.length - 1} (this document has ${sections.length} section(s)). Call get_deliverable to see the sections and their indexes.`
  }
  return { idx, section: sections[idx] }
}

function summarizeBlock(b: SectionBlock): Record<string, unknown> {
  if (b.kind === 'table') return { kind: 'table', title: b.title, columns: b.columns.length, rows: b.rows.length }
  if (b.kind === 'svg') return { kind: 'svg', title: b.title, bytes: b.svg.length }
  return { kind: 'diagram_ref', title: b.title, diagram_id: b.diagramId }
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'section'

function uniqueKey(sections: DeliverableSection[], title: string): string {
  const base = slug(title)
  const keys = new Set(sections.map((s) => s.key))
  if (!keys.has(base)) return base
  let n = 2
  while (keys.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// ─── SVG sanitizer (reject, never repair) ───────────────────────────────────

const SVG_MAX_BYTES = 120 * 1024

const SVG_FORBIDDEN: { re: RegExp; why: string }[] = [
  { re: /<script/i, why: 'a <script> element' },
  { re: /<foreignobject/i, why: 'a <foreignObject> element' },
  { re: /\son[a-z]+\s*=/i, why: 'an on*= event handler attribute' },
  { re: /javascript:/i, why: 'a javascript: URL' },
  { re: /<iframe|<embed|<object/i, why: 'an embedded document element' },
  { re: /(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/)/i, why: 'an external href' },
  { re: /url\(\s*["']?\s*(?:https?:|\/\/)/i, why: 'an external url() reference' },
  { re: /@import/i, why: 'a CSS @import' },
  { re: /data:text\/html/i, why: 'a data:text/html URL' },
  { re: /<!entity/i, why: 'an XML entity declaration' },
]

function sanitizeSvg(raw: string): { ok: true; svg: string } | { ok: false; reason: string } {
  const svg = raw.trim()
  if (!svg) return { ok: false, reason: 'the svg argument is empty' }
  if (!/^<svg[\s>]/i.test(svg)) return { ok: false, reason: 'the markup must start with <svg (no XML prolog, no wrapper elements)' }
  if (!/<\/svg>\s*$/i.test(svg)) return { ok: false, reason: 'the markup must end with </svg>' }
  if (svg.length > SVG_MAX_BYTES) return { ok: false, reason: `the SVG is ${svg.length} bytes; the limit is ${SVG_MAX_BYTES}. Simplify the drawing.` }
  for (const { re, why } of SVG_FORBIDDEN) {
    if (re.test(svg)) return { ok: false, reason: `it contains ${why}, which is not allowed. Author a plain, self-contained SVG and call again.` }
  }
  return { ok: true, svg }
}

const SVG_AUTHORING_RULES =
  'SVG AUTHORING RULES (professional consulting quality, non-negotiable): ' +
  "white #FFFFFF background; viewBox of roughly 1200x675; ONLY orthogonal elbow connectors built from horizontal and vertical segments, NEVER diagonal lines; " +
  'no overlapping boxes, labels, or lines; arrowheads via <marker> defs; boxes with 8px corner radius (rx="8"); ' +
  'Tesseract palette: #2563EB brand blue, #16a34a green / #ca8a04 amber / #dc2626 red for status accents, #1b1b1b primary text, #5e5e5e secondary text, #e2e2e2 borders; ' +
  "font-family 'Noto Sans', sans-serif with 12-14px labels; generous whitespace and aligned edges. " +
  'The SVG must be fully self-contained: no scripts, no foreignObject, no event handlers, no external references of any kind (they are rejected).'

// ─── Read tools ─────────────────────────────────────────────────────────────

export const LIST_DELIVERABLES: AgentTool = {
  name: 'list_deliverables',
  description:
    "List the organization's documents (deliverables) in the Documents tab: id, title, type, status, workstream, and section titles. Use this to find the document the user is talking about before reading or enriching it.",
  input_schema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['draft', 'review', 'final'], description: 'Optional status filter.' },
    },
    required: [],
  },
  async execute(args, ctx) {
    let q = ctx.modelDb
      .from('deliverables')
      .select('id, title, dtype, status, workstream_code, content, created_at, updated_at')
      .eq('organization_id', ctx.orgId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (str(args.status)) q = q.eq('status', str(args.status))
    const { data, error } = await q
    if (error) return `Error: ${error.message}`
    const rows = (data ?? []) as unknown as DeliverableRow[]
    if (!rows.length) return 'The organization has no documents yet. An agent creates them with generate_deliverable or create_document.'
    return J(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.dtype,
        status: r.status,
        workstream: r.workstream_code,
        sections: (Array.isArray(r.content?.sections) ? r.content.sections : []).map((s, i) => `[${i}] ${s.title}`),
        updated_at: r.updated_at,
      }))
    )
  },
}

export const GET_DELIVERABLE: AgentTool = {
  name: 'get_deliverable',
  description:
    'Read one document (deliverable) in full: every section with its 0-based index, its body text, and a summary of any enrichment blocks (tables, visuals, diagram references) it already carries. Call this before enriching so you target the right section_index and never duplicate existing content.',
  input_schema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'The deliverable id (from list_deliverables).' } },
    required: ['id'],
  },
  async execute(args, ctx) {
    const loaded = await loadDeliverable(ctx, str(args.id))
    if (typeof loaded === 'string') return loaded
    const { row, sections } = loaded
    const SECTION_CAP = 4000
    return J({
      id: row.id,
      title: row.title,
      type: row.dtype,
      status: row.status,
      workstream: row.workstream_code,
      sections: sections.map((s, i) => ({
        index: i,
        title: s.title,
        body: s.content.length > SECTION_CAP ? `${s.content.slice(0, SECTION_CAP)}\n[truncated ${s.content.length - SECTION_CAP} chars]` : s.content,
        blocks: (s.blocks ?? []).map(summarizeBlock),
      })),
    })
  },
}

// ─── Write tools ────────────────────────────────────────────────────────────

export const ADD_DELIVERABLE_SECTION: AgentTool = {
  name: 'add_deliverable_section',
  description:
    `Add a NEW section (title + markdown body) to an existing document in the Documents tab. ${ONLY_ON_REQUEST} Existing sections are never modified by this tool. Never use em-dashes or en-dashes in the content.`,
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The deliverable id.' },
      title: { type: 'string', description: 'The section heading.' },
      body: { type: 'string', description: 'The full section body as markdown (## sub-headings, bullet lists, tables, bold).' },
      position: { type: 'number', description: '0-based index to insert at. Omit to append at the end.' },
    },
    required: ['id', 'title', 'body'],
  },
  async execute(args, ctx) {
    const title = str(args.title)
    const body = str(args.body)
    if (!title || !body) return 'A section needs both a title and a body.'
    const loaded = await loadDeliverable(ctx, str(args.id))
    if (typeof loaded === 'string') return loaded
    const { row, sections } = loaded
    const section: DeliverableSection = { key: uniqueKey(sections, title), title, content: body }
    const rawPos = typeof args.position === 'number' && Number.isFinite(args.position) ? Math.floor(args.position) : sections.length
    const pos = Math.max(0, Math.min(rawPos, sections.length))
    const next = [...sections.slice(0, pos), section, ...sections.slice(pos)]
    const err = await saveSections(ctx, row, next)
    if (err) return err
    return J({
      updated: 'deliverable',
      id: row.id,
      title: row.title,
      added_section: { index: pos, title },
      sections_now: next.map((s, i) => `[${i}] ${s.title}`),
      note: 'The document is visible in the Documents tab.',
    })
  },
}

export const UPDATE_DELIVERABLE_SECTION: AgentTool = {
  name: 'update_deliverable_section',
  description:
    `Rewrite the title and/or body of ONE existing section of a document. This REPLACES the section body; pass the complete new markdown, not a diff. Enrichment blocks already on the section are preserved. ${ONLY_ON_REQUEST} Never use em-dashes or en-dashes in the content.`,
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The deliverable id.' },
      section_index: { type: 'number', description: 'The 0-based section index (from get_deliverable).' },
      body: { type: 'string', description: 'The complete replacement body as markdown.' },
      title: { type: 'string', description: 'Optional replacement section heading.' },
    },
    required: ['id', 'section_index'],
  },
  async execute(args, ctx) {
    const body = typeof args.body === 'string' ? args.body.trim() : ''
    const title = str(args.title)
    if (!body && !title) return 'Pass at least one of body or title.'
    const loaded = await loadDeliverable(ctx, str(args.id))
    if (typeof loaded === 'string') return loaded
    const { row, sections } = loaded
    const at = sectionAt(sections, args.section_index)
    if (typeof at === 'string') return at
    const next = sections.map((s, i) =>
      i === at.idx ? { ...s, ...(title ? { title } : {}), ...(body ? { content: body } : {}) } : s
    )
    const err = await saveSections(ctx, row, next)
    if (err) return err
    return J({
      updated: 'deliverable',
      id: row.id,
      title: row.title,
      section: { index: at.idx, title: title || at.section.title, body_replaced: !!body, title_replaced: !!title },
    })
  },
}

const MAX_TABLE_COLS = 12
const MAX_TABLE_ROWS = 80

export const ADD_SECTION_TABLE: AgentTool = {
  name: 'add_section_table',
  description:
    `Append a structured TABLE block to one section of a document. The Documents tab renders it as a real styled table, and the Word/PowerPoint exports carry it as a real table. ${ONLY_ON_REQUEST} Limits: ${MAX_TABLE_COLS} columns, ${MAX_TABLE_ROWS} rows, every cell a plain string, every row exactly as wide as columns. Never use em-dashes or en-dashes in the cells.`,
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The deliverable id.' },
      section_index: { type: 'number', description: 'The 0-based section index (from get_deliverable).' },
      title: { type: 'string', description: 'Optional table caption.' },
      columns: { type: 'array', items: { type: 'string' }, description: 'The column headers.' },
      rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'The data rows; each row has one string per column.' },
    },
    required: ['id', 'section_index', 'columns', 'rows'],
  },
  async execute(args, ctx) {
    const columns = Array.isArray(args.columns) ? args.columns.map((c) => String(c ?? '').trim()) : []
    if (!columns.length || columns.some((c) => !c)) return 'columns must be a non-empty array of non-empty strings.'
    if (columns.length > MAX_TABLE_COLS) return `That is ${columns.length} columns; the limit is ${MAX_TABLE_COLS}.`
    const rawRows = Array.isArray(args.rows) ? args.rows : null
    if (!rawRows) return 'rows must be an array of string arrays.'
    if (rawRows.length > MAX_TABLE_ROWS) return `That is ${rawRows.length} rows; the limit is ${MAX_TABLE_ROWS}.`
    const rows: string[][] = []
    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i]
      if (!Array.isArray(r)) return `Row ${i} is not an array.`
      if (r.length !== columns.length) return `Row ${i} has ${r.length} cell(s); it must have exactly ${columns.length} (one per column).`
      rows.push(r.map((c) => String(c ?? '')))
    }

    const loaded = await loadDeliverable(ctx, str(args.id))
    if (typeof loaded === 'string') return loaded
    const { row, sections } = loaded
    const at = sectionAt(sections, args.section_index)
    if (typeof at === 'string') return at

    const block: SectionBlock = { kind: 'table', ...(str(args.title) ? { title: str(args.title) } : {}), columns, rows }
    const next = sections.map((s, i) => (i === at.idx ? { ...s, blocks: [...(s.blocks ?? []), block] } : s))
    const err = await saveSections(ctx, row, next)
    if (err) return err
    return J({
      updated: 'deliverable',
      id: row.id,
      title: row.title,
      section: { index: at.idx, title: at.section.title },
      added_block: { kind: 'table', columns: columns.length, rows: rows.length, title: str(args.title) || undefined },
    })
  },
}

export const ADD_SECTION_VISUAL: AgentTool = {
  name: 'add_section_visual',
  description:
    `Append an SVG VISUAL block (a diagram you author yourself) to one section of a document. YOU write the complete SVG markup in the svg argument; it is validated and sanitized server-side, and malicious or externally-referencing markup is rejected outright. ${ONLY_ON_REQUEST} ${SVG_AUTHORING_RULES}`,
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The deliverable id.' },
      section_index: { type: 'number', description: 'The 0-based section index (from get_deliverable).' },
      title: { type: 'string', description: 'Optional caption shown under the visual.' },
      svg: { type: 'string', description: 'The complete self-contained SVG markup, starting with <svg and ending with </svg>.' },
    },
    required: ['id', 'section_index', 'svg'],
  },
  async execute(args, ctx) {
    const check = sanitizeSvg(typeof args.svg === 'string' ? args.svg : '')
    if (!check.ok) return `The SVG was rejected: ${check.reason}`

    const loaded = await loadDeliverable(ctx, str(args.id))
    if (typeof loaded === 'string') return loaded
    const { row, sections } = loaded
    const at = sectionAt(sections, args.section_index)
    if (typeof at === 'string') return at

    const block: SectionBlock = { kind: 'svg', ...(str(args.title) ? { title: str(args.title) } : {}), svg: check.svg }
    const next = sections.map((s, i) => (i === at.idx ? { ...s, blocks: [...(s.blocks ?? []), block] } : s))
    const err = await saveSections(ctx, row, next)
    if (err) return err
    return J({
      updated: 'deliverable',
      id: row.id,
      title: row.title,
      section: { index: at.idx, title: at.section.title },
      added_block: { kind: 'svg', bytes: check.svg.length, title: str(args.title) || undefined },
      note: 'The visual renders in the Documents tab; exports fall back to a caption where embedding is not supported.',
    })
  },
}

export const ADD_SECTION_DIAGRAM_REF: AgentTool = {
  name: 'add_section_diagram_ref',
  description:
    `Append a DATA STUDIO DIAGRAM REFERENCE block to one section of a document: a card linking to an existing data-architecture diagram (/diagram/{id}). The diagram must already exist in this organization; find it with list_diagrams. ${ONLY_ON_REQUEST}`,
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The deliverable id.' },
      section_index: { type: 'number', description: 'The 0-based section index (from get_deliverable).' },
      diagram_id: { type: 'string', description: 'The Data Studio diagram id (from list_diagrams or create_diagram).' },
      title: { type: 'string', description: 'Optional card title; defaults to the diagram title.' },
    },
    required: ['id', 'section_index', 'diagram_id'],
  },
  async execute(args, ctx) {
    const diagramId = str(args.diagram_id)
    if (!diagramId) return 'diagram_id is required.'
    const { data: diagram, error: dErr } = await ctx.modelDb
      .from('diagrams')
      .select('id, title')
      .eq('id', diagramId)
      .eq('organization_id', ctx.orgId)
      .maybeSingle()
    if (dErr) return `Error reading the diagram: ${dErr.message}`
    if (!diagram) return "No such diagram in this organization's model. Call list_diagrams and use a real id."
    const diagRow = diagram as { id: string; title: string }

    const loaded = await loadDeliverable(ctx, str(args.id))
    if (typeof loaded === 'string') return loaded
    const { row, sections } = loaded
    const at = sectionAt(sections, args.section_index)
    if (typeof at === 'string') return at

    const block: SectionBlock = { kind: 'diagram_ref', diagramId, title: str(args.title) || diagRow.title }
    const next = sections.map((s, i) => (i === at.idx ? { ...s, blocks: [...(s.blocks ?? []), block] } : s))
    const err = await saveSections(ctx, row, next)
    if (err) return err
    return J({
      updated: 'deliverable',
      id: row.id,
      title: row.title,
      section: { index: at.idx, title: at.section.title },
      added_block: { kind: 'diagram_ref', diagram_id: diagramId, diagram_title: diagRow.title, link: `/diagram/${diagramId}` },
    })
  },
}

// ─── The belt ───────────────────────────────────────────────────────────────

export const DELIVERABLE_ENRICH_TOOLS: AgentTool[] = [
  LIST_DELIVERABLES,
  GET_DELIVERABLE,
  ADD_DELIVERABLE_SECTION,
  UPDATE_DELIVERABLE_SECTION,
  ADD_SECTION_TABLE,
  ADD_SECTION_VISUAL,
  ADD_SECTION_DIAGRAM_REF,
]
