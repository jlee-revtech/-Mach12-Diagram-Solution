'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={running ? undefined : onClose} />

      {/* Panel */}
      <div className="relative bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-2xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--m12-border)]/20">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#2563EB] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L7.5 4.5L11 5.5L8.5 8L9 11.5L6 10L3 11.5L3.5 8L1 5.5L4.5 4.5L6 1Z" fill="white" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-[var(--m12-text)]">AI: Fill Blank L3s</div>
            <div className="text-[10px] text-[var(--m12-text-muted)]">
              {mode === 'use-cases'
                ? 'Generate use cases for every L3 that has none. Suggestions are applied automatically.'
                : 'Auto-generate SIPOC for every L3 with no inputs or outputs. Suggestions are applied automatically.'}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={running}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 10L10 2M2 2l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {progress.length === 0 && (
            <div className="flex items-center gap-2">
              <div className="text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold">
                Scope
              </div>
              <div className="flex items-center gap-1 bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded-lg p-0.5">
                {([
                  { value: 'full', label: 'Full SIPOC (no inputs/outputs)' },
                  { value: 'use-cases', label: 'Use cases only (no use cases)' },
                ] as { value: FillMode; label: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={`text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider px-2 py-1 rounded transition-colors ${
                      mode === opt.value
                        ? 'bg-[#2563EB] text-white'
                        : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]'
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
              <div className="text-center py-12">
                <div className="text-sm text-[var(--m12-text)] font-medium mb-1">
                  {mode === 'use-cases' ? 'No L3s without use cases' : 'No blank L3s found'}
                </div>
                <div className="text-[11px] text-[var(--m12-text-muted)]">
                  {mode === 'use-cases'
                    ? 'Every L3 in this map already has at least one use case.'
                    : 'Every L3 in this map already has inputs or outputs. Add a new L3 first if you want to use this.'}
                </div>
              </div>
            ) : (
              <>
                <div className="text-[10px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[var(--m12-text-muted)] font-bold">
                  {blankL3s.length} L3{blankL3s.length === 1 ? '' : 's'} ready to process
                  {mode === 'use-cases' ? ' (no use cases)' : ' (blank)'}
                </div>
                <div className="space-y-1">
                  {blankL3s.map(l3 => (
                    <div key={l3.id} className="flex items-center gap-2 px-3 py-2 bg-[var(--m12-bg)] border border-[var(--m12-border)]/20 rounded-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--m12-text-muted)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-[var(--m12-text)] truncate">{l3.name}</div>
                        <div className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] truncate">{l3.parentPath}</div>
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
                <div className="text-[10px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[var(--m12-text-muted)] font-bold">
                  {done ? 'Complete' : 'Processing'}
                </div>
                <div className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
                  {completedCount} done
                  {errorCount > 0 && <span className="text-red-400"> · {errorCount} error{errorCount === 1 ? '' : 's'}</span>}
                  {skippedCount > 0 && <span className="text-[var(--m12-text-faint)]"> · {skippedCount} skipped</span>}
                  {' · '}{progress.length} total
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1 bg-[var(--m12-bg)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#2563EB] transition-all duration-300"
                  style={{ width: `${((completedCount + errorCount + skippedCount) / progress.length) * 100}%` }}
                />
              </div>
              <div className="space-y-1">
                {progress.map(p => (
                  <div
                    key={p.capabilityId}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      p.status === 'running'
                        ? 'border-[#2563EB]/40 bg-[#2563EB]/5'
                        : p.status === 'done'
                          ? 'border-[#10B981]/30 bg-[#10B981]/5'
                          : p.status === 'error'
                            ? 'border-red-400/30 bg-red-400/5'
                            : p.status === 'skipped'
                              ? 'border-[var(--m12-border)]/20 bg-transparent opacity-50'
                              : 'border-[var(--m12-border)]/20 bg-[var(--m12-bg)]'
                    }`}
                  >
                    {/* Status icon */}
                    <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                      {p.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-[var(--m12-text-faint)]" />}
                      {p.status === 'running' && (
                        <svg className="animate-spin w-3.5 h-3.5 text-[#2563EB]" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                        </svg>
                      )}
                      {p.status === 'done' && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#10B981]">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {p.status === 'error' && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-red-400">
                          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                      {p.status === 'skipped' && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[var(--m12-text-faint)]">
                          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-[var(--m12-text)] truncate">{p.capabilityName}</div>
                      <div className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] truncate">{p.parentPath}</div>
                      {p.status === 'error' && p.error && (
                        <div className="text-[9px] text-red-400 truncate mt-0.5">{p.error}</div>
                      )}
                    </div>

                    {p.status === 'done' && (
                      <div className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] shrink-0">
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
        <div className="px-5 py-3 border-t border-[var(--m12-border)]/20 flex items-center justify-end gap-2">
          {progress.length === 0 ? (
            <>
              <button
                onClick={onClose}
                className="text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={blankL3s.length === 0}
                className="bg-gradient-to-r from-[#8B5CF6] to-[#2563EB] hover:from-[#7C3AED] hover:to-[#3B82F6] disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-1.5 rounded-lg text-xs font-medium transition-all"
              >
                Start ({blankL3s.length})
              </button>
            </>
          ) : running ? (
            <button
              onClick={handleAbort}
              className="border border-[var(--m12-border)]/40 hover:border-red-400/40 text-[var(--m12-text-muted)] hover:text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              Stop after current
            </button>
          ) : (
            <button
              onClick={onClose}
              className="bg-[#2563EB] hover:bg-[#3B82F6] text-white px-5 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
