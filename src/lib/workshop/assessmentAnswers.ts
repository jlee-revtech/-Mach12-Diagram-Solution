// Assessment Q&A answers: the facilitator's captured responses to an assessment
// section's assessment + discovery questions. Stored as APP-LEVEL fields on the
// assessment section's content JSON (agent-core does not model them), mirroring
// how the evaluation section carries its synthesized decision-criteria fields and
// how every section carries notesAndConsiderations. Kept as string[] aligned by
// index to `assessmentQuestions` / `discoveryQuestions`.
//
// These answers are read back into the AI Opportunity Roadmap synthesis (the
// section route feeds them to the roadmap generate as customer grounding), so the
// roadmap reflects what the room actually said, not just the drafted opportunities.

import type { SectionContent } from '@jlee-revtech/agent-core'

export interface AssessmentAnswers {
  assessmentAnswers: string[]
  discoveryAnswers: string[]
}

// Coerce any persisted value into a clean string[] (never throws on old rows).
function asStrArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (x == null ? '' : String(x)))
  return []
}

// Align an answers array to a question count: pad with '' and trim overflow so
// answers[i] always lines up with questions[i] even if the question set changed.
function alignTo(answers: string[], count: number): string[] {
  const out = answers.slice(0, count)
  while (out.length < count) out.push('')
  return out
}

// Read the answers off an assessment content row, aligned to its current question
// counts. Safe on any content (returns empty arrays for non-assessment kinds).
export function readAssessmentAnswers(content: SectionContent | null | undefined): AssessmentAnswers {
  const c = (content ?? {}) as unknown as Record<string, unknown>
  const aQ = asStrArray(c.assessmentQuestions)
  const dQ = asStrArray(c.discoveryQuestions)
  return {
    assessmentAnswers: alignTo(asStrArray(c.assessmentAnswers), aQ.length),
    discoveryAnswers: alignTo(asStrArray(c.discoveryAnswers), dQ.length),
  }
}

// Drop a trailing/all-empty array to undefined so we never persist empty noise.
function pruned(arr: string[]): string[] | undefined {
  return arr.some((s) => s.trim()) ? arr : undefined
}

// Write answers back onto the content as app-level fields (via cast, matching the
// established notesAndConsiderations / decisionCriteria pattern).
export function withAssessmentAnswers(content: SectionContent, patch: Partial<AssessmentAnswers>): SectionContent {
  const base = { ...(content as object) } as Record<string, unknown>
  if (patch.assessmentAnswers !== undefined) base.assessmentAnswers = pruned(patch.assessmentAnswers)
  if (patch.discoveryAnswers !== undefined) base.discoveryAnswers = pruned(patch.discoveryAnswers)
  return base as unknown as SectionContent
}

// True when at least one question has a non-empty answer.
export function hasAnyAnswers(content: SectionContent | null | undefined): boolean {
  const { assessmentAnswers, discoveryAnswers } = readAssessmentAnswers(content)
  return [...assessmentAnswers, ...discoveryAnswers].some((s) => s.trim())
}

// ─── Roadmap-synthesis context ───────────────────────────────────────────────
// Build a labeled Q&A block for ONE assessment section, pairing each answered
// question with its response. Only answered questions are included (unanswered
// ones add nothing to the synthesis). Returns null when nothing was answered.
export interface AssessmentQAEntry {
  workstreamName?: string
  content: SectionContent
}

function qaLines(questions: string[], answers: string[]): string[] {
  const lines: string[] = []
  questions.forEach((q, i) => {
    const a = (answers[i] || '').trim()
    if (a) lines.push(`Q: ${q}\nA: ${a}`)
  })
  return lines
}

export function assessmentQAContext(entry: AssessmentQAEntry): string | null {
  const c = entry.content as unknown as Record<string, unknown>
  const { assessmentAnswers, discoveryAnswers } = readAssessmentAnswers(entry.content)
  const aLines = qaLines(asStrArray(c.assessmentQuestions), assessmentAnswers)
  const dLines = qaLines(asStrArray(c.discoveryQuestions), discoveryAnswers)
  if (aLines.length === 0 && dLines.length === 0) return null
  const header = entry.workstreamName ? `Value stream: ${entry.workstreamName}` : 'Value stream'
  const parts: string[] = [header]
  if (aLines.length) parts.push(`Assessment answers:\n${aLines.join('\n')}`)
  if (dLines.length) parts.push(`Discovery answers:\n${dLines.join('\n')}`)
  return parts.join('\n')
}

// Build the combined answers-context blob threaded into the roadmap synthesis
// (appended to attachmentsContext). Caps total length so a very long capture can
// never blow the prompt budget.
export function buildRoadmapAnswersContext(entries: AssessmentQAEntry[], cap = 6000): string | null {
  const blocks = entries.map(assessmentQAContext).filter((b): b is string => !!b)
  if (blocks.length === 0) return null
  const intro =
    'Discovery answers captured in the room (the customer’s actual responses to the assessment and discovery questions). ' +
    'Weight these heavily when detecting dependencies, sequencing phases, and choosing quick wins; they reflect the real current state and pain, not just the drafted opportunities.'
  return `${intro}\n\n${blocks.join('\n\n')}`.slice(0, cap)
}
