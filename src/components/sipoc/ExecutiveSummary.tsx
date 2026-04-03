'use client'

import { useState, useCallback, useRef } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'

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

// ─── AI-Generated SVG Flow Diagram ──────────────────────

function SIPOCFlowDiagram({ mapTitle }: { mapTitle: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [diagramLoading, setDiagramLoading] = useState(false)
  const [diagramError, setDiagramError] = useState<string | null>(null)
  const [userPrompt, setUserPrompt] = useState('')

  const handleGenerate = useCallback(async () => {
    setDiagramLoading(true)
    setDiagramError(null)

    const capabilities = useSIPOCStore.getState().getHydratedCapabilities()
    const logicalSystems = useSIPOCStore.getState().logicalSystems

    const context = {
      mapTitle,
      capabilities: capabilities.map(cap => ({
        name: cap.name,
        system: cap.system?.name || null,
        inputs: cap.inputs.map(inp => ({
          informationProduct: inp.informationProduct.name,
          category: inp.informationProduct.category,
          sourceSystems: inp.sourceSystems.map(s => s.name),
          feedingSystem: inp.feeding_system_id ? logicalSystems.find(s => s.id === inp.feeding_system_id)?.name : undefined,
        })),
        outputs: cap.outputs.map(out => ({
          informationProduct: out.informationProduct.name,
          category: out.informationProduct.category,
          consumerPersonas: out.consumerPersonas.map(p => p.name),
        })),
      })),
    }

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sipoc-flow-diagram',
          prompt: userPrompt,
          context,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        throw new Error(err.error || 'Failed to generate diagram')
      }
      const svg = await res.text()
      setSvgContent(svg)
    } catch (err) {
      setDiagramError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setDiagramLoading(false)
    }
  }, [mapTitle, userPrompt])

  const handleDownload = () => {
    if (!svgContent) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mapTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Architecture_Diagram.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[9px] uppercase tracking-[0.2em] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold">Architecture Diagram</div>
        {svgContent && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={diagramLoading}
              className="flex items-center gap-1.5 text-[10px] text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors"
            >
              Regenerate
            </button>
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
        )}
      </div>

      {!svgContent && !diagramLoading && (
        <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/30 rounded-xl p-6">
          <div className="text-center mb-4">
            <div className="text-sm text-[var(--m12-text-secondary)] mb-1">Generate an architecture-level data flow diagram</div>
            <div className="text-[10px] text-[var(--m12-text-muted)]">AI will analyze your systems and data products to create a presentation-ready visual</div>
          </div>
          <div className="flex gap-2 max-w-xl mx-auto">
            <input
              value={userPrompt}
              onChange={e => setUserPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              placeholder="Optional: style direction (e.g., 'hub and spoke around ERP', 'emphasize financial flows')..."
              className="flex-1 bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60"
            />
            <button
              onClick={handleGenerate}
              className="bg-gradient-to-r from-[#8B5CF6] to-[#2563EB] hover:from-[#7C3AED] hover:to-[#3B82F6] text-white px-5 py-2 rounded-lg text-xs font-medium transition-all shrink-0"
            >
              Generate
            </button>
          </div>
        </div>
      )}

      {diagramLoading && (
        <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/30 rounded-xl flex flex-col items-center justify-center py-20 gap-3">
          <svg className="animate-spin w-10 h-10 text-[#8B5CF6]" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
          </svg>
          <span className="text-xs text-[var(--m12-text-muted)]">Designing architecture diagram...</span>
        </div>
      )}

      {diagramError && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 mb-4">{diagramError}</div>
      )}

      {svgContent && (
        <div
          ref={containerRef}
          className="bg-white border border-[var(--m12-border)]/30 rounded-xl overflow-hidden overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      )}
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
        features: cap.features || [],
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
