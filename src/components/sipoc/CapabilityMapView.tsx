'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { CapabilityTreeNode } from '@/lib/sipoc/types'

const L1_COLORS = [
  '#2563EB', '#10B981', '#F97316', '#8B5CF6',
  '#06B6D4', '#EF4444', '#EAB308', '#EC4899',
  '#14B8A6', '#6366F1', '#84CC16', '#F43F5E',
]

// ─── Drag state (module-level to avoid prop drilling) ───
let draggedId: string | null = null
let draggedLevel: number | null = null

// ─── L3 Functionality chip (draggable) ──────────────────
function L3Chip({ node, isSelected, onSelect, onDrop }: {
  node: CapabilityTreeNode
  isSelected: boolean
  onSelect: () => void
  onDrop: (dragId: string, targetParentId: string) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      draggable
      onDragStart={(e) => {
        draggedId = node.id
        draggedLevel = node.level
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', node.id)
      }}
      onDragEnd={() => { draggedId = null; draggedLevel = null }}
      onClick={onSelect}
      className={`text-left w-full px-2.5 py-1.5 text-[10px] leading-tight transition-colors rounded cursor-grab active:cursor-grabbing ${
        isSelected
          ? 'bg-[#2563EB]/15 text-[var(--m12-text)] font-medium'
          : 'text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg-card-hover)]'
      } ${dragOver ? 'ring-1 ring-[#2563EB]/50' : ''}`}
    >
      <span className="text-[var(--m12-text-faint)] mr-1">⠿</span>
      {node.name}
    </div>
  )
}

// ─── L2 Capability block (draggable + drop target for L3) ─
function L2Block({ node, parentColor, selectedId, onSelect, onDrop, onAddL3 }: {
  node: CapabilityTreeNode
  parentColor: string
  selectedId: string | null
  onSelect: (id: string) => void
  onDrop: (dragId: string, targetParentId: string) => void
  onAddL3: (parentId: string) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    // Accept L3 drops onto L2
    if (draggedLevel === 3 && draggedId !== node.id) {
      e.dataTransfer.dropEffect = 'move'
      setDragOver(true)
    }
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        draggedId = node.id
        draggedLevel = node.level
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', node.id)
      }}
      onDragEnd={() => { draggedId = null; draggedLevel = null }}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOver(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id && id !== node.id) onDrop(id, node.id)
      }}
      className={`space-y-0.5 transition-all ${dragOver ? 'ring-2 ring-[#2563EB]/40 rounded-lg' : ''}`}
    >
      <div
        className="px-2.5 py-2 rounded-lg border border-[var(--m12-border)]/20 bg-[var(--m12-bg-card)] cursor-grab active:cursor-grabbing"
        style={{ borderTopWidth: 2, borderTopColor: parentColor }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--m12-text-faint)] text-[9px]">⠿</span>
          <div className="text-[11px] font-bold text-[var(--m12-text)] flex-1">{node.name}</div>
          <button
            onClick={(e) => { e.stopPropagation(); onAddL3(node.id) }}
            className="w-4 h-4 rounded flex items-center justify-center text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)] transition-colors opacity-0 group-hover/l2:opacity-100"
            title="Add L3"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 1.5v5M1.5 4h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
          </button>
        </div>
        {node.description && (
          <div className="text-[8px] text-[var(--m12-text-muted)] leading-tight mt-0.5">{node.description}</div>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="pl-0.5 space-y-0">
          {node.children
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(child => (
              <L3Chip
                key={child.id}
                node={child}
                isSelected={selectedId === child.id}
                onSelect={() => onSelect(child.id)}
                onDrop={onDrop}
              />
            ))}
        </div>
      )}
    </div>
  )
}

// ─── L1 Core Area column (drop target for L2 and L3) ────
function L1Column({ node, color, index, selectedId, onSelect, onAddL2, onAddL3, onDrop }: {
  node: CapabilityTreeNode
  color: string
  index: number
  selectedId: string | null
  onSelect: (id: string) => void
  onAddL2: (parentId: string) => void
  onAddL3: (parentId: string) => void
  onDrop: (dragId: string, targetParentId: string) => void
}) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    // Accept L2 drops onto L1, or L3 drops (to move to first L2)
    if (draggedId && draggedId !== node.id) {
      e.dataTransfer.dropEffect = 'move'
      setDragOver(true)
    }
  }

  return (
    <div
      className={`flex flex-col min-w-[200px] max-w-[260px] transition-all ${dragOver ? 'ring-2 ring-[#2563EB]/40 rounded-xl' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id && id !== node.id) onDrop(id, node.id)
      }}
    >
      {/* L1 Header */}
      <div
        className="rounded-t-xl px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: color }}
      >
        <div>
          <div className="text-[9px] font-[family-name:var(--font-space-mono)] text-white/60 font-bold uppercase tracking-wider">
            {index + 1}.
          </div>
          <div className="text-sm font-bold text-white leading-tight">{node.name}</div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="w-5 h-5 rounded flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 2v6M2 5h6" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
          {showAddMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg shadow-xl overflow-hidden">
                <button
                  onClick={() => { setShowAddMenu(false); onAddL2(node.id) }}
                  className="w-full text-left px-3 py-2 text-[10px] text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg)] transition-colors"
                >
                  + Add L2 Capability
                </button>
                {node.children.length > 0 && (
                  <button
                    onClick={() => { setShowAddMenu(false); onAddL3(node.children[0].id) }}
                    className="w-full text-left px-3 py-2 text-[10px] text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg)] transition-colors"
                  >
                    + Add L3 Functionality
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* L2/L3 content */}
      <div className="flex-1 rounded-b-xl border border-t-0 border-[var(--m12-border)]/20 bg-[var(--m12-bg)]/50 p-2 space-y-3 overflow-y-auto group/l2">
        {node.children.length > 0 ? (
          node.children
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(l2 => (
              <L2Block
                key={l2.id}
                node={l2}
                parentColor={color}
                selectedId={selectedId}
                onSelect={onSelect}
                onDrop={onDrop}
                onAddL3={onAddL3}
              />
            ))
        ) : (
          <div className="text-[10px] text-[var(--m12-text-faint)] italic text-center py-4">
            Drop capabilities here
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Capability Map View ───────────────────────────
export default function CapabilityMapView({ onSelectCapability }: {
  onSelectCapability: (id: string) => void
}) {
  const capabilities = useSIPOCStore(s => s.capabilities)
  const selectedId = useSIPOCStore(s => s.selectedCapabilityId)
  const addCapability = useSIPOCStore(s => s.addCapability)
  const updateCapability = useSIPOCStore(s => s.updateCapability)
  const [addingL1, setAddingL1] = useState(false)
  const [newL1Name, setNewL1Name] = useState('')

  const tree = useMemo(() => {
    return useSIPOCStore.getState().getCapabilityTree()
  }, [capabilities])

  // L1 nodes for columns
  const l1Roots = useMemo(() => tree.filter(n => n.level === 1), [tree])

  // All capability IDs that are part of a hierarchy (have a parent, or ARE a parent with L1 level)
  const assignedIds = useMemo(() => {
    const ids = new Set<string>()
    // All L1s are "assigned"
    capabilities.filter(c => c.level === 1).forEach(c => ids.add(c.id))
    // Anything with a parent_id is assigned
    capabilities.filter(c => c.parent_id).forEach(c => ids.add(c.id))
    return ids
  }, [capabilities])

  // Orphans: capabilities not assigned to any hierarchy
  const orphans = useMemo(() => {
    return capabilities.filter(c => !assignedIds.has(c.id))
  }, [capabilities, assignedIds])

  const handleAddL1 = useCallback(async () => {
    const name = newL1Name.trim()
    if (!name) return
    const colorIdx = tree.length % L1_COLORS.length
    await addCapability(name, null, 1, L1_COLORS[colorIdx])
    setNewL1Name('')
    setAddingL1(false)
  }, [newL1Name, tree.length, addCapability])

  const handleAddL2 = useCallback(async (parentId: string) => {
    const name = prompt('L2 Capability name:')
    if (!name?.trim()) return
    await addCapability(name.trim(), parentId, 2)
  }, [addCapability])

  const handleAddL3 = useCallback(async (parentId: string) => {
    const name = prompt('L3 Functionality name:')
    if (!name?.trim()) return
    await addCapability(name.trim(), parentId, 3)
  }, [addCapability])

  const handleSelect = useCallback((id: string) => {
    const cap = capabilities.find(c => c.id === id)
    if (cap && cap.level === 3) {
      onSelectCapability(id)
    }
  }, [capabilities, onSelectCapability])

  // ─── Drag & Drop handler ──────────────────────────────
  const handleDrop = useCallback(async (dragId: string, targetParentId: string) => {
    const dragged = capabilities.find(c => c.id === dragId)
    const target = capabilities.find(c => c.id === targetParentId)
    if (!dragged || !target) return

    // Prevent dropping onto self or own descendant
    const isDescendant = (parentId: string, childId: string): boolean => {
      const children = capabilities.filter(c => c.parent_id === parentId)
      return children.some(c => c.id === childId || isDescendant(c.id, childId))
    }
    if (isDescendant(dragId, targetParentId)) return

    // Determine new level based on target
    let newParentId = targetParentId
    let newLevel = dragged.level

    if (target.level === 1) {
      // Dropping onto L1: item becomes L2 under this L1
      newLevel = 2
    } else if (target.level === 2) {
      // Dropping onto L2: item becomes L3 under this L2
      newLevel = 3
    } else if (target.level === 3) {
      // Dropping onto L3: item becomes sibling (same parent)
      newParentId = target.parent_id || targetParentId
      newLevel = 3
    }

    // Calculate sort order (append to end of new parent's children)
    const siblings = capabilities.filter(c => c.parent_id === newParentId && c.id !== dragId)
    const newSortOrder = siblings.length

    await updateCapability(dragId, {
      parent_id: newParentId,
      level: newLevel,
      sort_order: newSortOrder,
    })
  }, [capabilities, updateCapability])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold">
            Capability Map
          </div>
          <div className="text-[10px] text-[var(--m12-text-faint)] mt-0.5">
            L1 Core Area → L2 Capability → L3 Functionality (SIPOC) &nbsp;·&nbsp; Drag to reorganize
          </div>
        </div>
        {addingL1 ? (
          <div className="flex gap-1.5">
            <input
              value={newL1Name}
              onChange={e => setNewL1Name(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddL1()}
              placeholder="Core area name..."
              autoFocus
              className="bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded-lg px-2.5 py-1.5 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60 w-48"
            />
            <button onClick={handleAddL1} className="bg-[#2563EB] hover:bg-[#3B82F6] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">Add</button>
            <button onClick={() => setAddingL1(false)} className="text-xs text-[var(--m12-text-muted)] px-2">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingL1(true)}
            className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-[#3B82F6] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Add Core Area
          </button>
        )}
      </div>

      {/* Unassigned capabilities (drag these into L1 columns) */}
      {orphans.length > 0 && (
        <div className="bg-[var(--m12-bg-card)] border border-dashed border-[#EAB308]/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#EAB308]">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1" />
              <path d="M6 3.5v3M6 8.5v.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-bold text-[#EAB308] font-[family-name:var(--font-space-mono)] uppercase tracking-wider">
              Unassigned Capabilities
            </span>
            <span className="text-[9px] text-[var(--m12-text-muted)]">— drag these into a Core Area below to organize them</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {orphans.map(cap => (
              <div
                key={cap.id}
                draggable
                onDragStart={(e) => {
                  draggedId = cap.id
                  draggedLevel = cap.level
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', cap.id)
                }}
                onDragEnd={() => { draggedId = null; draggedLevel = null }}
                className="flex items-center gap-1.5 bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing hover:border-[#EAB308]/40 transition-colors"
              >
                <span className="text-[var(--m12-text-faint)] text-[9px]">⠿</span>
                <span className="text-xs font-medium text-[var(--m12-text)]">{cap.name}</span>
                <span className="text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)]">L{cap.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Columns */}
      {l1Roots.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 300 }}>
          {l1Roots.map((l1, i) => (
            <L1Column
              key={l1.id}
              node={l1}
              color={l1.color || L1_COLORS[i % L1_COLORS.length]}
              index={i}
              selectedId={selectedId}
              onSelect={handleSelect}
              onAddL2={handleAddL2}
              onAddL3={handleAddL3}
              onDrop={handleDrop}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-[var(--m12-border)]/40 rounded-xl">
          <div className="text-sm text-[var(--m12-text-muted)] mb-2">No core areas defined</div>
          <div className="text-[10px] text-[var(--m12-text-faint)]">Add an L1 Core Area to start building your capability hierarchy</div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] uppercase tracking-wider">
        <span className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-[#2563EB]" /> L1 Core Area
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm border-t-2 border-[#2563EB] bg-[var(--m12-bg-card)]" /> L2 Capability
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-[#2563EB]/10" /> L3 Functionality (SIPOC)
        </span>
        <span className="text-[var(--m12-text-faint)]/60">· Drag items to reorganize</span>
      </div>
    </div>
  )
}
