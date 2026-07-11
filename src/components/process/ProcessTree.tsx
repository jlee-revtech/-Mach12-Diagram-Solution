'use client'

import { useState, useCallback, useMemo } from 'react'
import { ChevronRight, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useProcessStore } from '@/lib/process/store'
import type { ProcessNodeTreeNode } from '@/lib/process/types'
import { levelLabel, levelColor, MAX_PROCESS_LEVEL, LIFECYCLE_LABEL } from '@/lib/process/types'
import ProcessAIPanel from './ProcessAIPanel'

// Navigable value-chain hierarchy: L1 Scenario -> L2 Process Group -> L3 Process.
// Inline add / rename / delete. Selecting a leaf surfaces it for the (Phase 2)
// BPMN editor; selecting any node lets you add children one level down.
export default function ProcessTree() {
  // Select the stable `nodes` array and build the tree with useMemo. Selecting
  // getProcessTree() directly returns a fresh array every render, which makes
  // zustand's useSyncExternalStore loop forever (React error #185).
  const nodes = useProcessStore(s => s.nodes)
  const tree = useMemo(() => useProcessStore.getState().getProcessTree(), [nodes])
  const selectedNodeId = useProcessStore(s => s.selectedNodeId)
  const readOnly = useProcessStore(s => s.readOnly)

  const addNode = useProcessStore(s => s.addNode)
  const setSelectedNode = useProcessStore(s => s.setSelectedNode)

  const [addingUnder, setAddingUnder] = useState<string | 'root' | null>(null)
  const [draftName, setDraftName] = useState('')
  const [aiOpen, setAiOpen] = useState(false)

  const handleAddRoot = useCallback(async () => {
    const name = draftName.trim()
    if (!name) return
    const id = await addNode(name, null, 1)
    setDraftName('')
    setAddingUnder(null)
    if (id) setSelectedNode(id)
  }, [draftName, addNode, setSelectedNode])

  const handleAddChild = useCallback(async (parent: ProcessNodeTreeNode) => {
    const name = draftName.trim()
    if (!name) return
    const childLevel = Math.min(parent.level + 1, MAX_PROCESS_LEVEL)
    const id = await addNode(name, parent.id, childLevel)
    setDraftName('')
    setAddingUnder(null)
    if (id) setSelectedNode(id)
  }, [draftName, addNode, setSelectedNode])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-text-tertiary">
          Process Hierarchy
        </span>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              title="Generate hierarchy with AI"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors"
            >
              <Sparkles size={11} />
              AI
            </button>
            <button
              type="button"
              onClick={() => { setAddingUnder('root'); setDraftName('') }}
              title="Add scenario (L1)"
              className="h-6 w-6 rounded inline-flex items-center justify-center text-text-secondary hover:bg-surface-muted hover:text-brand-600 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>
      {aiOpen && <ProcessAIPanel onClose={() => setAiOpen(false)} />}

      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 && addingUnder !== 'root' && (
          <div className="px-3 py-8 text-center text-body-sm text-text-tertiary">
            {readOnly ? 'No scenarios defined.' : 'No scenarios yet. Add an L1 scenario to begin.'}
          </div>
        )}

        {tree.map(node => (
          <TreeRow
            key={node.id}
            node={node}
            depth={0}
            selectedNodeId={selectedNodeId}
            readOnly={readOnly}
            addingUnder={addingUnder}
            draftName={draftName}
            setDraftName={setDraftName}
            setAddingUnder={setAddingUnder}
            onSelect={setSelectedNode}
            onAddChild={handleAddChild}
          />
        ))}

        {addingUnder === 'root' && (
          <div className="px-3 py-1.5">
            <input
              autoFocus
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddRoot(); if (e.key === 'Escape') { setAddingUnder(null); setDraftName('') } }}
              onBlur={() => { if (!draftName.trim()) setAddingUnder(null) }}
              placeholder="Scenario name..."
              className="w-full h-8 px-2 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function TreeRow({
  node, depth, selectedNodeId, readOnly, addingUnder, draftName,
  setDraftName, setAddingUnder, onSelect, onAddChild,
}: {
  node: ProcessNodeTreeNode
  depth: number
  selectedNodeId: string | null
  readOnly: boolean
  addingUnder: string | 'root' | null
  draftName: string
  setDraftName: (v: string) => void
  setAddingUnder: (v: string | 'root' | null) => void
  onSelect: (id: string) => void
  onAddChild: (parent: ProcessNodeTreeNode) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(node.name)
  const updateNode = useProcessStore(s => s.updateNode)
  const removeNode = useProcessStore(s => s.removeNode)

  const isSelected = selectedNodeId === node.id
  const accent = node.color || levelColor(node.level)
  const hasChildren = node.children.length > 0
  const canAddChild = node.level < MAX_PROCESS_LEVEL

  const commitRename = async () => {
    const name = nameDraft.trim()
    if (name && name !== node.name) await updateNode(node.id, { name })
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${node.name}"${hasChildren ? ' and all its children' : ''}? This cannot be undone.`)) return
    await removeNode(node.id)
  }

  return (
    <div>
      <div
        onClick={() => onSelect(node.id)}
        className={`group flex items-center gap-1.5 pr-2 py-1.5 cursor-pointer transition-colors ${
          isSelected ? 'bg-brand-50' : 'hover:bg-surface-muted'
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            className="text-text-tertiary hover:text-text-secondary shrink-0"
          >
            <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />

        {editing ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setNameDraft(node.name); setEditing(false) } }}
            onBlur={commitRename}
            aria-label="Node name"
            className="flex-1 min-w-0 px-1.5 py-0.5 rounded border border-border bg-surface-input text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        ) : (
          <span className={`flex-1 truncate text-body-sm ${isSelected ? 'text-brand-700 font-medium' : 'text-text-secondary'}`}>
            {node.name}
          </span>
        )}

        {node.variant_label && (
          <span className="text-[10px] uppercase tracking-wider text-status-yellow font-mono shrink-0">
            {node.variant_label}
          </span>
        )}
        {node.lifecycle && (
          <span className="text-[10px] uppercase tracking-wider text-purple-600 font-mono shrink-0">
            {LIFECYCLE_LABEL[node.lifecycle]}
          </span>
        )}
        {node.is_leaf && !hasChildren && (
          <span className="text-[10px] uppercase tracking-wider text-status-green font-mono shrink-0">
            BPMN
          </span>
        )}
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-mono shrink-0">
          {levelLabel(node.level)}
        </span>

        {!readOnly && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {canAddChild && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setAddingUnder(node.id); setDraftName(''); setExpanded(true) }}
                title={`Add ${levelLabel(node.level + 1)}`}
                className="text-text-tertiary hover:text-brand-600 transition-colors"
              >
                <Plus size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setNameDraft(node.name); setEditing(true) }}
              title="Rename"
              className="text-text-tertiary hover:text-brand-600 transition-colors"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleDelete() }}
              title="Delete"
              className="text-text-tertiary hover:text-red-600 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {expanded && hasChildren && node.children.map(child => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedNodeId={selectedNodeId}
          readOnly={readOnly}
          addingUnder={addingUnder}
          draftName={draftName}
          setDraftName={setDraftName}
          setAddingUnder={setAddingUnder}
          onSelect={onSelect}
          onAddChild={onAddChild}
        />
      ))}

      {addingUnder === node.id && (
        <div className="py-1.5" style={{ paddingLeft: 8 + (depth + 1) * 14, paddingRight: 8 }}>
          <input
            autoFocus
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onAddChild(node); if (e.key === 'Escape') setAddingUnder(null) }}
            onBlur={() => { if (!draftName.trim()) setAddingUnder(null) }}
            placeholder={`${levelLabel(node.level + 1)} name...`}
            className="w-full h-8 px-2 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
      )}
    </div>
  )
}
