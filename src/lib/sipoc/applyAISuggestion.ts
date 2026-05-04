import { useSIPOCStore } from './store'
import { PERSONA_COLORS } from './types'

export interface AISuggestionInput {
  status: 'new' | 'enhancement'
  existingProduct?: string
  informationProduct: string
  category?: string
  supplierPersonas: { name: string; role?: string }[]
  sourceSystems: { name: string; systemType?: string }[]
  dimensions: { name: string }[]
}

export interface AISuggestionOutput {
  status: 'new' | 'enhancement'
  existingProduct?: string
  informationProduct: string
  category?: string
  consumerPersonas: { name: string; role?: string }[]
  dimensions: { name: string }[]
}

export interface AISuggestion {
  inputs: AISuggestionInput[]
  outputs: AISuggestionOutput[]
  features?: string[]
  use_cases?: string[]
}

// Auto-accept variant of AIGeneratePanel.handleApply: applies every input,
// output, dimension, feature, and use case in the suggestion to the target
// capability without any user selection. Used by the bulk auto-fill flow.
export async function applyAISuggestion(
  suggestion: AISuggestion,
  capabilityId: string,
  orgId: string,
): Promise<void> {
  const store = useSIPOCStore.getState()

  const getOrCreatePersona = async (name: string, role?: string) => {
    const existing = useSIPOCStore.getState().personas.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing.id
    const colorIdx = useSIPOCStore.getState().personas.length % PERSONA_COLORS.length
    const created = await store.addPersona(orgId, { name, role, color: PERSONA_COLORS[colorIdx] })
    return created.id
  }

  const getOrCreateIP = async (name: string, category?: string) => {
    const existing = useSIPOCStore.getState().informationProducts.find(ip => ip.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing.id
    const created = await store.addInformationProduct(orgId, { name, category })
    return created.id
  }

  const getOrCreateSystem = async (name: string, systemType?: string) => {
    const existing = useSIPOCStore.getState().logicalSystems.find(s => s.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing.id
    const created = await store.addLogicalSystem(orgId, { name, system_type: systemType })
    return created.id
  }

  // Inputs
  for (const inp of suggestion.inputs || []) {
    const isEnhancement = inp.status === 'enhancement'
    const ipId = await getOrCreateIP(inp.informationProduct, inp.category)

    let targetInput: { id: string; supplier_persona_ids: string[]; source_system_ids: string[] } | undefined

    if (isEnhancement) {
      const currentInputs = useSIPOCStore.getState().inputs[capabilityId] || []
      const matchName = (inp.existingProduct || inp.informationProduct).toLowerCase()
      const existingIPs = useSIPOCStore.getState().informationProducts
      targetInput = currentInputs.find(ci => {
        const cipName = existingIPs.find(ip => ip.id === ci.information_product_id)?.name?.toLowerCase()
        return cipName === matchName
      })
    }

    if (!targetInput) {
      await store.addInput(capabilityId, ipId)
      const currentInputs = useSIPOCStore.getState().inputs[capabilityId] || []
      targetInput = currentInputs.find(i => i.information_product_id === ipId)
    }

    if (!targetInput) continue

    const newSupplierIds: string[] = [...(targetInput.supplier_persona_ids || [])]
    for (const persona of inp.supplierPersonas || []) {
      const personaId = await getOrCreatePersona(persona.name, persona.role)
      if (!newSupplierIds.includes(personaId)) newSupplierIds.push(personaId)
    }
    if (newSupplierIds.length > (targetInput.supplier_persona_ids || []).length) {
      await store.updateInputSuppliers(targetInput.id, capabilityId, newSupplierIds)
    }

    const newSystemIds: string[] = [...(targetInput.source_system_ids || [])]
    for (const sys of inp.sourceSystems || []) {
      const sysId = await getOrCreateSystem(sys.name, sys.systemType)
      if (!newSystemIds.includes(sysId)) newSystemIds.push(sysId)
    }
    if (newSystemIds.length > (targetInput.source_system_ids || []).length) {
      await store.updateInputSystems(targetInput.id, capabilityId, newSystemIds)
    }

    for (const dim of inp.dimensions || []) {
      await store.addDimension('input', targetInput.id, capabilityId, dim.name)
    }
  }

  // Outputs
  for (const out of suggestion.outputs || []) {
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

    const newConsumerIds: string[] = [...(targetOutput.consumer_persona_ids || [])]
    for (const persona of out.consumerPersonas || []) {
      const personaId = await getOrCreatePersona(persona.name, persona.role)
      if (!newConsumerIds.includes(personaId)) newConsumerIds.push(personaId)
    }
    if (newConsumerIds.length > (targetOutput.consumer_persona_ids || []).length) {
      await store.updateOutputConsumers(targetOutput.id, capabilityId, newConsumerIds)
    }

    for (const dim of out.dimensions || []) {
      await store.addDimension('output', targetOutput.id, capabilityId, dim.name)
    }
  }

  // Features and use cases
  const cap = useSIPOCStore.getState().capabilities.find(c => c.id === capabilityId)
  if (cap) {
    const newFeatures = (suggestion.features || []).map(f => f.trim()).filter(f => f.length > 0)
    const newUseCases = (suggestion.use_cases || []).map(u => u.trim()).filter(u => u.length > 0)

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
    if (newFeatures.length > 0) {
      updates.features = dedupe([...(cap.features || []), ...newFeatures])
    }
    if (newUseCases.length > 0) {
      updates.use_cases = dedupe([...(cap.use_cases || []), ...newUseCases])
    }
    if (updates.features || updates.use_cases) {
      await store.updateCapability(capabilityId, updates)
    }
  }
}
