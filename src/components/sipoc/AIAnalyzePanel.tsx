'use client'

import { useState, useCallback } from 'react'
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

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-400/10', border: 'border-red-400/30', text: 'text-red-400', dot: 'bg-red-400' },
  medium: { bg: 'bg-[#EAB308]/10', border: 'border-[#EAB308]/30', text: 'text-[#EAB308]', dot: 'bg-[#EAB308]' },
  low: { bg: 'bg-[#06B6D4]/10', border: 'border-[#06B6D4]/30', text: 'text-[#06B6D4]', dot: 'bg-[#06B6D4]' },
}

const IMPACT_COLORS = {
  high: { bg: 'bg-[#10B981]/10', border: 'border-[#10B981]/30', text: 'text-[#10B981]' },
  medium: { bg: 'bg-[#2563EB]/10', border: 'border-[#2563EB]/30', text: 'text-[#2563EB]' },
  low: { bg: 'bg-[var(--m12-bg)]', border: 'border-[var(--m12-border)]/30', text: 'text-[var(--m12-text-muted)]' },
}

function ScoreRing({ score }: { score: number }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 75 ? '#10B981' : score >= 50 ? '#EAB308' : '#EF4444'

  return (
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--m12-border)" strokeWidth="6" opacity="0.2" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-[family-name:var(--font-orbitron)]" style={{ color }}>{score}</span>
        <span className="text-[8px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase tracking-wider">Score</span>
      </div>
    </div>
  )
}

function SectionTitle({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      {icon}
      <span className="text-[10px] uppercase tracking-widest font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold">{label}</span>
      {count !== undefined && (
        <span className="text-[9px] bg-[var(--m12-bg)] border border-[var(--m12-border)]/30 rounded px-1.5 py-0.5 text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">{count}</span>
      )}
    </div>
  )
}

export default function AIAnalyzePanel({ onClose }: { onClose: () => void }) {
  const map = useSIPOCStore(s => s.map)
  const hydratedCaps = useSIPOCStore(s => s.getHydratedCapabilities)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)

  const handleAnalyze = useCallback(async () => {
    setLoading(true)
    setError(null)

    const capabilities = useSIPOCStore.getState().getHydratedCapabilities()

    const context = {
      mapTitle: map?.title || 'Untitled',
      capabilities: capabilities.map(cap => ({
        name: cap.name,
        description: cap.description,
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
  }, [map])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-2xl shadow-2xl w-[680px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--m12-border)]/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#2563EB] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v12M5 5l3-3 3 3M5 11l3 3 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--m12-text)]">AI SIPOC Analysis</div>
              <div className="text-[10px] text-[var(--m12-text-muted)]">{map?.title || 'Capability Map'}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="opacity-20">
                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" className="text-[var(--m12-text)]" />
                <path d="M24 14v10l7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-[var(--m12-text)]" />
              </svg>
              <div className="text-center">
                <div className="text-sm text-[var(--m12-text-secondary)] mb-1">Analyze your SIPOC capability map</div>
                <div className="text-[10px] text-[var(--m12-text-muted)] max-w-[320px]">
                  AI will review all capabilities, information products, suppliers, consumers, and dimensions to identify gaps, suggest improvements, and assess data governance.
                </div>
              </div>
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-2 bg-gradient-to-r from-[#06B6D4] to-[#2563EB] hover:from-[#0891B2] hover:to-[#3B82F6] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-[#2563EB]/20"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1L8.5 4.5L12 5.5L9.5 8L10 11.5L7 10L4 11.5L4.5 8L2 5.5L5.5 4.5L7 1Z" fill="white" />
                </svg>
                Run Analysis
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <svg className="animate-spin w-10 h-10 text-[#06B6D4]" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
              </svg>
              <span className="text-xs text-[var(--m12-text-muted)]">Analyzing capability map...</span>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</div>
            </div>
          )}

          {result && (
            <div className="p-6 space-y-6">
              {/* Score + Summary */}
              <div className="flex gap-5 items-start">
                <ScoreRing score={result.overallScore} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-[var(--m12-text)] leading-relaxed">{result.summary}</div>
                </div>
              </div>

              {/* Strengths */}
              {result.strengths.length > 0 && (
                <div>
                  <SectionTitle
                    icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.5 3L11 5l-2.5 2.5L9 11l-3-1.5L3 11l.5-3.5L1 5l3.5-1L6 1z" stroke="#10B981" strokeWidth="1" strokeLinejoin="round" /></svg>}
                    label="Strengths"
                    count={result.strengths.length}
                  />
                  <div className="space-y-1.5">
                    {result.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10px] text-[var(--m12-text-secondary)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] mt-1.5 shrink-0" />
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
                    icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#EF4444" strokeWidth="1" /><path d="M6 3.5v3M6 8.5v.01" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round" /></svg>}
                    label="Gaps Identified"
                    count={result.gaps.length}
                  />
                  <div className="space-y-2">
                    {result.gaps.map((gap, i) => {
                      const c = PRIORITY_COLORS[gap.priority]
                      return (
                        <div key={i} className={`${c.bg} border ${c.border} rounded-lg px-3 py-2.5`}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                            <span className="text-[11px] font-semibold text-[var(--m12-text)]">{gap.title}</span>
                            <span className={`text-[7px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider font-bold ${c.text}`}>{gap.priority}</span>
                            {gap.capability !== 'Overall' && (
                              <span className="text-[8px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] ml-auto">{gap.capability}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--m12-text-secondary)] leading-relaxed pl-3.5">{gap.description}</div>
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
                    icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.5 2.5l1.5 1.5M8 8l1.5 1.5M9.5 2.5L8 4M4 8l-1.5 1.5" stroke="#2563EB" strokeWidth="1" strokeLinecap="round" /></svg>}
                    label="Suggestions"
                    count={result.suggestions.length}
                  />
                  <div className="space-y-2">
                    {result.suggestions.map((sug, i) => {
                      const c = IMPACT_COLORS[sug.impact]
                      return (
                        <div key={i} className={`${c.bg} border ${c.border} rounded-lg px-3 py-2.5`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-semibold text-[var(--m12-text)]">{sug.title}</span>
                            <span className={`text-[7px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider font-bold ${c.text}`}>{sug.impact} impact</span>
                            {sug.capability !== 'Overall' && (
                              <span className="text-[8px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] ml-auto">{sug.capability}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--m12-text-secondary)] leading-relaxed">{sug.description}</div>
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
                    icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="3" width="8" height="7" rx="1" stroke="#8B5CF6" strokeWidth="1" /><path d="M4 3V2a2 2 0 014 0v1" stroke="#8B5CF6" strokeWidth="1" strokeLinecap="round" /></svg>}
                    label="Data Governance"
                    count={result.dataGovernance.length}
                  />
                  <div className="space-y-1.5">
                    {result.dataGovernance.map((obs, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10px] text-[var(--m12-text-secondary)] bg-[#8B5CF6]/5 border border-[#8B5CF6]/15 rounded-lg px-3 py-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] mt-1.5 shrink-0" />
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
                    icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2v8" stroke="#F97316" strokeWidth="1" strokeLinecap="round" /><circle cx="2" cy="6" r="1.5" stroke="#F97316" strokeWidth="0.8" /><circle cx="10" cy="6" r="1.5" stroke="#F97316" strokeWidth="0.8" /><circle cx="6" cy="2" r="1.5" stroke="#F97316" strokeWidth="0.8" /><circle cx="6" cy="10" r="1.5" stroke="#F97316" strokeWidth="0.8" /></svg>}
                    label="Cross-Capability Insights"
                    count={result.crossCapabilityInsights.length}
                  />
                  <div className="space-y-1.5">
                    {result.crossCapabilityInsights.map((ins, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10px] text-[var(--m12-text-secondary)] bg-[#F97316]/5 border border-[#F97316]/15 rounded-lg px-3 py-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#F97316] mt-1.5 shrink-0" />
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
          <div className="px-6 py-3 border-t border-[var(--m12-border)]/30 flex items-center justify-between shrink-0">
            <div className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
              {result.gaps.length} gaps / {result.suggestions.length} suggestions
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] px-3 py-1.5 transition-colors"
              >
                Re-analyze
              </button>
              <button
                onClick={onClose}
                className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 text-[var(--m12-text-secondary)] px-4 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--m12-bg-card)]"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
