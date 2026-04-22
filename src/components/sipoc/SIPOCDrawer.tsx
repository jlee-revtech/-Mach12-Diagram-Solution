'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { HydratedCapability, CapabilityTemplateRow, Persona, LogicalSystem, InformationProduct, Dimension } from '@/lib/sipoc/types'
import { exportSIPOCPdf, exportSIPOCExcel, exportSIPOCPptx, exportSIPOCHtml } from '@/lib/export/sipoc'
import { createCapabilityTemplate } from '@/lib/supabase/capability-maps'
import { useAuth } from '@/lib/supabase/auth-context'
import AIAnalyzePanel from '@/components/sipoc/AIAnalyzePanel'
import SIPOCTemplatesPanel from '@/components/sipoc/SIPOCTemplatesPanel'

// ─── SIPOC color tokens ──────────────────────────────────
const SIPOC = {
  S: { label: 'Suppliers',  letter: 'S', color: '#F97316', bg: 'rgba(249,115,22,0.04)' },
  I: { label: 'Inputs',     letter: 'I', color: '#EAB308', bg: 'rgba(234,179,8,0.04)' },
  P: { label: 'Process',    letter: 'P', color: '#2563EB', bg: 'rgba(37,99,235,0.05)' },
  O: { label: 'Outputs',    letter: 'O', color: '#10B981', bg: 'rgba(16,185,129,0.04)' },
  C: { label: 'Customers',  letter: 'C', color: '#8B5CF6', bg: 'rgba(139,92,246,0.04)' },
} as const

// ─── Shared chip components ──────────────────────────────

function PersonaChip({ persona }: { persona: Persona }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/20 text-[10px]">
      <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center" style={{ backgroundColor: `${persona.color}20` }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="4" r="2.2" stroke={persona.color} strokeWidth="1.2" />
          <path d="M2 11c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke={persona.color} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="text-[var(--m12-text)] font-medium truncate leading-tight">{persona.name}</div>
        {persona.role && <div className="text-[8px] text-[var(--m12-text-faint)] truncate leading-tight">{persona.role}</div>}
      </div>
    </div>
  )
}

function SystemChip({ system, small }: { system: LogicalSystem; small?: boolean }) {
  return (
    <div className={`flex items-center gap-1 rounded border border-[var(--m12-border)]/20 bg-[var(--m12-bg-card)] ${small ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-1 text-[10px]'}`}>
      <div className={`${small ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-sm shrink-0`} style={{ backgroundColor: system.color || '#64748B' }} />
      <span className="text-[var(--m12-text)] font-medium truncate">{system.name}</span>
    </div>
  )
}

function IPCard({ name, category, dimensions, tags, accent, onClick, showDims = true }: {
  name: string
  category?: string
  dimensions: Dimension[]
  tags?: { id: string; name: string; color: string }[]
  accent: string
  onClick?: () => void
  showDims?: boolean
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--m12-border)]/20 bg-[var(--m12-bg-card)] overflow-hidden shadow-sm hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer hover:border-[var(--m12-border)]/40' : ''}`}
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
      onClick={onClick}
    >
      <div className="px-3 py-2">
        <div className="text-[11px] font-semibold text-[var(--m12-text)] leading-tight">{name}</div>
        {category && (
          <span className="inline-block mt-1 px-1.5 py-0.5 text-[8px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider rounded bg-[var(--m12-bg)]/80 text-[var(--m12-text-faint)]">
            {category}
          </span>
        )}
        {tags && tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-0.5">
            {tags.map(t => (
              <span key={t.id} className="inline-flex items-center rounded text-[8px] px-1 py-0 text-white leading-tight" style={{ backgroundColor: t.color }}>
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
      {showDims && dimensions.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {dimensions.map(d => (
            <span key={d.id} className="px-1.5 py-0.5 text-[8px] rounded bg-[var(--m12-bg)] text-[var(--m12-text-muted)] border border-[var(--m12-border)]/10">
              {d.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function FlowArrow({ color }: { color: string }) {
  return (
    <div className="flex items-center justify-center py-1 opacity-40">
      <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
        <path d="M0 5h16M13 2l4 3-4 3" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function MiniLineageArrow() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="shrink-0 opacity-30">
      <path d="M1 4h6M5 2l2 2-2 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Column header ───────────────────────────────────────

function ColumnHeader({ sipoc }: { sipoc: typeof SIPOC[keyof typeof SIPOC] }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: sipoc.color }}>
        {sipoc.letter}
      </div>
      <span className="text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-[0.15em] text-[var(--m12-text-muted)]">
        {sipoc.label}
      </span>
    </div>
  )
}

// ─── Horizontal flow arrow between columns ──────────────

function HFlowArrow({ color }: { color: string }) {
  return (
    <div className="flex items-center justify-center shrink-0 w-6">
      <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="opacity-30">
        <path d="M0 5h12M10 2l3 3-3 3" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ─── Input lane (Suppliers → Input card) ─────────────────

function InputLane({ input, onRemove, onClickCard, showDims }: { input: HydratedCapability['inputs'][number]; onRemove: () => void; onClickCard: () => void; showDims?: boolean }) {
  const readOnly = useSIPOCStore(s => s.readOnly)
  const hasSuppliers = input.supplierPersonas.length > 0
  const hasSystems = input.sourceSystems.length > 0
  const hasLeft = hasSuppliers || hasSystems

  return (
    <div className="flex items-stretch gap-0 group/lane">
      {/* Supplier side */}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center" style={{ background: SIPOC.S.bg }}>
        {hasSuppliers && (
          <div className="space-y-1 mb-1.5">
            {input.supplierPersonas.map(p => (
              <PersonaChip key={p.id} persona={p} />
            ))}
          </div>
        )}
        {hasSystems && (
          <div className="flex items-center gap-0.5 flex-wrap">
            {input.sourceSystems.map((sys, si) => (
              <div key={sys.id} className="flex items-center gap-0.5">
                {si > 0 && <MiniLineageArrow />}
                <SystemChip system={sys} small />
              </div>
            ))}
          </div>
        )}
        {!hasLeft && (
          <div className="text-[9px] italic text-[var(--m12-text-faint)]">No suppliers</div>
        )}
      </div>

      {/* Arrow: suppliers → input */}
      <HFlowArrow color={SIPOC.S.color} />

      {/* Input card side */}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center relative" style={{ background: SIPOC.I.bg }}>
        {!readOnly && <button
          onClick={(e) => { e.stopPropagation(); if (confirm(`Remove input "${input.informationProduct.name}"?`)) onRemove() }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center text-[var(--m12-text-faint)] hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover/lane:opacity-100 z-10"
          title="Remove input"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 6.5l5-5M1.5 1.5l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>}
        <IPCard
          name={input.informationProduct.name}
          category={input.informationProduct.category}
          dimensions={input.dimensions || []}
          tags={input.tags}
          accent={SIPOC.I.color}
          onClick={onClickCard}
          showDims={showDims}
        />
        {input.feedingSystem && (
          <div className="flex items-center gap-1 mt-1.5 pl-1">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="opacity-40 shrink-0">
              <path d="M1 4h5M4 2l2 2-2 2" stroke={SIPOC.I.color} strokeWidth="1" strokeLinecap="round" />
            </svg>
            <SystemChip system={input.feedingSystem} small />
            <span className="text-[7px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] uppercase">feeds</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Output lane (Output card → Customers) ───────────────

function OutputLane({ output, onRemove, onClickCard, showDims }: { output: HydratedCapability['outputs'][number]; onRemove: () => void; onClickCard: () => void; showDims?: boolean }) {
  const readOnly = useSIPOCStore(s => s.readOnly)
  const hasConsumers = output.consumerPersonas.length > 0
  const hasSystems = output.destinationSystems.length > 0

  return (
    <div className="flex items-stretch gap-0 group/lane">
      {/* Output card side */}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center relative" style={{ background: SIPOC.O.bg }}>
        {!readOnly && <button
          onClick={(e) => { e.stopPropagation(); if (confirm(`Remove output "${output.informationProduct.name}"?`)) onRemove() }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center text-[var(--m12-text-faint)] hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover/lane:opacity-100 z-10"
          title="Remove output"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 6.5l5-5M1.5 1.5l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>}
        <IPCard
          name={output.informationProduct.name}
          category={output.informationProduct.category}
          dimensions={output.dimensions || []}
          tags={output.tags}
          accent={SIPOC.O.color}
          onClick={onClickCard}
          showDims={showDims}
        />
        {/* Destination system lineage */}
        {hasSystems && (
          <div className="flex items-center gap-0.5 flex-wrap mt-1.5 pl-1">
            <span className="text-[7px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] uppercase mr-0.5">available in</span>
            {output.destinationSystems.map((sys, si) => (
              <div key={sys.id} className="flex items-center gap-0.5">
                {si > 0 && <MiniLineageArrow />}
                <SystemChip system={sys} small />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Arrow: output → customers */}
      <HFlowArrow color={SIPOC.O.color} />

      {/* Customer side */}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center" style={{ background: SIPOC.C.bg }}>
        {hasConsumers ? (
          <div className="space-y-1">
            {output.consumerPersonas.map(p => (
              <PersonaChip key={p.id} persona={p} />
            ))}
          </div>
        ) : (
          <div className="text-[9px] italic text-[var(--m12-text-faint)]">No consumers</div>
        )}
      </div>
    </div>
  )
}

// ─── Process column with collapsible features ──────────

function ProcessColumn({ capability, inputs, outputs }: { capability: HydratedCapability; inputs: HydratedCapability['inputs']; outputs: HydratedCapability['outputs'] }) {
  const [featuresExpanded, setFeaturesExpanded] = useState(false)
  const [useCasesExpanded, setUseCasesExpanded] = useState(false)
  const features = capability.features || []
  const hasFeatures = features.length > 0
  const useCases = capability.use_cases || []
  const hasUseCases = useCases.length > 0

  return (
    <div className="w-[220px] shrink-0 flex flex-col border-l border-r border-[var(--m12-border)]/10 overflow-y-auto" style={{ background: SIPOC.P.bg }}>
      <div className="p-3 pb-1 shrink-0 border-b border-[var(--m12-border)]/10">
        <ColumnHeader sipoc={SIPOC.P} />
      </div>
      <div className="flex-1 flex flex-col items-center p-4 gap-3">
        {/* Process box — compact */}
        <div className="w-full rounded-xl border border-[#2563EB]/30 bg-gradient-to-b from-[#2563EB]/10 to-[#2563EB]/5 p-4 text-center shadow-lg"
          style={{ boxShadow: '0 0 40px rgba(37,99,235,0.08)' }}
        >
          <div className="text-[8px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-[0.2em] text-[#2563EB]/60 mb-1.5">
            L{capability.level} {capability.level === 1 ? 'Core Area' : capability.level === 2 ? 'Capability' : 'Functionality'}
          </div>
          <div className="text-sm font-bold text-[var(--m12-text)] leading-snug">{capability.name}</div>
          {capability.system && (
            <div className="flex justify-center mt-3">
              <SystemChip system={capability.system} />
            </div>
          )}
        </div>

        {/* Features — collapsible card */}
        {hasFeatures && (
          <div className="w-full">
            <button
              onClick={() => setFeaturesExpanded(e => !e)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#2563EB]/5 border border-[#2563EB]/15 hover:border-[#2563EB]/30 transition-colors group"
            >
              <span className="text-[8px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider text-[#2563EB]/70">
                {features.length} Feature{features.length !== 1 ? 's' : ''}
              </span>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`text-[#2563EB]/50 transition-transform ${featuresExpanded ? 'rotate-180' : ''}`}>
                <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {featuresExpanded && (
              <div className="mt-1.5 px-1 space-y-1 max-h-[300px] overflow-y-auto">
                {features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[9px] text-[var(--m12-text-secondary)] leading-snug">
                    <span className="text-[#2563EB]/40 mt-px shrink-0">•</span>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Use Cases — collapsible card */}
        {hasUseCases && (
          <div className="w-full">
            <button
              onClick={() => setUseCasesExpanded(e => !e)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#2563EB]/5 border border-[#2563EB]/15 hover:border-[#2563EB]/30 transition-colors group"
            >
              <span className="text-[8px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider text-[#2563EB]/70">
                {useCases.length} Use Case{useCases.length !== 1 ? 's' : ''}
              </span>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`text-[#2563EB]/50 transition-transform ${useCasesExpanded ? 'rotate-180' : ''}`}>
                <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {useCasesExpanded && (
              <div className="mt-1.5 px-1 space-y-1 max-h-[300px] overflow-y-auto">
                {useCases.map((uc, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[9px] text-[var(--m12-text-secondary)] leading-snug">
                    <span className="text-[#2563EB]/40 mt-px shrink-0">•</span>
                    <span>{uc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] uppercase tracking-wider">
          {inputs.length} input{inputs.length !== 1 ? 's' : ''} · {outputs.length} output{outputs.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}

// ─── SIPOC Flow Content (lane-based layout) ──────────────

function SIPOCFlowContent({ capability, onOpenEditor, showDims }: { capability: HydratedCapability; onOpenEditor: () => void; showDims?: boolean }) {
  const removeInput = useSIPOCStore(s => s.removeInput)
  const removeOutput = useSIPOCStore(s => s.removeOutput)
  const setFocusedItem = useSIPOCStore(s => s.setFocusedItem)

  const handleClickItem = useCallback((itemId: string) => {
    setFocusedItem(itemId)
    onOpenEditor()
  }, [setFocusedItem, onOpenEditor])
  const inputs = capability.inputs || []
  const outputs = capability.outputs || []

  return (
    <div className="flex h-full overflow-auto">
      {/* ─── Left: Suppliers → Inputs (stacked lanes) ─── */}
      <div className="flex-[2] min-w-0 flex flex-col overflow-y-auto">
        {/* Column headers */}
        <div className="flex shrink-0 border-b border-[var(--m12-border)]/10">
          <div className="flex-1 p-3 pb-1" style={{ background: SIPOC.S.bg }}>
            <ColumnHeader sipoc={SIPOC.S} />
          </div>
          <div className="w-6" />
          <div className="flex-1 p-3 pb-1" style={{ background: SIPOC.I.bg }}>
            <ColumnHeader sipoc={SIPOC.I} />
          </div>
        </div>
        {/* Input lanes */}
        {inputs.length > 0 ? (
          <div className="flex-1">
            {inputs.map((input, i) => (
              <div key={input.id} className={i > 0 ? 'border-t border-[var(--m12-border)]/8' : ''}>
                <InputLane input={input} onRemove={() => removeInput(input.id, capability.id)} onClickCard={() => handleClickItem(input.id)} showDims={showDims} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[10px] italic text-[var(--m12-text-faint)] py-8">
            No inputs defined
          </div>
        )}
      </div>

      {/* ─── Arrow: inputs → process ─── */}
      <div className="flex items-center shrink-0">
        <HFlowArrow color={SIPOC.I.color} />
      </div>

      {/* ─── Center: Process ─── */}
      <ProcessColumn capability={capability} inputs={inputs} outputs={outputs} />

      {/* ─── Arrow: process → outputs ─── */}
      <div className="flex items-center shrink-0">
        <HFlowArrow color={SIPOC.P.color} />
      </div>

      {/* ─── Right: Outputs → Customers (stacked lanes) ─── */}
      <div className="flex-[2] min-w-0 flex flex-col overflow-y-auto">
        {/* Column headers */}
        <div className="flex shrink-0 border-b border-[var(--m12-border)]/10">
          <div className="flex-1 p-3 pb-1" style={{ background: SIPOC.O.bg }}>
            <ColumnHeader sipoc={SIPOC.O} />
          </div>
          <div className="w-6" />
          <div className="flex-1 p-3 pb-1" style={{ background: SIPOC.C.bg }}>
            <ColumnHeader sipoc={SIPOC.C} />
          </div>
        </div>
        {/* Output lanes */}
        {outputs.length > 0 ? (
          <div className="flex-1">
            {outputs.map((output, i) => (
              <div key={output.id} className={i > 0 ? 'border-t border-[var(--m12-border)]/8' : ''}>
                <OutputLane output={output} onRemove={() => removeOutput(output.id, capability.id)} onClickCard={() => handleClickItem(output.id)} showDims={showDims} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[10px] italic text-[var(--m12-text-faint)] py-8">
            No outputs defined
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Serialize hydrated capability to portable template ──

function hydratedToTemplate(cap: HydratedCapability): CapabilityTemplateRow['template_data'] {
  return {
    capability: { name: cap.name, description: cap.description, features: cap.features || [], level: cap.level, color: cap.color || undefined },
    system: cap.system?.name,
    inputs: cap.inputs.map(inp => ({
      informationProduct: { name: inp.informationProduct.name, category: inp.informationProduct.category },
      supplierPersonas: inp.supplierPersonas.map(p => ({ name: p.name, role: p.role, color: p.color })),
      sourceSystems: inp.sourceSystems.map(s => ({ name: s.name, color: s.color })),
      feedingSystem: inp.feedingSystem ? { name: inp.feedingSystem.name, color: inp.feedingSystem.color } : undefined,
      dimensions: (inp.dimensions || []).map(d => ({ name: d.name, description: d.description })),
    })),
    outputs: cap.outputs.map(out => ({
      informationProduct: { name: out.informationProduct.name, category: out.informationProduct.category },
      consumerPersonas: out.consumerPersonas.map(p => ({ name: p.name, role: p.role, color: p.color })),
      destinationSystems: out.destinationSystems.map(s => ({ name: s.name, color: s.color })),
      dimensions: (out.dimensions || []).map(d => ({ name: d.name, description: d.description })),
    })),
  }
}

// ─── Export menu (for individual SIPOC) ──────────────────

function ExportMenu({ hydrated, mapTitle, orgId }: { hydrated: HydratedCapability | null; mapTitle: string; orgId: string }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!hydrated) return null

  const capName = hydrated.name
  const exportCaps = [hydrated]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider transition-colors ${
          open ? 'bg-[var(--m12-bg)] text-[var(--m12-text)]' : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)]'
        }`}
      >
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v5M4 5.5L6 7.5l2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 9h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg shadow-xl overflow-hidden">
          <div className="px-2.5 py-1.5 text-[8px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-faint)] uppercase tracking-wider border-b border-[var(--m12-border)]/20">
            {capName}
          </div>
          {[
            { label: 'PDF', fn: () => exportSIPOCPdf(capName, exportCaps) },
            { label: 'Excel', fn: () => { const s = useSIPOCStore.getState(); exportSIPOCExcel(capName, exportCaps, s.personas, s.informationProducts, s.logicalSystems) } },
            { label: 'PowerPoint', fn: () => exportSIPOCPptx(capName, exportCaps) },
            { label: 'HTML', fn: () => exportSIPOCHtml(capName, exportCaps) },
          ].map(({ label, fn }) => (
            <button
              key={label}
              onClick={() => { setOpen(false); fn() }}
              className="w-full text-left px-2.5 py-1.5 text-[10px] text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg)] transition-colors"
            >
              Export as {label}
            </button>
          ))}
          <div className="border-t border-[var(--m12-border)]/20" />
          <button
            disabled={saving}
            onClick={async () => {
              if (!hydrated || !user) return
              const name = prompt('Template name:', hydrated.name)
              if (!name) return
              setSaving(true)
              try {
                const templateData = hydratedToTemplate(hydrated)
                await createCapabilityTemplate(orgId, user.id, name, hydrated.description || null, templateData)
                setOpen(false)
              } catch (err) {
                console.error('Failed to save template:', err)
                alert('Failed to save template')
              } finally {
                setSaving(false)
              }
            }}
            className="w-full text-left px-2.5 py-1.5 text-[10px] text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg)] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save as Template'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Drawer ─────────────────────────────────────────

export default function SIPOCDrawer({ orgId, editorOpen, onToggleEditor, onShowAI, mapTitle, children }: {
  orgId: string
  editorOpen: boolean
  onToggleEditor: () => void
  onShowAI: (prompt?: string) => void
  mapTitle: string
  children?: React.ReactNode
}) {
  const drawerOpen = useSIPOCStore(s => s.drawerOpen)
  const drawerHeight = useSIPOCStore(s => s.drawerHeight)
  const readOnly = useSIPOCStore(s => s.readOnly)
  const selectedId = useSIPOCStore(s => s.selectedCapabilityId)
  const capabilities = useSIPOCStore(s => s.capabilities)

  const fullscreen = useSIPOCStore(s => s.drawerFullscreen)

  const [showDims, setShowDims] = useState(true)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [contentVisible, setContentVisible] = useState(false)
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null)

  // Hydrate the selected capability — auto-rollup for L1/L2 with children
  const hasChildren = useMemo(
    () => !!selectedId && capabilities.some(c => c.parent_id === selectedId),
    [selectedId, capabilities]
  )
  const hydrated = useMemo(() => {
    if (!selectedId) return null
    const store = useSIPOCStore.getState()
    if (hasChildren) {
      const rolled = store.getRollup(selectedId)
      if (rolled) return rolled
    }
    const all = store.getHydratedCapabilities()
    return all.find(c => c.id === selectedId) || null
  }, [selectedId, hasChildren, capabilities, useSIPOCStore(s => s.inputs), useSIPOCStore(s => s.outputs), useSIPOCStore(s => s.tags)])
  const isRollupView = hasChildren && !!hydrated

  // Build breadcrumb
  const breadcrumb = useMemo(() => {
    if (!hydrated) return []
    const crumbs: { name: string; color?: string | null }[] = []
    let current = hydrated
    const caps = capabilities
    while (current) {
      crumbs.unshift({ name: current.name, color: current.color })
      const parent = current.parent_id ? caps.find(c => c.id === current!.parent_id) : null
      current = parent as any
    }
    return crumbs
  }, [hydrated, capabilities])

  // Sibling navigation
  const siblings = useMemo(() => {
    if (!hydrated) return []
    return capabilities
      .filter(c => c.parent_id === hydrated.parent_id && c.level === hydrated.level)
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [hydrated, capabilities])

  const currentSibIdx = siblings.findIndex(s => s.id === selectedId)

  const navigateSibling = useCallback((dir: -1 | 1) => {
    const next = siblings[currentSibIdx + dir]
    if (next) useSIPOCStore.getState().setSelectedCapability(next.id)
  }, [siblings, currentSibIdx])

  // Stagger content entrance
  useEffect(() => {
    if (drawerOpen) {
      const t = setTimeout(() => setContentVisible(true), 150)
      return () => clearTimeout(t)
    } else {
      setContentVisible(false)
    }
  }, [drawerOpen, selectedId])

  // Drag resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setResizing(true)
    resizeRef.current = { startY: e.clientY, startH: drawerHeight }

    const handleMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const delta = resizeRef.current.startY - ev.clientY
      const newH = Math.max(280, Math.min(window.innerHeight * 0.8, resizeRef.current.startH + delta))
      useSIPOCStore.setState({ drawerHeight: newH })
    }

    const handleUp = () => {
      setResizing(false)
      resizeRef.current = null
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [drawerHeight])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        useSIPOCStore.getState().setSelectedCapability(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [drawerOpen])

  // Arrow nav between siblings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!drawerOpen) return
      if (e.key === 'ArrowLeft') navigateSibling(-1)
      if (e.key === 'ArrowRight') navigateSibling(1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [drawerOpen, navigateSibling])

  const close = useCallback(() => {
    useSIPOCStore.getState().setSelectedCapability(null)
  }, [])

  return (
    <div
      className="shrink-0 flex flex-col bg-[var(--m12-bg-card)] border-t border-[var(--m12-border)]/40 overflow-hidden"
      style={{
        height: drawerOpen ? (fullscreen ? 'calc(100vh - 48px)' : drawerHeight) : 0,
        transition: resizing ? 'none' : 'height 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: drawerOpen ? '0 -8px 30px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      {/* Drag handle */}
      <div
        className="flex items-center justify-center h-2 cursor-row-resize shrink-0 hover:bg-[var(--m12-bg)] transition-colors group"
        onMouseDown={handleResizeStart}
        onDoubleClick={() => {
          useSIPOCStore.setState({ drawerHeight: drawerHeight < 500 ? window.innerHeight * 0.65 : 420 })
        }}
      >
        <div className="w-10 h-1 rounded-full bg-[var(--m12-border)]/40 group-hover:bg-[var(--m12-border)] transition-colors" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--m12-border)]/20 shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {breadcrumb.map((crumb, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-[var(--m12-text-faint)] text-[8px]">/</span>}
              {i === 0 && crumb.color && (
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: crumb.color }} />
              )}
              <span className={`text-[10px] truncate ${
                i === breadcrumb.length - 1
                  ? 'font-bold text-[var(--m12-text)]'
                  : 'text-[var(--m12-text-muted)]'
              }`}>
                {crumb.name}
              </span>
            </div>
          ))}
        </div>

        {/* SIPOC legend dots */}
        <div className="flex items-center gap-1">
          {Object.values(SIPOC).map(s => (
            <div key={s.letter} className="w-4 h-4 rounded flex items-center justify-center text-[7px] font-bold text-white" style={{ backgroundColor: s.color }}>
              {s.letter}
            </div>
          ))}
        </div>

        {/* Sibling navigation */}
        <div className="flex items-center gap-0.5 ml-2">
          <button
            onClick={() => navigateSibling(-1)}
            disabled={currentSibIdx <= 0}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--m12-text-muted)] hover:bg-[var(--m12-bg)] disabled:opacity-20 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M6.5 2L3.5 5L6.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-[8px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-faint)] min-w-[30px] text-center">
            {currentSibIdx + 1}/{siblings.length}
          </span>
          <button
            onClick={() => navigateSibling(1)}
            disabled={currentSibIdx >= siblings.length - 1}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--m12-text-muted)] hover:bg-[var(--m12-bg)] disabled:opacity-20 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Dims toggle */}
        <button
          onClick={() => setShowDims(d => !d)}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider transition-colors ${
            showDims
              ? 'bg-[var(--m12-bg)] text-[var(--m12-text)]'
              : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)]'
          }`}
        >
          Dims
        </button>

        {/* Export dropdown */}
        <ExportMenu hydrated={hydrated} mapTitle={mapTitle} orgId={orgId} />

        {!readOnly && <>
        {/* Templates */}
        <button
          onClick={() => { setShowTemplates(t => !t); if (!showTemplates) setShowAnalysis(false) }}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider transition-colors ${
            showTemplates
              ? 'bg-[#F97316]/15 text-[#F97316]'
              : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)]'
          }`}
        >
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
            <rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
            <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
            <rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          Templates
        </button>

        {/* Analyze */}
        <button
          onClick={() => { setShowAnalysis(a => !a); if (!showAnalysis) setShowTemplates(false) }}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider transition-colors ${
            showAnalysis
              ? 'bg-[#06B6D4]/15 text-[#06B6D4]'
              : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)]'
          }`}
        >
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M6 3.5v3M6 8.5v.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Analyze
        </button>

        {/* AI Generate */}
        <button
          onClick={() => onShowAI()}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider bg-gradient-to-r from-[#8B5CF6] to-[#2563EB] text-white hover:from-[#7C3AED] hover:to-[#3B82F6] transition-all"
        >
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L7.5 4.5L11 5.5L8.5 8L9 11.5L6 10L3 11.5L3.5 8L1 5.5L4.5 4.5L6 1Z" fill="white" />
          </svg>
          Generate
        </button>

        {/* Edit toggle */}
        <button
          onClick={onToggleEditor}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider transition-colors ${
            editorOpen
              ? 'bg-[#2563EB]/15 text-[#2563EB]'
              : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)]'
          }`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M7.5 1.5l1 1M1.5 7.5l-.5 2 2-.5L7.5 4.5l-1-1-5 4z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Edit
        </button>
        </>}

        {/* Fullscreen toggle */}
        <button
          onClick={() => useSIPOCStore.setState({ drawerFullscreen: !fullscreen })}
          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
            fullscreen
              ? 'text-[#2563EB] bg-[#2563EB]/10'
              : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)]'
          }`}
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 1v2.5H1M6.5 9V6.5H9M1 6.5h2.5V9M9 3.5H6.5V1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 3.5V1h2.5M9 6.5V9H6.5M6.5 1H9v2.5M3.5 9H1V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          onClick={close}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)] transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 8L8 2M2 2l6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content: SIPOC flow + optional editor panel */}
      <div
        className="flex-1 flex overflow-hidden"
        style={{
          opacity: contentVisible ? 1 : 0,
          transition: 'opacity 250ms ease',
        }}
      >
        {/* SIPOC flow (takes remaining space) */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {showTemplates ? (
            <SIPOCTemplatesPanel
              orgId={orgId}
              onClose={() => setShowTemplates(false)}
            />
          ) : showAnalysis ? (
            <AIAnalyzePanel
              onClose={() => setShowAnalysis(false)}
              onImplement={(capabilityName, prompt) => {
                const caps = useSIPOCStore.getState().capabilities
                const cap = caps.find(c => c.name === capabilityName)
                if (cap) {
                  useSIPOCStore.getState().setSelectedCapability(cap.id)
                }
                setShowAnalysis(false)
                onShowAI(prompt)
              }}
            />
          ) : hydrated ? (
            <div className="flex flex-col h-full">
              {isRollupView && (
                <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-[#8B5CF6]/10 border-b border-[#8B5CF6]/25 text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[#C4B5FD]">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Rollup view · aggregated from {(hydrated.features || []).length} sub-capabilit{(hydrated.features || []).length === 1 ? 'y' : 'ies'} (read-only)
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <SIPOCFlowContent capability={hydrated} onOpenEditor={() => { if (!editorOpen) onToggleEditor() }} showDims={showDims} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--m12-text-faint)] text-xs">
              Select a capability on the map to view its SIPOC
            </div>
          )}
        </div>

        {/* Editor toggle tab */}
        <button
          onClick={onToggleEditor}
          className="shrink-0 w-5 flex items-center justify-center border-l border-[var(--m12-border)]/20 hover:bg-[var(--m12-bg)] transition-colors cursor-pointer group"
          title={editorOpen ? 'Hide editor' : 'Show editor'}
        >
          <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className={`text-[var(--m12-text-muted)] group-hover:text-[var(--m12-text)] transition-all ${editorOpen ? 'rotate-180' : ''}`}>
            <path d="M2 1l5 5-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Editor panel (slides in from right) */}
        <div
          className="shrink-0 border-l border-[var(--m12-border)]/30 overflow-hidden"
          style={{
            width: editorOpen ? 380 : 0,
            transition: 'width 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
