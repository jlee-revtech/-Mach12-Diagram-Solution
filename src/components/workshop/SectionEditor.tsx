'use client'

// Section editor panel for the selected agenda card in the prep view. Generates
// facilitation content via POST /api/workshops/section, renders it per kind
// (overview / workstream / evaluation), surfaces clarifying questions (req 10),
// KB-gap callouts with the seeding recipe from PLAN §7 (req 3), and an NL-feedback
// box (req 9). It NEVER runs embeddings/imports; KB gaps only show the steps.

import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type {
  SectionContent, OverviewSectionContent, WorkstreamSectionContent,
  EvaluationSectionContent, KeyDecision, ClarifyingQuestion, KbGap,
  SectionGenerationResult, WorkshopDiagram,
} from '@jlee-revtech/agent-core'
import type { WorkshopAgendaItem } from '@/lib/workshop/types'
import type { Workstream } from '@/lib/workstream/types'
import type { AgendaContentRow } from '@/lib/supabase/workshops'
import { sectionMetaFor, CONFIDENCE_META } from './sectionMeta'
import { DiagramCard } from './DiagramView'

// The persisted section route also echoes version + status onto the result.
type SectionResult = SectionGenerationResult & { version?: number; status?: string }

// ─── Seeding steps (PLAN §7 KB seeding recipe, surfaced not executed) ────────
function seedingSteps(gap: KbGap): string[] {
  const id = gap.suggestedBundleId || '<bundle-id>'
  const ws = gap.workstreamCode || '<workstream-code>'
  return [
    `Add cds-lineage-explorer/public/vibe-skills/${id}/SKILL.md`,
    `Register ${id} in SSS knowledge.ts AGENT_SKILLS[${ws}]`,
    `Register ${id} in SAS catalog.ts knowledgeSourceCodes`,
    `Register ${id} in import-vibe-skills.mjs WORKSTREAMS[].skills`,
    `Run: node scripts/import-vibe-skills.mjs (from diagram-app/)`,
  ]
}

export default function SectionEditor({
  workshopId, orgId, item, workstream, content, onSaved,
}: {
  workshopId: string
  orgId: string
  item: WorkshopAgendaItem
  workstream?: Workstream | null
  content?: AgendaContentRow | null
  // Called with the fresh result after every generate/revise so the parent can
  // reload the content rows (updates the card status pill + evaluation gating).
  onSaved: (result: SectionResult) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Local view of the result. Seeded from the loaded row; overwritten on generate.
  const [local, setLocal] = useState<SectionResult | null>(
    content?.content
      ? {
          content: content.content,
          clarifyingQuestions: content.clarifying_questions ?? [],
          kbGaps: content.kb_gaps ?? [],
          groundingUsed: false,
          version: content.version,
          status: content.status,
        }
      : null,
  )
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')

  const meta = sectionMetaFor(item.section_kind)

  // Prefer freshly generated local state; else the loaded row.
  const view: SectionResult | null = local ?? (content?.content
    ? { content: content.content, clarifyingQuestions: content.clarifying_questions ?? [], kbGaps: content.kb_gaps ?? [], groundingUsed: false, version: content.version, status: content.status }
    : null)

  const call = async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/workshops/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId, orgId, agendaItemId: item.id, ...body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Section generation failed')
      const result = data as SectionResult
      setLocal(result)
      onSaved(result)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      return false
    } finally {
      setBusy(false)
    }
  }

  // Generate / enrich this section. The prompt box (feedback) drives BOTH the first
  // generate (an initial steer) and subsequent enrich/revise; clear it on success.
  const generate = async () => {
    const fb = feedback.trim()
    const ok = await call(fb ? { feedback: fb } : {})
    if (ok && fb) setFeedback('')
  }

  const regenerateWithAnswers = () => {
    const clarificationAnswers = (view?.clarifyingQuestions ?? [])
      .map((q) => ({ question: q.question, answer: (answers[q.id] || '').trim() }))
      .filter((a) => a.answer)
    if (clarificationAnswers.length === 0) { setError('Answer at least one question first.'); return }
    call({ clarificationAnswers })
  }

  return (
    <div className="space-y-4">
      {/* Header + generate action */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
            >
              <span>{meta.icon}</span>{meta.label}
            </span>
            {item.timebox_minutes ? <span className="text-[10px] text-[var(--m12-text-muted)]">{item.timebox_minutes}m</span> : null}
            {view?.version ? <span className="text-[9px] text-[var(--m12-text-muted)]">v{view.version}</span> : null}
          </div>
          <h3 className="text-sm font-semibold text-[var(--m12-text)] leading-snug">{item.title}</h3>
          {item.objective && <p className="text-[11px] text-[var(--m12-text-muted)] mt-0.5">{item.objective}</p>}
        </div>
        <button
          onClick={generate}
          disabled={busy}
          title={feedback.trim() ? 'Generate honoring your prompt below' : (view?.content ? 'Regenerate this section' : 'Generate this section')}
          className="shrink-0 bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
        >
          {busy ? 'Generating…' : view?.content ? 'Regenerate' : 'Generate content'}
        </button>
      </div>

      {item.section_kind === 'evaluation' && (
        <div className="text-[10px] text-[var(--m12-text-muted)] bg-[var(--m12-bg-card)] border border-[#7C3AED]/30 rounded-lg px-3 py-2">
          This section synthesizes across the workstream recommendations. Generate the workstream sections first, then generate this to reconcile where they diverge.
        </div>
      )}

      {error && <div className="text-[11px] text-[#EF4444] bg-[#DC262614] border border-[#DC2626]/30 rounded-lg px-3 py-2">{error}</div>}

      {/* Content by kind */}
      {view?.content ? (
        <ContentBody content={view.content} />
      ) : !busy ? (
        <div className="text-[11px] text-[var(--m12-text-muted)] bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-4 text-center">
          No content yet. Press <span className="text-[#3B82F6]">Generate content</span> to draft this section.
        </div>
      ) : null}

      {/* Clarifying questions (req 10) */}
      <AnimatePresence>
        {view && view.clarifyingQuestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-[var(--m12-bg-card)] border border-[#D97706]/40 rounded-lg p-3 space-y-2.5 overflow-hidden"
          >
            <div className="text-[10px] uppercase tracking-wide text-[#D97706]">Clarifying questions</div>
            {view.clarifyingQuestions.map((q: ClarifyingQuestion) => (
              <div key={q.id}>
                <div className="text-[11px] text-[var(--m12-text)] leading-snug">{q.question}</div>
                {q.why && <div className="text-[10px] text-[var(--m12-text-muted)] mb-1">{q.why}</div>}
                <input
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Your answer"
                  className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 focus:border-[#2563EB] rounded px-2 py-1 text-[11px] text-[var(--m12-text)] outline-none mt-1"
                />
              </div>
            ))}
            <button
              onClick={regenerateWithAnswers}
              disabled={busy}
              className="text-[10px] px-2.5 py-1 rounded bg-[#D97706] hover:bg-[#F59E0B] disabled:opacity-50 text-white font-medium"
            >
              {busy ? 'Regenerating…' : 'Regenerate with answers'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KB-gap callouts (req 3) */}
      {view && view.kbGaps.length > 0 && (
        <div className="space-y-2">
          {view.kbGaps.map((gap: KbGap, i: number) => (
            <KbGapCallout key={i} gap={gap} workstream={workstream} />
          ))}
        </div>
      )}

      {/* Prompt box (req 9): usable to GENERATE (first draft) and to enrich/revise.
          Available before content exists, so the first generation honors it too.
          The header Generate button and the button here both submit this prompt. */}
      <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-wide text-[var(--m12-text-muted)] mb-1.5">
          Prompt: generate or enrich this section, optional
        </div>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          placeholder={
            view?.content
              ? 'e.g. Make the recommended decision firmer and add a cost-plus vs fixed-price angle.'
              : 'e.g. Emphasize the make-vs-buy trade-off and keep talking points executive-level.'
          }
          className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 focus:border-[#2563EB] rounded-lg px-3 py-2 text-xs text-[var(--m12-text)] outline-none resize-none mb-2"
        />
        <button
          onClick={generate}
          disabled={busy || (!view?.content && !feedback.trim())}
          className="text-[11px] px-2.5 py-1 rounded border border-[#2563EB]/50 text-[#3B82F6] hover:bg-[#2563EB14] disabled:opacity-50"
        >
          {busy
            ? (view?.content ? 'Updating…' : 'Generating…')
            : view?.content
              ? (feedback.trim() ? 'Update section' : 'Regenerate section')
              : 'Generate with prompt'}
        </button>
        <div className="text-[9px] text-[var(--m12-text-muted)] mt-1.5 leading-snug">
          This section-level prompt is combined with the workshop-level guidance set in the Sections panel.
        </div>
      </div>
    </div>
  )
}

// ─── KB-gap callout ──────────────────────────────────────────────────────────
function KbGapCallout({ gap, workstream }: { gap: KbGap; workstream?: Workstream | null }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const steps = useMemo(() => seedingSteps(gap), [gap])
  const wsLabel = workstream?.name?.split('(')[0].trim() || gap.workstreamCode
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(steps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard may be unavailable; no-op */ }
  }
  return (
    <div className="bg-[#D9770614] border border-[#D97706]/40 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <span className="text-[#D97706] text-xs mt-0.5">⚑</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-[var(--m12-text)] font-medium">
            Knowledge base needs seeding: {gap.topic}{wsLabel ? ` for ${wsLabel}` : ''}
          </div>
          {gap.rationale && <div className="text-[10px] text-[var(--m12-text-muted)] mt-0.5">{gap.rationale}</div>}
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => setOpen((v) => !v)} className="text-[10px] text-[#D97706] hover:underline">
              {open ? 'Hide seeding steps' : 'Show seeding steps'}
            </button>
            <button onClick={copy} className="text-[10px] px-2 py-0.5 rounded border border-[#D97706]/50 text-[#D97706] hover:bg-[#D9770614]">
              {copied ? 'Copied' : 'Copy seeding steps'}
            </button>
          </div>
          <AnimatePresence>
            {open && (
              <motion.ol
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="text-[10px] text-[var(--m12-text-secondary)] list-decimal list-inside space-y-0.5 mt-2 overflow-hidden"
              >
                {steps.map((s, i) => <li key={i} className="leading-snug"><code className="text-[9.5px] text-[var(--m12-text)]">{s}</code></li>)}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ─── Content rendering by kind ───────────────────────────────────────────────
function ContentBody({ content }: { content: SectionContent }) {
  if (content.kind === 'overview') return <OverviewBody c={content} />
  if (content.kind === 'workstream') return <WorkstreamBody c={content} />
  return <EvaluationBody c={content} />
}

// Section-level diagrams (content.diagrams), rendered below the per-kind body via
// the shared DiagramCard (same SVG the walkthrough + PPTX use). The editor column
// is fairly narrow, so we render at a slightly smaller intrinsic width.
function SectionDiagrams({ diagrams }: { diagrams?: WorkshopDiagram[] }) {
  if (!diagrams || diagrams.length === 0) return null
  return (
    <div className="space-y-3">
      {diagrams.map((d, i) => <DiagramCard key={i} diagram={d} width={560} />)}
    </div>
  )
}

function Block({ title, color, children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: color || 'var(--m12-text-muted)' }}>{title}</div>
      {children}
    </div>
  )
}

function Bullets({ items, marker, color }: { items: string[]; marker?: string; color?: string }) {
  return (
    <ul className="space-y-1">
      {items.map((t, i) => (
        <li key={i} className="text-[11px] text-[var(--m12-text-secondary)] flex gap-2 leading-snug">
          <span style={{ color: color || '#2563EB' }}>{marker || '•'}</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-[9px] uppercase tracking-wide text-[#059669] mb-1">Pros</div>
        {pros.length ? <Bullets items={pros} marker="+" color="#059669" /> : <div className="text-[10px] text-[var(--m12-text-muted)]">None</div>}
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-wide text-[#DC2626] mb-1">Cons</div>
        {cons.length ? <Bullets items={cons} marker="−" color="#DC2626" /> : <div className="text-[10px] text-[var(--m12-text-muted)]">None</div>}
      </div>
    </div>
  )
}

function OverviewBody({ c }: { c: OverviewSectionContent }) {
  return (
    <div className="space-y-3">
      <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-4 space-y-3">
        <div className="text-sm font-semibold text-[#0891B2]">{c.headline}</div>
        <Block title="Talking points"><Bullets items={c.talkingPoints} color="#0891B2" /></Block>
        {c.facilitatorNotes && (
          <div className="pt-2 border-t border-[var(--m12-border)]/40">
            <Block title="Facilitator notes">
              <p className="text-[11px] text-[var(--m12-text-secondary)] leading-relaxed whitespace-pre-wrap">{c.facilitatorNotes}</p>
            </Block>
          </div>
        )}
      </div>
      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}

function WorkstreamBody({ c }: { c: WorkstreamSectionContent }) {
  return (
    <div className="space-y-3">
      <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-4">
        <Block title="Focused context" color="#2563EB">
          <p className="text-[12px] text-[var(--m12-text-secondary)] leading-relaxed whitespace-pre-wrap">{c.focusedContext}</p>
        </Block>
      </div>
      {c.keyDecisions.map((d) => <DecisionCard key={d.id} d={d} />)}
      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}

function DecisionCard({ d }: { d: KeyDecision }) {
  const conf = d.recommendedDecision.confidence
  const confMeta = conf ? CONFIDENCE_META[conf] : null
  return (
    <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-4 space-y-3">
      <div>
        <div className="text-[12px] font-semibold text-[var(--m12-text)]">{d.title}</div>
        <p className="text-[11px] text-[var(--m12-text-muted)] leading-relaxed mt-0.5">{d.context}</p>
      </div>

      {d.options && d.options.length > 0 && (
        <div className="space-y-2.5">
          {d.options.map((o, i) => (
            <div key={i} className="border border-[var(--m12-border)]/40 rounded-lg p-2.5">
              <div className="text-[11px] font-medium text-[var(--m12-text)] mb-1.5">{o.label}</div>
              <ProsCons pros={o.pros} cons={o.cons} />
            </div>
          ))}
        </div>
      )}

      {d.factors && d.factors.length > 0 && (
        <Block title="Factors to weigh" color="#7C3AED"><Bullets items={d.factors} marker="▸" color="#7C3AED" /></Block>
      )}

      {d.leadingQuestions.length > 0 && (
        <Block title="Leading questions" color="#D97706"><Bullets items={d.leadingQuestions} marker="?" color="#D97706" /></Block>
      )}

      <div className="rounded-lg border border-[#2563EB]/40 bg-[#2563EB0F] p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-wide text-[#3B82F6]">Recommended decision</span>
          {confMeta && (
            <span className="text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ml-auto" style={{ backgroundColor: `${confMeta.color}1A`, color: confMeta.color }}>
              {confMeta.label}
            </span>
          )}
        </div>
        <div className="text-[12px] text-[var(--m12-text)] font-medium leading-snug">{d.recommendedDecision.recommendation}</div>
        <p className="text-[11px] text-[var(--m12-text-secondary)] leading-relaxed mt-1">{d.recommendedDecision.rationale}</p>
      </div>

      {d.diagram && <DiagramCard diagram={d.diagram} width={520} />}
    </div>
  )
}

function EvaluationBody({ c }: { c: EvaluationSectionContent }) {
  return (
    <div className="space-y-3">
      {c.divergences.length > 0 && (
        <div className="space-y-2">
          {c.divergences.map((dv, i) => (
            <div key={i} className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-3">
              <div className="text-[12px] font-semibold text-[var(--m12-text)] mb-1.5">{dv.topic}</div>
              <div className="space-y-1 mb-2">
                {dv.positions.map((p, j) => (
                  <div key={j} className="flex gap-2 text-[11px]">
                    <span className="text-[#7C3AED] font-medium shrink-0">{p.workstreamCode}</span>
                    <span className="text-[var(--m12-text-secondary)] leading-snug">{p.stance}</span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-[#D97706] leading-snug pt-1.5 border-t border-[var(--m12-border)]/40">
                <span className="uppercase tracking-wide">Tension:</span> {dv.tension}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-[#7C3AED]/40 bg-[#7C3AED0F] p-4 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#7C3AED] mb-1">Overall recommendation</div>
          <div className="text-[12px] text-[var(--m12-text)] font-medium leading-snug">{c.overallRecommendation}</div>
        </div>
        <ProsCons pros={c.pros} cons={c.cons} />
        {c.tradeoffs && c.tradeoffs.length > 0 && (
          <Block title="Tradeoffs" color="#D97706"><Bullets items={c.tradeoffs} marker="⇄" color="#D97706" /></Block>
        )}
        <div className="pt-2 border-t border-[var(--m12-border)]/40">
          <Block title="Rationale">
            <p className="text-[11px] text-[var(--m12-text-secondary)] leading-relaxed whitespace-pre-wrap">{c.rationale}</p>
          </Block>
        </div>
      </div>
      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}
