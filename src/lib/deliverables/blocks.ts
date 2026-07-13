// Rich enrichment blocks a deliverable section can carry (app-side extension of
// the agent-core GeneratedSection shape; agent-core itself is NOT forked).
//
// Stored inside deliverables.content.sections[n].blocks. Old documents have no
// blocks array, so every reader must treat it as optional. Blocks are written by
// the DELIVERABLE_ENRICH_TOOLS (src/lib/agents/deliverableTools.ts), rendered by
// the Documents tab, and degraded gracefully by the HTML/Word/PowerPoint exports.

export type SectionBlock =
  | { kind: 'svg'; title?: string; svg: string }
  | { kind: 'table'; title?: string; columns: string[]; rows: string[][] }
  | { kind: 'diagram_ref'; diagramId: string; title?: string }

/** A deliverable section as persisted: agent-core's {key,title,content} plus the
 *  app-side blocks extension. */
export interface DeliverableSection {
  key: string
  title: string
  content: string
  blocks?: SectionBlock[]
}

/** Runtime guard so a malformed block (hand-edited JSON, older writer) never
 *  crashes a render or an export. */
export function isSectionBlock(b: unknown): b is SectionBlock {
  if (!b || typeof b !== 'object') return false
  const o = b as Record<string, unknown>
  if (o.kind === 'svg') return typeof o.svg === 'string' && o.svg.trim().length > 0
  if (o.kind === 'table') {
    return (
      Array.isArray(o.columns) &&
      o.columns.every((c) => typeof c === 'string') &&
      Array.isArray(o.rows) &&
      o.rows.every((r) => Array.isArray(r) && r.every((c) => typeof c === 'string'))
    )
  }
  if (o.kind === 'diagram_ref') return typeof o.diagramId === 'string' && o.diagramId.trim().length > 0
  return false
}

/** The valid blocks of a section (defensive: filters malformed entries). */
export function sectionBlocks(section: { blocks?: unknown } | null | undefined): SectionBlock[] {
  const raw = section && Array.isArray(section.blocks) ? section.blocks : []
  return raw.filter(isSectionBlock)
}
