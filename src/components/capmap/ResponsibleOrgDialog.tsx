'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Trash2, X, Archive, ArchiveRestore, AlertTriangle, Building } from 'lucide-react'
import { Button, backdropClose } from '@/components/common'
import {
  createResponsibleOrg, updateResponsibleOrg, deleteResponsibleOrg,
  archiveResponsibleOrg, restoreResponsibleOrg,
} from '@/lib/supabase/capmap-orgs'
import type { ResponsibleOrg } from '@/lib/capmap/types'

// Maintain the catalog of business organizations that own capabilities.
// This is the client's own org chart (Finance, Supply Chain, Program
// Management…), NOT the tenant organizations in the header switcher.

// A muted, distinguishable ring for the swatch picker. Deliberately not the
// value-stream palette — an owner is a different axis and should not read as
// one of the streams.
const PALETTE = ['#64748B', '#2563EB', '#0891B2', '#059669', '#CA8A04', '#DC2626', '#9333EA', '#DB2777']

export default function ResponsibleOrgDialog({
  orgId, userId, orgs, usageCount, onClose, onChanged,
}: {
  orgId: string
  userId: string
  orgs: ResponsibleOrg[]
  /** capability count per responsible org id, so deletes can warn honestly */
  usageCount: Map<string, number>
  onClose: () => void
  onChanged: () => void | Promise<void>
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose, busy])

  const live = orgs.filter(o => !o.archived_at)
  const archived = orgs.filter(o => o.archived_at)

  const add = useCallback(async () => {
    const n = name.trim()
    if (!n) return
    setBusy(true); setError(null)
    try {
      await createResponsibleOrg(orgId, userId, {
        name: n,
        code: code.trim() || null,
        color,
        sort_order: live.length,
      })
      setName(''); setCode('')
      await onChanged()
      nameRef.current?.focus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add')
    } finally {
      setBusy(false)
    }
  }, [name, code, color, orgId, userId, live.length, onChanged])

  const rename = useCallback(async (id: string, next: string, prev: string) => {
    const n = next.trim()
    if (!n || n === prev) return
    setError(null)
    try {
      await updateResponsibleOrg(id, { name: n })
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename')
      await onChanged()   // snap the input back to the stored value
    }
  }, [onChanged])

  const remove = useCallback(async (o: ResponsibleOrg) => {
    const n = usageCount.get(o.id) || 0
    const warning = n > 0
      ? `Delete "${o.name}"? ${n} ${n === 1 ? 'capability is' : 'capabilities are'} assigned to it and will be left with no owner. The capabilities themselves are not deleted.`
      : `Delete "${o.name}"?`
    if (!confirm(warning)) return
    setBusy(true)
    try {
      await deleteResponsibleOrg(o.id)
      await onChanged()
    } finally {
      setBusy(false)
    }
  }, [usageCount, onChanged])

  const toggleArchive = useCallback(async (o: ResponsibleOrg) => {
    setBusy(true)
    try {
      await (o.archived_at ? restoreResponsibleOrg(o.id) : archiveResponsibleOrg(o.id))
      await onChanged()
    } finally {
      setBusy(false)
    }
  }, [onChanged])

  const row = (o: ResponsibleOrg) => {
    const n = usageCount.get(o.id) || 0
    return (
      <div key={o.id} className={`flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 ${o.archived_at ? 'opacity-60' : ''}`}>
        <input
          type="color"
          value={o.color || PALETTE[0]}
          onChange={async e => { await updateResponsibleOrg(o.id, { color: e.target.value }).catch(() => {}); await onChanged() }}
          aria-label={`Colour for ${o.name}`}
          title="Colour"
          className="w-5 h-5 rounded shrink-0 cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          defaultValue={o.name}
          onBlur={e => rename(o.id, e.target.value, o.name)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          aria-label={`Name of ${o.name}`}
          className="flex-1 min-w-0 bg-transparent text-body-sm text-text-primary focus:outline-none border-b border-transparent focus:border-brand-500"
        />
        <input
          defaultValue={o.code || ''}
          onBlur={async e => { await updateResponsibleOrg(o.id, { code: e.target.value.trim() || null }).catch(() => {}); await onChanged() }}
          placeholder="code"
          aria-label={`Short code for ${o.name}`}
          className="w-16 shrink-0 bg-transparent text-[11px] font-mono text-text-secondary placeholder:text-text-tertiary focus:outline-none border-b border-transparent focus:border-brand-500"
        />
        <span className="text-[10px] text-text-tertiary shrink-0 w-14 text-right" title={`${n} capabilities assigned`}>
          {n > 0 ? `${n} cap${n === 1 ? '' : 's'}` : '—'}
        </span>
        <button
          type="button" onClick={() => toggleArchive(o)} disabled={busy}
          title={o.archived_at ? 'Restore' : 'Archive (hides it from the dropdown, keeps existing assignments)'}
          className="text-text-tertiary hover:text-amber-600 transition-colors shrink-0"
        >
          {o.archived_at ? <ArchiveRestore size={13} /> : <Archive size={13} />}
        </button>
        <button
          type="button" onClick={() => remove(o)} disabled={busy}
          title="Delete permanently"
          className="text-text-tertiary hover:text-red-600 transition-colors shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" {...backdropClose(() => { if (!busy) onClose() })}>
      <div className="bg-white rounded-xl border border-border shadow-modal w-full max-w-xl max-h-[90vh] flex flex-col animate-slide-in-up">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
          <div className="flex-1">
            <h3 className="font-display text-heading-sm text-text-primary">Responsible Organizations</h3>
            <p className="text-[11px] text-text-tertiary mt-0.5">
              The business organizations that own capabilities — Finance, Supply Chain, Program
              Management, and so on. This catalog fills the Responsible Org dropdown on every capability.
            </p>
          </div>
          <Button variant="ghost" size="sm" iconOnly aria-label="Close" onClick={onClose} disabled={busy} icon={<X size={16} />} />
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Add */}
          <div className="flex items-center gap-2">
            <input
              type="color" value={color} onChange={e => setColor(e.target.value)}
              aria-label="Colour for the new organization" title="Colour"
              className="w-8 h-9 rounded shrink-0 cursor-pointer border-0 bg-transparent p-0"
            />
            <input
              ref={nameRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
              placeholder="Organization name, e.g. Finance"
              aria-label="New organization name"
              autoFocus
              className="flex-1 h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
              placeholder="FIN"
              aria-label="Short code"
              className="w-20 h-9 px-2 rounded-lg border border-border bg-surface-input text-[11px] font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
            <Button variant="primary" size="md" onClick={add} loading={busy} disabled={!name.trim()} icon={<Plus size={14} />}>
              Add
            </Button>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <AlertTriangle size={13} className="text-red-600 shrink-0 mt-0.5" />
              <span className="text-[11px] text-red-700">{error}</span>
            </div>
          )}

          {/* Catalog */}
          {live.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg">
              <Building size={26} className="mx-auto text-text-tertiary mb-2" />
              <div className="text-body-sm text-text-secondary">No organizations yet.</div>
              <div className="text-[11px] text-text-tertiary mt-1">Add the ones that own capabilities in this programme.</div>
            </div>
          ) : (
            <div className="space-y-1.5">{live.map(row)}</div>
          )}

          {archived.length > 0 && (
            <div>
              <button
                type="button" onClick={() => setShowArchived(v => !v)}
                className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors mb-2"
              >
                {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
              </button>
              {showArchived && <div className="space-y-1.5">{archived.map(row)}</div>}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Done</Button>
        </div>
      </div>
    </div>
  )
}
