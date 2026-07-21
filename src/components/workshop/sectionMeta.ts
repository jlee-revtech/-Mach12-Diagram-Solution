// Section-authoring metadata maps, in the style of CAPTURE_META
// (src/lib/workshop/types.ts). Shared by SectionCard + SectionEditor so the
// section-kind badge and content-status pill render consistently.

import type { SectionKind } from '@/lib/workshop/types'
import type { AgendaContentStatus } from '@/lib/supabase/workshops'

export const SECTION_META: Record<SectionKind, { label: string; color: string; icon: string }> = {
  overview: { label: 'Overview', color: '#0891B2', icon: '◆' },
  workstream: { label: 'Workstream', color: '#2563EB', icon: '▧' },
  evaluation: { label: 'Evaluation', color: '#7C3AED', icon: '⚖' },
  // 056 assessment archetype
  assessment: { label: 'Assessment', color: '#059669', icon: '◎' },
  roadmap: { label: 'Roadmap', color: '#D97706', icon: '➔' },
}

// Impact / effort badge for opportunity items (assessment archetype).
export const LEVEL_META: Record<'low' | 'medium' | 'high', { label: string; color: string }> = {
  low: { label: 'Low', color: '#6B7280' },
  medium: { label: 'Medium', color: '#2563EB' },
  high: { label: 'High', color: '#059669' },
}

// Content-status pill. Derived from the loaded content row (empty when no row).
export const CONTENT_STATUS_META: Record<AgendaContentStatus, { label: string; color: string }> = {
  empty: { label: 'Empty', color: '#6B7280' },
  generating: { label: 'Generating', color: '#D97706' },
  draft: { label: 'Draft', color: '#2563EB' },
  needs_input: { label: 'Needs input', color: '#D97706' },
  final: { label: 'Final', color: '#059669' },
}

// A confidence badge for a recommended decision.
export const CONFIDENCE_META: Record<'low' | 'medium' | 'high', { label: string; color: string }> = {
  low: { label: 'Low confidence', color: '#D97706' },
  medium: { label: 'Medium confidence', color: '#2563EB' },
  high: { label: 'High confidence', color: '#059669' },
}

// Fall back to 'overview' styling if an agenda item has no section_kind yet.
export function sectionMetaFor(kind: SectionKind | null | undefined) {
  return SECTION_META[kind ?? 'overview'] ?? SECTION_META.overview
}
