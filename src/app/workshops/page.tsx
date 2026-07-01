'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import { listWorkshops, createWorkshop } from '@/lib/supabase/workshops'
import type { Workstream } from '@/lib/workstream/types'
import type { Workshop, WorkshopFocus } from '@/lib/workshop/types'
import { FOCUS_AREAS } from '@/lib/workshop/types'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'
import VersionBadge from '@/components/VersionBadge'

const STATUS_COLOR: Record<string, string> = {
  draft: '#6B7280', scheduled: '#D97706', live: '#059669', completed: '#2563EB', archived: '#6B7280',
}

export default function WorkshopsPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuth()
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)

  // new-workshop form
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [objective, setObjective] = useState('')
  const [customer, setCustomer] = useState('')
  const [wsCodes, setWsCodes] = useState<string[]>([])
  const [focus, setFocus] = useState<WorkshopFocus[]>(['process', 'data'])

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  const load = useCallback(async () => {
    if (!organization) return
    setLoadingData(true)
    const [ws, wk] = await Promise.all([listWorkstreams(organization.id), listWorkshops(organization.id)])
    setWorkstreams(ws)
    setWorkshops(wk)
    setLoadingData(false)
  }, [organization])

  useEffect(() => { load() }, [load])

  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const handleCreate = useCallback(async () => {
    if (!organization || !title.trim() || wsCodes.length === 0) return
    setCreating(true)
    try {
      const w = await createWorkshop(organization.id, user?.id ?? null, {
        title: title.trim(),
        topic: topic.trim() || title.trim(),
        objective: objective.trim() || undefined,
        customer_name: customer.trim() || undefined,
        workstream_codes: wsCodes,
        focus_areas: focus,
        settings: { voice: true },
      })
      router.push(`/workshops/${w.id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create workshop')
      setCreating(false)
    }
  }, [organization, user, title, topic, objective, customer, wsCodes, focus, router])

  if (loading || !user || !organization) return null

  return (
    <div className="min-h-screen bg-[var(--m12-bg)] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/workstreams')} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]" title="Back to workstreams">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span className="text-gradient text-xl font-bold font-[family-name:var(--font-orbitron)] tracking-wide">MACH12</span>
            <span className="text-[var(--m12-text-muted)] text-lg font-light">/</span>
            <span className="text-[var(--m12-text-secondary)] text-lg font-medium">Workshops</span>
            <span className="self-end mb-0.5"><VersionBadge /></span>
          </div>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#3B82F6] text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-lg shadow-[#2563EB]/20"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            New Workshop
          </button>
        </div>
        <p className="text-sm text-[var(--m12-text-muted)] mb-8 ml-9">
          Agent-facilitated delivery sessions. Prep an agenda, run the room with your value-stream consultants, and capture decisions, actions, and deliverables live.
        </p>

        {/* New workshop form */}
        {showNew && (
          <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-xl p-6 mb-8">
            <h2 className="text-sm font-semibold text-[var(--m12-text)] mb-4">New workshop</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Field label="Title *"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Offer-to-Cash To-Be Design" className={inputCls} /></Field>
              <Field label="Customer"><input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="e.g. Vanguard Aerospace" className={inputCls} /></Field>
              <Field label="Topic"><input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What the workshop is about" className={inputCls} /></Field>
              <Field label="Objective"><input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="The outcome you want" className={inputCls} /></Field>
            </div>
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-wider text-[var(--m12-text-muted)] mb-2">Value streams / agents in the room *</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {workstreams.map((w) => {
                  const on = wsCodes.includes(w.code)
                  const color = w.color || '#2563EB'
                  return (
                    <button key={w.id} onClick={() => setWsCodes((a) => toggle(a, w.code))}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors"
                      style={{ borderColor: on ? color : 'var(--m12-border)', backgroundColor: on ? `${color}14` : 'transparent' }}>
                      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A`, color }}>
                        <WorkstreamIcon icon={w.icon} size={13} />
                      </div>
                      <span className="text-[11px] text-[var(--m12-text)] leading-tight truncate">{w.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="mb-5">
              <div className="text-[11px] uppercase tracking-wider text-[var(--m12-text-muted)] mb-2">Focus areas</div>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map((f) => {
                  const on = focus.includes(f.key)
                  return (
                    <button key={f.key} onClick={() => setFocus((a) => toggle(a, f.key))} title={f.blurb}
                      className="rounded-full border px-3 py-1 text-[11px] font-medium transition-colors"
                      style={{ borderColor: on ? '#2563EB' : 'var(--m12-border)', backgroundColor: on ? '#2563EB14' : 'transparent', color: on ? '#3B82F6' : 'var(--m12-text-muted)' }}>
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCreate} disabled={creating || !title.trim() || wsCodes.length === 0}
                className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors">
                {creating ? 'Creating…' : 'Create & open'}
              </button>
              <button onClick={() => setShowNew(false)} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] px-3 py-2 text-xs">Cancel</button>
            </div>
          </div>
        )}

        {/* Workshop list */}
        {loadingData ? (
          <div className="text-center py-24 text-[var(--m12-text-muted)] text-sm">Loading…</div>
        ) : workshops.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-[var(--m12-border)]/60 rounded-2xl">
            <h2 className="text-lg font-semibold text-[var(--m12-text-secondary)] mb-2">No workshops yet</h2>
            <p className="text-sm text-[var(--m12-text-muted)] mb-6 max-w-md mx-auto">Create a workshop to prep an agenda and run an agent-facilitated session with your value-stream consultants.</p>
            <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#3B82F6] text-white px-5 py-2.5 rounded-lg text-sm font-medium">New Workshop</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workshops.map((w) => (
              <button key={w.id} onClick={() => router.push(`/workshops/${w.id}`)}
                className="text-left bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 hover:border-[var(--m12-border)] rounded-xl p-5 transition-all card-glow">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-[var(--m12-text)] leading-tight">{w.title}</h3>
                  <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0" style={{ color: STATUS_COLOR[w.status], backgroundColor: `${STATUS_COLOR[w.status]}1A` }}>{w.status}</span>
                </div>
                {w.customer_name && <div className="text-[11px] text-[var(--m12-text-muted)] mb-3">{w.customer_name}</div>}
                <div className="flex flex-wrap gap-1 mb-3">
                  {(w.workstream_codes || []).slice(0, 4).map((c) => {
                    const ws = workstreams.find((x) => x.code === c)
                    const color = ws?.color || '#2563EB'
                    return <span key={c} className="text-[9px] px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}1A` }}>{ws?.name?.split('(')[0].trim() || c}</span>
                  })}
                  {(w.workstream_codes || []).length > 4 && <span className="text-[9px] text-[var(--m12-text-muted)]">+{w.workstream_codes.length - 4}</span>}
                </div>
                <div className="text-[10px] text-[var(--m12-text-muted)]">{new Date(w.created_at).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 focus:border-[#2563EB] rounded-lg px-3 py-2 text-xs text-[var(--m12-text)] outline-none transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-[var(--m12-text-muted)] mb-1.5">{label}</div>
      {children}
    </label>
  )
}
