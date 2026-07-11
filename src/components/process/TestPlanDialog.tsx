'use client'

import { useMemo, useState, useCallback } from 'react'
import { AlertTriangle, Check, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/common'
import { useProcessStore } from '@/lib/process/store'
import { listProcessOverlays } from '@/lib/supabase/process-models'
import {
  classifyGraphSteps, relevantCatalogTiles, normalizeTestPlan,
  SYSTEM_KIND_LABEL, MOCKUP_WIDTH, MOCKUP_HEIGHT,
  type TestPlan,
} from '@/lib/process/testPlan'
import type { ProcessElementData, ProcessGraph } from '@/lib/process/types'

type Phase = 'idle' | 'plan' | 'shots' | 'export' | 'done' | 'error'

// System-kind chips shown in the detected-steps preview, mapped to the
// documented status token pairs.
const KIND_CHIP_CLASSES: Record<string, string> = {
  'Standard SAP S/4HANA': 'bg-status-blue-bg text-status-blue',
  'Dassian A&D': 'bg-rose-50 text-rose-600',
  'Custom / RICEFW': 'bg-purple-50 text-purple-700',
  'Non-SAP System': 'bg-amber-50 text-amber-700',
  'Manual / Offline': 'bg-gray-100 text-gray-500',
}

// Bounded-concurrency map (keeps AI screenshot calls from stampeding).
async function pooledMap<T, R>(items: T[], size: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

export default function TestPlanDialog({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const model = useProcessStore(s => s.model)
  const node = useProcessStore(s => s.nodes.find(n => n.id === nodeId))
  const logicalSystems = useProcessStore(s => s.logicalSystems)

  const [excel, setExcel] = useState(true)
  const [word, setWord] = useState(true)
  const [includeShots, setIncludeShots] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  const resolveSystemName = useCallback(
    (id: string) => (id ? logicalSystems.find(s => s.id === id)?.name ?? null : null),
    [logicalSystems],
  )

  const graph: ProcessGraph = useMemo(
    () => node?.graph_data || { lanes: [], nodes: [], edges: [] },
    [node?.graph_data],
  )

  // Deterministic preview of what will be tested + the system breakdown.
  const classified = useMemo(
    () => classifyGraphSteps(graph, resolveSystemName),
    [graph, resolveSystemName],
  )
  const breakdown = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of classified) m.set(SYSTEM_KIND_LABEL[s.systemKind], (m.get(SYSTEM_KIND_LABEL[s.systemKind]) || 0) + 1)
    return [...m.entries()]
  }, [classified])

  const busy = phase === 'plan' || phase === 'shots' || phase === 'export'
  const canGo = !!node && classified.length > 0 && (excel || word) && !busy

  const handleGenerate = async () => {
    if (!node || !model) return
    setError(null)
    try {
      // 1) Build the AI test plan.
      setPhase('plan'); setProgress('Analyzing process steps and systems...')
      const overlays = await listProcessOverlays(node.id).catch(() => [])
      const modules = Array.from(new Set(
        (graph.nodes || []).map(n => (n.data as ProcessElementData).module).filter(Boolean) as string[],
      ))
      const catalogTiles = relevantCatalogTiles(modules).map(t => ({ title: t.title, appId: t.appId, area: t.area, source: t.source }))
      const lanes = (graph.lanes || []).map(l => ({ label: l.label, system: resolveSystemName(l.systemId || '') }))

      const res = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process-test-plan',
          context: {
            processName: node.name, modelTitle: model.title, description: node.description,
            scopeItemRef: node.scope_item_ref, lifecycle: node.lifecycle, variant: node.variant_label,
            lanes, steps: classified,
            overlays: overlays.map(o => ({ kind: o.overlay_kind, title: o.payload.title, framework: o.payload.framework, code: o.payload.code })),
            catalogTiles,
          },
        }),
      })
      const raw = await res.json()
      if (!res.ok || raw.error) throw new Error(raw.error || 'Test plan generation failed')
      const plan: TestPlan = normalizeTestPlan(raw, node.name, model.title)
      if (!plan.testCases.length) throw new Error('The AI returned no test cases for this process.')

      // 2) Optional AI-rendered Fiori screenshots (Word only).
      if (includeShots && word) {
        const { renderHtmlToPng } = await import('@/lib/process/mockupRender')
        let done = 0
        await pooledMap(plan.testCases, 3, async (tc) => {
          try {
            const r = await fetch('/api/ai', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'fiori-mockup',
                context: {
                  systemLabel: tc.systemLabel, systemKind: tc.systemKind,
                  fioriTile: tc.fioriTile, fioriAppId: tc.fioriAppId, tcode: tc.tcode,
                  processStep: tc.processStep, caseTitle: tc.title, testData: tc.testData,
                  width: MOCKUP_WIDTH, height: MOCKUP_HEIGHT,
                },
              }),
            })
            if (r.ok) {
              const html = await r.text()
              if (html.trim()) tc.screenshotDataUrl = await renderHtmlToPng(html, MOCKUP_WIDTH, MOCKUP_HEIGHT)
            }
          } catch { /* a failed screenshot just omits the image */ }
          finally { done++; setPhase('shots'); setProgress(`Rendering Fiori mockups... ${done}/${plan.testCases.length}`) }
        })
      }

      // 3) Export the chosen formats.
      setPhase('export'); setProgress('Building files...')
      if (excel) {
        const { exportTestPlanXlsx } = await import('@/lib/export/testPlanXlsx')
        exportTestPlanXlsx(plan)
      }
      if (word) {
        const { exportTestPlanDocx } = await import('@/lib/export/testPlanDocx')
        await exportTestPlanDocx(plan)
      }
      setPhase('done'); setProgress(`Generated ${plan.testCases.length} test cases.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test plan generation failed')
      setPhase('error')
    }
  }

  const shotEligible = word && includeShots
  const estCases = classified.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={busy ? undefined : onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-[30rem] max-w-[94vw] bg-white border border-border rounded-xl shadow-card-hover overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="text-heading-sm font-display text-text-primary">Create Test Plan</h3>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={16} />} aria-label="Close" disabled={busy} onClick={onClose} />
        </div>

        <div className="p-5">
          <p className="text-body-sm text-text-secondary mb-3">
            Generates an executable functional test script from <span className="text-text-primary font-medium">{node?.name || 'this process'}</span>: one test case per step, with the SAP system / Fiori tile each action runs in detected automatically.
          </p>

          {/* Detected steps + system breakdown */}
          <div className="bg-surface-muted border border-border rounded-lg px-3 py-2.5 mb-4">
            {estCases === 0 ? (
              <div className="text-body-sm text-status-yellow">No testable steps found on this flow. Add tasks to the BPMN first.</div>
            ) : (
              <>
                <div className="text-body-sm text-text-primary mb-1.5"><span className="font-semibold">{estCases}</span> testable step{estCases === 1 ? '' : 's'} detected</div>
                <div className="flex flex-wrap gap-1.5">
                  {breakdown.map(([label, n]) => (
                    <span key={label} className={`text-[10px] font-mono rounded px-1.5 py-0.5 ${KIND_CHIP_CLASSES[label] || 'bg-gray-100 text-gray-500'}`}>
                      {label} · {n}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Format selection */}
          <div className="text-label uppercase text-text-secondary mb-2">Output Format</div>
          <div className="flex gap-2 mb-4">
            <FormatToggle label="Excel (.xlsx)" desc="Test-case grid" on={excel} onClick={() => setExcel(v => !v)} />
            <FormatToggle label="Word (.docx)" desc="Formatted script" on={word} onClick={() => setWord(v => !v)} />
          </div>

          {/* Screenshot option */}
          <button
            type="button"
            onClick={() => setIncludeShots(v => !v)}
            disabled={!word}
            className={`w-full text-left flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors mb-1 ${
              shotEligible ? 'border-brand-500/50 bg-brand-50' : 'border-border bg-surface-muted'
            } ${!word ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center ${shotEligible ? 'bg-brand-500 border-brand-500 text-white' : 'border-border-strong'}`}>
              {shotEligible && <Check size={10} />}
            </span>
            <span>
              <span className="block text-body-sm text-text-primary">Include AI-rendered Fiori screenshots <span className="text-text-tertiary">(Word only)</span></span>
              <span className="block text-[10px] text-text-tertiary mt-0.5">One generated screen mockup per test case, embedded in the document.</span>
            </span>
          </button>
          {shotEligible && (
            <div className="flex items-start gap-1.5 text-[10px] text-status-yellow mb-3 px-1">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>This makes ~{estCases} extra AI calls and will cost additional time and tokens.</span>
            </div>
          )}

          {error && <div className="text-body-sm text-status-red bg-status-red-bg border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}
          {busy && (
            <div className="text-body-sm text-text-secondary mb-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {progress}
            </div>
          )}
          {phase === 'done' && (
            <div className="text-body-sm text-status-green mb-3 flex items-center gap-1.5">
              <Check size={14} />
              {progress}
            </div>
          )}

          <Button
            fullWidth
            icon={<Sparkles size={14} />}
            loading={busy}
            disabled={!canGo}
            onClick={handleGenerate}
          >
            {busy ? 'Generating...' : phase === 'done' ? 'Generate again' : 'Generate Test Plan'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function FormatToggle({ label, desc, on, onClick }: { label: string; desc: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-left rounded-lg border px-3 py-2 transition-colors ${
        on ? 'border-brand-500/60 bg-brand-50' : 'border-border bg-surface-muted hover:border-border-strong'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${on ? 'bg-brand-500 border-brand-500 text-white' : 'border-border-strong'}`}>
          {on && <Check size={9} />}
        </span>
        <span className="text-body-sm text-text-primary">{label}</span>
      </div>
      <div className="text-[10px] text-text-tertiary mt-0.5 ml-5">{desc}</div>
    </button>
  )
}
