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
  SectionGenerationResult, WorkshopDiagram, SectionKind,
} from '@jlee-revtech/agent-core'
import type { WorkshopAgendaItem } from '@/lib/workshop/types'
import type { Workstream } from '@/lib/workstream/types'
import { upsertAgendaContent, type AgendaContentRow } from '@/lib/supabase/workshops'
import { normalizeSectionContent } from '@/lib/workshop/deck'
import { sectionMetaFor, CONFIDENCE_META } from './sectionMeta'
import { DiagramCard } from './DiagramView'
import SectionContentEditor, { type GenerateDiagramFn, type GenerateContentFn } from './SectionContentEditor'

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
  // Direct manual-edit mode: a working draft of the structured content the user
  // hand-edits, saved back to the SAME content row the AI writes.
  const [draft, setDraft] = useState<SectionContent | null>(null)
  const [saving, setSaving] = useState(false)

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

  // ─── Manual edit (no AI): open a draft, save it straight to the content row ──
  const startEditing = () => {
    if (!view?.content) return
    setError(null)
    // Normalize so the structured editor always gets arrays (old rows may carry
    // pre-reframe string blobs), matching what the deck/walkthrough render.
    setDraft(normalizeSectionContent(view.content))
  }
  const cancelEditing = () => { setDraft(null); setError(null) }

  // AI diagram generator wired into the structured editor's per-diagram prompt box.
  const generateDiagram: GenerateDiagramFn = async ({ prompt, current, context, preferType }) => {
    const ctx = [item.title, item.objective, workstream?.name?.split('(')[0].trim(), context].filter(Boolean).join('. ')
    const res = await fetch('/api/workshops/diagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workshopId, orgId, prompt, current, ...(ctx ? { context: ctx } : {}), preferType }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Diagram generation failed')
    return data.diagram ?? null
  }

  // AI text-fragment generator wired into the structured editor's content prompts.
  const generateContent = (async ({ target, prompt, context }: { target: string; prompt: string; context?: string }) => {
    const ctx = [item.title, item.objective, workstream?.name?.split('(')[0].trim(), context].filter(Boolean).join('. ')
    const res = await fetch('/api/workshops/section-fragment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workshopId, orgId, target, prompt, ...(ctx ? { context: ctx } : {}) }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Generation failed')
    const frag = data.fragment ?? null
    return target === 'bullets' ? (frag?.bullets ?? null) : frag
  }) as unknown as GenerateContentFn

  const saveEdits = async () => {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      const row = await upsertAgendaContent({
        workshopId,
        agendaItemId: item.id,
        sectionKind: (item.section_kind ?? draft.kind) as SectionKind,
        content: draft,
        // A hand-edit resolves the section; mark it final.
        status: 'final',
      })
      const result: SectionResult = {
        content: draft,
        clarifyingQuestions: view?.clarifyingQuestions ?? [],
        kbGaps: view?.kbGaps ?? [],
        groundingUsed: view?.groundingUsed ?? false,
        version: row.version,
        status: row.status,
      }
      setLocal(result)
      onSaved(result)
      setDraft(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save your edits')
    } finally {
      setSaving(false)
    }
  }

  // While hand-editing, the panel is a focused form with its own save/cancel bar.
  if (draft) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 sticky top-0 z-10 bg-[var(--m12-bg)] pb-2 -mt-1 pt-1">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-[#3B82F6] mb-0.5">Editing content</div>
            <h3 className="text-sm font-semibold text-[var(--m12-text)] leading-snug">{item.title}</h3>
            <p className="text-[10px] text-[var(--m12-text-muted)] mt-0.5">Edits are yours, no AI. They save to this section and flow into the Workshop Experience and the deck.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={cancelEditing} disabled={saving} className="text-[11px] px-2.5 py-1.5 rounded-lg border border-[var(--m12-border)]/50 hover:border-[var(--m12-border)] text-[var(--m12-text-secondary)] disabled:opacity-50">Cancel</button>
            <button type="button" onClick={saveEdits} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white bg-[#059669] hover:bg-[#10B981] disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
        {error && <div className="text-[11px] text-[#EF4444] bg-[#DC262614] border border-[#DC2626]/30 rounded-lg px-3 py-2">{error}</div>}
        <SectionContentEditor value={draft} onChange={setDraft} generateDiagram={generateDiagram} generateContent={generateContent} />
        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[var(--m12-border)]/40">
          <button type="button" onClick={cancelEditing} disabled={saving} className="text-[11px] px-2.5 py-1.5 rounded-lg border border-[var(--m12-border)]/50 hover:border-[var(--m12-border)] text-[var(--m12-text-secondary)] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={saveEdits} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white bg-[#059669] hover:bg-[#10B981] disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    )
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
        <div className="flex items-center gap-1.5 shrink-0">
          {view?.content && (
            <button
              type="button"
              onClick={startEditing}
              disabled={busy}
              title="Hand-edit this section's text and diagrams (no AI)"
              className="border border-[var(--m12-border)]/50 hover:border-[var(--m12-border)] text-[var(--m12-text-secondary)] px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
            >
              ✎ Edit
            </button>
          )}
          <button
            onClick={generate}
            disabled={busy}
            title={feedback.trim() ? 'Generate honoring your prompt below' : (view?.content ? 'Regenerate this section' : 'Generate this section')}
            className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
          >
            {busy ? 'Generating…' : view?.content ? 'Regenerate' : 'Generate content'}
          </button>
        </div>
      </div>

      {item.section_kind === 'evaluation' && (
        <div className="text-[10px] text-[var(--m12-text-muted)] bg-[var(--m12-bg-card)] border border-[#7C3AED]/30 rounded-lg px-3 py-2">
          This section synthesizes across the workstream recommendations. Generate the workstream sections first, then generate this to reconcile where they diverge.
        </div>
      )}

      {error && <div className="text-[11px] text-[#EF4444] bg-[#DC262614] border border-[#DC2626]/30 rounded-lg px-3 py-2">{error}</div>}

      {/* Content by kind. Normalize first so OLD-shape rows (pre-reframe string
          blobs where an array is now expected) never throw "x.map is not a
          function"; this matches what the deck/walkthrough render. */}
      {view?.content ? (
        <ContentBody content={normalizeSectionContent(view.content)} />
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
  const p = pros || []
  const c = cons || []
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-[9px] uppercase tracking-wide text-[#059669] mb-1">Pros</div>
        {p.length ? <Bullets items={p} marker="+" color="#059669" /> : <div className="text-[10px] text-[var(--m12-text-muted)]">None</div>}
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-wide text-[#DC2626] mb-1">Cons</div>
        {c.length ? <Bullets items={c} marker="−" color="#DC2626" /> : <div className="text-[10px] text-[var(--m12-text-muted)]">None</div>}
      </div>
    </div>
  )
}

// Coerce a field that SHOULD be a string[] into one. New rows carry arrays; old
// persisted rows may carry a single string blob (pre-reframe shape). Never crash:
// a string becomes a one-item list, null/undefined becomes an empty list.
function asBullets(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : v ? [String(v)] : []
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
  // Defensive against old persisted rows: these fields may be missing or (for
  // overallConsiderations / currentState) a string blob from the pre-reframe shape.
  const considerations = asBullets(c.overallConsiderations)
  const current = asBullets(c.currentState)
  const options = c.futureStateOptions || []
  const decisions = c.keyDecisions || []
  return (
    <div className="space-y-3">
      {(considerations.length > 0 || current.length > 0 || options.length > 0) && (
        <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-4 space-y-3">
          {considerations.length > 0 && (
            <Block title="Overall considerations" color="#2563EB">
              <Bullets items={considerations} color="#2563EB" />
            </Block>
          )}
          {current.length > 0 && (
            <div className={considerations.length > 0 ? 'pt-2 border-t border-[var(--m12-border)]/40' : ''}>
              <Block title="Current state" color="#0891B2">
                <Bullets items={current} color="#0891B2" />
              </Block>
            </div>
          )}
          {options.length > 0 && (
            <div className={considerations.length > 0 || current.length > 0 ? 'pt-2 border-t border-[var(--m12-border)]/40' : ''}>
              <Block title="Options for future state" color="#7C3AED">
                <div className="space-y-2.5">
                  {options.map((o, i) => (
                    <div key={i} className="border border-[var(--m12-border)]/40 rounded-lg p-2.5">
                      <div className="text-[11px] font-medium text-[var(--m12-text)]">{o.label}</div>
                      {o.summary && <p className="text-[10px] text-[var(--m12-text-muted)] leading-snug mt-0.5 mb-1.5">{o.summary}</p>}
                      <div className={o.summary ? '' : 'mt-1.5'}>
                        <ProsCons pros={o.pros || []} cons={o.cons || []} />
                      </div>
                    </div>
                  ))}
                </div>
              </Block>
            </div>
          )}
        </div>
      )}

      {decisions.length > 0 && (
        <div className="text-[10px] uppercase tracking-wide text-[var(--m12-text-muted)]">Key decisions</div>
      )}
      {decisions.map((d, i) => <DecisionCard key={d.id || i} d={d} />)}
      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}

function DecisionCard({ d }: { d: KeyDecision }) {
  const rec = d.recommendedDecision || { recommendation: '', rationale: [] }
  const conf = rec.confidence
  const confMeta = conf ? CONFIDENCE_META[conf] : null
  // context + rationale are string[] in the new shape; old rows may carry a blob.
  const context = asBullets(d.context)
  const rationale = asBullets(rec.rationale)
  const leadingQuestions = d.leadingQuestions || []
  return (
    <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-4 space-y-3">
      <div>
        <div className="text-[12px] font-semibold text-[var(--m12-text)]">{d.title}</div>
        {context.length > 0 && (
          <div className="mt-1.5">
            <Block title="Context"><Bullets items={context} /></Block>
          </div>
        )}
      </div>

      {leadingQuestions.length > 0 && (
        <Block title="Leading questions" color="#D97706"><Bullets items={leadingQuestions} marker="?" color="#D97706" /></Block>
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
        <div className="text-[12px] text-[var(--m12-text)] font-medium leading-snug">{rec.recommendation}</div>
        {rationale.length > 0 && (
          <div className="mt-1.5">
            <Block title="Rationale" color="#3B82F6"><Bullets items={rationale} color="#3B82F6" /></Block>
          </div>
        )}
      </div>

      {/* Every decision carries its own visual (required in the new shape); render it
          directly under the recommendation so it reads as this decision's diagram. */}
      {d.diagram && (
        <div className="pt-1">
          <div className="text-[9px] uppercase tracking-wide text-[var(--m12-text-muted)] mb-1.5">Decision visual</div>
          <DiagramCard diagram={d.diagram} width={520} />
        </div>
      )}
    </div>
  )
}

function EvaluationBody({ c }: { c: EvaluationSectionContent }) {
  const divergences = c.divergences || []
  const rationale = asBullets(c.rationale)
  return (
    <div className="space-y-3">
      {divergences.length > 0 && (
        <div className="space-y-2">
          {divergences.map((dv, i) => (
            <div key={i} className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-3">
              <div className="text-[12px] font-semibold text-[var(--m12-text)] mb-1.5">{dv.topic}</div>
              <div className="space-y-1 mb-2">
                {(dv.positions || []).map((p, j) => (
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
        <ProsCons pros={c.pros || []} cons={c.cons || []} />
        {c.tradeoffs && c.tradeoffs.length > 0 && (
          <Block title="Tradeoffs" color="#D97706"><Bullets items={c.tradeoffs} marker="⇄" color="#D97706" /></Block>
        )}
        {rationale.length > 0 && (
          <div className="pt-2 border-t border-[var(--m12-border)]/40">
            <Block title="Rationale"><Bullets items={rationale} /></Block>
          </div>
        )}
      </div>
      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}
