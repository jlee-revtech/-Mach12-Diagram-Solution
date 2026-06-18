'use client'

import { useEffect, useState, useCallback } from 'react'
import { listRicefw, createRicefw, updateRicefw, deleteRicefw } from '@/lib/supabase/process-models'
import type { RicefwItem, RicefwType, RicefwStatus } from '@/lib/process/types'
import { RICEFW_TYPES, RICEFW_STATUSES, RICEFW_TYPE_LABEL } from '@/lib/process/types'

const TYPE_COLOR: Record<RicefwType, string> = {
  report: '#2563EB', interface: '#0EA5E9', conversion: '#10B981',
  enhancement: '#8B5CF6', form: '#F59E0B', workflow: '#EC4899',
}
const STATUS_LABEL: Record<RicefwStatus, string> = {
  identified: 'Identified', in_design: 'In Design', in_build: 'In Build', tested: 'Tested', deployed: 'Deployed',
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-[44rem] max-w-[94vw] max-h-[85vh] flex flex-col bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--m12-border)]/40 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-[var(--m12-text)]">RICEFW Register</h3>
            <div className="flex items-center gap-1.5">
              {counts.filter(c => c.n > 0).map(c => (
                <span key={c.t} className="text-[9px] font-[family-name:var(--font-space-mono)] rounded px-1 py-0.5 border" style={{ color: TYPE_COLOR[c.t], borderColor: `${TYPE_COLOR[c.t]}55` }}>
                  {c.t[0].toUpperCase()}{c.t.slice(1, 3)} {c.n}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {!adding && (
            <button onClick={() => setAdding(true)} className="mb-3 flex items-center gap-1.5 text-[11px] text-[#0EA5E9] border border-[#0EA5E9]/40 hover:border-[#0EA5E9]/70 rounded-md px-2.5 py-1.5 transition-colors">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              Add build object
            </button>
          )}
          {adding && (
            <div className="mb-3 flex flex-wrap items-center gap-2 bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg p-2.5">
              <input value={code} onChange={e => setCode(e.target.value)} aria-label="Code" placeholder="Code (e.g. INT-014)" className="w-28 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] font-[family-name:var(--font-space-mono)] focus:outline-none" />
              <select value={type} onChange={e => setType(e.target.value as RicefwType)} aria-label="Type" className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] focus:outline-none">
                {RICEFW_TYPES.map(t => <option key={t} value={t}>{RICEFW_TYPE_LABEL[t]}</option>)}
              </select>
              <input value={title} onChange={e => setTitle(e.target.value)} aria-label="Title" placeholder="Title" className="flex-1 min-w-[12rem] bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] focus:outline-none" />
              <button onClick={handleAdd} disabled={busy || !code.trim() || !title.trim()} className="bg-[#0EA5E9] hover:bg-[#38BDF8] disabled:opacity-50 text-white text-[11px] font-medium rounded px-3 py-1 transition-colors">Add</button>
              <button onClick={() => setAdding(false)} className="text-[11px] text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] px-1">Cancel</button>
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-sm text-[var(--m12-text-muted)]">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--m12-text-muted)]">No build objects yet. Add interfaces, reports, conversions, enhancements, forms, and workflows as you identify them in the flows.</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
                  <th className="py-1.5 pr-2">Code</th><th className="py-1.5 pr-2">Type</th><th className="py-1.5 pr-2">Title</th><th className="py-1.5 pr-2">Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-t border-[var(--m12-border)]/30">
                    <td className="py-1.5 pr-2 text-[11px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text)]">{item.code}</td>
                    <td className="py-1.5 pr-2">
                      <span className="text-[10px] rounded px-1 py-0.5 border" style={{ color: TYPE_COLOR[item.ricefw_type], borderColor: `${TYPE_COLOR[item.ricefw_type]}55` }}>{RICEFW_TYPE_LABEL[item.ricefw_type]}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-[11px] text-[var(--m12-text-secondary)]">{item.title}</td>
                    <td className="py-1.5 pr-2">
                      <select value={item.status} onChange={e => handleStatus(item, e.target.value as RicefwStatus)} aria-label="Status" className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded px-1.5 py-0.5 text-[10px] text-[var(--m12-text-secondary)] focus:outline-none">
                        {RICEFW_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 text-right">
                      <button onClick={() => handleDelete(item.id)} aria-label="Delete" className="text-[var(--m12-border)] hover:text-red-400">
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
