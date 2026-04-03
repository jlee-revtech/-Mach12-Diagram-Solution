'use client'

import { useState, useCallback, useRef } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { HydratedCapability } from '@/lib/sipoc/types'

interface CapOverview {
  name: string
  system: string | null
  oneLiner: string
  inputCount: number
  outputCount: number
  keyInputs: string[]
  keyOutputs: string[]
  criticalSystems: string[]
  riskLevel: 'low' | 'medium' | 'high'
  riskNote: string | null
}

interface SystemDep {
  system: string
  role: string
  capabilitiesServed: number
  criticality: 'high' | 'medium' | 'low'
}

interface PersonaEntry {
  persona: string
  involvement: 'supplier' | 'consumer' | 'both'
  capabilitiesInvolved: number
  keyContribution: string
}

interface Recommendation {
  priority: number
  title: string
  description: string
  impact: string
}

interface SummaryResult {
  headline: string
  executiveSummary: string
  capabilityOverviews: CapOverview[]
  dataLandscape: {
    totalInformationProducts: number
    totalDimensions: number
    categoryCounts: Record<string, number>
    topCategories: string[]
  }
  systemDependencies: SystemDep[]
  personaMap: PersonaEntry[]
  strategicInsights: string[]
  recommendations: Recommendation[]
}

const RISK_STYLES = {
  low: { bg: 'bg-[#10B981]/10', border: 'border-[#10B981]/30', text: 'text-[#10B981]', label: 'LOW RISK' },
  medium: { bg: 'bg-[#EAB308]/10', border: 'border-[#EAB308]/30', text: 'text-[#EAB308]', label: 'MEDIUM RISK' },
  high: { bg: 'bg-[#EF4444]/10', border: 'border-[#EF4444]/30', text: 'text-[#EF4444]', label: 'HIGH RISK' },
}

const CRIT_STYLES = {
  high: { dot: 'bg-[#EF4444]', text: 'text-[#EF4444]' },
  medium: { dot: 'bg-[#EAB308]', text: 'text-[#EAB308]' },
  low: { dot: 'bg-[#10B981]', text: 'text-[#10B981]' },
}

// ─── SVG Flow Diagram ───────────────────────────────────

const SVG_COLORS = {
  bg: '#151E2E',
  cardBg: '#1F2C3F',
  border: '#374A5E',
  text: '#F8FAFC',
  textSec: '#CBD5E1',
  muted: '#64748B',
  blue: '#2563EB',
  orange: '#F97316',
  yellow: '#EAB308',
  green: '#10B981',
  violet: '#8B5CF6',
  cyan: '#06B6D4',
}

function buildDiagramData(capabilities: HydratedCapability[]) {
  // Group inputs by category
  const inputGroups = new Map<string, { products: Set<string>; caps: Set<string> }>()
  const outputGroups = new Map<string, { products: Set<string>; caps: Set<string> }>()

  capabilities.forEach(cap => {
    cap.inputs.forEach(inp => {
      const cat = inp.informationProduct.category || 'Other'
      if (!inputGroups.has(cat)) inputGroups.set(cat, { products: new Set(), caps: new Set() })
      inputGroups.get(cat)!.products.add(inp.informationProduct.name)
      inputGroups.get(cat)!.caps.add(cap.name)
    })
    cap.outputs.forEach(out => {
      const cat = out.informationProduct.category || 'Other'
      if (!outputGroups.has(cat)) outputGroups.set(cat, { products: new Set(), caps: new Set() })
      outputGroups.get(cat)!.products.add(out.informationProduct.name)
      outputGroups.get(cat)!.caps.add(cap.name)
    })
  })

  return {
    inputGroups: [...inputGroups.entries()]
      .map(([cat, data]) => ({ category: cat, count: data.products.size, caps: [...data.caps] }))
      .sort((a, b) => b.count - a.count),
    outputGroups: [...outputGroups.entries()]
      .map(([cat, data]) => ({ category: cat, count: data.products.size, caps: [...data.caps] }))
      .sort((a, b) => b.count - a.count),
    capabilities: capabilities.map(cap => ({
      name: cap.name,
      system: cap.system?.name || null,
      inputCount: cap.inputs.length,
      outputCount: cap.outputs.length,
    })),
  }
}

function SIPOCFlowDiagram({ mapTitle }: { mapTitle: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const capabilities = useSIPOCStore(s => s.getHydratedCapabilities)
  const hydrated = useSIPOCStore.getState().getHydratedCapabilities()
  const data = buildDiagramData(hydrated)

  const W = 1280
  const H = Math.max(520, data.capabilities.length * 72 + 180, data.inputGroups.length * 68 + 180, data.outputGroups.length * 68 + 180)

  // Layout columns
  const inputColX = 40
  const inputColW = 260
  const capColX = 440
  const capColW = 360
  const outputColX = 940
  const outputColW = 260
  const headerY = 60
  const startY = 120

  // Card dimensions
  const cardH = 52
  const groupCardH = 48
  const gap = 14

  const handleDownload = () => {
    if (!svgRef.current) return
    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mapTitle.replace(/[^a-zA-Z0-9]/g, '_')}_SIPOC_Summary.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[9px] uppercase tracking-[0.2em] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold">Information Flow Diagram</div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 text-[10px] text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] border border-[var(--m12-border)]/30 rounded-lg px-2.5 py-1 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v5.5M2.5 4.5L5 7l2.5-2.5M1.5 8.5h7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download SVG
        </button>
      </div>
      <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/30 rounded-xl overflow-hidden overflow-x-auto">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" className="w-full" style={{ minWidth: 900 }}>
          <defs>
            <marker id="arrow-right" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0 0L8 3L0 6" fill={SVG_COLORS.border} />
            </marker>
            <filter id="card-shadow">
              <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Background */}
          <rect width={W} height={H} fill={SVG_COLORS.bg} />

          {/* Title */}
          <text x={W / 2} y={30} textAnchor="middle" fill={SVG_COLORS.muted} fontSize="10" fontFamily="monospace" letterSpacing="3" fontWeight="bold">
            {mapTitle.toUpperCase()}
          </text>

          {/* Column headers */}
          {/* Inputs header */}
          <rect x={inputColX + inputColW / 2 - 14} y={headerY - 6} width={28} height={28} rx={6} fill={SVG_COLORS.yellow} />
          <text x={inputColX + inputColW / 2} y={headerY + 13} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="Arial">I</text>
          <text x={inputColX + inputColW / 2} y={headerY + 34} textAnchor="middle" fill={SVG_COLORS.muted} fontSize="8" fontFamily="monospace" letterSpacing="2" fontWeight="bold">INPUTS</text>

          {/* Process header */}
          <rect x={capColX + capColW / 2 - 14} y={headerY - 6} width={28} height={28} rx={6} fill={SVG_COLORS.blue} />
          <text x={capColX + capColW / 2} y={headerY + 13} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="Arial">P</text>
          <text x={capColX + capColW / 2} y={headerY + 34} textAnchor="middle" fill={SVG_COLORS.muted} fontSize="8" fontFamily="monospace" letterSpacing="2" fontWeight="bold">PROCESS</text>

          {/* Outputs header */}
          <rect x={outputColX + outputColW / 2 - 14} y={headerY - 6} width={28} height={28} rx={6} fill={SVG_COLORS.green} />
          <text x={outputColX + outputColW / 2} y={headerY + 13} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="Arial">O</text>
          <text x={outputColX + outputColW / 2} y={headerY + 34} textAnchor="middle" fill={SVG_COLORS.muted} fontSize="8" fontFamily="monospace" letterSpacing="2" fontWeight="bold">OUTPUTS</text>

          {/* ── Input category groups ────────────────────── */}
          {data.inputGroups.map((grp, i) => {
            const y = startY + i * (groupCardH + gap)
            const midY = y + groupCardH / 2
            return (
              <g key={`ig-${i}`}>
                <rect x={inputColX} y={y} width={inputColW} height={groupCardH} rx={8} fill={SVG_COLORS.cardBg} stroke={SVG_COLORS.border} strokeWidth={0.5} filter="url(#card-shadow)" />
                <rect x={inputColX} y={y + 6} width={3} height={groupCardH - 12} rx={1.5} fill={SVG_COLORS.yellow} />
                <text x={inputColX + 14} y={y + 20} fill={SVG_COLORS.text} fontSize="11" fontWeight="bold" fontFamily="Arial">{grp.category}</text>
                <text x={inputColX + 14} y={y + 34} fill={SVG_COLORS.muted} fontSize="8" fontFamily="monospace">
                  {grp.count} info product{grp.count !== 1 ? 's' : ''}
                </text>
                <text x={inputColX + inputColW - 12} y={y + 27} textAnchor="end" fill={SVG_COLORS.yellow} fontSize="16" fontWeight="bold" fontFamily="Arial">{grp.count}</text>
                {/* Connection lines to capabilities */}
                {grp.caps.map((capName, ci) => {
                  const capIdx = data.capabilities.findIndex(c => c.name === capName)
                  if (capIdx < 0) return null
                  const capY = startY + capIdx * (cardH + gap) + cardH / 2
                  return (
                    <path
                      key={`il-${ci}`}
                      d={`M${inputColX + inputColW} ${midY} C${inputColX + inputColW + 60} ${midY} ${capColX - 60} ${capY} ${capColX} ${capY}`}
                      fill="none"
                      stroke={SVG_COLORS.yellow}
                      strokeWidth={1}
                      strokeOpacity={0.25}
                      markerEnd="url(#arrow-right)"
                    />
                  )
                })}
              </g>
            )
          })}

          {/* ── Capability cards (center) ────────────────── */}
          {data.capabilities.map((cap, i) => {
            const y = startY + i * (cardH + gap)
            return (
              <g key={`cap-${i}`}>
                <rect x={capColX} y={y} width={capColW} height={cardH} rx={10} fill="#1A3A6B" stroke={SVG_COLORS.blue} strokeWidth={1.5} filter="url(#card-shadow)" />
                <text x={capColX + capColW / 2} y={y + 22} textAnchor="middle" fill={SVG_COLORS.text} fontSize="12" fontWeight="bold" fontFamily="Arial">{cap.name}</text>
                {cap.system && (
                  <text x={capColX + capColW / 2} y={y + 36} textAnchor="middle" fill={SVG_COLORS.muted} fontSize="8" fontFamily="monospace">{cap.system}</text>
                )}
                {!cap.system && (
                  <text x={capColX + capColW / 2} y={y + 36} textAnchor="middle" fill={SVG_COLORS.muted} fontSize="7" fontFamily="monospace" letterSpacing="1.5">L3 CAPABILITY</text>
                )}
                {/* Input/output count badges */}
                <rect x={capColX + 8} y={y + cardH - 18} width={32} height={14} rx={3} fill={SVG_COLORS.yellow} fillOpacity={0.15} />
                <text x={capColX + 24} y={y + cardH - 8} textAnchor="middle" fill={SVG_COLORS.yellow} fontSize="7" fontFamily="monospace" fontWeight="bold">{cap.inputCount}in</text>
                <rect x={capColX + capColW - 40} y={y + cardH - 18} width={32} height={14} rx={3} fill={SVG_COLORS.green} fillOpacity={0.15} />
                <text x={capColX + capColW - 24} y={y + cardH - 8} textAnchor="middle" fill={SVG_COLORS.green} fontSize="7" fontFamily="monospace" fontWeight="bold">{cap.outputCount}out</text>
              </g>
            )
          })}

          {/* ── Output category groups ───────────────────── */}
          {data.outputGroups.map((grp, i) => {
            const y = startY + i * (groupCardH + gap)
            const midY = y + groupCardH / 2
            return (
              <g key={`og-${i}`}>
                <rect x={outputColX} y={y} width={outputColW} height={groupCardH} rx={8} fill={SVG_COLORS.cardBg} stroke={SVG_COLORS.border} strokeWidth={0.5} filter="url(#card-shadow)" />
                <rect x={outputColX} y={y + 6} width={3} height={groupCardH - 12} rx={1.5} fill={SVG_COLORS.green} />
                <text x={outputColX + 14} y={y + 20} fill={SVG_COLORS.text} fontSize="11" fontWeight="bold" fontFamily="Arial">{grp.category}</text>
                <text x={outputColX + 14} y={y + 34} fill={SVG_COLORS.muted} fontSize="8" fontFamily="monospace">
                  {grp.count} info product{grp.count !== 1 ? 's' : ''}
                </text>
                <text x={outputColX + outputColW - 12} y={y + 27} textAnchor="end" fill={SVG_COLORS.green} fontSize="16" fontWeight="bold" fontFamily="Arial">{grp.count}</text>
                {/* Connection lines from capabilities */}
                {grp.caps.map((capName, ci) => {
                  const capIdx = data.capabilities.findIndex(c => c.name === capName)
                  if (capIdx < 0) return null
                  const capY = startY + capIdx * (cardH + gap) + cardH / 2
                  return (
                    <path
                      key={`ol-${ci}`}
                      d={`M${capColX + capColW} ${capY} C${capColX + capColW + 60} ${capY} ${outputColX - 60} ${midY} ${outputColX} ${midY}`}
                      fill="none"
                      stroke={SVG_COLORS.green}
                      strokeWidth={1}
                      strokeOpacity={0.25}
                      markerEnd="url(#arrow-right)"
                    />
                  )
                })}
              </g>
            )
          })}

          {/* Footer branding */}
          <text x={W / 2} y={H - 15} textAnchor="middle" fill={SVG_COLORS.border} fontSize="7" fontFamily="monospace">
            MACH12.AI | {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </text>
        </svg>
      </div>
    </div>
  )
}

// ─── Stat Card ──────────────────────────────────────────
function Stat({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/30 rounded-xl p-4 flex flex-col items-center justify-center text-center">
      <div className="text-3xl font-bold font-[family-name:var(--font-orbitron)]" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold mt-1">{label}</div>
    </div>
  )
}

export default function ExecutiveSummary({ onClose }: { onClose: () => void }) {
  const map = useSIPOCStore(s => s.map)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SummaryResult | null>(null)

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)

    const capabilities = useSIPOCStore.getState().getHydratedCapabilities()
    const logicalSystems = useSIPOCStore.getState().logicalSystems

    const context = {
      mapTitle: map?.title || 'Untitled',
      capabilities: capabilities.map(cap => ({
        name: cap.name,
        description: cap.description,
        system: cap.system?.name || null,
        inputs: cap.inputs.map(inp => ({
          informationProduct: inp.informationProduct.name,
          category: inp.informationProduct.category,
          supplierPersonas: inp.supplierPersonas.map(p => p.name),
          sourceSystems: inp.sourceSystems.map(s => s.name),
          feedingSystem: inp.feeding_system_id ? logicalSystems.find(s => s.id === inp.feeding_system_id)?.name : undefined,
          dimensions: (inp.dimensions || []).map(d => d.name),
        })),
        outputs: cap.outputs.map(out => ({
          informationProduct: out.informationProduct.name,
          category: out.informationProduct.category,
          consumerPersonas: out.consumerPersonas.map(p => p.name),
          dimensions: (out.dimensions || []).map(d => d.name),
        })),
      })),
    }

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sipoc-executive-summary', context }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to generate summary')
      }
      setResult(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [map])

  return (
    <div className="fixed inset-0 z-50 bg-[var(--m12-bg)] overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[var(--m12-bg)]/95 backdrop-blur-sm border-b border-[var(--m12-border)]/30">
        <div className="max-w-6xl mx-auto px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gradient text-sm font-bold font-[family-name:var(--font-orbitron)] tracking-wide">MACH12</span>
            <span className="text-[var(--m12-text-muted)] text-xs">/</span>
            <span className="text-xs text-[var(--m12-text-secondary)]">Executive Summary</span>
          </div>
          <div className="flex items-center gap-3">
            {result && (
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors"
              >
                Regenerate
              </button>
            )}
            <button onClick={onClose} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Pre-generate state */}
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#2563EB] flex items-center justify-center shadow-xl shadow-[#2563EB]/20">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 3L17 10L24 11.5L19 17L20.5 24L14 21L7.5 24L9 17L4 11.5L11 10L14 3Z" fill="white" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-[var(--m12-text)] mb-2">Generate Executive Summary</h2>
              <p className="text-sm text-[var(--m12-text-muted)] max-w-md">
                AI will analyze your entire capability map and produce a board-ready executive overview with strategic insights, risk assessment, and recommendations.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 bg-gradient-to-r from-[#8B5CF6] to-[#2563EB] hover:from-[#7C3AED] hover:to-[#3B82F6] text-white px-8 py-3 rounded-xl text-sm font-medium transition-all shadow-lg shadow-[#2563EB]/20"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L8.5 4.5L12 5.5L9.5 8L10 11.5L7 10L4 11.5L4.5 8L2 5.5L5.5 4.5L7 1Z" fill="white" />
              </svg>
              Generate Summary
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <svg className="animate-spin w-12 h-12 text-[#2563EB]" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
            </svg>
            <span className="text-sm text-[var(--m12-text-muted)]">Generating executive summary...</span>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 mb-6">{error}</div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-10">
            {/* ── Hero section ────────────────────────────── */}
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] font-[family-name:var(--font-space-mono)] text-[#2563EB] font-bold mb-3">{map?.title}</div>
              <h1 className="text-2xl font-bold text-[var(--m12-text)] mb-4 leading-tight">{result.headline}</h1>
              <div className="text-sm text-[var(--m12-text-secondary)] leading-relaxed whitespace-pre-line max-w-4xl">{result.executiveSummary}</div>
            </div>

            {/* ── Data Landscape stats ────────────────────── */}
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold mb-4">Data Landscape</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat value={result.capabilityOverviews.length} label="Capabilities" color="#2563EB" />
                <Stat value={result.dataLandscape.totalInformationProducts} label="Information Products" color="#EAB308" />
                <Stat value={result.dataLandscape.totalDimensions} label="Data Dimensions" color="#10B981" />
                <Stat value={result.systemDependencies.length} label="System Dependencies" color="#8B5CF6" />
              </div>
              {/* Category breakdown */}
              {result.dataLandscape.topCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {Object.entries(result.dataLandscape.categoryCounts || {}).map(([cat, count]) => (
                    <div key={cat} className="flex items-center gap-1.5 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/30 rounded-full px-3 py-1">
                      <span className="text-[10px] font-medium text-[var(--m12-text-secondary)]">{cat}</span>
                      <span className="text-[9px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── SVG Flow Diagram ────────────────────────── */}
            <SIPOCFlowDiagram mapTitle={map?.title || 'SIPOC'} />

            {/* ── Capability Overview cards ───────────────── */}
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold mb-4">Capability Overview</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {result.capabilityOverviews.map((cap, i) => {
                  const risk = RISK_STYLES[cap.riskLevel]
                  return (
                    <div key={i} className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/30 rounded-xl overflow-hidden">
                      {/* Header */}
                      <div className="px-5 py-4 border-b border-[var(--m12-border)]/20">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-[var(--m12-text)]">{cap.name}</div>
                            {cap.system && (
                              <div className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] mt-0.5">{cap.system}</div>
                            )}
                          </div>
                          <span className={`text-[7px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider px-2 py-1 rounded ${risk.bg} ${risk.border} ${risk.text} border shrink-0`}>
                            {risk.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--m12-text-secondary)] mt-2 leading-relaxed">{cap.oneLiner}</div>
                      </div>
                      {/* Body */}
                      <div className="px-5 py-3 grid grid-cols-2 gap-4">
                        {/* Inputs */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" />
                            <span className="text-[8px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold">
                              Inputs ({cap.inputCount})
                            </span>
                          </div>
                          {cap.keyInputs.map((inp, j) => (
                            <div key={j} className="text-[10px] text-[var(--m12-text-secondary)] py-0.5 flex items-start gap-1">
                              <span className="text-[var(--m12-text-faint)] mt-0.5">-</span>
                              <span>{inp}</span>
                            </div>
                          ))}
                        </div>
                        {/* Outputs */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                            <span className="text-[8px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold">
                              Outputs ({cap.outputCount})
                            </span>
                          </div>
                          {cap.keyOutputs.map((out, j) => (
                            <div key={j} className="text-[10px] text-[var(--m12-text-secondary)] py-0.5 flex items-start gap-1">
                              <span className="text-[var(--m12-text-faint)] mt-0.5">-</span>
                              <span>{out}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Systems footer */}
                      {cap.criticalSystems.length > 0 && (
                        <div className="px-5 py-2.5 bg-[var(--m12-bg)]/50 border-t border-[var(--m12-border)]/15 flex items-center gap-2 flex-wrap">
                          <span className="text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] uppercase tracking-wider">Systems:</span>
                          {cap.criticalSystems.map((sys, j) => (
                            <span key={j} className="text-[9px] text-[var(--m12-text-muted)] bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/20 rounded px-1.5 py-0.5 font-[family-name:var(--font-space-mono)]">{sys}</span>
                          ))}
                        </div>
                      )}
                      {/* Risk note */}
                      {cap.riskNote && (
                        <div className={`px-5 py-2 ${risk.bg} border-t ${risk.border} flex items-start gap-2`}>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`${risk.text} mt-0.5 shrink-0`}>
                            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1" />
                            <path d="M5 3v2.5M5 7v.01" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                          </svg>
                          <span className={`text-[9px] ${risk.text}`}>{cap.riskNote}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── System Dependencies ────────────────────── */}
            {result.systemDependencies.length > 0 && (
              <div>
                <div className="text-[9px] uppercase tracking-[0.2em] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold mb-4">System Dependencies</div>
                <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/30 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-6 gap-y-0 px-5 py-2.5 border-b border-[var(--m12-border)]/20 text-[8px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold">
                    <span>System</span><span>Role</span><span>Capabilities</span><span>Criticality</span>
                  </div>
                  {result.systemDependencies.map((dep, i) => {
                    const crit = CRIT_STYLES[dep.criticality]
                    return (
                      <div key={i} className={`grid grid-cols-[auto_1fr_auto_auto] gap-x-6 gap-y-0 px-5 py-3 items-center ${i < result.systemDependencies.length - 1 ? 'border-b border-[var(--m12-border)]/10' : ''}`}>
                        <span className="text-xs font-semibold text-[var(--m12-text)] min-w-[140px]">{dep.system}</span>
                        <span className="text-[10px] text-[var(--m12-text-secondary)]">{dep.role}</span>
                        <span className="text-xs font-bold text-[var(--m12-text)] text-center font-[family-name:var(--font-orbitron)]">{dep.capabilitiesServed}</span>
                        <span className={`flex items-center gap-1.5 text-[8px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider font-bold ${crit.text}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${crit.dot}`} />
                          {dep.criticality}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Persona Map ────────────────────────────── */}
            {result.personaMap.length > 0 && (
              <div>
                <div className="text-[9px] uppercase tracking-[0.2em] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold mb-4">Key Personas</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.personaMap.map((p, i) => (
                    <div key={i} className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/30 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-full bg-[#8B5CF6]/15 flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <circle cx="6" cy="4" r="2" fill="#8B5CF6" />
                            <path d="M2.5 10c0-1.9 1.6-3.5 3.5-3.5s3.5 1.6 3.5 3.5" stroke="#8B5CF6" strokeWidth="1.2" strokeLinecap="round" fill="#8B5CF6" fillOpacity="0.2" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[var(--m12-text)] truncate">{p.persona}</div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[7px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider font-bold ${
                              p.involvement === 'both' ? 'text-[#8B5CF6]' : p.involvement === 'supplier' ? 'text-[#F97316]' : 'text-[#06B6D4]'
                            }`}>
                              {p.involvement === 'both' ? 'Supplier + Consumer' : p.involvement === 'supplier' ? 'Supplier' : 'Consumer'}
                            </span>
                            <span className="text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)]">{p.capabilitiesInvolved} cap.</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-[9px] text-[var(--m12-text-muted)] leading-relaxed">{p.keyContribution}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Strategic Insights ─────────────────────── */}
            {result.strategicInsights.length > 0 && (
              <div>
                <div className="text-[9px] uppercase tracking-[0.2em] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold mb-4">Strategic Insights</div>
                <div className="space-y-2">
                  {result.strategicInsights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-3 bg-[#2563EB]/[0.04] border border-[#2563EB]/15 rounded-xl px-5 py-3.5">
                      <div className="w-5 h-5 rounded-full bg-[#2563EB]/15 flex items-center justify-center shrink-0 mt-0.5">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M5 1L6 4L9 4.5L7 7L7.5 10L5 8.5L2.5 10L3 7L1 4.5L4 4L5 1Z" fill="#2563EB" />
                        </svg>
                      </div>
                      <div className="text-[11px] text-[var(--m12-text-secondary)] leading-relaxed">{insight}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Recommendations ────────────────────────── */}
            {result.recommendations.length > 0 && (
              <div>
                <div className="text-[9px] uppercase tracking-[0.2em] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold mb-4">Recommendations</div>
                <div className="space-y-3">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/30 rounded-xl px-5 py-4 flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#2563EB] flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-white font-[family-name:var(--font-orbitron)]">{rec.priority}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[var(--m12-text)] mb-1">{rec.title}</div>
                        <div className="text-[11px] text-[var(--m12-text-secondary)] leading-relaxed mb-2">{rec.description}</div>
                        <div className="flex items-center gap-1.5">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[#10B981]">
                            <path d="M1 5h8M5 1v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                          <span className="text-[9px] text-[#10B981] font-medium">{rec.impact}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-[var(--m12-border)]/20 pt-6 pb-4 flex items-center justify-between">
              <div className="text-[9px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)]">
                Generated by Mach12.ai | {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <button onClick={onClose} className="text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors">
                Return to Map
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
