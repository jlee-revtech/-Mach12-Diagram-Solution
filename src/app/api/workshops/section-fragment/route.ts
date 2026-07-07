import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { serverModelDb } from '@/lib/workshop/server'

// Generate a single TEXT fragment for a workshop section from a natural-language
// prompt: a set of bullets (summary / current state / considerations / rationale /
// pros / cons), a future-state option (with pros/cons), a full key decision (with
// its visual), an overview (headline + talking points), or an evaluation summary.
// Used by the section editor's inline "Generate with AI" boxes, in BOTH the prep
// view and the Workshop Experience. Server-side so the key never reaches the
// browser; org-scoped like the section route.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
const MODEL = process.env.WORKSHOP_MODEL || 'claude-sonnet-4-6'

type Target = 'bullets' | 'option' | 'decision' | 'overview' | 'evaluation'

const STR = { type: 'string' } as const
const STR_ARR = { type: 'array', items: STR } as const

// Compact diagram schema (mirrors agent-core) so a generated decision carries a visual.
const DIAGRAM_SCHEMA = {
  type: 'object',
  description: 'A structured diagram. Set type, then fill ONLY the fields for that type.',
  properties: {
    type: { type: 'string', enum: ['flow', 'matrix', 'quadrant', 'layers'] },
    title: STR,
    caption: STR,
    steps: { type: 'array', items: { type: 'object', properties: { label: STR, sublabel: STR }, required: ['label'] } },
    columns: { type: 'array', items: STR },
    rows: { type: 'array', items: { type: 'object', properties: { label: STR, cells: STR_ARR }, required: ['label', 'cells'] } },
    xAxis: { type: 'object', properties: { low: STR, high: STR }, required: ['low', 'high'] },
    yAxis: { type: 'object', properties: { low: STR, high: STR }, required: ['low', 'high'] },
    points: { type: 'array', items: { type: 'object', properties: { label: STR, x: { type: 'number' }, y: { type: 'number' } }, required: ['label', 'x', 'y'] } },
    layers: { type: 'array', items: { type: 'object', properties: { label: STR, nodes: STR_ARR }, required: ['label', 'nodes'] } },
    connections: { type: 'array', items: { type: 'object', properties: { from: STR, to: STR, label: STR }, required: ['from', 'to'] } },
  },
  required: ['type'],
} as const

const TOOLS: Record<Target, { name: string; description: string; input_schema: Record<string, unknown> }> = {
  bullets: {
    name: 'bullets',
    description: 'Return short scannable bullet points for the requested list (one idea each, under about 18 words).',
    input_schema: { type: 'object', properties: { bullets: { type: 'array', items: STR, description: '2 to 6 crisp bullets.' } }, required: ['bullets'] },
  },
  option: {
    name: 'future_state_option',
    description: 'Return one future-state option with pros and cons. Honor any specific pros/cons the request asks to call out.',
    input_schema: {
      type: 'object',
      properties: {
        label: STR,
        summary: { type: 'string', description: 'One short sentence describing the option.' },
        pros: STR_ARR,
        cons: STR_ARR,
      },
      required: ['label', 'pros', 'cons'],
    },
  },
  decision: {
    name: 'key_decision',
    description: 'Return one key decision framed around the topic: context, leading questions, a recommended decision with rationale, and a visual. Weave any pros/cons the request asks to call out into the rationale (pros) and leading questions / context (cons/risks).',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'kebab-case slug, e.g. co-mingle-vs-separate-cc.' },
        title: STR,
        context: { type: 'array', items: STR, description: 'Bullets: why this decision matters.' },
        leadingQuestions: { type: 'array', items: STR, description: 'Questions that walk the room to the recommendation.' },
        recommendedDecision: {
          type: 'object',
          properties: {
            recommendation: { type: 'string', description: 'One short sentence.' },
            rationale: { type: 'array', items: STR, description: 'Bullets: the reasoning (fold in the pros to call out).' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
          required: ['recommendation', 'rationale'],
        },
        diagram: DIAGRAM_SCHEMA,
      },
      required: ['id', 'title', 'context', 'leadingQuestions', 'recommendedDecision', 'diagram'],
    },
  },
  overview: {
    name: 'overview',
    description: 'Return an overview: a headline plus 3 to 6 talking points personalized to the customer and topic.',
    input_schema: {
      type: 'object',
      properties: { headline: STR, talkingPoints: { type: 'array', items: STR, description: '3 to 6 crisp talking points.' } },
      required: ['talkingPoints'],
    },
  },
  evaluation: {
    name: 'evaluation_summary',
    description: 'Return an evaluation summary: an overall recommendation with pros, cons, tradeoffs, and rationale. Honor any pros/cons the request asks to call out.',
    input_schema: {
      type: 'object',
      properties: {
        overallRecommendation: { type: 'string', description: 'One short sentence.' },
        pros: STR_ARR,
        cons: STR_ARR,
        tradeoffs: STR_ARR,
        rationale: STR_ARR,
      },
      required: ['overallRecommendation', 'pros', 'cons', 'rationale'],
    },
  },
}

// House rule: no em/en dashes.
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
    const { workshopId, orgId, target, prompt, context } = body as {
      workshopId?: string
      orgId?: string
      target?: Target
      prompt?: string
      context?: string
    }

    if (!target || !TOOLS[target]) return json({ error: 'A valid target is required' }, 400)
    if (!prompt || !prompt.trim()) return json({ error: 'A prompt is required' }, 400)
    if (!ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)

    if (workshopId && orgId) {
      const db = serverModelDb()
      const { data: ws } = await db.from('workshops').select('id').eq('id', workshopId).eq('organization_id', orgId).maybeSingle()
      if (!ws) return json({ error: 'Workshop not found for this organization' }, 404)
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })
    const tool = TOOLS[target]
    const system = `You are a world-class SAP S/4HANA + Dassian Aerospace & Defense engagement lead authoring facilitation content for one section of a client workshop. You are A&D-aware (FAR/DFARS/CAS/DCAA/EVMS/ITAR where genuinely relevant). Be specific, decision-oriented, and concise: short bullets, one idea each, under about 18 words; any prose is 1 to 2 short sentences. When the request names specific pros or cons to call out, include them verbatim in meaning and add the obvious complements. Never use em-dashes or en-dashes; use commas, colons, parentheses, or periods.`

    const user = `${context ? `Context: ${context}\n\n` : ''}Request: ${prompt.trim()}\n\nProduce the ${target === 'bullets' ? 'bullet points' : target.replace('_', ' ')} for this request.`

    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1800,
      temperature: 0.3,
      system,
      tools: [{ name: tool.name, description: tool.description, input_schema: tool.input_schema as unknown as Anthropic.Tool['input_schema'] }],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: user }],
    })
    const block = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (!block?.input) return json({ error: 'The model did not return content. Try rephrasing the prompt.' }, 502)

    return json({ fragment: stripDashes(block.input) }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
