'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
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

// ─── L3 Functionality chip (draggable + context menu) ───
function L3Chip({ node, isSelected, onSelect, onDrop, allL2s, readOnly }: {
  node: CapabilityTreeNode
  isSelected: boolean
  onSelect: () => void
  onDrop: (dragId: string, targetParentId: string) => void
  allL2s: { id: string; name: string; parentName: string }[]
  readOnly?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  const otherL2s = allL2s.filter(l2 => l2.id !== node.parent_id)

  const features = node.features || []
  const useCases = node.use_cases || []

  return (
    <div className="relative group/l3">
      <div
        draggable={!readOnly}
        onDragStart={readOnly ? undefined : (e) => {
          e.stopPropagation()
          draggedId = node.id
          draggedLevel = node.level
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', node.id)
        }}
        onDragEnd={readOnly ? undefined : () => { draggedId = null; draggedLevel = null }}
        onClick={onSelect}
        className={`text-left w-full px-2.5 py-1.5 text-[10px] leading-tight transition-colors rounded ${readOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${
          isSelected
            ? 'bg-[#2563EB]/15 text-[var(--m12-text)] font-medium'
            : 'text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg-card-hover)]'
        }`}
      >
        <div className="flex items-center gap-1">
          <span className="text-[var(--m12-text-faint)] shrink-0">⠿</span>
          <span className="flex-1 min-w-0 truncate">{node.name}</span>
          {!readOnly && otherL2s.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              className="opacity-0 group-hover/l3:opacity-100 shrink-0 w-4 h-4 rounded flex items-center justify-center text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)] transition-all"
              title="More actions"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <circle cx="4" cy="1.5" r="0.7" fill="currentColor"/>
                <circle cx="4" cy="4" r="0.7" fill="currentColor"/>
                <circle cx="4" cy="6.5" r="0.7" fill="currentColor"/>
              </svg>
            </button>
          )}
        </div>
        {features.length > 0 && (
          <div className="text-[8px] text-[var(--m12-text-muted)] leading-tight mt-0.5 pl-3 truncate">
            {features.slice(0, 2).join(' · ')}{features.length > 2 ? ` +${features.length - 2}` : ''}
          </div>
        )}
        {useCases.length > 0 && (
          <div className="text-[8px] text-[var(--m12-text-faint)] leading-tight mt-0.5 pl-3 truncate italic">
            {useCases.slice(0, 2).join(' · ')}{useCases.length > 2 ? ` +${useCases.length - 2}` : ''}
          </div>
        )}
      </div>
      {menuOpen && (
        <div ref={menuRef} className="absolute right-0 top-full mt-0.5 z-50 w-56 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg shadow-xl overflow-hidden">
          <div className="px-2.5 py-1.5 text-[8px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] uppercase tracking-widest font-bold border-b border-[var(--m12-border)]/20">
            Move to...
          </div>
          <div className="max-h-[200px] overflow-y-auto py-0.5">
            {otherL2s.map(l2 => (
              <button
                key={l2.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onDrop(node.id, l2.id)
                  setMenuOpen(false)
                }}
                className="w-full text-left px-2.5 py-1.5 text-[10px] text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg)] transition-colors flex items-center gap-1.5"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="shrink-0 text-[var(--m12-text-muted)]">
                  <path d="M1 4h5M4.5 2L6.5 4 4.5 6" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="truncate">{l2.parentName} / {l2.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── L2 Capability block (draggable + drop target for L3) ─
function L2Block({ node, parentColor, selectedId, onSelect, onDrop, onAddL3, allL2s, readOnly }: {
  node: CapabilityTreeNode
  parentColor: string
  selectedId: string | null
  onSelect: (id: string) => void
  onDrop: (dragId: string, targetParentId: string) => void
  onAddL3: (parentId: string) => void
  allL2s: { id: string; name: string; parentName: string }[]
  readOnly?: boolean
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
      draggable={!readOnly}
      onDragStart={readOnly ? undefined : (e) => {
        draggedId = node.id
        draggedLevel = node.level
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', node.id)
      }}
      onDragEnd={readOnly ? undefined : () => { draggedId = null; draggedLevel = null }}
      onDragOver={readOnly ? undefined : handleDragOver}
      onDragLeave={readOnly ? undefined : () => setDragOver(false)}
      onDrop={readOnly ? undefined : (e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOver(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id && id !== node.id) onDrop(id, node.id)
      }}
      className={`space-y-0.5 transition-all ${dragOver ? 'ring-2 ring-[#2563EB]/50 rounded-lg bg-[#2563EB]/5' : ''}`}
    >
      <div
        className={`px-2.5 py-2 rounded-lg border bg-[var(--m12-bg-card)] ${readOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${
          selectedId === node.id ? 'border-[#2563EB]/50 ring-1 ring-[#2563EB]/20' : 'border-[var(--m12-border)]/20'
        }`}
        style={{ borderTopWidth: 2, borderTopColor: parentColor }}
      >
        <div className="flex items-center gap-1.5">
          {!readOnly && <span className="text-[var(--m12-text-faint)] text-[9px]">⠿</span>}
          <div
            className="text-[11px] font-bold text-[var(--m12-text)] flex-1 cursor-pointer hover:text-[#2563EB] transition-colors"
            onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}
          >{node.name}</div>
          {!readOnly && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddL3(node.id) }}
              className="w-4 h-4 rounded flex items-center justify-center text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)] transition-colors opacity-0 group-hover/l2:opacity-100"
              title="Add L3"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 1.5v5M1.5 4h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>
        {(node.features || []).length > 0 && (
          <div className="text-[8px] text-[var(--m12-text-muted)] leading-tight mt-0.5">
            {node.features!.slice(0, 2).join(' · ')}{node.features!.length > 2 ? ` +${node.features!.length - 2}` : ''}
          </div>
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
                allL2s={allL2s}
                readOnly={readOnly}
              />
            ))}
        </div>
      )}
    </div>
  )
}

// ─── L1 Core Area column (draggable + drop target) ──────
function L1Column({ node, color, index, selectedId, onSelect, onAddL2, onAddL3, onAILoad, onDrop, onReorderL1, onRemove, allL2s, readOnly }: {
  node: CapabilityTreeNode
  color: string
  index: number
  selectedId: string | null
  onSelect: (id: string) => void
  onAddL2: (parentId: string) => void
  onAddL3: (parentId: string) => void
  onAILoad: (coreAreaId: string, coreAreaName: string) => void
  onDrop: (dragId: string, targetParentId: string) => void
  onReorderL1: (dragId: string, targetIndex: number) => void
  onRemove: (id: string, name: string, childCount: number) => void
  allL2s: { id: string; name: string; parentName: string }[]
  readOnly?: boolean
}) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [dragOverLeft, setDragOverLeft] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedId && draggedId !== node.id) {
      e.dataTransfer.dropEffect = 'move'
      // If dragging an L1, show reorder indicator; otherwise show child drop
      if (draggedLevel === 1) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const midX = rect.left + rect.width / 2
        setDragOverLeft(e.clientX < midX)
        setDragOver(true)
      } else {
        setDragOver(true)
      }
    }
  }

  return (
    <div
      className={`flex flex-col flex-1 min-w-[140px] transition-all ${
        dragOver && draggedLevel === 1
          ? dragOverLeft
            ? 'border-l-4 border-[#2563EB] rounded-xl'
            : 'border-r-4 border-[#2563EB] rounded-xl'
          : dragOver
            ? 'ring-2 ring-[#2563EB]/40 rounded-xl'
            : ''
      }`}
      onDragOver={readOnly ? undefined : handleDragOver}
      onDragLeave={readOnly ? undefined : () => { setDragOver(false); setDragOverLeft(false) }}
      onDrop={readOnly ? undefined : (e) => {
        e.preventDefault()
        setDragOver(false)
        setDragOverLeft(false)
        const id = e.dataTransfer.getData('text/plain')
        if (!id || id === node.id) return
        if (draggedLevel === 1) {
          onReorderL1(id, dragOverLeft ? index : index + 1)
        } else {
          onDrop(id, node.id)
        }
      }}
    >
      {/* L1 Header (draggable for reorder) */}
      <div
        draggable={!readOnly}
        onDragStart={readOnly ? undefined : (e) => {
          draggedId = node.id
          draggedLevel = 1
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', node.id)
        }}
        onDragEnd={readOnly ? undefined : () => { draggedId = null; draggedLevel = null }}
        className={`rounded-t-xl px-4 py-3 flex items-start gap-3 ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'} min-h-[72px]`}
        style={{ backgroundColor: color }}
      >
        <span className="text-[11px] font-[family-name:var(--font-space-mono)] text-white/50 font-bold mt-0.5 shrink-0">
          {index + 1}.
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-white leading-snug">{node.name}</div>
        </div>
        {!readOnly && <div className="relative shrink-0 mt-0.5">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="w-6 h-6 rounded-md flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
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
                <div className="border-t border-[var(--m12-border)]/20" />
                <button
                  onClick={() => { setShowAddMenu(false); onAILoad(node.id, node.name) }}
                  className="w-full text-left px-3 py-2 text-[10px] flex items-center gap-1.5 text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1L7.5 4.5L11 5.5L8.5 8L9 11.5L6 10L3 11.5L3.5 8L1 5.5L4.5 4.5L6 1Z" fill="currentColor" />
                  </svg>
                  AI Bulk Load
                </button>
                <div className="border-t border-[var(--m12-border)]/20" />
                <button
                  onClick={() => { setShowAddMenu(false); onRemove(node.id, node.name, node.children.length) }}
                  className="w-full text-left px-3 py-2 text-[10px] flex items-center gap-1.5 text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 3h8M4.5 3V2h3v1M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Remove Core Area
                </button>
              </div>
            </>
          )}
        </div>}
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
                allL2s={allL2s}
                readOnly={readOnly}
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
export default function CapabilityMapView({ onSelectCapability, onAILoad }: {
  onSelectCapability: (id: string) => void
  onAILoad?: (coreAreaId: string, coreAreaName: string) => void
}) {
  const capabilities = useSIPOCStore(s => s.capabilities)
  const selectedId = useSIPOCStore(s => s.selectedCapabilityId)
  const readOnly = useSIPOCStore(s => s.readOnly)
  const addCapability = useSIPOCStore(s => s.addCapability)
  const updateCapability = useSIPOCStore(s => s.updateCapability)
  const removeCapability = useSIPOCStore(s => s.removeCapability)
  const [addingL1, setAddingL1] = useState(false)
  const [newL1Name, setNewL1Name] = useState('')

  const tree = useMemo(() => {
    return useSIPOCStore.getState().getCapabilityTree()
  }, [capabilities])

  // L1 nodes for columns
  const l1Roots = useMemo(() => tree.filter(n => n.level === 1), [tree])

  // All L2s across the map (for L3 "Move to" menu)
  const allL2s = useMemo(() => {
    const result: { id: string; name: string; parentName: string }[] = []
    l1Roots.forEach(l1 => {
      l1.children.forEach(l2 => {
        result.push({ id: l2.id, name: l2.name, parentName: l1.name })
      })
    })
    return result
  }, [l1Roots])

  // Determine which capabilities are properly assigned in the hierarchy
  const assignedIds = useMemo(() => {
    const ids = new Set<string>()
    const allIds = new Set(capabilities.map(c => c.id))
    // L1s are assigned
    capabilities.filter(c => c.level === 1).forEach(c => ids.add(c.id))
    // Anything with a valid parent_id (parent exists) is assigned
    capabilities.filter(c => c.parent_id && allIds.has(c.parent_id)).forEach(c => ids.add(c.id))
    return ids
  }, [capabilities])

  // Orphans: not assigned, or parent_id points to deleted capability
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
    onSelectCapability(id)
  }, [onSelectCapability])

  // Reorder L1 columns
  const handleReorderL1 = useCallback(async (dragId: string, targetIndex: number) => {
    // Recalculate sort_order for all L1s
    const currentL1s = l1Roots.map(n => n.id)
    const fromIdx = currentL1s.indexOf(dragId)
    if (fromIdx < 0) return

    // Remove from current position and insert at target
    const reordered = [...currentL1s]
    reordered.splice(fromIdx, 1)
    const insertAt = targetIndex > fromIdx ? targetIndex - 1 : targetIndex
    reordered.splice(insertAt, 0, dragId)

    // Update sort_order for each
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i] !== currentL1s[i]) {
        await updateCapability(reordered[i], { sort_order: i })
      }
    }
  }, [l1Roots, updateCapability])

  // ─── Remove L1 Core Area ──────────────────────────────
  const handleRemoveL1 = useCallback(async (id: string, name: string, childCount: number) => {
    const msg = childCount > 0
      ? `Remove "${name}" and all ${childCount} child capabilit${childCount === 1 ? 'y' : 'ies'} inside it? This cannot be undone.`
      : `Remove "${name}"? This cannot be undone.`
    if (!confirm(msg)) return
    // Remove all descendants first (children of children), then the L1
    const toRemove: string[] = []
    const collect = (parentId: string) => {
      capabilities.filter(c => c.parent_id === parentId).forEach(c => {
        collect(c.id)
        toRemove.push(c.id)
      })
    }
    collect(id)
    for (const cid of toRemove) {
      await removeCapability(cid)
    }
    await removeCapability(id)
  }, [capabilities, removeCapability])

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
    <div className="space-y-4 min-w-0 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold">
            Capability Map
          </div>
          <div className="text-[10px] text-[var(--m12-text-faint)] mt-0.5">
            L1 Core Area → L2 Capability → L3 Functionality (SIPOC){!readOnly && <> &nbsp;·&nbsp; Drag to reorganize</>}
          </div>
        </div>
        {!readOnly && (addingL1 ? (
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
        ))}
      </div>

      {/* Unassigned capabilities (drag these into L1 columns) */}
      {!readOnly && orphans.length > 0 && (
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
                className="group/orphan flex items-center gap-1.5 bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing hover:border-[#EAB308]/40 transition-colors"
              >
                <span className="text-[var(--m12-text-faint)] text-[9px]">⠿</span>
                <span className="text-xs font-medium text-[var(--m12-text)]">{cap.name}</span>
                <span className="text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)]">L{cap.level}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Delete "${cap.name}"? This will also remove all its SIPOC detail and cannot be undone.`)) {
                      removeCapability(cap.id)
                    }
                  }}
                  className="opacity-0 group-hover/orphan:opacity-100 ml-1 w-4 h-4 rounded flex items-center justify-center text-[var(--m12-text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
                  title="Delete capability"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 6.5l5-5M1.5 1.5l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Columns */}
      {l1Roots.length > 0 ? (
        <div className="flex gap-3 pb-4 w-full" style={{ minHeight: 300 }}>
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
              onAILoad={onAILoad || (() => {})}
              onDrop={handleDrop}
              onReorderL1={handleReorderL1}
              onRemove={handleRemoveL1}
              allL2s={allL2s}
              readOnly={readOnly}
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
        {!readOnly && <span className="text-[var(--m12-text-faint)]/60">· Drag items to reorganize</span>}
      </div>
    </div>
  )
}
