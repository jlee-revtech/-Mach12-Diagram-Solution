'use client'

// Section editor panel for the selected agenda card in the prep view. Generates
// facilitation content via POST /api/workshops/section, renders it per kind
// (overview / workstream / evaluation), surfaces clarifying questions (req 10),
// KB-gap callouts with the seeding recipe from PLAN §7 (req 3), and an NL-feedback
// box (req 9). It NEVER runs embeddings/imports; KB gaps only show the steps.

import { useState, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/common'
import type {
  SectionContent, ClarifyingQuestion, KbGap,
  SectionGenerationResult, SectionKind,
} from '@jlee-revtech/agent-core'
import type { WorkshopAgendaItem } from '@/lib/workshop/types'
import type { Workstream } from '@/lib/workstream/types'
import { upsertAgendaContent, type AgendaContentRow } from '@/lib/supabase/workshops'
import { normalizeSectionContent } from '@/lib/workshop/deck'
import { hasSynthesis } from '@/lib/workshop/decisionCriteria'
import { sectionMetaFor } from './sectionMeta'
import SectionContentEditor, { type GenerateDiagramFn, type GenerateContentFn } from './SectionContentEditor'
import SectionContentView from './SectionContentView'

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
  const [synthesizing, setSynthesizing] = useState(false)
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
  // hand-edits, AUTO-SAVED (debounced) back to the SAME content row the AI writes.
  const [draft, setDraft] = useState<SectionContent | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const snapshotRef = useRef<SectionContent | null>(null)  // content at edit-start (for revert)
  const lastSavedRef = useRef<string>('')                  // serialized last-persisted draft
  const pendingRef = useRef<SectionContent | null>(null)   // latest draft not yet persisted
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const meta = sectionMetaFor(item.section_kind)

  // Prefer freshly generated local state; else the loaded row.
  const view: SectionResult | null = local ?? (content?.content
    ? { content: content.content, clarifyingQuestions: content.clarifying_questions ?? [], kbGaps: content.kb_gaps ?? [], groundingUsed: false, version: content.version, status: content.status }
    : null)

  // Persist the current draft to the SAME content row the AI writes. Returns the
  // fresh result (used to update local view + notify the parent).
  const persistDraft = async (d: SectionContent): Promise<SectionResult> => {
    const row = await upsertAgendaContent({
      workshopId,
      agendaItemId: item.id,
      sectionKind: (item.section_kind ?? d.kind) as SectionKind,
      content: d,
      status: 'final', // a hand-edit resolves the section
    })
    return {
      content: d,
      clarifyingQuestions: view?.clarifyingQuestions ?? [],
      kbGaps: view?.kbGaps ?? [],
      groundingUsed: view?.groundingUsed ?? false,
      version: row.version,
      status: row.status,
    }
  }

  // 057: a tool-training screenshot was captured (Playwright route patched the
  // content row server-side and returned the updated content). Refresh the local
  // view and notify the parent so the image renders immediately.
  const onScreenshotCaptured = (updatedContent: SectionContent) => {
    const result: SectionResult = {
      content: updatedContent,
      clarifyingQuestions: view?.clarifyingQuestions ?? [],
      kbGaps: view?.kbGaps ?? [],
      groundingUsed: view?.groundingUsed ?? false,
      version: view?.version ?? 1,
      status: view?.status ?? 'final',
    }
    setLocal(result)
    onSaved(result)
  }

  // Auto-save: whenever the draft changes, debounce a save. Skips the initial draft
  // (equals the loaded content) and any state that was just persisted.
  useEffect(() => {
    if (!draft) return
    const serialized = JSON.stringify(draft)
    if (serialized === lastSavedRef.current) return
    pendingRef.current = draft
    setSaveStatus('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const d = pendingRef.current
      if (!d) return
      try {
        const result = await persistDraft(d)
        lastSavedRef.current = JSON.stringify(d)
        pendingRef.current = null
        setLocal(result)
        onSaved(result)
        setSaveStatus('saved')
      } catch (e) {
        setSaveStatus('error')
        setError(e instanceof Error ? e.message : 'Auto-save failed')
      }
    }, 800)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  // Flush a pending save on unmount (e.g. switching sections) so no edit is lost.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      const d = pendingRef.current
      if (d) void persistDraft(d).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Synthesize the decision-criteria deliverable for the Evaluation section from the
  // considerations (prioritized), notes, decisions, and captures across all sections.
  const synthesizeCriteria = async () => {
    setSynthesizing(true)
    setError(null)
    try {
      const res = await fetch('/api/workshops/decision-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId, orgId, agendaItemId: item.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Synthesis failed')
      const result: SectionResult = {
        content: data.content,
        clarifyingQuestions: view?.clarifyingQuestions ?? [],
        kbGaps: view?.kbGaps ?? [],
        groundingUsed: view?.groundingUsed ?? false,
        version: data.version,
        status: data.status,
      }
      setLocal(result)
      onSaved(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Synthesis failed')
    } finally {
      setSynthesizing(false)
    }
  }

  // ─── Manual edit (no AI): open a draft that auto-saves as you type ──
  const startEditing = () => {
    if (!view?.content) return
    setError(null)
    // Normalize so the structured editor always gets arrays (old rows may carry
    // pre-reframe string blobs), matching what the deck/walkthrough render.
    const snap = normalizeSectionContent(view.content)
    snapshotRef.current = snap
    lastSavedRef.current = JSON.stringify(snap)
    pendingRef.current = null
    setSaveStatus('saved')
    setDraft(snap)
  }

  // Persist immediately (used by Done + Retry). Returns true on success.
  const flushSave = async (d: SectionContent): Promise<boolean> => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (JSON.stringify(d) === lastSavedRef.current) return true
    setSaveStatus('saving')
    setError(null)
    try {
      const result = await persistDraft(d)
      lastSavedRef.current = JSON.stringify(d)
      pendingRef.current = null
      setLocal(result)
      onSaved(result)
      setSaveStatus('saved')
      return true
    } catch (e) {
      setSaveStatus('error')
      setError(e instanceof Error ? e.message : 'Save failed')
      return false
    }
  }

  // Done: flush any pending change, then leave edit mode (stays open on error).
  const finishEditing = async () => {
    if (draft && !(await flushSave(draft))) return
    setDraft(null)
    setSaveStatus('idle')
  }
  const retrySave = () => { if (draft) void flushSave(draft) }
  // Revert: restore the content as it was when editing started, then leave.
  const revertEditing = async () => {
    const snap = snapshotRef.current
    if (snap && !(await flushSave(snap))) return
    setDraft(null)
    setSaveStatus('idle')
  }

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

  // While hand-editing, the panel auto-saves as you type. The bar shows save status
  // plus Revert (restore to edit-start) and Done (flush + leave).
  if (draft) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 sticky top-0 z-10 bg-surface-muted pb-2 -mt-1 pt-1">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-brand-600 mb-0.5">Editing content</div>
            <h3 className="font-display text-heading-sm text-text-primary leading-snug">{item.title}</h3>
            <p className="text-[11px] text-text-tertiary mt-0.5">Edits are yours, no AI. They save automatically and flow into the Workshop Experience and the deck.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <SaveStatusPill status={saveStatus} onRetry={retrySave} />
            <Button variant="secondary" size="sm" onClick={revertEditing} disabled={saveStatus === 'saving'} title="Discard changes made since you opened the editor">Revert</Button>
            <button type="button" onClick={finishEditing} disabled={saveStatus === 'saving'} className="text-[12px] px-3 py-1.5 rounded-lg font-medium text-white bg-status-green hover:bg-green-700 disabled:opacity-50 transition-colors">Done</button>
          </div>
        </div>
        {error && <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <SectionContentEditor value={draft} onChange={setDraft} generateDiagram={generateDiagram} generateContent={generateContent} />
        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border">
          <SaveStatusPill status={saveStatus} onRetry={retrySave} />
          <Button variant="secondary" size="sm" onClick={revertEditing} disabled={saveStatus === 'saving'}>Revert</Button>
          <button type="button" onClick={finishEditing} disabled={saveStatus === 'saving'} className="text-[12px] px-3 py-1.5 rounded-lg font-medium text-white bg-status-green hover:bg-green-700 disabled:opacity-50 transition-colors">Done</button>
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
              className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
            >
              <span>{meta.icon}</span>{meta.label}
            </span>
            {item.timebox_minutes ? <span className="text-[10px] text-text-tertiary">{item.timebox_minutes}m</span> : null}
            {view?.version ? <span className="text-[10px] text-text-tertiary font-mono">v{view.version}</span> : null}
          </div>
          <h3 className="font-display text-heading-sm text-text-primary leading-snug">{item.title}</h3>
          {item.objective && <p className="text-[11px] text-text-tertiary mt-0.5">{item.objective}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Every section kind has a structured hand-editor (decision archetype:
              overview / workstream / evaluation; assessment archetype: assessment /
              roadmap), so Edit shows wherever there is generated content. */}
          {view?.content && (
            <Button
              variant="secondary" size="sm"
              icon={<Pencil size={12} />}
              onClick={startEditing}
              disabled={busy}
              title="Hand-edit this section's text and diagrams (no AI)"
            >
              Edit
            </Button>
          )}
          <Button
            variant="primary" size="sm"
            onClick={generate}
            disabled={busy}
            title={feedback.trim() ? 'Generate honoring your prompt below' : (view?.content ? 'Regenerate this section' : 'Generate this section')}
          >
            {busy ? 'Generating...' : view?.content ? 'Regenerate' : 'Generate content'}
          </Button>
        </div>
      </div>

      {item.section_kind === 'evaluation' && (
        <div className="text-[11px] text-text-tertiary bg-white border border-[#7C3AED]/30 rounded-lg px-3 py-2">
          This section synthesizes across the workstream recommendations. Generate the workstream sections first, then generate this to reconcile where they diverge.
        </div>
      )}
      {item.section_kind === 'roadmap' && (
        <div className="text-[11px] text-text-tertiary bg-white border border-[#D97706]/30 rounded-lg px-3 py-2">
          This section reads every assessment section&apos;s opportunities, detects the dependencies between them, and drafts the sequenced Opportunity Roadmap. Generate the assessment sections first.
        </div>
      )}
      {item.section_kind === 'training' && (
        <div className="text-[11px] text-text-tertiary bg-white border border-[#059669]/30 rounded-lg px-3 py-2">
          Builds the training for this role: role context, the business process it runs, the data integrations it depends on, and hands-on tool training grounded in the systems in scope. Add a URL under a tool module&apos;s screenshot to capture the real screen.
        </div>
      )}
      {item.section_kind === 'curriculum' && (
        <div className="text-[11px] text-text-tertiary bg-white border border-[#0891B2]/30 rounded-lg px-3 py-2">
          This section reads every role&apos;s training modules, detects the prerequisites between them, and sequences a phased Learning Path with per-role tracks. Generate the training sections first.
        </div>
      )}
      {item.section_kind === 'certification' && (
        <div className="text-[11px] text-text-tertiary bg-white border border-[#7C3AED]/30 rounded-lg px-3 py-2">
          This section builds a Knowledge Check: scenario-based exercises, quiz questions with answer keys, and a competency sign-off checklist grounded in the modules trained. Generate the training sections first.
        </div>
      )}

      {error && <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      {/* Read-only render of the section content (shared with the public share
          page). It normalizes internally, so old-shape rows never throw. */}
      {view?.content ? (
        <>
          <SectionContentView
            content={view.content}
            capture={item.section_kind === 'training' ? { workshopId, orgId, agendaItemId: item.id, onCaptured: onScreenshotCaptured } : undefined}
          />
          {item.section_kind === 'evaluation' && (
            <SynthesizeCriteriaButton content={view.content} busy={synthesizing} onSynthesize={synthesizeCriteria} />
          )}
        </>
      ) : !busy ? (
        <div className="text-[11px] text-text-tertiary bg-white border border-border rounded-lg px-3 py-4 text-center">
          No content yet. Press <span className="text-brand-600">Generate content</span> to draft this section.
        </div>
      ) : null}

      {/* Clarifying questions (req 10) */}
      <AnimatePresence>
        {view && view.clarifyingQuestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2.5 overflow-hidden"
          >
            <div className="text-[10px] uppercase tracking-wide text-amber-700">Clarifying questions</div>
            {view.clarifyingQuestions.map((q: ClarifyingQuestion) => (
              <div key={q.id}>
                <div className="text-[11px] text-text-primary leading-snug">{q.question}</div>
                {q.why && <div className="text-[10px] text-text-tertiary mb-1">{q.why}</div>}
                <input
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Your answer"
                  className="w-full bg-surface-input border border-border rounded px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 mt-1"
                />
              </div>
            ))}
            <button
              onClick={regenerateWithAnswers}
              disabled={busy}
              className="text-[11px] px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium transition-colors"
            >
              {busy ? 'Regenerating...' : 'Regenerate with answers'}
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
      <div className="bg-white border border-border rounded-lg shadow-card p-3">
        <div className="text-[10px] uppercase tracking-wide text-text-secondary mb-1.5">
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
          className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-body-sm text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none resize-none mb-2"
        />
        <button
          onClick={generate}
          disabled={busy || (!view?.content && !feedback.trim())}
          className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded border border-brand-200 text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition-colors"
        >
          <Sparkles size={11} />
          {busy
            ? (view?.content ? 'Updating...' : 'Generating...')
            : view?.content
              ? (feedback.trim() ? 'Update section' : 'Regenerate section')
              : 'Generate with prompt'}
        </button>
        <div className="text-[10px] text-text-tertiary mt-1.5 leading-snug">
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
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <span className="text-amber-600 text-body-sm mt-0.5">⚑</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-text-primary font-medium">
            Knowledge base needs seeding: {gap.topic}{wsLabel ? ` for ${wsLabel}` : ''}
          </div>
          {gap.rationale && <div className="text-[10px] text-text-tertiary mt-0.5">{gap.rationale}</div>}
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => setOpen((v) => !v)} className="text-[10px] text-amber-700 hover:underline">
              {open ? 'Hide seeding steps' : 'Show seeding steps'}
            </button>
            <button onClick={copy} className="text-[10px] px-2 py-0.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors">
              {copied ? 'Copied' : 'Copy seeding steps'}
            </button>
          </div>
          <AnimatePresence>
            {open && (
              <motion.ol
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="text-[10px] text-text-secondary list-decimal list-inside space-y-0.5 mt-2 overflow-hidden"
              >
                {steps.map((s, i) => <li key={i} className="leading-snug"><code className="font-mono text-[10px] text-text-primary">{s}</code></li>)}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// Auto-save status indicator shown in the edit bar.
function SaveStatusPill({ status, onRetry }: { status: 'idle' | 'saving' | 'saved' | 'error'; onRetry: () => void }) {
  if (status === 'idle') return null
  if (status === 'saving') {
    return (
      <span className="text-[10px] text-text-tertiary flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 border-2 border-border border-t-brand-500 rounded-full animate-spin" />Saving...
      </span>
    )
  }
  if (status === 'saved') return <span className="text-[10px] text-status-green flex items-center gap-1">✓ All changes saved</span>
  return <button type="button" onClick={onRetry} className="text-[10px] text-red-600 hover:underline">Save failed, retry</button>
}

// Trigger for the Solution Architecture Evaluation: synthesize a decision-criteria
// deliverable from the considerations, notes, decisions, and captures across all
// sections. The synthesized output renders via SectionContentView.
function SynthesizeCriteriaButton({ content, busy, onSynthesize }: { content: SectionContent; busy: boolean; onSynthesize: () => void }) {
  const already = hasSynthesis(content)
  return (
    <div className="rounded-lg border border-[#0891B2]/40 bg-[#0891B2]/5 p-3">
      <div className="text-[11px] font-medium text-text-primary mb-0.5">Decision Criteria synthesis</div>
      <div className="text-[10px] text-text-tertiary mb-2">Reads the Considerations (prioritized), Notes, decisions, and captured actions across every section, then synthesizes a decision-criteria deliverable with Actions and Next Steps.</div>
      <button type="button" onClick={onSynthesize} disabled={busy} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-[#0891B2] hover:bg-[#06B6D4] disabled:opacity-50 text-white font-medium transition-colors">
        {already ? <RefreshCw size={11} /> : <Sparkles size={11} />}
        {busy ? 'Synthesizing...' : already ? 'Re-synthesize decision criteria' : 'Synthesize decision criteria'}
      </button>
    </div>
  )
}
