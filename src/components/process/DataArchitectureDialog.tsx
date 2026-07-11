'use client'

// Guided data-architecture generation for a workstream:
//   1. Select which L3 process flow(s) to build for (one, many, or all). Rows show
//      whether each is buildable and whether a data architecture already exists.
//   2. Answer any clarifying questions the AI needs.
//   3. Generate one diagram per selected L3 flow, with progress + Open links.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/common'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[40rem] max-w-[94vw] max-h-[85vh] flex flex-col bg-white border border-border rounded-xl shadow-card-hover overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="min-w-0">
            <h3 className="text-heading-sm font-display text-text-primary truncate">Generate data architecture</h3>
            <div className="text-[11px] text-text-tertiary truncate">{workstream.name}</div>
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={16} />} title="Close" aria-label="Close" onClick={onClose} />
        </div>

        {error && <div className="mx-5 mt-3 text-body-sm text-status-red bg-status-red-bg border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        {/* Select phase */}
        {phase === 'select' && (
          <>
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <div className="text-[11px] text-text-tertiary">Pick the L3 process flow(s) to build a data architecture for.</div>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={selectAllBuildable}>All buildable</Button>
                <Button variant="secondary" size="sm" onClick={clearAll}>Clear</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
              {loading ? (
                <div className="flex flex-col items-center justify-center text-center py-10">
                  <Loader2 className="animate-spin text-text-tertiary mb-3 size-5" />
                  <span className="text-body-sm text-text-tertiary">Loading process flows...</span>
                </div>
              ) : processes.length === 0 ? (
                <div className="text-center py-10 text-body-sm text-text-tertiary">No L3 process flows are aligned to this workstream yet.</div>
              ) : (
                processes.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border transition-colors ${p.buildable ? 'cursor-pointer hover:border-border-strong' : 'opacity-70'} ${selected.has(p.id) ? '' : 'border-border'}`}
                    style={selected.has(p.id) ? { borderColor: color } : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      disabled={!p.buildable}
                      onChange={() => toggle(p.id)}
                      className="mt-0.5 accent-brand-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-body-sm text-text-primary">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Chip className="bg-status-blue-bg text-status-blue">{p.capabilityCount} capabilit{p.capabilityCount === 1 ? 'y' : 'ies'}</Chip>
                        {p.hasSystemLanes && <Chip className="bg-purple-50 text-purple-700">swimlane systems</Chip>}
                        {p.existingDiagramId ? (
                          <button type="button" onClick={(e) => { e.preventDefault(); open(p.existingDiagramId!) }} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-status-green-bg text-status-green hover:bg-green-100 transition-colors">
                            <Check size={10} /> Has data architecture · Open
                          </button>
                        ) : !p.buildable ? (
                          <span className="text-[10px] text-status-yellow">Assign capabilities or bind swimlanes to systems first</span>
                        ) : (
                          <Chip className="bg-gray-100 text-gray-500">Not generated</Chip>
                        )}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t border-border flex items-center gap-2">
              <div className="text-[11px] text-text-tertiary">{selected.size} selected</div>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" loading={preparing} disabled={selected.size === 0} onClick={toQuestions}>
                  {preparing ? 'Preparing...' : 'Continue'}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Questions phase */}
        {phase === 'questions' && (
          <>
            <div className="px-5 py-3 border-b border-border text-[11px] text-text-tertiary">
              A few clarifying questions to build a sharper data architecture for the {selectedList.length} selected flow(s). Answer what you can; all are optional.
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {questions.map((q) => (
                <div key={q.id}>
                  <div className="text-body-sm text-text-primary leading-snug">{q.question}</div>
                  {q.why && <div className="text-[10px] text-text-tertiary mb-1">{q.why}</div>}
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    rows={2}
                    placeholder="Your answer (optional)"
                    className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none resize-none mt-1"
                  />
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPhase('select')}>Back</Button>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => runGeneration([])}>Skip</Button>
                <Button variant="ai" size="sm" icon={<Sparkles size={12} />} onClick={() => runGeneration(answeredList())}>
                  Generate {selectedList.length} diagram{selectedList.length === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Run phase */}
        {phase === 'run' && (
          <>
            <div className="px-5 py-3 border-b border-border text-[11px] text-text-tertiary">
              {runDone ? `Generated ${doneOk.length} of ${selectedList.length} diagram(s).` : 'Generating data architecture...'}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
              {selectedList.map((p) => {
                const r = results[p.id] || { status: 'pending' as const }
                return (
                  <div key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border">
                    <StatusDot status={r.status} />
                    <div className="min-w-0 flex-1">
                      <div className="text-body-sm text-text-primary truncate">{r.title || p.name}</div>
                      {r.status === 'error' && <div className="text-[10px] text-status-red">{r.error}</div>}
                    </div>
                    {r.status === 'done' && r.diagramId && (
                      <Button size="sm" onClick={() => open(r.diagramId!)}>Open</Button>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
              {runDone && doneOk.length === 1 && doneOk[0].diagramId && (
                <Button size="sm" onClick={() => open(doneOk[0].diagramId!)}>Open diagram</Button>
              )}
              <Button variant="secondary" size="sm" disabled={!runDone} onClick={onClose}>
                {runDone ? 'Done' : 'Working...'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${className}`}>{children}</span>
}

function StatusDot({ status }: { status: RunStatus['status'] }) {
  if (status === 'busy') return <Loader2 size={14} className="animate-spin text-brand-500 shrink-0" />
  if (status === 'done') return <Check size={14} className="text-status-green shrink-0" />
  if (status === 'error') return <X size={14} className="text-status-red shrink-0" />
  return <span className="inline-block w-3 h-3 rounded-full bg-border-strong shrink-0" />
}
