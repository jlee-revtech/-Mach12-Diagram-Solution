'use client'

import { useEffect, useState } from 'react'
import { useProcessStore } from '@/lib/process/store'
import { getReferenceScenario, listReferenceScenarios } from '@/lib/supabase/process-models'

interface FitGap { type: string; title: string; description: string; severity: 'high' | 'medium' | 'low' }
interface ComplianceGap { framework: string; title: string; description: string }
interface Assessment {
  overallScore: number
  summary: string
  fitGaps: FitGap[]
  complianceGaps: ComplianceGap[]
  recommendations: string[]
}

// As-is (this model's hierarchy) vs best-practice reference fit/gap.
export default function ProcessGapAssessment({ onClose }: { onClose: () => void }) {
  const model = useProcessStore(s => s.model)
  const nodes = useProcessStore(s => s.nodes)
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running')
  const [result, setResult] = useState<Assessment | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Build as-is hierarchy (parents before children)
        const byId = new Map(nodes.map(n => [n.id, n]))
        const levelOf = (id: string): number => {
          let n = byId.get(id); let depth = 1
          while (n?.parent_id && byId.has(n.parent_id)) { depth++; n = byId.get(n.parent_id) }
          return depth
        }
        const asIs = [...nodes]
          .sort((a, b) => a.level - b.level || a.sort_order - b.sort_order)
          .map(n => ({ name: n.name, level: levelOf(n.id) }))

        // Reference subtree (if this model was instantiated from one)
        let reference: { name: string; level: number }[] | undefined
        let referenceName: string | undefined
        if (model?.source_reference_id) {
          const root = await getReferenceScenario(model.source_reference_id)
          if (root) {
            referenceName = root.name
            const all = await listReferenceScenarios(root.library_id)
            const byParent = new Map<string | null, typeof all>()
            for (const s of all) {
              const k = s.parent_id ?? null
              if (!byParent.has(k)) byParent.set(k, [])
              byParent.get(k)!.push(s)
            }
            const sub: { name: string; level: number }[] = []
            const walk = (id: string, depth: number) => {
              const node = all.find(s => s.id === id)
              if (node) sub.push({ name: node.name, level: depth })
              ;(byParent.get(id) || []).sort((a, b) => a.sort_order - b.sort_order).forEach(c => walk(c.id, depth + 1))
            }
            walk(root.id, 1)
            reference = sub
          }
        }

        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'process-gap-assessment',
            context: { modelTitle: model?.title || 'Process Model', asIs, reference, referenceName },
          }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok || typeof data.overallScore !== 'number') throw new Error(data.error || 'Assessment failed')
        setResult(data)
        setStatus('done')
      } catch (e) {
        if (cancelled) return
        setErrorMsg(e instanceof Error ? e.message : 'Assessment failed')
        setStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [model, nodes])

  const sevColor = (s: string) => s === 'high' ? '#EF4444' : s === 'medium' ? '#EAB308' : '#64748B'
  const scoreColor = result && result.overallScore >= 75 ? '#10B981' : result && result.overallScore >= 50 ? '#EAB308' : '#EF4444'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-[40rem] max-w-[94vw] max-h-[85vh] flex flex-col bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--m12-border)]/40 shrink-0">
          <h3 className="text-sm font-semibold text-[var(--m12-text)]">Best-practice gap assessment</h3>
          <button onClick={onClose} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {status === 'running' && (
            <div className="py-16 text-center">
              <div className="inline-block w-6 h-6 border-2 border-[#0EA5E9]/30 border-t-[#0EA5E9] rounded-full animate-spin mb-3" />
              <div className="text-sm text-[var(--m12-text-muted)]">Comparing your model against best practice…</div>
            </div>
          )}
          {status === 'error' && <div className="py-12 text-center text-sm text-red-400">{errorMsg}</div>}
          {status === 'done' && result && (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center" style={{ background: `${scoreColor}15`, border: `1px solid ${scoreColor}40` }}>
                  <span className="text-xl font-bold" style={{ color: scoreColor }}>{result.overallScore}</span>
                  <span className="text-[8px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">score</span>
                </div>
                <p className="text-xs text-[var(--m12-text-secondary)] leading-relaxed flex-1">{result.summary}</p>
              </div>

              <Section title="Fit Gaps" count={result.fitGaps?.length}>
                {(result.fitGaps || []).map((g, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sevColor(g.severity) }} />
                    <div>
                      <div className="text-xs font-medium text-[var(--m12-text)]">
                        {g.title}
                        <span className="ml-2 text-[8px] uppercase tracking-wider font-[family-name:var(--font-space-mono)]" style={{ color: sevColor(g.severity) }}>{g.severity}</span>
                      </div>
                      <div className="text-[11px] text-[var(--m12-text-muted)]">{g.description}</div>
                    </div>
                  </div>
                ))}
              </Section>

              <Section title="Compliance Gaps" count={result.complianceGaps?.length}>
                {(result.complianceGaps || []).map((g, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5">
                    <span className="shrink-0 text-[9px] font-[family-name:var(--font-space-mono)] text-[#EF4444] border border-[#EF4444]/40 bg-[#EF4444]/10 rounded px-1 py-0.5 mt-0.5">{g.framework}</span>
                    <div>
                      <div className="text-xs font-medium text-[var(--m12-text)]">{g.title}</div>
                      <div className="text-[11px] text-[var(--m12-text-muted)]">{g.description}</div>
                    </div>
                  </div>
                ))}
              </Section>

              <Section title="Recommendations" count={result.recommendations?.length}>
                <ol className="list-decimal list-inside space-y-1">
                  {(result.recommendations || []).map((r, i) => (
                    <li key={i} className="text-[11px] text-[var(--m12-text-secondary)]">{r}</li>
                  ))}
                </ol>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold mb-1.5">
        {title}{typeof count === 'number' ? ` (${count})` : ''}
      </div>
      {children}
    </div>
  )
}
