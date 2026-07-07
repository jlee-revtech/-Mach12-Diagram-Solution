'use client'

// Guided data-architecture generation for a workstream:
//   1. Select which L3 process flow(s) to build for (one, many, or all). Rows show
//      whether each is buildable and whether a data architecture already exists.
//   2. Answer any clarifying questions the AI needs.
//   3. Generate one diagram per selected L3 flow, with progress + Open links.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  listWorkstreamDataArchProcesses, clarifyDataArchitecture, generateWorkstreamDataArchitecture,
  type DataArchProcess, type ClarifyingQuestion,
} from '@/lib/process/generateDataArchitecture'

type RunStatus = { status: 'pending' | 'busy' | 'done' | 'error'; diagramId?: string; title?: string; error?: string }

export default function DataArchitectureDialog({
  orgId, userId, workstream, onClose,
}: {
  orgId: string
  userId: string
  workstream: { id: string; name: string; color?: string }
  onClose: () => void
}) {
  const router = useRouter()
  const color = workstream.color || '#2563EB'

  const [phase, setPhase] = useState<'select' | 'questions' | 'run'>('select')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processes, setProcesses] = useState<DataArchProcess[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preparing, setPreparing] = useState(false)
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, RunStatus>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listWorkstreamDataArchProcesses(orgId, workstream.id)
      .then((ps) => {
        if (cancelled) return
        setProcesses(ps)
        // Default: pre-select buildable flows that don't yet have a data architecture.
        setSelected(new Set(ps.filter((p) => p.buildable && !p.existingDiagramId).map((p) => p.id)))
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load process flows') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orgId, workstream.id])

  const buildable = processes.filter((p) => p.buildable)
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const selectAllBuildable = () => setSelected(new Set(buildable.map((p) => p.id)))
  const clearAll = () => setSelected(new Set())
  const selectedList = processes.filter((p) => selected.has(p.id))
  const answeredList = (): { question: string; answer: string }[] =>
    questions.map((q) => ({ question: q.question, answer: (answers[q.id] || '').trim() })).filter((a) => a.answer)

  // Select -> clarify -> questions (or straight to run when none needed).
  const toQuestions = useCallback(async () => {
    if (selected.size === 0) return
    setPreparing(true)
    setError(null)
    try {
      const qs = await clarifyDataArchitecture(orgId, workstream.id, Array.from(selected)).catch(() => [])
      setQuestions(qs)
      if (qs.length === 0) { await runGeneration([]) } else { setPhase('questions') }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to prepare')
    } finally {
      setPreparing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, orgId, workstream.id])

  // Generate one diagram per selected L3, with small concurrency, honoring answers.
  const runGeneration = useCallback(async (clarificationAnswers: { question: string; answer: string }[]) => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setPhase('run')
    setResults(Object.fromEntries(ids.map((id) => [id, { status: 'pending' as const }])))
    const queue = [...ids]
    const worker = async () => {
      for (;;) {
        const id = queue.shift()
        if (!id) return
        setResults((r) => ({ ...r, [id]: { status: 'busy' } }))
        try {
          const res = await generateWorkstreamDataArchitecture(orgId, workstream.id, userId, [id], clarificationAnswers)
          setResults((r) => ({ ...r, [id]: { status: 'done', diagramId: res.diagramId, title: res.title } }))
        } catch (e) {
          setResults((r) => ({ ...r, [id]: { status: 'error', error: e instanceof Error ? e.message : 'Failed' } }))
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(2, ids.length) }, () => worker()))
  }, [selected, orgId, workstream.id, userId])

  const open = (diagramId: string) => { onClose(); router.push(`/diagram/${diagramId}`) }

  const runDone = phase === 'run' && Object.values(results).every((r) => r.status === 'done' || r.status === 'error')
  const doneOk = Object.values(results).filter((r) => r.status === 'done')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[40rem] max-w-[94vw] max-h-[85vh] flex flex-col bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--m12-border)]/40">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--m12-text)] truncate">Generate data architecture</h3>
            <div className="text-[11px] text-[var(--m12-text-muted)] truncate">{workstream.name}</div>
          </div>
          <button type="button" onClick={onClose} title="Close" aria-label="Close" className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </div>

        {error && <div className="mx-5 mt-3 text-[11px] text-[#EF4444] bg-[#DC262614] border border-[#DC2626]/30 rounded-lg px-3 py-2">{error}</div>}

        {/* ─── Select phase ─── */}
        {phase === 'select' && (
          <>
            <div className="px-5 py-3 border-b border-[var(--m12-border)]/30 flex items-center gap-2">
              <div className="text-[11px] text-[var(--m12-text-muted)]">Pick the L3 process flow(s) to build a data architecture for.</div>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={selectAllBuildable} className="text-[10px] px-2 py-1 rounded border border-[var(--m12-border)]/50 text-[var(--m12-text-secondary)] hover:border-[var(--m12-border)]">All buildable</button>
                <button type="button" onClick={clearAll} className="text-[10px] px-2 py-1 rounded border border-[var(--m12-border)]/50 text-[var(--m12-text-secondary)] hover:border-[var(--m12-border)]">Clear</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
              {loading ? (
                <div className="text-center py-10 text-xs text-[var(--m12-text-muted)]">Loading process flows…</div>
              ) : processes.length === 0 ? (
                <div className="text-center py-10 text-xs text-[var(--m12-text-muted)]">No L3 process flows are aligned to this workstream yet.</div>
              ) : (
                processes.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border transition-colors ${p.buildable ? 'cursor-pointer hover:border-[var(--m12-border)]' : 'opacity-70'}`}
                    style={{ borderColor: selected.has(p.id) ? color : 'var(--m12-border)' }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      disabled={!p.buildable}
                      onChange={() => toggle(p.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-[var(--m12-text)]">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge color="#0EA5E9">{p.capabilityCount} capabilit{p.capabilityCount === 1 ? 'y' : 'ies'}</Badge>
                        {p.hasSystemLanes && <Badge color="#8B5CF6">swimlane systems</Badge>}
                        {p.existingDiagramId ? (
                          <button type="button" onClick={(e) => { e.preventDefault(); open(p.existingDiagramId!) }} className="text-[9px] px-1.5 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] hover:bg-[#10B981]/25">✓ Has data architecture · Open</button>
                        ) : !p.buildable ? (
                          <span className="text-[9px] text-[#D97706]">Assign capabilities or bind swimlanes to systems first</span>
                        ) : (
                          <Badge color="#64748B">Not generated</Badge>
                        )}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t border-[var(--m12-border)]/40 flex items-center gap-2">
              <div className="text-[11px] text-[var(--m12-text-muted)]">{selected.size} selected</div>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={onClose} className="text-[11px] px-3 py-1.5 rounded-lg border border-[var(--m12-border)]/50 text-[var(--m12-text-secondary)] hover:border-[var(--m12-border)]">Cancel</button>
                <button type="button" onClick={toQuestions} disabled={selected.size === 0 || preparing} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50" style={{ backgroundColor: color }}>
                  {preparing ? 'Preparing…' : 'Continue'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── Questions phase ─── */}
        {phase === 'questions' && (
          <>
            <div className="px-5 py-3 border-b border-[var(--m12-border)]/30 text-[11px] text-[var(--m12-text-muted)]">
              A few clarifying questions to build a sharper data architecture for the {selectedList.length} selected flow(s). Answer what you can; all are optional.
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {questions.map((q) => (
                <div key={q.id}>
                  <div className="text-[12px] text-[var(--m12-text)] leading-snug">{q.question}</div>
                  {q.why && <div className="text-[10px] text-[var(--m12-text-muted)] mb-1">{q.why}</div>}
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    rows={2}
                    placeholder="Your answer (optional)"
                    className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 focus:border-[#2563EB] rounded-lg px-2.5 py-1.5 text-xs text-[var(--m12-text)] outline-none resize-none mt-1"
                  />
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-[var(--m12-border)]/40 flex items-center gap-2">
              <button type="button" onClick={() => setPhase('select')} className="text-[11px] px-3 py-1.5 rounded-lg border border-[var(--m12-border)]/50 text-[var(--m12-text-secondary)] hover:border-[var(--m12-border)]">Back</button>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={() => runGeneration([])} className="text-[11px] px-3 py-1.5 rounded-lg border border-[var(--m12-border)]/50 text-[var(--m12-text-secondary)] hover:border-[var(--m12-border)]">Skip</button>
                <button type="button" onClick={() => runGeneration(answeredList())} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ backgroundColor: color }}>
                  Generate {selectedList.length} diagram{selectedList.length === 1 ? '' : 's'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── Run phase ─── */}
        {phase === 'run' && (
          <>
            <div className="px-5 py-3 border-b border-[var(--m12-border)]/30 text-[11px] text-[var(--m12-text-muted)]">
              {runDone ? `Generated ${doneOk.length} of ${selectedList.length} diagram(s).` : 'Generating data architecture…'}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
              {selectedList.map((p) => {
                const r = results[p.id] || { status: 'pending' as const }
                return (
                  <div key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[var(--m12-border)]/40">
                    <StatusDot status={r.status} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-[var(--m12-text)] truncate">{r.title || p.name}</div>
                      {r.status === 'error' && <div className="text-[10px] text-[#EF4444]">{r.error}</div>}
                    </div>
                    {r.status === 'done' && r.diagramId && (
                      <button type="button" onClick={() => open(r.diagramId!)} className="text-[10px] px-2 py-1 rounded font-medium text-white" style={{ backgroundColor: color }}>Open</button>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3 border-t border-[var(--m12-border)]/40 flex items-center justify-end gap-2">
              {runDone && doneOk.length === 1 && doneOk[0].diagramId && (
                <button type="button" onClick={() => open(doneOk[0].diagramId!)} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ backgroundColor: color }}>Open diagram</button>
              )}
              <button type="button" onClick={onClose} disabled={!runDone} className="text-[11px] px-3 py-1.5 rounded-lg border border-[var(--m12-border)]/50 text-[var(--m12-text-secondary)] hover:border-[var(--m12-border)] disabled:opacity-50">
                {runDone ? 'Done' : 'Working…'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}1A`, color }}>{children}</span>
}

function StatusDot({ status }: { status: RunStatus['status'] }) {
  if (status === 'busy') return <span className="inline-block w-3.5 h-3.5 border-2 border-[var(--m12-border)] border-t-[#2563EB] rounded-full animate-spin shrink-0" />
  if (status === 'done') return <span className="text-[#10B981] shrink-0">✓</span>
  if (status === 'error') return <span className="text-[#EF4444] shrink-0">✕</span>
  return <span className="inline-block w-3 h-3 rounded-full bg-[var(--m12-border)] shrink-0" />
}
