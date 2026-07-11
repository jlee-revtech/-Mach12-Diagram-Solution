'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Button, EmptyState, LoadingState } from '@/components/common'
import { listRicefw, createRicefw, updateRicefw, deleteRicefw } from '@/lib/supabase/process-models'
import type { RicefwItem, RicefwType, RicefwStatus } from '@/lib/process/types'
import { RICEFW_TYPES, RICEFW_STATUSES, RICEFW_TYPE_LABEL } from '@/lib/process/types'

const TYPE_CHIP: Record<RicefwType, string> = {
  report: 'bg-status-blue-bg text-status-blue',
  interface: 'bg-cyan-50 text-cyan-700',
  conversion: 'bg-status-green-bg text-status-green',
  enhancement: 'bg-purple-50 text-purple-700',
  form: 'bg-status-yellow-bg text-status-yellow',
  workflow: 'bg-pink-50 text-pink-700',
}
const STATUS_LABEL: Record<RicefwStatus, string> = {
  identified: 'Identified', in_design: 'In Design', in_build: 'In Build', tested: 'Tested', deployed: 'Deployed',
}

const FIELD_CLASSES = 'h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none'

// Org-scoped RICEFW build-object register. Derives an implementation backlog
// from the process model. Opened from the model editor header.
export default function RicefwPanel({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [items, setItems] = useState<RicefwItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [type, setType] = useState<RicefwType>('interface')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => { setLoading(true); setItems(await listRicefw(orgId)); setLoading(false) }, [orgId])
  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!code.trim() || !title.trim() || busy) return
    setBusy(true)
    try {
      const created = await createRicefw(orgId, { code: code.trim(), ricefw_type: type, title: title.trim() })
      setItems(i => [...i, created].sort((a, b) => a.code.localeCompare(b.code)))
      setCode(''); setTitle(''); setAdding(false)
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to add') } finally { setBusy(false) }
  }

  const handleStatus = async (item: RicefwItem, status: RicefwStatus) => {
    setItems(list => list.map(x => x.id === item.id ? { ...x, status } : x))
    await updateRicefw(item.id, { status }).catch(() => load())
  }
  const handleDelete = async (id: string) => {
    setItems(list => list.filter(x => x.id !== id))
    await deleteRicefw(id).catch(() => load())
  }

  const counts = RICEFW_TYPES.map(t => ({ t, n: items.filter(i => i.ricefw_type === t).length }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-[44rem] max-w-[94vw] max-h-[85vh] flex flex-col bg-white border border-border rounded-xl shadow-card-hover overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-heading-sm font-display text-text-primary">RICEFW Register</h3>
            <div className="flex items-center gap-1.5">
              {counts.filter(c => c.n > 0).map(c => (
                <span key={c.t} className={`text-[10px] font-mono rounded px-1 py-0.5 ${TYPE_CHIP[c.t]}`}>
                  {c.t[0].toUpperCase()}{c.t.slice(1, 3)} {c.n}
                </span>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={16} />} aria-label="Close" onClick={onClose} />
        </div>

        <div className="p-4 overflow-y-auto">
          {!adding && (
            <Button variant="secondary" size="sm" icon={<Plus size={12} />} className="mb-3" onClick={() => setAdding(true)}>
              Add build object
            </Button>
          )}
          {adding && (
            <div className="mb-3 flex flex-wrap items-center gap-2 bg-surface-muted border border-border rounded-lg p-2.5">
              <input value={code} onChange={e => setCode(e.target.value)} aria-label="Code" placeholder="Code (e.g. INT-014)" className={`w-32 font-mono ${FIELD_CLASSES}`} />
              <select value={type} onChange={e => setType(e.target.value as RicefwType)} aria-label="Type" className={FIELD_CLASSES}>
                {RICEFW_TYPES.map(t => <option key={t} value={t}>{RICEFW_TYPE_LABEL[t]}</option>)}
              </select>
              <input value={title} onChange={e => setTitle(e.target.value)} aria-label="Title" placeholder="Title" className={`flex-1 min-w-[12rem] ${FIELD_CLASSES}`} />
              <Button size="sm" loading={busy} disabled={!code.trim() || !title.trim()} onClick={handleAdd}>Add</Button>
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          )}

          {loading ? (
            <LoadingState variant="inline" label="Loading build objects..." />
          ) : items.length === 0 ? (
            <EmptyState
              variant="dashed"
              compact
              title="No build objects yet"
              description="Add interfaces, reports, conversions, enhancements, forms, and workflows as you identify them in the flows."
            />
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-muted">
                    <th className="px-3 py-2.5 text-label uppercase text-text-secondary font-medium">Code</th>
                    <th className="px-3 py-2.5 text-label uppercase text-text-secondary font-medium">Type</th>
                    <th className="px-3 py-2.5 text-label uppercase text-text-secondary font-medium">Title</th>
                    <th className="px-3 py-2.5 text-label uppercase text-text-secondary font-medium">Status</th>
                    <th className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-body-sm font-mono text-text-primary">{item.code}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] rounded px-1 py-0.5 ${TYPE_CHIP[item.ricefw_type]}`}>{RICEFW_TYPE_LABEL[item.ricefw_type]}</span>
                      </td>
                      <td className="px-3 py-2 text-body-sm text-text-secondary">{item.title}</td>
                      <td className="px-3 py-2">
                        <select value={item.status} onChange={e => handleStatus(item, e.target.value as RicefwStatus)} aria-label="Status" className="h-8 px-2 rounded-lg border border-border bg-surface-input text-[11px] text-text-secondary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none">
                          {RICEFW_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          icon={<Trash2 size={14} />}
                          aria-label="Delete"
                          onClick={() => handleDelete(item.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
