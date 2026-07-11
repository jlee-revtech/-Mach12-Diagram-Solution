'use client'

import { useState, useCallback } from 'react'
import {
  X,
  Sparkles,
  Star,
  AlertCircle,
  ListChecks,
  Lightbulb,
  Lock,
  Network,
} from 'lucide-react'
import { Button, LoadingState } from '@/components/common'
import { useSIPOCStore } from '@/lib/sipoc/store'

interface Gap {
  type: string
  capability: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

interface Suggestion {
  type: string
  capability: string
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
}

interface AnalysisResult {
  overallScore: number
  summary: string
  strengths: string[]
  gaps: Gap[]
  suggestions: Suggestion[]
  dataGovernance: string[]
  crossCapabilityInsights: string[]
}

interface L3AnalysisResult {
  executiveSummary: string
  completenessScore: number
  strengths: string[]
  gaps: { area: string; title: string; description: string; priority: 'high' | 'medium' | 'low'; recommendation: string }[]
  recommendations: string[]
}

// Canonical status token pairs for priority / impact pills.
const PRIORITY_COLORS = {
  high: { pill: 'bg-status-red-bg text-status-red', dot: 'bg-status-red' },
  medium: { pill: 'bg-status-yellow-bg text-status-yellow', dot: 'bg-status-yellow' },
  low: { pill: 'bg-status-blue-bg text-status-blue', dot: 'bg-status-blue' },
}

const IMPACT_COLORS = {
  high: { pill: 'bg-status-green-bg text-status-green' },
  medium: { pill: 'bg-status-blue-bg text-status-blue' },
  low: { pill: 'bg-surface-muted text-text-secondary' },
}

function ScoreRing({ score }: { score: number }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  // RAG chart colors per the design system (green / yellow / red)
  const color = score >= 75 ? '#16a34a' : score >= 50 ? '#ca8a04' : '#dc2626'

  return (
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e2e2" strokeWidth="6" opacity="0.6" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-display" style={{ color }}>{score}</span>
        <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Score</span>
      </div>
    </div>
  )
}

function SectionTitle({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      {icon}
      <span className="text-label uppercase text-text-secondary">{label}</span>
      {count !== undefined && (
        <span className="text-[11px] bg-surface-muted border border-border rounded px-1.5 py-0.5 text-text-tertiary">{count}</span>
      )}
    </div>
  )
}

export default function AIAnalyzePanel({ onClose, onImplement }: { onClose: () => void; onImplement?: (capabilityName: string, prompt: string) => void }) {
  const map = useSIPOCStore(s => s.map)
  const selectedId = useSIPOCStore(s => s.selectedCapabilityId)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [l3Result, setL3Result] = useState<L3AnalysisResult | null>(null)

  // Find the selected hydrated capability
  const getSelectedCap = () => {
    if (!selectedId) return null
    return useSIPOCStore.getState().getHydratedCapabilities().find(c => c.id === selectedId) || null
  }

  const handleAnalyze = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setL3Result(null)

    const selectedCap = getSelectedCap()

    if (selectedCap) {
      // ── L3 single-capability analysis ──
      const context = {
        capabilityName: selectedCap.name,
        level: selectedCap.level,
        system: selectedCap.system?.name,
        features: selectedCap.features || [],
        tags: [...new Set(selectedCap.inputs.flatMap(i => (i.tags || []).map(t => t.name)))],
        inputs: selectedCap.inputs.map(inp => ({
          informationProduct: inp.informationProduct.name,
          category: inp.informationProduct.category,
          supplierPersonas: inp.supplierPersonas.map(p => p.name),
          sourceSystems: inp.sourceSystems.map(s => s.name),
          feedingSystem: inp.feedingSystem?.name,
          dimensions: (inp.dimensions || []).map(d => d.name),
          tags: (inp.tags || []).map(t => t.name),
        })),
        outputs: selectedCap.outputs.map(out => ({
          informationProduct: out.informationProduct.name,
          category: out.informationProduct.category,
          consumerPersonas: out.consumerPersonas.map(p => p.name),
          destinationSystems: out.destinationSystems.map(s => s.name),
          dimensions: (out.dimensions || []).map(d => d.name),
        })),
      }

      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sipoc-analyze-l3', context }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Analysis failed')
        }
        const data: L3AnalysisResult = await res.json()
        setL3Result(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed')
      } finally {
        setLoading(false)
      }
    } else {
      // ── Full map analysis (fallback when no capability selected) ──
      const capabilities = useSIPOCStore.getState().getHydratedCapabilities()
      const context = {
        mapTitle: map?.title || 'Untitled',
        capabilities: capabilities.map(cap => ({
          name: cap.name,
          features: cap.features || [],
          inputs: cap.inputs.map(inp => ({
            informationProduct: inp.informationProduct.name,
            category: inp.informationProduct.category,
            supplierPersonas: inp.supplierPersonas.map(p => p.name),
            sourceSystems: inp.sourceSystems.map(s => s.name),
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
          body: JSON.stringify({ action: 'sipoc-analyze', context }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Analysis failed')
        }
        const data: AnalysisResult = await res.json()
        setResult(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed')
      } finally {
        setLoading(false)
      }
    }
  }, [map, selectedId])

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Sparkles size={16} className="text-amber-600" />
            </div>
            <div>
              <div className="text-heading-sm font-display text-text-primary">{getSelectedCap() ? 'AI SIPOC Analysis' : 'AI Map Analysis'}</div>
              <div className="text-[11px] text-text-tertiary">{getSelectedCap()?.name || map?.title || 'Capability Map'}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={<X size={16} />}
            aria-label="Close"
            onClick={onClose}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!result && !l3Result && !loading && (() => {
            const cap = getSelectedCap()
            return (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Sparkles size={40} className="text-text-tertiary opacity-30" />
                <div className="text-center">
                  <div className="text-body-md text-text-primary font-medium mb-1">
                    {cap ? `Analyze "${cap.name}"` : 'Analyze your SIPOC capability map'}
                  </div>
                  <div className="text-body-sm text-text-secondary max-w-[320px]">
                    {cap
                      ? 'AI will summarize this capability for an executive audience, highlight gaps, and recommend improvements.'
                      : 'AI will review all capabilities, information products, suppliers, consumers, and dimensions to identify gaps and suggest improvements.'}
                  </div>
                </div>
                <Button
                  variant="ai"
                  size="md"
                  icon={<Sparkles size={14} />}
                  onClick={handleAnalyze}
                >
                  {cap ? 'Analyze This Capability' : 'Run Analysis'}
                </Button>
              </div>
            )
          })()}

          {loading && (
            <LoadingState variant="inline" label="Analyzing capability map..." className="py-20" />
          )}

          {error && (
            <div className="p-6">
              <div className="text-body-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
            </div>
          )}

          {l3Result && (
            <div className="p-6 space-y-6">
              {/* Executive Summary */}
              <div className="flex gap-5 items-start">
                <ScoreRing score={l3Result.completenessScore} />
                <div className="flex-1 min-w-0">
                  <div className="text-label uppercase text-brand-600 mb-2">Executive Summary</div>
                  <div className="text-body-sm text-text-primary leading-relaxed">{l3Result.executiveSummary}</div>
                </div>
              </div>

              {/* Strengths */}
              <div>
                <SectionTitle icon={<Star size={12} className="text-status-green" />} label="Strengths" count={l3Result.strengths.length} />
                <div className="space-y-1.5">
                  {l3Result.strengths.map((s, i) => (
                    <div key={i} className="flex gap-2 text-body-sm text-text-secondary">
                      <span className="text-status-green shrink-0 mt-0.5">+</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gaps */}
              <div>
                <SectionTitle icon={<AlertCircle size={12} className="text-status-red" />} label="Gaps" count={l3Result.gaps.length} />
                <div className="space-y-2">
                  {l3Result.gaps.map((g, i) => {
                    const colors = PRIORITY_COLORS[g.priority] || PRIORITY_COLORS.medium
                    return (
                      <div key={i} className="bg-white border border-border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          <span className="text-body-sm font-semibold text-text-primary">{g.title}</span>
                          <span className={`text-[10px] uppercase font-medium tracking-wider px-1.5 py-0.5 rounded ${colors.pill}`}>{g.priority}</span>
                          <span className="text-[10px] text-text-tertiary uppercase tracking-wider ml-auto">{g.area}</span>
                        </div>
                        <div className="text-body-sm text-text-secondary leading-relaxed">{g.description}</div>
                        <div className="text-body-sm text-brand-600 mt-1.5 font-medium">Recommendation: {g.recommendation}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <SectionTitle icon={<ListChecks size={12} className="text-brand-600" />} label="Recommendations" count={l3Result.recommendations.length} />
                <div className="space-y-1.5">
                  {l3Result.recommendations.map((r, i) => (
                    <div key={i} className="flex gap-2 text-body-sm text-text-secondary">
                      <span className="text-brand-600 shrink-0 mt-0.5">{i + 1}.</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Re-run button */}
              <div className="flex justify-center pt-2">
                <Button variant="secondary" size="sm" onClick={handleAnalyze}>
                  Re-analyze
                </Button>
              </div>
            </div>
          )}

          {result && (
            <div className="p-6 space-y-6">
              {/* Score + Summary */}
              <div className="flex gap-5 items-start">
                <ScoreRing score={result.overallScore} />
                <div className="flex-1 min-w-0">
                  <div className="text-body-sm text-text-primary leading-relaxed">{result.summary}</div>
                </div>
              </div>

              {/* Strengths */}
              {result.strengths.length > 0 && (
                <div>
                  <SectionTitle
                    icon={<Star size={12} className="text-status-green" />}
                    label="Strengths"
                    count={result.strengths.length}
                  />
                  <div className="space-y-1.5">
                    {result.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-body-sm text-text-secondary">
                        <div className="w-1.5 h-1.5 rounded-full bg-status-green mt-1.5 shrink-0" />
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gaps */}
              {result.gaps.length > 0 && (
                <div>
                  <SectionTitle
                    icon={<AlertCircle size={12} className="text-status-red" />}
                    label="Gaps Identified"
                    count={result.gaps.length}
                  />
                  <div className="space-y-2">
                    {result.gaps.map((gap, i) => {
                      const c = PRIORITY_COLORS[gap.priority]
                      return (
                        <div key={i} className="bg-white border border-border rounded-lg px-3 py-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                            <span className="text-body-sm font-semibold text-text-primary">{gap.title}</span>
                            <span className={`text-[10px] uppercase font-medium tracking-wider px-1.5 py-0.5 rounded ${c.pill}`}>{gap.priority}</span>
                            {gap.capability !== 'Overall' && (
                              <span className="text-[11px] text-text-tertiary ml-auto">{gap.capability}</span>
                            )}
                          </div>
                          <div className="text-body-sm text-text-secondary leading-relaxed pl-3.5">{gap.description}</div>
                          {onImplement && gap.capability !== 'Overall' && (
                            <div className="pl-3.5 mt-1.5">
                              <button
                                onClick={() => onImplement(gap.capability, `Address gap: ${gap.title} - ${gap.description}`)}
                                className="text-[10px] uppercase tracking-wider font-semibold text-brand-600 hover:text-brand-500 transition-colors"
                              >
                                Implement with AI →
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {result.suggestions.length > 0 && (
                <div>
                  <SectionTitle
                    icon={<Lightbulb size={12} className="text-brand-600" />}
                    label="Suggestions"
                    count={result.suggestions.length}
                  />
                  <div className="space-y-2">
                    {result.suggestions.map((sug, i) => {
                      const c = IMPACT_COLORS[sug.impact]
                      return (
                        <div key={i} className="bg-white border border-border rounded-lg px-3 py-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-body-sm font-semibold text-text-primary">{sug.title}</span>
                            <span className={`text-[10px] uppercase font-medium tracking-wider px-1.5 py-0.5 rounded ${c.pill}`}>{sug.impact} impact</span>
                            {sug.capability !== 'Overall' && (
                              <span className="text-[11px] text-text-tertiary ml-auto">{sug.capability}</span>
                            )}
                          </div>
                          <div className="text-body-sm text-text-secondary leading-relaxed">{sug.description}</div>
                          {onImplement && sug.capability !== 'Overall' && (
                            <div className="mt-1.5">
                              <button
                                onClick={() => onImplement(sug.capability, `Implement suggestion: ${sug.title} - ${sug.description}`)}
                                className="text-[10px] uppercase tracking-wider font-semibold text-brand-600 hover:text-brand-500 transition-colors"
                              >
                                Implement with AI →
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Data Governance */}
              {result.dataGovernance?.length > 0 && (
                <div>
                  <SectionTitle
                    icon={<Lock size={12} className="text-purple-500" />}
                    label="Data Governance"
                    count={result.dataGovernance.length}
                  />
                  <div className="space-y-1.5">
                    {result.dataGovernance.map((obs, i) => (
                      <div key={i} className="flex items-start gap-2 text-body-sm text-text-secondary bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                        {obs}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cross-Capability Insights */}
              {result.crossCapabilityInsights?.length > 0 && (
                <div>
                  <SectionTitle
                    icon={<Network size={12} className="text-orange-500" />}
                    label="Cross-Capability Insights"
                    count={result.crossCapabilityInsights.length}
                  />
                  <div className="space-y-1.5">
                    {result.crossCapabilityInsights.map((ins, i) => (
                      <div key={i} className="flex items-start gap-2 text-body-sm text-text-secondary bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                        {ins}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {result && (
          <div className="px-6 py-3 border-t border-border flex items-center justify-between shrink-0">
            <div className="text-[11px] text-text-tertiary">
              {result.gaps.length} gaps / {result.suggestions.length} suggestions
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={loading} onClick={handleAnalyze}>
                Re-analyze
              </Button>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
