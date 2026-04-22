'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { HydratedCapability, Dimension, Tag } from '@/lib/sipoc/types'

// ─── Column Header ──────────────────────────────────────
function ColumnHeader({ label, color, letter }: { label: string; color: string; letter: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm font-[family-name:var(--font-orbitron)] shadow-lg"
        style={{ backgroundColor: color, boxShadow: `0 4px 14px ${color}30` }}
      >
        {letter}
      </div>
      <span className="text-[9px] uppercase tracking-[0.15em] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold">
        {label}
      </span>
    </div>
  )
}

// ─── Persona/System chip ────────────────────────────────
function PersonaChip({ name, color }: { name: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/30 rounded-full pl-1 pr-2.5 py-0.5 shadow-sm max-w-full">
      {/* Person avatar circle */}
      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: color + '25' }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="4" r="2.2" fill={color} />
          <path d="M2 10.5c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke={color} strokeWidth="1.3" strokeLinecap="round" fill={color} fillOpacity="0.3" />
        </svg>
      </div>
      <span className="text-[10px] font-medium text-[var(--m12-text-secondary)] truncate">{name}</span>
    </div>
  )
}

function SystemChip({ name, color }: { name: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-[var(--m12-bg)]/80 border border-[var(--m12-border)]/20 rounded px-2 py-0.5 max-w-full">
      <div className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: color || '#64748B' }} />
      <span className="text-[8px] font-medium text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase truncate">{name}</span>
    </div>
  )
}

// Tag-match helper: empty filter = match all
function matchesTags(ownIds: string[], selected: string[], mode: 'any' | 'all'): boolean {
  if (selected.length === 0) return true
  if (ownIds.length === 0) return false
  if (mode === 'all') return selected.every(id => ownIds.includes(id))
  return selected.some(id => ownIds.includes(id))
}

// ─── Info Product Card (the data object, with dimensions) ─
function IPCard({
  name,
  category,
  dimensions,
  showDimensions,
  accentColor,
  itemId,
  tags,
  filterTagIds,
  filterMode,
}: {
  name: string
  category?: string
  dimensions?: (Dimension & { tags?: Tag[] })[]
  showDimensions: boolean
  accentColor: string
  itemId?: string
  tags?: Tag[]
  filterTagIds?: string[]
  filterMode?: 'any' | 'all'
}) {
  const setFocusedItem = useSIPOCStore(s => s.setFocusedItem)
  const hasDims = dimensions && dimensions.length > 0
  return (
    <div
      className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2.5 shadow-sm transition-all hover:shadow-md cursor-pointer hover:ring-1 hover:ring-[var(--m12-border)]/30"
      style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
      onClick={itemId ? (e) => { e.stopPropagation(); setFocusedItem(itemId) } : undefined}
    >
      <div className="flex items-center gap-1.5">
        <div className="text-[11px] font-semibold text-[var(--m12-text)] flex-1 leading-tight">{name}</div>
        {hasDims && (
          <span className="text-[7px] bg-[var(--m12-bg)] text-[var(--m12-text-muted)] rounded px-1 py-0.5 font-[family-name:var(--font-space-mono)] font-bold border border-[var(--m12-border)]/20">
            {dimensions.length}
          </span>
        )}
      </div>
      {category && (
        <div className="text-[8px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] uppercase tracking-wider mt-0.5">
          {category}
        </div>
      )}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-1">
          {tags.map(t => (
            <span
              key={t.id}
              className="inline-flex items-center rounded text-[8px] px-1 py-0 text-white leading-tight"
              style={{ backgroundColor: t.color }}
              title={t.description || t.name}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
      {showDimensions && hasDims && (
        <div className="mt-2 pt-1.5 border-t border-[var(--m12-border)]/15 space-y-0.5 border-l-2 border-[var(--m12-border)]/15 ml-0.5 pl-2">
          {dimensions.map(dim => {
            const dimTagIds = (dim.tags || []).map(t => t.id)
            const dimMatches = matchesTags(dimTagIds, filterTagIds || [], filterMode || 'any')
            return (
              <div key={dim.id} className={`py-px transition-opacity ${dimMatches ? '' : 'opacity-30'}`}>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[8px] text-[var(--m12-text-muted)] shrink-0">{dim.name}</span>
                  {dim.tags && dim.tags.length > 0 && (
                    <span className="flex flex-wrap gap-0.5">
                      {dim.tags.map(t => (
                        <span
                          key={t.id}
                          className="inline-flex items-center rounded text-[7px] px-1 py-0 text-white leading-tight"
                          style={{ backgroundColor: t.color }}
                          title={t.description || t.name}
                        >
                          {t.name}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Connecting arrow (horizontal) ──────────────────────
function HArrow({ muted }: { muted?: boolean }) {
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" fill="none" className={`shrink-0 ${muted ? 'opacity-20' : 'opacity-40'}`}>
      <path d="M0 6h24M20 2l5 4-5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--m12-text-muted)]" />
    </svg>
  )
}

// ─── Mini flow arrow between systems ────────────────────
function MiniArrow() {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="shrink-0 opacity-40">
      <path d="M0 4h9M7 1.5L10 4 7 6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--m12-text-muted)]" />
    </svg>
  )
}

// ─── Feeding system chip (same style as source systems) ─
function FeedingSystemChip({ name, color }: { name: string; color?: string }) {
  return <SystemChip name={name} color={color} />
}

// ─── Single input lane (Suppliers → Input) ──────────────
function InputLane({ input, showDimensions, filterTagIds, filterMode }: {
  input: HydratedCapability['inputs'][0]
  showDimensions: boolean
  filterTagIds?: string[]
  filterMode?: 'any' | 'all'
}) {
  const hasSuppliers = input.supplierPersonas.length > 0 || input.sourceSystems.length > 0 || !!input.feedingSystem
  const sourceSystems = input.sourceSystems
  const feedingSystem = input.feedingSystem

  const mode = filterMode || 'any'
  const selected = filterTagIds || []
  const ipTagIds = (input.tags || []).map(t => t.id)
  const ipMatch = matchesTags(ipTagIds, selected, mode)
  const anyDimMatch = (input.dimensions || []).some(d => matchesTags((d.tags || []).map(t => t.id), selected, mode))
  const laneMatch = selected.length === 0 || ipMatch || anyDimMatch

  return (
    <div className={`flex items-center gap-2 transition-opacity ${laneMatch ? '' : 'opacity-30'}`}>
      {/* Left: Personas + origin systems */}
      <div className="flex-1 flex flex-col gap-1.5 items-end min-w-0">
        {/* Persona chips */}
        {input.supplierPersonas.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end">
            {input.supplierPersonas.map(p => (
              <PersonaChip key={p.id} name={p.name} color={p.color} />
            ))}
          </div>
        )}
        {/* Source systems flow (upstream lineage) */}
        {sourceSystems.length > 0 && (
          <div className="flex items-center gap-0.5 flex-wrap justify-end">
            {sourceSystems.map((s, i) => (
              <div key={s.id} className="flex items-center gap-0.5">
                {i > 0 && <MiniArrow />}
                <SystemChip name={s.name} color={s.color} />
              </div>
            ))}
          </div>
        )}
        {!hasSuppliers && (
          <div className="text-[9px] text-[var(--m12-text-faint)] italic">—</div>
        )}
      </div>

      {/* Arrow from left section toward IP card */}
      <HArrow muted={!hasSuppliers} />

      {/* Input IP card */}
      <div className="w-[170px] shrink-0">
        <IPCard
          name={input.informationProduct.name}
          category={input.informationProduct.category}
          dimensions={input.dimensions}
          tags={input.tags}
          filterTagIds={filterTagIds}
          filterMode={filterMode}
          showDimensions={showDimensions}
          accentColor="#EAB308"
          itemId={input.id}
        />
      </div>

      {/* Feeding system (sits between IP and Process) */}
      {feedingSystem && (
        <>
          <HArrow />
          <FeedingSystemChip name={feedingSystem.name} color={feedingSystem.color} />
          <HArrow />
        </>
      )}
    </div>
  )
}

// ─── Single output lane (Output → Consumers) ────────────
function OutputLane({ output, showDimensions }: {
  output: HydratedCapability['outputs'][0]
  showDimensions: boolean
}) {
  const hasConsumers = output.consumerPersonas.length > 0

  return (
    <div className="flex items-center gap-2">
      {/* Output IP card */}
      <div className="w-[180px] shrink-0">
        <IPCard
          name={output.informationProduct.name}
          category={output.informationProduct.category}
          dimensions={output.dimensions}
          tags={output.tags}
          showDimensions={showDimensions}
          accentColor="#10B981"
          itemId={output.id}
        />
      </div>

      <HArrow muted={!hasConsumers} />

      {/* Consumers for this output */}
      <div className="flex-1 flex flex-wrap gap-1 min-w-0 overflow-hidden">
        {output.consumerPersonas.map(p => (
          <PersonaChip key={p.id} name={p.name} color={p.color} />
        ))}
        {!hasConsumers && (
          <div className="text-[9px] text-[var(--m12-text-faint)] italic">—</div>
        )}
      </div>
    </div>
  )
}

// ─── Single Capability SIPOC Block ──────────────────────
function CapabilityBlock({ capability, isSelected, onSelect, showDimensions, collapsed, onToggleCollapse, filterTagIds, filterMode }: {
  capability: HydratedCapability
  isSelected: boolean
  onSelect: () => void
  showDimensions: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  filterTagIds?: string[]
  filterMode?: 'any' | 'all'
}) {
  if (collapsed) {
    return (
      <div
        className={`rounded-xl border transition-all cursor-pointer flex items-center gap-3 px-4 py-2.5 ${
          isSelected
            ? 'border-[#2563EB]/50 bg-[#2563EB]/5'
            : 'border-[var(--m12-border)]/25 hover:border-[var(--m12-border)]/50'
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse() }}
          className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="w-2 h-2 rounded-full bg-[#2563EB]/40" />
        <span className="text-xs font-semibold text-[var(--m12-text)] flex-1" onClick={onSelect}>{capability.name}</span>
        <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
          {capability.inputs.length}in / {capability.outputs.length}out
        </span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl border transition-all cursor-pointer overflow-hidden ${
        isSelected
          ? 'border-[#2563EB]/50 shadow-xl shadow-[#2563EB]/8 ring-1 ring-[#2563EB]/20'
          : 'border-[var(--m12-border)]/25 hover:border-[var(--m12-border)]/50 shadow-sm'
      }`}
    >
      {/* Collapse toggle bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--m12-bg)]/30 border-b border-[var(--m12-border)]/10">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse() }}
          className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 3l3.5 4 3.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider" onClick={onSelect}>{capability.name}</span>
      </div>

      {/* Capability block uses a 3-column layout: left (S→I) | center (P) | right (O→C) */}
      <div className="flex items-stretch" onClick={onSelect}>
        {/* ── Left: Suppliers → Inputs ─────────────────── */}
        <div className="flex-1 p-4 flex flex-col gap-2.5 justify-center bg-[var(--m12-bg-card)]/30">
          {capability.inputs.length > 0 ? (
            capability.inputs.map(input => (
              <InputLane key={input.id} input={input} showDimensions={showDimensions} filterTagIds={filterTagIds} filterMode={filterMode} />
            ))
          ) : (
            <div className="flex items-center justify-center py-4 text-[10px] text-[var(--m12-text-faint)] italic">
              No inputs defined
            </div>
          )}
        </div>

        {/* ── Center divider + arrow into Process ──────── */}
        <div className="flex items-center">
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="opacity-25">
            <path d="M0 10h12M9 6l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--m12-text-muted)]" />
          </svg>
        </div>

        {/* ── Center: Process (Capability) ─────────────── */}
        <div className="w-[200px] shrink-0 flex items-center justify-center p-3 bg-[#2563EB]/[0.04]">
          <div className="bg-gradient-to-b from-[#2563EB]/15 to-[#2563EB]/8 border-2 border-[#2563EB]/30 rounded-xl px-5 py-4 text-center w-full shadow-inner">
            <div className="text-[13px] font-bold text-[var(--m12-text)] leading-tight">{capability.name}</div>
            {(capability.features || []).length > 0 && (
              <div className="mt-2 text-[8px] font-[family-name:var(--font-space-mono)] text-[#2563EB]/60 font-bold uppercase tracking-wider">
                {capability.features!.length} feature{capability.features!.length !== 1 ? 's' : ''}
              </div>
            )}
            {(capability.use_cases || []).length > 0 && (
              <div className="mt-1 text-[8px] font-[family-name:var(--font-space-mono)] text-[#2563EB]/60 font-bold uppercase tracking-wider">
                {capability.use_cases!.length} use case{capability.use_cases!.length !== 1 ? 's' : ''}
              </div>
            )}
            {capability.system && (
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 rounded shrink-0" style={{ backgroundColor: capability.system.color || '#64748B' }} />
                <span className="text-[8px] font-medium text-[var(--m12-text-secondary)]">{capability.system.name}</span>
              </div>
            )}
            <div className={`${capability.system ? 'mt-1' : 'mt-2'} inline-flex items-center gap-1 text-[7px] font-[family-name:var(--font-space-mono)] text-[#2563EB]/60 uppercase tracking-widest font-bold`}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="0.8" />
                <circle cx="4" cy="4" r="1" fill="currentColor" />
              </svg>
              L3 Capability
            </div>
          </div>
        </div>

        {/* ── Center divider + arrow out of Process ────── */}
        <div className="flex items-center">
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="opacity-25">
            <path d="M0 10h12M9 6l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--m12-text-muted)]" />
          </svg>
        </div>

        {/* ── Right: Outputs → Consumers ───────────────── */}
        <div className="flex-1 p-4 flex flex-col gap-2.5 justify-center bg-[var(--m12-bg-card)]/30">
          {capability.outputs.length > 0 ? (
            capability.outputs.map(output => (
              <OutputLane key={output.id} output={output} showDimensions={showDimensions} />
            ))
          ) : (
            <div className="flex items-center justify-center py-4 text-[10px] text-[var(--m12-text-faint)] italic">
              No outputs defined
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Recursive tree section for hierarchy ───────────────
const L1_PALETTE = ['#2563EB', '#10B981', '#F97316', '#8B5CF6', '#06B6D4', '#EF4444', '#EAB308', '#EC4899']

function TreeSection({ node, depth, collapsedGroups, toggleGroup, renderLeaf, getHydrated, isLeaf, rollupIds, toggleRollup, renderRollup }: {
  node: import('@/lib/sipoc/types').CapabilityTreeNode
  depth: number
  collapsedGroups: Set<string>
  toggleGroup: (id: string) => void
  renderLeaf: (id: string) => React.ReactNode
  getHydrated: (id: string) => HydratedCapability | undefined
  isLeaf: (id: string) => boolean
  rollupIds: Set<string>
  toggleRollup: (id: string) => void
  renderRollup: (id: string, name: string) => React.ReactNode
}) {
  const collapsed = collapsedGroups.has(node.id)
  const nodeIsLeaf = node.children.length === 0
  const color = node.color || L1_PALETTE[node.sort_order % L1_PALETTE.length]

  // Leaf nodes render as SIPOC blocks
  if (nodeIsLeaf) {
    return <div style={{ paddingLeft: depth > 0 ? 8 : 0 }}>{renderLeaf(node.id)}</div>
  }

  // Branch nodes render as collapsible group headers
  const isL1 = depth === 0 || node.level === 1
  const childCount = node.children.reduce((sum, c) => sum + (c.children.length > 0 ? c.children.length : 1), 0)

  const showRollup = rollupIds.has(node.id)

  return (
    <div className="space-y-2">
      {/* Group header */}
      <div className="flex items-center gap-2.5 group w-full">
      <button
        onClick={() => toggleGroup(node.id)}
        className="flex items-center gap-2.5 flex-1 text-left"
      >
        <svg
          width={isL1 ? 10 : 8} height={isL1 ? 10 : 8}
          viewBox="0 0 10 10" fill="none"
          className={`text-[var(--m12-text-muted)] transition-transform shrink-0 ${collapsed ? '' : 'rotate-90'}`}
        >
          <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div
          className={`rounded-full shrink-0 ${isL1 ? 'w-1.5 h-6' : 'w-3 h-0.5'}`}
          style={{ backgroundColor: isL1 ? color : color + '80' }}
        />
        <span className={isL1 ? 'text-base font-bold text-[var(--m12-text)]' : 'text-sm font-semibold text-[var(--m12-text-secondary)]'}>
          {node.name}
        </span>
        <span className="text-[8px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-faint)] uppercase tracking-wider">
          L{node.level || depth + 1}
        </span>
        {collapsed && (
          <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
            {childCount} {childCount === 1 ? 'capability' : 'capabilities'}
          </span>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); toggleRollup(node.id) }}
        className={`shrink-0 text-[9px] px-2 py-0.5 rounded-md font-[family-name:var(--font-space-mono)] uppercase tracking-wider border transition-colors ${
          showRollup
            ? 'bg-[#2563EB]/15 border-[#2563EB]/40 text-[#93C5FD]'
            : 'border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:border-[var(--m12-border)] hover:text-[var(--m12-text-secondary)]'
        }`}
        title="Show rollup summarizing all descendant SIPOCs"
      >
        {showRollup ? 'Hide rollup' : 'Rollup'}
      </button>
      </div>

      {/* Rollup block */}
      {showRollup && (
        <div className="pl-4">
          {renderRollup(node.id, node.name)}
        </div>
      )}

      {/* Children */}
      {!collapsed && (
        <div
          className={`space-y-3 pl-4 ${isL1 ? 'border-l-2' : 'border-l'}`}
          style={{ borderColor: color + (isL1 ? '30' : '20') }}
        >
          {node.children.sort((a, b) => a.sort_order - b.sort_order).map(child => (
            <TreeSection
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsedGroups={collapsedGroups}
              toggleGroup={toggleGroup}
              renderLeaf={renderLeaf}
              getHydrated={getHydrated}
              isLeaf={isLeaf}
              rollupIds={rollupIds}
              toggleRollup={toggleRollup}
              renderRollup={renderRollup}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tag Filter Bar ─────────────────────────────────────
function TagFilterBar({
  allTags,
  selectedTags,
  onToggle,
  onClear,
  mode,
  setMode,
  matchCount,
  totalCount,
}: {
  allTags: Tag[]
  selectedTags: Tag[]
  onToggle: (id: string) => void
  onClear: () => void
  mode: 'any' | 'all'
  setMode: (m: 'any' | 'all') => void
  matchCount: number
  totalCount: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const active = selectedTags.length > 0
  return (
    <div ref={ref} className="relative flex items-center gap-1">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium font-[family-name:var(--font-space-mono)] uppercase tracking-wider border transition-colors ${
          active
            ? 'bg-[#2563EB]/10 border-[#2563EB]/40 text-[#93C5FD]'
            : 'border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:border-[var(--m12-border)] hover:text-[var(--m12-text-secondary)]'
        }`}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 2h8l-3 3.5v3L4 9.5v-4L1 2z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        </svg>
        Filter Tags
        {active && <span className="bg-[#2563EB]/30 rounded px-1 py-0">{selectedTags.length}</span>}
      </button>
      {active && (
        <>
          <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
            {matchCount}/{totalCount}
          </span>
          <button
            onClick={onClear}
            className="text-[9px] text-[var(--m12-text-muted)] hover:text-red-400 uppercase tracking-wider font-[family-name:var(--font-space-mono)] px-1"
            title="Clear filter"
          >
            clear
          </button>
        </>
      )}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg shadow-xl overflow-hidden min-w-[240px] w-max max-w-[360px]">
          <div className="flex items-center gap-1 p-1.5 border-b border-[var(--m12-border)]/20">
            <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase mr-auto">Match</span>
            <button
              onClick={() => setMode('any')}
              className={`text-[9px] px-2 py-0.5 rounded font-[family-name:var(--font-space-mono)] uppercase ${mode === 'any' ? 'bg-[#2563EB]/20 text-[#93C5FD]' : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]'}`}
            >
              Any
            </button>
            <button
              onClick={() => setMode('all')}
              className={`text-[9px] px-2 py-0.5 rounded font-[family-name:var(--font-space-mono)] uppercase ${mode === 'all' ? 'bg-[#2563EB]/20 text-[#93C5FD]' : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]'}`}
            >
              All
            </button>
          </div>
          <div className="max-h-[220px] overflow-y-auto py-1">
            {allTags.map(t => {
              const sel = selectedTags.some(s => s.id === t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => onToggle(t.id)}
                  className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-[10px] transition-colors ${sel ? 'bg-[#2563EB]/10 text-[var(--m12-text)]' : 'text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg)]'}`}
                >
                  <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-[#2563EB] border-[#2563EB]' : 'border-[var(--m12-border)]'}`}>
                    {sel && (
                      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                        <path d="M1 3.5L3 5.5L6 1.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="inline-flex items-center rounded text-[9px] px-1 py-0 text-white" style={{ backgroundColor: t.color }}>{t.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main SIPOC Visual ──────────────────────────────────
export default function SIPOCVisual() {
  const rawCapabilities = useSIPOCStore(s => s.capabilities)
  const inputs = useSIPOCStore(s => s.inputs)
  const outputs = useSIPOCStore(s => s.outputs)
  const personas = useSIPOCStore(s => s.personas)
  const informationProducts = useSIPOCStore(s => s.informationProducts)
  const logicalSystems = useSIPOCStore(s => s.logicalSystems)
  const selectedCapabilityId = useSIPOCStore(s => s.selectedCapabilityId)
  const setSelectedCapability = useSIPOCStore(s => s.setSelectedCapability)

  const [showDimensions, setShowDimensions] = useState(false)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [filterTagIds, setFilterTagIds] = useState<string[]>([])
  const [filterMode, setFilterMode] = useState<'any' | 'all'>('any')
  const [rollupIds, setRollupIds] = useState<Set<string>>(new Set())
  const allTags = useSIPOCStore(s => s.tags)
  const getRollup = useSIPOCStore(s => s.getRollup)

  const toggleRollup = (id: string) => setRollupIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const initializedRef = useRef(false)

  const toggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const capabilities = useMemo(() => {
    return useSIPOCStore.getState().getHydratedCapabilities()
  }, [rawCapabilities, inputs, outputs, personas, informationProducts, logicalSystems])

  const tree = useMemo(() => {
    return useSIPOCStore.getState().getCapabilityTree()
  }, [rawCapabilities])

  // Capabilities that are in the tree as leaves vs orphans
  const treeCapIds = useMemo(() => {
    const ids = new Set<string>()
    const walk = (nodes: typeof tree) => {
      nodes.forEach(n => { ids.add(n.id); walk(n.children) })
    }
    walk(tree)
    return ids
  }, [tree])

  // Orphan capabilities: not part of any tree (no parent, or parent doesn't exist)
  const orphans = useMemo(() => {
    return capabilities.filter(c => !treeCapIds.has(c.id))
  }, [capabilities, treeCapIds])

  // Check if we have any real hierarchy (L1 nodes with children)
  const hasHierarchy = tree.some(n => (n.level === 1 || n.level === 2) && n.children.length > 0) || tree.some(n => n.level === 1)

  // Default all L3 capabilities to collapsed on first load
  useEffect(() => {
    if (!initializedRef.current && capabilities.length > 0) {
      initializedRef.current = true
      setCollapsedIds(new Set(capabilities.map(c => c.id)))
    }
  }, [capabilities])

  // Find hydrated capability by id
  const getHydrated = (id: string) => capabilities.find(c => c.id === id)

  if (capabilities.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--m12-text-muted)] text-sm">
        Add a capability to get started
      </div>
    )
  }

  // Check if a capability is a leaf (no children in the tree)
  const isLeaf = (id: string) => !rawCapabilities.some(c => c.parent_id === id)

  // Render a leaf capability as a SIPOC block
  const renderLeaf = (capId: string) => {
    const cap = getHydrated(capId)
    if (!cap) return null
    return (
      <CapabilityBlock
        key={cap.id}
        capability={cap}
        isSelected={selectedCapabilityId === cap.id}
        onSelect={() => setSelectedCapability(selectedCapabilityId === cap.id ? null : cap.id)}
        showDimensions={showDimensions}
        collapsed={collapsedIds.has(cap.id)}
        onToggleCollapse={() => toggleCollapse(cap.id)}
        filterTagIds={filterTagIds}
        filterMode={filterMode}
      />
    )
  }

  const renderRollup = (nodeId: string, _nodeName: string) => {
    const rolled = getRollup(nodeId)
    if (!rolled) {
      return (
        <div className="rounded-lg border border-dashed border-[var(--m12-border)]/40 px-4 py-3 text-[10px] italic text-[var(--m12-text-muted)]">
          No descendant SIPOC detail to summarize yet.
        </div>
      )
    }
    const childCount = (rolled.features || []).length
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[#93C5FD]">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Rollup — summarized from {childCount} sub-capabilit{childCount === 1 ? 'y' : 'ies'} (read-only)
        </div>
        <CapabilityBlock
          capability={rolled}
          isSelected={false}
          onSelect={() => {}}
          showDimensions={showDimensions}
          collapsed={false}
          onToggleCollapse={() => {}}
          filterTagIds={filterTagIds}
          filterMode={filterMode}
        />
        {(rolled.features || []).length > 0 && (
          <div className="text-[9px] text-[var(--m12-text-muted)] pl-1">
            <span className="font-[family-name:var(--font-space-mono)] uppercase tracking-wider mr-1">Features:</span>
            {(rolled.features || []).join(' · ')}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5 min-w-0 w-full">
      {/* SIPOC header */}
      <div className="flex items-center justify-center gap-6">
        <ColumnHeader label="Suppliers" color="#F97316" letter="S" />
        <ColumnHeader label="Inputs" color="#EAB308" letter="I" />
        <ColumnHeader label="Process" color="#2563EB" letter="P" />
        <ColumnHeader label="Outputs" color="#10B981" letter="O" />
        <ColumnHeader label="Customers" color="#8B5CF6" letter="C" />
      </div>

      {/* Map title */}
      {useSIPOCStore.getState().map?.title && (
        <div className="text-center">
          <h2 className="text-lg font-bold text-[var(--m12-text)]">{useSIPOCStore.getState().map!.title}</h2>
          {useSIPOCStore.getState().map!.description && (
            <p className="text-xs text-[var(--m12-text-muted)] mt-0.5">{useSIPOCStore.getState().map!.description}</p>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {allTags.length > 0 && (() => {
          let total = 0, match = 0
          capabilities.forEach(c => c.inputs.forEach(inp => {
            total++
            const ipIds = (inp.tags || []).map(t => t.id)
            const anyDim = (inp.dimensions || []).some(d => matchesTags((d.tags || []).map(t => t.id), filterTagIds, filterMode))
            if (filterTagIds.length === 0 || matchesTags(ipIds, filterTagIds, filterMode) || anyDim) match++
          }))
          const selectedTags = allTags.filter(t => filterTagIds.includes(t.id))
          return (
            <TagFilterBar
              allTags={allTags}
              selectedTags={selectedTags}
              onToggle={id => setFilterTagIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])}
              onClear={() => setFilterTagIds([])}
              mode={filterMode}
              setMode={setFilterMode}
              matchCount={match}
              totalCount={total}
            />
          )
        })()}
        <button
          onClick={() => setShowDimensions(!showDimensions)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium font-[family-name:var(--font-space-mono)] uppercase tracking-wider border transition-colors ${
            showDimensions
              ? 'bg-[#2563EB]/10 border-[#2563EB]/40 text-[#93C5FD]'
              : 'border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:border-[var(--m12-border)] hover:text-[var(--m12-text-secondary)]'
          }`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1" />
            <path d="M3 4h4M3 6h2.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
          </svg>
          {showDimensions ? 'Hide' : 'Show'} Dimensions
        </button>
      </div>

      {/* Render tree recursively */}
      {hasHierarchy ? (
        <div className="space-y-6">
          {tree.map(node => (
            <TreeSection
              key={node.id}
              node={node}
              depth={0}
              collapsedGroups={collapsedGroups}
              toggleGroup={toggleGroup}
              renderLeaf={renderLeaf}
              getHydrated={getHydrated}
              isLeaf={isLeaf}
              rollupIds={rollupIds}
              toggleRollup={toggleRollup}
              renderRollup={renderRollup}
            />
          ))}

          {/* Orphan capabilities (not in hierarchy) */}
          {orphans.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 rounded-full bg-[#EAB308]" />
                <span className="text-base font-bold text-[var(--m12-text)]">Unassigned</span>
                <span className="text-[9px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)]">
                  {orphans.length} — organize in Map view
                </span>
              </div>
              <div className="space-y-3 pl-4 border-l-2 border-[#EAB308]/20">
                {orphans.map(cap => renderLeaf(cap.id))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {capabilities.map(cap => renderLeaf(cap.id))}
        </div>
      )}
    </div>
  )
}
