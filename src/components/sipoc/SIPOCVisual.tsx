'use client'

import { useMemo, useState } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { HydratedCapability, Dimension } from '@/lib/sipoc/types'

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

// ─── Info Product Card (the data object, with dimensions) ─
function IPCard({
  name,
  category,
  dimensions,
  showDimensions,
  accentColor,
}: {
  name: string
  category?: string
  dimensions?: Dimension[]
  showDimensions: boolean
  accentColor: string
}) {
  const hasDims = dimensions && dimensions.length > 0
  return (
    <div
      className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2.5 shadow-sm transition-all hover:shadow-md"
      style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
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
      {showDimensions && hasDims && (
        <div className="mt-2 pt-1.5 border-t border-[var(--m12-border)]/15 space-y-0 border-l-2 border-[var(--m12-border)]/15 ml-0.5 pl-2">
          {dimensions.map(dim => (
            <div key={dim.id} className="text-[8px] text-[var(--m12-text-muted)] py-px">{dim.name}</div>
          ))}
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

// ─── Feeding system chip (emphasized) ───────────────────
function FeedingSystemChip({ name, color }: { name: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg px-2.5 py-1.5 shadow-md max-w-full ring-1 ring-[var(--m12-border)]/15">
      <div className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: color || '#64748B' }} />
      <div className="min-w-0">
        <span className="text-[10px] font-semibold text-[var(--m12-text)] truncate block">{name}</span>
        <span className="text-[6px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-faint)] uppercase tracking-widest">Feeding System</span>
      </div>
    </div>
  )
}

// ─── Single input lane (Suppliers → Input) ──────────────
function InputLane({ input, showDimensions }: {
  input: HydratedCapability['inputs'][0]
  showDimensions: boolean
}) {
  const hasSuppliers = input.supplierPersonas.length > 0 || input.sourceSystems.length > 0 || !!input.feedingSystem
  const sourceSystems = input.sourceSystems
  const feedingSystem = input.feedingSystem

  return (
    <div className="flex items-center gap-2">
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
          showDimensions={showDimensions}
          accentColor="#EAB308"
        />
      </div>

      {/* Feeding system (last in chain — sits between IP and Process) */}
      {feedingSystem && (
        <>
          <HArrow />
          <FeedingSystemChip name={feedingSystem.name} color={feedingSystem.color} />
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
          showDimensions={showDimensions}
          accentColor="#10B981"
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
function CapabilityBlock({ capability, isSelected, onSelect, showDimensions, collapsed, onToggleCollapse }: {
  capability: HydratedCapability
  isSelected: boolean
  onSelect: () => void
  showDimensions: boolean
  collapsed: boolean
  onToggleCollapse: () => void
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
              <InputLane key={input.id} input={input} showDimensions={showDimensions} />
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
            {capability.description && (
              <div className="text-[10px] text-[var(--m12-text-muted)] mt-1.5 line-clamp-3 leading-relaxed">{capability.description}</div>
            )}
            <div className="mt-2 inline-flex items-center gap-1 text-[7px] font-[family-name:var(--font-space-mono)] text-[#2563EB]/60 uppercase tracking-widest font-bold">
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

  const toggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const capabilities = useMemo(() => {
    return useSIPOCStore.getState().getHydratedCapabilities()
  }, [rawCapabilities, inputs, outputs, personas, informationProducts, logicalSystems])

  if (capabilities.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--m12-text-muted)] text-sm">
        Add a capability to get started
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header bar: column labels + controls */}
      <div className="flex items-end justify-between px-2">
        {/* SIPOC column labels */}
        <div className="flex items-end gap-0 flex-1">
          {/* Left half labels */}
          <div className="flex-1 flex justify-between px-4">
            <ColumnHeader label="Suppliers" color="#F97316" letter="S" />
            <ColumnHeader label="Inputs" color="#EAB308" letter="I" />
          </div>
          {/* Center spacer for Process column */}
          <div className="w-[232px] shrink-0 flex justify-center">
            <ColumnHeader label="Process" color="#2563EB" letter="P" />
          </div>
          {/* Right half labels */}
          <div className="flex-1 flex justify-between px-4">
            <ColumnHeader label="Outputs" color="#10B981" letter="O" />
            <ColumnHeader label="Customers" color="#8B5CF6" letter="C" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-end">
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

      {/* Capability Blocks */}
      {capabilities.map(cap => (
        <CapabilityBlock
          key={cap.id}
          capability={cap}
          isSelected={selectedCapabilityId === cap.id}
          onSelect={() => setSelectedCapability(selectedCapabilityId === cap.id ? null : cap.id)}
          showDimensions={showDimensions}
          collapsed={collapsedIds.has(cap.id)}
          onToggleCollapse={() => toggleCollapse(cap.id)}
        />
      ))}
    </div>
  )
}
