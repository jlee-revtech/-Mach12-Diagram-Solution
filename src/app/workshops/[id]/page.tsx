'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import {
  getWorkshop, updateWorkshop, listAgenda, replaceAgenda, updateAgendaItem,
  listMessages, addMessage, listCaptures, updateCapture, setParticipants,
} from '@/lib/supabase/workshops'
import type { Workshop, WorkshopAgendaItem, WorkshopMessage, WorkshopCapture, WorkshopFocus, CaptureType } from '@/lib/workshop/types'
import { CAPTURE_META } from '@/lib/workshop/types'
import type { Workstream } from '@/lib/workstream/types'
import VersionBadge from '@/components/VersionBadge'

interface FacResult {
  say: string; nextQuestion?: string; coverage?: string; advanceAgenda?: boolean; pullSpecialist?: string; gaps?: string[]
}

export default function WorkshopRoomPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { user, profile, organization, loading } = useAuth()

  const [ws, setWs] = useState<Workshop | null>(null)
  const [streams, setStreams] = useState<Workstream[]>([])
  const [agenda, setAgenda] = useState<WorkshopAgendaItem[]>([])
  const [messages, setMessages] = useState<WorkshopMessage[]>([])
  const [captures, setCaptures] = useState<WorkshopCapture[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [fac, setFac] = useState<FacResult | null>(null)
  const [input, setInput] = useState('')
  const [speaker, setSpeaker] = useState('')
  const transcriptRef = useRef<HTMLDivElement>(null)

  const me = profile?.display_name || user?.email?.split('@')[0] || 'Facilitator'

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  const load = useCallback(async () => {
    if (!organization || !id) return
    const [w, s, a, m, c] = await Promise.all([
      getWorkshop(id), listWorkstreams(organization.id), listAgenda(id), listMessages(id), listCaptures(id),
    ])
    setWs(w); setStreams(s); setAgenda(a); setMessages(m); setCaptures(c)
  }, [organization, id])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSpeaker(me) }, [me])
  useEffect(() => { transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight }) }, [messages])

  const roster = (ws?.workstream_codes || []).map((c) => streams.find((s) => s.code === c)).filter(Boolean) as Workstream[]

  // ─── Prep: generate brief ─────────────────────────────────
  const generateBrief = useCallback(async () => {
    if (!ws || !organization) return
    setBusy('brief')
    try {
      const res = await fetch('/api/workshops/brief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: organization.id, topic: ws.topic || ws.title, objective: ws.objective,
          customerName: ws.customer_name, workstreamCodes: ws.workstream_codes, focusAreas: ws.focus_areas,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.brief) throw new Error(data.error || 'Brief generation failed')
      await updateWorkshop(ws.id, { brief: data.brief, status: 'scheduled' })
      await replaceAgenda(ws.id, (data.brief.agenda || []).map((it: { title: string; objective?: string; focusType?: WorkshopFocus; timeboxMinutes?: number }) => ({
        title: it.title, objective: it.objective, focus_type: it.focusType, timebox_minutes: it.timeboxMinutes,
      })))
      // seat the facilitator + specialist agents
      await setParticipants(ws.id,
        [{ display_name: me, org_role: 'Facilitator' }],
        [{ workstream_code: 'enterprise', display_name: 'Enterprise Architect', is_facilitator: true },
         ...roster.map((r) => ({ workstream_code: r.code, display_name: r.name.split('(')[0].trim() }))])
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(null) }
  }, [ws, organization, me, roster, load])

  const setStatus = useCallback(async (status: Workshop['status']) => {
    if (!ws) return
    const stamp = status === 'live' ? { started_at: new Date().toISOString() } : status === 'completed' ? { ended_at: new Date().toISOString() } : {}
    await updateWorkshop(ws.id, { status, ...stamp })
    await load()
  }, [ws, load])

  // ─── Live: transcript + facilitation + capture ────────────
  const send = useCallback(async () => {
    if (!ws || !input.trim()) return
    await addMessage(ws.id, { speaker_kind: 'person', speaker_name: speaker || me, speaker_role: 'participant', content: input.trim(), source: 'typed' })
    setInput('')
    setMessages(await listMessages(ws.id))
  }, [ws, input, speaker, me])

  const facilitate = useCallback(async () => {
    if (!ws || !organization) return
    setBusy('facilitate')
    try {
      const active = agenda.find((a) => a.status === 'active')
      const res = await fetch('/api/workshops/facilitate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId: ws.id, orgId: organization.id, activeItemTitle: active?.title, focus: active?.focus_type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Facilitation failed')
      setFac(data.result || null)
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }, [ws, organization, agenda])

  const askQuestion = useCallback(async (q: string) => {
    if (!ws) return
    await addMessage(ws.id, { speaker_kind: 'agent', speaker_name: 'Facilitator', speaker_role: 'facilitator', content: q, source: 'agent' })
    setMessages(await listMessages(ws.id))
  }, [ws])

  const capture = useCallback(async () => {
    if (!ws || !organization) return
    setBusy('capture')
    try {
      const res = await fetch('/api/workshops/capture', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId: ws.id, orgId: organization.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Capture failed')
      setCaptures(await listCaptures(ws.id))
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }, [ws, organization])

  const setCap = useCallback(async (c: WorkshopCapture, status: WorkshopCapture['status']) => {
    await updateCapture(c.id, { status, ...(status === 'applied' ? { applied_at: new Date().toISOString() } : {}) })
    setCaptures((cs) => cs.map((x) => (x.id === c.id ? { ...x, status } : x)))
  }, [])

  const setActive = useCallback(async (item: WorkshopAgendaItem) => {
    for (const a of agenda) if (a.status === 'active' && a.id !== item.id) await updateAgendaItem(a.id, { status: 'done' })
    await updateAgendaItem(item.id, { status: 'active' })
    setAgenda(await listAgenda(ws!.id))
  }, [agenda, ws])

  if (loading || !user || !organization || !ws) return null

  const proposed = captures.filter((c) => c.status === 'proposed')
  const confirmed = captures.filter((c) => c.status === 'confirmed' || c.status === 'applied')
  const isLive = ws.status === 'live'
  const hasBrief = !!ws.brief

  return (
    <div className="min-h-screen bg-[var(--m12-bg)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--m12-border)]/40">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push('/workshops')} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]" title="Back">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-[var(--m12-text)] truncate">{ws.title}</h1>
              <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: isLive ? '#059669' : '#6B7280', backgroundColor: isLive ? '#05966914' : '#6B728014' }}>{ws.status}</span>
              <VersionBadge />
            </div>
            {ws.customer_name && <div className="text-[10px] text-[var(--m12-text-muted)]">{ws.customer_name}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {roster.map((r) => (
            <div key={r.code} title={r.name} className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: `${r.color || '#2563EB'}1A`, color: r.color || '#2563EB' }}>
              {r.name.split('(')[0].trim().split(/[\s-]/).map((x) => x[0]).slice(0, 2).join('')}
            </div>
          ))}
          {!hasBrief && <button onClick={generateBrief} disabled={busy === 'brief'} className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium">{busy === 'brief' ? 'Preparing…' : 'Generate Brief'}</button>}
          {hasBrief && !isLive && ws.status !== 'completed' && <button onClick={() => setStatus('live')} className="bg-[#059669] hover:bg-[#10B981] text-white px-3 py-1.5 rounded-lg text-xs font-medium">Start Workshop</button>}
          {isLive && <button onClick={() => setStatus('completed')} className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 hover:border-[var(--m12-border)] text-[var(--m12-text-secondary)] px-3 py-1.5 rounded-lg text-xs font-medium">End & Recap</button>}
        </div>
      </div>

      {/* Prep view (no brief yet OR scheduled preview) */}
      {!isLive && ws.status !== 'completed' ? (
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-3xl mx-auto">
            {!hasBrief ? (
              <div className="text-center py-20 border border-dashed border-[var(--m12-border)]/60 rounded-2xl">
                <h2 className="text-lg font-semibold text-[var(--m12-text-secondary)] mb-2">Prep the workshop</h2>
                <p className="text-sm text-[var(--m12-text-muted)] mb-6 max-w-md mx-auto">The consultant agents will read {ws.customer_name || 'the customer'}&apos;s architecture for this topic and prepare a timeboxed agenda, a pre-read, the gaps to drive, and the questions to ask.</p>
                <button onClick={generateBrief} disabled={busy === 'brief'} className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium">{busy === 'brief' ? 'Preparing the brief…' : 'Generate Workshop Brief'}</button>
              </div>
            ) : (
              <BriefView ws={ws} agenda={agenda} onStart={() => setStatus('live')} />
            )}
          </div>
        </div>
      ) : ws.status === 'completed' ? (
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-base font-semibold text-[var(--m12-text)] mb-4">Workshop recap</h2>
            <CaptureGroups captures={confirmed.length ? confirmed : captures} streams={streams} onSet={setCap} readOnly />
            {captures.length === 0 && <p className="text-sm text-[var(--m12-text-muted)]">No captures were recorded.</p>}
          </div>
        </div>
      ) : (
        /* ─── Live Room: agenda | transcript | facilitation+captures ─── */
        <div className="flex-1 grid grid-cols-12 min-h-0">
          {/* Agenda rail */}
          <div className="col-span-3 border-r border-[var(--m12-border)]/40 overflow-auto p-4">
            <div className="text-[11px] uppercase tracking-wider text-[var(--m12-text-muted)] mb-3">Agenda</div>
            <div className="space-y-1.5">
              {agenda.map((a) => (
                <button key={a.id} onClick={() => setActive(a)}
                  className="w-full text-left rounded-lg border px-3 py-2 transition-colors"
                  style={{ borderColor: a.status === 'active' ? '#2563EB' : 'var(--m12-border)', backgroundColor: a.status === 'active' ? '#2563EB14' : 'transparent', opacity: a.status === 'done' ? 0.5 : 1 }}>
                  <div className="flex items-center gap-2">
                    {a.focus_type && <span className="text-[8px] uppercase tracking-wide px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--m12-bg)', color: 'var(--m12-text-muted)' }}>{a.focus_type}</span>}
                    {a.timebox_minutes ? <span className="text-[9px] text-[var(--m12-text-muted)] ml-auto">{a.timebox_minutes}m</span> : null}
                  </div>
                  <div className="text-[11px] text-[var(--m12-text)] leading-tight mt-1">{a.title}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Transcript */}
          <div className="col-span-6 flex flex-col min-h-0 border-r border-[var(--m12-border)]/40">
            <div ref={transcriptRef} className="flex-1 overflow-auto p-4 space-y-3">
              {messages.length === 0 && <div className="text-center text-xs text-[var(--m12-text-muted)] py-10">The room is ready. Type what&apos;s said, then Facilitate for the next question and Capture to log decisions.</div>}
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-2 ${m.speaker_kind === 'agent' ? '' : ''}`}>
                  <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: m.speaker_kind === 'agent' ? '#2563EB1A' : 'var(--m12-bg-card)', color: m.speaker_kind === 'agent' ? '#3B82F6' : 'var(--m12-text-muted)' }}>
                    {m.speaker_kind === 'agent' ? 'AI' : (m.speaker_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-[var(--m12-text-secondary)]">{m.speaker_name || m.speaker_role}</span>
                      {m.source === 'voice' && <span className="text-[8px] text-[var(--m12-text-muted)]">🎙</span>}
                    </div>
                    <div className="text-xs text-[var(--m12-text)] whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Composer */}
            <div className="border-t border-[var(--m12-border)]/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <input value={speaker} onChange={(e) => setSpeaker(e.target.value)} className="w-32 bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] outline-none" placeholder="Speaker" />
                <button onClick={facilitate} disabled={busy === 'facilitate'} className="text-[11px] px-2.5 py-1 rounded border border-[#2563EB]/50 text-[#3B82F6] hover:bg-[#2563EB14] disabled:opacity-50">{busy === 'facilitate' ? 'Thinking…' : '✦ Facilitate'}</button>
                <button onClick={capture} disabled={busy === 'capture'} className="text-[11px] px-2.5 py-1 rounded border border-[#059669]/50 text-[#10B981] hover:bg-[#05966914] disabled:opacity-50">{busy === 'capture' ? 'Capturing…' : '⎙ Capture'}</button>
                <span className="ml-auto text-[9px] text-[var(--m12-text-muted)]" title="Voice transcription lands in the next increment">🎙 voice: soon</span>
              </div>
              <div className="flex gap-2">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
                  rows={2} placeholder="Type what's being said in the room…  (Cmd/Ctrl+Enter to send)"
                  className="flex-1 bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 focus:border-[#2563EB] rounded-lg px-3 py-2 text-xs text-[var(--m12-text)] outline-none resize-none" />
                <button onClick={send} disabled={!input.trim()} className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-40 text-white px-3 rounded-lg text-xs font-medium">Send</button>
              </div>
            </div>
          </div>

          {/* Facilitation + captures */}
          <div className="col-span-3 overflow-auto p-4 space-y-4">
            {/* Facilitation panel */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--m12-text-muted)] mb-2">Facilitator</div>
              {fac ? (
                <div className="bg-[var(--m12-bg-card)] border border-[#2563EB]/30 rounded-lg p-3 space-y-2">
                  <div className="text-xs text-[var(--m12-text)] leading-relaxed">{fac.say}</div>
                  {fac.nextQuestion && (
                    <div className="pt-2 border-t border-[var(--m12-border)]/40">
                      <div className="text-[10px] uppercase tracking-wide text-[var(--m12-text-muted)] mb-1">Suggested question</div>
                      <div className="text-xs text-[#3B82F6] leading-relaxed mb-2">{fac.nextQuestion}</div>
                      <button onClick={() => askQuestion(fac.nextQuestion!)} className="text-[10px] px-2 py-1 rounded bg-[#2563EB] text-white hover:bg-[#3B82F6]">Ask this →</button>
                    </div>
                  )}
                  {fac.coverage && <div className="text-[10px] text-[var(--m12-text-muted)] pt-1">{fac.coverage}</div>}
                  {fac.gaps && fac.gaps.length > 0 && (
                    <div className="pt-2 border-t border-[var(--m12-border)]/40">
                      <div className="text-[10px] uppercase tracking-wide text-[#D97706] mb-1">Gaps flagged</div>
                      <ul className="text-[10px] text-[var(--m12-text-secondary)] space-y-0.5 list-disc list-inside">{fac.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
                    </div>
                  )}
                  {fac.pullSpecialist && <div className="text-[10px] text-[var(--m12-text-muted)]">Bring in: <span className="text-[var(--m12-text-secondary)]">{roster.find((r) => r.code === fac.pullSpecialist)?.name || fac.pullSpecialist}</span></div>}
                </div>
              ) : (
                <div className="text-[11px] text-[var(--m12-text-muted)] bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-3">Press <span className="text-[#3B82F6]">✦ Facilitate</span> for the next best question and coverage.</div>
              )}
            </div>

            {/* Captures */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-wider text-[var(--m12-text-muted)]">Captured {captures.length > 0 && <span className="text-[var(--m12-text-secondary)]">({captures.length})</span>}</div>
                {proposed.length > 0 && <span className="text-[9px] text-[#D97706]">{proposed.length} to review</span>}
              </div>
              <CaptureGroups captures={captures} streams={streams} onSet={setCap} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Brief view ──────────────────────────────────────────────
function BriefView({ ws, agenda, onStart }: { ws: Workshop; agenda: WorkshopAgendaItem[]; onStart: () => void }) {
  const b = ws.brief!
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--m12-text)]">Workshop Brief</h2>
        <button onClick={onStart} className="bg-[#059669] hover:bg-[#10B981] text-white px-4 py-2 rounded-lg text-xs font-medium">Start Workshop →</button>
      </div>
      <p className="text-sm text-[var(--m12-text-secondary)] leading-relaxed">{b.summary}</p>
      <Section title="Objectives"><ul className="space-y-1">{b.objectives?.map((o, i) => <li key={i} className="text-xs text-[var(--m12-text-secondary)] flex gap-2"><span className="text-[#2563EB]">•</span>{o}</li>)}</ul></Section>
      <Section title="Agenda">
        <div className="space-y-1.5">
          {(agenda.length ? agenda.map((a) => ({ title: a.title, objective: a.objective, focusType: a.focus_type, timeboxMinutes: a.timebox_minutes })) : b.agenda).map((a, i) => (
            <div key={i} className="flex items-start gap-3 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2">
              <span className="text-[10px] text-[var(--m12-text-muted)] mt-0.5 w-5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--m12-text)]">{a.title}</div>
                {a.objective && <div className="text-[10px] text-[var(--m12-text-muted)] mt-0.5">{a.objective}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.focusType && <span className="text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--m12-bg)] text-[var(--m12-text-muted)]">{a.focusType}</span>}
                {a.timeboxMinutes ? <span className="text-[9px] text-[var(--m12-text-muted)]">{a.timeboxMinutes}m</span> : null}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Pre-read"><p className="text-xs text-[var(--m12-text-secondary)] leading-relaxed whitespace-pre-wrap">{b.preRead}</p></Section>
      {b.gaps?.length > 0 && <Section title="Gaps & decisions to drive"><ul className="space-y-1">{b.gaps.map((g, i) => <li key={i} className="text-xs text-[var(--m12-text-secondary)] flex gap-2"><span className="text-[#D97706]">▸</span>{g}</li>)}</ul></Section>}
      {b.keyQuestions?.length > 0 && <Section title="Questions to prepare"><ul className="space-y-1">{b.keyQuestions.map((q, i) => <li key={i} className="text-xs text-[var(--m12-text-secondary)] flex gap-2"><span className="text-[#3B82F6]">?</span>{q}</li>)}</ul></Section>}
      {b.risks?.length > 0 && <Section title="Risks"><ul className="space-y-1">{b.risks.map((r, i) => <li key={i} className="text-xs text-[var(--m12-text-secondary)] flex gap-2"><span className="text-[#DC2626]">⚠</span>{r}</li>)}</ul></Section>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-[var(--m12-text-muted)] mb-2">{title}</div>
      {children}
    </div>
  )
}

// ─── Captures ────────────────────────────────────────────────
function CaptureGroups({ captures, streams, onSet, readOnly }: {
  captures: WorkshopCapture[]; streams: Workstream[]
  onSet: (c: WorkshopCapture, status: WorkshopCapture['status']) => void; readOnly?: boolean
}) {
  if (captures.length === 0) return <div className="text-[11px] text-[var(--m12-text-muted)]">Nothing captured yet.</div>
  const order: CaptureType[] = ['decision', 'action', 'deliverable', 'architecture_change', 'risk', 'question', 'parking_lot']
  return (
    <div className="space-y-2">
      {order.filter((t) => captures.some((c) => c.capture_type === t)).map((t) => {
        const meta = CAPTURE_META[t]
        return (
          <div key={t}>
            <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: meta.color }}>{meta.label}</div>
            <div className="space-y-1.5">
              {captures.filter((c) => c.capture_type === t).map((c) => (
                <div key={c.id} className="bg-[var(--m12-bg-card)] border rounded-lg px-2.5 py-2" style={{ borderColor: c.status === 'proposed' ? `${meta.color}55` : 'var(--m12-border)', opacity: c.status === 'dismissed' ? 0.4 : 1 }}>
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] mt-0.5" style={{ color: meta.color }}>{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-[var(--m12-text)] leading-snug">{c.title}</div>
                      {c.detail && <div className="text-[10px] text-[var(--m12-text-muted)] mt-0.5">{c.detail}</div>}
                      {(c.owner || c.due_date) && <div className="text-[9px] text-[var(--m12-text-muted)] mt-1">{c.owner}{c.owner && c.due_date ? ' · ' : ''}{c.due_date}</div>}
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {c.status === 'proposed' ? (
                        <>
                          <button onClick={() => onSet(c, 'confirmed')} className="text-[9px] px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: meta.color }}>Confirm</button>
                          {c.capture_type === 'architecture_change' && <button onClick={() => onSet(c, 'applied')} className="text-[9px] px-1.5 py-0.5 rounded border border-[#059669]/50 text-[#10B981]" title="Apply to the architecture model (write comes in a later increment)">Apply</button>}
                          <button onClick={() => onSet(c, 'dismissed')} className="text-[9px] px-1.5 py-0.5 rounded text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]">Dismiss</button>
                        </>
                      ) : (
                        <span className="text-[9px]" style={{ color: c.status === 'dismissed' ? 'var(--m12-text-muted)' : meta.color }}>{c.status}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
