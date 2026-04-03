'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { HydratedCapability, Persona, LogicalSystem, InformationProduct, Dimension } from '@/lib/sipoc/types'

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

function IPCard({ name, category, dimensions, accent }: {
  name: string
  category?: string
  dimensions: Dimension[]
  accent: string
}) {
  return (
    <div className="rounded-lg border border-[var(--m12-border)]/20 bg-[var(--m12-bg-card)] overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ borderLeftWidth: 3, borderLeftColor: accent }}>
      <div className="px-3 py-2">
        <div className="text-[11px] font-semibold text-[var(--m12-text)] leading-tight">{name}</div>
        {category && (
          <span className="inline-block mt-1 px-1.5 py-0.5 text-[8px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider rounded bg-[var(--m12-bg)]/80 text-[var(--m12-text-faint)]">
            {category}
          </span>
        )}
      </div>
      {dimensions.length > 0 && (
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

function InputLane({ input, onRemove }: { input: HydratedCapability['inputs'][number]; onRemove: () => void }) {
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
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm(`Remove input "${input.informationProduct.name}"?`)) onRemove() }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center text-[var(--m12-text-faint)] hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover/lane:opacity-100 z-10"
          title="Remove input"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 6.5l5-5M1.5 1.5l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <IPCard
          name={input.informationProduct.name}
          category={input.informationProduct.category}
          dimensions={input.dimensions || []}
          accent={SIPOC.I.color}
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

function OutputLane({ output, onRemove }: { output: HydratedCapability['outputs'][number]; onRemove: () => void }) {
  const hasConsumers = output.consumerPersonas.length > 0

  return (
    <div className="flex items-stretch gap-0 group/lane">
      {/* Output card side */}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center relative" style={{ background: SIPOC.O.bg }}>
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm(`Remove output "${output.informationProduct.name}"?`)) onRemove() }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center text-[var(--m12-text-faint)] hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover/lane:opacity-100 z-10"
          title="Remove output"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 6.5l5-5M1.5 1.5l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <IPCard
          name={output.informationProduct.name}
          category={output.informationProduct.category}
          dimensions={output.dimensions || []}
          accent={SIPOC.O.color}
        />
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

// ─── SIPOC Flow Content (lane-based layout) ──────────────

function SIPOCFlowContent({ capability }: { capability: HydratedCapability }) {
  const removeInput = useSIPOCStore(s => s.removeInput)
  const removeOutput = useSIPOCStore(s => s.removeOutput)
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
                <InputLane input={input} onRemove={() => removeInput(input.id, capability.id)} />
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
      <div className="w-[220px] shrink-0 flex flex-col border-l border-r border-[var(--m12-border)]/10 overflow-y-auto" style={{ background: SIPOC.P.bg }}>
        <div className="p-3 pb-1 shrink-0 border-b border-[var(--m12-border)]/10">
          <ColumnHeader sipoc={SIPOC.P} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full rounded-xl border border-[#2563EB]/30 bg-gradient-to-b from-[#2563EB]/10 to-[#2563EB]/5 p-4 text-center shadow-lg"
            style={{ boxShadow: '0 0 40px rgba(37,99,235,0.08)' }}
          >
            <div className="text-[8px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-[0.2em] text-[#2563EB]/60 mb-1.5">
              L{capability.level} {capability.level === 1 ? 'Core Area' : capability.level === 2 ? 'Capability' : 'Functionality'}
            </div>
            <div className="text-sm font-bold text-[var(--m12-text)] leading-snug">{capability.name}</div>
            {capability.description && (
              <div className="text-[10px] text-[var(--m12-text-secondary)] leading-snug mt-2">{capability.description}</div>
            )}
            {capability.system && (
              <div className="flex justify-center mt-3">
                <SystemChip system={capability.system} />
              </div>
            )}
          </div>
          <div className="mt-3 text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] uppercase tracking-wider">
            {inputs.length} input{inputs.length !== 1 ? 's' : ''} · {outputs.length} output{outputs.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

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
                <OutputLane output={output} onRemove={() => removeOutput(output.id, capability.id)} />
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

// ─── Main Drawer ─────────────────────────────────────────

export default function SIPOCDrawer({ orgId, editorOpen, onToggleEditor, children }: {
  orgId: string
  editorOpen: boolean
  onToggleEditor: () => void
  children?: React.ReactNode
}) {
  const drawerOpen = useSIPOCStore(s => s.drawerOpen)
  const drawerHeight = useSIPOCStore(s => s.drawerHeight)
  const selectedId = useSIPOCStore(s => s.selectedCapabilityId)
  const capabilities = useSIPOCStore(s => s.capabilities)

  const fullscreen = useSIPOCStore(s => s.drawerFullscreen)

  const [resizing, setResizing] = useState(false)
  const [contentVisible, setContentVisible] = useState(false)
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null)

  // Hydrate the selected capability
  const hydrated = useMemo(() => {
    if (!selectedId) return null
    const all = useSIPOCStore.getState().getHydratedCapabilities()
    return all.find(c => c.id === selectedId) || null
  }, [selectedId, capabilities, useSIPOCStore(s => s.inputs), useSIPOCStore(s => s.outputs)])

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
          {hydrated ? (
            <SIPOCFlowContent capability={hydrated} />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--m12-text-faint)] text-xs">
              Select a capability on the map to view its SIPOC
            </div>
          )}
        </div>

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
