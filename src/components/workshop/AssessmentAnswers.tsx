'use client'

// Capture the facilitator's answers to an assessment section's assessment +
// discovery questions. Answers are stored as app-level fields on the SAME content
// row the AI writes (via the host's onSave), and are fed back into the AI
// Opportunity Roadmap synthesis so the roadmap reflects what the room actually
// said. Shown on assessment sections in the prep editor; it carries no AI
// controls, so it stays visible in Client View (it is real input, not scaffolding).

import { useRef, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import type { SectionContent } from '@jlee-revtech/agent-core'
import { readAssessmentAnswers, type AssessmentAnswers as AssessmentAnswersValue } from '@/lib/workshop/assessmentAnswers'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function AssessmentAnswers({ content, onSave }: {
  content: SectionContent
  // Persist the merged answers back to the content row. The host owns the write
  // (it holds workshopId / agendaItemId and updates its local view + parent).
  onSave: (patch: AssessmentAnswersValue) => Promise<void>
}) {
  // Keep the FULL question arrays (no filtering) so answers[i] stays aligned to
  // questions[i] here, in state, and in the persisted arrays the roadmap synthesis
  // pairs by index. Blank questions are skipped at render time, keeping the index.
  const c = content as unknown as { assessmentQuestions?: string[]; discoveryQuestions?: string[] }
  const assessmentQuestions = (c.assessmentQuestions || []).map((q) => q ?? '')
  const discoveryQuestions = (c.discoveryQuestions || []).map((q) => q ?? '')
  const anyQuestions = assessmentQuestions.some((q) => q.trim()) || discoveryQuestions.some((q) => q.trim())

  // Seed once from the persisted answers (aligned to the current question counts).
  const [answers, setAnswers] = useState<AssessmentAnswersValue>(() => readAssessmentAnswers(content))
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef<AssessmentAnswersValue>(answers)

  const queueSave = (next: AssessmentAnswersValue) => {
    latestRef.current = next
    setStatus('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        await onSave(latestRef.current)
        setStatus('saved')
      } catch {
        setStatus('error')
      }
    }, 700)
  }

  const setAnswer = (bank: keyof AssessmentAnswersValue, i: number, value: string) => {
    setAnswers((prev) => {
      const arr = prev[bank].slice()
      while (arr.length <= i) arr.push('')
      arr[i] = value
      const next = { ...prev, [bank]: arr }
      queueSave(next)
      return next
    })
  }

  if (!anyQuestions) return null

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wide text-emerald-700 flex items-center gap-1.5">
          <MessageSquare size={12} /> Answers from the room
        </div>
        <SavePill status={status} />
      </div>
      <p className="text-[10px] text-text-tertiary leading-snug -mt-1">
        Capture what the customer says. These answers are read into the Opportunity Roadmap synthesis, so the roadmap
        reflects the real current state and pain, not just the drafted opportunities. Regenerate the roadmap after
        answering.
      </p>

      {assessmentQuestions.some((q) => q.trim()) && (
        <QuestionBank
          label="Assessment questions"
          color="#2563EB"
          questions={assessmentQuestions}
          answers={answers.assessmentAnswers}
          onAnswer={(i, v) => setAnswer('assessmentAnswers', i, v)}
        />
      )}
      {discoveryQuestions.some((q) => q.trim()) && (
        <QuestionBank
          label="Discovery questions"
          color="#D97706"
          questions={discoveryQuestions}
          answers={answers.discoveryAnswers}
          onAnswer={(i, v) => setAnswer('discoveryAnswers', i, v)}
        />
      )}
    </div>
  )
}

function QuestionBank({ label, color, questions, answers, onAnswer }: {
  label: string; color: string; questions: string[]; answers: string[]
  onAnswer: (i: number, value: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wide" style={{ color }}>{label}</div>
      <div className="space-y-2.5">
        {questions.map((q, i) => (q.trim() ? (
          <div key={i}>
            <div className="text-[11px] text-text-primary leading-snug flex gap-1.5">
              <span className="shrink-0" style={{ color }}>?</span>
              <span className="flex-1">{q}</span>
            </div>
            <textarea
              value={answers[i] || ''}
              onChange={(e) => onAnswer(i, e.target.value)}
              rows={2}
              placeholder="What the room said..."
              className="mt-1 w-full bg-surface-input border border-border rounded px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none leading-snug"
            />
          </div>
        ) : null))}
      </div>
    </div>
  )
}

function SavePill({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  if (status === 'saving') {
    return (
      <span className="text-[10px] text-text-tertiary flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 border-2 border-border border-t-brand-500 rounded-full animate-spin" />Saving...
      </span>
    )
  }
  if (status === 'saved') return <span className="text-[10px] text-status-green">✓ Answers saved</span>
  return <span className="text-[10px] text-red-600">Save failed</span>
}
