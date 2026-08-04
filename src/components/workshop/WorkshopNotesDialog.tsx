'use client'

// All Workshop Notes: one central, read-only view of every note captured across
// the workshop's sections - each section's "Notes & Considerations" bullets plus
// the answered assessment / discovery questions ("Answers from the room"). Opened
// from the prep Sections toolbar. Carries no AI controls, so it stays available
// in Client View (notes are real room input, not scaffolding).

import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Copy, MessageSquare, X } from 'lucide-react'
import type { WorkshopAgendaItem } from '@/lib/workshop/types'
import type { AgendaContentRow } from '@/lib/supabase/workshops'
import { sectionNotes } from '@/lib/workshop/deck'
import { readAssessmentAnswers } from '@/lib/workshop/assessmentAnswers'
import { sectionMetaFor } from './sectionMeta'
import { Button } from '@/components/common'

export interface SectionQA {
  bank: 'Assessment questions' | 'Discovery questions'
  question: string
  answer: string
}

export interface SectionNotesEntry {
  item: WorkshopAgendaItem
  notes: string[]
  qa: SectionQA[]
}

// Pair a question bank with its answers, keeping only answered questions.
function answeredQA(bank: SectionQA['bank'], questions: unknown, answers: string[]): SectionQA[] {
  const qs = Array.isArray(questions) ? questions.map((q) => (q == null ? '' : String(q))) : []
  const out: SectionQA[] = []
  qs.forEach((q, i) => {
    const a = (answers[i] || '').trim()
    if (q.trim() && a) out.push({ bank, question: q, answer: a })
  })
  return out
}

// Gather every visible section's notes + answered Q&A, in agenda order. Shared
// by the dialog body and the toolbar count badge so they can never disagree.
export function collectWorkshopNotes(agenda: WorkshopAgendaItem[], content: AgendaContentRow[]): SectionNotesEntry[] {
  const byItem = new Map(content.map((c) => [c.agenda_item_id, c]))
  const entries: SectionNotesEntry[] = []
  for (const item of agenda) {
    const raw = byItem.get(item.id)?.content
    if (!raw) continue
    const notes = sectionNotes(raw)
    // Read questions off the RAW content (not normalizeSectionContent, whose
    // asArr drops empty entries and would break the index alignment that
    // readAssessmentAnswers keeps against the raw question arrays).
    const c = raw as unknown as Record<string, unknown>
    const { assessmentAnswers, discoveryAnswers } = readAssessmentAnswers(raw)
    const qa = [
      ...answeredQA('Assessment questions', c.assessmentQuestions, assessmentAnswers),
      ...answeredQA('Discovery questions', c.discoveryQuestions, discoveryAnswers),
    ]
    if (notes.length || qa.length) entries.push({ item, notes, qa })
  }
  return entries
}

export function countWorkshopNotes(entries: SectionNotesEntry[]): number {
  return entries.reduce((n, e) => n + e.notes.length + e.qa.length, 0)
}

// Plain-text export of the whole view (clipboard). Hyphens only, no dashes.
function notesAsText(title: string, entries: SectionNotesEntry[]): string {
  const lines: string[] = [`Workshop notes - ${title}`, '']
  entries.forEach((e, i) => {
    lines.push(`${i + 1}. ${e.item.title}`)
    if (e.notes.length) {
      lines.push('   Notes & Considerations:')
      e.notes.forEach((n) => lines.push(`   - ${n}`))
    }
    if (e.qa.length) {
      lines.push('   Answers from the room:')
      e.qa.forEach((q) => {
        lines.push(`   - Q: ${q.question}`)
        lines.push(`     A: ${q.answer}`)
      })
    }
    lines.push('')
  })
  return lines.join('\n').trimEnd() + '\n'
}

export default function WorkshopNotesDialog({ workshopTitle, entries, onClose, onJump }: {
  workshopTitle: string
  entries: SectionNotesEntry[]
  onClose: () => void
  // Open a section in the prep editor (closes the dialog).
  onJump?: (agendaItemId: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const total = useMemo(() => countWorkshopNotes(entries), [entries])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(notesAsText(workshopTitle, entries))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-[46rem] max-w-[94vw] max-h-[86vh] bg-white rounded-xl shadow-card-hover overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3 className="text-heading-sm font-display text-text-primary flex items-center gap-2">
              <ClipboardList size={15} className="text-amber-600 shrink-0" />
              All workshop notes
              {total > 0 && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{total}</span>}
            </h3>
            <div className="text-[11px] text-text-tertiary truncate">Every Notes &amp; Considerations entry and every answer captured in the room, across all sections.</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {total > 0 && (
              <Button variant="secondary" size="sm" icon={<Copy size={12} />} onClick={copyAll} title="Copy all notes as text">
                {copied ? 'Copied' : 'Copy all'}
              </Button>
            )}
            <Button variant="ghost" size="sm" iconOnly icon={<X size={14} />} title="Close" aria-label="Close" onClick={onClose} />
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {entries.length === 0 ? (
            <div className="text-center py-10">
              <ClipboardList size={32} className="mx-auto text-text-tertiary mb-3" />
              <div className="text-body-md font-semibold text-text-secondary mb-1">No notes captured yet</div>
              <p className="text-body-sm text-text-tertiary max-w-md mx-auto leading-relaxed">
                Notes show up here from two places: the Notes &amp; Considerations block on any section, and the
                answers you capture against a section&apos;s assessment and discovery questions. Open a section and
                start capturing - this view pulls it all together.
              </p>
            </div>
          ) : entries.map((e, i) => {
            const meta = sectionMetaFor(e.item.section_kind)
            return (
              <div key={e.item.id} className="rounded-lg border border-border bg-white shadow-card overflow-hidden">
                <button
                  onClick={onJump ? () => onJump(e.item.id) : undefined}
                  disabled={!onJump}
                  title={onJump ? 'Open this section in the editor' : undefined}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 bg-surface-muted border-b border-border text-left ${onJump ? 'hover:bg-brand-50 transition-colors cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="text-[12px] leading-none" style={{ color: meta.color }}>{meta.icon}</span>
                  <span className="text-body-sm font-medium text-text-primary flex-1 min-w-0 truncate">{i + 1}. {e.item.title}</span>
                  <span className="text-[10px] uppercase tracking-wide shrink-0" style={{ color: meta.color }}>{meta.label}</span>
                </button>
                <div className="px-4 py-3 space-y-3">
                  {e.notes.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wide text-amber-700 mb-1.5">Notes &amp; Considerations</div>
                      <ul className="space-y-1">
                        {e.notes.map((n, j) => (
                          <li key={j} className="text-[11px] text-text-primary leading-snug flex gap-1.5">
                            <span className="shrink-0 text-[#D97706]">▸</span>
                            <span className="flex-1">{n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {e.qa.length > 0 && (
                    <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wide text-emerald-700 mb-1.5 flex items-center gap-1.5">
                        <MessageSquare size={11} /> Answers from the room
                      </div>
                      <div className="space-y-2">
                        {e.qa.map((q, j) => (
                          <div key={j}>
                            <div className="text-[11px] text-text-primary leading-snug flex gap-1.5">
                              <span className="shrink-0" style={{ color: q.bank === 'Assessment questions' ? '#2563EB' : '#D97706' }}>?</span>
                              <span className="flex-1">{q.question}</span>
                            </div>
                            <div className="text-[11px] text-text-secondary leading-snug whitespace-pre-wrap mt-0.5 ml-4 pl-2 border-l-2 border-emerald-200">{q.answer}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
