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

  // Build sections from agenda items (already in sort_order) that HAVE content.
  const sections: DeckSection[] = []
  for (const item of agenda) {
    const row = contentByItem.get(item.id)
    if (!row?.content) continue
    sections.push({
      agendaItemId: item.id,
      agendaTitle: item.title,
      ...(item.timebox_minutes != null ? { timeboxMinutes: item.timebox_minutes } : {}),
      content: row.content,
    })
  }

  const slides = buildFacilitationDeck({
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

  // slideSections: two leading nulls (title + agenda), then each section's
  // agendaItemId repeated by that section's slide count. Recompute the counts
  // with buildSlides using the SAME opts buildFacilitationDeck passes.
  const slideSections: (string | null)[] = [null, null]
  for (const s of sections) {
    const count = buildSlides(s.content, {
      title: s.agendaTitle,
      ...(s.timeboxMinutes != null ? { timeboxMinutes: s.timeboxMinutes } : {}),
    }).length
    for (let i = 0; i < count; i++) slideSections.push(s.agendaItemId)
  }

  return { slides, slideSections, workshop, sections }
}
