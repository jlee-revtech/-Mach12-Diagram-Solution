'use client'

import { useEffect, useState } from 'react'
import { useProcessStore } from '@/lib/process/store'
import { PROCESS_LEVEL_LABEL } from '@/lib/process/types'

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
  const level = Math.min(Math.max(node.level, 1), 3) as 1 | 2 | 3

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
      {/* Breadcrumb-ish header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-widest text-[#0EA5E9] font-[family-name:var(--font-space-mono)] font-bold">
          {PROCESS_LEVEL_LABEL[level]} · L{level}
        </span>
        {node.is_leaf && (
          <span className="text-[10px] uppercase tracking-wider text-[#10B981] font-[family-name:var(--font-space-mono)]">
            BPMN Leaf
          </span>
        )}
      </div>
      <h1 className="text-2xl font-bold text-[var(--m12-text)] mb-6">{node.name}</h1>

      {/* Description */}
      <section className="mb-6">
        <label className="block text-[10px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold mb-2">
          Description
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={commitDescription}
          readOnly={readOnly}
          rows={4}
          placeholder={readOnly ? '' : 'What does this process cover? Who owns it? Key triggers and outcomes…'}
          className="w-full bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none focus:border-[#0EA5E9]/60 resize-y"
        />
      </section>

      {/* Scope-item reference */}
      <section className="mb-6">
        <label className="block text-[10px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold mb-2">
          SAP Scope-Item Reference
        </label>
        <input
          value={scopeItem}
          onChange={e => setScopeItem(e.target.value)}
          onBlur={commitScopeItem}
          readOnly={readOnly}
          placeholder={readOnly ? '' : 'e.g. BD9, J45 — best-practice scope item this maps to'}
          className="w-full bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none focus:border-[#0EA5E9]/60 font-[family-name:var(--font-space-mono)]"
        />
      </section>

    </div>
  )
}
