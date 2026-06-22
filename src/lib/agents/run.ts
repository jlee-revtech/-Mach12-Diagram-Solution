import Anthropic from '@anthropic-ai/sdk'
import type { AgentDef, Recommendation, Pillar } from './types'
import { anthropicToolSchemas, toolsFor, type AgentTool, type ToolCtx } from './tools'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const PILLARS: Pillar[] = ['People', 'Process', 'Data', 'Technology']

const RECO_INSTRUCTIONS = `When you have concrete recommendations, end your reply with a single fenced block exactly like this (and nothing after it):
\`\`\`recommendations
[{"pillar":"Process","title":"short title","detail":"what to do","rationale":"why"}]
\`\`\`
Each item's "pillar" must be one of People, Process, Data, Technology. Keep your prose answer above the block. Omit the block entirely when you have no recommendations.`

export function buildSystemPrompt(
  agent: AgentDef,
  opts: { pageContext?: string; prefetched?: string }
): string {
  const parts: string[] = []
  parts.push(agent.system_persona || `You are a world-class SAP S/4HANA and Dassian A&D functional consultant for the ${agent.display_name} value stream.`)
  parts.push(`You have read-only tools to inspect the customer's live model (processes, personas, data, systems, integrations) and to search the shared SAP/Dassian knowledge base. Call them before answering so your guidance reflects the customer's actual architecture, not generic best practice. Cite the knowledge sources you used.`)
  if (opts.prefetched) parts.push(`Relevant baseline knowledge for this question (you may search for more):\n${opts.prefetched}`)
  if (opts.pageContext) parts.push(`The user is currently viewing:\n${opts.pageContext}`)
  parts.push(RECO_INSTRUCTIONS)
  return parts.join('\n\n')
}

// Parse and strip the trailing ```recommendations block.
export function extractRecommendations(text: string): { text: string; recommendations: Recommendation[] } {
  const m = text.match(/```recommendations\s*([\s\S]*?)```\s*$/)
  if (!m) return { text: text.trim(), recommendations: [] }
  let recs: Recommendation[] = []
  try {
    const parsed = JSON.parse(m[1].trim())
    if (Array.isArray(parsed)) {
      recs = parsed
        .filter((r) => r && PILLARS.includes(r.pillar))
        .map((r) => ({ pillar: r.pillar, title: String(r.title || ''), detail: String(r.detail || ''), rationale: r.rationale ? String(r.rationale) : undefined }))
    }
  } catch { /* leave recs empty */ }
  return { text: text.slice(0, m.index).trim(), recommendations: recs }
}

interface RunOpts {
  maxIters?: number
  maxTokens?: number
  onTool?: (name: string, args: Record<string, unknown>) => void
}

// Agentic tool loop. Non-streaming per turn for robustness; the caller streams
// status + final text over SSE. Returns the final assistant text.
export async function runAgentLoop(
  agent: AgentDef,
  history: { role: 'user' | 'assistant'; content: unknown }[],
  ctx: ToolCtx,
  opts: RunOpts = {}
): Promise<string> {
  const tools = toolsFor(agent)
  const toolMap = new Map<string, AgentTool>(tools.map((t) => [t.name, t]))
  const schemas = anthropicToolSchemas(tools)
  const maxIters = opts.maxIters ?? 6
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = history.map((m) => ({ role: m.role, content: m.content }))

  for (let i = 0; i < maxIters; i++) {
    const resp = await anthropic.messages.create({
      model: agent.model || 'claude-sonnet-4-6',
      max_tokens: opts.maxTokens ?? 2600,
      temperature: agent.temperature ?? 0.4,
      system: ctx._systemPrompt,
      tools: schemas as unknown as Anthropic.Tool[],
      messages,
    })

    messages.push({ role: 'assistant', content: resp.content })

    const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (resp.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return resp.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('\n').trim()
    }

    const results = []
    for (const tu of toolUses) {
      const tool = toolMap.get(tu.name)
      opts.onTool?.(tu.name, tu.input as Record<string, unknown>)
      let out: string
      try {
        out = tool ? await tool.execute(tu.input as Record<string, unknown>, ctx) : `Unknown tool: ${tu.name}`
      } catch (e) {
        out = `Tool error: ${e instanceof Error ? e.message : 'failed'}`
      }
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: out.slice(0, 12000) })
    }
    messages.push({ role: 'user', content: results })
  }

  // Hit the iteration cap — ask for a final synthesis with no tools.
  const final = await anthropic.messages.create({
    model: agent.model || 'claude-sonnet-4-6',
    max_tokens: opts.maxTokens ?? 2600,
    temperature: agent.temperature ?? 0.4,
    system: ctx._systemPrompt,
    messages: [...messages, { role: 'user', content: 'Provide your best final answer now using what you have gathered.' }],
  })
  return final.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('\n').trim()
}
