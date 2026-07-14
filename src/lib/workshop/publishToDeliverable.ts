// Publish a workshop to the Deliverables section: turn its facilitation deck
// (the SAME normalized slides the PPTX exporter uses) into a deliverable document
// whose sections carry the workshop's diagrams as `svg` blocks. Once persisted,
// the Deliverables page's existing "Download PowerPoint / Word / HTML" exporters
// render it — including the diagrams (exportDeliverablePptx rasterizes svg blocks).
//
// This bypasses the evidence-gated /api/deliverables POST (that path only runs the
// agent generator); a workshop readout is authored content, not agent-evidenced,
// so we insert directly (RLS lets an org member write their own org's rows).

import { loadFacilitationDeck } from './deck'
import { renderWorkshopDiagramSvg } from './diagramSvg'
import type { WorkshopSlide } from '@jlee-revtech/agent-core'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function accessToken(): string | null {
  try {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    return JSON.parse(localStorage.getItem(key) || '{}')?.access_token ?? null
  } catch {
    return null
  }
}

// A slide's text content → markdown, matching what the deliverable exporters parse.
function slideMarkdown(slide: WorkshopSlide): string {
  const out: string[] = []
  if (slide.subheading) out.push(`_${slide.subheading}_`)
  for (const b of slide.bullets ?? []) out.push(`- ${b}`)
  for (const block of slide.blocks ?? []) {
    if (block.label) out.push(`**${block.label}**`)
    if (block.body) out.push(block.body)
    for (const b of block.bullets ?? []) out.push(`- ${b}`)
    if (block.pros?.length) {
      out.push('**Pros**')
      for (const p of block.pros) out.push(`- ${p}`)
    }
    if (block.cons?.length) {
      out.push('**Cons**')
      for (const c of block.cons) out.push(`- ${c}`)
    }
  }
  if (slide.facilitatorNotes) out.push(`> ${slide.facilitatorNotes}`)
  return out.join('\n\n')
}

export interface PublishOptions {
  workstreamCode?: string
  extraTags?: string[]
}

/**
 * Build a deliverable from a workshop and insert it. Returns the new deliverable id.
 */
export async function publishWorkshopToDeliverables(
  workshopId: string,
  orgId: string,
  userId: string | undefined,
  opts: PublishOptions = {},
): Promise<string> {
  const deck = await loadFacilitationDeck(null, workshopId)

  const sections = deck.slides.map((slide, i) => {
    const blocks: { kind: 'svg'; title?: string; svg: string }[] = []
    if (slide.diagram) {
      try {
        const { svg } = renderWorkshopDiagramSvg(slide.diagram, { width: 1000 })
        if (svg) blocks.push({ kind: 'svg', title: slide.heading, svg })
      } catch {
        /* a diagram that fails to render is skipped, not fatal */
      }
    }
    return {
      key: `slide-${i}`,
      title: slide.heading || `Section ${i + 1}`,
      content: slideMarkdown(slide),
      ...(blocks.length ? { blocks } : {}),
    }
  })

  const tags = [...new Set(['Workshop', ...(deck.workshop.customerName ? [deck.workshop.customerName] : []), ...(opts.extraTags ?? [])])]

  const body = {
    organization_id: orgId,
    workstream_code: opts.workstreamCode || 'enterprise',
    dtype: 'workshop_readout',
    title: `${deck.workshop.title} — Workshop Readout`,
    subject: deck.workshop.topic || deck.workshop.title,
    status: 'draft',
    content: { sections },
    evidence: [],
    tags,
    ...(userId ? { created_by: userId } : {}),
  }

  const token = accessToken()
  const res = await fetch(`${SUPA_URL}/rest/v1/deliverables`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPA_ANON,
      Authorization: `Bearer ${token}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  const arr = await res.json()
  if (!res.ok) throw new Error(arr.message || 'Failed to publish workshop to Deliverables')
  const row = Array.isArray(arr) ? arr[0] : arr
  return row.id as string
}
