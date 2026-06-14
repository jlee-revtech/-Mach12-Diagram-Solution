'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProcessStore } from '@/lib/process/store'
import { PROCESS_LEVEL_LABEL } from '@/lib/process/types'
import { pushProcessLeafToNewDiagram } from '@/lib/process/pushToDiagram'
import ProcessLeafEditor from './ProcessLeafEditor'
import SipocLinkPanel from './SipocLinkPanel'
import OverlayPanel from './OverlayPanel'

// Leaf process view: a slim header with a collapsible details drawer
// (description + scope-item ref + SIPOC link) above the full-bleed BPMN editor.
export default function ProcessLeafView({
  nodeId, readOnly = false, orgId, userId,
}: {
  nodeId: string
  readOnly?: boolean
  orgId?: string
  userId?: string
}) {
  const router = useRouter()
  const node = useProcessStore(s => s.nodes.find(n => n.id === nodeId))
  const model = useProcessStore(s => s.model)
  const logicalSystems = useProcessStore(s => s.logicalSystems)
  const updateNode = useProcessStore(s => s.updateNode)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [scaffolding, setScaffolding] = useState(false)

  if (!node) return null

  const canScaffold = !readOnly && !!orgId && !!userId
  const handleScaffold = async () => {
    if (!orgId || !userId) return
    setScaffolding(true)
    try {
      const diagramId = await pushProcessLeafToNewDiagram(node, logicalSystems, orgId, userId, model?.title)
      router.push(`/diagram/${diagramId}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to scaffold data diagram')
      setScaffolding(false)
    }
  }

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
          <div className="ml-auto flex items-center gap-3">
            {canScaffold && (
              <button
                onClick={handleScaffold}
                disabled={scaffolding}
                title="Scaffold a data architecture diagram from this process's system lanes"
                className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[#2563EB] hover:text-[#3B82F6] disabled:opacity-50 flex items-center gap-1"
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                  <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M6 3.5h2.5a2 2 0 012 2V8" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                {scaffolding ? 'Scaffolding…' : 'Scaffold Data Diagram'}
              </button>
            )}
            <button
              onClick={() => setDetailsOpen(o => !o)}
              className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] flex items-center gap-1"
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className={`transition-transform ${detailsOpen ? 'rotate-90' : ''}`}>
                <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Details
            </button>
          </div>
        </div>

        {detailsOpen && (
          <>
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
            {orgId && <SipocLinkPanel nodeId={nodeId} orgId={orgId} readOnly={readOnly} />}
            <OverlayPanel nodeId={nodeId} readOnly={readOnly} />
          </>
        )}
      </div>

      {/* Editor fills remaining height */}
      <div className="flex-1 min-h-0">
        <ProcessLeafEditor nodeId={nodeId} readOnly={readOnly} />
      </div>
    </div>
  )
}
