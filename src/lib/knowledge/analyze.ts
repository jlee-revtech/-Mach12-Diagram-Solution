// AI analysis for knowledge uploads. Sends the extracted document text (or the
// raw PDF when there is no text layer) to Claude and gets back a skill draft:
// a plain-language distillation plus code/title/description/workstream tags,
// ready for review and ingestion into the shared knowledge repository.

import Anthropic from '@anthropic-ai/sdk'
import { STANDARD_WORKSTREAMS } from '@/lib/workstream/catalog'

export interface SkillDraft {
  code: string
  title: string
  description: string
  docType: string
  workstreams: string[]
  skillMarkdown: string
}

const MODEL = process.env.KNOWLEDGE_ANALYSIS_MODEL || 'claude-sonnet-4-6'
const MAX_INPUT_CHARS = 180_000

const DRAFT_TOOL: Anthropic.Tool = {
  name: 'save_skill_draft',
  description: 'Save the distilled knowledge skill drafted from the uploaded document.',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Short kebab-case slug identifying this knowledge, e.g. acme-billing-rate-policy. Lowercase letters, digits, hyphens only.',
      },
      title: { type: 'string', description: 'Human-readable title for the knowledge source.' },
      description: { type: 'string', description: 'One-line summary of what this knowledge covers (used for source listings).' },
      doc_type: {
        type: 'string',
        description: 'What kind of document this is, in a few words, e.g. "design document", "rate policy", "statement of work", "training deck".',
      },
      workstreams: {
        type: 'array',
        items: { type: 'string' },
        description: 'The 1-3 workstream codes (from the provided catalog) this knowledge is most relevant to.',
      },
      skill_markdown: {
        type: 'string',
        description: 'The plain-language skill body in markdown. This is what the consultant agents will retrieve and read.',
      },
    },
    required: ['code', 'title', 'description', 'doc_type', 'workstreams', 'skill_markdown'],
  },
}

function systemPrompt(): string {
  const wsCatalog = STANDARD_WORKSTREAMS
    .map((w) => `- ${w.code}: ${w.name}`)
    .join('\n')
  return `You are a senior SAP S/4HANA consultant curating the shared knowledge base that powers the Mach12 workstream consultant agents (used by both the Solution Architecture Studio and SAP Solution Studio). A user uploaded a document. Distill it into a knowledge skill the agents can retrieve and apply.

Rules for the skill body (skill_markdown):
- Plain language. Write so a consultant who has never seen the document immediately understands it.
- Only facts that are actually in the document. Never fabricate, never pad. If something is ambiguous, say so.
- Preserve the specifics that matter: names, organizations, systems, numbers, rates, dates, table/field names, decisions, owners. Specifics are what make retrieval useful.
- Structure it with these markdown sections (omit a section only if the document truly has nothing for it):
  ## What this covers
  ## Key facts
  ## How to apply
  ## Gotchas and constraints
  ## Open questions
- "How to apply" means: how an SAP workstream consultant agent should use this knowledge when advising on design, configuration, or data decisions.
- Do not use em-dashes anywhere. Use commas, colons, or separate sentences.
- Do not include credentials, API keys, or connection secrets even if the document contains them; note their existence instead.

Workstream catalog (choose the 1-3 most relevant codes):
${wsCatalog}

When done, call save_skill_draft exactly once.`
}

export interface AnalyzeInput {
  filename: string
  text: string
  /** base64 of the original PDF; used when the text layer was empty (scanned) */
  pdfBase64?: string
}

export async function analyzeDocument(input: AnalyzeInput): Promise<{ draft: SkillDraft; truncated: boolean }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured; document analysis is unavailable.')
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const truncated = input.text.length > MAX_INPUT_CHARS
  const text = truncated ? input.text.slice(0, MAX_INPUT_CHARS) : input.text

  const content: Anthropic.ContentBlockParam[] = []
  if (input.pdfBase64) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: input.pdfBase64 },
    })
    content.push({
      type: 'text',
      text: `The uploaded document is the PDF above (filename: ${input.filename}). It had no extractable text layer, so read it directly. Distill it into a knowledge skill and call save_skill_draft.`,
    })
  } else {
    content.push({
      type: 'text',
      text: `Uploaded document: ${input.filename}${truncated ? ' (truncated to the first ~180k characters)' : ''}\n\n<document>\n${text}\n</document>\n\nDistill this document into a knowledge skill and call save_skill_draft.`,
    })
  }

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: systemPrompt(),
    tools: [DRAFT_TOOL],
    tool_choice: { type: 'tool', name: 'save_skill_draft' },
    messages: [{ role: 'user', content }],
  })

  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!toolUse) throw new Error('Analysis returned no skill draft.')
  const raw = toolUse.input as Record<string, unknown>

  const validCodes = new Set(STANDARD_WORKSTREAMS.map((w) => w.code))
  const workstreams = Array.isArray(raw.workstreams)
    ? (raw.workstreams as string[]).filter((c) => validCodes.has(c))
    : []

  const draft: SkillDraft = {
    code: slugify(String(raw.code || input.filename)),
    title: String(raw.title || input.filename).trim(),
    description: String(raw.description || '').trim(),
    docType: String(raw.doc_type || 'document').trim(),
    workstreams,
    skillMarkdown: String(raw.skill_markdown || '').trim(),
  }
  if (!draft.skillMarkdown) throw new Error('Analysis produced an empty skill body.')
  return { draft, truncated }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'uploaded-doc'
}
