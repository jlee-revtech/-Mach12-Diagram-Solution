// The Solution Architecture Evaluation section can synthesize a decision-criteria
// deliverable from the considerations, notes, decisions, and captures across all
// sections. These are app-level fields carried on the evaluation content JSON
// (agent-core does not model them), read/written by the route, view, editor, and
// deck. Considerations are prioritized when synthesizing.

export type CriterionPriority = 'high' | 'medium' | 'low'

export interface DecisionCriterion {
  criterion: string
  rationale?: string
  priority?: CriterionPriority
  /** short labels of the considerations / sections that informed this criterion */
  sources?: string[]
}

export interface SynthAction { title: string; owner?: string; due?: string }

export interface EvaluationSynthesis {
  recommendedDecision: string
  decisionCriteria: DecisionCriterion[]
  actions: SynthAction[]
  nextSteps: string[]
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

export function readSynthesis(content: unknown): EvaluationSynthesis {
  const c = (content ?? {}) as Record<string, unknown>
  return {
    recommendedDecision: typeof c.recommendedDecision === 'string' ? c.recommendedDecision : '',
    decisionCriteria: arr(c.decisionCriteria).map((d) => {
      const o = (d ?? {}) as Record<string, unknown>
      return {
        criterion: String(o.criterion ?? ''),
        ...(o.rationale ? { rationale: String(o.rationale) } : {}),
        ...(o.priority === 'high' || o.priority === 'medium' || o.priority === 'low' ? { priority: o.priority } : {}),
        ...(Array.isArray(o.sources) ? { sources: (o.sources as unknown[]).map(String) } : {}),
      } as DecisionCriterion
    }).filter((d) => d.criterion),
    actions: arr(c.actions).map((a) => {
      const o = (a ?? {}) as Record<string, unknown>
      return {
        title: String(o.title ?? ''),
        ...(o.owner ? { owner: String(o.owner) } : {}),
        ...(o.due ? { due: String(o.due) } : {}),
      } as SynthAction
    }).filter((a) => a.title),
    nextSteps: arr(c.nextSteps).map(String).filter(Boolean),
  }
}

export function hasSynthesis(content: unknown): boolean {
  const s = readSynthesis(content)
  return !!s.recommendedDecision || s.decisionCriteria.length + s.actions.length + s.nextSteps.length > 0
}

const ORDER: Record<CriterionPriority, number> = { high: 0, medium: 1, low: 2 }
export function sortByPriority(list: DecisionCriterion[]): DecisionCriterion[] {
  return [...list].sort((a, b) => ORDER[a.priority ?? 'medium'] - ORDER[b.priority ?? 'medium'])
}

export const PRIORITY_META: Record<CriterionPriority, { label: string; color: string }> = {
  high: { label: 'High', color: '#DC2626' },
  medium: { label: 'Medium', color: '#D97706' },
  low: { label: 'Low', color: '#64748B' },
}
