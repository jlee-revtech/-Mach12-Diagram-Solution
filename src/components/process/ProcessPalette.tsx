'use client'

import { BPMN_PALETTE } from '@/lib/process/types'
import type { BpmnElementType } from '@/lib/process/types'

// Drag-out palette. Each chip sets the BPMN element type on the drag payload;
// the editor's onDrop reads it and creates a node at the drop position.
export default function ProcessPalette({ onAddLane }: { onAddLane: () => void }) {
  const groups = Array.from(new Set(BPMN_PALETTE.map(p => p.group)))

  const handleDragStart = (e: React.DragEvent, type: BpmnElementType) => {
    e.dataTransfer.setData('application/bpmn-element', type)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-44 shrink-0 border-r border-[var(--m12-border)]/40 bg-[var(--m12-bg-card)]/40 overflow-y-auto">
      <div className="px-3 py-2 border-b border-[var(--m12-border)]/40 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold">
          Palette
        </span>
      </div>

      <button
        onClick={onAddLane}
        className="m-2 w-[calc(100%-1rem)] flex items-center justify-center gap-1.5 text-[11px] text-[#0EA5E9] border border-dashed border-[#0EA5E9]/40 hover:border-[#0EA5E9]/70 hover:bg-[#0EA5E9]/5 rounded-md py-1.5 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M2 7h10M2 4h10M2 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Add Lane
      </button>

      {groups.map(group => (
        <div key={group} className="px-2 pb-2">
          <div className="px-1 py-1 text-[9px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
            {group}
          </div>
          <div className="space-y-1">
            {BPMN_PALETTE.filter(p => p.group === group).map(item => (
              <div
                key={item.type}
                draggable
                onDragStart={e => handleDragStart(e, item.type)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-[var(--m12-border)]/40 hover:border-[var(--m12-border)] bg-[var(--m12-bg)]/40 hover:bg-[var(--m12-bg)] cursor-grab active:cursor-grabbing transition-colors"
              >
                <PaletteGlyph group={group} color={item.color} />
                <span className="text-[11px] text-[var(--m12-text-secondary)] truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PaletteGlyph({ group, color }: { group: string; color: string }) {
  if (group === 'Events') {
    return <span className="inline-block w-3.5 h-3.5 rounded-full shrink-0" style={{ border: `1.5px solid ${color}` }} />
  }
  if (group === 'Gateways') {
    return <span className="inline-block w-3 h-3 shrink-0" style={{ border: `1.5px solid ${color}`, transform: 'rotate(45deg)', borderRadius: 2 }} />
  }
  return <span className="inline-block w-4 h-3 rounded-sm shrink-0" style={{ border: `1.5px solid ${color}` }} />
}
