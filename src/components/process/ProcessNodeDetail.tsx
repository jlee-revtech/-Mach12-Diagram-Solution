'use client'

import { useEffect, useState } from 'react'
import { useProcessStore } from '@/lib/process/store'
import { levelLabel, LIFECYCLE_LABEL, type ProcessLifecycle } from '@/lib/process/types'

// Detail panel for the selected process node. For L1/L2 nodes it captures
// description + SAP scope-item ref. For L3 leaf nodes it also surfaces the
// BPMN editor entry point (wired in Phase 2).
export default function ProcessNodeDetail({ nodeId }: { nodeId: string }) {
  const node = useProcessStore(s => s.nodes.find(n => n.id === nodeId))
  const readOnly = useProcessStore(s => s.readOnly)
  const updateNode = useProcessStore(s => s.updateNode)

  const [description, setDescription] = useState('')
  const [scopeItem, setScopeItem] = useState('')

  useEffect(() => {
    setDescription(node?.description || '')
    setScopeItem(node?.scope_item_ref || '')
  }, [node?.id, node?.description, node?.scope_item_ref])

  if (!node) return null

  const commitDescription = () => {
    const d = description.trim()
    if (d !== (node.description || '')) updateNode(node.id, { description: d })
  }
  const commitScopeItem = () => {
    const s = scopeItem.trim()
    if (s !== (node.scope_item_ref || '')) updateNode(node.id, { scope_item_ref: s })
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <div className="bg-white rounded-lg border border-border shadow-card p-6">
        {/* Breadcrumb-ish header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-600">
            {levelLabel(node.level)} · L{node.level}
          </span>
          {node.variant_label && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-status-yellow">{node.variant_label}</span>
          )}
          {node.lifecycle && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-purple-600">{LIFECYCLE_LABEL[node.lifecycle]}</span>
          )}
        </div>
        <h1 className="text-heading-lg font-display text-text-primary mb-6">{node.name}</h1>

        {/* Description */}
        <section className="mb-6">
          <label className="block text-label uppercase text-text-secondary mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={commitDescription}
            readOnly={readOnly}
            rows={4}
            placeholder={readOnly ? '' : 'What does this process cover? Who owns it? Key triggers and outcomes...'}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-y"
          />
        </section>

        {/* Scope-item reference */}
        <section className="mb-6">
          <label className="block text-label uppercase text-text-secondary mb-2">
            SAP Scope-Item Reference
          </label>
          <input
            value={scopeItem}
            onChange={e => setScopeItem(e.target.value)}
            onBlur={commitScopeItem}
            readOnly={readOnly}
            placeholder={readOnly ? '' : 'e.g. BD9, J45 - best-practice scope item this maps to'}
            className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </section>

        {/* Lifecycle + variant */}
        <section className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-label uppercase text-text-secondary mb-2">Lifecycle</label>
            <select
              value={node.lifecycle || ''}
              onChange={e => updateNode(node.id, { lifecycle: (e.target.value || null) as ProcessLifecycle | null })}
              disabled={readOnly}
              aria-label="Lifecycle"
              className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              <option value="">- not set -</option>
              {(['as_is', 'interim', 'to_be'] as ProcessLifecycle[]).map(l => <option key={l} value={l}>{LIFECYCLE_LABEL[l]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-label uppercase text-text-secondary mb-2">Variant</label>
            <input
              defaultValue={node.variant_label || ''}
              onBlur={e => { if (!readOnly && e.target.value.trim() !== (node.variant_label || '')) updateNode(node.id, { variant_label: e.target.value.trim() || null }) }}
              readOnly={readOnly}
              aria-label="Variant label"
              placeholder={readOnly ? '' : 'e.g. Capital, Facilities'}
              className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>
        </section>
      </div>
    </div>
  )
}
