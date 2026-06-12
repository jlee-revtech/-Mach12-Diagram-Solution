'use client'

import { useState } from 'react'
import { useProcessStore } from '@/lib/process/store'
import { PROCESS_LEVEL_LABEL } from '@/lib/process/types'
import ProcessLeafEditor from './ProcessLeafEditor'

// Leaf process view: a slim header with a collapsible details drawer
// (description + scope-item ref) above the full-bleed BPMN swimlane editor.
export default function ProcessLeafView({ nodeId, readOnly = false }: { nodeId: string; readOnly?: boolean }) {
  const node = useProcessStore(s => s.nodes.find(n => n.id === nodeId))
  const updateNode = useProcessStore(s => s.updateNode)
  const [detailsOpen, setDetailsOpen] = useState(false)

  if (!node) return null

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header strip */}
      <div className="shrink-0 border-b border-[var(--m12-border)]/40 bg-[var(--m12-bg-card)]/30">
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="text-[9px] uppercase tracking-widest text-[#10B981] font-[family-name:var(--font-space-mono)] font-bold">
            {PROCESS_LEVEL_LABEL[3]} · BPMN
          </span>
          <h2 className="text-sm font-semibold text-[var(--m12-text)] truncate">{node.name}</h2>
          {node.scope_item_ref && (
            <span className="text-[9px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] border border-[var(--m12-border)]/50 rounded px-1.5 py-0.5">
              {node.scope_item_ref}
            </span>
          )}
          <button
            onClick={() => setDetailsOpen(o => !o)}
            className="ml-auto text-[10px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] flex items-center gap-1"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className={`transition-transform ${detailsOpen ? 'rotate-90' : ''}`}>
              <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Details
          </button>
        </div>

        {detailsOpen && (
          <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold mb-1">Description</label>
              <textarea
                rows={2}
                defaultValue={node.description || ''}
                onBlur={e => { if (!readOnly && e.target.value.trim() !== (node.description || '')) updateNode(node.id, { description: e.target.value.trim() }) }}
                readOnly={readOnly}
                aria-label="Process description"
                className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-2.5 py-1.5 text-xs text-[var(--m12-text)] focus:outline-none focus:border-[#10B981]/60 resize-y"
              />
            </div>
            <div>
              <label className="block text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold mb-1">SAP Scope-Item Ref</label>
              <input
                defaultValue={node.scope_item_ref || ''}
                onBlur={e => { if (!readOnly && e.target.value.trim() !== (node.scope_item_ref || '')) updateNode(node.id, { scope_item_ref: e.target.value.trim() }) }}
                readOnly={readOnly}
                aria-label="SAP scope-item reference"
                className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-2.5 py-1.5 text-xs text-[var(--m12-text)] font-[family-name:var(--font-space-mono)] focus:outline-none focus:border-[#10B981]/60"
              />
            </div>
          </div>
        )}
      </div>

      {/* Editor fills remaining height */}
      <div className="flex-1 min-h-0">
        <ProcessLeafEditor nodeId={nodeId} readOnly={readOnly} />
      </div>
    </div>
  )
}
