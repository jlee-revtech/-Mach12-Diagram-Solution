'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button, LoadingState, StatusBadge } from '@/components/common'
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

  const scoreClasses = result && result.overallScore >= 75
    ? 'bg-status-green-bg border-green-200 text-status-green'
    : result && result.overallScore >= 50
      ? 'bg-status-yellow-bg border-amber-200 text-status-yellow'
      : 'bg-status-red-bg border-red-200 text-status-red'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-[40rem] max-w-[94vw] max-h-[85vh] flex flex-col bg-white border border-border rounded-xl shadow-card-hover overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <h3 className="text-heading-sm font-display text-text-primary">Best-practice gap assessment</h3>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={16} />} aria-label="Close" onClick={onClose} />
        </div>

        <div className="p-5 overflow-y-auto">
          {status === 'running' && (
            <LoadingState variant="inline" label="Comparing your model against best practice..." />
          )}
          {status === 'error' && <div className="py-12 text-center text-body-sm text-status-red">{errorMsg}</div>}
          {status === 'done' && result && (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className={`shrink-0 w-16 h-16 rounded-xl border flex flex-col items-center justify-center ${scoreClasses}`}>
                  <span className="text-heading-md font-display">{result.overallScore}</span>
                  <span className="text-[10px] uppercase tracking-wider text-text-tertiary">score</span>
                </div>
                <p className="text-body-sm text-text-secondary leading-relaxed flex-1">{result.summary}</p>
              </div>

              <Section title="Fit Gaps" count={result.fitGaps?.length}>
                {(result.fitGaps || []).map((g, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-body-sm font-medium text-text-primary">{g.title}</span>
                        <StatusBadge status={g.severity} size="sm" className="capitalize" />
                      </div>
                      <div className="text-[11px] text-text-tertiary">{g.description}</div>
                    </div>
                  </div>
                ))}
              </Section>

              <Section title="Compliance Gaps" count={result.complianceGaps?.length}>
                {(result.complianceGaps || []).map((g, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5">
                    <span className="shrink-0 text-[10px] font-mono bg-status-red-bg text-status-red border border-red-200 rounded px-1 py-0.5 mt-0.5">{g.framework}</span>
                    <div>
                      <div className="text-body-sm font-medium text-text-primary">{g.title}</div>
                      <div className="text-[11px] text-text-tertiary">{g.description}</div>
                    </div>
                  </div>
                ))}
              </Section>

              <Section title="Recommendations" count={result.recommendations?.length}>
                <ol className="list-decimal list-inside space-y-1">
                  {(result.recommendations || []).map((r, i) => (
                    <li key={i} className="text-body-sm text-text-secondary">{r}</li>
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
      <div className="text-label uppercase text-text-secondary mb-1.5">
        {title}{typeof count === 'number' ? ` (${count})` : ''}
      </div>
      {children}
    </div>
  )
}
