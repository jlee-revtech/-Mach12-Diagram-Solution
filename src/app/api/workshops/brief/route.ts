import { NextRequest } from 'next/server'
import { generateBrief, type WorkshopFocus, type SectionKind, type WorkshopArchetype } from '@jlee-revtech/agent-core'
import { serverModelDb, workstreamRoster, assemblePreRead, assembleAttachmentsContext } from '@/lib/workshop/server'

// Generate a pre-workshop Brief: a timeboxed agenda, a pre-read of the customer's
// real architecture for the topic, the gaps/decisions to drive, and the probing
// questions to prepare. The extended generateBrief classifies each agenda item
// (section_kind + workstream_code), appends a final evaluation item for 2+
// workstreams, and normalizes timeboxes to sum to durationMinutes.
//
// When a workshopId is supplied, the route also persists the result server-side
// (agenda items with section metadata, duration on the workshop, and the brief)
// with the service key, scoped by organization_id. Without a workshopId it stays
// read-only compute and the caller persists the returned brief.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      orgId,
      workshopId,
      topic,
      objective,
      customerName,
      workstreamCodes,
      primaryWorkstreamCodes,
      archetype,
      focusAreas,
      systemsInScope,
      scenarios,
      durationMinutes,
      guidance,
    }: {
      orgId: string
      workshopId?: string
      topic: string
      objective?: string
      customerName?: string
      workstreamCodes?: string[]
      primaryWorkstreamCodes?: string[]
      archetype?: WorkshopArchetype
      focusAreas?: WorkshopFocus[]
      systemsInScope?: string[]
      scenarios?: { title: string; description?: string; focusType?: WorkshopFocus }[]
      durationMinutes?: number
      guidance?: string
    } = body
    if (!orgId || !topic) return json({ error: 'orgId and topic are required' }, 400)

    const db = serverModelDb()
    const codes = workstreamCodes || []
    const workstreams = await workstreamRoster(db, orgId, codes)
    const modelPreRead = await assemblePreRead(db, orgId, codes)

    // Workshop-level guidance (047): honor the persisted facilitation_prompt when a
    // workshop id is supplied, else the guidance passed in the body. Threaded into
    // generateBrief so "Regenerate brief" honors the same steer as every section.
    // 055: the same workshop read supplies primary_workstream_codes; attachments
    // are assembled into facilitator-provided context.
    let effectiveGuidance = (guidance || '').trim() || undefined
    let primaryCodes = (primaryWorkstreamCodes || []).filter((c) => codes.includes(c))
    let effectiveArchetype: WorkshopArchetype = normalizeArchetype(archetype)
    let effectiveSystems: string[] = (systemsInScope || []).filter(Boolean)
    let attachmentsContext: string | undefined
    if (workshopId) {
      const { data: gws } = await db
        .from('workshops')
        .select('facilitation_prompt, primary_workstream_codes, archetype, systems_in_scope')
        .eq('id', workshopId)
        .eq('organization_id', orgId)
        .maybeSingle<{ facilitation_prompt: string | null; primary_workstream_codes: string[] | null; archetype: string | null; systems_in_scope: string[] | null }>()
      if (!effectiveGuidance) effectiveGuidance = (gws?.facilitation_prompt || '').trim() || undefined
      if (!primaryCodes.length) {
        primaryCodes = (gws?.primary_workstream_codes || []).filter((c) => codes.includes(c))
      }
      if (!archetype) effectiveArchetype = normalizeArchetype(gws?.archetype)
      if (!effectiveSystems.length) effectiveSystems = (gws?.systems_in_scope || []).filter(Boolean)
      attachmentsContext = await assembleAttachmentsContext(db, workshopId)
    }
    const rosterByCode = new Map(workstreams.map((w) => [w.code, w]))
    const primaryWorkstreams = primaryCodes.map((c) => rosterByCode.get(c) || { code: c, name: c })

    const brief = await generateBrief({
      topic,
      objective,
      customerName,
      workstreams: workstreams.length ? workstreams : codes.map((c) => ({ code: c, name: c })),
      archetype: effectiveArchetype,
      primaryWorkstreams: primaryWorkstreams.length ? primaryWorkstreams : undefined,
      focusAreas,
      systemsInScope: effectiveSystems.length ? effectiveSystems : undefined,
      scenarios,
      modelPreRead,
      attachmentsContext,
      durationMinutes,
      guidance: effectiveGuidance,
      anthropicApiKey: ANTHROPIC_KEY,
    })
    if (!brief) return json({ error: 'Failed to generate brief' }, 502)

    // The model sometimes echoes a shorthand instead of the exact workstream code
    // (e.g. "S2P" or "STP" for source-to-pay), which orphans the section: the prep
    // page hides per-workstream items whose code isn't in the workshop's active
    // set. Coerce every agenda item's code back to a real one before persisting.
    const coercedAgenda = coerceAgendaWorkstreamCodes(brief.agenda || [], workstreams.length ? workstreams : codes.map((c) => ({ code: c, name: c })))

    // Persist server-side when a workshop id is supplied (org-scoped).
    if (workshopId) {
      const { data: ws } = await db
        .from('workshops')
        .select('id')
        .eq('id', workshopId)
        .eq('organization_id', orgId)
        .maybeSingle()
      if (!ws) return json({ error: 'Workshop not found for this organization' }, 404)

      // Replace the agenda, carrying section_kind + workstream_code on each item.
      await db.from('workshop_agenda_items').delete().eq('workshop_id', workshopId)
      const rows = coercedAgenda.map(
        (it, i: number) => ({
          workshop_id: workshopId,
          sort_order: i,
          title: it.title,
          objective: it.objective ?? null,
          focus_type: it.focusType ?? null,
          timebox_minutes: it.timeboxMinutes ?? null,
          section_kind: it.sectionKind ?? null,
          workstream_code: it.workstreamCode ?? null,
        }),
      )
      if (rows.length) {
        const { error: insErr } = await db.from('workshop_agenda_items').insert(rows)
        if (insErr) throw new Error(insErr.message)
      }

      // Store the brief (with the coerced agenda codes) + duration on the workshop.
      const wsUpdate: Record<string, unknown> = { brief: { ...brief, agenda: coercedAgenda }, status: 'scheduled' }
      if (durationMinutes != null) wsUpdate.duration_minutes = durationMinutes
      const { error: updErr } = await db.from('workshops').update(wsUpdate).eq('id', workshopId)
      if (updErr) throw new Error(updErr.message)
    }

    return json({ brief: { ...brief, agenda: coercedAgenda }, preRead: modelPreRead, persisted: !!workshopId }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

type BriefAgendaItem = {
  title: string
  objective?: string
  focusType?: WorkshopFocus
  timeboxMinutes?: number
  sectionKind?: SectionKind
  workstreamCode?: string
}

// Section kinds that carry a per-workstream code (decision / assessment / training).
const PER_WS_KINDS = new Set<SectionKind>(['workstream', 'assessment', 'training'])

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// Shorthand forms a model plausibly emits for a workstream: the joined words,
// the initials ("source-to-pay" -> "stp"), and initials with "to" -> "2" ("s2p"),
// derived from both the code and the display name (minus any parenthetical).
function aliasesFor(code: string, name?: string): string[] {
  const out = new Set<string>()
  const addForms = (raw: string) => {
    const words = raw.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    if (!words.length) return
    out.add(words.join(''))
    out.add(words.map((w) => w[0]).join(''))
    out.add(words.map((w) => (w === 'to' ? '2' : w[0])).join(''))
  }
  addForms(code)
  if (name) addForms(name.split('(')[0])
  return [...out]
}

function coerceAgendaWorkstreamCodes(
  agenda: BriefAgendaItem[],
  roster: { code: string; name?: string }[],
): BriefAgendaItem[] {
  const exact = new Set(roster.map((w) => w.code))
  // Alias -> code, dropping any alias two workstreams share (e.g. plan-to-produce
  // and plan-to-perform both shorten to "ptp"/"p2p" - ambiguous, so unusable).
  const aliasToCode = new Map<string, string>()
  const ambiguous = new Set<string>()
  for (const w of roster) {
    for (const a of aliasesFor(w.code, w.name)) {
      if (aliasToCode.has(a) && aliasToCode.get(a) !== w.code) ambiguous.add(a)
      else aliasToCode.set(a, w.code)
    }
  }
  for (const a of ambiguous) aliasToCode.delete(a)

  const items = agenda.map((it) => ({ ...it }))
  const unmatched: BriefAgendaItem[] = []
  for (const it of items) {
    if (!it.workstreamCode || !it.sectionKind || !PER_WS_KINDS.has(it.sectionKind)) continue
    if (exact.has(it.workstreamCode)) continue
    const byAlias = aliasToCode.get(norm(it.workstreamCode))
    if (byAlias) { it.workstreamCode = byAlias; continue }
    // The titles are usually explicit ("Source-to-Pay Discovery: ..."), so fall
    // back to finding a workstream named in the item title.
    const title = norm(it.title || '')
    const byTitle = roster.find((w) =>
      (title.includes(norm(w.code)) && norm(w.code).length >= 4) ||
      (w.name ? title.includes(norm(w.name.split('(')[0])) && norm(w.name.split('(')[0]).length >= 4 : false))
    if (byTitle) { it.workstreamCode = byTitle.code; continue }
    unmatched.push(it)
  }
  // Last resort: a single leftover item and a single workstream with no section
  // can only belong together.
  if (unmatched.length === 1) {
    const used = new Set(items
      .filter((i) => i.sectionKind && PER_WS_KINDS.has(i.sectionKind) && i.workstreamCode && exact.has(i.workstreamCode))
      .map((i) => i.workstreamCode))
    const free = roster.filter((w) => !used.has(w.code))
    if (free.length === 1) unmatched[0].workstreamCode = free[0].code
  }
  return items
}

// Coerce any stored/passed archetype value to a known WorkshopArchetype
// (defaults to 'decision', today's behavior).
function normalizeArchetype(a: string | null | undefined): WorkshopArchetype {
  return a === 'assessment' || a === 'training' ? a : 'decision'
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
