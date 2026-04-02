import { create } from 'zustand'
import type {
  CapabilityMapRow,
  Capability,
  CapabilityInput,
  CapabilityOutput,
  Persona,
  InformationProduct,
  LogicalSystem,
  HydratedCapability,
} from './types'
import * as api from '@/lib/supabase/capability-maps'

// ─── Store Interface ────────────────────────────────────
interface SIPOCState {
  // Map metadata
  map: CapabilityMapRow | null
  loading: boolean

  // Entity pools (org-scoped, reusable)
  personas: Persona[]
  informationProducts: InformationProduct[]
  logicalSystems: LogicalSystem[]

  // Capabilities and their I/O
  capabilities: Capability[]
  inputs: Record<string, CapabilityInput[]>   // keyed by capability_id
  outputs: Record<string, CapabilityOutput[]>  // keyed by capability_id

  // UI state
  selectedCapabilityId: string | null
  editingEntityType: 'persona' | 'informationProduct' | 'logicalSystem' | null
  editingEntityId: string | null

  // ─── Data loading ─────────────────────────────────────
  loadMap: (mapId: string) => Promise<boolean>
  loadOrgEntities: (orgId: string) => Promise<void>

  // ─── Capability map meta ──────────────────────────────
  updateTitle: (title: string, userId: string) => Promise<void>
  updateDescription: (description: string, userId: string) => Promise<void>

  // ─── Capability CRUD ──────────────────────────────────
  addCapability: (name: string) => Promise<void>
  updateCapability: (id: string, updates: Partial<Pick<Capability, 'name' | 'description'>>) => Promise<void>
  removeCapability: (id: string) => Promise<void>
  reorderCapability: (id: string, newSortOrder: number) => Promise<void>
  setSelectedCapability: (id: string | null) => void

  // ─── Input CRUD ───────────────────────────────────────
  addInput: (capabilityId: string, informationProductId: string) => Promise<void>
  removeInput: (inputId: string, capabilityId: string) => Promise<void>
  updateInputSuppliers: (inputId: string, capabilityId: string, personaIds: string[]) => Promise<void>
  updateInputSystems: (inputId: string, capabilityId: string, systemIds: string[]) => Promise<void>

  // ─── Output CRUD ──────────────────────────────────────
  addOutput: (capabilityId: string, informationProductId: string) => Promise<void>
  removeOutput: (outputId: string, capabilityId: string) => Promise<void>
  updateOutputConsumers: (outputId: string, capabilityId: string, personaIds: string[]) => Promise<void>

  // ─── Entity pool CRUD (org-scoped) ────────────────────
  addPersona: (orgId: string, data: { name: string; role?: string; color?: string }) => Promise<Persona>
  updatePersona: (id: string, updates: Partial<Pick<Persona, 'name' | 'role' | 'description' | 'color'>>) => Promise<void>
  removePersona: (id: string) => Promise<void>

  addInformationProduct: (orgId: string, data: { name: string; description?: string; category?: string }) => Promise<InformationProduct>
  updateInformationProduct: (id: string, updates: Partial<Pick<InformationProduct, 'name' | 'description' | 'category'>>) => Promise<void>
  removeInformationProduct: (id: string) => Promise<void>

  addLogicalSystem: (orgId: string, data: { name: string; system_type?: string; color?: string }) => Promise<LogicalSystem>
  updateLogicalSystem: (id: string, updates: Partial<Pick<LogicalSystem, 'name' | 'system_type' | 'description' | 'color'>>) => Promise<void>
  removeLogicalSystem: (id: string) => Promise<void>

  // ─── Entity editing UI ────────────────────────────────
  setEditingEntity: (type: 'persona' | 'informationProduct' | 'logicalSystem' | null, id: string | null) => void

  // ─── Derived: hydrated capabilities ───────────────────
  getHydratedCapabilities: () => HydratedCapability[]
}

export const useSIPOCStore = create<SIPOCState>((set, get) => ({
  map: null,
  loading: false,
  personas: [],
  informationProducts: [],
  logicalSystems: [],
  capabilities: [],
  inputs: {},
  outputs: {},
  selectedCapabilityId: null,
  editingEntityType: null,
  editingEntityId: null,

  // ─── Data loading ─────────────────────────────────────

  loadMap: async (mapId) => {
    set({ loading: true })
    const map = await api.getCapabilityMap(mapId)
    if (!map) { set({ loading: false }); return false }

    const capabilities = await api.listCapabilities(mapId)

    // Load all inputs/outputs for all capabilities in parallel
    const inputResults = await Promise.all(capabilities.map(c => api.listCapabilityInputs(c.id)))
    const outputResults = await Promise.all(capabilities.map(c => api.listCapabilityOutputs(c.id)))

    const inputs: Record<string, CapabilityInput[]> = {}
    const outputs: Record<string, CapabilityOutput[]> = {}
    capabilities.forEach((c, i) => {
      inputs[c.id] = inputResults[i]
      outputs[c.id] = outputResults[i]
    })

    set({ map, capabilities, inputs, outputs, loading: false })
    return true
  },

  loadOrgEntities: async (orgId) => {
    const [personas, informationProducts, logicalSystems] = await Promise.all([
      api.listPersonas(orgId),
      api.listInformationProducts(orgId),
      api.listLogicalSystems(orgId),
    ])
    set({ personas, informationProducts, logicalSystems })
  },

  // ─── Capability map meta ──────────────────────────────

  updateTitle: async (title, userId) => {
    const { map } = get()
    if (!map) return
    await api.updateCapabilityMap(map.id, userId, { title })
    set({ map: { ...map, title } })
  },

  updateDescription: async (description, userId) => {
    const { map } = get()
    if (!map) return
    await api.updateCapabilityMap(map.id, userId, { description })
    set({ map: { ...map, description } })
  },

  // ─── Capability CRUD ──────────────────────────────────

  addCapability: async (name) => {
    const { map, capabilities } = get()
    if (!map) return
    const sortOrder = capabilities.length
    const cap = await api.createCapability(map.id, name, sortOrder)
    set({
      capabilities: [...capabilities, cap],
      inputs: { ...get().inputs, [cap.id]: [] },
      outputs: { ...get().outputs, [cap.id]: [] },
    })
  },

  updateCapability: async (id, updates) => {
    await api.updateCapability(id, updates)
    set({
      capabilities: get().capabilities.map(c =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })
  },

  removeCapability: async (id) => {
    await api.deleteCapability(id)
    const { inputs, outputs } = get()
    const newInputs = { ...inputs }
    const newOutputs = { ...outputs }
    delete newInputs[id]
    delete newOutputs[id]
    set({
      capabilities: get().capabilities.filter(c => c.id !== id),
      inputs: newInputs,
      outputs: newOutputs,
      selectedCapabilityId: get().selectedCapabilityId === id ? null : get().selectedCapabilityId,
    })
  },

  reorderCapability: async (id, newSortOrder) => {
    await api.updateCapability(id, { sort_order: newSortOrder })
    set({
      capabilities: get().capabilities.map(c =>
        c.id === id ? { ...c, sort_order: newSortOrder } : c
      ).sort((a, b) => a.sort_order - b.sort_order),
    })
  },

  setSelectedCapability: (id) => set({ selectedCapabilityId: id }),

  // ─── Input CRUD ───────────────────────────────────────

  addInput: async (capabilityId, informationProductId) => {
    const currentInputs = get().inputs[capabilityId] || []
    const input = await api.createCapabilityInput(capabilityId, informationProductId, currentInputs.length)
    set({
      inputs: { ...get().inputs, [capabilityId]: [...currentInputs, input] },
    })
  },

  removeInput: async (inputId, capabilityId) => {
    await api.deleteCapabilityInput(inputId)
    set({
      inputs: {
        ...get().inputs,
        [capabilityId]: (get().inputs[capabilityId] || []).filter(i => i.id !== inputId),
      },
    })
  },

  updateInputSuppliers: async (inputId, capabilityId, personaIds) => {
    await api.updateCapabilityInput(inputId, { supplier_persona_ids: personaIds })
    set({
      inputs: {
        ...get().inputs,
        [capabilityId]: (get().inputs[capabilityId] || []).map(i =>
          i.id === inputId ? { ...i, supplier_persona_ids: personaIds } : i
        ),
      },
    })
  },

  updateInputSystems: async (inputId, capabilityId, systemIds) => {
    await api.updateCapabilityInput(inputId, { source_system_ids: systemIds })
    set({
      inputs: {
        ...get().inputs,
        [capabilityId]: (get().inputs[capabilityId] || []).map(i =>
          i.id === inputId ? { ...i, source_system_ids: systemIds } : i
        ),
      },
    })
  },

  // ─── Output CRUD ──────────────────────────────────────

  addOutput: async (capabilityId, informationProductId) => {
    const currentOutputs = get().outputs[capabilityId] || []
    const output = await api.createCapabilityOutput(capabilityId, informationProductId, currentOutputs.length)
    set({
      outputs: { ...get().outputs, [capabilityId]: [...currentOutputs, output] },
    })
  },

  removeOutput: async (outputId, capabilityId) => {
    await api.deleteCapabilityOutput(outputId)
    set({
      outputs: {
        ...get().outputs,
        [capabilityId]: (get().outputs[capabilityId] || []).filter(o => o.id !== outputId),
      },
    })
  },

  updateOutputConsumers: async (outputId, capabilityId, personaIds) => {
    await api.updateCapabilityOutput(outputId, { consumer_persona_ids: personaIds })
    set({
      outputs: {
        ...get().outputs,
        [capabilityId]: (get().outputs[capabilityId] || []).map(o =>
          o.id === outputId ? { ...o, consumer_persona_ids: personaIds } : o
        ),
      },
    })
  },

  // ─── Entity pool CRUD ─────────────────────────────────

  addPersona: async (orgId, data) => {
    const persona = await api.createPersona(orgId, data)
    set({ personas: [...get().personas, persona] })
    return persona
  },

  updatePersona: async (id, updates) => {
    await api.updatePersona(id, updates)
    set({ personas: get().personas.map(p => p.id === id ? { ...p, ...updates } : p) })
  },

  removePersona: async (id) => {
    await api.deletePersona(id)
    set({ personas: get().personas.filter(p => p.id !== id) })
  },

  addInformationProduct: async (orgId, data) => {
    const ip = await api.createInformationProduct(orgId, data)
    set({ informationProducts: [...get().informationProducts, ip] })
    return ip
  },

  updateInformationProduct: async (id, updates) => {
    await api.updateInformationProduct(id, updates)
    set({ informationProducts: get().informationProducts.map(ip => ip.id === id ? { ...ip, ...updates } : ip) })
  },

  removeInformationProduct: async (id) => {
    await api.deleteInformationProduct(id)
    set({ informationProducts: get().informationProducts.filter(ip => ip.id !== id) })
  },

  addLogicalSystem: async (orgId, data) => {
    const sys = await api.createLogicalSystem(orgId, data)
    set({ logicalSystems: [...get().logicalSystems, sys] })
    return sys
  },

  updateLogicalSystem: async (id, updates) => {
    await api.updateLogicalSystem(id, updates)
    set({ logicalSystems: get().logicalSystems.map(s => s.id === id ? { ...s, ...updates } : s) })
  },

  removeLogicalSystem: async (id) => {
    await api.deleteLogicalSystem(id)
    set({ logicalSystems: get().logicalSystems.filter(s => s.id !== id) })
  },

  // ─── Entity editing UI ────────────────────────────────

  setEditingEntity: (type, id) => set({ editingEntityType: type, editingEntityId: id }),

  // ─── Derived: hydrated capabilities ───────────────────

  getHydratedCapabilities: () => {
    const { capabilities, inputs, outputs, personas, informationProducts, logicalSystems } = get()
    const personaMap = new Map(personas.map(p => [p.id, p]))
    const ipMap = new Map(informationProducts.map(ip => [ip.id, ip]))
    const sysMap = new Map(logicalSystems.map(s => [s.id, s]))

    return capabilities.map(cap => ({
      ...cap,
      inputs: (inputs[cap.id] || []).map(input => ({
        ...input,
        informationProduct: ipMap.get(input.information_product_id) || {
          id: input.information_product_id, organization_id: '', name: '(deleted)', created_at: '', updated_at: '',
        },
        supplierPersonas: input.supplier_persona_ids
          .map(id => personaMap.get(id))
          .filter((p): p is Persona => !!p),
        sourceSystems: input.source_system_ids
          .map(id => sysMap.get(id))
          .filter((s): s is LogicalSystem => !!s),
      })),
      outputs: (outputs[cap.id] || []).map(output => ({
        ...output,
        informationProduct: ipMap.get(output.information_product_id) || {
          id: output.information_product_id, organization_id: '', name: '(deleted)', created_at: '', updated_at: '',
        },
        consumerPersonas: output.consumer_persona_ids
          .map(id => personaMap.get(id))
          .filter((p): p is Persona => !!p),
      })),
    }))
  },
}))
