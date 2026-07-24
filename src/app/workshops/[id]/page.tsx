'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import {
  getWorkshop, updateWorkshop, listAgenda, updateAgendaItem, updateWorkshopDuration,
  listMessages, addMessage, listCaptures, updateCapture, setParticipants,
  listAgendaContent, restartWorkshop, archiveWorkshop, readWorkshopShare, addWorkshopAgendaItem,
  listAttachments, deleteAttachment,
  type AgendaContentRow, type WorkshopShare,
} from '@/lib/supabase/workshops'
import type { Workshop, WorkshopAgendaItem, WorkshopMessage, WorkshopCapture, CaptureType, WorkshopAttachment } from '@/lib/workshop/types'
import { CAPTURE_META, DURATION_OPTIONS, DEFAULT_DURATION_MINUTES, FOCUS_AREAS, ARCHETYPE_OPTIONS } from '@/lib/workshop/types'
import { createTranscription, type TranscriptionProvider } from '@/lib/workshop/transcription'
import { exportRecapDocx, exportRecapPptx, exportFacilitationPptx } from '@/lib/workshop/export'
import { loadFacilitationDeck } from '@/lib/workshop/deck'
import { publishWorkshopToDeliverables } from '@/lib/workshop/publishToDeliverable'
import type { WorkshopRecapData } from '@jlee-revtech/agent-core'
import type { Workstream } from '@/lib/workstream/types'
import {
  Archive, ArrowLeft, ChevronDown, ClipboardList, Download, FileText, Info, Link2, Mic,
  MoreHorizontal, Paperclip, Play, Plus, Presentation, RefreshCw, RotateCcw, Settings2,
  Sparkles, Star, Trash2, Upload, X,
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
  // 055: prep attachments, read as context by the brief + every section generate.
  const [attachments, setAttachments] = useState<WorkshopAttachment[]>([])
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
  // Inputs & Brief dialog: the workshop's driving inputs + the full brief,
  // reachable any time from the prep toolbar.
  const [inputsOpen, setInputsOpen] = useState(false)
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
    const [w, s, a, ct, m, c, att] = await Promise.all([
      getWorkshop(id), listWorkstreams(organization.id), listAgenda(id), listAgendaContent(id), listMessages(id), listCaptures(id), listAttachments(id),
    ])
    setWs(w); setStreams(s); setAgenda(a); setContent(ct); setMessages(m); setCaptures(c); setAttachments(att)
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

  // ─── Prep attachments (055) ───────────────────────────────
  // Upload goes through the server route (text extraction); list + delete run
  // under the user's RLS. Extracted text is threaded as context into the brief
  // and every section generate server-side.
  const uploadAttachment = useCallback(async (file: File) => {
    if (!ws || !organization) return
    setBusy('attach')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('workshopId', ws.id)
      form.append('orgId', organization.id)
      const res = await fetch('/api/workshops/attachments', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setAttachments(await listAttachments(ws.id))
    } catch (e) { alert(e instanceof Error ? e.message : 'Upload failed') } finally { setBusy(null) }
  }, [ws, organization])

  const removeAttachment = useCallback(async (att: WorkshopAttachment) => {
    if (!ws) return
    if (!confirm(`Remove "${att.file_name}" from this workshop's prep context?`)) return
    await deleteAttachment(att.id)
    setAttachments((prev) => prev.filter((a) => a.id !== att.id))
  }, [ws])

  // Add/hide workstreams (non-destructive). Hiding just drops the code from the
  // workshop's active set (agenda item + content are kept, filtered from view);
  // adding a brand-new workstream creates a fresh section to author into.
  // 055: also persists the primary workstream set from the dialog.
  const applyWorkstreams = useCallback(async (selectedCodes: string[], primaryCodes: string[]) => {
    if (!ws) return
    const current = ws.workstream_codes || []
    // 056/057: per-workstream sections are 'workstream' (decision), 'assessment'
    // (assessment), or 'training' (training archetype); the closing synthesis is
    // 'evaluation', 'roadmap', or the training pair 'curriculum' + 'certification'.
    const perWsKind = ws.archetype === 'assessment' ? 'assessment' : ws.archetype === 'training' ? 'training' : 'workstream'
    const existingWsCodes = new Set(
      agenda.filter((a) => (a.section_kind === 'workstream' || a.section_kind === 'assessment' || a.section_kind === 'training') && a.workstream_code).map((a) => a.workstream_code),
    )
    const toAdd = selectedCodes.filter((c) => !current.includes(c))
    // The closing synthesis section(s); training has two (curriculum then
    // certification), so anchor on the earliest closing item and shift them all.
    const closingKinds = new Set(['evaluation', 'roadmap', 'curriculum', 'certification'])
    const closingItems = agenda.filter((a) => a.section_kind && closingKinds.has(a.section_kind)).sort((a, b) => a.sort_order - b.sort_order)
    const firstClosing = closingItems[0]
    const maxSort = agenda.reduce((m, a) => Math.max(m, a.sort_order), 0)
    let insertAt = firstClosing ? firstClosing.sort_order : maxSort + 1
    for (const code of toAdd) {
      if (existingWsCodes.has(code)) continue // un-hiding: its section already exists
      const wsName = streams.find((s) => s.code === code)?.name || code
      await addWorkshopAgendaItem(ws.id, { title: wsName, section_kind: perWsKind, workstream_code: code, sort_order: insertAt, status: 'pending' })
      insertAt += 1
    }
    // Keep the closing synthesis section(s) last if new sections pushed past them.
    if (firstClosing && insertAt !== firstClosing.sort_order) {
      for (const c of closingItems) { await updateAgendaItem(c.id, { sort_order: insertAt }); insertAt += 1 }
    }
    await updateWorkshop(ws.id, { workstream_codes: selectedCodes, primary_workstream_codes: primaryCodes })
    setWs((prev) => (prev ? { ...prev, workstream_codes: selectedCodes, primary_workstream_codes: primaryCodes } : prev))
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

  // Publish the workshop to the Deliverables section as a readout document (with
  // its diagrams as svg blocks), then jump there so it can be downloaded as
  // PPTX / Word / HTML with the rest of the engagement's deliverables.
  const publishToDeliverables = useCallback(async () => {
    if (!ws || !organization) return
    setBusy('publish')
    try {
      const deck = await loadFacilitationDeck(null, ws.id)
      if (deck.slides.length === 0) throw new Error('No facilitation content yet. Generate a section first.')
      const id = await publishWorkshopToDeliverables(ws.id, organization.id, user?.id, {
        workstreamCode: ws.workstream_codes?.[0] || 'enterprise',
      })
      router.push(`/deliverables?selected=${id}`)
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to publish') } finally { setBusy(null) }
  }, [ws, organization, user?.id, router])

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
    (a.section_kind !== 'workstream' && a.section_kind !== 'assessment' && a.section_kind !== 'training') || !a.workstream_code || activeCodes.has(a.workstream_code)
  const visibleAgenda = agenda.filter(isVisibleItem)
  const visibleItemIds = new Set(visibleAgenda.map((a) => a.id))
  const selectedItem = agenda.find((a) => a.id === selectedItemId) ?? null
  const evaluationItem = visibleAgenda.find((a) => a.section_kind === 'evaluation') ?? null
  const hasWorkstreamContent = visibleAgenda.some(
    (a) => a.section_kind === 'workstream' && !!contentByItem.get(a.id)?.content,
  )
  // 056 assessment archetype: the closing roadmap card, gated on assessment content.
  const roadmapItem = visibleAgenda.find((a) => a.section_kind === 'roadmap') ?? null
  const hasAssessmentContent = visibleAgenda.some(
    (a) => a.section_kind === 'assessment' && !!contentByItem.get(a.id)?.content,
  )
  // 057 training archetype: the closing Learning Path + Knowledge Check cards,
  // both gated on at least one training section having authored content.
  const curriculumItem = visibleAgenda.find((a) => a.section_kind === 'curriculum') ?? null
  const certificationItem = visibleAgenda.find((a) => a.section_kind === 'certification') ?? null
  const hasTrainingContent = visibleAgenda.some(
    (a) => a.section_kind === 'training' && !!contentByItem.get(a.id)?.content,
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
      {inputsOpen && (
        <WorkshopInputsDialog
          ws={ws}
          streams={streams}
          attachments={attachments}
          agenda={visibleAgenda}
          durationMinutes={durationMinutes}
          onClose={() => setInputsOpen(false)}
          onStart={() => { setInputsOpen(false); setStatus('live') }}
        />
      )}
      {manageWsOpen && (
        <ManageWorkstreamsDialog
          streams={streams}
          activeCodes={ws.workstream_codes || []}
          primaryCodes={ws.primary_workstream_codes || []}
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
              <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${ws.archetype === 'assessment' ? 'bg-amber-100 text-amber-700' : ws.archetype === 'training' ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-50 text-brand-600'}`}
                title={ws.archetype === 'assessment' ? 'Assessment / Discovery workshop: conversational assessment driven to opportunities and a roadmap' : ws.archetype === 'training' ? 'Training / Enablement workshop: per-role training build-out, a Learning Path, and a Knowledge Check' : 'Key Design Decision workshop: decision analysis and recommendation'}>
                {ws.archetype === 'assessment' ? 'Assessment' : ws.archetype === 'training' ? 'Training' : 'Design Decision'}
              </span>
              <VersionBadge />
            </div>
            {ws.customer_name && <div className="text-[11px] text-text-tertiary">{ws.customer_name}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {roster.map((r) => {
            const prim = (ws.primary_workstream_codes || []).includes(r.code)
            return (
              <div key={r.code} title={prim ? `${r.name} (primary workstream)` : r.name}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: `${r.color || '#2563EB'}1A`, color: r.color || '#2563EB', ...(prim ? { boxShadow: '0 0 0 2px #F59E0B' } : {}) }}>
                {r.name.split('(')[0].trim().split(/[\s-]/).map((x) => x[0]).slice(0, 2).join('')}
              </div>
            )
          })}
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
            <div className="max-w-3xl mx-auto space-y-4">
              <EmptyState
                variant="dashed"
                icon={<Presentation size={40} />}
                title="Prep the workshop"
                description={ws.archetype === 'assessment'
                  ? `The consultant agents will read ${ws.customer_name || 'the customer'}'s architecture for this topic and prepare a conversational assessment: a timeboxed agenda, assessment and discovery questions per workstream, candidate process / data / technology opportunities, and a closing Opportunity Roadmap.`
                  : `The consultant agents will read ${ws.customer_name || 'the customer'}'s architecture for this topic and prepare a timeboxed agenda, a pre-read, the gaps to drive, and the questions to ask.`}
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
              <AttachmentsCard
                attachments={attachments}
                busy={busy === 'attach'}
                onUpload={uploadAttachment}
                onRemove={removeAttachment}
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
                  <Button
                    variant="secondary" size="sm" iconOnly
                    icon={<Info size={13} />}
                    onClick={() => setInputsOpen(true)}
                    title="Workshop inputs and brief: the setup that drove the brief, plus the objectives, pre-read, and questions"
                    aria-label="Workshop inputs and brief"
                  />
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
                          <button onClick={() => { setSectionsMenu(false); setInputsOpen(true) }} className={roomMenuItemCls}>
                            <Info size={14} className="mt-0.5 shrink-0" />
                            <span>
                              Workshop inputs &amp; brief
                              <span className="block text-[10px] text-text-tertiary mt-0.5">The setup that drove the brief, plus its questions</span>
                            </span>
                          </button>
                          <button onClick={() => { setSectionsMenu(false); setManageWsOpen(true) }} className={roomMenuItemCls}>
                            <Settings2 size={14} className="mt-0.5 shrink-0" /> Add or hide workstreams
                          </button>
                          <div className="my-1 border-t border-border" />
                          <button onClick={() => { setSectionsMenu(false); downloadFacilitationPptx() }} disabled={!hasAnyContent || busy === 'deck'} className={roomMenuItemCls}>
                            <Download size={14} className="mt-0.5 shrink-0" /> {busy === 'deck' ? 'Preparing deck...' : 'Download facilitation deck (PPTX)'}
                          </button>
                          <button onClick={() => { setSectionsMenu(false); publishToDeliverables() }} disabled={!hasAnyContent || busy === 'publish'} className={roomMenuItemCls}>
                            <FileText size={14} className="mt-0.5 shrink-0" /> {busy === 'publish' ? 'Publishing...' : 'Publish to Deliverables'}
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

              <AttachmentsCard
                attachments={attachments}
                busy={busy === 'attach'}
                onUpload={uploadAttachment}
                onRemove={removeAttachment}
              />

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
                    isPrimary={!!a.workstream_code && (ws.primary_workstream_codes || []).includes(a.workstream_code)}
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

              {/* Opportunity Roadmap action (056 assessment archetype) */}
              {roadmapItem && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="text-body-sm font-medium text-text-primary mb-0.5">Opportunity Roadmap</div>
                  <div className="text-[11px] text-text-tertiary mb-2">Reads every assessment section&apos;s process, data, and technology opportunities, detects the dependencies between them, and drafts the sequenced roadmap. Generate the assessment sections first.</div>
                  <button
                    onClick={() => runSection(roadmapItem.id)}
                    disabled={!hasAssessmentContent || busy === `section:${roadmapItem.id}`}
                    className="text-[11px] px-2.5 py-1 rounded bg-[#D97706] hover:bg-[#F59E0B] disabled:opacity-40 text-white font-medium transition-colors"
                    title={hasAssessmentContent ? 'Sequence the opportunities into a draft roadmap' : 'Generate at least one assessment section first'}
                  >
                    {busy === `section:${roadmapItem.id}` ? 'Sequencing...' : 'Generate Opportunity Roadmap'}
                  </button>
                </div>
              )}

              {/* Learning Path action (057 training archetype) */}
              {curriculumItem && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-body-sm font-medium text-text-primary mb-0.5">Learning Path</div>
                  <div className="text-[11px] text-text-tertiary mb-2">Reads every role&apos;s training modules, detects the prerequisites between them, and sequences a phased learning path with per-role tracks. Generate the training sections first.</div>
                  <button
                    onClick={() => runSection(curriculumItem.id)}
                    disabled={!hasTrainingContent || busy === `section:${curriculumItem.id}`}
                    className="text-[11px] px-2.5 py-1 rounded bg-[#059669] hover:bg-[#10B981] disabled:opacity-40 text-white font-medium transition-colors"
                    title={hasTrainingContent ? 'Sequence the modules into a learning path' : 'Generate at least one training section first'}
                  >
                    {busy === `section:${curriculumItem.id}` ? 'Sequencing...' : 'Generate Learning Path'}
                  </button>
                </div>
              )}

              {/* Knowledge Check action (057 training archetype) */}
              {certificationItem && (
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
                  <div className="text-body-sm font-medium text-text-primary mb-0.5">Knowledge Check</div>
                  <div className="text-[11px] text-text-tertiary mb-2">Builds scenario-based exercises, quiz questions with answer keys, and a competency sign-off checklist grounded in the modules trained. Generate the training sections first.</div>
                  <button
                    onClick={() => runSection(certificationItem.id)}
                    disabled={!hasTrainingContent || busy === `section:${certificationItem.id}`}
                    className="text-[11px] px-2.5 py-1 rounded bg-[#0891B2] hover:bg-[#06B6D4] disabled:opacity-40 text-white font-medium transition-colors"
                    title={hasTrainingContent ? 'Build the knowledge check' : 'Generate at least one training section first'}
                  >
                    {busy === `section:${certificationItem.id}` ? 'Building...' : 'Generate Knowledge Check'}
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

// ─── Workshop inputs & brief dialog ──────────────────────────
// Everything that DROVE the brief (type, topic, objective, customer, focus,
// length, workstreams + primary, guidance, attachments) plus the generated
// brief itself (objectives, agenda, pre-read, gaps, questions, risks), so the
// setup is always reachable from the prep view after the brief exists.
function WorkshopInputsDialog({ ws, streams, attachments, agenda, durationMinutes, onClose, onStart }: {
  ws: Workshop
  streams: Workstream[]
  attachments: WorkshopAttachment[]
  agenda: WorkshopAgendaItem[]
  durationMinutes: number
  onClose: () => void
  onStart: () => void
}) {
  const archetypeMeta = ARCHETYPE_OPTIONS.find((a) => a.key === (ws.archetype === 'assessment' ? 'assessment' : 'decision'))
  const durationLabel = DURATION_OPTIONS.find((d) => d.minutes === (ws.duration_minutes || durationMinutes))?.label
    || `${ws.duration_minutes || durationMinutes} minutes`
  const primary = new Set(ws.primary_workstream_codes || [])
  const focusMeta = (ws.focus_areas || []).map((f) => FOCUS_AREAS.find((x) => x.key === f)?.label || f)
  const guidance = (ws.facilitation_prompt || '').trim()
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[46rem] max-w-[94vw] max-h-[88vh] flex flex-col bg-white rounded-xl shadow-card-hover overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div>
            <h3 className="text-heading-sm font-display text-text-primary">Workshop inputs &amp; brief</h3>
            <div className="text-[11px] text-text-tertiary">The inputs below drive Generate Brief and every section generate. Regenerate after changing them.</div>
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={14} />} title="Close" aria-label="Close" onClick={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Setup inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <InputRow label="Workshop type">
              <div className="text-[12px] text-text-primary font-medium">{archetypeMeta?.label}</div>
              {archetypeMeta?.blurb && <div className="text-[10px] text-text-tertiary leading-snug mt-0.5">{archetypeMeta.blurb}</div>}
            </InputRow>
            <InputRow label="Length"><div className="text-[12px] text-text-primary">{durationLabel}</div></InputRow>
            <InputRow label="Customer"><div className="text-[12px] text-text-primary">{ws.customer_name || <Missing />}</div></InputRow>
            <InputRow label="Topic"><div className="text-[12px] text-text-primary">{ws.topic || ws.title}</div></InputRow>
            <InputRow label="Objective" full>
              <div className="text-[12px] text-text-primary leading-snug">{ws.objective || <Missing label="None set; the brief was driven by the topic alone" />}</div>
            </InputRow>
            <InputRow label="Focus areas" full>
              {focusMeta.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {focusMeta.map((f, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-600">{f}</span>)}
                </div>
              ) : <Missing />}
            </InputRow>
            <InputRow label="Value streams in the room" full>
              <div className="flex flex-wrap gap-1.5">
                {(ws.workstream_codes || []).map((c) => {
                  const s = streams.find((x) => x.code === c)
                  const color = s?.color || '#2563EB'
                  const isPrim = primary.has(c)
                  return (
                    <span key={c} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ color, backgroundColor: `${color}1A` }} title={isPrim ? 'Primary workstream: the others frame their input through this lens' : undefined}>
                      {isPrim && <Star size={9} fill="currentColor" className="text-amber-500" />}
                      {s?.name?.split('(')[0].trim() || c}
                    </span>
                  )
                })}
              </div>
            </InputRow>
            <InputRow label="Guidance for all content" full>
              {guidance
                ? <div className="text-[11px] text-text-secondary leading-snug whitespace-pre-wrap bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5">{guidance}</div>
                : <Missing label="None set; add it in the Sections panel" />}
            </InputRow>
            <InputRow label={`Prep attachments (${attachments.length})`} full>
              {attachments.length ? (
                <ul className="space-y-1">
                  {attachments.map((a) => (
                    <li key={a.id} className="text-[11px] text-text-secondary flex items-center gap-1.5">
                      <FileText size={11} className="text-text-tertiary shrink-0" />
                      <span className="truncate">{a.file_name}</span>
                      <span className="text-[10px] text-text-tertiary shrink-0">
                        {a.status === 'extracted' ? `${Math.round(a.chars / 1000)}k chars read` : 'not readable'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <Missing label="None uploaded" />}
            </InputRow>
          </div>

          {/* The generated brief (objectives, agenda, pre-read, gaps, questions, risks) */}
          {ws.brief ? (
            <div className="pt-4 border-t border-border">
              <BriefView ws={ws} agenda={agenda} onStart={onStart} />
            </div>
          ) : (
            <div className="pt-4 border-t border-border text-[11px] text-text-tertiary">No brief has been generated yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function InputRow({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <div className="text-[10px] uppercase tracking-wide text-text-tertiary mb-0.5">{label}</div>
      {children}
    </div>
  )
}

function Missing({ label }: { label?: string }) {
  return <span className="text-[11px] text-text-tertiary italic">{label || 'Not set'}</span>
}

// ─── Prep attachments (055) ──────────────────────────────────
// Reference documents the facilitator loads into the prep. Extracted text is
// threaded as context into the brief and every section generate server-side.
function AttachmentsCard({ attachments, busy, onUpload, onRemove }: {
  attachments: WorkshopAttachment[]
  busy: boolean
  onUpload: (file: File) => void
  onRemove: (att: WorkshopAttachment) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const fmtSize = (n: number | null) => {
    if (!n) return ''
    if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
    return `${Math.max(1, Math.round(n / 1024))} KB`
  }
  return (
    <div className="rounded-lg border border-border bg-white shadow-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wide text-text-secondary flex items-center gap-1.5">
          <Paperclip size={11} /> Prep attachments {attachments.length > 0 && <span>({attachments.length})</span>}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border text-text-secondary hover:bg-surface-muted hover:text-text-primary disabled:opacity-40 transition-colors"
        >
          <Upload size={11} /> {busy ? 'Reading...' : 'Add document'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.pptx,.xlsx,.xls,.txt,.md,.markdown,.csv"
          className="hidden"
          aria-label="Upload a prep attachment"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onUpload(f)
            e.target.value = ''
          }}
        />
      </div>
      {attachments.length === 0 ? (
        <div className="text-[11px] text-text-tertiary leading-snug">
          Load reference documents (PDF, Word, PowerPoint, Excel, text). The agents read them as context when preparing the brief and every section.
        </div>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-start gap-2 rounded-lg border border-border px-2.5 py-1.5">
              <FileText size={13} className="text-text-tertiary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-text-primary leading-snug truncate" title={a.file_name}>{a.file_name}</div>
                <div className="text-[10px] text-text-tertiary mt-0.5">
                  {[
                    a.format?.toUpperCase(),
                    a.pages ? `${a.pages} ${a.format === 'pptx' ? 'slides' : a.format === 'xlsx' ? 'sheets' : 'pages'}` : null,
                    fmtSize(a.size_bytes),
                    a.status === 'extracted' ? `${Math.round(a.chars / 1000)}k chars read` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
                {a.status !== 'extracted' && (
                  <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1 leading-snug">
                    {a.note || 'This file could not be read as context.'}
                  </div>
                )}
              </div>
              <button
                onClick={() => onRemove(a)}
                title={`Remove ${a.file_name}`}
                aria-label={`Remove ${a.file_name}`}
                className="shrink-0 p-1 rounded text-text-tertiary hover:text-status-red hover:bg-red-50 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <div className="text-[10px] text-text-tertiary leading-snug">
            Read as context by Generate Brief and every section generate. Regenerate after adding or removing documents.
          </div>
        </div>
      )}
    </div>
  )
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
