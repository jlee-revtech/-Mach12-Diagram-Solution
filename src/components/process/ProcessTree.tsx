'use client'

import { useState, useCallback } from 'react'
import { useProcessStore } from '@/lib/process/store'
import type { ProcessNodeTreeNode } from '@/lib/process/types'
import { PROCESS_LEVEL_LABEL, PROCESS_LEVEL_COLORS } from '@/lib/process/types'
import ProcessAIPanel from './ProcessAIPanel'

// Navigable value-chain hierarchy: L1 Scenario → L2 Process Group → L3 Process.
// Inline add / rename / delete. Selecting a leaf surfaces it for the (Phase 2)
// BPMN editor; selecting any node lets you add children one level down.
export default function ProcessTree() {
  const tree = useProcessStore(s => s.getProcessTree())
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
    const childLevel = Math.min(parent.level + 1, 3)
    const id = await addNode(name, parent.id, childLevel)
    setDraftName('')
    setAddingUnder(null)
    if (id) setSelectedNode(id)
  }, [draftName, addNode, setSelectedNode])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--m12-border)]/40">
        <span className="text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold">
          Process Hierarchy
        </span>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAiOpen(true)}
              title="Generate hierarchy with AI"
              className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[#0EA5E9] hover:text-[#38BDF8] transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5l1.3 3.2 3.2 1.3-3.2 1.3L7 10.5 5.7 7.3 2.5 6l3.2-1.3L7 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
              </svg>
              AI
            </button>
            <button
              onClick={() => { setAddingUnder('root'); setDraftName('') }}
              title="Add scenario (L1)"
              className="text-[var(--m12-border)] hover:text-[#0EA5E9] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {aiOpen && <ProcessAIPanel onClose={() => setAiOpen(false)} />}

      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 && addingUnder !== 'root' && (
          <div className="px-3 py-8 text-center text-xs text-[var(--m12-text-muted)]">
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
              placeholder="Scenario name…"
              className="w-full bg-[var(--m12-bg)] border border-[#0EA5E9]/50 rounded px-2 py-1 text-xs text-[var(--m12-text)] focus:outline-none"
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
  const level = Math.min(Math.max(node.level, 1), 3) as 1 | 2 | 3
  const accent = node.color || PROCESS_LEVEL_COLORS[level - 1]
  const hasChildren = node.children.length > 0
  const canAddChild = node.level < 3

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
          isSelected ? 'bg-[#0EA5E9]/10' : 'hover:bg-[var(--m12-bg)]'
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
            className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] shrink-0"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
              <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="w-[9px] shrink-0" />
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
            className="flex-1 bg-[var(--m12-bg)] border border-[var(--m12-border)] rounded px-1.5 py-0.5 text-xs text-[var(--m12-text)] focus:outline-none"
          />
        ) : (
          <span className={`flex-1 truncate text-xs ${isSelected ? 'text-[var(--m12-text)] font-medium' : 'text-[var(--m12-text-secondary)]'}`}>
            {node.name}
          </span>
        )}

        {node.is_leaf && (
          <span className="text-[8px] uppercase tracking-wider text-[#10B981] font-[family-name:var(--font-space-mono)] shrink-0">
            BPMN
          </span>
        )}
        <span className="text-[8px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] shrink-0">
          {PROCESS_LEVEL_LABEL[level]}
        </span>

        {!readOnly && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {canAddChild && (
              <button
                onClick={e => { e.stopPropagation(); setAddingUnder(node.id); setDraftName(''); setExpanded(true) }}
                title={`Add ${PROCESS_LEVEL_LABEL[Math.min(level + 1, 3) as 1 | 2 | 3]}`}
                className="text-[var(--m12-border)] hover:text-[#0EA5E9]"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); setNameDraft(node.name); setEditing(true) }}
              title="Rename"
              className="text-[var(--m12-border)] hover:text-[#2563EB]"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M9 2l3 3-6 6H3V8l6-6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={e => { e.stopPropagation(); handleDelete() }}
              title="Delete"
              className="text-[var(--m12-border)] hover:text-red-400"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
            placeholder={`${PROCESS_LEVEL_LABEL[Math.min(level + 1, 3) as 1 | 2 | 3]} name…`}
            className="w-full bg-[var(--m12-bg)] border border-[#0EA5E9]/50 rounded px-2 py-1 text-xs text-[var(--m12-text)] focus:outline-none"
          />
        </div>
      )}
    </div>
  )
}
