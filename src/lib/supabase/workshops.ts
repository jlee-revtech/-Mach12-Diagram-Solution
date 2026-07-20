// Workshop data access (raw PostgREST under the user's RLS, mirroring the other
// src/lib/supabase/*.ts modules). Covers workshops + participants + agenda +
// scenarios + transcript messages + captures.

import type {
  Workshop, WorkshopParticipant, WorkshopAgendaItem, WorkshopScenario,
  WorkshopMessage, WorkshopCapture, WorkshopStatus, WorkshopFocus, WorkshopBriefData,
  CaptureStatus, AgendaStatus, SectionKind, WorkshopAttachment,
} from '@/lib/workshop/types'
import type { SectionContent, ClarifyingQuestion, KbGap } from '@jlee-revtech/agent-core'

export type { SectionKind }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw)?.access_token ?? null) : null
  } catch {
    return null
  }
}

function headers(pref?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: ANON,
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/json',
  }
  if (pref) h.Prefer = pref
  return h
}

const one = <T>(arr: T[] | T): T => (Array.isArray(arr) ? arr[0] : arr)

// ─── Workshops ──────────────────────────────────────────────

export async function listWorkshops(orgId: string, includeArchived = false): Promise<Workshop[]> {
  const arch = includeArchived ? '' : '&archived_at=is.null'
  const res = await fetch(
    `${URL}/rest/v1/workshops?organization_id=eq.${orgId}${arch}&select=*&order=created_at.desc`,
    { headers: headers() },
  )
  return res.ok ? res.json() : []
}

export async function getWorkshop(id: string): Promise<Workshop | null> {
  const res = await fetch(`${URL}/rest/v1/workshops?id=eq.${id}&select=*`, { headers: headers() })
  if (!res.ok) return null
  const arr = await res.json()
  return arr[0] ?? null
}

export async function createWorkshop(
  orgId: string,
  userId: string | null,
  data: {
    title: string; topic?: string; objective?: string; customer_name?: string
    focus_areas?: WorkshopFocus[]; workstream_codes?: string[]; primary_workstream_codes?: string[]
    scheduled_at?: string
    duration_minutes?: number
    settings?: Record<string, unknown>
  },
): Promise<Workshop> {
  const res = await fetch(`${URL}/rest/v1/workshops`, {
    method: 'POST',
    headers: headers('return=representation'),
    body: JSON.stringify({ organization_id: orgId, created_by: userId, status: 'draft', ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create workshop')
  return one(arr)
}

export async function updateWorkshop(
  id: string,
  updates: Partial<{
    title: string; topic: string; objective: string; customer_name: string
    status: WorkshopStatus; focus_areas: WorkshopFocus[]; workstream_codes: string[]
    primary_workstream_codes: string[]
    scheduled_at: string | null; started_at: string | null; ended_at: string | null
    brief: WorkshopBriefData | null; recap: unknown; settings: Record<string, unknown>; archived_at: string | null
    facilitation_prompt: string | null
  }>,
): Promise<void> {
  await fetch(`${URL}/rest/v1/workshops?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers('return=minimal'),
    body: JSON.stringify(updates),
  })
}

// ─── Attachments (055) ──────────────────────────────────────
// Uploads go through POST /api/workshops/attachments (server-side text
// extraction); list + delete run under the user's RLS like the other children.

export async function listAttachments(workshopId: string): Promise<WorkshopAttachment[]> {
  const res = await fetch(
    `${URL}/rest/v1/workshop_attachments?workshop_id=eq.${workshopId}&select=id,workshop_id,file_name,format,pages,size_bytes,chars,status,note,created_by,created_at&order=created_at.asc`,
    { headers: headers() },
  )
  return res.ok ? res.json() : []
}

export async function deleteAttachment(id: string): Promise<void> {
  await fetch(`${URL}/rest/v1/workshop_attachments?id=eq.${id}`, { method: 'DELETE', headers: headers() })
}

// ─── Public read-only share (stored in workshops.settings.share) ────────────
// A random code grants anon read of the workshop prep via a service-key API
// route (/api/share/workshop/[code]); no new table or RLS needed.
export interface WorkshopShare { code: string; enabled: boolean; created_at: string }

function newShareCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export function readWorkshopShare(w: Workshop | null): WorkshopShare | null {
  const s = (w?.settings as { share?: Partial<WorkshopShare> } | undefined)?.share
  return s?.code ? { code: s.code, enabled: !!s.enabled, created_at: s.created_at || '' } : null
}

// Enable (creating a code if needed) or disable the public share, merging into the
// existing settings so nothing else is clobbered.
export async function setWorkshopShare(workshopId: string, enabled: boolean): Promise<WorkshopShare> {
  const w = await getWorkshop(workshopId)
  const settings = (w?.settings as Record<string, unknown>) || {}
  const existing = (settings.share as Partial<WorkshopShare> | undefined) || {}
  const share: WorkshopShare = {
    code: existing.code || newShareCode(),
    enabled,
    created_at: existing.created_at || new Date().toISOString(),
  }
  await updateWorkshop(workshopId, { settings: { ...settings, share } })
  return share
}

export const archiveWorkshop = (id: string) => updateWorkshop(id, { archived_at: new Date().toISOString() })

export const restoreWorkshop = (id: string) => updateWorkshop(id, { archived_at: null })

// Restart: reopen the workshop at the prep phase without losing any downstream
// data. Only the workshop's phase markers and the agenda navigation flags are
// reset; the brief, agenda, per-section facilitation content, transcript
// messages, captures, and recap are all preserved in place.
export async function restartWorkshop(id: string): Promise<void> {
  await updateWorkshop(id, { status: 'draft', started_at: null, ended_at: null })
  await fetch(`${URL}/rest/v1/workshop_agenda_items?workshop_id=eq.${id}`, {
    method: 'PATCH',
    headers: headers('return=minimal'),
    body: JSON.stringify({ status: 'pending' }),
  })
}

// ─── Participants ───────────────────────────────────────────

export async function listParticipants(workshopId: string): Promise<WorkshopParticipant[]> {
  const res = await fetch(
    `${URL}/rest/v1/workshop_participants?workshop_id=eq.${workshopId}&select=*&order=created_at.asc`,
    { headers: headers() },
  )
  return res.ok ? res.json() : []
}

export async function setParticipants(
  workshopId: string,
  people: { display_name: string; email?: string; org_role?: string }[],
  agents: { workstream_code: string; display_name: string; is_facilitator?: boolean }[],
): Promise<void> {
  await fetch(`${URL}/rest/v1/workshop_participants?workshop_id=eq.${workshopId}`, {
    method: 'DELETE',
    headers: headers('return=minimal'),
  })
  const rows = [
    ...people.map((p) => ({ workshop_id: workshopId, kind: 'person', ...p })),
    ...agents.map((a) => ({ workshop_id: workshopId, kind: 'agent', ...a })),
  ]
  if (rows.length) {
    await fetch(`${URL}/rest/v1/workshop_participants`, {
      method: 'POST',
      headers: headers('return=minimal'),
      body: JSON.stringify(rows),
    })
  }
}

// ─── Agenda ─────────────────────────────────────────────────

export async function listAgenda(workshopId: string): Promise<WorkshopAgendaItem[]> {
  const res = await fetch(
    `${URL}/rest/v1/workshop_agenda_items?workshop_id=eq.${workshopId}&select=*&order=sort_order.asc`,
    { headers: headers() },
  )
  return res.ok ? res.json() : []
}

export async function replaceAgenda(
  workshopId: string,
  items: { title: string; objective?: string; focus_type?: WorkshopFocus; timebox_minutes?: number }[],
): Promise<void> {
  await fetch(`${URL}/rest/v1/workshop_agenda_items?workshop_id=eq.${workshopId}`, {
    method: 'DELETE',
    headers: headers('return=minimal'),
  })
  if (items.length) {
    await fetch(`${URL}/rest/v1/workshop_agenda_items`, {
      method: 'POST',
      headers: headers('return=minimal'),
      body: JSON.stringify(items.map((it, i) => ({ workshop_id: workshopId, sort_order: i, ...it }))),
    })
  }
}

export async function updateAgendaItem(
  id: string,
  updates: Partial<{ status: AgendaStatus; title: string; objective: string; timebox_minutes: number; notes: string; sort_order: number }>,
): Promise<void> {
  await fetch(`${URL}/rest/v1/workshop_agenda_items?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers('return=minimal'),
    body: JSON.stringify(updates),
  })
}

// Add a single agenda item without disturbing the rest (unlike replaceAgenda,
// which deletes + recreates). Used to add a workstream section to a workshop.
export async function addWorkshopAgendaItem(
  workshopId: string,
  data: {
    title: string; objective?: string; section_kind?: SectionKind; workstream_code?: string
    timebox_minutes?: number; sort_order?: number; status?: AgendaStatus; focus_type?: WorkshopFocus
  },
): Promise<WorkshopAgendaItem> {
  const res = await fetch(`${URL}/rest/v1/workshop_agenda_items`, {
    method: 'POST',
    headers: headers('return=representation'),
    body: JSON.stringify({ workshop_id: workshopId, status: 'pending', ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error((Array.isArray(arr) ? arr[0]?.message : arr?.message) || 'Failed to add agenda item')
  return one(arr)
}

// ─── Scenarios ──────────────────────────────────────────────

export async function listScenarios(workshopId: string): Promise<WorkshopScenario[]> {
  const res = await fetch(
    `${URL}/rest/v1/workshop_scenarios?workshop_id=eq.${workshopId}&select=*&order=sort_order.asc`,
    { headers: headers() },
  )
  return res.ok ? res.json() : []
}

export async function createScenario(
  workshopId: string,
  data: { title: string; description?: string; focus_type?: WorkshopFocus; agenda_item_id?: string; sort_order?: number },
): Promise<WorkshopScenario> {
  const res = await fetch(`${URL}/rest/v1/workshop_scenarios`, {
    method: 'POST',
    headers: headers('return=representation'),
    body: JSON.stringify({ workshop_id: workshopId, ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create scenario')
  return one(arr)
}

// ─── Transcript ─────────────────────────────────────────────

export async function listMessages(workshopId: string, sinceSeq = 0): Promise<WorkshopMessage[]> {
  const filter = sinceSeq > 0 ? `&seq=gt.${sinceSeq}` : ''
  const res = await fetch(
    `${URL}/rest/v1/workshop_messages?workshop_id=eq.${workshopId}${filter}&select=*&order=seq.asc`,
    { headers: headers() },
  )
  return res.ok ? res.json() : []
}

export async function addMessage(
  workshopId: string,
  msg: {
    speaker_kind: 'person' | 'agent' | 'system'; content: string; speaker_name?: string
    speaker_role?: string; workstream_code?: string; source?: string; agenda_item_id?: string
    meta?: Record<string, unknown>
  },
): Promise<WorkshopMessage> {
  // seq = max(seq)+1 for the workshop (best-effort; concurrency is fine for a room).
  const last = await fetch(
    `${URL}/rest/v1/workshop_messages?workshop_id=eq.${workshopId}&select=seq&order=seq.desc&limit=1`,
    { headers: headers() },
  )
  const lastArr = last.ok ? await last.json() : []
  const seq = (lastArr[0]?.seq ?? 0) + 1
  const res = await fetch(`${URL}/rest/v1/workshop_messages`, {
    method: 'POST',
    headers: headers('return=representation'),
    body: JSON.stringify({ workshop_id: workshopId, seq, source: 'typed', ...msg }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to add message')
  return one(arr)
}

// Bulk-append transcript messages (e.g. an uploaded transcript). Computes the
// starting seq once, then inserts every row in a single request. Returns the count.
export async function addMessages(
  workshopId: string,
  msgs: {
    speaker_kind?: 'person' | 'agent' | 'system'; content: string; speaker_name?: string
    speaker_role?: string; source?: string
  }[],
): Promise<number> {
  if (!msgs.length) return 0
  const last = await fetch(
    `${URL}/rest/v1/workshop_messages?workshop_id=eq.${workshopId}&select=seq&order=seq.desc&limit=1`,
    { headers: headers() },
  )
  const lastArr = last.ok ? await last.json() : []
  const startSeq = (lastArr[0]?.seq ?? 0) + 1
  const rows = msgs.map((m, i) => ({
    workshop_id: workshopId,
    seq: startSeq + i,
    speaker_kind: m.speaker_kind ?? 'person',
    speaker_role: m.speaker_role ?? 'participant',
    source: m.source ?? 'upload',
    content: m.content,
    ...(m.speaker_name ? { speaker_name: m.speaker_name } : {}),
  }))
  const res = await fetch(`${URL}/rest/v1/workshop_messages`, {
    method: 'POST',
    headers: headers('return=minimal'),
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to add transcript messages')
  }
  return rows.length
}

// ─── Captures ───────────────────────────────────────────────

export async function listCaptures(workshopId: string): Promise<WorkshopCapture[]> {
  const res = await fetch(
    `${URL}/rest/v1/workshop_captures?workshop_id=eq.${workshopId}&select=*&order=created_at.asc`,
    { headers: headers() },
  )
  return res.ok ? res.json() : []
}

export async function createCapture(
  workshopId: string,
  data: Partial<WorkshopCapture> & { capture_type: WorkshopCapture['capture_type']; title: string },
): Promise<WorkshopCapture> {
  const res = await fetch(`${URL}/rest/v1/workshop_captures`, {
    method: 'POST',
    headers: headers('return=representation'),
    body: JSON.stringify({ workshop_id: workshopId, ...data }),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create capture')
  return one(arr)
}

export async function updateCapture(
  id: string,
  updates: Partial<{ status: CaptureStatus; title: string; detail: string; owner: string; due_date: string | null; applied_at: string | null }>,
): Promise<void> {
  await fetch(`${URL}/rest/v1/workshop_captures?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers('return=minimal'),
    body: JSON.stringify(updates),
  })
}

// ─── Agenda section content (facilitation layer, migration 046) ─────────────

// SectionKind ('overview' | 'workstream' | 'evaluation') is re-exported above
// from @/lib/workshop/types.
// status: 'empty' | 'generating' | 'draft' | 'needs_input' | 'final'
export type AgendaContentStatus = 'empty' | 'generating' | 'draft' | 'needs_input' | 'final'

// `content` is the agent-core SectionContent union (loose in the DB, typed here);
// clarifying_questions and kb_gaps are the agent-core arrays. Null before the
// section has been generated.
export interface AgendaContentRow {
  id: string
  workshop_id: string
  agenda_item_id: string
  section_kind: SectionKind
  content: SectionContent | null
  clarifying_questions: ClarifyingQuestion[]
  kb_gaps: KbGap[]
  status: AgendaContentStatus
  version: number
  created_at: string
  updated_at: string
}

export async function listAgendaContent(workshopId: string): Promise<AgendaContentRow[]> {
  const res = await fetch(
    `${URL}/rest/v1/workshop_agenda_content?workshop_id=eq.${workshopId}&select=*&order=created_at.asc`,
    { headers: headers() },
  )
  return res.ok ? res.json() : []
}

export async function getAgendaContent(agendaItemId: string): Promise<AgendaContentRow | null> {
  const res = await fetch(
    `${URL}/rest/v1/workshop_agenda_content?agenda_item_id=eq.${agendaItemId}&select=*`,
    { headers: headers() },
  )
  if (!res.ok) return null
  const arr = await res.json()
  return arr[0] ?? null
}

// Upsert on agenda_item_id (the table's UNIQUE key). On update, bump `version`.
export async function upsertAgendaContent(
  data: {
    workshopId: string
    agendaItemId: string
    sectionKind: SectionKind
    content?: SectionContent | null
    clarifyingQuestions?: ClarifyingQuestion[]
    kbGaps?: KbGap[]
    status?: AgendaContentStatus
  },
): Promise<AgendaContentRow> {
  const existing = await getAgendaContent(data.agendaItemId)
  const body: Record<string, unknown> = {
    workshop_id: data.workshopId,
    agenda_item_id: data.agendaItemId,
    section_kind: data.sectionKind,
    updated_at: new Date().toISOString(),
  }
  if (data.content !== undefined) body.content = data.content
  if (data.clarifyingQuestions !== undefined) body.clarifying_questions = data.clarifyingQuestions
  if (data.kbGaps !== undefined) body.kb_gaps = data.kbGaps
  if (data.status !== undefined) body.status = data.status

  if (existing) {
    body.version = (existing.version ?? 1) + 1
    const res = await fetch(
      `${URL}/rest/v1/workshop_agenda_content?agenda_item_id=eq.${data.agendaItemId}`,
      { method: 'PATCH', headers: headers('return=representation'), body: JSON.stringify(body) },
    )
    const arr = await res.json()
    if (!res.ok) throw new Error(arr.message || 'Failed to update agenda content')
    return one(arr)
  }

  const res = await fetch(`${URL}/rest/v1/workshop_agenda_content`, {
    method: 'POST',
    headers: headers('return=representation'),
    body: JSON.stringify(body),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to create agenda content')
  return one(arr)
}

export async function updateWorkshopDuration(workshopId: string, minutes: number): Promise<void> {
  await fetch(`${URL}/rest/v1/workshops?id=eq.${workshopId}`, {
    method: 'PATCH',
    headers: headers('return=minimal'),
    body: JSON.stringify({ duration_minutes: minutes }),
  })
}

export async function setAgendaSectionMeta(
  agendaItemId: string,
  meta: { sectionKind?: SectionKind; workstreamCode?: string | null },
): Promise<void> {
  const body: Record<string, unknown> = {}
  if (meta.sectionKind !== undefined) body.section_kind = meta.sectionKind
  if (meta.workstreamCode !== undefined) body.workstream_code = meta.workstreamCode
  await fetch(`${URL}/rest/v1/workshop_agenda_items?id=eq.${agendaItemId}`, {
    method: 'PATCH',
    headers: headers('return=minimal'),
    body: JSON.stringify(body),
  })
}
