'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Download,
  Sparkles,
  Pencil,
  LayoutTemplate,
  BarChart3,
  Maximize2,
  Minimize2,
  Lock,
  Workflow,
  User,
  Link2,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/common'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { HydratedCapability, CapabilityTemplateRow, Persona, LogicalSystem, InformationProduct, Dimension } from '@/lib/sipoc/types'
import { exportSIPOCPdf, exportSIPOCExcel, exportSIPOCPptx, exportSIPOCHtml } from '@/lib/export/sipoc'
import { createCapabilityTemplate } from '@/lib/supabase/capability-maps'
import { useAuth } from '@/lib/supabase/auth-context'
import AIAnalyzePanel from '@/components/sipoc/AIAnalyzePanel'
import SIPOCTemplatesPanel from '@/components/sipoc/SIPOCTemplatesPanel'
import ArtifactCommentBadge from '@/components/sipoc/ArtifactCommentBadge'
import AnchorPickTarget from '@/components/sipoc/AnchorPickTarget'
import CommentsRail from '@/components/sipoc/CommentsRail'
import CapabilityStatusControl from '@/components/sipoc/CapabilityStatusControl'
import { useLockHolder } from '@/lib/collab/CapabilityMapCollabContext'
import type { SipocRegion } from '@/lib/sipoc/types'

// ─── Comments toolbar toggle ─────────────────────────────
function CommentsToggleButton() {
  const open = useSIPOCStore(s => s.commentsRailOpen)
  const setOpen = useSIPOCStore(s => s.setCommentsRailOpen)
  const comments = useSIPOCStore(s => s.comments)
  const selectedId = useSIPOCStore(s => s.selectedCapabilityId)
  // Count unresolved threads on the currently-open capability
  const unresolved = (() => {
    if (!selectedId) return 0
    const seen = new Set<string>()
    let n = 0
    for (const c of comments) {
      if (c.capability_id !== selectedId) continue
      const k = `${c.region}::${c.item_id || 'none'}`
      if (seen.has(k)) continue
      seen.add(k)
      // find latest in this thread for resolution flag
      const peers = comments.filter(p => p.capability_id === selectedId && p.region === c.region && (p.item_id || null) === (c.item_id || null))
      const latest = peers.reduce((a, b) => a.created_at > b.created_at ? a : b)
      if (!latest.resolved_at) n++
    }
    return n
  })()
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={<MessageSquare size={12} />}
      onClick={() => setOpen(!open)}
      title="Open comments rail"
      className={open ? 'bg-brand-50 text-brand-600 hover:bg-brand-100 hover:text-brand-600' : undefined}
    >
      Comments
      {unresolved > 0 && (
        <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] leading-none">
          {unresolved}
        </span>
      )}
    </Button>
  )
}

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
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white border border-border text-[11px]">
      <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center" style={{ backgroundColor: `${persona.color}20` }}>
        <User size={11} style={{ color: persona.color }} />
      </div>
      <div className="min-w-0">
        <div className="text-text-primary font-medium truncate leading-tight">{persona.name}</div>
        {persona.role && <div className="text-[10px] text-text-tertiary truncate leading-tight">{persona.role}</div>}
      </div>
    </div>
  )
}

function SystemChip({ system, small }: { system: LogicalSystem; small?: boolean }) {
  return (
    <div className={`flex items-center gap-1 rounded border border-border bg-white ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'}`}>
      <div className={`${small ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-sm shrink-0`} style={{ backgroundColor: system.color || '#64748B' }} />
      <span className="text-text-primary font-medium truncate">{system.name}</span>
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
      className={`rounded-lg border border-border bg-white overflow-hidden shadow-card hover:shadow-card-hover transition-shadow ${onClick ? 'cursor-pointer hover:border-border-strong' : ''}`}
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
      onClick={onClick}
    >
      <div className="px-3 py-2">
        <div className="text-body-sm font-semibold text-text-primary leading-tight">{name}</div>
        {category && (
          <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider rounded bg-surface-muted text-text-tertiary">
            {category}
          </span>
        )}
        {tags && tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-0.5">
            {tags.map(t => (
              <span key={t.id} className="inline-flex items-center rounded text-[10px] px-1 py-0 text-white leading-tight" style={{ backgroundColor: t.color }}>
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
      {showDims && dimensions.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {dimensions.map(d => (
            <span key={d.id} className="px-1.5 py-0.5 text-[10px] rounded bg-surface-muted text-text-secondary border border-border">
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

function ColumnHeader({ sipoc, capabilityId }: { sipoc: typeof SIPOC[keyof typeof SIPOC]; capabilityId?: string }) {
  const inner = (
    <div className="flex items-center gap-2 mb-3 px-1">
      <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: sipoc.color }}>
        {sipoc.letter}
      </div>
      <span className="text-label uppercase text-text-secondary">
        {sipoc.label}
      </span>
      {capabilityId && (
        <span className="ml-auto">
          <ArtifactCommentBadge capabilityId={capabilityId} region={sipoc.letter as SipocRegion} />
        </span>
      )}
    </div>
  )
  if (!capabilityId) return inner
  return (
    <AnchorPickTarget capabilityId={capabilityId} region={sipoc.letter as SipocRegion} className="rounded">
      {inner}
    </AnchorPickTarget>
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

function InputLane({ input, onRemove, onClickCard, showDims, capabilityId }: { input: HydratedCapability['inputs'][number]; onRemove: () => void; onClickCard: () => void; showDims?: boolean; capabilityId: string }) {
  const readOnly = useSIPOCStore(s => s.readOnly)
  const inputSources = useSIPOCStore(s => s.inputSources)
  const router = useRouter()
  const source = input.source_output_id ? inputSources[input.source_output_id] : null
  const hasSuppliers = input.supplierPersonas.length > 0
  const hasSystems = input.sourceSystems.length > 0
  const hasLeft = hasSuppliers || hasSystems || !!source

  return (
    <div className="flex items-stretch gap-0 group/lane">
      {/* Supplier side */}
      <AnchorPickTarget capabilityId={capabilityId} region="S" itemId={input.id} className="flex-1 min-w-0 flex">
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center relative" style={{ background: SIPOC.S.bg }}>
        <div className="absolute top-1.5 right-1.5 z-10">
          <ArtifactCommentBadge capabilityId={capabilityId} region="S" itemId={input.id} />
        </div>
        {source && (
          <div className="mb-1.5">
            {readOnly ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] px-2 py-1 max-w-full">
                <Link2 size={11} className="shrink-0" />
                <span className="truncate">{source.capabilityName}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); router.push(`/capability-map/${source.mapId}?cap=${source.capabilityId}`) }}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] px-2 py-1 max-w-full hover:bg-indigo-100 transition-colors"
                title={`Fed by ${source.capabilityName} in ${source.mapTitle}`}
              >
                <Link2 size={11} className="shrink-0" />
                <span className="truncate">{source.capabilityName}</span>
                <ExternalLink size={9} className="shrink-0 opacity-60" />
              </button>
            )}
            <div className="text-[9px] text-text-tertiary uppercase tracking-wider mt-0.5 pl-0.5">upstream process</div>
          </div>
        )}
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
          <div className="text-[10px] italic text-text-tertiary">No suppliers</div>
        )}
      </div>
      </AnchorPickTarget>

      {/* Arrow: suppliers → input */}
      <HFlowArrow color={SIPOC.S.color} />

      {/* Input card side */}
      <AnchorPickTarget capabilityId={capabilityId} region="I" itemId={input.id} className="flex-1 min-w-0 flex">
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center relative" style={{ background: SIPOC.I.bg }}>
        <div className="absolute top-1.5 left-1.5 z-10">
          <ArtifactCommentBadge capabilityId={capabilityId} region="I" itemId={input.id} />
        </div>
        {!readOnly && <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (confirm(`Remove input "${input.informationProduct.name}"?`)) onRemove() }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center text-text-tertiary hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover/lane:opacity-100 z-10"
          title="Remove input"
          aria-label="Remove input"
        >
          <X size={8} />
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
            <span className="text-[10px] text-text-tertiary uppercase">feeds</span>
          </div>
        )}
      </div>
      </AnchorPickTarget>
    </div>
  )
}

// ─── Output lane (Output card → Customers) ───────────────

function OutputLane({ output, onRemove, onClickCard, showDims, capabilityId }: { output: HydratedCapability['outputs'][number]; onRemove: () => void; onClickCard: () => void; showDims?: boolean; capabilityId: string }) {
  const readOnly = useSIPOCStore(s => s.readOnly)
  const outputDownstream = useSIPOCStore(s => s.outputDownstream)
  const router = useRouter()
  const downstream = outputDownstream[output.id] || []
  const hasConsumers = output.consumerPersonas.length > 0
  const hasSystems = output.destinationSystems.length > 0

  return (
    <div className="flex items-stretch gap-0 group/lane">
      {/* Output card side */}
      <AnchorPickTarget capabilityId={capabilityId} region="O" itemId={output.id} className="flex-1 min-w-0 flex">
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center relative" style={{ background: SIPOC.O.bg }}>
        <div className="absolute top-1.5 left-1.5 z-10">
          <ArtifactCommentBadge capabilityId={capabilityId} region="O" itemId={output.id} />
        </div>
        {!readOnly && <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (confirm(`Remove output "${output.informationProduct.name}"?`)) onRemove() }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center text-text-tertiary hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover/lane:opacity-100 z-10"
          title="Remove output"
          aria-label="Remove output"
        >
          <X size={8} />
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
            <span className="text-[10px] text-text-tertiary uppercase mr-0.5">available in</span>
            {output.destinationSystems.map((sys, si) => (
              <div key={sys.id} className="flex items-center gap-0.5">
                {si > 0 && <MiniLineageArrow />}
                <SystemChip system={sys} small />
              </div>
            ))}
          </div>
        )}
        {/* Feeds → downstream processes (this output linked as their input) */}
        {downstream.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mt-1.5 pl-1">
            <ArrowRight size={10} className="text-emerald-600 shrink-0" />
            <span className="text-[10px] text-text-tertiary uppercase mr-0.5">feeds</span>
            {downstream.map(d => readOnly ? (
              <span key={d.inputId} className="inline-flex items-center rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] px-1.5 py-0.5 max-w-[130px] truncate" title={`Feeds ${d.capabilityName} in ${d.mapTitle}`}>
                {d.capabilityName}
              </span>
            ) : (
              <button
                key={d.inputId}
                type="button"
                onClick={(e) => { e.stopPropagation(); router.push(`/capability-map/${d.mapId}?cap=${d.capabilityId}`) }}
                className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] px-1.5 py-0.5 max-w-[140px] hover:bg-emerald-100 transition-colors"
                title={`Feeds ${d.capabilityName} in ${d.mapTitle}`}
              >
                <span className="truncate">{d.capabilityName}</span>
                <ExternalLink size={9} className="shrink-0 opacity-60" />
              </button>
            ))}
          </div>
        )}
      </div>
      </AnchorPickTarget>

      {/* Arrow: output → customers */}
      <HFlowArrow color={SIPOC.O.color} />

      {/* Customer side */}
      <AnchorPickTarget capabilityId={capabilityId} region="C" itemId={output.id} className="flex-1 min-w-0 flex">
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center relative" style={{ background: SIPOC.C.bg }}>
        <div className="absolute top-1.5 right-1.5 z-10">
          <ArtifactCommentBadge capabilityId={capabilityId} region="C" itemId={output.id} />
        </div>
        {hasConsumers ? (
          <div className="space-y-1">
            {output.consumerPersonas.map(p => (
              <PersonaChip key={p.id} persona={p} />
            ))}
          </div>
        ) : (
          <div className="text-[10px] italic text-text-tertiary">No consumers</div>
        )}
      </div>
      </AnchorPickTarget>
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
    <div className="w-[220px] shrink-0 flex flex-col border-l border-r border-border/60 overflow-y-auto" style={{ background: SIPOC.P.bg }}>
      <div className="p-3 pb-1 shrink-0 border-b border-border/60">
        <ColumnHeader sipoc={SIPOC.P} capabilityId={capability.id} />
      </div>
      <div className="flex-1 flex flex-col items-center p-4 gap-3">
        {/* Process box — compact */}
        <div className="w-full rounded-xl border border-brand-500/30 bg-gradient-to-b from-brand-500/10 to-brand-500/5 p-4 text-center"
          style={{ boxShadow: '0 0 40px rgba(37,99,235,0.08)' }}
        >
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-600/70 mb-1.5">
            L{capability.level} {capability.level === 1 ? 'Core Area' : capability.level === 2 ? 'Capability' : 'Functionality'}
          </div>
          <div className="text-body-md font-semibold text-text-primary leading-snug">{capability.name}</div>
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
              type="button"
              onClick={() => setFeaturesExpanded(e => !e)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 hover:border-brand-300 transition-colors group"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                {features.length} Feature{features.length !== 1 ? 's' : ''}
              </span>
              <ChevronDown size={10} className={`text-brand-400 transition-transform ${featuresExpanded ? 'rotate-180' : ''}`} />
            </button>
            {featuresExpanded && (
              <div className="mt-1.5 px-1 space-y-1 max-h-[300px] overflow-y-auto">
                {features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-text-secondary leading-snug">
                    <span className="text-brand-300 mt-px shrink-0">•</span>
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
              type="button"
              onClick={() => setUseCasesExpanded(e => !e)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 hover:border-brand-300 transition-colors group"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                {useCases.length} Use Case{useCases.length !== 1 ? 's' : ''}
              </span>
              <ChevronDown size={10} className={`text-brand-400 transition-transform ${useCasesExpanded ? 'rotate-180' : ''}`} />
            </button>
            {useCasesExpanded && (
              <div className="mt-1.5 px-1 space-y-1 max-h-[300px] overflow-y-auto">
                {useCases.map((uc, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-text-secondary leading-snug">
                    <span className="text-brand-300 mt-px shrink-0">•</span>
                    <span>{uc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="text-[10px] text-text-tertiary uppercase tracking-wider">
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
        <div className="flex shrink-0 border-b border-border/60">
          <div className="flex-1 p-3 pb-1" style={{ background: SIPOC.S.bg }}>
            <ColumnHeader sipoc={SIPOC.S} capabilityId={capability.id} />
          </div>
          <div className="w-6" />
          <div className="flex-1 p-3 pb-1" style={{ background: SIPOC.I.bg }}>
            <ColumnHeader sipoc={SIPOC.I} capabilityId={capability.id} />
          </div>
        </div>
        {/* Input lanes */}
        {inputs.length > 0 ? (
          <div className="flex-1">
            {inputs.map((input, i) => (
              <div key={input.id} className={i > 0 ? 'border-t border-border/40' : ''}>
                <InputLane input={input} onRemove={() => removeInput(input.id, capability.id)} onClickCard={() => handleClickItem(input.id)} showDims={showDims} capabilityId={capability.id} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[11px] italic text-text-tertiary py-8">
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
        <div className="flex shrink-0 border-b border-border/60">
          <div className="flex-1 p-3 pb-1" style={{ background: SIPOC.O.bg }}>
            <ColumnHeader sipoc={SIPOC.O} capabilityId={capability.id} />
          </div>
          <div className="w-6" />
          <div className="flex-1 p-3 pb-1" style={{ background: SIPOC.C.bg }}>
            <ColumnHeader sipoc={SIPOC.C} capabilityId={capability.id} />
          </div>
        </div>
        {/* Output lanes */}
        {outputs.length > 0 ? (
          <div className="flex-1">
            {outputs.map((output, i) => (
              <div key={output.id} className={i > 0 ? 'border-t border-border/40' : ''}>
                <OutputLane output={output} onRemove={() => removeOutput(output.id, capability.id)} onClickCard={() => handleClickItem(output.id)} showDims={showDims} capabilityId={capability.id} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[11px] italic text-text-tertiary py-8">
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
      <Button
        variant="ghost"
        size="sm"
        icon={<Download size={12} />}
        onClick={() => setOpen(o => !o)}
        className={open ? 'bg-surface-muted text-text-primary' : undefined}
      >
        Export
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white border border-border rounded-lg shadow-dropdown py-1 animate-slide-in-up overflow-hidden">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-text-tertiary border-b border-border truncate">
            {capName}
          </div>
          {[
            { label: 'PDF', fn: () => exportSIPOCPdf(capName, exportCaps) },
            { label: 'Excel', fn: () => { const s = useSIPOCStore.getState(); exportSIPOCExcel(capName, exportCaps, s.personas, s.informationProducts, s.logicalSystems, s.workstreams) } },
            { label: 'PowerPoint', fn: () => exportSIPOCPptx(capName, exportCaps) },
            { label: 'HTML', fn: () => exportSIPOCHtml(capName, exportCaps) },
          ].map(({ label, fn }) => (
            <button
              key={label}
              type="button"
              onClick={() => { setOpen(false); fn() }}
              className="w-full text-left px-3 py-2 text-body-sm text-text-secondary hover:bg-surface-muted transition-colors"
            >
              Export as {label}
            </button>
          ))}
          <div className="border-t border-border" />
          <button
            type="button"
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
            className="w-full text-left px-3 py-2 text-body-sm text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save as Template'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Drawer ─────────────────────────────────────────

export default function SIPOCDrawer({ orgId, editorOpen, onToggleEditor, onShowAI, onPushToDiagram, pushingToDiagram, mapTitle, children }: {
  orgId: string
  editorOpen: boolean
  onToggleEditor: () => void
  onShowAI: (prompt?: string) => void
  onPushToDiagram?: () => void
  pushingToDiagram?: boolean
  mapTitle: string
  children?: React.ReactNode
}) {
  const drawerOpen = useSIPOCStore(s => s.drawerOpen)
  const drawerHeight = useSIPOCStore(s => s.drawerHeight)
  const storeReadOnly = useSIPOCStore(s => s.readOnly)
  const selectedId = useSIPOCStore(s => s.selectedCapabilityId)
  const capabilities = useSIPOCStore(s => s.capabilities)
  const lockedBy = useLockHolder(selectedId)
  const readOnly = storeReadOnly || !!lockedBy

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
      className="shrink-0 flex flex-col bg-white border-t border-border overflow-hidden"
      style={{
        height: drawerOpen ? (fullscreen ? 'calc(100vh - 48px)' : drawerHeight) : 0,
        transition: resizing ? 'none' : 'height 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: drawerOpen ? '0 -8px 32px 0px rgba(0,0,0,0.2)' : 'none',
      }}
    >
      {/* Drag handle */}
      <div
        className="flex items-center justify-center h-2 cursor-row-resize shrink-0 hover:bg-surface-muted transition-colors group"
        onMouseDown={handleResizeStart}
        onDoubleClick={() => {
          useSIPOCStore.setState({ drawerHeight: drawerHeight < 500 ? window.innerHeight * 0.65 : 420 })
        }}
      >
        <div className="w-10 h-1 rounded-full bg-border group-hover:bg-border-strong transition-colors" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {breadcrumb.map((crumb, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={10} className="text-text-tertiary/60 shrink-0" />}
              {i === 0 && crumb.color && (
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: crumb.color }} />
              )}
              <span className={`text-[11px] truncate ${
                i === breadcrumb.length - 1
                  ? 'font-semibold text-text-primary'
                  : 'text-text-tertiary'
              }`}>
                {crumb.name}
              </span>
            </div>
          ))}
        </div>

        {/* Review status (L3 only) */}
        {hydrated && hydrated.level === 3 && (
          <CapabilityStatusControl
            capabilityId={hydrated.id}
            status={hydrated.status}
            readOnly={readOnly}
          />
        )}

        {/* SIPOC legend dots */}
        <div className="flex items-center gap-1">
          {Object.values(SIPOC).map(s => (
            <div key={s.letter} className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: s.color }}>
              {s.letter}
            </div>
          ))}
        </div>

        {/* Sibling navigation */}
        <div className="flex items-center gap-0.5 ml-2">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={<ChevronLeft size={12} />}
            aria-label="Previous capability"
            onClick={() => navigateSibling(-1)}
            disabled={currentSibIdx <= 0}
            className="h-6 w-6"
          />
          <span className="text-[10px] font-mono text-text-tertiary min-w-[30px] text-center">
            {currentSibIdx + 1}/{siblings.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={<ChevronRight size={12} />}
            aria-label="Next capability"
            onClick={() => navigateSibling(1)}
            disabled={currentSibIdx >= siblings.length - 1}
            className="h-6 w-6"
          />
        </div>

        {/* Dims toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDims(d => !d)}
          className={showDims ? 'bg-surface-muted text-text-primary' : undefined}
        >
          Dims
        </Button>

        {/* Export dropdown */}
        <ExportMenu hydrated={hydrated} mapTitle={mapTitle} orgId={orgId} />

        {/* Push L3 SIPOC into a new data architecture diagram */}
        {onPushToDiagram && hydrated && !isRollupView && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Workflow size={12} />}
            onClick={onPushToDiagram}
            loading={!!pushingToDiagram}
            title="Push this L3 SIPOC into a new data architecture diagram as a Group"
            className="hover:text-brand-600 hover:bg-brand-50"
          >
            {pushingToDiagram ? 'Pushing...' : 'To Diagram'}
          </Button>
        )}

        {/* Comments */}
        <CommentsToggleButton />

        {!readOnly && <>
        {/* Templates */}
        <Button
          variant="ghost"
          size="sm"
          icon={<LayoutTemplate size={12} />}
          onClick={() => { setShowTemplates(t => !t); if (!showTemplates) setShowAnalysis(false) }}
          className={showTemplates ? 'bg-orange-50 text-orange-600 hover:bg-orange-50 hover:text-orange-600' : undefined}
        >
          Templates
        </Button>

        {/* Analyze */}
        <Button
          variant="ai"
          size="sm"
          icon={<BarChart3 size={12} />}
          onClick={() => { setShowAnalysis(a => !a); if (!showAnalysis) setShowTemplates(false) }}
          className={showAnalysis ? 'bg-blue-100' : undefined}
        >
          Analyze
        </Button>

        {/* AI Generate */}
        <Button
          variant="ai"
          size="sm"
          icon={<Sparkles size={12} />}
          onClick={() => onShowAI()}
        >
          Generate
        </Button>

        {/* Edit toggle */}
        <Button
          variant="ghost"
          size="sm"
          icon={<Pencil size={12} />}
          onClick={onToggleEditor}
          className={editorOpen ? 'bg-brand-50 text-brand-600 hover:bg-brand-100 hover:text-brand-600' : undefined}
        >
          Edit
        </Button>
        </>}

        {/* Fullscreen toggle */}
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={() => useSIPOCStore.setState({ drawerFullscreen: !fullscreen })}
          className={fullscreen ? 'bg-brand-50 text-brand-600 hover:bg-brand-100 hover:text-brand-600' : undefined}
        />

        {/* Close */}
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={<X size={14} />}
          aria-label="Close"
          onClick={close}
        />
      </div>

      {/* Lock banner — another collaborator is editing this L3 */}
      {lockedBy && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-amber-50 border-b border-amber-200">
          <Lock size={12} className="text-amber-600 shrink-0" />
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: lockedBy.color }}
          />
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-700">
            Currently editing: {lockedBy.name} · view-only
          </span>
        </div>
      )}

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
              {isRollupView && (() => {
                const subCount = capabilities.filter(c => c.parent_id === hydrated.id).length
                return (
                  <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-purple-50 border-b border-purple-200 text-[11px] font-medium uppercase tracking-wider text-purple-700">
                    <Check size={12} className="shrink-0" />
                    Rollup view · aggregated from {subCount} sub-capabilit{subCount === 1 ? 'y' : 'ies'} (read-only)
                  </div>
                )
              })()}
              <div className="flex-1 overflow-hidden">
                <SIPOCFlowContent capability={hydrated} onOpenEditor={() => { if (!editorOpen) onToggleEditor() }} showDims={showDims} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-body-sm text-text-tertiary">
              Select a capability on the map to view its SIPOC
            </div>
          )}
        </div>

        {/* Editor toggle tab */}
        <button
          type="button"
          onClick={onToggleEditor}
          className="shrink-0 w-5 flex items-center justify-center border-l border-border hover:bg-surface-muted transition-colors cursor-pointer group"
          title={editorOpen ? 'Hide editor' : 'Show editor'}
        >
          <ChevronRight size={12} className={`text-text-secondary group-hover:text-text-primary transition-all ${editorOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Editor panel (slides in from right) */}
        <div
          className="shrink-0 border-l border-border overflow-hidden"
          style={{
            width: editorOpen ? 380 : 0,
            transition: 'width 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {children}
        </div>
      </div>
      <CommentsRail />
    </div>
  )
}
