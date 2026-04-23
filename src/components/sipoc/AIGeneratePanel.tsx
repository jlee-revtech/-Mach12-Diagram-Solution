'use client'

import { useState, useCallback } from 'react'
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
function Check({ checked, onChange, size = 'sm' }: { checked: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'w-4 h-4' : 'w-3 h-3'
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`${dim} rounded border flex items-center justify-center shrink-0 transition-colors ${
        checked
          ? 'bg-[#2563EB] border-[#2563EB]'
          : 'border-[var(--m12-border)] hover:border-[var(--m12-text-muted)]'
      }`}
    >
      {checked && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
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
  }, [prompt, capability, capabilityId, personas, informationProducts, logicalSystems])

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-2xl shadow-2xl w-[720px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--m12-border)]/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#2563EB] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L10 6L14 7L11 10L12 14L8 12L4 14L5 10L2 7L6 6L8 2Z" fill="white" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--m12-text)]">AI SIPOC Generator</div>
              <div className="text-[10px] text-[var(--m12-text-muted)]">
                {capability ? `For: ${capability.name}` : 'Generate SIPOC data'}
                {hasExistingData && <span className="ml-1.5 text-[#06B6D4]">(Enhancement mode)</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Prompt input */}
        <div className="px-6 py-4 border-b border-[var(--m12-border)]/20">
          <div className="text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold mb-2">
            Describe the L3 capability or process
          </div>
          <div className="flex gap-2">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleGenerate() }}
              placeholder="e.g., External Market Inputs - gathering cost, labor, and rate data for proposals and estimates..."
              rows={8}
              className="flex-1 bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60 resize-y min-h-[160px]"
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="self-end bg-gradient-to-r from-[#8B5CF6] to-[#2563EB] hover:from-[#7C3AED] hover:to-[#3B82F6] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-xs font-medium transition-all shrink-0"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                  </svg>
                  Generating...
                </span>
              ) : 'Generate'}
            </button>
          </div>
          {error && (
            <div className="mt-2 text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">{error}</div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && !suggestion && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="animate-spin w-8 h-8 text-[#2563EB]" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
              </svg>
              <span className="text-xs text-[var(--m12-text-muted)]">Analyzing capability and generating SIPOC data...</span>
            </div>
          )}

          {suggestion && selection && (
            <div className="space-y-5">
              {/* INPUTS */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded bg-[#EAB308]/20 flex items-center justify-center text-[#EAB308] text-[9px] font-bold font-[family-name:var(--font-orbitron)]">I</div>
                  <span className="text-xs font-semibold text-[var(--m12-text)]">Inputs</span>
                  <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">{suggestion.inputs.length}</span>
                </div>
                <div className="space-y-2">
                  {suggestion.inputs.map((inp, idx) => (
                    <div key={idx} className={`border rounded-lg transition-all ${selection.inputs[idx]?.selected ? 'border-[#EAB308]/40 bg-[#EAB308]/[0.03]' : 'border-[var(--m12-border)]/20 opacity-50'}`}>
                      {/* Input header */}
                      <div className="flex items-start gap-2 px-3 py-2.5">
                        <Check checked={selection.inputs[idx]?.selected} onChange={() => toggleInput(idx)} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] font-semibold text-[var(--m12-text)]">{inp.informationProduct}</div>
                            <span className={`text-[7px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              inp.status === 'enhancement'
                                ? 'bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/30'
                                : 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                            }`}>
                              {inp.status === 'enhancement' ? 'Enhance' : 'New'}
                            </span>
                          </div>
                          {inp.category && (
                            <span className="text-[8px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase">{inp.category}</span>
                          )}
                        </div>
                      </div>

                      {selection.inputs[idx]?.selected && (
                        <div className="px-3 pb-3 space-y-2.5 border-t border-[var(--m12-border)]/10 pt-2">
                          {/* Supplier Personas */}
                          <div>
                            <div className="text-[8px] text-[var(--m12-text-muted)] uppercase tracking-wider mb-1 font-[family-name:var(--font-space-mono)] font-bold">Suppliers</div>
                            <div className="flex flex-wrap gap-1.5">
                              {inp.supplierPersonas.map((p, pi) => (
                                <button key={pi} onClick={() => toggleInputPersona(idx, pi)}
                                  className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                                    selection.inputs[idx]?.personas[pi]
                                      ? 'border-[#F97316]/40 bg-[#F97316]/10 text-[var(--m12-text)]'
                                      : 'border-[var(--m12-border)]/20 text-[var(--m12-text-muted)] line-through'
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
                              <div className="text-[8px] text-[var(--m12-text-muted)] uppercase tracking-wider mb-1 font-[family-name:var(--font-space-mono)] font-bold">Source Systems</div>
                              <div className="flex flex-wrap gap-1.5">
                                {inp.sourceSystems.map((s, si) => (
                                  <button key={si} onClick={() => toggleInputSystem(idx, si)}
                                    className={`flex items-center gap-1 text-[8px] px-2 py-0.5 rounded border font-[family-name:var(--font-space-mono)] uppercase transition-colors ${
                                      selection.inputs[idx]?.systems[si]
                                        ? 'border-[var(--m12-border)]/40 bg-[var(--m12-bg)] text-[var(--m12-text-secondary)]'
                                        : 'border-[var(--m12-border)]/15 text-[var(--m12-text-muted)] line-through'
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
                              <div className="text-[8px] text-[var(--m12-text-muted)] uppercase tracking-wider mb-1 font-[family-name:var(--font-space-mono)] font-bold">Dimensions</div>
                              <div className="border-l-2 border-[var(--m12-border)]/15 ml-1 pl-2 space-y-0.5">
                                {inp.dimensions.map((dim, di) => (
                                  <div key={di} className="flex items-center gap-1.5">
                                    <Check checked={selection.inputs[idx]?.dimensions[di] ?? true} onChange={() => toggleInputDim(idx, di)} />
                                    <span className={`text-[9px] ${selection.inputs[idx]?.dimensions[di] ? 'text-[var(--m12-text-secondary)]' : 'text-[var(--m12-text-muted)] line-through'}`}>
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

              {/* OUTPUTS */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded bg-[#10B981]/20 flex items-center justify-center text-[#10B981] text-[9px] font-bold font-[family-name:var(--font-orbitron)]">O</div>
                  <span className="text-xs font-semibold text-[var(--m12-text)]">Outputs</span>
                  <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">{suggestion.outputs.length}</span>
                </div>
                <div className="space-y-2">
                  {suggestion.outputs.map((out, idx) => (
                    <div key={idx} className={`border rounded-lg transition-all ${selection.outputs[idx]?.selected ? 'border-[#10B981]/40 bg-[#10B981]/[0.03]' : 'border-[var(--m12-border)]/20 opacity-50'}`}>
                      {/* Output header */}
                      <div className="flex items-start gap-2 px-3 py-2.5">
                        <Check checked={selection.outputs[idx]?.selected} onChange={() => toggleOutput(idx)} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] font-semibold text-[var(--m12-text)]">{out.informationProduct}</div>
                            <span className={`text-[7px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              out.status === 'enhancement'
                                ? 'bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/30'
                                : 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                            }`}>
                              {out.status === 'enhancement' ? 'Enhance' : 'New'}
                            </span>
                          </div>
                          {out.category && (
                            <span className="text-[8px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase">{out.category}</span>
                          )}
                        </div>
                      </div>

                      {selection.outputs[idx]?.selected && (
                        <div className="px-3 pb-3 space-y-2.5 border-t border-[var(--m12-border)]/10 pt-2">
                          {/* Consumer Personas */}
                          <div>
                            <div className="text-[8px] text-[var(--m12-text-muted)] uppercase tracking-wider mb-1 font-[family-name:var(--font-space-mono)] font-bold">Consumers</div>
                            <div className="flex flex-wrap gap-1.5">
                              {out.consumerPersonas.map((p, pi) => (
                                <button key={pi} onClick={() => toggleOutputPersona(idx, pi)}
                                  className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                                    selection.outputs[idx]?.personas[pi]
                                      ? 'border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-[var(--m12-text)]'
                                      : 'border-[var(--m12-border)]/20 text-[var(--m12-text-muted)] line-through'
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
                              <div className="text-[8px] text-[var(--m12-text-muted)] uppercase tracking-wider mb-1 font-[family-name:var(--font-space-mono)] font-bold">Dimensions</div>
                              <div className="border-l-2 border-[var(--m12-border)]/15 ml-1 pl-2 space-y-0.5">
                                {out.dimensions.map((dim, di) => (
                                  <div key={di} className="flex items-center gap-1.5">
                                    <Check checked={selection.outputs[idx]?.dimensions[di] ?? true} onChange={() => toggleOutputDim(idx, di)} />
                                    <span className={`text-[9px] ${selection.outputs[idx]?.dimensions[di] ? 'text-[var(--m12-text-secondary)]' : 'text-[var(--m12-text-muted)] line-through'}`}>
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

              {/* FEATURES */}
              {(suggestion.features && suggestion.features.length > 0) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded bg-[#8B5CF6]/20 flex items-center justify-center text-[#8B5CF6] text-[9px] font-bold font-[family-name:var(--font-orbitron)]">F</div>
                    <span className="text-xs font-semibold text-[var(--m12-text)]">Features</span>
                    <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">{suggestion.features.length}</span>
                    <span className="text-[9px] text-[var(--m12-text-muted)]">sub-capabilities of this L3</span>
                  </div>
                  <div className="space-y-1.5">
                    {suggestion.features.map((f, i) => (
                      <div key={i} className={`flex items-start gap-2 px-3 py-2 border rounded-lg transition-all ${selection.features[i] ? 'border-[#8B5CF6]/40 bg-[#8B5CF6]/[0.05]' : 'border-[var(--m12-border)]/20 opacity-50'}`}>
                        <Check checked={selection.features[i] ?? true} onChange={() => toggleFeature(i)} size="md" />
                        <span className={`text-[11px] leading-snug ${selection.features[i] ? 'text-[var(--m12-text)]' : 'text-[var(--m12-text-muted)] line-through'}`}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* USE CASES */}
              {(suggestion.use_cases && suggestion.use_cases.length > 0) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded bg-[#06B6D4]/20 flex items-center justify-center text-[#06B6D4] text-[9px] font-bold font-[family-name:var(--font-orbitron)]">U</div>
                    <span className="text-xs font-semibold text-[var(--m12-text)]">Use Cases</span>
                    <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">{suggestion.use_cases.length}</span>
                    <span className="text-[9px] text-[var(--m12-text-muted)]">concrete scenarios</span>
                  </div>
                  <div className="space-y-1.5">
                    {suggestion.use_cases.map((u, i) => (
                      <div key={i} className={`flex items-start gap-2 px-3 py-2 border rounded-lg transition-all ${selection.useCases[i] ? 'border-[#06B6D4]/40 bg-[#06B6D4]/[0.05]' : 'border-[var(--m12-border)]/20 opacity-50'}`}>
                        <Check checked={selection.useCases[i] ?? true} onChange={() => toggleUseCase(i)} size="md" />
                        <span className={`text-[11px] leading-snug ${selection.useCases[i] ? 'text-[var(--m12-text)]' : 'text-[var(--m12-text-muted)] line-through'}`}>{u}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !suggestion && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-[var(--m12-text-muted)]">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="opacity-30">
                <path d="M16 4L20 12L28 14L22 20L24 28L16 24L8 28L10 20L4 14L12 12L16 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span className="text-xs">Describe the capability to generate SIPOC suggestions</span>
              <span className="text-[10px] text-[var(--m12-text-faint)]">Cmd+Enter to generate</span>
            </div>
          )}
        </div>

        {/* Footer: Apply button */}
        {suggestion && selection && (
          <div className="px-6 py-3 border-t border-[var(--m12-border)]/30 flex items-center justify-between">
            <div className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
              {Object.values(selection.inputs).filter(i => i.selected).length} inputs, {Object.values(selection.outputs).filter(o => o.selected).length} outputs
              {(suggestion.features?.length || 0) > 0 && `, ${Object.values(selection.features).filter(Boolean).length} features`}
              {(suggestion.use_cases?.length || 0) > 0 && `, ${Object.values(selection.useCases).filter(Boolean).length} use cases`} selected
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] px-3 py-1.5 transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white px-5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                {applying ? 'Applying...' : 'Apply Selected'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
