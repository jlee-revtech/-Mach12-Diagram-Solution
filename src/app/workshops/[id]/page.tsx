'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import {
  getWorkshop, updateWorkshop, listAgenda, updateAgendaItem, updateWorkshopDuration,
  listMessages, addMessage, listCaptures, updateCapture, setParticipants,
  listAgendaContent, restartWorkshop, archiveWorkshop, readWorkshopShare, addWorkshopAgendaItem,
  type AgendaContentRow, type WorkshopShare,
} from '@/lib/supabase/workshops'
import type { Workshop, WorkshopAgendaItem, WorkshopMessage, WorkshopCapture, CaptureType } from '@/lib/workshop/types'
import { CAPTURE_META, DURATION_OPTIONS, DEFAULT_DURATION_MINUTES } from '@/lib/workshop/types'
import { createTranscription, type TranscriptionProvider } from '@/lib/workshop/transcription'
import { exportRecapDocx, exportRecapPptx, exportFacilitationPptx } from '@/lib/workshop/export'
import { loadFacilitationDeck } from '@/lib/workshop/deck'
import type { WorkshopRecapData } from '@jlee-revtech/agent-core'
import type { Workstream } from '@/lib/workstream/types'
import {
  Archive, ArrowLeft, ChevronDown, ClipboardList, Download, Link2, Mic,
  MoreHorizontal, Play, Plus, Presentation, RefreshCw, RotateCcw, Settings2,
  Sparkles, Upload,
} from 'lucide-react'
import { Button, EmptyState } from '@/components/common'
import VersionBadge from '@/components/VersionBadge'
import SectionCard from '@/components/workshop/SectionCard'
import SectionEditor from '@/components/workshop/SectionEditor'
import BriefLoading from '@/components/workshop/BriefLoading'
import TranscriptUploadDialog from '@/components/workshop/TranscriptUploadDialog'
import WorkshopShareDialog from '@/components/workshop/WorkshopShareDialog'
import ManageWorkstreamsDialog from '@/components/workshop/ManageWorkstreamsDialog'

interface FacResult {
  say: string; nextQuestion?: string; coverage?: string; advanceAgenda?: boolean; pullSpecialist?: string; gaps?: string[]
}

const VOICE_CLOUD = process.env.NEXT_PUBLIC_VOICE_PROVIDER === 'deepgram'

const roomMenuItemCls = 'w-full text-left px-3 py-2 text-body-sm text-text-secondary hover:bg-surface-muted hover:text-text-primary disabled:opacity-40 transition-colors flex items-start gap-2'

function authHeader(): Record<string, string> {
  try {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    const raw = key ? localStorage.getItem(key) : null
    const tok = raw ? JSON.parse(raw)?.access_token : null
    return tok ? { Authorization: `Bearer ${tok}` } : {}
  } catch { return {} }
}

export default function WorkshopRoomPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { user, profile, organization, loading } = useAuth()

  const [ws, setWs] = useState<Workshop | null>(null)
  const [streams, setStreams] = useState<Workstream[]>([])
  const [agenda, setAgenda] = useState<WorkshopAgendaItem[]>([])
  const [content, setContent] = useState<AgendaContentRow[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [durationMinutes, setDurationMinutes] = useState<number>(DEFAULT_DURATION_MINUTES)
  // 047: workshop-level guidance prompt (persisted to workshops.facilitation_prompt).
  const [facPrompt, setFacPrompt] = useState<string>('')
  const [facPromptSaved, setFacPromptSaved] = useState(false)
  const [regenProgress, setRegenProgress] = useState<{ done: number; total: number } | null>(null)
  const [messages, setMessages] = useState<WorkshopMessage[]>([])
  const [captures, setCaptures] = useState<WorkshopCapture[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [fac, setFac] = useState<FacResult | null>(null)
  const [input, setInput] = useState('')
  const [speaker, setSpeaker] = useState('')
  const [voiceOn, setVoiceOn] = useState(false)
  const [interim, setInterim] = useState('')
  const [recap, setRecap] = useState<WorkshopRecapData | null>(null)
  const [pickSpecialist, setPickSpecialist] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [manageWsOpen, setManageWsOpen] = useState(false)
  const [sectionsMenu, setSectionsMenu] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const voiceRef = useRef<TranscriptionProvider | null>(null)
  const speakerRef = useRef('')

  const me = profile?.display_name || user?.email?.split('@')[0] || 'Facilitator'

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  const load = useCallback(async () => {
    if (!organization || !id) return
    const [w, s, a, ct, m, c] = await Promise.all([
      getWorkshop(id), listWorkstreams(organization.id), listAgenda(id), listAgendaContent(id), listMessages(id), listCaptures(id),
    ])
    setWs(w); setStreams(s); setAgenda(a); setContent(ct); setMessages(m); setCaptures(c)
    if (w?.duration_minutes) setDurationMinutes(w.duration_minutes)
    setFacPrompt(w?.facilitation_prompt || '')
    if (w?.recap) setRecap(w.recap as WorkshopRecapData)
  }, [organization, id])

  // Reload only the per-section content rows (after a section generate/revise).
  const reloadContent = useCallback(async () => {
    if (!id) return
    setContent(await listAgendaContent(id))
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSpeaker(me) }, [me])
  useEffect(() => { speakerRef.current = speaker }, [speaker])
  useEffect(() => { transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight }) }, [messages, interim])

  const roster = (ws?.workstream_codes || []).map((c) => streams.find((s) => s.code === c)).filter(Boolean) as Workstream[]

  // ─── Voice transcription (Web Speech API; final utterances -> transcript) ──
  useEffect(() => {
    if (!voiceOn || !ws || ws.status !== 'live') { voiceRef.current?.stop(); voiceRef.current = null; return }
    const t = createTranscription()
    if (!t.supported) { alert('Voice transcription needs Chrome or Edge (Web Speech API).'); setVoiceOn(false); return }
    voiceRef.current = t
    t.start(async (r) => {
      if (r.isFinal) {
        setInterim('')
        if (r.text) {
          await addMessage(ws.id, { speaker_kind: 'person', speaker_name: speakerRef.current || me, speaker_role: 'participant', content: r.text, source: 'voice' })
          setMessages(await listMessages(ws.id))
        }
      } else setInterim(r.text)
    }, (msg) => { alert(msg); setVoiceOn(false) })
    return () => { t.stop(); voiceRef.current = null; setInterim('') }
  }, [voiceOn, ws, me])

  // ─── Prep: generate brief ─────────────────────────────────
  // The brief route now persists the agenda server-side (with section_kind /
  // workstream_code) and stores duration_minutes, so we pass workshopId +
  // durationMinutes and STOP persisting the agenda client-side. After it returns
  // we reload from the DB so the normalized timeboxes + section metadata show.
  const generateBrief = useCallback(async () => {
    if (!ws || !organization) return
    setBusy('brief')
    try {
      const res = await fetch('/api/workshops/brief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId: ws.id, orgId: organization.id, topic: ws.topic || ws.title, objective: ws.objective, customerName: ws.customer_name, workstreamCodes: ws.workstream_codes, focusAreas: ws.focus_areas, durationMinutes }),
      })
      const data = await res.json()
      if (!res.ok || !data.brief) throw new Error(data.error || 'Brief generation failed')
      // Participants are non-critical: never let a failure here block the reload
      // that surfaces the persisted brief + agenda.
      try {
        await setParticipants(ws.id,
          [{ display_name: me, org_role: 'Facilitator' }],
          [{ workstream_code: 'enterprise', display_name: 'Enterprise Architect', is_facilitator: true },
           ...roster.map((r) => ({ workstream_code: r.code, display_name: r.name.split('(')[0].trim() }))])
      } catch { /* keep going */ }
      await load()
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }, [ws, organization, me, roster, durationMinutes, load])

  // Save the workshop length from the prep panel (persists duration_minutes).
  const saveDuration = useCallback(async (minutes: number) => {
    setDurationMinutes(minutes)
    if (ws) await updateWorkshopDuration(ws.id, minutes)
  }, [ws])

  // Add/hide workstreams (non-destructive). Hiding just drops the code from the
  // workshop's active set (agenda item + content are kept, filtered from view);
  // adding a brand-new workstream creates a fresh section to author into.
  const applyWorkstreams = useCallback(async (selectedCodes: string[]) => {
    if (!ws) return
    const current = ws.workstream_codes || []
    const existingWsCodes = new Set(
      agenda.filter((a) => a.section_kind === 'workstream' && a.workstream_code).map((a) => a.workstream_code),
    )
    const toAdd = selectedCodes.filter((c) => !current.includes(c))
    const evalItem = agenda.find((a) => a.section_kind === 'evaluation')
    const maxSort = agenda.reduce((m, a) => Math.max(m, a.sort_order), 0)
    let insertAt = evalItem ? evalItem.sort_order : maxSort + 1
    for (const code of toAdd) {
      if (existingWsCodes.has(code)) continue // un-hiding: its section already exists
      const wsName = streams.find((s) => s.code === code)?.name || code
      await addWorkshopAgendaItem(ws.id, { title: wsName, section_kind: 'workstream', workstream_code: code, sort_order: insertAt, status: 'pending' })
      insertAt += 1
    }
    // Keep the evaluation section last if new workstream sections pushed past it.
    if (evalItem && insertAt !== evalItem.sort_order) await updateAgendaItem(evalItem.id, { sort_order: insertAt })
    await updateWorkshop(ws.id, { workstream_codes: selectedCodes })
    setWs((prev) => (prev ? { ...prev, workstream_codes: selectedCodes } : prev))
    await load()
  }, [ws, agenda, streams, load])

  // Persist the workshop-level guidance prompt (047). Threaded server-side as
  // `guidance` into every section generate and the brief; no body change needed
  // on the client calls, the routes read facilitation_prompt off the workshop.
  const saveFacPrompt = useCallback(async () => {
    if (!ws) return
    const text = facPrompt.trim()
    await updateWorkshop(ws.id, { facilitation_prompt: text || null })
    setWs((prev) => (prev ? { ...prev, facilitation_prompt: text || null } : prev))
    setFacPromptSaved(true)
    setTimeout(() => setFacPromptSaved(false), 1800)
  }, [ws, facPrompt])

  // Regenerate content across every section that already has a content row,
  // honoring the workshop-level guidance (saved first). Keeps the agenda intact;
  // runs with small concurrency and shows progress, then reloads the rows.
  const regenerateContent = useCallback(async () => {
    if (!ws || !organization) return
    const ids = content.filter((c) => !!c.content).map((c) => c.agenda_item_id)
    if (ids.length === 0) return
    setBusy('regen-content')
    // Save the prompt first so the section route reads the latest guidance.
    try {
      const text = facPrompt.trim()
      await updateWorkshop(ws.id, { facilitation_prompt: text || null })
      setWs((prev) => (prev ? { ...prev, facilitation_prompt: text || null } : prev))
    } catch { /* keep going; a stale prompt is better than blocking the regen */ }

    setRegenProgress({ done: 0, total: ids.length })
    let done = 0
    const CONCURRENCY = 2
    const queue = [...ids]
    const worker = async () => {
      for (;;) {
        const agendaItemId = queue.shift()
        if (!agendaItemId) return
        try {
          await fetch('/api/workshops/section', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workshopId: ws.id, orgId: organization.id, agendaItemId }),
          })
        } catch { /* one section failing should not abort the batch */ }
        done += 1
        setRegenProgress({ done, total: ids.length })
      }
    }
    try {
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker()))
      await reloadContent()
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    finally { setRegenProgress(null); setBusy(null) }
  }, [ws, organization, content, facPrompt, reloadContent])

  // Directly run the section route for one agenda item (used by the prep-level
  // "Generate Solution Architecture Evaluation" action). SectionEditor has its
  // own inline generate; this drives the same route for the evaluation card.
  const runSection = useCallback(async (agendaItemId: string) => {
    if (!ws || !organization) return
    setBusy(`section:${agendaItemId}`)
    try {
      const res = await fetch('/api/workshops/section', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId: ws.id, orgId: organization.id, agendaItemId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Section generation failed')
      setSelectedItemId(agendaItemId)
      await reloadContent()
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }, [ws, organization, reloadContent])

  // Download the facilitation deck as PPTX. Loads the same normalized slide model
  // the Workshop Experience uses (loadFacilitationDeck), then hands it to the
  // shared exporter. Enabled once at least one section has authored content.
  const downloadFacilitationPptx = useCallback(async () => {
    if (!ws) return
    setBusy('deck')
    try {
      const deck = await loadFacilitationDeck(null, ws.id)
      if (deck.slides.length === 0) throw new Error('No facilitation content yet. Generate a section first.')
      await exportFacilitationPptx(
        {
          title: deck.workshop.title,
          ...(deck.workshop.customerName ? { customerName: deck.workshop.customerName } : {}),
          ...(deck.workshop.topic ? { topic: deck.workshop.topic } : {}),
          ...(deck.workshop.durationMinutes ? { durationMinutes: deck.workshop.durationMinutes } : {}),
        },
        deck.slides,
      )
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }, [ws])

  const setStatus = useCallback(async (status: Workshop['status']) => {
    if (!ws) return
    const stamp = status === 'live' ? { started_at: new Date().toISOString() } : {}
    await updateWorkshop(ws.id, { status, ...stamp })
    await load()
  }, [ws, load])

  // ─── Restart (reopen prep, non-destructive) / Archive ─────
  const [menuOpen, setMenuOpen] = useState(false)
  const restartThis = useCallback(async () => {
    if (!ws) return
    if (!confirm('Restart this workshop back to the prep phase? Your brief, agenda, section content, transcript, captures, and recap are all preserved. Nothing is deleted.')) return
    setMenuOpen(false); setBusy('restart')
    try { await restartWorkshop(ws.id); await load() } catch (e) { alert(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }, [ws, load])
  const archiveThis = useCallback(async () => {
    if (!ws) return
    if (!confirm('Archive this workshop? It moves to the Archived list; you can restore it anytime from there. No data is deleted.')) return
    setMenuOpen(false)
    try { await archiveWorkshop(ws.id); router.push('/workshops') } catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
  }, [ws, router])

  const endAndRecap = useCallback(async () => {
    if (!ws || !organization) return
    setVoiceOn(false)
    setBusy('recap')
    try {
      await updateWorkshop(ws.id, { status: 'completed', ended_at: new Date().toISOString() })
      const res = await fetch('/api/workshops/recap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workshopId: ws.id, orgId: organization.id }) })
      const data = await res.json()
      if (res.ok && data.recap) setRecap(data.recap)
      await load()
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }, [ws, organization, load])

  // ─── Live: transcript + facilitation + specialists + capture ──
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

  const contribute = useCallback(async (code: string) => {
    if (!ws || !organization) return
    setPickSpecialist(false)
    setBusy(`contribute:${code}`)
    try {
      const active = agenda.find((a) => a.status === 'active')
      const transcript = messages.slice(-16).map((m) => ({ speaker: m.speaker_name || m.speaker_role || 'participant', role: m.speaker_role, content: m.content }))
      const res = await fetch('/api/workshops/contribute', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ workshopId: ws.id, orgId: organization.id, workstreamCode: code, focus: active?.focus_type, transcript }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Contribution failed')
      await addMessage(ws.id, { speaker_kind: 'agent', speaker_name: data.workstreamName || code, speaker_role: 'specialist', workstream_code: code, content: data.text, source: 'agent' })
      setMessages(await listMessages(ws.id))
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }, [ws, organization, agenda, messages])

  const capture = useCallback(async () => {
    if (!ws || !organization) return
    setBusy('capture')
    try {
      const res = await fetch('/api/workshops/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workshopId: ws.id, orgId: organization.id }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Capture failed')
      setCaptures(await listCaptures(ws.id))
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }, [ws, organization])

  const setCap = useCallback(async (c: WorkshopCapture, status: WorkshopCapture['status']) => {
    await updateCapture(c.id, { status })
    setCaptures((cs) => cs.map((x) => (x.id === c.id ? { ...x, status } : x)))
  }, [])

  const applyCapture = useCallback(async (c: WorkshopCapture) => {
    if (!organization) return
    setBusy(`apply:${c.id}`)
    try {
      const res = await fetch('/api/workshops/apply', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify({ orgId: organization.id, captureId: c.id }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Apply failed')
      setCaptures((cs) => cs.map((x) => (x.id === c.id ? { ...x, status: 'applied' } : x)))
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }, [organization])

  const setActive = useCallback(async (item: WorkshopAgendaItem) => {
    for (const a of agenda) if (a.status === 'active' && a.id !== item.id) await updateAgendaItem(a.id, { status: 'done' })
    await updateAgendaItem(item.id, { status: 'active' })
    setAgenda(await listAgenda(ws!.id))
  }, [agenda, ws])

  if (loading || !user || !organization || !ws) return null

  const proposed = captures.filter((c) => c.status === 'proposed')
  const isLive = ws.status === 'live'
  const hasBrief = !!ws.brief
  const contribBusy = busy?.startsWith('contribute:') ? busy.split(':')[1] : null

  // ─── Prep section-authoring derived state ───
  const contentByItem = new Map(content.map((c) => [c.agenda_item_id, c]))
  const wsByCode = (code?: string | null) => (code ? streams.find((s) => s.code === code) ?? null : null)
  // Hidden workstreams (code removed from the workshop) keep their section + content
  // in the DB but are filtered out of the prep view, the deck, and the roster.
  const activeCodes = new Set(ws.workstream_codes || [])
  const isVisibleItem = (a: WorkshopAgendaItem) =>
    a.section_kind !== 'workstream' || !a.workstream_code || activeCodes.has(a.workstream_code)
  const visibleAgenda = agenda.filter(isVisibleItem)
  const visibleItemIds = new Set(visibleAgenda.map((a) => a.id))
  const selectedItem = agenda.find((a) => a.id === selectedItemId) ?? null
  const evaluationItem = visibleAgenda.find((a) => a.section_kind === 'evaluation') ?? null
  const hasWorkstreamContent = visibleAgenda.some(
    (a) => a.section_kind === 'workstream' && !!contentByItem.get(a.id)?.content,
  )
  // Enable the Workshop Experience once any visible section has authored content.
  const hasAnyContent = content.some((c) => !!c.content && visibleItemIds.has(c.agenda_item_id))
  // Workstream codes that already have authored content (for the manage dialog).
  const wsCodeByItem = new Map(agenda.map((a) => [a.id, a.workstream_code]))
  const codesWithContent = [...new Set(content.filter((c) => !!c.content).map((c) => wsCodeByItem.get(c.agenda_item_id)).filter((x): x is string => !!x))]

  return (
    <div className="min-h-screen bg-surface-muted flex flex-col">
      {/* Header */}
      {busy === 'brief' && (
        <BriefLoading
          customerName={ws.customer_name || undefined}
          workstreamCount={roster.length || (ws.workstream_codes || []).length}
          durationMinutes={durationMinutes}
          mode={hasBrief ? 'regenerate' : 'brief'}
        />
      )}
      {uploadOpen && (
        <TranscriptUploadDialog
          workshopId={ws.id}
          onClose={() => setUploadOpen(false)}
          onImported={async () => { setMessages(await listMessages(ws.id)) }}
        />
      )}
      {shareOpen && (
        <WorkshopShareDialog
          workshopId={ws.id}
          initialShare={readWorkshopShare(ws)}
          onClose={() => setShareOpen(false)}
          onChange={(share: WorkshopShare) => setWs((prev) => (prev ? { ...prev, settings: { ...(prev.settings || {}), share } } : prev))}
        />
      )}
      {manageWsOpen && (
        <ManageWorkstreamsDialog
          streams={streams}
          activeCodes={ws.workstream_codes || []}
          codesWithContent={codesWithContent}
          onClose={() => setManageWsOpen(false)}
          onSave={applyWorkstreams}
        />
      )}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft size={14} />} title="Back" aria-label="Back to workshops" onClick={() => router.push('/workshops')} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-body-md font-semibold text-text-primary truncate">{ws.title}</h1>
              <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${isLive ? 'bg-status-green-bg text-status-green' : 'bg-gray-100 text-gray-500'}`}>{ws.status}</span>
              <VersionBadge />
            </div>
            {ws.customer_name && <div className="text-[11px] text-text-tertiary">{ws.customer_name}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {roster.map((r) => (
            <div key={r.code} title={r.name} className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: `${r.color || '#2563EB'}1A`, color: r.color || '#2563EB' }}>
              {r.name.split('(')[0].trim().split(/[\s-]/).map((x) => x[0]).slice(0, 2).join('')}
            </div>
          ))}
          {!hasBrief && <Button variant="primary" size="sm" onClick={generateBrief} disabled={busy === 'brief'}>{busy === 'brief' ? 'Preparing...' : 'Generate Brief'}</Button>}
          {hasBrief && !isLive && ws.status !== 'completed' && (
            <button onClick={() => setStatus('live')} className="bg-status-green hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors">Start Workshop</button>
          )}
          {isLive && <Button variant="secondary" size="sm" onClick={endAndRecap} disabled={busy === 'recap'}>{busy === 'recap' ? 'Wrapping...' : 'End & Recap'}</Button>}
          <div className="relative">
            <Button variant="ghost" size="sm" iconOnly icon={<MoreHorizontal size={14} />} title="Workshop actions" aria-label="Workshop actions"
              disabled={busy === 'restart'} onClick={() => setMenuOpen((v) => !v)} />
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-20 w-56 rounded-lg border border-border bg-white shadow-dropdown py-1 animate-slide-in-up">
                  <button onClick={restartThis} disabled={busy === 'restart'} className={roomMenuItemCls}>
                    <RotateCcw size={14} className="mt-0.5 shrink-0" />
                    <span>
                      Restart to prep
                      <span className="block text-[10px] text-text-tertiary mt-0.5">Reopen prep; keeps all content and data</span>
                    </span>
                  </button>
                  <button onClick={archiveThis} className={roomMenuItemCls}><Archive size={14} className="mt-0.5 shrink-0" /> Archive workshop</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Prep view */}
      {!isLive && ws.status !== 'completed' ? (
        !hasBrief ? (
          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-3xl mx-auto">
              <EmptyState
                variant="dashed"
                icon={<Presentation size={40} />}
                title="Prep the workshop"
                description={`The consultant agents will read ${ws.customer_name || 'the customer'}'s architecture for this topic and prepare a timeboxed agenda, a pre-read, the gaps to drive, and the questions to ask.`}
                action={
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-label uppercase text-text-secondary">Workshop length</span>
                      <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} title="Workshop length" aria-label="Workshop length"
                        className="h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none">
                        {DURATION_OPTIONS.map((d) => <option key={d.minutes} value={d.minutes}>{d.label}</option>)}
                      </select>
                    </div>
                    <Button variant="primary" size="lg" onClick={generateBrief} disabled={busy === 'brief'}>
                      {busy === 'brief' ? 'Preparing the brief...' : 'Generate Workshop Brief'}
                    </Button>
                  </div>
                }
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-12 min-h-0">
            {/* Left: brief summary + section cards */}
            <div className="col-span-5 border-r border-border overflow-auto p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-label uppercase text-text-secondary shrink-0">Sections</div>
                <div className="flex items-center gap-1.5">
                  <select value={durationMinutes} onChange={(e) => saveDuration(Number(e.target.value))} title="Workshop length" aria-label="Workshop length"
                    className="h-8 px-2 rounded-lg border border-border bg-surface-input text-[11px] text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500">
                    {DURATION_OPTIONS.map((d) => <option key={d.minutes} value={d.minutes}>{d.label}</option>)}
                  </select>
                  <Button
                    variant="primary" size="sm"
                    icon={<Play size={12} />}
                    onClick={() => router.push(`/workshops/${ws.id}/present`)}
                    disabled={!hasAnyContent}
                    title={hasAnyContent ? 'Open the full-screen Workshop Experience' : 'Generate at least one section first'}
                  >
                    Workshop Experience
                  </Button>
                  <div className="relative">
                    <Button
                      variant="secondary" size="sm"
                      trailingIcon={<ChevronDown size={12} />}
                      onClick={() => setSectionsMenu((v) => !v)}
                      title="More actions"
                      aria-label="More actions"
                    >
                      More
                    </Button>
                    {sectionsMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setSectionsMenu(false)} />
                        <div className="absolute right-0 top-9 z-20 w-64 rounded-lg border border-border bg-white shadow-dropdown py-1 animate-slide-in-up">
                          <button onClick={() => { setSectionsMenu(false); setManageWsOpen(true) }} className={roomMenuItemCls}>
                            <Settings2 size={14} className="mt-0.5 shrink-0" /> Add or hide workstreams
                          </button>
                          <div className="my-1 border-t border-border" />
                          <button onClick={() => { setSectionsMenu(false); downloadFacilitationPptx() }} disabled={!hasAnyContent || busy === 'deck'} className={roomMenuItemCls}>
                            <Download size={14} className="mt-0.5 shrink-0" /> {busy === 'deck' ? 'Preparing deck...' : 'Download facilitation deck (PPTX)'}
                          </button>
                          <button onClick={() => { setSectionsMenu(false); setShareOpen(true) }} className={roomMenuItemCls}>
                            <Link2 size={14} className="mt-0.5 shrink-0" /> Share prep (public link)
                          </button>
                          <div className="my-1 border-t border-border" />
                          <button onClick={() => { setSectionsMenu(false); generateBrief() }} disabled={busy === 'brief'} className={roomMenuItemCls}>
                            <RefreshCw size={14} className="mt-0.5 shrink-0" /> {busy === 'brief' ? 'Regenerating brief...' : 'Regenerate brief + agenda'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Workshop-level guidance prompt (047). Persisted to
                  workshops.facilitation_prompt and honored by Regenerate brief,
                  Regenerate content, and every per-section generate. */}
              <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-brand-600">Guidance for all content</div>
                <textarea
                  value={facPrompt}
                  onChange={(e) => setFacPrompt(e.target.value)}
                  onBlur={saveFacPrompt}
                  rows={2}
                  placeholder="Tone, emphasis, what to include or avoid. e.g. Keep it executive-level, favor buy over build, and flag any FAR/DFARS exposure."
                  className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-body-sm text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none resize-none"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={saveFacPrompt}
                    disabled={busy === 'regen-content' || facPrompt === (ws.facilitation_prompt || '')}
                    className="text-[11px] px-2 py-1 rounded border border-brand-200 text-brand-600 hover:bg-brand-100 disabled:opacity-40 transition-colors"
                  >
                    {facPromptSaved ? 'Saved' : 'Save guidance'}
                  </button>
                  <button
                    onClick={regenerateContent}
                    disabled={!hasAnyContent || busy === 'regen-content'}
                    title={hasAnyContent ? 'Save the prompt, then regenerate every section that has content honoring it' : 'Generate at least one section first'}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-40 transition-colors"
                  >
                    <RefreshCw size={10} />
                    {busy === 'regen-content'
                      ? (regenProgress ? `Regenerating ${regenProgress.done}/${regenProgress.total}...` : 'Regenerating...')
                      : 'Regenerate content'}
                  </button>
                  <span className="text-[10px] text-text-tertiary leading-snug">
                    Honored by Regenerate brief, Regenerate content, and each section generate.
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {visibleAgenda.map((a, i) => (
                  <SectionCard
                    key={a.id}
                    item={a}
                    index={i}
                    content={contentByItem.get(a.id)}
                    workstream={wsByCode(a.workstream_code)}
                    selected={selectedItemId === a.id}
                    onSelect={() => setSelectedItemId(a.id)}
                  />
                ))}
              </div>

              {/* Evaluation action (req 5) */}
              {evaluationItem && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <div className="text-body-sm font-medium text-text-primary mb-0.5">Solution Architecture Evaluation</div>
                  <div className="text-[11px] text-text-tertiary mb-2">Synthesizes across the workstream recommendations to reconcile where they diverge. Generate the workstream sections first.</div>
                  <button
                    onClick={() => runSection(evaluationItem.id)}
                    disabled={!hasWorkstreamContent || busy === `section:${evaluationItem.id}`}
                    className="text-[11px] px-2.5 py-1 rounded bg-[#7C3AED] hover:bg-[#8B5CF6] disabled:opacity-40 text-white font-medium transition-colors"
                    title={hasWorkstreamContent ? 'Generate the cross-workstream evaluation' : 'Generate at least one workstream section first'}
                  >
                    {busy === `section:${evaluationItem.id}` ? 'Synthesizing...' : 'Generate Solution Architecture Evaluation'}
                  </button>
                </div>
              )}

              {!ws.brief?.objectives?.length && !agenda.length && !ws.brief?.preRead?.trim() && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px]">
                  <div className="font-medium text-text-primary mb-1">The brief came back empty</div>
                  <div className="text-text-secondary mb-2">No objectives, agenda, or pre-read were returned. This is usually transient (a model hiccup or a missing ANTHROPIC_API_KEY). Regenerate to try again.</div>
                  <button onClick={generateBrief} disabled={busy === 'brief'} className="text-[11px] px-2 py-1 rounded bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white font-medium transition-colors">Regenerate brief</button>
                </div>
              )}
              <details open className="rounded-lg border border-border bg-white shadow-card px-3 py-2">
                <summary className="text-label uppercase text-text-secondary cursor-pointer">Workshop brief</summary>
                <div className="mt-3"><BriefView ws={ws} agenda={visibleAgenda} onStart={() => setStatus('live')} /></div>
              </details>
            </div>

            {/* Right: section editor */}
            <div className="col-span-7 overflow-auto p-6">
              {selectedItem ? (
                <SectionEditor
                  key={selectedItem.id}
                  workshopId={ws.id}
                  orgId={organization.id}
                  item={selectedItem}
                  workstream={wsByCode(selectedItem.workstream_code)}
                  content={contentByItem.get(selectedItem.id)}
                  onSaved={reloadContent}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-center">
                  <div className="max-w-sm">
                    <div className="text-body-md font-semibold text-text-secondary mb-1">Author the facilitation content</div>
                    <p className="text-body-sm text-text-tertiary">Pick a section on the left to generate its content: overview talking points, workstream key decisions with recommendations, or the cross-workstream evaluation.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      ) : ws.status === 'completed' ? (
        <RecapView ws={ws} recap={recap} captures={captures} streams={streams} onSet={setCap} busy={busy} onRegen={endAndRecap} />
      ) : (
        /* ─── Live Room ─── */
        <div className="flex-1 grid grid-cols-12 min-h-0">
          {/* Agenda rail */}
          <div className="col-span-3 border-r border-border overflow-auto p-4">
            <div className="text-label uppercase text-text-secondary mb-3">Agenda</div>
            <div className="space-y-1.5">
              {visibleAgenda.map((a) => (
                <button key={a.id} onClick={() => setActive(a)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${a.status === 'active' ? 'border-brand-500 bg-brand-50' : 'border-border bg-white hover:bg-surface-muted'}`}
                  style={{ opacity: a.status === 'done' ? 0.5 : 1 }}>
                  <div className="flex items-center gap-2">
                    {a.focus_type && <span className="text-[10px] uppercase tracking-wide px-1 py-0.5 rounded bg-surface-muted text-text-tertiary">{a.focus_type}</span>}
                    {a.timebox_minutes ? <span className="text-[10px] text-text-tertiary ml-auto">{a.timebox_minutes}m</span> : null}
                  </div>
                  <div className="text-[11px] text-text-primary leading-tight mt-1">{a.title}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Transcript */}
          <div className="col-span-6 flex flex-col min-h-0 border-r border-border bg-white">
            <div ref={transcriptRef} className="flex-1 overflow-auto p-4 space-y-3">
              {messages.length === 0 && !interim && <div className="text-center text-body-sm text-text-tertiary py-10">The room is ready. Turn on voice or type what&apos;s said, then Facilitate for the next question, bring in a specialist, and Capture to log decisions.</div>}
              {messages.map((m) => (
                <div key={m.id} className="flex gap-2">
                  <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold ${m.speaker_kind === 'agent' ? 'bg-brand-50 text-brand-600' : 'bg-surface-muted text-text-tertiary'}`}>
                    {m.speaker_kind === 'agent' ? 'AI' : (m.speaker_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-text-secondary">{m.speaker_name || m.speaker_role}</span>
                      {m.speaker_role === 'specialist' && <span className="text-[10px] uppercase tracking-wide px-1 py-0.5 rounded bg-brand-50 text-brand-600">specialist</span>}
                      {m.source === 'voice' && <span title="Voice"><Mic size={10} className="text-text-tertiary" /></span>}
                    </div>
                    <div className="text-body-sm text-text-primary whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  </div>
                </div>
              ))}
              {interim && <div className="flex gap-2 opacity-50"><div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center bg-surface-muted text-text-tertiary"><Mic size={12} /></div><div className="text-body-sm text-text-tertiary italic pt-1">{interim}...</div></div>}
            </div>
            {/* Composer */}
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <input value={speaker} onChange={(e) => setSpeaker(e.target.value)} className="w-28 h-7 px-2 rounded-lg border border-border bg-surface-input text-[11px] text-text-primary focus:outline-none focus:border-brand-500" placeholder="Speaker" />
                <button onClick={() => setVoiceOn((v) => !v)} title={`Live voice transcription - ${VOICE_CLOUD ? 'Deepgram (cloud)' : 'browser (Chrome/Edge)'}`}
                  className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${voiceOn ? 'border-red-300 text-red-600 bg-red-50' : 'border-border text-text-secondary hover:bg-surface-muted'}`}>
                  <Mic size={12} />{voiceOn ? 'Recording' : 'Voice'}{VOICE_CLOUD ? <span className="opacity-60"> (cloud)</span> : null}
                </button>
                <button onClick={() => setUploadOpen(true)} title="Upload or paste a transcript into this workshop" className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors"><Upload size={12} /> Transcript</button>
                <button onClick={facilitate} disabled={busy === 'facilitate'} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-brand-200 text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition-colors"><Sparkles size={12} />{busy === 'facilitate' ? 'Thinking...' : 'Facilitate'}</button>
                <div className="relative">
                  <button onClick={() => setPickSpecialist((v) => !v)} disabled={!!contribBusy} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-[#7C3AED]/50 text-[#7C3AED] hover:bg-[#7C3AED]/10 disabled:opacity-50 transition-colors"><Plus size={12} />{contribBusy ? 'Consulting...' : 'Bring in specialist'}</button>
                  {pickSpecialist && (
                    <div className="absolute bottom-full mb-1 left-0 z-10 bg-white border border-border rounded-lg shadow-dropdown p-1 w-56 max-h-56 overflow-auto animate-slide-in-up">
                      {roster.map((r) => (
                        <button key={r.code} onClick={() => contribute(r.code)} className="w-full text-left px-2 py-1.5 rounded text-[11px] text-text-primary hover:bg-surface-muted">{r.name.split('(')[0].trim()}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={capture} disabled={busy === 'capture'} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-status-green/50 text-status-green hover:bg-status-green-bg disabled:opacity-50 transition-colors"><ClipboardList size={12} />{busy === 'capture' ? 'Capturing...' : 'Capture'}</button>
              </div>
              <div className="flex gap-2">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
                  rows={2} placeholder="Type what's being said in the room...  (Cmd/Ctrl+Enter to send)"
                  className="flex-1 bg-surface-input border border-border rounded-lg px-3 py-2 text-body-sm text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none resize-none" />
                <Button variant="primary" onClick={send} disabled={!input.trim()}>Send</Button>
              </div>
            </div>
          </div>

          {/* Facilitation + captures */}
          <div className="col-span-3 overflow-auto p-4 space-y-4">
            <div>
              <div className="text-label uppercase text-text-secondary mb-2">Facilitator</div>
              {fac ? (
                <div className="bg-white border border-brand-200 rounded-lg shadow-card p-3 space-y-2">
                  <div className="text-body-sm text-text-primary leading-relaxed">{fac.say}</div>
                  {fac.nextQuestion && (
                    <div className="pt-2 border-t border-border">
                      <div className="text-[10px] uppercase tracking-wide text-text-tertiary mb-1">Suggested question</div>
                      <div className="text-body-sm text-brand-600 leading-relaxed mb-2">{fac.nextQuestion}</div>
                      <button onClick={() => askQuestion(fac.nextQuestion!)} className="text-[11px] px-2 py-1 rounded bg-brand-500 text-white hover:bg-brand-600 transition-colors">Ask this</button>
                    </div>
                  )}
                  {fac.coverage && <div className="text-[11px] text-text-tertiary pt-1">{fac.coverage}</div>}
                  {fac.gaps && fac.gaps.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <div className="text-[10px] uppercase tracking-wide text-amber-600 mb-1">Gaps flagged</div>
                      <ul className="text-[11px] text-text-secondary space-y-0.5 list-disc list-inside">{fac.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
                    </div>
                  )}
                  {fac.pullSpecialist && roster.find((r) => r.code === fac.pullSpecialist) && (
                    <button onClick={() => contribute(fac.pullSpecialist!)} disabled={!!contribBusy} className="text-[11px] px-2 py-1 rounded border border-[#7C3AED]/50 text-[#7C3AED] hover:bg-[#7C3AED]/10 disabled:opacity-50 transition-colors">Bring in {roster.find((r) => r.code === fac.pullSpecialist)?.name.split('(')[0].trim()}</button>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-text-tertiary bg-white border border-border rounded-lg p-3">Press <span className="text-brand-600">Facilitate</span> for the next best question and coverage.</div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-label uppercase text-text-secondary">Captured {captures.length > 0 && <span className="text-text-secondary">({captures.length})</span>}</div>
                {proposed.length > 0 && <span className="text-[10px] text-amber-600">{proposed.length} to review</span>}
              </div>
              <CaptureGroups captures={captures} streams={streams} onSet={setCap} onApply={applyCapture} busy={busy} />
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
        <h2 className="text-heading-sm font-display text-text-primary">Workshop Brief</h2>
        <button onClick={onStart} className="bg-status-green hover:bg-green-700 text-white px-4 py-2 rounded-lg text-[12px] font-medium transition-colors">Start Workshop</button>
      </div>
      <p className="text-body-md text-text-secondary leading-relaxed">{b.summary}</p>
      <Section title="Objectives"><ul className="space-y-1">{b.objectives?.map((o, i) => <li key={i} className="text-body-sm text-text-secondary flex gap-2"><span className="text-brand-500">•</span>{o}</li>)}</ul></Section>
      <Section title="Agenda">
        <div className="space-y-1.5">
          {(agenda.length ? agenda.map((a) => ({ title: a.title, objective: a.objective, focusType: a.focus_type, timeboxMinutes: a.timebox_minutes })) : b.agenda).map((a, i) => (
            <div key={i} className="flex items-start gap-3 bg-white border border-border rounded-lg px-3 py-2">
              <span className="text-[11px] text-text-tertiary mt-0.5 w-5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-body-sm text-text-primary">{a.title}</div>
                {a.objective && <div className="text-[11px] text-text-tertiary mt-0.5">{a.objective}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.focusType && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-muted text-text-tertiary">{a.focusType}</span>}
                {a.timeboxMinutes ? <span className="text-[10px] text-text-tertiary">{a.timeboxMinutes}m</span> : null}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Pre-read"><p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{b.preRead}</p></Section>
      {b.gaps?.length > 0 && <Section title="Gaps & decisions to drive"><ul className="space-y-1">{b.gaps.map((g, i) => <li key={i} className="text-body-sm text-text-secondary flex gap-2"><span className="text-amber-600">▸</span>{g}</li>)}</ul></Section>}
      {b.keyQuestions?.length > 0 && <Section title="Questions to prepare"><ul className="space-y-1">{b.keyQuestions.map((q, i) => <li key={i} className="text-body-sm text-text-secondary flex gap-2"><span className="text-brand-600">?</span>{q}</li>)}</ul></Section>}
      {b.risks?.length > 0 && <Section title="Risks"><ul className="space-y-1">{b.risks.map((r, i) => <li key={i} className="text-body-sm text-text-secondary flex gap-2"><span className="text-status-red">⚠</span>{r}</li>)}</ul></Section>}
    </div>
  )
}

// ─── Recap view ──────────────────────────────────────────────
function RecapView({ ws, recap, captures, streams, onSet, busy, onRegen }: {
  ws: Workshop; recap: WorkshopRecapData | null; captures: WorkshopCapture[]; streams: Workstream[]
  onSet: (c: WorkshopCapture, s: WorkshopCapture['status']) => void; busy: string | null; onRegen: () => void
}) {
  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-heading-sm font-display text-text-primary">Workshop recap</h2>
          <div className="flex items-center gap-2">
            {recap && <Button variant="secondary" size="sm" icon={<Download size={12} />} onClick={() => exportRecapDocx(ws, recap)}>Export Word</Button>}
            {recap && <Button variant="secondary" size="sm" icon={<Download size={12} />} onClick={() => exportRecapPptx(ws, recap)}>Export Deck</Button>}
            <Button variant="primary" size="sm" onClick={onRegen} disabled={busy === 'recap'}>{busy === 'recap' ? 'Generating...' : recap ? 'Regenerate' : 'Generate recap'}</Button>
          </div>
        </div>
        {recap ? (
          <div className="space-y-6">
            <div>
              <div className="text-body-md font-semibold text-brand-600 mb-1">{recap.headline}</div>
              <p className="text-body-md text-text-secondary leading-relaxed">{recap.summary}</p>
            </div>
            {recap.decisions?.length > 0 && <Section title="Decisions"><ul className="space-y-1">{recap.decisions.map((d, i) => <li key={i} className="text-body-sm text-text-secondary flex gap-2"><span className="text-brand-500">✓</span>{d}</li>)}</ul></Section>}
            {recap.actions?.length > 0 && <Section title="Actions"><ul className="space-y-1">{recap.actions.map((a, i) => <li key={i} className="text-body-sm text-text-secondary flex gap-2"><span className="text-[#7C3AED]">→</span><span>{a.title}{a.owner ? `, ${a.owner}` : ''}{a.due ? ` (due ${a.due})` : ''}</span></li>)}</ul></Section>}
            {recap.deliverables?.length > 0 && <Section title="Deliverables"><ul className="space-y-1">{recap.deliverables.map((d, i) => <li key={i} className="text-body-sm text-text-secondary flex gap-2"><span className="text-[#0891B2]">▤</span>{d}</li>)}</ul></Section>}
            {recap.risks?.length > 0 && <Section title="Risks"><ul className="space-y-1">{recap.risks.map((r, i) => <li key={i} className="text-body-sm text-text-secondary flex gap-2"><span className="text-status-red">⚠</span>{r}</li>)}</ul></Section>}
            {recap.openQuestions?.length > 0 && <Section title="Open questions"><ul className="space-y-1">{recap.openQuestions.map((q, i) => <li key={i} className="text-body-sm text-text-secondary flex gap-2"><span className="text-amber-600">?</span>{q}</li>)}</ul></Section>}
            {recap.nextSteps?.length > 0 && <Section title="Next steps"><ul className="space-y-1">{recap.nextSteps.map((n, i) => <li key={i} className="text-body-sm text-text-secondary flex gap-2"><span className="text-status-green">▸</span>{n}</li>)}</ul></Section>}
          </div>
        ) : (
          <p className="text-body-md text-text-tertiary">Generate the recap to synthesize the session into decisions, actions, deliverables, and next steps.</p>
        )}
        <Section title="Captured items"><CaptureGroups captures={captures} streams={streams} onSet={onSet} readOnly /></Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="text-label uppercase text-text-secondary mb-2">{title}</div>{children}</div>
}

// ─── Captures ────────────────────────────────────────────────
function CaptureGroups({ captures, onSet, onApply, readOnly, busy }: {
  captures: WorkshopCapture[]; streams: Workstream[]
  onSet: (c: WorkshopCapture, status: WorkshopCapture['status']) => void
  onApply?: (c: WorkshopCapture) => void; readOnly?: boolean; busy?: string | null
}) {
  if (captures.length === 0) return <div className="text-[11px] text-text-tertiary">Nothing captured yet.</div>
  const order: CaptureType[] = ['decision', 'action', 'deliverable', 'architecture_change', 'risk', 'question', 'parking_lot']
  return (
    <div className="space-y-2">
      {order.filter((t) => captures.some((c) => c.capture_type === t)).map((t) => {
        const meta = CAPTURE_META[t]
        return (
          <div key={t}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: meta.color }}>{meta.label}</div>
            <div className="space-y-1.5">
              {captures.filter((c) => c.capture_type === t).map((c) => (
                <div key={c.id} className="bg-white border border-border rounded-lg px-2.5 py-2" style={{ ...(c.status === 'proposed' ? { borderColor: `${meta.color}55` } : {}), opacity: c.status === 'dismissed' ? 0.4 : 1 }}>
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] mt-0.5" style={{ color: meta.color }}>{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-text-primary leading-snug">{c.title}</div>
                      {c.detail && <div className="text-[10px] text-text-tertiary mt-0.5">{c.detail}</div>}
                      {(c.owner || c.due_date) && <div className="text-[10px] text-text-tertiary mt-1">{c.owner}{c.owner && c.due_date ? ' | ' : ''}{c.due_date}</div>}
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {c.status === 'proposed' ? (
                        <>
                          <button onClick={() => onSet(c, 'confirmed')} className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: meta.color }}>Confirm</button>
                          {c.capture_type === 'architecture_change' && onApply && <button onClick={() => onApply(c)} disabled={busy === `apply:${c.id}`} className="text-[10px] px-1.5 py-0.5 rounded border border-status-green/50 text-status-green hover:bg-status-green-bg disabled:opacity-50 transition-colors" title="Write this change to the process model as a to-be overlay">{busy === `apply:${c.id}` ? 'Applying...' : 'Apply to model'}</button>}
                          <button onClick={() => onSet(c, 'dismissed')} className="text-[10px] px-1.5 py-0.5 rounded text-text-tertiary hover:text-text-secondary transition-colors">Dismiss</button>
                        </>
                      ) : (
                        <span className="text-[10px]" style={{ color: c.status === 'dismissed' ? '#595959' : meta.color }}>{c.status === 'applied' ? '✓ applied to model' : c.status}</span>
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
