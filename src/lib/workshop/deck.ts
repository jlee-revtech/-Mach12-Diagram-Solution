// Shared facilitation-deck loader. Loads the workshop, its agenda (sort_order),
// and the per-section content rows, then derives the normalized WorkshopSlide[]
// via buildFacilitationDeck (agent-core). Both the HTML "Workshop Experience"
// present route (Phase 4) and the PPTX export (Phase 5) call this so the two
// renderings never drift.
//
// slideSections is a parallel array: for each slide index it holds the
// agenda_item_id the slide belongs to (null for the leading title + agenda
// slides). It is computed deterministically from the SAME buildSlides calls
// buildFacilitationDeck makes internally: title slide + agenda slide, then per
// section buildSlides(content, {title, timeboxMinutes}) contributes N slides,
// so the section's agenda_item_id is pushed N times. This keeps the present
// view (highlighting / live revise) and the pptx export in lockstep.

import {
  buildFacilitationDeck,
  buildSlides,
  type WorkshopSlide,
  type SectionContent,
} from '@jlee-revtech/agent-core'
import { getWorkshop, listAgenda, listAgendaContent } from '@/lib/supabase/workshops'
import { readSynthesis, sortByPriority } from './decisionCriteria'

// Coerce any value into a string[] (bullets). Guards against OLD-shape persisted
// content (pre-reframe) where context / rationale / talkingPoints were single
// strings: buildSlides would otherwise emit a string where a bullet array is
// expected and a downstream `.map` throws ("e.map is not a function").
function asArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => x != null && x !== '').map((x) => String(x))
  if (v == null || v === '') return []
  return [String(v)]
}

// Normalize a persisted content row into the CURRENT section-content shape so the
// deck builder never receives a string where it expects an array. New-shape
// content passes through unchanged; old rows render best-effort (regenerate to get
// the full new structure + per-decision visuals). Exported so the prep-view editor
// (SectionEditor / SectionContentEditor) reuses the SAME coercion the deck does,
// keeping old rows from throwing "x.map is not a function" on render/edit.
export function normalizeSectionContent(content: SectionContent): SectionContent {
  const c = content as unknown as Record<string, unknown>
  // App-level extension carried through on every kind (agent-core does not model it).
  const notes = Array.isArray(c.notesAndConsiderations) ? { notesAndConsiderations: asArr(c.notesAndConsiderations) } : {}
  if (c.kind === 'workstream') {
    const legacyFocus = typeof c.focusedContext === 'string' ? [c.focusedContext as string] : []
    const keyDecisions = (Array.isArray(c.keyDecisions) ? c.keyDecisions : []).map((d) => {
      const dd = (d ?? {}) as Record<string, unknown>
      const rec = (dd.recommendedDecision ?? {}) as Record<string, unknown>
      return {
        id: String(dd.id ?? ''),
        title: String(dd.title ?? ''),
        context: asArr(dd.context),
        leadingQuestions: asArr(dd.leadingQuestions),
        recommendedDecision: {
          recommendation: String(rec.recommendation ?? ''),
          rationale: asArr(rec.rationale),
          ...(rec.confidence ? { confidence: rec.confidence } : {}),
        },
        ...(dd.diagram ? { diagram: dd.diagram } : {}),
      }
    })
    return {
      kind: 'workstream',
      workstreamCode: String(c.workstreamCode ?? ''),
      ...(c.workstreamName ? { workstreamName: String(c.workstreamName) } : {}),
      overallConsiderations: c.overallConsiderations != null ? asArr(c.overallConsiderations) : legacyFocus,
      currentState: asArr(c.currentState),
      futureStateOptions: (Array.isArray(c.futureStateOptions) ? c.futureStateOptions : []).map((o) => {
        const oo = (o ?? {}) as Record<string, unknown>
        return {
          label: String(oo.label ?? ''),
          ...(oo.summary ? { summary: String(oo.summary) } : {}),
          pros: asArr(oo.pros),
          cons: asArr(oo.cons),
        }
      }),
      keyDecisions,
      ...(Array.isArray(c.diagrams) ? { diagrams: c.diagrams } : {}),
      ...notes,
    } as unknown as SectionContent
  }
  if (c.kind === 'evaluation') {
    return {
      kind: 'evaluation',
      divergences: Array.isArray(c.divergences) ? c.divergences : [],
      overallRecommendation: String(c.overallRecommendation ?? ''),
      pros: asArr(c.pros),
      cons: asArr(c.cons),
      ...(c.tradeoffs != null ? { tradeoffs: asArr(c.tradeoffs) } : {}),
      rationale: asArr(c.rationale),
      ...(Array.isArray(c.diagrams) ? { diagrams: c.diagrams } : {}),
      // App-level decision-criteria synthesis (carried through unchanged).
      ...(c.recommendedDecision != null ? { recommendedDecision: c.recommendedDecision } : {}),
      ...(Array.isArray(c.decisionCriteria) ? { decisionCriteria: c.decisionCriteria } : {}),
      ...(Array.isArray(c.actions) ? { actions: c.actions } : {}),
      ...(Array.isArray(c.nextSteps) ? { nextSteps: asArr(c.nextSteps) } : {}),
      ...notes,
    } as unknown as SectionContent
  }
  // 056 assessment archetype: per-workstream discovery section.
  if (c.kind === 'assessment') {
    const asOpps = (v: unknown) => (Array.isArray(v) ? v : []).map((o) => {
      const oo = (o ?? {}) as Record<string, unknown>
      return {
        id: String(oo.id ?? ''),
        title: String(oo.title ?? ''),
        ...(oo.summary ? { summary: String(oo.summary) } : {}),
        painPoints: asArr(oo.painPoints),
        ...(oo.impact ? { impact: oo.impact } : {}),
        ...(oo.effort ? { effort: oo.effort } : {}),
      }
    })
    return {
      kind: 'assessment',
      workstreamCode: String(c.workstreamCode ?? ''),
      ...(c.workstreamName ? { workstreamName: String(c.workstreamName) } : {}),
      framing: asArr(c.framing),
      assessmentQuestions: asArr(c.assessmentQuestions),
      discoveryQuestions: asArr(c.discoveryQuestions),
      processOpportunities: asOpps(c.processOpportunities),
      dataOpportunities: asOpps(c.dataOpportunities),
      technologyOpportunities: asOpps(c.technologyOpportunities),
      ...(Array.isArray(c.diagrams) ? { diagrams: c.diagrams } : {}),
      ...notes,
    } as unknown as SectionContent
  }
  // 056 assessment archetype: the AI-sequenced opportunity roadmap.
  if (c.kind === 'roadmap') {
    return {
      kind: 'roadmap',
      summary: String(c.summary ?? ''),
      quickWins: asArr(c.quickWins),
      dependencies: (Array.isArray(c.dependencies) ? c.dependencies : []).map((d) => {
        const dd = (d ?? {}) as Record<string, unknown>
        return {
          prerequisite: String(dd.prerequisite ?? ''),
          dependent: String(dd.dependent ?? ''),
          reason: String(dd.reason ?? ''),
        }
      }),
      phases: (Array.isArray(c.phases) ? c.phases : []).map((p) => {
        const pp = (p ?? {}) as Record<string, unknown>
        return {
          name: String(pp.name ?? ''),
          ...(pp.timeframe ? { timeframe: String(pp.timeframe) } : {}),
          opportunities: asArr(pp.opportunities),
          rationale: asArr(pp.rationale),
        }
      }),
      ...(c.risks != null ? { risks: asArr(c.risks) } : {}),
      ...(Array.isArray(c.diagrams) ? { diagrams: c.diagrams } : {}),
      ...notes,
    } as unknown as SectionContent
  }
  // 057 training archetype: per-role training build-out.
  if (c.kind === 'training') {
    return {
      kind: 'training',
      workstreamCode: String(c.workstreamCode ?? ''),
      ...(c.workstreamName ? { workstreamName: String(c.workstreamName) } : {}),
      ...(c.roleTitle ? { roleTitle: String(c.roleTitle) } : {}),
      roleContext: asArr(c.roleContext),
      businessProcess: (Array.isArray(c.businessProcess) ? c.businessProcess : []).map((s) => {
        const ss = (s ?? {}) as Record<string, unknown>
        return { label: String(ss.label ?? ''), ...(ss.sublabel ? { sublabel: String(ss.sublabel) } : {}) }
      }),
      dataIntegrations: (Array.isArray(c.dataIntegrations) ? c.dataIntegrations : []).map((di) => {
        const d = (di ?? {}) as Record<string, unknown>
        return {
          id: String(d.id ?? ''),
          title: String(d.title ?? ''),
          systems: asArr(d.systems),
          ...(d.direction ? { direction: d.direction } : {}),
          ...(d.dataObjects != null ? { dataObjects: asArr(d.dataObjects) } : {}),
          ...(d.note ? { note: String(d.note) } : {}),
        }
      }),
      toolTraining: (Array.isArray(c.toolTraining) ? c.toolTraining : []).map((m) => {
        const mm = (m ?? {}) as Record<string, unknown>
        return {
          id: String(mm.id ?? ''),
          title: String(mm.title ?? ''),
          ...(mm.system ? { system: String(mm.system) } : {}),
          learningObjectives: asArr(mm.learningObjectives),
          keySteps: asArr(mm.keySteps),
          ...(mm.transactions != null ? { transactions: asArr(mm.transactions) } : {}),
          ...(mm.tips != null ? { tips: asArr(mm.tips) } : {}),
          ...(mm.screenshot ? { screenshot: mm.screenshot } : {}),
        }
      }),
      ...(c.exercises != null ? { exercises: asArr(c.exercises) } : {}),
      ...(Array.isArray(c.diagrams) ? { diagrams: c.diagrams } : {}),
      ...notes,
    } as unknown as SectionContent
  }
  // 057 training archetype: the sequenced Learning Path.
  if (c.kind === 'curriculum') {
    return {
      kind: 'curriculum',
      summary: String(c.summary ?? ''),
      foundations: asArr(c.foundations),
      tracks: (Array.isArray(c.tracks) ? c.tracks : []).map((t) => {
        const tt = (t ?? {}) as Record<string, unknown>
        return { role: String(tt.role ?? ''), modules: asArr(tt.modules) }
      }),
      prerequisites: (Array.isArray(c.prerequisites) ? c.prerequisites : []).map((d) => {
        const dd = (d ?? {}) as Record<string, unknown>
        return { prerequisite: String(dd.prerequisite ?? ''), dependent: String(dd.dependent ?? ''), reason: String(dd.reason ?? '') }
      }),
      phases: (Array.isArray(c.phases) ? c.phases : []).map((p) => {
        const pp = (p ?? {}) as Record<string, unknown>
        return { name: String(pp.name ?? ''), ...(pp.timeframe ? { timeframe: String(pp.timeframe) } : {}), modules: asArr(pp.modules), rationale: asArr(pp.rationale) }
      }),
      ...(Array.isArray(c.diagrams) ? { diagrams: c.diagrams } : {}),
      ...notes,
    } as unknown as SectionContent
  }
  // 057 training archetype: the Knowledge Check.
  if (c.kind === 'certification') {
    return {
      kind: 'certification',
      summary: String(c.summary ?? ''),
      exercises: (Array.isArray(c.exercises) ? c.exercises : []).map((e) => {
        const ee = (e ?? {}) as Record<string, unknown>
        return {
          id: String(ee.id ?? ''),
          title: String(ee.title ?? ''),
          ...(ee.role ? { role: String(ee.role) } : {}),
          scenario: String(ee.scenario ?? ''),
          ...(ee.steps != null ? { steps: asArr(ee.steps) } : {}),
          successCriteria: asArr(ee.successCriteria),
        }
      }),
      quizQuestions: (Array.isArray(c.quizQuestions) ? c.quizQuestions : []).map((q) => {
        const qq = (q ?? {}) as Record<string, unknown>
        return { id: String(qq.id ?? ''), question: String(qq.question ?? ''), ...(qq.role ? { role: String(qq.role) } : {}), ...(qq.answer ? { answer: String(qq.answer) } : {}) }
      }),
      signoffChecklist: asArr(c.signoffChecklist),
      ...(Array.isArray(c.diagrams) ? { diagrams: c.diagrams } : {}),
      ...notes,
    } as unknown as SectionContent
  }
  // overview
  return {
    kind: 'overview',
    headline: String(c.headline ?? ''),
    talkingPoints: asArr(c.talkingPoints),
    ...(c.facilitatorNotes ? { facilitatorNotes: String(c.facilitatorNotes) } : {}),
    ...(Array.isArray(c.diagrams) ? { diagrams: c.diagrams } : {}),
    ...notes,
  } as unknown as SectionContent
}

// Read the app-level "Notes & Considerations" bullets off any section content.
export function sectionNotes(content: SectionContent): string[] {
  const n = (content as unknown as Record<string, unknown>).notesAndConsiderations
  return Array.isArray(n) ? n.filter((x) => x != null && x !== '').map((x) => String(x)) : []
}

export interface DeckWorkshop {
  id: string
  title: string
  customerName: string | null
  topic: string | null
  durationMinutes: number | null
}

export interface DeckSection {
  agendaItemId: string
  agendaTitle: string
  timeboxMinutes?: number
  content: SectionContent
}

export interface LoadedDeck {
  slides: WorkshopSlide[]
  // Parallel to slides: the agenda_item_id each slide belongs to (null for the
  // leading title + agenda slides).
  slideSections: (string | null)[]
  workshop: DeckWorkshop
  sections: DeckSection[]
}

// A minimal client shape: we only need a marker so the signature matches the
// Phase 5 callers and the present route. The data-access helpers read the JWT
// from localStorage themselves (mirroring the rest of src/lib/supabase/*), so
// the client argument is currently a pass-through placeholder for parity with
// PLAN §6 and future server variants.
export type DeckClient = unknown

export async function loadFacilitationDeck(
  _client: DeckClient,
  workshopId: string,
): Promise<LoadedDeck> {
  const [ws, agenda, contentRows] = await Promise.all([
    getWorkshop(workshopId),
    listAgenda(workshopId),
    listAgendaContent(workshopId),
  ])

  if (!ws) throw new Error('Workshop not found')

  const workshop: DeckWorkshop = {
    id: ws.id,
    title: ws.title,
    customerName: ws.customer_name,
    topic: ws.topic,
    durationMinutes: ws.duration_minutes,
  }

  // Content rows keyed by agenda_item_id (only rows with non-null content matter).
  const contentByItem = new Map(contentRows.map((c) => [c.agenda_item_id, c]))

  // Workstreams removed from the workshop are HIDDEN, not deleted: their agenda
  // items + content stay in the DB but are excluded from the deck.
  const activeCodes = new Set(ws.workstream_codes || [])

  // Build sections from agenda items (already in sort_order) that HAVE content.
  const sections: DeckSection[] = []
  for (const item of agenda) {
    if ((item.section_kind === 'workstream' || item.section_kind === 'assessment' || item.section_kind === 'training') && item.workstream_code && !activeCodes.has(item.workstream_code)) continue
    const row = contentByItem.get(item.id)
    if (!row?.content) continue
    sections.push({
      agendaItemId: item.id,
      agendaTitle: item.title,
      ...(item.timebox_minutes != null ? { timeboxMinutes: item.timebox_minutes } : {}),
      // Normalize so OLD-shape rows (pre-reframe strings) never reach buildSlides
      // as a string where an array is expected.
      content: normalizeSectionContent(row.content),
    })
  }

  // Use buildFacilitationDeck only for the leading title + agenda slides, then
  // rebuild the body with the SAME buildSlides calls it makes internally, so we can
  // inject a "Notes & Considerations" slide after each section that has notes and
  // keep slideSections in lockstep (title + agenda are section-less nulls).
  const baseDeck = buildFacilitationDeck({
    title: workshop.title,
    ...(workshop.customerName ? { customerName: workshop.customerName } : {}),
    ...(workshop.topic ? { topic: workshop.topic } : {}),
    ...(workshop.durationMinutes ? { durationMinutes: workshop.durationMinutes } : {}),
    sections: sections.map((s) => ({
      agendaTitle: s.agendaTitle,
      ...(s.timeboxMinutes != null ? { timeboxMinutes: s.timeboxMinutes } : {}),
      content: s.content,
    })),
  })

  const slides: WorkshopSlide[] = baseDeck.slice(0, 2)
  const slideSections: (string | null)[] = [null, null]
  for (const s of sections) {
    const secSlides = buildSlides(s.content, {
      title: s.agendaTitle,
      ...(s.timeboxMinutes != null ? { timeboxMinutes: s.timeboxMinutes } : {}),
    })
    for (const sl of secSlides) { slides.push(sl); slideSections.push(s.agendaItemId) }
    const notes = sectionNotes(s.content)
    if (notes.length) {
      slides.push({ kind: 'bullets', heading: 'Notes & Considerations', subheading: s.agendaTitle, bullets: notes })
      slideSections.push(s.agendaItemId)
    }
    // Evaluation section: the synthesized decision-criteria deliverable as slides.
    if (s.content.kind === 'evaluation') {
      const { recommendedDecision, decisionCriteria, actions, nextSteps } = readSynthesis(s.content)
      if (recommendedDecision.length) {
        slides.push({ kind: 'bullets', heading: 'Recommended Decision', subheading: s.agendaTitle, bullets: recommendedDecision })
        slideSections.push(s.agendaItemId)
      }
      if (decisionCriteria.length) {
        slides.push({
          kind: 'bullets', heading: 'Decision Criteria', subheading: s.agendaTitle,
          bullets: sortByPriority(decisionCriteria).map((d) => `${d.criterion}${d.priority ? ` (${d.priority})` : ''}${d.rationale ? `: ${d.rationale}` : ''}`),
        })
        slideSections.push(s.agendaItemId)
      }
      if (actions.length) {
        slides.push({
          kind: 'bullets', heading: 'Actions', subheading: s.agendaTitle,
          bullets: actions.map((a) => `${a.title}${a.owner ? `, ${a.owner}` : ''}${a.due ? ` (due ${a.due})` : ''}`),
        })
        slideSections.push(s.agendaItemId)
      }
      if (nextSteps.length) {
        slides.push({ kind: 'bullets', heading: 'Next Steps', subheading: s.agendaTitle, bullets: nextSteps })
        slideSections.push(s.agendaItemId)
      }
    }
  }

  return { slides, slideSections, workshop, sections }
}
