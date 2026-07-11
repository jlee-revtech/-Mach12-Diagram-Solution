'use client'

import { Rows3 } from 'lucide-react'
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
    <div className="w-44 shrink-0 border-r border-border bg-white overflow-y-auto">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-text-tertiary">
          Palette
        </span>
      </div>

      <button
        type="button"
        onClick={onAddLane}
        className="m-2 w-[calc(100%-1rem)] flex items-center justify-center gap-1.5 text-[11px] font-medium text-brand-600 border border-dashed border-brand-300 hover:border-brand-500 hover:bg-brand-50 rounded-md py-1.5 transition-colors"
      >
        <Rows3 size={12} />
        Add Lane
      </button>

      {groups.map(group => (
        <div key={group} className="px-2 pb-2">
          <div className="px-1 py-1 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
            {group}
          </div>
          <div className="space-y-1">
            {BPMN_PALETTE.filter(p => p.group === group).map(item => (
              <div
                key={item.type}
                draggable
                onDragStart={e => handleDragStart(e, item.type)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border hover:border-border-strong bg-white hover:bg-surface-muted cursor-grab active:cursor-grabbing transition-colors"
              >
                <PaletteGlyph group={group} color={item.color} />
                <span className="text-[11px] text-text-secondary truncate">{item.label}</span>
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
