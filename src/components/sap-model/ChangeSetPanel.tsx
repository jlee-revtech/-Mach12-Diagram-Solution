'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Download, FileCog, Plus, Trash2, Workflow, X } from 'lucide-react'
import { SAP_ENTERPRISE_MODEL as MODEL } from '@/lib/sap-model/data'
import {
  ENTITY_SCHEMAS, ORG_CHANGE_KINDS, agentForKind, existingEntities, buildInstructions,
  type OrgChangeKind, type ChangeOperation, type ChangeItem, type ChangeSet,
} from '@/lib/sap-model/changes'
import { listChangeSets, createChangeSet, updateChangeSet, deleteChangeSet } from '@/lib/supabase/sap-model-changes'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import type { Workstream } from '@/lib/workstream/types'
import { Button, EmptyState, LoadingState } from '@/components/common'

const INPUT = 'h-9 px-2.5 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500'

function uid() {
  // Non-crypto id for a change row (client-only, order-stable enough).
  return 'c' + Math.abs(Date.now() ^ Math.floor(performance.now() * 1000)).toString(36) + Math.random().toString(36).slice(2, 6)
}

export default function ChangeSetPanel({ orgId, userId }: { orgId: string; userId: string }) {
  const [sets, setSets] = useState<ChangeSet[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const targetSystem = { system: MODEL.source.system, client: MODEL.source.client, controllingArea: MODEL.source.controllingArea, pulledOn: MODEL.source.pulledOn }

  const load = useCallback(async () => {
    setLoading(true)
    const [s, w] = await Promise.all([listChangeSets(orgId), listWorkstreams(orgId).catch(() => [] as Workstream[])])
    setSets(s)
    setWorkstreams(w)
    setSelectedId((prev) => prev ?? s[0]?.id ?? null)
    setLoading(false)
  }, [orgId])
  useEffect(() => { load() }, [load])

  const current = sets.find((s) => s.id === selectedId) ?? null

  // Resolve the canonical workstream code to the org's actual workstream name.
  const agentLabelFor = useCallback((kind: OrgChangeKind) => {
    const { workstreamCode, agentLabel } = agentForKind(kind)
    const ws = workstreams.find((w) => w.code === workstreamCode)
    return { workstreamCode, agentLabel: ws?.name ?? agentLabel }
  }, [workstreams])

  const patchCurrent = async (updates: Partial<ChangeSet>) => {
    if (!current) return
    setSets((xs) => xs.map((s) => (s.id === current.id ? { ...s, ...updates } : s)))
    await updateChangeSet(current.id, updates as never).catch(() => load())
  }

  const handleNew = async () => {
    const title = newTitle.trim() || 'Untitled change set'
    setBusy(true)
    try {
      const cs = await createChangeSet(orgId, userId, { title, target_system: targetSystem })
      setSets((xs) => [cs, ...xs])
      setSelectedId(cs.id)
      setNewTitle('')
    } finally { setBusy(false) }
  }

  const handleDeleteSet = async (id: string) => {
    if (!confirm('Delete this change set?')) return
    setSets((xs) => xs.filter((s) => s.id !== id))
    if (selectedId === id) setSelectedId(null)
    await deleteChangeSet(id).catch(() => load())
  }

  const addChange = async (item: ChangeItem) => {
    if (!current) return
    await patchCurrent({ changes: [...current.changes, item], instructions: null, status: 'draft' })
  }
  const removeChange = async (cid: string) => {
    if (!current) return
    await patchCurrent({ changes: current.changes.filter((c) => c.id !== cid), instructions: null })
  }

  const generateInstructions = async () => {
    if (!current || current.changes.length === 0) return
    const pkg = buildInstructions(current, new Date().toISOString())
    await patchCurrent({ instructions: pkg, status: 'instructions' })
  }

  const exportJson = () => {
    if (!current?.instructions) return
    const blob = new Blob([JSON.stringify({ changeSet: current.title, ...current.instructions }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${current.title.replace(/[^\w]+/g, '_')}_instructions.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (loading) return <LoadingState variant="inline" label="Loading change sets..." />

  return (
    <div className="space-y-4">
      {/* Change-set bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value || null)} aria-label="Change set" className={`${INPUT} min-w-[220px]`}>
          <option value="">{sets.length ? 'Select a change set…' : 'No change sets yet'}</option>
          {sets.map((s) => <option key={s.id} value={s.id}>{s.title} ({s.changes.length})</option>)}
        </select>
        {current && (
          <Button variant="ghost" size="sm" iconOnly aria-label="Delete change set" title="Delete change set" icon={<Trash2 size={14} />} onClick={() => handleDeleteSet(current.id)} />
        )}
        <div className="flex-1" />
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleNew() }} placeholder="New change set title…" aria-label="New change set title" className={`${INPUT} w-56`} />
        <Button variant="secondary" size="sm" icon={<Plus size={14} />} loading={busy} onClick={handleNew}>New</Button>
      </div>

      {!current ? (
        <EmptyState variant="dashed" icon={<FileCog size={28} />} title="Draft changes to the SAP data model" description="Create a change set, then add or modify enterprise org elements (company codes, plants, storage locations, sales / purchasing orgs, business areas) with a from → to for each. Then generate Configuration Instructions routed to the right workstream agent." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Left: add a change + change list */}
          <div className="space-y-4">
            <ChangeEditor onAdd={addChange} agentLabelFor={agentLabelFor} />
            <ChangeList changes={current.changes} onRemove={removeChange} />
          </div>

          {/* Right: instructions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="ai" size="sm" icon={<Workflow size={14} />} disabled={!current.changes.length} onClick={generateInstructions}>
                Generate Configuration Instructions
              </Button>
              {current.instructions && (
                <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportJson}>Export package</Button>
              )}
            </div>
            {current.instructions ? (
              <InstructionsView pkg={current.instructions} />
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-body-sm text-text-tertiary">
                Add changes, then generate instructions. Each change is routed to the workstream agent that owns the object, with the SAP steps, transport policy, and current-state checks it needs to execute.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add-a-change editor ─────────────────────────────────────────────────────
function ChangeEditor({ onAdd, agentLabelFor }: { onAdd: (c: ChangeItem) => void; agentLabelFor: (k: OrgChangeKind) => { workstreamCode: string; agentLabel: string } }) {
  const [kind, setKind] = useState<OrgChangeKind>('company_code')
  const [op, setOp] = useState<ChangeOperation>('add')
  const [key, setKey] = useState('')
  const [to, setTo] = useState<Record<string, string>>({})
  const [from, setFrom] = useState<Record<string, string>>({})

  const schema = ENTITY_SCHEMAS[kind]
  const existing = useMemo(() => existingEntities(MODEL, kind), [kind])

  const reset = () => { setKey(''); setTo({}); setFrom({}) }
  const changeKind = (k: OrgChangeKind) => { setKind(k); reset() }
  const changeOp = (o: ChangeOperation) => { setOp(o); reset() }

  // Modify: selecting an existing entity prefills key + from + to.
  const pickExisting = (idx: number) => {
    const e = existing[idx]
    if (!e) return
    setKey(e.key)
    setFrom(e.fields)
    setTo({ ...e.fields })
  }

  const submit = () => {
    if (!key.trim()) return
    const { workstreamCode, agentLabel } = agentLabelFor(kind)
    const fields = schema.fields.map((f) => ({ name: f.name, label: f.label, from: op === 'modify' ? (from[f.name] ?? '') : null, to: (to[f.name] ?? '').trim() }))
    onAdd({ id: uid(), entityKind: kind, operation: op, key: key.trim(), label: `${schema.label} ${key.trim()}`, fields, workstreamCode, agentLabel })
    reset()
  }

  const agent = agentLabelFor(kind)

  return (
    <div className="rounded-lg border border-border bg-white shadow-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileCog size={15} className="text-brand-600" />
        <h3 className="text-body-md font-semibold text-text-primary">Add a change</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Org element</label>
          <select value={kind} onChange={(e) => changeKind(e.target.value as OrgChangeKind)} aria-label="Org element" className={`${INPUT} w-full`}>
            {ORG_CHANGE_KINDS.map((k) => <option key={k} value={k}>{ENTITY_SCHEMAS[k].label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Operation</label>
          <div className="flex gap-1 bg-surface-muted rounded-lg p-1 h-9">
            {(['add', 'modify'] as ChangeOperation[]).map((o) => (
              <button key={o} type="button" onClick={() => changeOp(o)} className={`flex-1 rounded text-body-sm font-medium capitalize transition-colors ${op === o ? 'bg-white shadow-card text-brand-600' : 'text-text-secondary hover:text-text-primary'}`}>{o}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent routing hint */}
      <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
        <Workflow size={12} className="text-brand-500" />
        Routes to <span className="font-medium text-text-secondary">{agent.agentLabel}</span> · primary T-code <span className="font-mono">{schema.primaryTcode}</span>
      </div>

      {op === 'modify' ? (
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">{schema.keyLabel} to modify</label>
          <select value="" onChange={(e) => e.target.value !== '' && pickExisting(Number(e.target.value))} aria-label="Existing entity" className={`${INPUT} w-full`}>
            <option value="">{existing.length ? `Select an existing ${schema.label}…` : `No existing ${schema.label} in the snapshot — use Add`}</option>
            {existing.map((e, i) => <option key={`${e.key}-${i}`} value={i}>{e.label}</option>)}
          </select>
          {key && <div className="mt-1 text-[11px] text-text-secondary">Editing <span className="font-mono">{key}</span></div>}
        </div>
      ) : (
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">{schema.keyLabel}</label>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder={`New ${schema.label} key`} aria-label={schema.keyLabel} className={`${INPUT} w-full font-mono`} />
        </div>
      )}

      {/* Fields with from/to */}
      {(op === 'add' || key) && (
        <div className="space-y-2">
          {schema.fields.map((f) => (
            <div key={f.name} className="grid grid-cols-[110px_1fr] items-center gap-2">
              <label className="text-[11px] text-text-secondary" title={f.help}>{f.label}</label>
              <div className="flex items-center gap-1.5">
                {op === 'modify' && (
                  <>
                    <span className="text-[11px] text-text-tertiary line-through font-mono truncate max-w-[120px]" title={from[f.name]}>{from[f.name] || '—'}</span>
                    <ArrowRight size={11} className="text-text-tertiary shrink-0" />
                  </>
                )}
                <input value={to[f.name] ?? ''} onChange={(e) => setTo((v) => ({ ...v, [f.name]: e.target.value }))} placeholder={f.help || f.label} aria-label={`${f.label} to`} className={`${INPUT} flex-1 min-w-0`} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="primary" size="sm" icon={<Plus size={14} />} disabled={!key.trim()} onClick={submit}>Add change</Button>
      </div>
    </div>
  )
}

// ── Change list ─────────────────────────────────────────────────────────────
function ChangeList({ changes, onRemove }: { changes: ChangeItem[]; onRemove: (id: string) => void }) {
  if (changes.length === 0) {
    return <div className="rounded-lg border border-dashed border-border p-5 text-center text-body-sm text-text-tertiary">No changes yet.</div>
  }
  return (
    <div className="space-y-2">
      {changes.map((c) => {
        const changed = c.fields.filter((f) => (f.from ?? '') !== f.to && (f.to || c.operation === 'add'))
        return (
          <div key={c.id} className="rounded-lg border border-border bg-white shadow-card px-3.5 py-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] uppercase tracking-wider font-mono rounded px-1 py-0.5 ${c.operation === 'add' ? 'bg-status-green-bg text-status-green' : 'bg-status-blue-bg text-status-blue'}`}>{c.operation}</span>
              <span className="text-body-sm font-semibold text-text-primary">{ENTITY_SCHEMAS[c.entityKind].label} <span className="font-mono">{c.key}</span></span>
              <span className="text-[10px] text-text-tertiary ml-auto">{c.agentLabel}</span>
              <button type="button" onClick={() => onRemove(c.id)} aria-label="Remove change" className="text-text-tertiary hover:text-red-600 shrink-0">
                <X size={13} />
              </button>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {changed.map((f) => (
                <span key={f.name} className="text-[11px] text-text-secondary">
                  {f.label}: {c.operation === 'modify' && <span className="text-text-tertiary line-through">{f.from || '—'} </span>}<span className="font-medium">{f.to || '—'}</span>
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Instructions view ───────────────────────────────────────────────────────
function InstructionsView({ pkg }: { pkg: NonNullable<ChangeSet['instructions']> }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
        <span className="rounded bg-surface-muted px-2 py-0.5">{pkg.summary.total} actions</span>
        <span className="rounded bg-amber-50 text-amber-700 px-2 py-0.5">{pkg.summary.transportsNeeded} need a transport</span>
        {Object.entries(pkg.summary.byWorkstream).map(([ws, n]) => (
          <span key={ws} className="rounded bg-brand-50 text-brand-700 px-2 py-0.5">{ws}: {n}</span>
        ))}
      </div>
      {pkg.instructions.map((ins) => (
        <div key={ins.changeId} className="rounded-lg border border-border bg-white shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2 border-b border-border bg-surface-muted/50">
            <span className="text-body-sm font-semibold text-text-primary flex-1">{ins.title}</span>
            {ins.transportNeeded && <span className="text-[9px] uppercase tracking-wider font-mono rounded px-1 py-0.5 bg-amber-50 text-amber-700">transport</span>}
            <span className="inline-flex items-center gap-1 text-[10px] text-brand-700 bg-brand-50 rounded px-1.5 py-0.5"><Workflow size={10} />{ins.agentLabel}</span>
          </div>
          <div className="p-3.5 space-y-2.5">
            {ins.prerequisites.length > 0 && (
              <div className="text-[11px] text-text-tertiary">Prerequisites: {ins.prerequisites.join(' · ')}</div>
            )}
            <ol className="space-y-1.5">
              {ins.steps.map((st) => (
                <li key={st.seq} className="flex gap-2 text-body-sm">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-brand-50 text-brand-600 text-[11px] inline-flex items-center justify-center font-semibold">{st.seq}</span>
                  <span className="min-w-0">
                    <span className="font-medium text-text-primary">{st.action}</span>
                    <span className="ml-1.5 text-[10px] font-mono text-text-tertiary">{st.ref}</span>
                    <span className="block text-text-secondary">{st.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="text-[11px] text-text-tertiary border-t border-border pt-2">
              <span className="font-medium">Current-state check:</span> {ins.introspection.join(' ')}
              {ins.transportNeeded ? <span className="block mt-0.5 text-amber-700">Transport: {ins.transportNote}</span> : <span className="block mt-0.5">Transport: not required — {ins.transportNote}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
