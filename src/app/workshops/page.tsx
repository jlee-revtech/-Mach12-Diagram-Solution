'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, MoreHorizontal, Plus, Presentation, RotateCcw } from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import { listWorkshops, createWorkshop, archiveWorkshop, restoreWorkshop, restartWorkshop } from '@/lib/supabase/workshops'
import type { Workstream } from '@/lib/workstream/types'
import type { Workshop, WorkshopFocus } from '@/lib/workshop/types'
import { FOCUS_AREAS, DURATION_OPTIONS, DEFAULT_DURATION_MINUTES } from '@/lib/workshop/types'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'
import { Button, PageHeader, EmptyState, LoadingState } from '@/components/common'

// Workshop status -> documented status token pairs (PPM design system 5.3).
const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  scheduled: 'bg-status-yellow-bg text-status-yellow',
  live: 'bg-status-green-bg text-status-green',
  completed: 'bg-status-blue-bg text-status-blue',
  archived: 'bg-gray-100 text-gray-400',
}

export default function WorkshopsPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuth()
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState<'active' | 'archived'>('active')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // new-workshop form
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [objective, setObjective] = useState('')
  const [customer, setCustomer] = useState('')
  const [wsCodes, setWsCodes] = useState<string[]>([])
  const [focus, setFocus] = useState<WorkshopFocus[]>(['process', 'data'])
  const [durationMinutes, setDurationMinutes] = useState<number>(DEFAULT_DURATION_MINUTES)

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  const load = useCallback(async () => {
    if (!organization) return
    setLoadingData(true)
    // Fetch active + archived once; the Active/Archived toggle filters client-side.
    const [ws, wk] = await Promise.all([listWorkstreams(organization.id), listWorkshops(organization.id, true)])
    setWorkstreams(ws)
    setWorkshops(wk)
    setLoadingData(false)
  }, [organization])

  useEffect(() => { load() }, [load])

  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  // ─── Archive / Restart / Restore actions ──────────────────
  const runAction = useCallback(async (id: string, fn: (id: string) => Promise<void>) => {
    setBusyId(id)
    try { await fn(id); setMenuId(null); await load() }
    catch (e) { alert(e instanceof Error ? e.message : 'Action failed') }
    finally { setBusyId(null) }
  }, [load])

  const onArchive = useCallback((id: string) => {
    if (!confirm('Archive this workshop? It moves to the Archived list; you can restore it anytime. No data is deleted.')) return
    runAction(id, archiveWorkshop)
  }, [runAction])

  const onRestore = useCallback((id: string) => runAction(id, restoreWorkshop), [runAction])

  const onRestart = useCallback((id: string) => {
    if (!confirm('Restart this workshop back to the prep phase? Your brief, agenda, section content, transcript, captures, and recap are all preserved. Nothing is deleted.')) return
    runAction(id, restartWorkshop)
  }, [runAction])

  const visible = workshops.filter((w) => (view === 'archived' ? !!w.archived_at : !w.archived_at))
  const archivedCount = workshops.filter((w) => !!w.archived_at).length

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
        duration_minutes: durationMinutes,
        settings: { voice: true },
      })
      router.push(`/workshops/${w.id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create workshop')
      setCreating(false)
    }
  }, [organization, user, title, topic, objective, customer, wsCodes, focus, durationMinutes, router])

  if (loading || !user || !organization) return null

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Workshops"
        icon={<Presentation size={24} />}
        subtitle="Agent-facilitated delivery sessions. Prep an agenda, run the room with your value-stream consultants, and capture decisions, actions, and deliverables live."
        actions={
          <>
            <div className="flex items-center rounded-lg border border-border p-0.5">
              {(['active', 'archived'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-2.5 py-1 rounded-md text-[12px] font-medium capitalize transition-colors ${
                    view === v ? 'bg-brand-500 text-white' : 'text-text-secondary hover:bg-surface-muted'
                  }`}
                >
                  {v}{v === 'archived' && archivedCount ? ` (${archivedCount})` : ''}
                </button>
              ))}
            </div>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowNew((v) => !v)}>
              New Workshop
            </Button>
          </>
        }
      />

      {/* New workshop form */}
      {showNew && (
        <div className="bg-white border border-border rounded-lg shadow-card p-5">
          <h2 className="text-heading-sm font-display text-text-primary mb-4">New workshop</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Field label="Title *"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Offer-to-Cash To-Be Design" className={inputCls} /></Field>
            <Field label="Customer"><input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="e.g. Vanguard Aerospace" className={inputCls} /></Field>
            <Field label="Topic"><input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What the workshop is about" className={inputCls} /></Field>
            <Field label="Objective"><input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="The outcome you want" className={inputCls} /></Field>
          </div>
          <div className="mb-4">
            <div className="text-label uppercase text-text-secondary mb-2">Value streams / agents in the room *</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {workstreams.map((w) => {
                const on = wsCodes.includes(w.code)
                const color = w.color || '#2563EB'
                return (
                  <button key={w.id} onClick={() => setWsCodes((a) => toggle(a, w.code))}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${on ? '' : 'border-border hover:bg-surface-muted'}`}
                    style={on ? { borderColor: color, backgroundColor: `${color}14` } : undefined}>
                    <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A`, color }}>
                      <WorkstreamIcon icon={w.icon} size={13} />
                    </div>
                    <span className="text-[11px] text-text-primary leading-tight truncate">{w.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-label uppercase text-text-secondary mb-2">Focus areas</div>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map((f) => {
                  const on = focus.includes(f.key)
                  return (
                    <button key={f.key} onClick={() => setFocus((a) => toggle(a, f.key))} title={f.blurb}
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                        on ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-border text-text-secondary hover:bg-surface-muted'
                      }`}>
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <div className="text-label uppercase text-text-secondary mb-2">Workshop length</div>
              <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} title="Workshop length" aria-label="Workshop length" className={`${inputCls} appearance-none`}>
                {DURATION_OPTIONS.map((d) => <option key={d.minutes} value={d.minutes}>{d.label}</option>)}
              </select>
              <div className="text-[11px] text-text-tertiary mt-1.5">Agenda timeboxes and per-section depth scale to this length.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={handleCreate} loading={creating} disabled={creating || !title.trim() || wsCodes.length === 0}>
              {creating ? 'Creating...' : 'Create & open'}
            </Button>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Workshop list */}
      {loadingData ? (
        <LoadingState label="Loading workshops..." />
      ) : visible.length === 0 ? (
        <EmptyState
          variant="dashed"
          icon={<Presentation size={40} />}
          title={view === 'archived' ? 'No archived workshops' : 'No workshops yet'}
          description={view === 'archived'
            ? 'Workshops you archive show up here. You can restore any of them later; nothing is deleted.'
            : 'Create a workshop to prep an agenda and run an agent-facilitated session with your value-stream consultants.'}
          action={view === 'active'
            ? <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowNew(true)}>New Workshop</Button>
            : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((w) => (
            <div key={w.id} role="button" tabIndex={0}
              onClick={() => router.push(`/workshops/${w.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/workshops/${w.id}`) }}
              className="relative text-left bg-white border border-border rounded-lg shadow-card p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              style={{ opacity: view === 'archived' || busyId === w.id ? 0.65 : 1 }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-display text-heading-sm text-text-primary leading-tight">{w.title}</h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${STATUS_CLASSES[w.status] ?? 'bg-surface-muted text-text-secondary'}`}>{w.status}</span>
                  <div className="relative">
                    <Button
                      variant="ghost" size="sm" iconOnly
                      icon={<MoreHorizontal size={14} />}
                      title="Actions" aria-label="Actions"
                      onClick={(e) => { e.stopPropagation(); setMenuId(menuId === w.id ? null : w.id) }}
                    />
                    {menuId === w.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuId(null) }} />
                        <div className="absolute right-0 top-9 z-20 w-48 rounded-lg border border-border bg-white shadow-dropdown py-1 animate-slide-in-up">
                          {view === 'active' ? (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); onRestart(w.id) }} disabled={busyId === w.id} className={menuItemCls}>
                                <RotateCcw size={14} /> Restart to prep
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); onArchive(w.id) }} disabled={busyId === w.id} className={menuItemCls}>
                                <Archive size={14} /> Archive
                              </button>
                            </>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); onRestore(w.id) }} disabled={busyId === w.id} className={menuItemCls}>
                              <ArchiveRestore size={14} /> Restore
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {w.customer_name && <div className="text-body-sm text-text-secondary mb-3">{w.customer_name}</div>}
              <div className="flex flex-wrap gap-1 mb-3">
                {(w.workstream_codes || []).slice(0, 4).map((c) => {
                  const ws = workstreams.find((x) => x.code === c)
                  const color = ws?.color || '#2563EB'
                  return <span key={c} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}1A` }}>{ws?.name?.split('(')[0].trim() || c}</span>
                })}
                {(w.workstream_codes || []).length > 4 && <span className="text-[10px] text-text-tertiary">+{w.workstream_codes.length - 4}</span>}
              </div>
              <div className="flex items-center justify-between text-[11px] text-text-tertiary">
                <span>{new Date(w.created_at).toLocaleDateString()}</span>
                {w.archived_at && <span className="italic">archived</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors'

const menuItemCls = 'w-full text-left px-3 py-2 text-body-sm text-text-secondary hover:bg-surface-muted hover:text-text-primary disabled:opacity-40 transition-colors flex items-center gap-2'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-label uppercase text-text-secondary mb-1.5">{label}</div>
      {children}
    </label>
  )
}
