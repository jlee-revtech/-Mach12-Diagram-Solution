'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Sparkles, X, Check } from 'lucide-react'
import { Button, LoadingState } from '@/components/common'
import { createCapability, updateCapability, archiveCapability } from '@/lib/supabase/capmap'
import type { CapabilityWithSystems } from '@/lib/capmap/types'
import type { Workstream } from '@/lib/workstream/types'

// ─── AI review/apply panel for the Capability Map ──────
// Two modes share one panel:
//   • consistency — auto-runs a duplicate/overlap/ownership/granularity review
//   • suggest     — prompt-driven improvement suggestions
// Every finding carries an `action` the user can apply directly (archive / merge /
// rename / regroup / rehome / add) against the live capability map.

type ActionKind = 'archive' | 'rename' | 'rehome' | 'regroup' | 'merge' | 'add' | 'none'

interface AIAction {
  kind: ActionKind
  targetId?: string
  newName?: string
  newGroup?: string
  workstream?: string
  keepId?: string
  archiveIds?: string[]
  name?: string
  group?: string
  description?: string
}

interface AIFinding {
  type: string
  severity?: string
  impact?: string
  title: string
  detail?: string
  rationale?: string
  capabilityIds?: string[]
  action?: AIAction
}

type ItemStatus = 'idle' | 'applying' | 'applied' | 'error' | 'dismissed'

const TYPE_COLORS: Record<string, string> = {
  duplicate: '#EF4444', overlap: '#F59E0B', ownership: '#8B5CF6', granularity: '#06B6D4',
  grouping: '#3B82F6', naming: '#64748B',
  add: '#10B981', rename: '#3B82F6', rehome: '#8B5CF6', regroup: '#06B6D4', merge: '#EF4444', archive: '#F59E0B', split: '#10B981',
}

const LEVEL_CLASSES: Record<string, string> = {
  high: 'bg-status-red-bg text-status-red',
  medium: 'bg-status-yellow-bg text-status-yellow',
  low: 'bg-gray-100 text-gray-500',
}

export default function CapabilityAIReviewPanel({
  mode, caps, workstreams, orgId, userId, onClose, onApplied,
}: {
  mode: 'consistency' | 'suggest'
  caps: CapabilityWithSystems[]
  workstreams: Workstream[]
  orgId: string
  userId: string
  onClose: () => void
  onApplied: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string>('')
  const [score, setScore] = useState<number | null>(null)
  const [items, setItems] = useState<AIFinding[]>([])
  const [status, setStatus] = useState<Record<number, ItemStatus>>({})
  const [prompt, setPrompt] = useState('')
  const [ran, setRan] = useState(false)

  const capById = useMemo(() => new Map(caps.map(c => [c.id, c])), [caps])
  const wsById = useMemo(() => new Map(workstreams.map(w => [w.id, w])), [workstreams])
  const codeById = useMemo(() => new Map(workstreams.map(w => [w.id, w.code])), [workstreams])
  const idByCode = useMemo(() => new Map(workstreams.map(w => [w.code, w.id])), [workstreams])

  const run = useCallback(async () => {
    setBusy(true); setError(null); setRan(true)
    try {
      const body = mode === 'consistency'
        ? {
            action: 'capability-map-consistency',
            context: {
              capabilities: caps.map(c => ({ id: c.id, name: c.name, group: c.domain, workstream: c.workstream_id ? codeById.get(c.workstream_id) : null, description: c.description })),
              workstreams: workstreams.map(w => ({ code: w.code, name: w.name, description: w.description })),
            },
          }
        : {
            action: 'capability-map-suggest',
            prompt,
            context: {
              capabilities: caps.map(c => ({ id: c.id, name: c.name, group: c.domain, workstream: c.workstream_id ? codeById.get(c.workstream_id) : null, description: c.description })),
              workstreams: workstreams.map(w => ({ code: w.code, name: w.name, description: w.description })),
            },
          }
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI request failed')
      setSummary(data.summary || '')
      setScore(typeof data.score === 'number' ? data.score : null)
      setItems((mode === 'consistency' ? data.findings : data.suggestions) || [])
      setStatus({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed')
    } finally {
      setBusy(false)
    }
  }, [mode, prompt, caps, workstreams, codeById])

  // Consistency check runs automatically on open.
  useEffect(() => { if (mode === 'consistency') run() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyOne = useCallback(async (idx: number, f: AIFinding) => {
    const a = f.action
    if (!a || a.kind === 'none') return
    setStatus(s => ({ ...s, [idx]: 'applying' }))
    try {
      switch (a.kind) {
        case 'archive': {
          for (const id of a.archiveIds || []) if (capById.has(id)) await archiveCapability(id)
          break
        }
        case 'merge': {
          for (const id of a.archiveIds || []) if (capById.has(id) && id !== a.keepId) await archiveCapability(id)
          break
        }
        case 'rename': {
          if (a.targetId && capById.has(a.targetId)) {
            const upd: { name?: string; domain?: string } = {}
            if (a.newName) upd.name = a.newName
            if (a.newGroup) upd.domain = a.newGroup
            if (Object.keys(upd).length) await updateCapability(a.targetId, upd)
          }
          break
        }
        case 'regroup': {
          if (a.targetId && capById.has(a.targetId) && a.newGroup) await updateCapability(a.targetId, { domain: a.newGroup })
          break
        }
        case 'rehome': {
          const wsId = a.workstream ? idByCode.get(a.workstream) : undefined
          if (a.targetId && capById.has(a.targetId) && wsId) await updateCapability(a.targetId, { workstream_id: wsId })
          break
        }
        case 'add': {
          if (a.name) {
            await createCapability(orgId, userId, {
              name: a.name,
              description: a.description,
              domain: a.group,
              workstream_id: a.workstream ? idByCode.get(a.workstream) ?? null : null,
              source: 'ai',
              sort_order: caps.length,
            })
          }
          break
        }
      }
      setStatus(s => ({ ...s, [idx]: 'applied' }))
      onApplied()
    } catch {
      setStatus(s => ({ ...s, [idx]: 'error' }))
    }
  }, [capById, idByCode, orgId, userId, caps.length, onApplied])

  const applyAll = useCallback(async () => {
    for (let i = 0; i < items.length; i++) {
      const st = status[i]
      if (st === 'applied' || st === 'dismissed') continue
      if (items[i].action && items[i].action!.kind !== 'none') await applyOne(i, items[i])
    }
  }, [items, status, applyOne])

  const applyableCount = items.filter((f, i) => f.action && f.action.kind !== 'none' && status[i] !== 'applied' && status[i] !== 'dismissed').length

  const actionLabel = (a?: AIAction): string => {
    if (!a) return ''
    switch (a.kind) {
      case 'archive': return `Archive ${(a.archiveIds || []).length} capabilit${(a.archiveIds || []).length === 1 ? 'y' : 'ies'}`
      case 'merge': return `Merge - keep "${a.keepId && capById.get(a.keepId)?.name || '?'}", archive ${(a.archiveIds || []).filter(id => id !== a.keepId).length}`
      case 'rename': return `Rename${a.newName ? ` → "${a.newName}"` : ''}${a.newGroup ? ` (group: ${a.newGroup})` : ''}`
      case 'regroup': return `Move to group "${a.newGroup}"`
      case 'rehome': return `Re-home to ${a.workstream}`
      case 'add': return `Add "${a.name}"${a.workstream ? ` → ${a.workstream}` : ''}`
      default: return 'No automatic fix'
    }
  }

  const title = mode === 'consistency' ? 'Consistency Checker' : 'Suggest Updates'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[88vh] bg-white border border-border rounded-xl shadow-card-hover flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Sparkles size={18} className="text-amber-500" />
          <div className="flex-1">
            <h2 className="text-heading-sm font-display text-text-primary">{title}</h2>
            <p className="text-[11px] text-text-tertiary">
              {mode === 'consistency'
                ? 'AI review of duplicates, overlap, ownership, and level of detail across the map.'
                : 'AI-suggested updates for consistency, non-overlap, and uniform detail.'}
            </p>
          </div>
          {score !== null && (
            <div className="text-right mr-2">
              <div className={`text-lg font-bold leading-none font-display ${score >= 80 ? 'text-status-green' : score >= 60 ? 'text-status-yellow' : 'text-status-red'}`}>{score}</div>
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary">consistency</div>
            </div>
          )}
          <Button variant="ghost" size="sm" iconOnly aria-label="Close" onClick={onClose} icon={<X size={16} />} />
        </div>

        {/* Prompt (suggest mode) */}
        {mode === 'suggest' && (
          <div className="px-5 py-3 border-b border-border">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="What should the AI focus on? e.g. 'Tighten Source-to-Pay - remove overlaps and add supplier invoice intake' (leave blank for a general pass)"
              rows={2}
              className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
            />
            <div className="flex justify-end mt-2">
              <Button variant="ai" size="md" onClick={run} disabled={busy} icon={<Sparkles size={14} />}>
                {busy ? 'Analyzing…' : ran ? 'Re-run' : 'Analyze'}
              </Button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
          {busy && (
            <LoadingState
              variant="inline"
              label={mode === 'consistency' ? 'Reviewing the capability map…' : 'Analyzing…'}
            />
          )}

          {error && <div className="text-body-sm text-status-red bg-status-red-bg border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          {!busy && summary && <p className="text-body-sm text-text-secondary bg-surface-muted border border-border rounded-lg px-3 py-2">{summary}</p>}

          {!busy && ran && items.length === 0 && !error && (
            <div className="text-center py-10 text-body-sm text-text-tertiary">
              {mode === 'consistency' ? 'No consistency issues found. The map looks clean.' : 'No suggestions returned.'}
            </div>
          )}

          {items.map((f, i) => {
            const st = status[i] || 'idle'
            if (st === 'dismissed') return null
            const tc = TYPE_COLORS[f.type] || '#64748B'
            const level = f.severity || f.impact
            const levelClasses = level ? LEVEL_CLASSES[level] || 'bg-gray-100 text-gray-500' : null
            const involved = (f.capabilityIds || []).map(id => capById.get(id)?.name).filter(Boolean) as string[]
            const canApply = !!f.action && f.action.kind !== 'none'
            return (
              <div key={i} className={`border rounded-lg p-3 transition-colors ${st === 'applied' ? 'border-green-200 bg-status-green-bg' : 'border-border bg-surface-muted'}`}>
                <div className="flex items-start gap-2 mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5" style={{ color: tc, background: `${tc}1A`, border: `1px solid ${tc}44` }}>{f.type}</span>
                  {levelClasses && <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${levelClasses}`}>{level}</span>}
                  <h4 className="flex-1 text-body-sm font-semibold text-text-primary">{f.title}</h4>
                </div>
                {(f.detail || f.rationale) && <p className="text-[11px] text-text-secondary mb-2 leading-relaxed">{f.detail || f.rationale}</p>}
                {involved.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {involved.map((n, k) => (
                      <span key={k} className="text-[10px] text-text-secondary bg-white border border-border rounded px-1.5 py-0.5">{n}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] text-text-tertiary italic truncate">{actionLabel(f.action)}</span>
                  {st === 'applied' ? (
                    <span className="text-[10px] font-medium text-status-green inline-flex items-center gap-1 shrink-0">
                      <Check size={11} />
                      Applied
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => setStatus(s => ({ ...s, [i]: 'dismissed' }))} className="text-[10px] text-text-tertiary hover:text-text-secondary px-2 py-1 transition-colors">Dismiss</button>
                      {canApply && (
                        <button type="button" onClick={() => applyOne(i, f)} disabled={st === 'applying'} className="text-[10px] font-medium bg-status-green hover:bg-green-700 disabled:opacity-50 text-white px-2.5 py-1 rounded transition-colors">
                          {st === 'applying' ? 'Applying…' : st === 'error' ? 'Retry' : 'Apply'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
            <span className="text-[11px] text-text-tertiary">{applyableCount} change{applyableCount === 1 ? '' : 's'} ready to apply</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Done</Button>
              <button type="button" onClick={applyAll} disabled={applyableCount === 0} className="inline-flex items-center gap-1.5 bg-status-green hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-body-sm font-medium transition-colors">
                Apply all ({applyableCount})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
