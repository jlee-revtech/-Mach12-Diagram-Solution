'use client'

// Add or hide workstreams in a workshop from the prep page. Non-destructive:
// unchecking a workstream removes it from the workshop's active set (its agenda
// section + content stay in the DB, just hidden); re-checking brings it back.
// Adding a brand-new workstream creates a fresh section to author content into.

import { useMemo, useState } from 'react'
import type { Workstream } from '@/lib/workstream/types'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'

export default function ManageWorkstreamsDialog({
  streams, activeCodes, codesWithContent, onClose, onSave,
}: {
  streams: Workstream[]
  activeCodes: string[]
  codesWithContent: string[]
  onClose: () => void
  onSave: (selectedCodes: string[]) => Promise<void>
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(activeCodes))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useMemo(() => new Set(activeCodes), [activeCodes])
  const withContent = useMemo(() => new Set(codesWithContent), [codesWithContent])

  const toggle = (code: string) => setSelected((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n })
  const dirty = selected.size !== active.size || [...selected].some((c) => !active.has(c))

  const save = async () => {
    setBusy(true)
    setError(null)
    try { await onSave([...selected]); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to update workstreams') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[34rem] max-w-[94vw] max-h-[85vh] flex flex-col bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--m12-border)]/40">
          <div>
            <h3 className="text-sm font-semibold text-[var(--m12-text)]">Workstreams in this workshop</h3>
            <div className="text-[11px] text-[var(--m12-text-muted)]">Add or hide workstreams. Hiding keeps the section and its content; nothing is deleted.</div>
          </div>
          <button type="button" onClick={onClose} title="Close" aria-label="Close" className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </div>

        {error && <div className="mx-5 mt-3 text-[11px] text-[#EF4444] bg-[#DC262614] border border-[#DC2626]/30 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {streams.length === 0 ? (
            <div className="text-center py-10 text-xs text-[var(--m12-text-muted)]">No workstreams found for this organization.</div>
          ) : (
            streams.map((w) => {
              const on = selected.has(w.code)
              const color = w.color || '#2563EB'
              const hasContent = withContent.has(w.code)
              const wasActive = active.has(w.code)
              return (
                <label key={w.code} className="flex items-start gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors hover:border-[var(--m12-border)]"
                  style={{ borderColor: on ? color : 'var(--m12-border)' }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(w.code)} className="mt-0.5" />
                  <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A`, color }}>
                    <WorkstreamIcon icon={w.icon} size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-[var(--m12-text)] leading-snug">{w.name}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {hasContent && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#10B981]/15 text-[#10B981]">has content</span>}
                      {wasActive && !on && <span className="text-[9px] text-[#D97706]">will be hidden, data kept</span>}
                      {!wasActive && on && <span className="text-[9px] text-[#3B82F6]">{hasContent ? 'will be shown again' : 'will be added'}</span>}
                    </div>
                  </div>
                </label>
              )
            })
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--m12-border)]/40 flex items-center gap-2">
          <div className="text-[11px] text-[var(--m12-text-muted)]">{selected.size} in the workshop</div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-[11px] px-3 py-1.5 rounded-lg border border-[var(--m12-border)]/50 text-[var(--m12-text-secondary)] hover:border-[var(--m12-border)]">Cancel</button>
            <button type="button" onClick={save} disabled={busy || !dirty} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
