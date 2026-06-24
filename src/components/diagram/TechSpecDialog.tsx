'use client'

import { useState, useCallback, useMemo } from 'react'
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

  if (!open) return null

  return (
    <div className="fixed inset-0" style={{ zIndex: 9999 }} onClick={close}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 overflow-y-auto flex items-start justify-center py-8 px-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full ${step === 'result' ? 'max-w-4xl' : 'max-w-xl'} bg-[var(--m12-bg-secondary)] border border-[var(--m12-border)]/60 rounded-2xl shadow-2xl my-auto`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--m12-border)]/40">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#06B6D4]/15 text-[#06B6D4]">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M9 1.5H4a1 1 0 00-1 1v11a1 1 0 001 1h8a1 1 0 001-1V5.5L9 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M9 1.5V5.5h4M5.5 8.5h5M5.5 11h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--m12-text)]">Technical Spec</h3>
                <p className="text-[10px] text-[var(--m12-text-muted)]">AI integration functional &amp; technical specification</p>
              </div>
            </div>
            <button onClick={close} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors">
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>

          {/* ─── Scope ─── */}
          {step === 'scope' && (
            <div className="p-6">
              <p className="text-xs text-[var(--m12-text-muted)] mb-4">
                Generate a development-grade specification for the integrations in this diagram. Pick the scope, then answer a few targeted questions so the spec reflects your landscape.
              </p>
              <label className="text-[10px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] block mb-1.5">Scope</label>
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
              <div className="mt-3 text-[11px] text-[var(--m12-text-muted)] bg-[var(--m12-bg)]/60 border border-[var(--m12-border)]/40 rounded-lg px-3 py-2">
                In scope: <strong className="text-[var(--m12-text-secondary)]">{systemsInScope}</strong> systems,{' '}
                <strong className="text-[var(--m12-text-secondary)]">{integrationsInScope}</strong> integrations
                {ctx.integrations.some((i) => i.boundary) && <span> (incl. cross-boundary interfaces)</span>}
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={close} className="px-3 py-2 text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]">Cancel</button>
                <button
                  onClick={fetchQuestions}
                  disabled={systemsInScope === 0}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ─── Loading questions ─── */}
          {step === 'loading-questions' && <LoadingPane label="Examining the systems in play…" />}

          {/* ─── Questions ─── */}
          {step === 'questions' && (
            <div className="p-6">
              <p className="text-xs text-[var(--m12-text-muted)] mb-4">
                A few details sharpen the spec. Answer what you know — pick a suggestion or type your own. Anything left blank is treated as an explicit assumption.
              </p>
              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {questions.length === 0 && (
                  <p className="text-xs text-[var(--m12-text-muted)] italic">No clarifying questions — the diagram already has enough detail. You can generate the spec directly.</p>
                )}
                {questions.map((q, idx) => (
                  <div key={q.id} className="border border-[var(--m12-border)]/40 rounded-xl p-3.5 bg-[var(--m12-bg)]/40">
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-[9px] font-bold text-[#06B6D4] mt-0.5 font-[family-name:var(--font-space-mono)]">{String(idx + 1).padStart(2, '0')}</span>
                      <div className="flex-1">
                        <div className="text-[9px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] mb-0.5">{q.category}</div>
                        <div className="text-xs font-medium text-[var(--m12-text)]">{q.question}</div>
                        {q.why && <div className="text-[10px] text-[var(--m12-text-muted)] mt-0.5">{q.why}</div>}
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
                                  ? 'bg-[#2563EB]/20 text-[#60a5fa] border-[#2563EB]/50'
                                  : 'bg-[var(--m12-bg)] text-[var(--m12-text-muted)] border-[var(--m12-border)]/50 hover:text-[var(--m12-text-secondary)] hover:border-[var(--m12-border)]'
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
                      className="w-full ml-6 mr-0 px-2.5 py-1.5 text-xs rounded-lg bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 text-[var(--m12-text)] placeholder:text-[var(--m12-text-muted)] focus:outline-none focus:border-[#2563EB]/60"
                      style={{ width: 'calc(100% - 1.5rem)' }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center gap-2 mt-5">
                <button onClick={() => setStep('scope')} className="px-3 py-2 text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]">← Back</button>
                <button
                  onClick={generate}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors"
                >
                  Generate Technical Spec
                </button>
              </div>
            </div>
          )}

          {/* ─── Loading spec ─── */}
          {step === 'loading-spec' && <LoadingPane label="Drafting the functional &amp; technical specification…" hint="Mapping integrations, options analysis, and best practices" />}

          {/* ─── Result ─── */}
          {step === 'result' && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="text-[11px] text-[var(--m12-text-muted)]">
                  <span className="text-[var(--m12-text-secondary)] font-medium">{specTitle}</span> · {integrationsInScope} integrations
                </div>
                <div className="flex items-center gap-1.5">
                  <ActionBtn onClick={() => downloadSpecMarkdown(markdown, specTitle)} label="Markdown" />
                  <ActionBtn onClick={() => downloadSpecWord(markdown, specTitle)} label="Word (.doc)" />
                  <ActionBtn onClick={() => printSpec(markdown, specTitle)} label="Print / PDF" />
                  <ActionBtn onClick={copyMarkdown} label={copied ? 'Copied ✓' : 'Copy'} />
                </div>
              </div>
              <div
                className="bg-white rounded-xl border border-[var(--m12-border)]/40 overflow-y-auto px-8 py-6 tech-spec-doc"
                style={{ maxHeight: '60vh' }}
                dangerouslySetInnerHTML={{ __html: docHtml }}
              />
              <div className="flex justify-between items-center mt-4">
                <button onClick={() => setStep('questions')} className="px-3 py-2 text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]">← Edit answers</button>
                <div className="flex gap-2">
                  <button onClick={generate} className="px-3 py-2 text-xs text-[var(--m12-text-secondary)] hover:text-[var(--m12-text)] border border-[var(--m12-border)]/50 rounded-lg">Regenerate</button>
                  <button onClick={close} className="px-4 py-2 text-xs font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors">Done</button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Error ─── */}
          {step === 'error' && (
            <div className="p-6">
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 mb-4">{error}</div>
              <div className="flex justify-end gap-2">
                <button onClick={reset} className="px-3 py-2 text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]">Start over</button>
                <button onClick={markdown ? () => setStep('result') : fetchQuestions} className="px-4 py-2 text-xs font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors">Retry</button>
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
    </div>
  )
}

function ScopeOption({ active, onClick, title, subtitle, color }: { active: boolean; onClick: () => void; title: string; subtitle: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
        active
          ? 'bg-[#2563EB]/15 border-[#2563EB]/50'
          : 'bg-[var(--m12-bg)] border-[var(--m12-border)]/40 hover:border-[var(--m12-border)]'
      }`}
    >
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color || '#64748B' }} />
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium ${active ? 'text-[var(--m12-text)]' : 'text-[var(--m12-text-secondary)]'}`}>{title}</div>
        <div className="text-[10px] text-[var(--m12-text-muted)]">{subtitle}</div>
      </div>
      {active && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[#2563EB]"><path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </button>
  )
}

function ActionBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg text-[var(--m12-text-secondary)] hover:text-[var(--m12-text)] bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 hover:border-[var(--m12-border)] transition-colors"
    >
      {label}
    </button>
  )
}

function LoadingPane({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="p-10 flex flex-col items-center justify-center text-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#06B6D4]/30 border-t-[#06B6D4] animate-spin mb-4" />
      <div className="text-xs text-[var(--m12-text-secondary)] font-medium">{label}</div>
      {hint && <div className="text-[10px] text-[var(--m12-text-muted)] mt-1">{hint}</div>}
    </div>
  )
}
