'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { X, Check, Sparkles, Loader2 } from 'lucide-react'
import { Button, EmptyState } from '@/components/common'
import { useSIPOCStore } from '@/lib/sipoc/store'
import { applyAISuggestion, type AISuggestion } from '@/lib/sipoc/applyAISuggestion'

interface ProgressEntry {
  capabilityId: string
  capabilityName: string
  parentPath: string
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped'
  error?: string
  inputCount?: number
  outputCount?: number
  featureCount?: number
  useCaseCount?: number
}

type FillMode = 'full' | 'use-cases'

export default function AIAutoFillBlankL3sPanel({ orgId, mapTitle, onClose }: {
  orgId: string
  mapTitle: string
  onClose: () => void
}) {
  const capabilities = useSIPOCStore(s => s.capabilities)
  const inputs = useSIPOCStore(s => s.inputs)
  const outputs = useSIPOCStore(s => s.outputs)

  const [mode, setMode] = useState<FillMode>('full')

  // mode='full': L3 with no inputs and no outputs.
  // mode='use-cases': L3 with no use cases yet.
  // Includes parent path so users can see context before kicking it off.
  const blankL3s = useMemo(() => {
    const l3s = capabilities.filter(c => c.level === 3)
    const filtered = mode === 'use-cases'
      ? l3s.filter(l3 => (l3.use_cases || []).length === 0)
      : l3s.filter(l3 => (inputs[l3.id] || []).length === 0 && (outputs[l3.id] || []).length === 0)
    return filtered.map(l3 => {
      const parent = capabilities.find(c => c.id === l3.parent_id)
      const grandParent = parent ? capabilities.find(c => c.id === parent.parent_id) : null
      const parentPath = [grandParent?.name, parent?.name].filter(Boolean).join(' / ') || '(unassigned)'
      return { id: l3.id, name: l3.name, parentPath, l1Name: grandParent?.name, l2Name: parent?.name }
    })
  }, [capabilities, inputs, outputs, mode])

  const [progress, setProgress] = useState<ProgressEntry[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const abortRef = useRef(false)

  const handleStart = useCallback(async () => {
    if (blankL3s.length === 0) return
    setRunning(true)
    setDone(false)
    abortRef.current = false

    const initial: ProgressEntry[] = blankL3s.map(l3 => ({
      capabilityId: l3.id,
      capabilityName: l3.name,
      parentPath: l3.parentPath,
      status: 'pending',
    }))
    setProgress(initial)

    for (let i = 0; i < blankL3s.length; i++) {
      if (abortRef.current) {
        setProgress(prev => prev.map((p, idx) => idx >= i && p.status === 'pending' ? { ...p, status: 'skipped' } : p))
        break
      }
      const l3 = blankL3s[i]

      setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'running' } : p))

      try {
        const store = useSIPOCStore.getState()
        const cap = store.capabilities.find(c => c.id === l3.id)
        const personas = store.personas
        const informationProducts = store.informationProducts
        const logicalSystems = store.logicalSystems

        const promptParts = [
          `L3 capability: "${l3.name}"`,
          l3.l2Name ? `under L2 "${l3.l2Name}"` : null,
          l3.l1Name ? `in L1 core area "${l3.l1Name}"` : null,
          mapTitle ? `in capability map "${mapTitle}"` : null,
        ].filter(Boolean)
        const richPrompt = promptParts.join(' ') + (mode === 'use-cases'
          ? '. Generate use cases only.'
          : '. Generate the full SIPOC breakdown.')

        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sipoc-generate',
            prompt: richPrompt,
            scope: mode,
            context: {
              capabilityName: cap?.name,
              capabilityFeatures: cap?.features || [],
              capabilityUseCases: cap?.use_cases || [],
              existingPersonas: personas.map(p => p.name),
              existingInformationProducts: informationProducts.map(ip => ip.name),
              existingLogicalSystems: logicalSystems.map(s => s.name),
              currentInputs: [],
              currentOutputs: [],
            },
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `HTTP ${res.status}`)
        }

        const data: AISuggestion = await res.json()

        await applyAISuggestion(data, l3.id, orgId)

        setProgress(prev => prev.map((p, idx) => idx === i ? {
          ...p,
          status: 'done',
          inputCount: data.inputs?.length || 0,
          outputCount: data.outputs?.length || 0,
          featureCount: data.features?.length || 0,
          useCaseCount: data.use_cases?.length || 0,
        } : p))
      } catch (err) {
        setProgress(prev => prev.map((p, idx) => idx === i ? {
          ...p,
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed',
        } : p))
      }
    }

    setRunning(false)
    setDone(true)
  }, [blankL3s, orgId, mapTitle, mode])

  const handleAbort = useCallback(() => {
    abortRef.current = true
  }, [])

  const completedCount = progress.filter(p => p.status === 'done').length
  const errorCount = progress.filter(p => p.status === 'error').length
  const skippedCount = progress.filter(p => p.status === 'skipped').length

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={running ? undefined : onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-card-hover w-[640px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <Sparkles size={16} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <div className="text-heading-sm font-display text-text-primary">AI: Fill Blank L3s</div>
            <div className="text-[11px] text-text-tertiary">
              {mode === 'use-cases'
                ? 'Generate use cases for every L3 that has none. Suggestions are applied automatically.'
                : 'Auto-generate SIPOC for every L3 with no inputs or outputs. Suggestions are applied automatically.'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={<X size={14} />}
            aria-label="Close"
            disabled={running}
            onClick={onClose}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {progress.length === 0 && (
            <div className="flex items-center gap-2">
              <div className="text-label uppercase text-text-secondary">
                Scope
              </div>
              <div className="flex items-center gap-1 bg-surface-input border border-border rounded-lg p-0.5">
                {([
                  { value: 'full', label: 'Full SIPOC (no inputs/outputs)' },
                  { value: 'use-cases', label: 'Use cases only (no use cases)' },
                ] as { value: FillMode; label: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded transition-colors ${
                      mode === opt.value
                        ? 'bg-brand-500 text-white'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {progress.length === 0 ? (
            // Idle: show list of blanks to be processed
            blankL3s.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={<Check size={24} />}
                title={mode === 'use-cases' ? 'No L3s without use cases' : 'No blank L3s found'}
                description={
                  mode === 'use-cases'
                    ? 'Every L3 in this map already has at least one use case.'
                    : 'Every L3 in this map already has inputs or outputs. Add a new L3 first if you want to use this.'
                }
              />
            ) : (
              <>
                <div className="text-label uppercase text-text-secondary">
                  {blankL3s.length} L3{blankL3s.length === 1 ? '' : 's'} ready to process
                  {mode === 'use-cases' ? ' (no use cases)' : ' (blank)'}
                </div>
                <div className="space-y-1">
                  {blankL3s.map(l3 => (
                    <div key={l3.id} className="flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-body-sm font-medium text-text-primary truncate">{l3.name}</div>
                        <div className="text-[10px] text-text-tertiary truncate">{l3.parentPath}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          ) : (
            // Running or done: show progress
            <>
              <div className="flex items-center justify-between">
                <div className="text-label uppercase text-text-secondary">
                  {done ? 'Complete' : 'Processing'}
                </div>
                <div className="text-[11px] text-text-tertiary">
                  {completedCount} done
                  {errorCount > 0 && <span className="text-status-red"> · {errorCount} error{errorCount === 1 ? '' : 's'}</span>}
                  {skippedCount > 0 && <span className="text-text-tertiary"> · {skippedCount} skipped</span>}
                  {' · '}{progress.length} total
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1 bg-surface-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${((completedCount + errorCount + skippedCount) / progress.length) * 100}%` }}
                />
              </div>
              <div className="space-y-1">
                {progress.map(p => (
                  <div
                    key={p.capabilityId}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      p.status === 'running'
                        ? 'border-brand-200 bg-brand-50'
                        : p.status === 'done'
                          ? 'border-green-200 bg-status-green-bg'
                          : p.status === 'error'
                            ? 'border-red-200 bg-status-red-bg'
                            : p.status === 'skipped'
                              ? 'border-border bg-transparent opacity-50'
                              : 'border-border bg-white'
                    }`}
                  >
                    {/* Status icon */}
                    <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                      {p.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                      {p.status === 'running' && <Loader2 size={14} className="animate-spin text-brand-500" />}
                      {p.status === 'done' && <Check size={12} className="text-status-green" />}
                      {p.status === 'error' && <X size={12} className="text-status-red" />}
                      {p.status === 'skipped' && <X size={12} className="text-text-tertiary" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-body-sm font-medium text-text-primary truncate">{p.capabilityName}</div>
                      <div className="text-[10px] text-text-tertiary truncate">{p.parentPath}</div>
                      {p.status === 'error' && p.error && (
                        <div className="text-[10px] text-status-red truncate mt-0.5">{p.error}</div>
                      )}
                    </div>

                    {p.status === 'done' && (
                      <div className="text-[10px] text-text-tertiary font-mono shrink-0">
                        {p.inputCount}I / {p.outputCount}O
                        {(p.featureCount || 0) > 0 && ` / ${p.featureCount}F`}
                        {(p.useCaseCount || 0) > 0 && ` / ${p.useCaseCount}U`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          {progress.length === 0 ? (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="ai"
                size="sm"
                icon={<Sparkles size={12} />}
                disabled={blankL3s.length === 0}
                onClick={handleStart}
              >
                Start ({blankL3s.length})
              </Button>
            </>
          ) : running ? (
            <Button variant="secondary" size="sm" onClick={handleAbort}>
              Stop after current
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
