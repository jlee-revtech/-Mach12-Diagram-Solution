'use client'

import { useState, useCallback } from 'react'
import { X, Check, Sparkles } from 'lucide-react'
import { Button, EmptyState, LoadingState } from '@/components/common'
import { useSIPOCStore } from '@/lib/sipoc/store'
import { PERSONA_COLORS } from '@/lib/sipoc/types'

// ─── Types for the AI response ──────────────────────────
interface AISuggestionInput {
  status: 'new' | 'enhancement'
  existingProduct?: string
  informationProduct: string
  category?: string
  supplierPersonas: { name: string; role?: string }[]
  sourceSystems: { name: string; systemType?: string }[]
  dimensions: { name: string }[]
}

interface AISuggestionOutput {
  status: 'new' | 'enhancement'
  existingProduct?: string
  informationProduct: string
  category?: string
  consumerPersonas: { name: string; role?: string }[]
  dimensions: { name: string }[]
}

interface AISuggestion {
  inputs: AISuggestionInput[]
  outputs: AISuggestionOutput[]
  features?: string[]
  use_cases?: string[]
}

type GenerateScope = 'full' | 'use-cases'

// ─── Selection state ────────────────────────────────────
interface SelectionState {
  inputs: Record<number, {
    selected: boolean
    dimensions: Record<number, boolean>
    personas: Record<number, boolean>
    systems: Record<number, boolean>
  }>
  outputs: Record<number, {
    selected: boolean
    dimensions: Record<number, boolean>
    personas: Record<number, boolean>
  }>
  features: Record<number, boolean>
  useCases: Record<number, boolean>
}

function initSelection(suggestion: AISuggestion): SelectionState {
  const inputs: SelectionState['inputs'] = {}
  suggestion.inputs.forEach((inp, i) => {
    inputs[i] = {
      selected: true,
      dimensions: Object.fromEntries(inp.dimensions.map((_, di) => [di, true])),
      personas: Object.fromEntries(inp.supplierPersonas.map((_, pi) => [pi, true])),
      systems: Object.fromEntries(inp.sourceSystems.map((_, si) => [si, true])),
    }
  })
  const outputs: SelectionState['outputs'] = {}
  suggestion.outputs.forEach((out, i) => {
    outputs[i] = {
      selected: true,
      dimensions: Object.fromEntries(out.dimensions.map((_, di) => [di, true])),
      personas: Object.fromEntries(out.consumerPersonas.map((_, pi) => [pi, true])),
    }
  })
  const features = Object.fromEntries((suggestion.features || []).map((_, i) => [i, true]))
  const useCases = Object.fromEntries((suggestion.use_cases || []).map((_, i) => [i, true]))
  return { inputs, outputs, features, useCases }
}

// ─── Checkbox component ─────────────────────────────────
function CheckBox({ checked, onChange, size = 'sm' }: { checked: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'w-4 h-4' : 'w-3 h-3'
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`${dim} rounded border flex items-center justify-center shrink-0 transition-colors ${
        checked
          ? 'bg-brand-500 border-brand-500'
          : 'border-border hover:border-border-strong'
      }`}
    >
      {checked && <Check size={size === 'md' ? 10 : 8} className="text-white" />}
    </button>
  )
}

// ─── Section letter chip (I / O / F / U) ────────────────
function SectionChip({ letter, classes }: { letter: string; classes: string }) {
  return (
    <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold font-display ${classes}`}>
      {letter}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────
export default function AIGeneratePanel({
  capabilityId,
  orgId,
  initialPrompt,
  onClose,
}: {
  capabilityId: string
  orgId: string
  initialPrompt?: string
  onClose: () => void
}) {
  const capabilities = useSIPOCStore(s => s.capabilities)
  const personas = useSIPOCStore(s => s.personas)
  const informationProducts = useSIPOCStore(s => s.informationProducts)
  const logicalSystems = useSIPOCStore(s => s.logicalSystems)
  const capInputs = useSIPOCStore(s => s.inputs[capabilityId] || [])
  const capOutputs = useSIPOCStore(s => s.outputs[capabilityId] || [])

  const capability = capabilities.find(c => c.id === capabilityId)
  const hasExistingData = capInputs.length > 0 || capOutputs.length > 0

  const [prompt, setPrompt] = useState(initialPrompt || capability?.name || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [applying, setApplying] = useState(false)
  const [scope, setScope] = useState<GenerateScope>('full')

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setSuggestion(null)

    // Build current capability data for enhancement mode
    const hydrated = useSIPOCStore.getState().getHydratedCapabilities()
    const currentCap = hydrated.find(c => c.id === capabilityId)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sipoc-generate',
          prompt: prompt.trim(),
          scope,
          context: {
            capabilityName: capability?.name,
            capabilityFeatures: capability?.features || [],
            capabilityUseCases: capability?.use_cases || [],
            existingPersonas: personas.map(p => p.name),
            existingInformationProducts: informationProducts.map(ip => ip.name),
            existingLogicalSystems: logicalSystems.map(s => s.name),
            currentInputs: currentCap?.inputs.map(inp => ({
              informationProduct: inp.informationProduct.name,
              category: inp.informationProduct.category,
              supplierPersonas: inp.supplierPersonas.map(p => p.name),
              sourceSystems: inp.sourceSystems.map(s => s.name),
              dimensions: (inp.dimensions || []).map(d => d.name),
            })) || [],
            currentOutputs: currentCap?.outputs.map(out => ({
              informationProduct: out.informationProduct.name,
              category: out.informationProduct.category,
              consumerPersonas: out.consumerPersonas.map(p => p.name),
              dimensions: (out.dimensions || []).map(d => d.name),
            })) || [],
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'AI request failed')
      }

      const data: AISuggestion = await res.json()
      setSuggestion(data)
      setSelection(initSelection(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [prompt, scope, capability, capabilityId, personas, informationProducts, logicalSystems])

  const handleApply = useCallback(async () => {
    if (!suggestion || !selection || !capabilityId) return
    setApplying(true)

    const store = useSIPOCStore.getState()

    // Helper: find or create persona
    const getOrCreatePersona = async (name: string, role?: string) => {
      const existing = store.personas.find(p => p.name.toLowerCase() === name.toLowerCase())
      if (existing) return existing.id
      const colorIdx = store.personas.length % PERSONA_COLORS.length
      const created = await store.addPersona(orgId, { name, role, color: PERSONA_COLORS[colorIdx] })
      return created.id
    }

    // Helper: find or create info product
    const getOrCreateIP = async (name: string, category?: string) => {
      const existing = store.informationProducts.find(ip => ip.name.toLowerCase() === name.toLowerCase())
      if (existing) return existing.id
      const created = await store.addInformationProduct(orgId, { name, category })
      return created.id
    }

    // Helper: find or create logical system
    const getOrCreateSystem = async (name: string, systemType?: string) => {
      const existing = store.logicalSystems.find(s => s.name.toLowerCase() === name.toLowerCase())
      if (existing) return existing.id
      const created = await store.addLogicalSystem(orgId, { name, system_type: systemType })
      return created.id
    }

    try {
      // Process selected inputs
      for (const [idxStr, inputSel] of Object.entries(selection.inputs)) {
        if (!inputSel.selected) continue
        const idx = Number(idxStr)
        const inp = suggestion.inputs[idx]
        const isEnhancement = inp.status === 'enhancement'

        // Resolve the information product
        const ipId = await getOrCreateIP(inp.informationProduct, inp.category)

        // For enhancements, find the existing input record; for new, create one
        let targetInput: { id: string; supplier_persona_ids: string[]; source_system_ids: string[] } | undefined

        if (isEnhancement) {
          const currentInputs = useSIPOCStore.getState().inputs[capabilityId] || []
          // Match by IP name (case-insensitive) against existing inputs
          const matchName = (inp.existingProduct || inp.informationProduct).toLowerCase()
          const existingIPs = useSIPOCStore.getState().informationProducts
          targetInput = currentInputs.find(ci => {
            const cipName = existingIPs.find(ip => ip.id === ci.information_product_id)?.name?.toLowerCase()
            return cipName === matchName
          })
        }

        if (!targetInput) {
          // Create new input
          await store.addInput(capabilityId, ipId)
          const currentInputs = useSIPOCStore.getState().inputs[capabilityId] || []
          targetInput = currentInputs.find(i => i.information_product_id === ipId)
        }

        if (!targetInput) continue

        // Add supplier personas (merge with existing)
        const newSupplierIds: string[] = [...(targetInput.supplier_persona_ids || [])]
        for (const [pi, selected] of Object.entries(inputSel.personas)) {
          if (!selected) continue
          const persona = inp.supplierPersonas[Number(pi)]
          const personaId = await getOrCreatePersona(persona.name, persona.role)
          if (!newSupplierIds.includes(personaId)) newSupplierIds.push(personaId)
        }
        if (newSupplierIds.length > (targetInput.supplier_persona_ids || []).length) {
          await store.updateInputSuppliers(targetInput.id, capabilityId, newSupplierIds)
        }

        // Add source systems (merge with existing)
        const newSystemIds: string[] = [...(targetInput.source_system_ids || [])]
        for (const [si, selected] of Object.entries(inputSel.systems)) {
          if (!selected) continue
          const sys = inp.sourceSystems[Number(si)]
          const sysId = await getOrCreateSystem(sys.name, sys.systemType)
          if (!newSystemIds.includes(sysId)) newSystemIds.push(sysId)
        }
        if (newSystemIds.length > (targetInput.source_system_ids || []).length) {
          await store.updateInputSystems(targetInput.id, capabilityId, newSystemIds)
        }

        // Add dimensions
        for (const [di, selected] of Object.entries(inputSel.dimensions)) {
          if (!selected) continue
          const dim = inp.dimensions[Number(di)]
          await store.addDimension('input', targetInput.id, capabilityId, dim.name)
        }
      }

      // Process selected outputs
      for (const [idxStr, outputSel] of Object.entries(selection.outputs)) {
        if (!outputSel.selected) continue
        const idx = Number(idxStr)
        const out = suggestion.outputs[idx]
        const isEnhancement = out.status === 'enhancement'

        const ipId = await getOrCreateIP(out.informationProduct, out.category)

        let targetOutput: { id: string; consumer_persona_ids: string[] } | undefined

        if (isEnhancement) {
          const currentOutputs = useSIPOCStore.getState().outputs[capabilityId] || []
          const matchName = (out.existingProduct || out.informationProduct).toLowerCase()
          const existingIPs = useSIPOCStore.getState().informationProducts
          targetOutput = currentOutputs.find(co => {
            const copName = existingIPs.find(ip => ip.id === co.information_product_id)?.name?.toLowerCase()
            return copName === matchName
          })
        }

        if (!targetOutput) {
          await store.addOutput(capabilityId, ipId)
          const currentOutputs = useSIPOCStore.getState().outputs[capabilityId] || []
          targetOutput = currentOutputs.find(o => o.information_product_id === ipId)
        }

        if (!targetOutput) continue

        // Add consumer personas (merge with existing)
        const newConsumerIds: string[] = [...(targetOutput.consumer_persona_ids || [])]
        for (const [pi, selected] of Object.entries(outputSel.personas)) {
          if (!selected) continue
          const persona = out.consumerPersonas[Number(pi)]
          const personaId = await getOrCreatePersona(persona.name, persona.role)
          if (!newConsumerIds.includes(personaId)) newConsumerIds.push(personaId)
        }
        if (newConsumerIds.length > (targetOutput.consumer_persona_ids || []).length) {
          await store.updateOutputConsumers(targetOutput.id, capabilityId, newConsumerIds)
        }

        // Add dimensions
        for (const [di, selected] of Object.entries(outputSel.dimensions)) {
          if (!selected) continue
          const dim = out.dimensions[Number(di)]
          await store.addDimension('output', targetOutput.id, capabilityId, dim.name)
        }
      }

      // Merge selected features and use cases into the capability
      const cap = store.capabilities.find(c => c.id === capabilityId)
      if (cap) {
        const selectedFeatures = (suggestion.features || [])
          .filter((_, i) => selection.features[i])
          .map(f => f.trim())
          .filter(f => f.length > 0)
        const selectedUseCases = (suggestion.use_cases || [])
          .filter((_, i) => selection.useCases[i])
          .map(u => u.trim())
          .filter(u => u.length > 0)

        const existingFeatures = cap.features || []
        const existingUseCases = cap.use_cases || []
        const dedupe = (arr: string[]) => {
          const seen = new Set<string>()
          return arr.filter(v => {
            const k = v.toLowerCase()
            if (seen.has(k)) return false
            seen.add(k)
            return true
          })
        }

        const updates: { features?: string[]; use_cases?: string[] } = {}
        if (selectedFeatures.length > 0) {
          updates.features = dedupe([...existingFeatures, ...selectedFeatures])
        }
        if (selectedUseCases.length > 0) {
          updates.use_cases = dedupe([...existingUseCases, ...selectedUseCases])
        }
        if (updates.features || updates.use_cases) {
          await store.updateCapability(capabilityId, updates)
        }
      }

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply')
    } finally {
      setApplying(false)
    }
  }, [suggestion, selection, capabilityId, orgId, onClose])

  // ─── Toggle helpers ───────────────────────────────────
  const toggleInput = (idx: number) => {
    setSelection(prev => prev ? {
      ...prev,
      inputs: { ...prev.inputs, [idx]: { ...prev.inputs[idx], selected: !prev.inputs[idx].selected } },
    } : null)
  }

  const toggleInputDim = (idx: number, di: number) => {
    setSelection(prev => prev ? {
      ...prev,
      inputs: { ...prev.inputs, [idx]: { ...prev.inputs[idx], dimensions: { ...prev.inputs[idx].dimensions, [di]: !prev.inputs[idx].dimensions[di] } } },
    } : null)
  }

  const toggleInputPersona = (idx: number, pi: number) => {
    setSelection(prev => prev ? {
      ...prev,
      inputs: { ...prev.inputs, [idx]: { ...prev.inputs[idx], personas: { ...prev.inputs[idx].personas, [pi]: !prev.inputs[idx].personas[pi] } } },
    } : null)
  }

  const toggleInputSystem = (idx: number, si: number) => {
    setSelection(prev => prev ? {
      ...prev,
      inputs: { ...prev.inputs, [idx]: { ...prev.inputs[idx], systems: { ...prev.inputs[idx].systems, [si]: !prev.inputs[idx].systems[si] } } },
    } : null)
  }

  const toggleOutput = (idx: number) => {
    setSelection(prev => prev ? {
      ...prev,
      outputs: { ...prev.outputs, [idx]: { ...prev.outputs[idx], selected: !prev.outputs[idx].selected } },
    } : null)
  }

  const toggleOutputDim = (idx: number, di: number) => {
    setSelection(prev => prev ? {
      ...prev,
      outputs: { ...prev.outputs, [idx]: { ...prev.outputs[idx], dimensions: { ...prev.outputs[idx].dimensions, [di]: !prev.outputs[idx].dimensions[di] } } },
    } : null)
  }

  const toggleOutputPersona = (idx: number, pi: number) => {
    setSelection(prev => prev ? {
      ...prev,
      outputs: { ...prev.outputs, [idx]: { ...prev.outputs[idx], personas: { ...prev.outputs[idx].personas, [pi]: !prev.outputs[idx].personas[pi] } } },
    } : null)
  }

  const toggleFeature = (i: number) => {
    setSelection(prev => prev ? {
      ...prev,
      features: { ...prev.features, [i]: !prev.features[i] },
    } : null)
  }

  const toggleUseCase = (i: number) => {
    setSelection(prev => prev ? {
      ...prev,
      useCases: { ...prev.useCases, [i]: !prev.useCases[i] },
    } : null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-card-hover w-[720px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Sparkles size={16} className="text-amber-600" />
            </div>
            <div>
              <div className="text-heading-sm font-display text-text-primary">AI SIPOC Generator</div>
              <div className="text-[11px] text-text-tertiary">
                {capability ? `For: ${capability.name}` : 'Generate SIPOC data'}
                {hasExistingData && <span className="ml-1.5 text-brand-600">(Enhancement mode)</span>}
              </div>
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

        {/* Prompt input */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="text-label uppercase text-text-secondary">
              Describe the L3 capability or process
            </div>
            <div className="flex items-center gap-1 bg-surface-input border border-border rounded-lg p-0.5">
              {([
                { value: 'full', label: 'Full SIPOC' },
                { value: 'use-cases', label: 'Use cases only' },
              ] as { value: GenerateScope; label: string }[]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScope(opt.value)}
                  className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded transition-colors ${
                    scope === opt.value
                      ? 'bg-brand-500 text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleGenerate() }}
              placeholder="e.g., External Market Inputs - gathering cost, labor, and rate data for proposals and estimates..."
              rows={8}
              className="flex-1 bg-surface-input border border-border rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-y min-h-[160px]"
            />
            <Button
              variant="ai"
              size="md"
              icon={<Sparkles size={14} />}
              loading={loading}
              disabled={!prompt.trim()}
              onClick={handleGenerate}
              className="self-end shrink-0"
            >
              Generate
            </Button>
          </div>
          {error && (
            <div className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && !suggestion && (
            <LoadingState
              variant="inline"
              label="Analyzing capability and generating SIPOC data..."
            />
          )}

          {suggestion && selection && (
            <div className="space-y-5">
              {/* INPUTS */}
              {suggestion.inputs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <SectionChip letter="I" classes="bg-status-yellow-bg text-status-yellow" />
                  <span className="text-body-sm font-semibold text-text-primary">Inputs</span>
                  <span className="text-[11px] text-text-tertiary">{suggestion.inputs.length}</span>
                </div>
                <div className="space-y-2">
                  {suggestion.inputs.map((inp, idx) => (
                    <div key={idx} className={`bg-white border rounded-lg transition-all ${selection.inputs[idx]?.selected ? 'border-brand-300 shadow-card' : 'border-border opacity-50'}`}>
                      {/* Input header */}
                      <div className="flex items-start gap-2 px-3 py-2.5">
                        <CheckBox checked={selection.inputs[idx]?.selected} onChange={() => toggleInput(idx)} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-body-sm font-semibold text-text-primary">{inp.informationProduct}</div>
                            <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              inp.status === 'enhancement'
                                ? 'bg-status-blue-bg text-status-blue'
                                : 'bg-status-green-bg text-status-green'
                            }`}>
                              {inp.status === 'enhancement' ? 'Enhance' : 'New'}
                            </span>
                          </div>
                          {inp.category && (
                            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">{inp.category}</span>
                          )}
                        </div>
                      </div>

                      {selection.inputs[idx]?.selected && (
                        <div className="px-3 pb-3 space-y-2.5 border-t border-border pt-2">
                          {/* Supplier Personas */}
                          <div>
                            <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 font-medium">Suppliers</div>
                            <div className="flex flex-wrap gap-1.5">
                              {inp.supplierPersonas.map((p, pi) => (
                                <button key={pi} onClick={() => toggleInputPersona(idx, pi)}
                                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                    selection.inputs[idx]?.personas[pi]
                                      ? 'border-[#F97316]/40 bg-[#F97316]/10 text-text-primary'
                                      : 'border-border text-text-tertiary line-through'
                                  }`}
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Source Systems */}
                          {inp.sourceSystems.length > 0 && (
                            <div>
                              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 font-medium">Source Systems</div>
                              <div className="flex flex-wrap gap-1.5">
                                {inp.sourceSystems.map((s, si) => (
                                  <button key={si} onClick={() => toggleInputSystem(idx, si)}
                                    className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border uppercase transition-colors ${
                                      selection.inputs[idx]?.systems[si]
                                        ? 'border-border bg-surface-muted text-text-secondary'
                                        : 'border-border/50 text-text-tertiary line-through'
                                    }`}
                                  >
                                    {s.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dimensions */}
                          {inp.dimensions.length > 0 && (
                            <div>
                              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 font-medium">Dimensions</div>
                              <div className="border-l-2 border-border ml-1 pl-2 space-y-0.5">
                                {inp.dimensions.map((dim, di) => (
                                  <div key={di} className="flex items-center gap-1.5">
                                    <CheckBox checked={selection.inputs[idx]?.dimensions[di] ?? true} onChange={() => toggleInputDim(idx, di)} />
                                    <span className={`text-[11px] ${selection.inputs[idx]?.dimensions[di] ? 'text-text-secondary' : 'text-text-tertiary line-through'}`}>
                                      {dim.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* OUTPUTS */}
              {suggestion.outputs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <SectionChip letter="O" classes="bg-status-green-bg text-status-green" />
                  <span className="text-body-sm font-semibold text-text-primary">Outputs</span>
                  <span className="text-[11px] text-text-tertiary">{suggestion.outputs.length}</span>
                </div>
                <div className="space-y-2">
                  {suggestion.outputs.map((out, idx) => (
                    <div key={idx} className={`bg-white border rounded-lg transition-all ${selection.outputs[idx]?.selected ? 'border-brand-300 shadow-card' : 'border-border opacity-50'}`}>
                      {/* Output header */}
                      <div className="flex items-start gap-2 px-3 py-2.5">
                        <CheckBox checked={selection.outputs[idx]?.selected} onChange={() => toggleOutput(idx)} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-body-sm font-semibold text-text-primary">{out.informationProduct}</div>
                            <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              out.status === 'enhancement'
                                ? 'bg-status-blue-bg text-status-blue'
                                : 'bg-status-green-bg text-status-green'
                            }`}>
                              {out.status === 'enhancement' ? 'Enhance' : 'New'}
                            </span>
                          </div>
                          {out.category && (
                            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">{out.category}</span>
                          )}
                        </div>
                      </div>

                      {selection.outputs[idx]?.selected && (
                        <div className="px-3 pb-3 space-y-2.5 border-t border-border pt-2">
                          {/* Consumer Personas */}
                          <div>
                            <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 font-medium">Consumers</div>
                            <div className="flex flex-wrap gap-1.5">
                              {out.consumerPersonas.map((p, pi) => (
                                <button key={pi} onClick={() => toggleOutputPersona(idx, pi)}
                                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                    selection.outputs[idx]?.personas[pi]
                                      ? 'border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-text-primary'
                                      : 'border-border text-text-tertiary line-through'
                                  }`}
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Dimensions */}
                          {out.dimensions.length > 0 && (
                            <div>
                              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 font-medium">Dimensions</div>
                              <div className="border-l-2 border-border ml-1 pl-2 space-y-0.5">
                                {out.dimensions.map((dim, di) => (
                                  <div key={di} className="flex items-center gap-1.5">
                                    <CheckBox checked={selection.outputs[idx]?.dimensions[di] ?? true} onChange={() => toggleOutputDim(idx, di)} />
                                    <span className={`text-[11px] ${selection.outputs[idx]?.dimensions[di] ? 'text-text-secondary' : 'text-text-tertiary line-through'}`}>
                                      {dim.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* FEATURES */}
              {(suggestion.features && suggestion.features.length > 0) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <SectionChip letter="F" classes="bg-purple-50 text-purple-600" />
                    <span className="text-body-sm font-semibold text-text-primary">Features</span>
                    <span className="text-[11px] text-text-tertiary">{suggestion.features.length}</span>
                    <span className="text-[11px] text-text-tertiary">sub-capabilities of this L3</span>
                  </div>
                  <div className="space-y-1.5">
                    {suggestion.features.map((f, i) => (
                      <div key={i} className={`flex items-start gap-2 px-3 py-2 bg-white border rounded-lg transition-all ${selection.features[i] ? 'border-brand-300' : 'border-border opacity-50'}`}>
                        <CheckBox checked={selection.features[i] ?? true} onChange={() => toggleFeature(i)} size="md" />
                        <span className={`text-body-sm leading-snug ${selection.features[i] ? 'text-text-primary' : 'text-text-tertiary line-through'}`}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* USE CASES */}
              {(suggestion.use_cases && suggestion.use_cases.length > 0) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <SectionChip letter="U" classes="bg-cyan-50 text-cyan-600" />
                    <span className="text-body-sm font-semibold text-text-primary">Use Cases</span>
                    <span className="text-[11px] text-text-tertiary">{suggestion.use_cases.length}</span>
                    <span className="text-[11px] text-text-tertiary">concrete scenarios</span>
                  </div>
                  <div className="space-y-1.5">
                    {suggestion.use_cases.map((u, i) => (
                      <div key={i} className={`flex items-start gap-2 px-3 py-2 bg-white border rounded-lg transition-all ${selection.useCases[i] ? 'border-brand-300' : 'border-border opacity-50'}`}>
                        <CheckBox checked={selection.useCases[i] ?? true} onChange={() => toggleUseCase(i)} size="md" />
                        <span className={`text-body-sm leading-snug ${selection.useCases[i] ? 'text-text-primary' : 'text-text-tertiary line-through'}`}>{u}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !suggestion && (
            <EmptyState
              variant="inline"
              icon={<Sparkles size={32} />}
              title="Describe the capability to generate SIPOC suggestions"
              description="Cmd+Enter to generate"
            />
          )}
        </div>

        {/* Footer: Apply button */}
        {suggestion && selection && (
          <div className="px-6 py-3 border-t border-border flex items-center justify-between">
            <div className="text-[11px] text-text-tertiary">
              {[
                suggestion.inputs.length > 0 && `${Object.values(selection.inputs).filter(i => i.selected).length} inputs`,
                suggestion.outputs.length > 0 && `${Object.values(selection.outputs).filter(o => o.selected).length} outputs`,
                (suggestion.features?.length || 0) > 0 && `${Object.values(selection.features).filter(Boolean).length} features`,
                (suggestion.use_cases?.length || 0) > 0 && `${Object.values(selection.useCases).filter(Boolean).length} use cases`,
              ].filter(Boolean).join(', ')} selected
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={loading} onClick={handleGenerate}>
                Regenerate
              </Button>
              <Button variant="primary" size="sm" loading={applying} onClick={handleApply}>
                {applying ? 'Applying...' : 'Apply Selected'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
