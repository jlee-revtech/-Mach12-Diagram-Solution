'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { ChevronRight, ChevronDown, Check, Filter, Layers } from 'lucide-react'
import { EmptyState } from '@/components/common'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { HydratedCapability, Dimension, Tag, SipocRegion } from '@/lib/sipoc/types'
import ArtifactCommentBadge from '@/components/sipoc/ArtifactCommentBadge'

// ─── Column Header ──────────────────────────────────────
function ColumnHeader({ label, color, letter }: { label: string; color: string; letter: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm font-display shadow-card"
        style={{ backgroundColor: color }}
      >
        {letter}
      </div>
      <span className="text-[10px] uppercase tracking-[0.15em] font-mono text-text-tertiary font-bold">
        {label}
      </span>
    </div>
  )
}

// ─── Persona/System chip ────────────────────────────────
function PersonaChip({ name, color }: { name: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-white border border-border rounded-full pl-1 pr-2.5 py-0.5 shadow-xs max-w-full">
      {/* Person avatar circle */}
      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: color + '25' }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="4" r="2.2" fill={color} />
          <path d="M2 10.5c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke={color} strokeWidth="1.3" strokeLinecap="round" fill={color} fillOpacity="0.3" />
        </svg>
      </div>
      <span className="text-[10px] font-medium text-text-secondary truncate">{name}</span>
    </div>
  )
}

function SystemChip({ name, color }: { name: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-surface-muted border border-border rounded px-2 py-0.5 max-w-full">
      <div className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: color || '#64748B' }} />
      <span className="text-[10px] font-medium text-text-tertiary font-mono uppercase truncate">{name}</span>
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
  capabilityId,
  commentRegion,
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
  capabilityId?: string
  commentRegion?: SipocRegion
}) {
  const setFocusedItem = useSIPOCStore(s => s.setFocusedItem)
  const hasDims = dimensions && dimensions.length > 0
  return (
    <div
      className="bg-white border border-border rounded-lg px-3 py-2.5 shadow-card transition-all hover:shadow-card-hover cursor-pointer"
      style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
      onClick={itemId ? (e) => { e.stopPropagation(); setFocusedItem(itemId) } : undefined}
    >
      <div className="flex items-center gap-1.5">
        <div className="text-[11px] font-semibold text-text-primary flex-1 leading-tight">{name}</div>
        {capabilityId && commentRegion && itemId && !itemId.startsWith('rollup-') && (
          <ArtifactCommentBadge capabilityId={capabilityId} region={commentRegion} itemId={itemId} />
        )}
        {hasDims && (
          <span className="text-[10px] bg-surface-muted text-text-tertiary rounded px-1 py-0.5 font-mono font-bold border border-border">
            {dimensions.length}
          </span>
        )}
      </div>
      {category && (
        <div className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider mt-0.5">
          {category}
        </div>
      )}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-1">
          {tags.map(t => (
            <span
              key={t.id}
              className="inline-flex items-center rounded text-[10px] px-1 py-0 text-white leading-tight"
              style={{ backgroundColor: t.color }}
              title={t.description || t.name}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
      {showDimensions && hasDims && (
        <div className="mt-2 pt-1.5 border-t border-border/50 space-y-0.5 border-l-2 border-l-border/50 ml-0.5 pl-2">
          {dimensions.map(dim => {
            const dimTagIds = (dim.tags || []).map(t => t.id)
            const dimMatches = matchesTags(dimTagIds, filterTagIds || [], filterMode || 'any')
            return (
              <div key={dim.id} className={`py-px transition-opacity ${dimMatches ? '' : 'opacity-30'}`}>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-text-tertiary shrink-0">{dim.name}</span>
                  {dim.tags && dim.tags.length > 0 && (
                    <span className="flex flex-wrap gap-0.5">
                      {dim.tags.map(t => (
                        <span
                          key={t.id}
                          className="inline-flex items-center rounded text-[10px] px-1 py-0 text-white leading-tight"
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
      <path d="M0 6h24M20 2l5 4-5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary" />
    </svg>
  )
}

// ─── Mini flow arrow between systems ────────────────────
function MiniArrow() {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="shrink-0 opacity-40">
      <path d="M0 4h9M7 1.5L10 4 7 6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary" />
    </svg>
  )
}

// ─── Feeding system chip (same style as source systems) ─
function FeedingSystemChip({ name, color }: { name: string; color?: string }) {
  return <SystemChip name={name} color={color} />
}

// ─── Single input lane (Suppliers → Input) ──────────────
function InputLane({ input, showDimensions, filterTagIds, filterMode, capabilityId }: {
  input: HydratedCapability['inputs'][0]
  showDimensions: boolean
  filterTagIds?: string[]
  filterMode?: 'any' | 'all'
  capabilityId: string
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
          <div className="text-[10px] text-text-tertiary italic">-</div>
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
          capabilityId={capabilityId}
          commentRegion="I"
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
function OutputLane({ output, showDimensions, capabilityId }: {
  output: HydratedCapability['outputs'][0]
  showDimensions: boolean
  capabilityId: string
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
          capabilityId={capabilityId}
          commentRegion="O"
        />
      </div>

      <HArrow muted={!hasConsumers} />

      {/* Consumers for this output */}
      <div className="flex-1 flex flex-wrap gap-1 min-w-0 overflow-hidden">
        {output.consumerPersonas.map(p => (
          <PersonaChip key={p.id} name={p.name} color={p.color} />
        ))}
        {!hasConsumers && (
          <div className="text-[10px] text-text-tertiary italic">-</div>
        )}
      </div>
    </div>
  )
}

// ─── Region badge strip (S/I/P/O/C comment counts at the capability level) ─
function RegionPinStrip({ capabilityId }: { capabilityId: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {(['S','I','P','O','C'] as const).map(r => (
        <ArtifactCommentBadge key={r} capabilityId={capabilityId} region={r} />
      ))}
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
        className={`rounded-xl border bg-white transition-all cursor-pointer flex items-center gap-3 px-4 py-2.5 ${
          isSelected
            ? 'border-brand-500/50 bg-brand-50'
            : 'border-border hover:border-border-strong'
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse() }}
          className="text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Expand"
        >
          <ChevronRight size={10} />
        </button>
        <div className="w-2 h-2 rounded-full bg-brand-500/40" />
        <span className="text-body-sm font-semibold text-text-primary flex-1" onClick={onSelect}>{capability.name}</span>
        <RegionPinStrip capabilityId={capability.id} />
        <span className="text-[10px] text-text-tertiary font-mono">
          {capability.inputs.length}in / {capability.outputs.length}out
        </span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border bg-white transition-all cursor-pointer overflow-hidden ${
        isSelected
          ? 'border-brand-500/50 shadow-card-hover ring-1 ring-brand-500/20'
          : 'border-border hover:border-border-strong shadow-card'
      }`}
    >
      {/* Collapse toggle bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-surface-muted border-b border-border">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse() }}
          className="text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Collapse"
        >
          <ChevronDown size={10} />
        </button>
        <span className="text-[10px] text-text-tertiary font-mono font-bold uppercase tracking-wider flex-1" onClick={onSelect}>{capability.name}</span>
        <RegionPinStrip capabilityId={capability.id} />
      </div>

      {/* Capability block uses a 3-column layout: left (S→I) | center (P) | right (O→C) */}
      <div className="flex items-stretch" onClick={onSelect}>
        {/* ── Left: Suppliers → Inputs ─────────────────── */}
        <div className="flex-1 p-4 flex flex-col gap-2.5 justify-center bg-surface-muted/30">
          {capability.inputs.length > 0 ? (
            capability.inputs.map(input => (
              <InputLane key={input.id} input={input} showDimensions={showDimensions} filterTagIds={filterTagIds} filterMode={filterMode} capabilityId={capability.id} />
            ))
          ) : (
            <div className="flex items-center justify-center py-4 text-[10px] text-text-tertiary italic">
              No inputs defined
            </div>
          )}
        </div>

        {/* ── Center divider + arrow into Process ──────── */}
        <div className="flex items-center">
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="opacity-25">
            <path d="M0 10h12M9 6l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary" />
          </svg>
        </div>

        {/* ── Center: Process (Capability) ─────────────── */}
        <div className="w-[200px] shrink-0 flex items-center justify-center p-3 bg-brand-500/[0.04]">
          <div className="bg-brand-50 border-2 border-brand-200 rounded-xl px-5 py-4 text-center w-full shadow-inner">
            <div className="text-[13px] font-bold text-text-primary leading-tight">{capability.name}</div>
            {(capability.features || []).length > 0 && (
              <div className="mt-2 text-[10px] font-mono text-brand-600/70 font-bold uppercase tracking-wider">
                {capability.features!.length} feature{capability.features!.length !== 1 ? 's' : ''}
              </div>
            )}
            {(capability.use_cases || []).length > 0 && (
              <div className="mt-1 text-[10px] font-mono text-brand-600/70 font-bold uppercase tracking-wider">
                {capability.use_cases!.length} use case{capability.use_cases!.length !== 1 ? 's' : ''}
              </div>
            )}
            {capability.system && (
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 rounded shrink-0" style={{ backgroundColor: capability.system.color || '#64748B' }} />
                <span className="text-[10px] font-medium text-text-secondary">{capability.system.name}</span>
              </div>
            )}
            <div className={`${capability.system ? 'mt-1' : 'mt-2'} inline-flex items-center gap-1 text-[10px] font-mono text-brand-600/70 uppercase tracking-widest font-bold`}>
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
            <path d="M0 10h12M9 6l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary" />
          </svg>
        </div>

        {/* ── Right: Outputs → Consumers ───────────────── */}
        <div className="flex-1 p-4 flex flex-col gap-2.5 justify-center bg-surface-muted/30">
          {capability.outputs.length > 0 ? (
            capability.outputs.map(output => (
              <OutputLane key={output.id} output={output} showDimensions={showDimensions} capabilityId={capability.id} />
            ))
          ) : (
            <div className="flex items-center justify-center py-4 text-[10px] text-text-tertiary italic">
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
        <ChevronRight
          size={isL1 ? 10 : 8}
          className={`text-text-tertiary transition-transform shrink-0 ${collapsed ? '' : 'rotate-90'}`}
        />
        <div
          className={`rounded-full shrink-0 ${isL1 ? 'w-1.5 h-6' : 'w-3 h-0.5'}`}
          style={{ backgroundColor: isL1 ? color : color + '80' }}
        />
        <span className={isL1 ? 'text-heading-sm font-bold text-text-primary' : 'text-body-md font-semibold text-text-secondary'}>
          {node.name}
        </span>
        <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
          L{node.level || depth + 1}
        </span>
        {collapsed && (
          <span className="text-[10px] text-text-tertiary font-mono">
            {childCount} {childCount === 1 ? 'capability' : 'capabilities'}
          </span>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); toggleRollup(node.id) }}
        className={`shrink-0 text-[10px] px-2 py-0.5 rounded-md font-mono uppercase tracking-wider border transition-colors ${
          showRollup
            ? 'bg-brand-50 border-blue-200 text-brand-600'
            : 'border-border text-text-secondary hover:bg-surface-muted'
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
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium font-mono uppercase tracking-wider border transition-colors ${
          active
            ? 'bg-brand-50 border-blue-200 text-brand-600'
            : 'border-border text-text-secondary hover:bg-surface-muted'
        }`}
      >
        <Filter size={10} />
        Filter Tags
        {active && <span className="bg-brand-100 rounded px-1 py-0">{selectedTags.length}</span>}
      </button>
      {active && (
        <>
          <span className="text-[10px] text-text-tertiary font-mono">
            {matchCount}/{totalCount}
          </span>
          <button
            onClick={onClear}
            className="text-[10px] text-text-tertiary hover:text-red-600 uppercase tracking-wider font-mono px-1"
            title="Clear filter"
          >
            clear
          </button>
        </>
      )}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-border rounded-lg shadow-dropdown overflow-hidden min-w-[240px] w-max max-w-[360px] animate-slide-in-up">
          <div className="flex items-center gap-1 p-1.5 border-b border-border">
            <span className="text-[10px] text-text-tertiary font-mono uppercase mr-auto">Match</span>
            <button
              onClick={() => setMode('any')}
              className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${mode === 'any' ? 'bg-brand-100 text-brand-600' : 'text-text-secondary hover:bg-surface-muted'}`}
            >
              Any
            </button>
            <button
              onClick={() => setMode('all')}
              className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${mode === 'all' ? 'bg-brand-100 text-brand-600' : 'text-text-secondary hover:bg-surface-muted'}`}
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
                  className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-[10px] transition-colors ${sel ? 'bg-brand-50 text-text-primary' : 'text-text-secondary hover:bg-surface-muted'}`}
                >
                  <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-brand-500 border-brand-500' : 'border-border-strong'}`}>
                    {sel && <Check size={7} className="text-white" />}
                  </div>
                  <span className="inline-flex items-center rounded text-[10px] px-1 py-0 text-white" style={{ backgroundColor: t.color }}>{t.name}</span>
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
      <EmptyState
        variant="inline"
        title="No capabilities yet"
        description="Add a capability to get started"
      />
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
        <div className="rounded-lg border border-dashed border-border px-4 py-3 text-[10px] italic text-text-tertiary">
          No descendant SIPOC detail to summarize yet.
        </div>
      )
    }
    const childCount = rawCapabilities.filter(c => c.parent_id === nodeId).length
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-brand-600">
          <Check size={10} />
          Rollup - summarized from {childCount} sub-capabilit{childCount === 1 ? 'y' : 'ies'} (read-only)
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
          <div className="text-[10px] text-text-tertiary pl-1">
            <span className="font-mono uppercase tracking-wider mr-1">Features:</span>
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
          <h2 className="text-heading-md font-display text-text-primary">{useSIPOCStore.getState().map!.title}</h2>
          {useSIPOCStore.getState().map!.description && (
            <p className="text-body-sm text-text-secondary mt-0.5">{useSIPOCStore.getState().map!.description}</p>
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium font-mono uppercase tracking-wider border transition-colors ${
            showDimensions
              ? 'bg-brand-50 border-blue-200 text-brand-600'
              : 'border-border text-text-secondary hover:bg-surface-muted'
          }`}
        >
          <Layers size={10} />
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
                <div className="w-1.5 h-6 rounded-full bg-amber-500" />
                <span className="text-heading-sm font-bold text-text-primary">Unassigned</span>
                <span className="text-[10px] font-mono text-text-tertiary">
                  {orphans.length} - organize in Map view
                </span>
              </div>
              <div className="space-y-3 pl-4 border-l-2 border-amber-200">
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
