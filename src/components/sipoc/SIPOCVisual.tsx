'use client'

import { useMemo } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { HydratedCapability } from '@/lib/sipoc/types'

// ─── Column Header ──────────────────────────────────────
function ColumnHeader({ label, color, letter }: { label: string; color: string; letter: string }) {
  return (
    <div className="flex flex-col items-center gap-1 pb-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm font-[family-name:var(--font-orbitron)]"
        style={{ backgroundColor: color }}
      >
        {letter}
      </div>
      <span className="text-[10px] uppercase tracking-widest font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold">
        {label}
      </span>
    </div>
  )
}

// ─── Tag Chip ───────────────────────────────────────────
function TagChip({ label, color, small }: { label: string; color?: string; small?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--m12-border)]/40 bg-[var(--m12-bg)]/60 backdrop-blur-sm ${
        small ? 'px-2 py-0.5' : 'px-2.5 py-1'
      }`}
    >
      {color && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span className={`${small ? 'text-[9px]' : 'text-[10px]'} font-medium text-[var(--m12-text-secondary)] truncate max-w-[120px]`}>
        {label}
      </span>
    </div>
  )
}

// ─── Info Product Card ──────────────────────────────────
function IPCard({ name, category }: { name: string; category?: string }) {
  return (
    <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2 shadow-sm hover:border-[var(--m12-border)] transition-colors">
      <div className="text-xs font-medium text-[var(--m12-text)]">{name}</div>
      {category && (
        <div className="text-[9px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] uppercase tracking-wider mt-0.5">
          {category}
        </div>
      )}
    </div>
  )
}

// ─── Flow Arrow SVG ─────────────────────────────────────
function FlowArrow() {
  return (
    <div className="flex items-center justify-center px-1 shrink-0">
      <svg width="24" height="16" viewBox="0 0 24 16" fill="none" className="text-[var(--m12-border)]">
        <path d="M0 8h20M16 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ─── Single Capability SIPOC Row ────────────────────────
function CapabilityRow({ capability, isSelected, onSelect }: {
  capability: HydratedCapability
  isSelected: boolean
  onSelect: () => void
}) {
  // Collect unique suppliers (personas) and source systems across all inputs
  const allSupplierPersonas = new Map<string, { name: string; color: string }>()
  const allSourceSystems = new Map<string, { name: string; color?: string }>()
  capability.inputs.forEach(input => {
    input.supplierPersonas.forEach(p => allSupplierPersonas.set(p.id, { name: p.name, color: p.color }))
    input.sourceSystems.forEach(s => allSourceSystems.set(s.id, { name: s.name, color: s.color }))
  })

  // Collect unique consumers
  const allConsumerPersonas = new Map<string, { name: string; color: string }>()
  capability.outputs.forEach(output => {
    output.consumerPersonas.forEach(p => allConsumerPersonas.set(p.id, { name: p.name, color: p.color }))
  })

  return (
    <div
      onClick={onSelect}
      className={`grid grid-cols-[1fr_auto_1fr_auto_minmax(140px,1.2fr)_auto_1fr_auto_1fr] items-stretch gap-0 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'border-[#2563EB]/60 bg-[#2563EB]/5 shadow-lg shadow-[#2563EB]/10'
          : 'border-[var(--m12-border)]/30 hover:border-[var(--m12-border)]/60 bg-[var(--m12-bg-card)]/50'
      }`}
    >
      {/* S — Suppliers */}
      <div className="p-3 flex flex-col gap-1.5 min-h-[80px]">
        {allSupplierPersonas.size > 0 ? (
          [...allSupplierPersonas.values()].map((p, i) => (
            <TagChip key={i} label={p.name} color={p.color} />
          ))
        ) : (
          <div className="text-[10px] text-[var(--m12-text-muted)] italic p-2">No suppliers</div>
        )}
        {allSourceSystems.size > 0 && (
          <div className="mt-1 pt-1 border-t border-[var(--m12-border)]/20 flex flex-col gap-1">
            {[...allSourceSystems.values()].map((s, i) => (
              <TagChip key={i} label={s.name} color={s.color || '#64748B'} small />
            ))}
          </div>
        )}
      </div>

      <FlowArrow />

      {/* I — Inputs */}
      <div className="p-3 flex flex-col gap-1.5">
        {capability.inputs.length > 0 ? (
          capability.inputs.map(input => (
            <IPCard
              key={input.id}
              name={input.informationProduct.name}
              category={input.informationProduct.category}
            />
          ))
        ) : (
          <div className="text-[10px] text-[var(--m12-text-muted)] italic p-2">No inputs</div>
        )}
      </div>

      <FlowArrow />

      {/* P — Process (Capability) */}
      <div className="p-3 flex items-center justify-center">
        <div className="bg-[#2563EB]/10 border-2 border-[#2563EB]/40 rounded-xl px-4 py-3 text-center w-full">
          <div className="text-sm font-semibold text-[var(--m12-text)]">{capability.name}</div>
          {capability.description && (
            <div className="text-[10px] text-[var(--m12-text-muted)] mt-1 line-clamp-2">{capability.description}</div>
          )}
        </div>
      </div>

      <FlowArrow />

      {/* O — Outputs */}
      <div className="p-3 flex flex-col gap-1.5">
        {capability.outputs.length > 0 ? (
          capability.outputs.map(output => (
            <IPCard
              key={output.id}
              name={output.informationProduct.name}
              category={output.informationProduct.category}
            />
          ))
        ) : (
          <div className="text-[10px] text-[var(--m12-text-muted)] italic p-2">No outputs</div>
        )}
      </div>

      <FlowArrow />

      {/* C — Customers */}
      <div className="p-3 flex flex-col gap-1.5">
        {allConsumerPersonas.size > 0 ? (
          [...allConsumerPersonas.values()].map((p, i) => (
            <TagChip key={i} label={p.name} color={p.color} />
          ))
        ) : (
          <div className="text-[10px] text-[var(--m12-text-muted)] italic p-2">No customers</div>
        )}
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
    <div className="space-y-3">
      {/* SIPOC Column Headers */}
      <div className="grid grid-cols-[1fr_auto_1fr_auto_minmax(140px,1.2fr)_auto_1fr_auto_1fr] items-end gap-0 px-3">
        <ColumnHeader label="Suppliers" color="#F97316" letter="S" />
        <div className="w-6" />
        <ColumnHeader label="Inputs" color="#EAB308" letter="I" />
        <div className="w-6" />
        <ColumnHeader label="Process" color="#2563EB" letter="P" />
        <div className="w-6" />
        <ColumnHeader label="Outputs" color="#10B981" letter="O" />
        <div className="w-6" />
        <ColumnHeader label="Customers" color="#8B5CF6" letter="C" />
      </div>

      {/* Capability Rows */}
      {capabilities.map(cap => (
        <CapabilityRow
          key={cap.id}
          capability={cap}
          isSelected={selectedCapabilityId === cap.id}
          onSelect={() => setSelectedCapability(selectedCapabilityId === cap.id ? null : cap.id)}
        />
      ))}
    </div>
  )
}
