'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ClipboardCheck, Network } from 'lucide-react'
import { useProcessStore } from '@/lib/process/store'
import { PROCESS_LEVEL_LABEL } from '@/lib/process/types'
import { pushProcessLeafToNewDiagram } from '@/lib/process/pushToDiagram'
import { Button } from '@/components/common'
import ProcessLeafEditor from './ProcessLeafEditor'
import SipocLinkPanel from './SipocLinkPanel'
import CapabilityAssignPanel from './CapabilityAssignPanel'
import OverlayPanel from './OverlayPanel'
import InterfacePanel from './InterfacePanel'
import TestPlanDialog from './TestPlanDialog'

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
  const [testPlanOpen, setTestPlanOpen] = useState(false)

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
      <div className="shrink-0 border-b border-border bg-white">
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-status-green bg-status-green-bg px-2 py-0.5 rounded shrink-0">
            {PROCESS_LEVEL_LABEL[3]} · BPMN
          </span>
          <h2 className="text-body-md font-semibold text-text-primary truncate">{node.name}</h2>
          {node.scope_item_ref && (
            <span className="text-[10px] font-mono text-text-secondary bg-surface-muted border border-border rounded px-1.5 py-0.5 shrink-0">
              {node.scope_item_ref}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ai"
              size="sm"
              onClick={() => setTestPlanOpen(true)}
              title="Generate an executable test plan (Excel / Word) from this process flow"
              icon={<ClipboardCheck size={12} />}
            >
              Create Test Plan
            </Button>
            {canScaffold && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleScaffold}
                disabled={scaffolding}
                loading={scaffolding}
                title="Scaffold a data architecture diagram from this process's system lanes"
                icon={<Network size={12} />}
              >
                {scaffolding ? 'Scaffolding...' : 'Scaffold Data Diagram'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDetailsOpen(o => !o)}
              icon={<ChevronRight size={12} className={`transition-transform ${detailsOpen ? 'rotate-90' : ''}`} />}
            >
              Details
            </Button>
          </div>
        </div>

        {detailsOpen && (
          <>
            <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-label uppercase text-text-secondary mb-1">Description</label>
                <textarea
                  rows={2}
                  defaultValue={node.description || ''}
                  onBlur={e => { if (!readOnly && e.target.value.trim() !== (node.description || '')) updateNode(node.id, { description: e.target.value.trim() }) }}
                  readOnly={readOnly}
                  aria-label="Process description"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-y"
                />
              </div>
              <div>
                <label className="block text-label uppercase text-text-secondary mb-1">SAP Scope-Item Ref</label>
                <input
                  defaultValue={node.scope_item_ref || ''}
                  onBlur={e => { if (!readOnly && e.target.value.trim() !== (node.scope_item_ref || '')) updateNode(node.id, { scope_item_ref: e.target.value.trim() }) }}
                  readOnly={readOnly}
                  aria-label="SAP scope-item reference"
                  className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
              </div>
            </div>
            {orgId && <SipocLinkPanel nodeId={nodeId} orgId={orgId} readOnly={readOnly} />}
            {orgId && <CapabilityAssignPanel nodeId={nodeId} orgId={orgId} userId={userId} readOnly={readOnly} />}
            <OverlayPanel nodeId={nodeId} readOnly={readOnly} />
            <InterfacePanel nodeId={nodeId} readOnly={readOnly} />
          </>
        )}
      </div>

      {/* Editor fills remaining height */}
      <div className="flex-1 min-h-0">
        <ProcessLeafEditor nodeId={nodeId} readOnly={readOnly} />
      </div>

      {testPlanOpen && <TestPlanDialog nodeId={nodeId} onClose={() => setTestPlanOpen(false)} />}
    </div>
  )
}
