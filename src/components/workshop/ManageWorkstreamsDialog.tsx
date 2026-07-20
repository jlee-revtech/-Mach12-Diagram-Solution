'use client'

// Add or hide workstreams in a workshop from the prep page. Non-destructive:
// unchecking a workstream removes it from the workshop's active set (its agenda
// section + content stay in the DB, just hidden); re-checking brings it back.
// Adding a brand-new workstream creates a fresh section to author content into.
// 055: star one or more selected workstreams as PRIMARY; the non-primary
// ("integrated") workstreams frame their prep input through that lens.

import { useMemo, useState } from 'react'
import { Star, X } from 'lucide-react'
import type { Workstream } from '@/lib/workstream/types'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'
import { Button } from '@/components/common'

export default function ManageWorkstreamsDialog({
  streams, activeCodes, primaryCodes, codesWithContent, onClose, onSave,
}: {
  streams: Workstream[]
  activeCodes: string[]
  primaryCodes: string[]
  codesWithContent: string[]
  onClose: () => void
  onSave: (selectedCodes: string[], primaryCodes: string[]) => Promise<void>
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(activeCodes))
  const [primary, setPrimary] = useState<Set<string>>(new Set(primaryCodes.filter((c) => activeCodes.includes(c))))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useMemo(() => new Set(activeCodes), [activeCodes])
  const initialPrimary = useMemo(() => new Set(primaryCodes), [primaryCodes])
  const withContent = useMemo(() => new Set(codesWithContent), [codesWithContent])

  const toggle = (code: string) => setSelected((s) => {
    const n = new Set(s)
    if (n.has(code)) { n.delete(code); setPrimary((p) => { const q = new Set(p); q.delete(code); return q }) }
    else n.add(code)
    return n
  })
  const togglePrimary = (code: string) => setPrimary((p) => { const n = new Set(p); if (n.has(code)) n.delete(code); else n.add(code); return n })
  const dirty =
    selected.size !== active.size || [...selected].some((c) => !active.has(c)) ||
    primary.size !== initialPrimary.size || [...primary].some((c) => !initialPrimary.has(c))

  const save = async () => {
    setBusy(true)
    setError(null)
    try { await onSave([...selected], [...primary].filter((c) => selected.has(c))); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to update workstreams') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[34rem] max-w-[94vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-card-hover overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <h3 className="text-heading-sm font-display text-text-primary">Workstreams in this workshop</h3>
            <div className="text-[11px] text-text-tertiary">Add or hide workstreams; hiding keeps the section and its content. Star the primary workstream(s): the others frame their input through that lens.</div>
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={14} />} title="Close" aria-label="Close" onClick={onClose} />
        </div>

        {error && <div className="mx-5 mt-3 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {streams.length === 0 ? (
            <div className="text-center py-10 text-body-sm text-text-tertiary">No workstreams found for this organization.</div>
          ) : (
            streams.map((w) => {
              const on = selected.has(w.code)
              const isPrim = primary.has(w.code)
              const color = w.color || '#2563EB'
              const hasContent = withContent.has(w.code)
              const wasActive = active.has(w.code)
              return (
                <label key={w.code} className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-border cursor-pointer transition-colors hover:bg-surface-muted"
                  style={on ? { borderColor: isPrim ? '#D97706' : color } : undefined}>
                  <input type="checkbox" checked={on} onChange={() => toggle(w.code)} className="mt-0.5" />
                  <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A`, color }}>
                    <WorkstreamIcon icon={w.icon} size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-body-sm text-text-primary leading-snug">{w.name}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {isPrim && on && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">primary lens</span>}
                      {hasContent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-status-green-bg text-status-green">has content</span>}
                      {wasActive && !on && <span className="text-[10px] text-amber-600">will be hidden, data kept</span>}
                      {!wasActive && on && <span className="text-[10px] text-brand-600">{hasContent ? 'will be shown again' : 'will be added'}</span>}
                    </div>
                  </div>
                  {on && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePrimary(w.code) }}
                      title={isPrim ? 'Unmark as primary' : 'Mark as the primary workstream (the lens the others frame their input through)'}
                      aria-label={isPrim ? `Unmark ${w.name} as primary` : `Mark ${w.name} as primary`}
                      className={`mt-0.5 shrink-0 rounded p-1 transition-colors ${isPrim ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'}`}
                    >
                      <Star size={15} fill={isPrim ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </label>
              )
            })
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center gap-2">
          <div className="text-[11px] text-text-tertiary">
            {selected.size} in the workshop
            {primary.size > 0 && <span className="text-amber-600"> · {primary.size} primary</span>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={save} loading={busy} disabled={busy || !dirty}>{busy ? 'Saving...' : 'Save changes'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
