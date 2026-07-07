'use client'

// The "Workshop Experience" (requirement 7): a full-screen HTML walkthrough of
// the facilitation content. Renders the SAME WorkshopSlide[] model that the PPTX
// export uses (via loadFacilitationDeck), one 16:9 stage at a time, with prev/next
// + keyboard nav, an agenda progress rail, a speaker-notes toggle, and a live
// NL-revise bar (requirement 9) that POSTs /api/workshops/section for the current
// slide's section and reloads the deck in place.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { loadFacilitationDeck, type LoadedDeck, type DeckSection } from '@/lib/workshop/deck'
import { exportFacilitationPptx } from '@/lib/workshop/export'
import { upsertAgendaContent } from '@/lib/supabase/workshops'
import DiagramView from '@/components/workshop/DiagramView'
import SectionContentEditor, { type GenerateDiagramFn } from '@/components/workshop/SectionContentEditor'
import type { WorkshopSlide, WorkshopSlideBlock, ClarifyingQuestion, SectionContent, SectionKind } from '@jlee-revtech/agent-core'

// Brand palette (matches src/lib/workshop/export.ts + the app tokens).
const BLUE = '#2563EB'
const CYAN = '#06B6D4'
const DARK = '#0F172A'

interface ReviseState {
  clarifyingQuestions: ClarifyingQuestion[]
  answers: Record<string, string>
}

export default function WorkshopPresentPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { user, organization, loading } = useAuth()

  const [deck, setDeck] = useState<LoadedDeck | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [revising, setRevising] = useState(false)
  const [reviseErr, setReviseErr] = useState<string | null>(null)
  const [revise, setRevise] = useState<ReviseState | null>(null)
  // Direct manual edit of the current slide's section (no AI): a working draft of
  // the structured content, saved to the SAME content row the deck derives from.
  const [editDraft, setEditDraft] = useState<SectionContent | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editErr, setEditErr] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  const reload = useCallback(async (): Promise<LoadedDeck | null> => {
    if (!id) return null
    try {
      const d = await loadFacilitationDeck(null, id)
      setDeck(d)
      setLoadErr(null)
      return d
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Failed to load the deck')
      return null
    }
  }, [id])

  useEffect(() => { if (organization && id) reload() }, [organization, id, reload])

  const slides = deck?.slides ?? []
  const total = slides.length
  const clamped = Math.min(current, Math.max(0, total - 1))
  const slide: WorkshopSlide | undefined = slides[clamped]
  const currentSectionId = deck?.slideSections[clamped] ?? null

  const [downloading, setDownloading] = useState(false)
  const downloadPptx = useCallback(async () => {
    if (!deck || deck.slides.length === 0) return
    setDownloading(true)
    try {
      await exportFacilitationPptx(
        {
          title: deck.workshop.title,
          ...(deck.workshop.customerName ? { customerName: deck.workshop.customerName } : {}),
          ...(deck.workshop.topic ? { topic: deck.workshop.topic } : {}),
          ...(deck.workshop.durationMinutes ? { durationMinutes: deck.workshop.durationMinutes } : {}),
        },
        deck.slides,
      )
    } catch (e) {
      setReviseErr(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }, [deck])

  const exit = useCallback(() => router.push(`/workshops/${id}`), [router, id])
  const go = useCallback((delta: number) => {
    setShowNotes(false)
    setRevise(null)
    setReviseErr(null)
    setCurrent((c) => {
      const next = c + delta
      if (next < 0 || next > total - 1) return c
      return next
    })
  }, [total])

  // Keyboard nav: ArrowLeft/Right + Escape. Ignore while typing in a field, and
  // never navigate slides while the edit drawer is open (Escape closes it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')
      if (editDraft) {
        if (e.key === 'Escape') {
          if (typing) { (t as HTMLElement).blur(); return }
          e.preventDefault(); setEditDraft(null)
        }
        return
      }
      if (typing) {
        if (e.key === 'Escape') (t as HTMLElement).blur()
        return
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
      else if (e.key === 'Escape') { e.preventDefault(); exit() }
      else if (e.key === 'n' || e.key === 'N') { setShowNotes((v) => !v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, exit, editDraft])

  // Live NL revise: POST /api/workshops/section for the current slide's section.
  const submitRevise = useCallback(async (extra?: { clarificationAnswers?: { question: string; answer: string }[] }) => {
    if (!organization || !id || !currentSectionId) return
    const fb = feedback.trim()
    if (!fb && !extra?.clarificationAnswers?.length) return
    setRevising(true)
    setReviseErr(null)
    try {
      const res = await fetch('/api/workshops/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workshopId: id,
          orgId: organization.id,
          agendaItemId: currentSectionId,
          ...(fb ? { feedback: fb } : {}),
          ...(extra?.clarificationAnswers ? { clarificationAnswers: extra.clarificationAnswers } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      const cq: ClarifyingQuestion[] = data.clarifyingQuestions ?? []
      // Reload the deck; keep the viewer near the same section (first slide of it).
      const d = await reload()
      if (d) {
        const firstIdx = d.slideSections.findIndex((s) => s === currentSectionId)
        if (firstIdx >= 0) setCurrent(firstIdx)
      }
      setFeedback('')
      if (cq.length > 0) setRevise({ clarifyingQuestions: cq, answers: {} })
      else setRevise(null)
    } catch (e) {
      setReviseErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setRevising(false)
    }
  }, [organization, id, currentSectionId, feedback, reload])

  const submitClarifications = useCallback(() => {
    if (!revise) return
    const clarificationAnswers = revise.clarifyingQuestions
      .map((q) => ({ question: q.question, answer: (revise.answers[q.id] || '').trim() }))
      .filter((a) => a.answer)
    if (clarificationAnswers.length === 0) { setReviseErr('Answer at least one question first.'); return }
    submitRevise({ clarificationAnswers })
  }, [revise, submitRevise])

  // ─── Manual edit of the current section (opens a drawer over the deck) ──
  const startEditSection = useCallback(() => {
    const sec = deck?.sections.find((s) => s.agendaItemId === currentSectionId)
    if (!sec) return
    setEditErr(null)
    // deck.sections content is already normalized by the loader, so the editor
    // gets clean arrays even for old-shape rows.
    setEditDraft(sec.content)
  }, [deck, currentSectionId])

  const generateDiagram = useCallback<GenerateDiagramFn>(async ({ prompt, current, context, preferType }) => {
    const sec = deck?.sections.find((s) => s.agendaItemId === currentSectionId)
    const ctx = [deck?.workshop.topic, deck?.workshop.customerName, sec?.agendaTitle, context].filter(Boolean).join('. ')
    const res = await fetch('/api/workshops/diagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workshopId: id, orgId: organization?.id, prompt, current, ...(ctx ? { context: ctx } : {}), preferType }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Diagram generation failed')
    return data.diagram ?? null
  }, [deck, currentSectionId, id, organization])

  const saveEditSection = useCallback(async () => {
    if (!organization || !id || !currentSectionId || !editDraft) return
    setSavingEdit(true)
    setEditErr(null)
    try {
      await upsertAgendaContent({
        workshopId: id,
        agendaItemId: currentSectionId,
        sectionKind: editDraft.kind as SectionKind,
        content: editDraft,
        status: 'final',
      })
      // Reload the deck so the slides re-derive; keep the viewer on this section.
      const d = await reload()
      if (d) {
        const firstIdx = d.slideSections.findIndex((s) => s === currentSectionId)
        if (firstIdx >= 0) setCurrent(firstIdx)
      }
      setEditDraft(null)
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : 'Failed to save your edits')
    } finally {
      setSavingEdit(false)
    }
  }, [organization, id, currentSectionId, editDraft, reload])

  if (loading || !user || !organization) return null

  // ─── Empty state: no content authored yet ───
  if (deck && total === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center" style={{ backgroundColor: DARK }}>
        <div className="max-w-md px-6">
          <div className="text-lg font-semibold text-white mb-2">Nothing to present yet</div>
          <p className="text-sm text-white/60 mb-6">
            This workshop has no facilitation content. Generate section content in the prep view, then enter the Workshop Experience.
          </p>
          <button onClick={exit} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: BLUE }}>
            Back to prep
          </button>
        </div>
      </div>
    )
  }

  if (loadErr) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center" style={{ backgroundColor: DARK }}>
        <div className="max-w-md px-6">
          <div className="text-lg font-semibold text-white mb-2">Could not load the deck</div>
          <p className="text-sm text-white/60 mb-6">{loadErr}</p>
          <button onClick={exit} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: BLUE }}>
            Back to prep
          </button>
        </div>
      </div>
    )
  }

  if (!deck || !slide) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: DARK }}>
        <div className="text-sm text-white/50">Loading the Workshop Experience…</div>
      </div>
    )
  }

  const sectionForRail = (sec: DeckSection): boolean => sec.agendaItemId === currentSectionId
  const currentSection = deck.sections.find((s) => s.agendaItemId === currentSectionId) ?? null

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: DARK }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={exit} className="text-white/50 hover:text-white/90 flex items-center gap-1.5 text-xs" title="Exit (Esc)">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M11 4l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Exit
          </button>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{deck.workshop.title}</div>
            {deck.workshop.customerName && <div className="text-[10px] text-white/50">{deck.workshop.customerName}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-white/60 tabular-nums mr-1">{clamped + 1} / {total}</div>
          <button
            onClick={downloadPptx}
            disabled={downloading || total === 0}
            className="text-[11px] px-2.5 py-1 rounded border transition-colors disabled:opacity-30"
            style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', backgroundColor: 'transparent' }}
            title="Download the facilitation deck as PowerPoint"
          >
            {downloading ? 'Preparing…' : 'Download PPTX'}
          </button>
          <button
            onClick={startEditSection}
            disabled={!currentSectionId}
            className="text-[11px] px-2.5 py-1 rounded border transition-colors disabled:opacity-30"
            style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', backgroundColor: 'transparent' }}
            title={currentSectionId ? "Edit this section's text and diagrams by hand" : 'Title and agenda slides cannot be edited'}
          >
            ✎ Edit
          </button>
          <button
            onClick={() => setShowNotes((v) => !v)}
            disabled={!slide.facilitatorNotes}
            className="text-[11px] px-2.5 py-1 rounded border transition-colors disabled:opacity-30"
            style={{ borderColor: showNotes ? BLUE : 'rgba(255,255,255,0.2)', color: showNotes ? '#93C5FD' : 'rgba(255,255,255,0.7)', backgroundColor: showNotes ? '#2563EB22' : 'transparent' }}
            title="Toggle speaker notes (N)"
          >
            Notes
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Agenda progress rail */}
        <div className="w-56 shrink-0 border-r border-white/10 overflow-auto p-3 hidden md:block">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2 px-1">Agenda</div>
          <div className="space-y-1">
            {deck.sections.length === 0 && <div className="text-[11px] text-white/40 px-1">No sections</div>}
            {deck.sections.map((sec) => {
              const active = sectionForRail(sec)
              const firstIdx = deck.slideSections.findIndex((s) => s === sec.agendaItemId)
              return (
                <button
                  key={sec.agendaItemId}
                  onClick={() => { if (firstIdx >= 0) { setShowNotes(false); setRevise(null); setCurrent(firstIdx) } }}
                  className="w-full text-left rounded-lg px-2.5 py-2 transition-colors"
                  style={{
                    backgroundColor: active ? '#2563EB22' : 'transparent',
                    borderLeft: `2px solid ${active ? BLUE : 'transparent'}`,
                  }}
                >
                  <div className="text-[11px] leading-snug" style={{ color: active ? '#DBEAFE' : 'rgba(255,255,255,0.7)' }}>{sec.agendaTitle}</div>
                  {sec.timeboxMinutes ? <div className="text-[9px] text-white/40 mt-0.5">{sec.timeboxMinutes} min</div> : null}
                </button>
              )
            })}
          </div>
        </div>

        {/* Stage */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex items-center justify-center p-6 min-h-0 overflow-auto">
            <div
              ref={stageRef}
              className="w-full max-w-[1180px] rounded-2xl shadow-2xl overflow-hidden bg-white"
              style={{ aspectRatio: '16 / 9' }}
            >
              <SlideStage slide={slide} />
            </div>
          </div>

          {/* Speaker notes */}
          {showNotes && slide.facilitatorNotes && (
            <div className="shrink-0 border-t border-white/10 px-6 py-3 max-h-40 overflow-auto">
              <div className="max-w-[1180px] mx-auto">
                <div className="text-[10px] uppercase tracking-wider text-[#93C5FD] mb-1">Speaker notes</div>
                <p className="text-xs text-white/75 leading-relaxed whitespace-pre-wrap">{slide.facilitatorNotes}</p>
              </div>
            </div>
          )}

          {/* Nav + live revise bar */}
          <div className="shrink-0 border-t border-white/10 px-6 py-3">
            <div className="max-w-[1180px] mx-auto flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button onClick={() => go(-1)} disabled={clamped === 0} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-30" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} title="Previous (←)">← Prev</button>
                <button onClick={() => go(1)} disabled={clamped >= total - 1} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-30" style={{ backgroundColor: BLUE }} title="Next (→)">Next →</button>
              </div>

              {/* Live NL-revise bar (req 9) — enabled only on section slides */}
              <div className="flex-1 flex items-center gap-2 min-w-[240px]">
                <input
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && currentSectionId) submitRevise() }}
                  disabled={!currentSectionId || revising}
                  placeholder={currentSectionId ? 'Tell the agent how to change this section…' : 'Title and agenda slides cannot be revised'}
                  className="flex-1 bg-white/5 border border-white/15 focus:border-[#2563EB] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/35 outline-none disabled:opacity-40"
                />
                <button
                  onClick={() => submitRevise()}
                  disabled={!currentSectionId || revising || !feedback.trim()}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-30"
                  style={{ backgroundColor: '#7C3AED' }}
                  title={currentSectionId ? 'Revise this section and reload' : 'Not a section slide'}
                >
                  {revising ? 'Updating…' : 'Update this section'}
                </button>
              </div>
            </div>

            {reviseErr && <div className="max-w-[1180px] mx-auto mt-2 text-[11px] text-[#FCA5A5]">{reviseErr}</div>}

            {/* Clarifying questions surfaced inline (req 10) */}
            {revise && revise.clarifyingQuestions.length > 0 && (
              <div className="max-w-[1180px] mx-auto mt-3 rounded-lg border border-[#D97706]/40 bg-[#D9770614] p-3 space-y-2.5">
                <div className="text-[10px] uppercase tracking-wide text-[#FBBF24]">Clarifying questions</div>
                {revise.clarifyingQuestions.map((q) => (
                  <div key={q.id}>
                    <div className="text-[11px] text-white/90 leading-snug">{q.question}</div>
                    {q.why && <div className="text-[10px] text-white/50 mb-1">{q.why}</div>}
                    <input
                      value={revise.answers[q.id] || ''}
                      onChange={(e) => setRevise((r) => (r ? { ...r, answers: { ...r.answers, [q.id]: e.target.value } } : r))}
                      placeholder="Your answer"
                      className="w-full bg-white/5 border border-white/15 focus:border-[#2563EB] rounded px-2 py-1 text-[11px] text-white placeholder:text-white/35 outline-none mt-1"
                    />
                  </div>
                ))}
                <button
                  onClick={submitClarifications}
                  disabled={revising}
                  className="text-[10px] px-2.5 py-1 rounded text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: '#D97706' }}
                >
                  {revising ? 'Regenerating…' : 'Regenerate with answers'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual edit drawer: hand-edit the current section's structured content.
          Saves to the same content row the deck derives from, so the slides,
          walkthrough, and PPTX all update together. */}
      {editDraft && (
        <div className="absolute inset-0 z-30 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => { if (!savingEdit) setEditDraft(null) }} />
          <div className="relative w-full max-w-md h-full flex flex-col shadow-2xl border-l border-[var(--m12-border)]" style={{ backgroundColor: 'var(--m12-bg)' }}>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--m12-border)]/60 shrink-0">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-[#3B82F6]">Edit section</div>
                <div className="text-sm font-semibold text-[var(--m12-text)] truncate">{currentSection?.agendaTitle ?? 'Section'}</div>
                <div className="text-[10px] text-[var(--m12-text-muted)] mt-0.5">No AI. Your edits flow into the deck and the PPTX.</div>
              </div>
              <button type="button" onClick={() => { if (!savingEdit) setEditDraft(null) }} title="Close (Esc)" className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] text-lg leading-none px-1">✕</button>
            </div>
            {editErr && <div className="mx-4 mt-3 text-[11px] text-[#EF4444] bg-[#DC262614] border border-[#DC2626]/30 rounded-lg px-3 py-2">{editErr}</div>}
            <div className="flex-1 overflow-auto p-4">
              <SectionContentEditor value={editDraft} onChange={setEditDraft} generateDiagram={generateDiagram} />
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--m12-border)]/60 shrink-0">
              <button type="button" onClick={() => setEditDraft(null)} disabled={savingEdit} className="text-[11px] px-3 py-1.5 rounded-lg border border-[var(--m12-border)]/50 hover:border-[var(--m12-border)] text-[var(--m12-text-secondary)] disabled:opacity-50">Cancel</button>
              <button type="button" onClick={saveEditSection} disabled={savingEdit} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white bg-[#059669] hover:bg-[#10B981] disabled:opacity-50">{savingEdit ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── The 16:9 slide stage, rendered by slide.kind ────────────────────────────
function SlideStage({ slide }: { slide: WorkshopSlide }) {
  // A slide carrying a diagram shows the heading + the diagram prominently
  // (same SVG the editor + PPTX use), regardless of kind.
  if (slide.diagram) return <DiagramSlide slide={slide} />
  if (slide.kind === 'title') return <TitleSlide slide={slide} />
  if (slide.kind === 'agenda') return <AgendaSlide slide={slide} />
  if (slide.kind === 'bullets') return <BulletsSlide slide={slide} />
  if (slide.kind === 'context') return <ContextSlide slide={slide} />
  // decision + evaluation both render as block grids with a heading.
  return <BlocksSlide slide={slide} />
}

// A diagram slide: heading band + the diagram filling the stage, with any
// caption/bullets beneath. The diagram's own title/caption live inside the SVG,
// so we only show slide-level bullets here (buildSlides puts the caption there).
function DiagramSlide({ slide }: { slide: WorkshopSlide }) {
  const bullets = (slide.bullets ?? []).filter(Boolean)
  return (
    <SlideChrome kicker={slide.subheading}>
      <h2 className="text-[2.2vw] font-bold mb-[1.5%] leading-tight" style={{ color: DARK }}>{slide.heading}</h2>
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto">
        <div className="w-full max-w-[68%]">
          {slide.diagram && <DiagramView diagram={slide.diagram} width={880} />}
        </div>
      </div>
      {bullets.length > 0 && (
        <ul className="mt-[1.5%] space-y-[0.8%]">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-baseline gap-[1.2%] text-[1.15vw] leading-snug" style={{ color: '#475569' }}>
              <span className="shrink-0" style={{ color: CYAN }}>▸</span><span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </SlideChrome>
  )
}

function SlideChrome({ children, kicker }: { children: React.ReactNode; kicker?: string }) {
  return (
    <div className="w-full h-full flex flex-col px-[5%] py-[5%]" style={{ color: DARK }}>
      {kicker && <div className="text-[1.1vw] uppercase tracking-[0.18em] font-semibold mb-[1.5%]" style={{ color: BLUE }}>{kicker}</div>}
      {children}
      <div className="mt-auto pt-[2%] flex items-center gap-2">
        <div className="h-1 w-16 rounded-full" style={{ background: `linear-gradient(90deg, ${BLUE}, ${CYAN})` }} />
      </div>
    </div>
  )
}

function TitleSlide({ slide }: { slide: WorkshopSlide }) {
  return (
    <div className="w-full h-full flex flex-col justify-center px-[7%]" style={{ color: DARK }}>
      <div className="h-1.5 w-24 rounded-full mb-[3%]" style={{ background: `linear-gradient(90deg, ${BLUE}, ${CYAN})` }} />
      <h1 className="text-[3.8vw] font-bold leading-tight" style={{ color: DARK }}>{slide.heading}</h1>
      {slide.subheading && <div className="text-[1.6vw] mt-[2%]" style={{ color: BLUE }}>{slide.subheading}</div>}
      <div className="text-[0.95vw] mt-[4%]" style={{ color: '#475569' }}>Workshop Experience</div>
    </div>
  )
}

function AgendaSlide({ slide }: { slide: WorkshopSlide }) {
  return (
    <SlideChrome kicker="Agenda">
      <h2 className="text-[2.6vw] font-bold mb-[2.5%]" style={{ color: DARK }}>{slide.heading}</h2>
      <ol className="space-y-[1.4%]">
        {(slide.bullets ?? []).map((b, i) => (
          <li key={i} className="flex items-baseline gap-[1.5%] text-[1.5vw]" style={{ color: '#1E293B' }}>
            <span className="font-bold tabular-nums w-[2.2vw] shrink-0" style={{ color: BLUE }}>{i + 1}.</span>
            <span>{b}</span>
          </li>
        ))}
      </ol>
    </SlideChrome>
  )
}

function BulletsSlide({ slide }: { slide: WorkshopSlide }) {
  return (
    <SlideChrome kicker={slide.subheading}>
      <h2 className="text-[2.6vw] font-bold mb-[2.5%] leading-tight" style={{ color: DARK }}>{slide.heading}</h2>
      <ul className="space-y-[1.4%]">
        {(slide.bullets ?? []).map((b, i) => (
          <li key={i} className="flex items-baseline gap-[1.4%] text-[1.5vw] leading-snug" style={{ color: '#1E293B' }}>
            <span className="shrink-0" style={{ color: CYAN }}>▸</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </SlideChrome>
  )
}

function ContextSlide({ slide }: { slide: WorkshopSlide }) {
  const body = slide.blocks?.map((b) => b.body).filter(Boolean).join('\n\n') || ''
  return (
    <SlideChrome kicker={slide.subheading}>
      <h2 className="text-[2.6vw] font-bold mb-[2.5%] leading-tight" style={{ color: DARK }}>{slide.heading}</h2>
      <p className="text-[1.5vw] leading-relaxed whitespace-pre-wrap" style={{ color: '#1E293B' }}>{body}</p>
    </SlideChrome>
  )
}

function BlocksSlide({ slide }: { slide: WorkshopSlide }) {
  const blocks = slide.blocks ?? []
  return (
    <SlideChrome kicker={slide.subheading}>
      <h2 className="text-[2.4vw] font-bold mb-[2%] leading-tight" style={{ color: DARK }}>{slide.heading}</h2>
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-2 gap-[2.5%]">
          {blocks.map((b, i) => <SlideBlock key={i} block={b} span={blockSpan(b)} />)}
        </div>
      </div>
    </SlideChrome>
  )
}

// A prose block (body-only, or the recommendation) spans both columns; pros/cons
// and bullet lists sit in one column so options render as side-by-side cards.
function blockSpan(b: WorkshopSlideBlock): boolean {
  const isProsCons = (b.pros && b.pros.length > 0) || (b.cons && b.cons.length > 0)
  const isBulletList = b.bullets && b.bullets.length > 0
  return !isProsCons && !isBulletList
}

function SlideBlock({ block, span }: { block: WorkshopSlideBlock; span: boolean }) {
  const hasPros = block.pros && block.pros.length > 0
  const hasCons = block.cons && block.cons.length > 0
  const isRecommendation = (block.label || '').toLowerCase().startsWith('recommend')
  return (
    <div
      className="rounded-xl p-[3%]"
      style={{
        gridColumn: span ? 'span 2 / span 2' : undefined,
        backgroundColor: isRecommendation ? '#2563EB0F' : '#F8FAFC',
        border: `1px solid ${isRecommendation ? '#2563EB55' : '#E2E8F0'}`,
      }}
    >
      {block.label && (
        <div className="text-[1.05vw] uppercase tracking-wide font-semibold mb-[3%]" style={{ color: isRecommendation ? BLUE : '#64748B' }}>
          {block.label}
        </div>
      )}
      {block.body && <p className="text-[1.35vw] leading-relaxed whitespace-pre-wrap" style={{ color: '#1E293B' }}>{block.body}</p>}
      {block.bullets && block.bullets.length > 0 && (
        <ul className="space-y-[3%]">
          {block.bullets.map((t, i) => (
            <li key={i} className="flex items-baseline gap-[3%] text-[1.25vw] leading-snug" style={{ color: '#1E293B' }}>
              <span className="shrink-0" style={{ color: '#7C3AED' }}>•</span><span>{t}</span>
            </li>
          ))}
        </ul>
      )}
      {(hasPros || hasCons) && (
        <div className="grid grid-cols-2 gap-[4%]">
          <div>
            <div className="text-[0.95vw] uppercase tracking-wide font-semibold mb-[6%]" style={{ color: '#059669' }}>Pros</div>
            {hasPros ? (
              <ul className="space-y-[6%]">
                {block.pros!.map((t, i) => (
                  <li key={i} className="flex items-baseline gap-[6%] text-[1.15vw] leading-snug" style={{ color: '#1E293B' }}><span style={{ color: '#059669' }}>+</span><span>{t}</span></li>
                ))}
              </ul>
            ) : <div className="text-[1vw]" style={{ color: '#94A3B8' }}>None</div>}
          </div>
          <div>
            <div className="text-[0.95vw] uppercase tracking-wide font-semibold mb-[6%]" style={{ color: '#DC2626' }}>Cons</div>
            {hasCons ? (
              <ul className="space-y-[6%]">
                {block.cons!.map((t, i) => (
                  <li key={i} className="flex items-baseline gap-[6%] text-[1.15vw] leading-snug" style={{ color: '#1E293B' }}><span style={{ color: '#DC2626' }}>−</span><span>{t}</span></li>
                ))}
              </ul>
            ) : <div className="text-[1vw]" style={{ color: '#94A3B8' }}>None</div>}
          </div>
        </div>
      )}
    </div>
  )
}
