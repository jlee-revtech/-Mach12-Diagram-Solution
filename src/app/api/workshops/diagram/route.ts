import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { WorkshopDiagram, WorkshopDiagramType } from '@jlee-revtech/agent-core'
import { serverModelDb } from '@/lib/workshop/server'

// Generate (or revise) ONE structured WorkshopDiagram from a natural-language
// prompt, for the diagram editor's "Generate with AI" box. It returns the same
// typed diagram the section generator emits, so the app renders it with the same
// SVG everywhere (editor preview, walkthrough, PPTX). Server-side so the
// ANTHROPIC key never reaches the browser; org-scoped like the section route.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
// Match agent-core's DEFAULT_AGENT_MODEL so diagrams read like section content.
const MODEL = process.env.WORKSHOP_MODEL || 'claude-sonnet-4-6'

const STR = { type: 'string' } as const
const STR_ARR = { type: 'array', items: STR } as const

// Mirrors agent-core's DIAGRAM_SCHEMA: type is required; fill only the fields for
// that type. flow -> steps; matrix -> columns + rows; quadrant -> xAxis + yAxis +
// points (0..1); layers -> layers + optional connections.
const DIAGRAM_SCHEMA = {
  type: 'object',
  description: 'A structured diagram. Set type, then fill ONLY the fields for that diagram type. Leave the other fields out.',
  properties: {
    type: { type: 'string', enum: ['flow', 'matrix', 'quadrant', 'layers'] },
    title: STR,
    caption: { type: 'string', description: 'One short line explaining what the diagram shows.' },
    steps: {
      type: 'array',
      description: 'flow only: the ordered steps, connected by elbow arrows.',
      items: { type: 'object', properties: { label: STR, sublabel: STR }, required: ['label'] },
    },
    columns: { type: 'array', items: STR, description: 'matrix only: the column headers.' },
    rows: {
      type: 'array',
      description: 'matrix only: each row is a label plus one cell per column.',
      items: { type: 'object', properties: { label: STR, cells: STR_ARR }, required: ['label', 'cells'] },
    },
    xAxis: { type: 'object', description: 'quadrant only: horizontal axis low and high labels.', properties: { low: STR, high: STR }, required: ['low', 'high'] },
    yAxis: { type: 'object', description: 'quadrant only: vertical axis low and high labels.', properties: { low: STR, high: STR }, required: ['low', 'high'] },
    points: {
      type: 'array',
      description: 'quadrant only: items positioned in the space; x and y are numbers between 0 and 1.',
      items: {
        type: 'object',
        properties: {
          label: STR,
          x: { type: 'number', description: 'Horizontal position, 0 (low) to 1 (high).' },
          y: { type: 'number', description: 'Vertical position, 0 (low) to 1 (high).' },
        },
        required: ['label', 'x', 'y'],
      },
    },
    layers: {
      type: 'array',
      description: 'layers only: horizontal bands, each a label plus its node labels.',
      items: { type: 'object', properties: { label: STR, nodes: STR_ARR }, required: ['label', 'nodes'] },
    },
    connections: {
      type: 'array',
      description: 'layers only: elbow connectors between nodes, referenced by node label.',
      items: { type: 'object', properties: { from: STR, to: STR, label: STR }, required: ['from', 'to'] },
    },
  },
  required: ['type'],
} as const

// House rule: no em/en dashes. Deterministic backstop over every returned string.
function stripDashesFromString(s: string): string {
  return s.replace(/\s*[—–]\s+/g, ', ').replace(/\s+[—–]\s*/g, ', ').replace(/(?<=\S)[—–](?=\S)/g, '-')
}
function stripDashes<T>(v: T): T {
  if (typeof v === 'string') return stripDashesFromString(v) as unknown as T
  if (Array.isArray(v)) return v.map((el) => stripDashes(el)) as unknown as T
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = stripDashes(val)
    return out as unknown as T
  }
  return v
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      workshopId,
      orgId,
      prompt,
      current,
      context,
      preferType,
    }: {
      workshopId?: string
      orgId?: string
      prompt?: string
      current?: WorkshopDiagram
      context?: string
      preferType?: WorkshopDiagramType
    } = body

    if (!prompt || !prompt.trim()) return json({ error: 'A prompt is required' }, 400)
    if (!ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)

    // Org-scope the request when a workshop is supplied (mirrors the section route);
    // the diagram is not persisted here, but this keeps the key gated to a member.
    if (workshopId && orgId) {
      const db = serverModelDb()
      const { data: ws } = await db
        .from('workshops')
        .select('id')
        .eq('id', workshopId)
        .eq('organization_id', orgId)
        .maybeSingle()
      if (!ws) return json({ error: 'Workshop not found for this organization' }, 404)
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })

    const system = `You are a world-class enterprise architect producing ONE clean diagram for an SAP S/4HANA + Dassian Aerospace & Defense workshop slide. Pick the diagram type that best fits the request: flow for a process or decision sequence, matrix for an option-vs-criteria comparison, quadrant for trade-off positioning or where things diverge, layers for a systems/integration architecture. Keep every label short and scannable (a few words). Fill ONLY the fields for the chosen type. Never use em-dashes or en-dashes; use commas, colons, parentheses, or periods instead.`

    const parts: string[] = []
    if (context) parts.push(`Context: ${context}`)
    if (preferType) parts.push(`Preferred diagram type: ${preferType} (use it unless a different type clearly fits better).`)
    if (current) parts.push(`Revise this existing diagram, keeping what still fits and applying the request:\n${JSON.stringify(current)}`)
    parts.push(`Request: ${prompt.trim()}`)
    parts.push('Produce exactly one diagram. Set type, then fill only the fields for that type.')

    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1600,
      temperature: 0.3,
      system,
      tools: [{ name: 'workshop_diagram', description: 'Return one structured workshop diagram matching the request.', input_schema: DIAGRAM_SCHEMA as unknown as Anthropic.Tool['input_schema'] }],
      tool_choice: { type: 'tool', name: 'workshop_diagram' },
      messages: [{ role: 'user', content: parts.join('\n\n') }],
    })

    const block = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    const diagram = block?.input as WorkshopDiagram | undefined
    if (!diagram || !diagram.type) return json({ error: 'The model did not return a diagram. Try rephrasing the prompt.' }, 502)

    return json({ diagram: stripDashes(diagram) }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
