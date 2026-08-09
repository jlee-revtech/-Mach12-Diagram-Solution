'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowUpRight, BookOpen, Check, FileText, MessagesSquare, Star, Trash2, X,
} from 'lucide-react'
import { Button, CollapsibleSection, EmptyState } from '@/components/common'
import {
  createDesignSession, updateDesignSession, deleteDesignSession,
  removeDesignGuidance, updateDesignOption, removeDesignOption,
} from '@/lib/supabase/security-design'
import type {
  DesignApproach, DesignGuidance, DesignOption, DesignSession, OptionDecision,
} from '@/lib/security/types'
import type { Workstream } from '@/lib/workstream/types'
import { apiError, authHeaders } from './designStudioShared'

const INPUT_CLASSES = 'h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none'

const SESSION_STATUS_STYLE: Record<string, string> = {
  active: 'bg-status-blue-bg text-status-blue',
  decided: 'bg-status-green-bg text-status-green',
  archived: 'bg-gray-100 text-gray-500',
}

const APPROACH_LABEL: Record<DesignApproach, string> = {
  standard: 'Standard SAP',
  configuration: 'Configuration',
  enhancement: 'Enhancement',
  third_party: 'Third party',
  process_control: 'Process control',
}

const APPROACH_STYLE: Record<DesignApproach, string> = {
  standard: 'bg-status-green-bg text-status-green border-green-200',
  configuration: 'bg-status-blue-bg text-status-blue border-blue-200',
  enhancement: 'bg-purple-50 text-purple-700 border-purple-200',
  third_party: 'bg-amber-50 text-amber-800 border-amber-200',
  process_control: 'bg-slate-50 text-slate-700 border-slate-200',
}

const DECISION_STYLE: Record<OptionDecision, string> = {
  open: 'border-border',
  selected: 'border-status-green ring-1 ring-status-green/30',
  rejected: 'border-border opacity-60',
}

interface Props {
  orgId: string
  sessions: DesignSession[]
  guidance: DesignGuidance[]
  options: DesignOption[]
  workstreams: Workstream[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  setSessions: Dispatch<SetStateAction<DesignSession[]>>
  setGuidance: Dispatch<SetStateAction<DesignGuidance[]>>
  setOptions: Dispatch<SetStateAction<DesignOption[]>>
  reload: () => void
}

// Tab 1 — Design Advisory. The operator converses with the security agent about
// HOW to do a security design; the agent's grounded guidance and its solution
// design options land here, the operator records the decision, and the session
// can be promoted into an Authorization Concept deliverable.
export default function DesignAdvisoryTab({
  orgId, sessions, guidance, options, workstreams,
  selectedId, onSelect, setSessions, setGuidance, setOptions, reload,
}: Props) {
  const [newTitle, setNewTitle] = useState('')
  const [newScope, setNewScope] = useState('')
  const [newWs, setNewWs] = useState('')
  const [busy, setBusy] = useState(false)

  const selected = sessions.find(s => s.id === selectedId) ?? null

  const guidanceFor = (id: string) => guidance.filter(g => g.session_id === id).sort((a, b) => a.sort_order - b.sort_order)
  const optionsFor = (id: string) => options.filter(o => o.session_id === id).sort((a, b) => a.sort_order - b.sort_order)

  const handleCreate = async () => {
    if (!newTitle.trim() || busy) return
    setBusy(true)
    try {
      const created = await createDesignSession(orgId, {
        title: newTitle.trim(),
        ...(newScope.trim() ? { scope: newScope.trim() } : {}),
        ...(newWs ? { workstream_id: newWs } : {}),
      })
      setSessions(x => [created, ...x])
      onSelect(created.id)
      setNewTitle(''); setNewScope(''); setNewWs('')
    } catch {
      reload()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this design session? Its captured guidance and design options go with it.')) return
    setSessions(x => x.filter(s => s.id !== id))
    setGuidance(x => x.filter(g => g.session_id !== id))
    setOptions(x => x.filter(o => o.session_id !== id))
    if (selectedId === id) onSelect(null)
    await deleteDesignSession(id).catch(() => reload())
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,340px)_1fr] gap-4 items-start">
      {/* ─── Session list (left) ─── */}
      <aside className="space-y-3">
        <div className="bg-white rounded-lg border border-border shadow-card p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">New design session</div>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="What are we designing? (e.g. SoD for AP invoice posting)"
            aria-label="New design session title"
            className={`w-full ${INPUT_CLASSES}`}
          />
          <input
            value={newScope}
            onChange={e => setNewScope(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="Scope (optional)"
            aria-label="New design session scope"
            className={`w-full ${INPUT_CLASSES}`}
          />
          <div className="flex gap-2">
            <select
              value={newWs}
              onChange={e => setNewWs(e.target.value)}
              aria-label="Workstream"
              className={`flex-1 min-w-0 ${INPUT_CLASSES}`}
            >
              <option value="">No workstream</option>
              {workstreams.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <Button onClick={handleCreate} disabled={busy || !newTitle.trim()}>Add</Button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-border shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-muted/60">
            <span className="text-label uppercase text-text-secondary">Design sessions</span>
            <span className="text-[11px] text-text-tertiary tabular-nums">({sessions.length})</span>
          </div>
          {sessions.length === 0 ? (
            <div className="text-body-sm text-text-tertiary py-6 px-4 text-center">
              No design sessions yet. Start one above, or ask the security agent to start one for you.
            </div>
          ) : (
            <ul className="max-h-[65vh] overflow-y-auto">
              {sessions.map(s => {
                const g = guidanceFor(s.id).length
                const o = optionsFor(s.id)
                const chosen = o.find(x => x.decision === 'selected')
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(s.id)}
                      className={`w-full border-b border-border last:border-0 px-3 py-2.5 text-left transition-colors ${selectedId === s.id ? 'bg-brand-50' : 'hover:bg-surface-muted/50'}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-body-sm font-medium text-text-primary flex-1 min-w-0">{s.title}</span>
                        <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 shrink-0 ${SESSION_STATUS_STYLE[s.status] ?? 'bg-surface-muted text-text-secondary'}`}>{s.status}</span>
                      </div>
                      {s.scope && <div className="mt-0.5 text-[11px] text-text-secondary truncate">{s.scope}</div>}
                      <div className="mt-1 text-[10px] text-text-tertiary tabular-nums">
                        {g} guidance · {o.length} option{o.length === 1 ? '' : 's'}
                        {chosen ? ` · selected: ${chosen.name}` : ''}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ─── Session detail (right) ─── */}
      <section>
        {!selected ? (
          <EmptyState
            variant="dashed"
            icon={<MessagesSquare size={28} />}
            title="Select a design session"
            description="A design session is one security design question worked end to end: the agent's grounded guidance, the solution options where standard SAP will not cover the requirement, and the decision you record. Start one on the left, or ask the security agent."
          />
        ) : (
          <SessionDetail
            orgId={orgId}
            session={selected}
            guidance={guidanceFor(selected.id)}
            options={optionsFor(selected.id)}
            workstreams={workstreams}
            setSessions={setSessions}
            setGuidance={setGuidance}
            setOptions={setOptions}
            onDelete={() => handleDelete(selected.id)}
            reload={reload}
          />
        )}
      </section>
    </div>
  )
}

// ─── Session detail ────────────────────────────────────

function SessionDetail({
  orgId, session, guidance, options, workstreams,
  setSessions, setGuidance, setOptions, onDelete, reload,
}: {
  orgId: string
  session: DesignSession
  guidance: DesignGuidance[]
  options: DesignOption[]
  workstreams: Workstream[]
  setSessions: Dispatch<SetStateAction<DesignSession[]>>
  setGuidance: Dispatch<SetStateAction<DesignGuidance[]>>
  setOptions: Dispatch<SetStateAction<DesignOption[]>>
  onDelete: () => void
  reload: () => void
}) {
  const [draftTitle, setDraftTitle] = useState(session.title)
  const [draftScope, setDraftScope] = useState(session.scope ?? '')
  const [pending, setPending] = useState<{ id: string; decision: OptionDecision } | null>(null)
  const [rationale, setRationale] = useState('')
  const [promoting, setPromoting] = useState(false)
  const [promoted, setPromoted] = useState<{ id: string; message?: string } | null>(null)
  const [promoteError, setPromoteError] = useState<string | null>(null)

  useEffect(() => {
    setDraftTitle(session.title)
    setDraftScope(session.scope ?? '')
    setPending(null); setRationale('')
    setPromoted(null); setPromoteError(null)
    // Reset drafts when switching sessions only — not on every optimistic patch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  const patchSession = (fields: Partial<DesignSession>) =>
    setSessions(x => x.map(s => (s.id === session.id ? { ...s, ...fields } : s)))

  const commitTitle = async () => {
    const v = draftTitle.trim()
    if (!v || v === session.title) { setDraftTitle(session.title); return }
    patchSession({ title: v })
    await updateDesignSession(session.id, { title: v }).catch(() => reload())
  }

  const commitScope = async () => {
    const v = draftScope.trim()
    if (v === (session.scope ?? '')) return
    patchSession({ scope: v || null })
    await updateDesignSession(session.id, { scope: v || null }).catch(() => reload())
  }

  const commitStatus = async (status: DesignSession['status']) => {
    patchSession({ status })
    await updateDesignSession(session.id, { status }).catch(() => reload())
  }

  const commitWorkstream = async (wsId: string) => {
    patchSession({ workstream_id: wsId || null })
    await updateDesignSession(session.id, { workstream_id: wsId || null }).catch(() => reload())
  }

  const handleRemoveGuidance = async (id: string) => {
    setGuidance(x => x.filter(g => g.id !== id))
    await removeDesignGuidance(id).catch(() => reload())
  }

  const handleRemoveOption = async (id: string) => {
    setOptions(x => x.filter(o => o.id !== id))
    await removeDesignOption(id).catch(() => reload())
  }

  // Record the decision. Selecting an option marks the other still-open options
  // rejected and moves the session to 'decided' — the same convention the
  // record_design_decision tool follows, so chat and UI agree.
  const commitDecision = async () => {
    if (!pending) return
    const { id, decision } = pending
    const note = rationale.trim() || null
    const siblings = decision === 'selected'
      ? options.filter(o => o.id !== id && o.decision === 'open')
      : []

    setOptions(x => x.map(o => {
      if (o.id === id) return { ...o, decision, decision_rationale: note }
      if (siblings.some(s => s.id === o.id)) return { ...o, decision: 'rejected' as OptionDecision }
      return o
    }))
    if (decision === 'selected') patchSession({ status: 'decided' })
    setPending(null); setRationale('')

    try {
      await updateDesignOption(id, { decision, decision_rationale: note })
      for (const s of siblings) await updateDesignOption(s.id, { decision: 'rejected' })
      if (decision === 'selected') await updateDesignSession(session.id, { status: 'decided' })
    } catch {
      reload()
    }
  }

  const reopen = async (id: string) => {
    setOptions(x => x.map(o => (o.id === id ? { ...o, decision: 'open' as OptionDecision, decision_rationale: null } : o)))
    await updateDesignOption(id, { decision: 'open', decision_rationale: null }).catch(() => reload())
  }

  // Promote: the deliverables engine writes a real Authorization Concept from
  // the org's evidence. It refuses (422) rather than writing filler when a
  // required evidence slot cannot be filled — surface that verbatim.
  const wsCode = workstreams.find(w => w.id === session.workstream_id)?.code || 'security-authorization'
  const promote = async () => {
    setPromoting(true); setPromoteError(null); setPromoted(null)
    try {
      const res = await fetch('/api/deliverables', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ orgId, type: 'authorization-concept', subject: session.title, workstreamCode: wsCode }),
      })
      const data: unknown = await res.json().catch(() => ({}))
      const ok = !!(data && typeof data === 'object' && (data as { ok?: boolean }).ok)
      const id = data && typeof data === 'object' ? (data as { id?: string }).id : undefined
      if (res.ok && ok && id) {
        setPromoted({ id, message: (data as { message?: string }).message })
      } else {
        setPromoteError(apiError(data, `The deliverables engine could not produce the document (${res.status}).`))
      }
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : 'Could not reach the deliverables engine.')
    } finally {
      setPromoting(false)
    }
  }

  const selectedOption = options.find(o => o.decision === 'selected') ?? null

  return (
    <div className="space-y-3">
      {/* ─── Session fields ─── */}
      <div className="bg-white rounded-lg border border-border shadow-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <input
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            aria-label="Design session title"
            className="flex-1 min-w-0 text-body-md font-semibold text-text-primary bg-transparent border-b border-transparent hover:border-border focus:border-brand-500 focus:outline-none"
          />
          <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 shrink-0 ${SESSION_STATUS_STYLE[session.status] ?? 'bg-surface-muted text-text-secondary'}`}>{session.status}</span>
          <Button
            variant="ghost" size="sm" iconOnly icon={<Trash2 size={14} />}
            aria-label="Delete design session" title="Delete design session"
            onClick={onDelete}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Scope</span>
            <input
              value={draftScope}
              onChange={e => setDraftScope(e.target.value)}
              onBlur={commitScope}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              placeholder="What this design covers (systems, processes, org units)..."
              className={`w-full ${INPUT_CLASSES}`}
            />
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Status</span>
            <select
              value={session.status}
              onChange={e => commitStatus(e.target.value as DesignSession['status'])}
              className={`w-full ${INPUT_CLASSES}`}
            >
              <option value="active">Active</option>
              <option value="decided">Decided</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Workstream</span>
            <select
              value={session.workstream_id ?? ''}
              onChange={e => commitWorkstream(e.target.value)}
              className={`w-full ${INPUT_CLASSES}`}
            >
              <option value="">No workstream</option>
              {workstreams.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        </div>

        {/* ─── Promote ─── */}
        <div className="mt-4 pt-3 border-t border-border flex items-start gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-body-sm font-semibold text-text-primary">Promote to Authorization Concept</div>
            <p className="text-[11px] text-text-tertiary mt-0.5">
              Generates the deliverable from this org&apos;s evidence under workstream <span className="font-mono">{wsCode}</span>
              {selectedOption ? <> — the recorded decision is <span className="font-medium text-text-secondary">{selectedOption.name}</span>.</> : ' — no option has been selected yet.'}
            </p>
          </div>
          <Button variant="ai" size="sm" loading={promoting} icon={<FileText size={13} />} onClick={promote}>
            Promote
          </Button>
        </div>
        {promoted && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-green-200 bg-status-green-bg px-3 py-2">
            <Check size={14} className="text-status-green shrink-0 mt-0.5" />
            <div className="min-w-0 text-[11px] text-text-secondary">
              <Link href={`/deliverables?selected=${promoted.id}`} className="inline-flex items-center gap-1 text-body-sm font-medium text-brand-600 hover:underline">
                Open the Authorization Concept <ArrowUpRight size={12} />
              </Link>
              {promoted.message && <p className="mt-0.5 whitespace-pre-wrap">{promoted.message}</p>}
            </div>
          </div>
        )}
        {promoteError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-status-red-bg px-3 py-2 text-[11px] text-text-primary">
            <AlertTriangle size={14} className="text-status-red shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap">{promoteError}</span>
          </div>
        )}
      </div>

      {/* ─── Captured guidance ─── */}
      <CollapsibleSection
        id="design-guidance"
        storageKey="mach12-studio:sec-design"
        tone="blue"
        title="Captured guidance"
        count={guidance.length}
      >
        {guidance.length === 0 ? (
          <p className="text-[11px] text-text-tertiary">
            Nothing captured yet. Ask the security agent about this design — when it gives you grounded best practice it can record it here with its sources.
          </p>
        ) : (
          <ul className="space-y-2">
            {guidance.map(g => (
              <li key={g.id} className="group rounded-lg border border-border bg-surface-muted/40 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <BookOpen size={13} className="text-brand-600 shrink-0 mt-0.5" />
                  <span className="text-body-sm font-semibold text-text-primary flex-1 min-w-0">{g.topic}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveGuidance(g.id)}
                    aria-label={`Remove guidance ${g.topic}`}
                    className="opacity-40 group-hover:opacity-100 text-text-tertiary hover:text-status-red transition-opacity shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
                <p className="mt-1 text-[12px] text-text-secondary whitespace-pre-wrap">{g.body}</p>
                {(g.citations ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(g.citations ?? []).map((c, i) => (
                      <span key={i} className="text-[10px] rounded px-1.5 py-0.5 bg-white border border-border text-text-secondary" title={c.sourceCode}>
                        {c.sourceTitle || c.sourceCode || 'source'}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      {/* ─── Solution design options ─── */}
      <CollapsibleSection
        id="design-options"
        storageKey="mach12-studio:sec-design"
        tone="purple"
        title="Solution design options"
        count={options.length}
      >
        {options.length === 0 ? (
          <p className="text-[11px] text-text-tertiary">
            No options proposed yet. Where standard SAP will not cover the requirement, ask the agent to propose options — standard, configuration, enhancement, third-party, or process control — each with pros, cons, effort, and risk.
          </p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {options.map(o => {
              const approach = (o.approach ?? 'standard') as DesignApproach
              const isPending = pending?.id === o.id
              return (
                <div
                  key={o.id}
                  className={`group relative rounded-lg border bg-white shadow-card p-3 ${DECISION_STYLE[o.decision] ?? DECISION_STYLE.open} ${o.recommended ? 'mt-2' : ''}`}
                >
                  {o.recommended && (
                    <span className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full bg-brand-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-card">
                      <Star size={9} /> Recommended
                    </span>
                  )}
                  <div className="flex items-start gap-2">
                    <span className="text-body-sm font-semibold text-text-primary flex-1 min-w-0">{o.name}</span>
                    <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 border shrink-0 ${APPROACH_STYLE[approach]}`}>
                      {APPROACH_LABEL[approach] ?? approach}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(o.id)}
                      aria-label={`Remove option ${o.name}`}
                      className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-status-red transition-opacity shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {o.summary && <p className="mt-1 text-[12px] text-text-secondary whitespace-pre-wrap">{o.summary}</p>}

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Pros</div>
                      {(o.pros ?? []).length === 0 ? (
                        <p className="text-[11px] text-text-tertiary">—</p>
                      ) : (
                        <ul className="space-y-0.5">
                          {(o.pros ?? []).map((p, i) => (
                            <li key={i} className="flex items-start gap-1 text-[11px] text-text-secondary">
                              <Check size={11} className="text-status-green shrink-0 mt-0.5" />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Cons</div>
                      {(o.cons ?? []).length === 0 ? (
                        <p className="text-[11px] text-text-tertiary">—</p>
                      ) : (
                        <ul className="space-y-0.5">
                          {(o.cons ?? []).map((c, i) => (
                            <li key={i} className="flex items-start gap-1 text-[11px] text-text-secondary">
                              <X size={11} className="text-status-red shrink-0 mt-0.5" />
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {(o.effort || o.risk) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {o.effort && (
                        <span className="text-[10px] rounded px-1.5 py-0.5 bg-surface-muted border border-border text-text-secondary">
                          Effort: {o.effort}
                        </span>
                      )}
                      {o.risk && (
                        <span className="text-[10px] rounded px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-800">
                          Risk: {o.risk}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Decision */}
                  <div className="mt-2.5 pt-2 border-t border-border">
                    {isPending ? (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] uppercase tracking-wider text-text-tertiary">
                          Why {pending.decision === 'selected' ? 'this option' : 'not this option'}?
                        </label>
                        <textarea
                          value={rationale}
                          onChange={e => setRationale(e.target.value)}
                          rows={2}
                          autoFocus
                          placeholder="Rationale (recorded with the decision)"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-surface-input text-[11px] focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none"
                        />
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" onClick={commitDecision}>
                            Record {pending.decision === 'selected' ? 'selection' : 'rejection'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setPending(null); setRationale('') }}>Cancel</Button>
                        </div>
                      </div>
                    ) : o.decision === 'open' ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="secondary" size="sm" icon={<Check size={12} />}
                          title="Records this option as the decision. The other open options are marked rejected and the session moves to Decided."
                          onClick={() => { setPending({ id: o.id, decision: 'selected' }); setRationale('') }}
                        >
                          Select
                        </Button>
                        <Button
                          variant="ghost" size="sm" icon={<X size={12} />}
                          onClick={() => { setPending({ id: o.id, decision: 'rejected' }); setRationale('') }}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <span className={`text-[10px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 shrink-0 ${o.decision === 'selected' ? 'bg-status-green-bg text-status-green' : 'bg-gray-100 text-gray-500'}`}>
                          {o.decision}
                        </span>
                        <span className="text-[11px] text-text-secondary flex-1 min-w-0 whitespace-pre-wrap">
                          {o.decision_rationale || 'No rationale recorded.'}
                        </span>
                        <button
                          type="button"
                          onClick={() => reopen(o.id)}
                          className="text-[10px] text-text-tertiary hover:text-brand-600 shrink-0 underline"
                        >
                          Reopen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}
