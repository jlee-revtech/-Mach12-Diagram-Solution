'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, FileText, Loader2, X } from 'lucide-react'
import { Button } from '@/components/common'
import { useDiagramStore } from '@/lib/diagram/store'
import {
  buildTechSpecContext,
  markdownToHtml,
  downloadSpecMarkdown,
  downloadSpecWord,
  printSpec,
  type TechSpecScope,
} from '@/lib/export/techSpec'

interface TechSpecDialogProps {
  open: boolean
  onClose: () => void
}

interface SpecQuestion {
  id: string
  category: string
  question: string
  why?: string
  suggestions?: string[]
  allowMultiple?: boolean
}

type Step = 'scope' | 'loading-questions' | 'questions' | 'loading-spec' | 'result' | 'error'

export default function TechSpecDialog({ open, onClose }: TechSpecDialogProps) {
  const meta = useDiagramStore((s) => s.meta)
  const nodes = useDiagramStore((s) => s.nodes)
  const edges = useDiagramStore((s) => s.edges)
  const groups = useDiagramStore((s) => s.groups)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [step, setStep] = useState<Step>('scope')
  const [scopeKey, setScopeKey] = useState<string>('__diagram__')
  const [questions, setQuestions] = useState<SpecQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [markdown, setMarkdown] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const scope: TechSpecScope = useMemo(() => {
    if (scopeKey === '__diagram__') return { kind: 'diagram' }
    const g = groups.find((gr) => gr.id === scopeKey)
    return g ? { kind: 'group', groupId: g.id, groupLabel: g.data.label || 'Group' } : { kind: 'diagram' }
  }, [scopeKey, groups])

  const ctx = useMemo(
    () => buildTechSpecContext({ meta, nodes, edges, groups, scope }),
    [meta, nodes, edges, groups, scope],
  )

  const reset = useCallback(() => {
    setStep('scope')
    setQuestions([])
    setAnswers({})
    setMarkdown('')
    setError('')
  }, [])

  const close = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const fetchQuestions = useCallback(async () => {
    setStep('loading-questions')
    setError('')
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tech-spec-questions', context: { spec: ctx } }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to prepare questions')
      setQuestions(Array.isArray(data.questions) ? data.questions : [])
      setStep('questions')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to prepare questions')
      setStep('error')
    }
  }, [ctx])

  const generate = useCallback(async () => {
    setStep('loading-spec')
    setError('')
    try {
      const answerPayload = questions.map((q) => ({
        questionId: q.id,
        question: q.question,
        category: q.category,
        answer: answers[q.id] ?? '',
      }))
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tech-spec-generate', context: { spec: ctx, answers: answerPayload } }),
      })
      const data = await res.json()
      if (!res.ok || data.error || !data.markdown) throw new Error(data.error || 'Failed to generate spec')
      setMarkdown(data.markdown)
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate spec')
      setStep('error')
    }
  }, [ctx, questions, answers])

  const setAnswer = (id: string, value: string) => setAnswers((p) => ({ ...p, [id]: value }))

  const toggleSuggestion = (q: SpecQuestion, suggestion: string) => {
    if (q.allowMultiple) {
      const cur = (answers[q.id] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      const next = cur.includes(suggestion) ? cur.filter((s) => s !== suggestion) : [...cur, suggestion]
      setAnswer(q.id, next.join(', '))
    } else {
      setAnswer(q.id, answers[q.id] === suggestion ? '' : suggestion)
    }
  }

  const specTitle = scope.kind === 'group' ? `${meta.title} — ${scope.groupLabel}` : meta.title
  const docHtml = useMemo(() => (markdown ? markdownToHtml(markdown) : ''), [markdown])
  const systemsInScope = ctx.systems.filter((s) => s.inScope).length
  const integrationsInScope = ctx.integrations.length

  const copyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked — ignore */ }
  }, [markdown])

  if (!open || !mounted) return null

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 9999 }} onClick={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 overflow-y-auto flex items-start justify-center py-8 px-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full ${step === 'result' ? 'max-w-4xl' : 'max-w-xl'} bg-white rounded-xl shadow-card-hover my-auto`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-50 text-brand-600">
                <FileText size={15} />
              </span>
              <div>
                <h3 className="text-heading-sm font-display text-text-primary">Technical Spec</h3>
                <p className="text-[10px] text-text-tertiary">AI integration functional &amp; technical specification</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<X size={16} />}
              aria-label="Close"
              title="Close"
              onClick={close}
            />
          </div>

          {/* ─── Scope ─── */}
          {step === 'scope' && (
            <div className="p-6">
              <p className="text-body-sm text-text-secondary mb-4">
                Generate a development-grade specification for the integrations in this diagram. Pick the scope, then answer a few targeted questions so the spec reflects your landscape.
              </p>
              <label className="text-label uppercase text-text-secondary block mb-1.5">Scope</label>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                <ScopeOption
                  active={scopeKey === '__diagram__'}
                  onClick={() => setScopeKey('__diagram__')}
                  title="Entire Diagram"
                  subtitle={`${nodes.length} systems · ${edges.length} integrations`}
                />
                {groups.map((g) => (
                  <ScopeOption
                    key={g.id}
                    active={scopeKey === g.id}
                    onClick={() => setScopeKey(g.id)}
                    color={g.data.color}
                    title={g.data.label || 'Group'}
                    subtitle="Group / workstream band"
                  />
                ))}
              </div>
              <div className="mt-3 text-[11px] text-text-secondary bg-surface-muted border border-border rounded-lg px-3 py-2">
                In scope: <strong className="text-text-primary">{systemsInScope}</strong> systems,{' '}
                <strong className="text-text-primary">{integrationsInScope}</strong> integrations
                {ctx.integrations.some((i) => i.boundary) && <span> (incl. cross-boundary interfaces)</span>}
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="ghost" size="md" onClick={close}>Cancel</Button>
                <Button
                  variant="primary"
                  size="md"
                  disabled={systemsInScope === 0}
                  onClick={fetchQuestions}
                >
                  Continue →
                </Button>
              </div>
            </div>
          )}

          {/* ─── Loading questions ─── */}
          {step === 'loading-questions' && <LoadingPane label="Examining the systems in play…" />}

          {/* ─── Questions ─── */}
          {step === 'questions' && (
            <div className="p-6">
              <p className="text-body-sm text-text-secondary mb-4">
                A few details sharpen the spec. Answer what you know - pick a suggestion or type your own. Anything left blank is treated as an explicit assumption.
              </p>
              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {questions.length === 0 && (
                  <p className="text-body-sm text-text-tertiary italic">No clarifying questions - the diagram already has enough detail. You can generate the spec directly.</p>
                )}
                {questions.map((q, idx) => (
                  <div key={q.id} className="border border-border rounded-xl p-3.5 bg-surface-muted">
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-[10px] font-bold text-brand-600 mt-0.5 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                      <div className="flex-1">
                        <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-0.5">{q.category}</div>
                        <div className="text-body-sm font-medium text-text-primary">{q.question}</div>
                        {q.why && <div className="text-[10px] text-text-tertiary mt-0.5">{q.why}</div>}
                      </div>
                    </div>
                    {q.suggestions && q.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 my-2 pl-6">
                        {q.suggestions.map((s) => {
                          const sel = q.allowMultiple
                            ? (answers[q.id] ?? '').split(',').map((x) => x.trim()).includes(s)
                            : answers[q.id] === s
                          return (
                            <button
                              key={s}
                              onClick={() => toggleSuggestion(q, s)}
                              className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                                sel
                                  ? 'bg-brand-50 text-brand-700 border-brand-300'
                                  : 'bg-white text-text-secondary border-border hover:text-text-primary hover:border-border-strong'
                              }`}
                            >
                              {s}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <input
                      type="text"
                      value={answers[q.id] ?? ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder="Type an answer, or leave blank for an assumption…"
                      className="ml-6 mr-0 h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none"
                      style={{ width: 'calc(100% - 1.5rem)' }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center gap-2 mt-5">
                <Button variant="ghost" size="md" onClick={() => setStep('scope')}>← Back</Button>
                <Button variant="primary" size="md" onClick={generate}>
                  Generate Technical Spec
                </Button>
              </div>
            </div>
          )}

          {/* ─── Loading spec ─── */}
          {step === 'loading-spec' && <LoadingPane label="Drafting the functional &amp; technical specification…" hint="Mapping integrations, options analysis, and best practices" />}

          {/* ─── Result ─── */}
          {step === 'result' && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="text-[11px] text-text-tertiary">
                  <span className="text-text-primary font-medium">{specTitle}</span> · {integrationsInScope} integrations
                </div>
                <div className="flex items-center gap-1.5">
                  <ActionBtn onClick={() => downloadSpecMarkdown(markdown, specTitle)} label="Markdown" />
                  <ActionBtn onClick={() => downloadSpecWord(markdown, specTitle)} label="Word (.doc)" />
                  <ActionBtn onClick={() => printSpec(markdown, specTitle)} label="Print / PDF" />
                  <ActionBtn onClick={copyMarkdown} label={copied ? 'Copied ✓' : 'Copy'} />
                </div>
              </div>
              <div
                className="bg-white rounded-xl border border-border overflow-y-auto px-8 py-6 tech-spec-doc"
                style={{ maxHeight: '60vh' }}
                dangerouslySetInnerHTML={{ __html: docHtml }}
              />
              <div className="flex justify-between items-center mt-4">
                <Button variant="ghost" size="md" onClick={() => setStep('questions')}>← Edit answers</Button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="md" onClick={generate}>Regenerate</Button>
                  <Button variant="primary" size="md" onClick={close}>Done</Button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Error ─── */}
          {step === 'error' && (
            <div className="p-6">
              <div className="text-body-sm text-status-red bg-status-red-bg border border-red-200 rounded-lg px-3 py-2.5 mb-4">{error}</div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="md" onClick={reset}>Start over</Button>
                <Button variant="primary" size="md" onClick={markdown ? () => setStep('result') : fetchQuestions}>Retry</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scoped styling for the rendered spec preview (light document on dark UI). */}
      <style jsx global>{`
        .tech-spec-doc { color: #1f2937; line-height: 1.5; }
        .tech-spec-doc h1 { font-size: 20px; font-weight: 700; color: #0f172a; border-bottom: 3px solid #2563EB; padding-bottom: 6px; margin: 0 0 6px; }
        .tech-spec-doc h2 { font-size: 16px; font-weight: 700; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin: 20px 0 7px; }
        .tech-spec-doc h3 { font-size: 14px; font-weight: 600; color: #1e40af; margin: 15px 0 5px; }
        .tech-spec-doc h4 { font-size: 12.5px; font-weight: 600; color: #334155; margin: 11px 0 4px; }
        .tech-spec-doc p, .tech-spec-doc li { font-size: 12px; margin: 5px 0; }
        .tech-spec-doc table { border-collapse: collapse; width: 100%; margin: 9px 0; font-size: 11px; }
        .tech-spec-doc th, .tech-spec-doc td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; vertical-align: top; }
        .tech-spec-doc th { background: #eff6ff; color: #1e3a8a; font-weight: 600; }
        .tech-spec-doc tr:nth-child(even) td { background: #f8fafc; }
        .tech-spec-doc code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-family: 'Consolas', monospace; font-size: 10.5px; color: #be185d; }
        .tech-spec-doc blockquote { border-left: 3px solid #93c5fd; margin: 7px 0; padding: 3px 12px; color: #475569; background: #f8fafc; }
        .tech-spec-doc hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
        .tech-spec-doc ul, .tech-spec-doc ol { margin: 5px 0 5px 2px; padding-left: 20px; }
        .tech-spec-doc a { color: #2563EB; }
      `}</style>
    </div>,
    document.body,
  )
}

function ScopeOption({ active, onClick, title, subtitle, color }: { active: boolean; onClick: () => void; title: string; subtitle: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
        active
          ? 'bg-brand-50 border-brand-300'
          : 'bg-white border-border hover:border-border-strong hover:bg-surface-muted'
      }`}
    >
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color || '#64748B' }} />
      <div className="flex-1 min-w-0">
        <div className={`text-body-sm font-medium ${active ? 'text-text-primary' : 'text-text-secondary'}`}>{title}</div>
        <div className="text-[10px] text-text-tertiary">{subtitle}</div>
      </div>
      {active && <Check size={14} className="text-brand-600" />}
    </button>
  )
}

function ActionBtn({ onClick, label, icon }: { onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <Button variant="secondary" size="sm" icon={icon} onClick={onClick}>
      {label}
    </Button>
  )
}

function LoadingPane({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="p-10 flex flex-col items-center justify-center text-center">
      <Loader2 size={32} className="animate-spin text-brand-500 mb-4" />
      <div className="text-body-sm text-text-secondary font-medium">{label}</div>
      {hint && <div className="text-[10px] text-text-tertiary mt-1">{hint}</div>}
    </div>
  )
}
