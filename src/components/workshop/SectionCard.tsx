'use client'

// One agenda section rendered as a selectable card in the prep view. Shows the
// title, timebox, a section_kind badge (overview / workstream / evaluation), the
// workstream chip when present, and a content-status pill derived from the loaded
// content row. Clicking selects the card for editing.

import type { WorkshopAgendaItem } from '@/lib/workshop/types'
import type { Workstream } from '@/lib/workstream/types'
import type { AgendaContentRow } from '@/lib/supabase/workshops'
import { sectionMetaFor, CONTENT_STATUS_META } from './sectionMeta'

export default function SectionCard({
  item, index, content, workstream, selected, onSelect,
}: {
  item: WorkshopAgendaItem
  index: number
  content?: AgendaContentRow | null
  workstream?: Workstream | null
  selected: boolean
  onSelect: () => void
}) {
  const meta = sectionMetaFor(item.section_kind)
  const status = content?.status ?? 'empty'
  const statusMeta = CONTENT_STATUS_META[status] ?? CONTENT_STATUS_META.empty
  const wsColor = workstream?.color || '#2563EB'
  const wsName = workstream?.name?.split('(')[0].trim() || item.workstream_code

  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-lg border px-3 py-2.5 transition-colors"
      style={{
        borderColor: selected ? meta.color : 'var(--m12-border)',
        backgroundColor: selected ? `${meta.color}14` : 'var(--m12-bg-card)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-[var(--m12-text-muted)] w-4 shrink-0">{index + 1}</span>
        <span
          className="text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded flex items-center gap-1"
          style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
        >
          <span>{meta.icon}</span>{meta.label}
        </span>
        {item.workstream_code && (
          <span
            className="text-[8px] px-1.5 py-0.5 rounded truncate max-w-[10rem]"
            style={{ backgroundColor: `${wsColor}1A`, color: wsColor }}
            title={wsName || undefined}
          >
            {wsName}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {item.timebox_minutes ? (
            <span className="text-[9px] text-[var(--m12-text-muted)]">{item.timebox_minutes}m</span>
          ) : null}
          <span
            className="text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${statusMeta.color}1A`, color: statusMeta.color }}
          >
            {statusMeta.label}
          </span>
        </span>
      </div>
      <div className="text-[12px] text-[var(--m12-text)] leading-snug pl-6">{item.title}</div>
      {item.objective && (
        <div className="text-[10px] text-[var(--m12-text-muted)] leading-snug mt-0.5 pl-6">{item.objective}</div>
      )}
    </button>
  )
}
