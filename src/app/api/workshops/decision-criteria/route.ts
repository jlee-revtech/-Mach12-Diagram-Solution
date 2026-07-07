import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { serverModelDb } from '@/lib/workshop/server'

// Synthesize a DECISION CRITERIA deliverable for the Solution Architecture
// Evaluation section. Reads the Considerations (overall considerations +
// "Notes & Considerations") across every section, PRIORITIZING them, plus the
// decisions, options, evaluation recommendation, and captured actions, then
// synthesizes: prioritized decision criteria, consolidated actions, and next
// steps. The result is merged onto the evaluation section's content JSON.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
const MODEL = process.env.WORKSHOP_MODEL || 'claude-sonnet-4-6'

const STR = { type: 'string' } as const
const STR_ARR = { type: 'array', items: STR } as const

type Row = Record<string, unknown>
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const asBullets = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : [])

const TOOL = {
  name: 'decision_criteria',
  description: 'Return the synthesized decision-criteria deliverable: prioritized criteria, consolidated actions, and next steps.',
  input_schema: {
    type: 'object',
    properties: {
      decisionCriteria: {
        type: 'array',
        description: 'The criteria the architecture decision should be evaluated against, PRIORITIZED. Derive them primarily from the Considerations, reinforced by the decisions and captured items.',
        items: {
          type: 'object',
          properties: {
            criterion: { type: 'string', description: 'The criterion, a few words.' },
            rationale: { type: 'string', description: 'One short sentence: why it matters and how to weigh it.' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            sources: { type: 'array', items: STR, description: 'Short labels of the considerations / sections that informed this criterion.' },
          },
          required: ['criterion', 'priority'],
        },
      },
      actions: {
        type: 'array',
        description: 'Consolidated actions across the sections and captures. Owner/due only if stated.',
        items: { type: 'object', properties: { title: STR, owner: STR, due: STR }, required: ['title'] },
      },
      nextSteps: { type: 'array', items: STR, description: 'Concrete, sequenced next steps.' },
    },
    required: ['decisionCriteria', 'actions', 'nextSteps'],
  },
} as const

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
    const { workshopId, orgId, agendaItemId } = (await req.json()) as { workshopId?: string; orgId?: string; agendaItemId?: string }
    if (!orgId || !workshopId || !agendaItemId) return json({ error: 'orgId, workshopId, and agendaItemId are required' }, 400)
    if (!ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)

    const db = serverModelDb()
    const { data: ws } = await db.from('workshops').select('id, title, topic, customer_name').eq('id', workshopId).eq('organization_id', orgId).maybeSingle()
    if (!ws) return json({ error: 'Workshop not found for this organization' }, 404)

    const [{ data: items }, { data: contentRows }, { data: captures }] = await Promise.all([
      db.from('workshop_agenda_items').select('id, title, section_kind, workstream_code, sort_order').eq('workshop_id', workshopId).order('sort_order', { ascending: true }),
      db.from('workshop_agenda_content').select('agenda_item_id, section_kind, content, version').eq('workshop_id', workshopId),
      db.from('workshop_captures').select('capture_type, title, detail, owner, due_date, status').eq('workshop_id', workshopId),
    ])
    const titleById = new Map<string, string>((items || []).map((i: Row) => [i.id as string, (i.title as string) || 'Section']))
    const contentByItem = new Map<string, Row>((contentRows || []).map((r: Row) => [r.agenda_item_id as string, r]))

    const evalRow = contentByItem.get(agendaItemId)
    if (!evalRow?.content) return json({ error: 'Generate the Solution Architecture Evaluation section first, then synthesize.' }, 422)

    // ─── Assemble the synthesis context (considerations first) ───
    const considerations: string[] = []
    const decisions: string[] = []
    const options: string[] = []

    for (const r of (contentRows || []) as Row[]) {
      const c = (r.content ?? {}) as Row
      const label = titleById.get(r.agenda_item_id as string) || 'Section'
      // Notes & Considerations (every kind) are prioritized considerations.
      for (const n of asBullets(c.notesAndConsiderations)) considerations.push(`[${label}] ${n}`)
      if (c.kind === 'workstream') {
        for (const x of asBullets(c.overallConsiderations)) considerations.push(`[${label}] ${x}`)
        for (const d of arr(c.keyDecisions)) {
          const dd = (d ?? {}) as Row
          const rec = (dd.recommendedDecision ?? {}) as Row
          decisions.push(`[${label}] ${dd.title}: ${rec.recommendation ?? ''}${asBullets(rec.rationale).length ? ` (${asBullets(rec.rationale).join('; ')})` : ''}`)
        }
        for (const o of arr(c.futureStateOptions)) {
          const oo = (o ?? {}) as Row
          options.push(`[${label}] ${oo.label}: pros ${asBullets(oo.pros).join(', ') || 'none'}; cons ${asBullets(oo.cons).join(', ') || 'none'}`)
        }
      } else if (c.kind === 'evaluation') {
        if (c.overallRecommendation) decisions.push(`[Evaluation] Overall: ${c.overallRecommendation}`)
        const pc = `pros ${asBullets(c.pros).join(', ') || 'none'}; cons ${asBullets(c.cons).join(', ') || 'none'}${asBullets(c.tradeoffs).length ? `; tradeoffs ${asBullets(c.tradeoffs).join(', ')}` : ''}`
        if (asBullets(c.pros).length || asBullets(c.cons).length) decisions.push(`[Evaluation] ${pc}`)
      }
    }

    const capLines = (captures || []).map((cp: Row) => `[${cp.capture_type}${cp.status ? `/${cp.status}` : ''}] ${cp.title}${cp.owner ? ` (owner: ${cp.owner})` : ''}${cp.due_date ? ` (due: ${cp.due_date})` : ''}${cp.detail ? `: ${cp.detail}` : ''}`)

    const context = `Workshop: ${ws.title}${ws.customer_name ? ` for ${ws.customer_name}` : ''}${ws.topic ? `\nTopic: ${ws.topic}` : ''}

CONSIDERATIONS (prioritize these when forming the criteria):
${considerations.length ? considerations.map((x) => `- ${x}`).join('\n') : '- (none documented)'}

DECISIONS AND RECOMMENDATIONS:
${decisions.length ? decisions.map((x) => `- ${x}`).join('\n') : '- (none)'}

FUTURE-STATE OPTIONS (pros/cons):
${options.length ? options.map((x) => `- ${x}`).join('\n') : '- (none)'}

CAPTURED ITEMS (actions, decisions, risks, next steps):
${capLines.length ? capLines.map((x) => `- ${x}`).join('\n') : '- (none captured)'}`

    const system = `You are a world-class SAP S/4HANA + Dassian Aerospace & Defense enterprise architect closing out a Solution Architecture Evaluation. Synthesize a crisp, decision-ready DECISION CRITERIA deliverable. Weight the Considerations most heavily: the criteria must reflect and prioritize them, reinforced by the decisions, options, and captured items. Then consolidate the Actions and the Next Steps. Be specific and A&D-aware. Keep every item short. Never use em-dashes or en-dashes; use commas, colons, parentheses, or periods.`
    const user = `${context}

Produce the decision criteria (prioritized high/medium/low, each with a short rationale and the considerations that informed it), the consolidated actions, and the sequenced next steps.`

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2600,
      temperature: 0.3,
      system,
      tools: [{ name: TOOL.name, description: TOOL.description, input_schema: TOOL.input_schema as unknown as Anthropic.Tool['input_schema'] }],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{ role: 'user', content: user }],
    })
    const block = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (!block?.input) return json({ error: 'The model did not return a synthesis. Try again.' }, 502)
    const synth = stripDashes(block.input as { decisionCriteria?: unknown[]; actions?: unknown[]; nextSteps?: unknown[] })

    // ─── Merge onto the evaluation content + persist (bump version) ───
    const merged = {
      ...(evalRow.content as Row),
      decisionCriteria: synth.decisionCriteria ?? [],
      actions: synth.actions ?? [],
      nextSteps: synth.nextSteps ?? [],
    }
    const priorVersion = (evalRow.version as number) ?? 1
    const { data: updated, error: upErr } = await db
      .from('workshop_agenda_content')
      .update({ content: merged, version: priorVersion + 1, status: 'final', updated_at: new Date().toISOString() })
      .eq('agenda_item_id', agendaItemId)
      .select('version, status')
      .maybeSingle<{ version: number; status: string }>()
    if (upErr) return json({ error: upErr.message }, 500)

    return json({ content: merged, version: updated?.version ?? priorVersion + 1, status: updated?.status ?? 'final' }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
