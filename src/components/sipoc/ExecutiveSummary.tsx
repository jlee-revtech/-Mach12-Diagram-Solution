'use client'

import { useState, useCallback, useRef } from 'react'
import { X, Download, Sparkles, AlertCircle, Plus } from 'lucide-react'
import { Button, LoadingState } from '@/components/common'
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
  low: { bg: 'bg-status-green-bg', border: 'border-green-200', text: 'text-status-green', label: 'LOW RISK' },
  medium: { bg: 'bg-status-yellow-bg', border: 'border-yellow-200', text: 'text-status-yellow', label: 'MEDIUM RISK' },
  high: { bg: 'bg-status-red-bg', border: 'border-red-200', text: 'text-status-red', label: 'HIGH RISK' },
}

const CRIT_STYLES = {
  high: { dot: 'bg-status-red', text: 'text-status-red' },
  medium: { dot: 'bg-status-yellow', text: 'text-status-yellow' },
  low: { dot: 'bg-status-green', text: 'text-status-green' },
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
        <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-text-tertiary font-bold">Architecture Diagram</div>
        {svgContent && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={diagramLoading}>
              Regenerate
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownload} icon={<Download size={12} />}>
              Download SVG
            </Button>
          </div>
        )}
      </div>

      {!svgContent && !diagramLoading && (
        <div className="bg-white border border-border rounded-xl shadow-card p-6">
          <div className="text-center mb-4">
            <div className="text-body-md text-text-secondary mb-1">Generate an architecture-level data flow diagram</div>
            <div className="text-[10px] text-text-tertiary">AI will analyze your systems and data products to create a presentation-ready visual</div>
          </div>
          <div className="flex gap-2 max-w-xl mx-auto">
            <input
              value={userPrompt}
              onChange={e => setUserPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              placeholder="Optional: style direction (e.g., 'hub and spoke around ERP', 'emphasize financial flows')..."
              className="flex-1 h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
            <Button variant="ai" size="md" onClick={handleGenerate} icon={<Sparkles size={14} />} className="shrink-0">
              Generate
            </Button>
          </div>
        </div>
      )}

      {diagramLoading && (
        <LoadingState label="Designing architecture diagram..." />
      )}

      {diagramError && (
        <div className="text-body-sm text-status-red bg-status-red-bg border border-red-200 rounded-lg px-4 py-3 mb-4">{diagramError}</div>
      )}

      {svgContent && (
        <div
          ref={containerRef}
          className="bg-white border border-border rounded-xl shadow-card overflow-hidden overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      )}
    </div>
  )
}

// ─── Stat Card ──────────────────────────────────────────
function Stat({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="bg-white border border-border rounded-lg p-5 shadow-card flex flex-col items-center justify-center text-center">
      <div className="font-display text-display-md" style={{ color }}>{value}</div>
      <div className="text-label uppercase text-text-secondary mt-1">{label}</div>
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
    <div className="fixed inset-0 z-50 bg-surface-muted overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gradient text-sm font-bold font-display tracking-wide">MACH12</span>
            <span className="text-text-tertiary text-body-sm">/</span>
            <span className="text-body-sm text-text-secondary">Executive Summary</span>
          </div>
          <div className="flex items-center gap-3">
            {result && (
              <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={loading}>
                Regenerate
              </Button>
            )}
            <Button variant="ghost" size="sm" iconOnly aria-label="Close" onClick={onClose} icon={<X size={16} />} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Pre-generate state */}
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <div className="w-16 h-16 rounded-xl bg-brand-50 flex items-center justify-center shadow-card">
              <Sparkles size={28} className="text-brand-600" />
            </div>
            <div className="text-center">
              <h2 className="text-heading-md font-display text-text-primary mb-2">Generate Executive Summary</h2>
              <p className="text-body-sm text-text-secondary max-w-md">
                AI will analyze your entire capability map and produce a board-ready executive overview with strategic insights, risk assessment, and recommendations.
              </p>
            </div>
            <Button variant="ai" size="lg" onClick={handleGenerate} icon={<Sparkles size={16} />}>
              Generate Summary
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-32">
            <LoadingState variant="inline" label="Generating executive summary..." />
          </div>
        )}

        {error && (
          <div className="text-body-sm text-status-red bg-status-red-bg border border-red-200 rounded-lg px-4 py-3 mb-6">{error}</div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-10">
            {/* ── Hero section ────────────────────────────── */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-brand-600 font-bold mb-3">{map?.title}</div>
              <h1 className="text-display-md font-display text-text-primary mb-4 leading-tight">{result.headline}</h1>
              <div className="text-body-md text-text-secondary leading-relaxed whitespace-pre-line max-w-4xl">{result.executiveSummary}</div>
            </div>

            {/* ── Data Landscape stats ────────────────────── */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-text-tertiary font-bold mb-4">Data Landscape</div>
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
                    <div key={cat} className="flex items-center gap-1.5 bg-white border border-border rounded-full px-3 py-1">
                      <span className="text-[10px] font-medium text-text-secondary">{cat}</span>
                      <span className="text-[10px] font-mono text-text-tertiary font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── SVG Flow Diagram ────────────────────────── */}
            <SIPOCFlowDiagram mapTitle={map?.title || 'SIPOC'} />

            {/* ── Capability Overview cards ───────────────── */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-text-tertiary font-bold mb-4">Capability Overview</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {result.capabilityOverviews.map((cap, i) => {
                  const risk = RISK_STYLES[cap.riskLevel]
                  return (
                    <div key={i} className="bg-white border border-border rounded-xl shadow-card overflow-hidden">
                      {/* Header */}
                      <div className="px-5 py-4 border-b border-border">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-body-md font-semibold text-text-primary">{cap.name}</div>
                            {cap.system && (
                              <div className="text-[10px] text-text-tertiary font-mono mt-0.5">{cap.system}</div>
                            )}
                          </div>
                          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded ${risk.bg} ${risk.border} ${risk.text} border shrink-0`}>
                            {risk.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-secondary mt-2 leading-relaxed">{cap.oneLiner}</div>
                      </div>
                      {/* Body */}
                      <div className="px-5 py-3 grid grid-cols-2 gap-4">
                        {/* Inputs */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" />
                            <span className="text-[10px] uppercase tracking-wider font-mono text-text-tertiary font-bold">
                              Inputs ({cap.inputCount})
                            </span>
                          </div>
                          {cap.keyInputs.map((inp, j) => (
                            <div key={j} className="text-[10px] text-text-secondary py-0.5 flex items-start gap-1">
                              <span className="text-text-tertiary mt-0.5">-</span>
                              <span>{inp}</span>
                            </div>
                          ))}
                        </div>
                        {/* Outputs */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                            <span className="text-[10px] uppercase tracking-wider font-mono text-text-tertiary font-bold">
                              Outputs ({cap.outputCount})
                            </span>
                          </div>
                          {cap.keyOutputs.map((out, j) => (
                            <div key={j} className="text-[10px] text-text-secondary py-0.5 flex items-start gap-1">
                              <span className="text-text-tertiary mt-0.5">-</span>
                              <span>{out}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Systems footer */}
                      {cap.criticalSystems.length > 0 && (
                        <div className="px-5 py-2.5 bg-surface-muted/50 border-t border-border flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">Systems:</span>
                          {cap.criticalSystems.map((sys, j) => (
                            <span key={j} className="text-[10px] text-text-secondary bg-white border border-border rounded px-1.5 py-0.5 font-mono">{sys}</span>
                          ))}
                        </div>
                      )}
                      {/* Risk note */}
                      {cap.riskNote && (
                        <div className={`px-5 py-2 ${risk.bg} border-t ${risk.border} flex items-start gap-2`}>
                          <AlertCircle size={10} className={`${risk.text} mt-0.5 shrink-0`} />
                          <span className={`text-[10px] ${risk.text}`}>{cap.riskNote}</span>
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
                <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-text-tertiary font-bold mb-4">System Dependencies</div>
                <div className="bg-white border border-border rounded-lg shadow-card overflow-hidden">
                  <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-6 gap-y-0 px-5 py-2.5 border-b border-border bg-surface-muted text-label uppercase text-text-secondary font-medium">
                    <span>System</span><span>Role</span><span>Capabilities</span><span>Criticality</span>
                  </div>
                  {result.systemDependencies.map((dep, i) => {
                    const crit = CRIT_STYLES[dep.criticality]
                    return (
                      <div key={i} className={`grid grid-cols-[auto_1fr_auto_auto] gap-x-6 gap-y-0 px-5 py-3 items-center ${i < result.systemDependencies.length - 1 ? 'border-b border-border' : ''}`}>
                        <span className="text-body-sm font-semibold text-text-primary min-w-[140px]">{dep.system}</span>
                        <span className="text-[10px] text-text-secondary">{dep.role}</span>
                        <span className="text-body-sm font-bold text-text-primary text-center font-display">{dep.capabilitiesServed}</span>
                        <span className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider font-bold ${crit.text}`}>
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
                <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-text-tertiary font-bold mb-4">Key Personas</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.personaMap.map((p, i) => (
                    <div key={i} className="bg-white border border-border rounded-xl shadow-card px-4 py-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-full bg-[#8B5CF6]/15 flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <circle cx="6" cy="4" r="2" fill="#8B5CF6" />
                            <path d="M2.5 10c0-1.9 1.6-3.5 3.5-3.5s3.5 1.6 3.5 3.5" stroke="#8B5CF6" strokeWidth="1.2" strokeLinecap="round" fill="#8B5CF6" fillOpacity="0.2" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-body-sm font-semibold text-text-primary truncate">{p.persona}</div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
                              p.involvement === 'both' ? 'text-[#8B5CF6]' : p.involvement === 'supplier' ? 'text-[#F97316]' : 'text-[#06B6D4]'
                            }`}>
                              {p.involvement === 'both' ? 'Supplier + Consumer' : p.involvement === 'supplier' ? 'Supplier' : 'Consumer'}
                            </span>
                            <span className="text-[10px] text-text-tertiary font-mono">{p.capabilitiesInvolved} cap.</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-text-secondary leading-relaxed">{p.keyContribution}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Strategic Insights ─────────────────────── */}
            {result.strategicInsights.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-text-tertiary font-bold mb-4">Strategic Insights</div>
                <div className="space-y-2">
                  {result.strategicInsights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-3 bg-brand-50 border border-blue-200 rounded-xl px-5 py-3.5">
                      <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles size={10} className="text-brand-600" />
                      </div>
                      <div className="text-[11px] text-text-secondary leading-relaxed">{insight}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Recommendations ────────────────────────── */}
            {result.recommendations.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-text-tertiary font-bold mb-4">Recommendations</div>
                <div className="space-y-3">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="bg-white border border-border rounded-xl shadow-card px-5 py-4 flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-white font-display">{rec.priority}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-body-md font-semibold text-text-primary mb-1">{rec.title}</div>
                        <div className="text-[11px] text-text-secondary leading-relaxed mb-2">{rec.description}</div>
                        <div className="flex items-center gap-1.5">
                          <Plus size={10} className="text-status-green" />
                          <span className="text-[10px] text-status-green font-medium">{rec.impact}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-border pt-6 pb-4 flex items-center justify-between">
              <div className="text-[10px] text-text-tertiary font-mono">
                Generated by Mach12.ai | {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Return to Map
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
