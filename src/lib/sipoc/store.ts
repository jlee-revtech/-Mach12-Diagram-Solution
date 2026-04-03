import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type {
  CapabilityMapRow,
  Capability,
  CapabilityInput,
  CapabilityOutput,
  Persona,
  InformationProduct,
  LogicalSystem,
  HydratedCapability,
  Dimension,
  CapabilityTreeNode,
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
  focusedItemId: string | null
  setFocusedItem: (id: string | null) => void
  editingEntityType: 'persona' | 'informationProduct' | 'logicalSystem' | null
  editingEntityId: string | null
  drawerOpen: boolean
  drawerHeight: number

  // ─── Data loading ─────────────────────────────────────
  loadMap: (mapId: string) => Promise<boolean>
  loadOrgEntities: (orgId: string) => Promise<void>

  // ─── Capability map meta ──────────────────────────────
  updateTitle: (title: string, userId: string) => Promise<void>
  updateDescription: (description: string, userId: string) => Promise<void>

  // ─── Capability CRUD ──────────────────────────────────
  addCapability: (name: string, parentId?: string | null, level?: number, color?: string | null) => Promise<string | undefined>
  updateCapability: (id: string, updates: Partial<Pick<Capability, 'name' | 'description' | 'system_id' | 'color' | 'parent_id' | 'level' | 'sort_order'>>) => Promise<void>
  removeCapability: (id: string) => Promise<void>
  reorderCapability: (id: string, newSortOrder: number) => Promise<void>
  setSelectedCapability: (id: string | null) => void
  getCapabilityTree: () => import('./types').CapabilityTreeNode[]

  // ─── Input CRUD ───────────────────────────────────────
  addInput: (capabilityId: string, informationProductId: string) => Promise<void>
  removeInput: (inputId: string, capabilityId: string) => Promise<void>
  updateInputSuppliers: (inputId: string, capabilityId: string, personaIds: string[]) => Promise<void>
  updateInputSystems: (inputId: string, capabilityId: string, systemIds: string[]) => Promise<void>
  updateInputFeedingSystem: (inputId: string, capabilityId: string, systemId: string | null) => Promise<void>

  // ─── Output CRUD ──────────────────────────────────────
  addOutput: (capabilityId: string, informationProductId: string) => Promise<void>
  removeOutput: (outputId: string, capabilityId: string) => Promise<void>
  updateOutputConsumers: (outputId: string, capabilityId: string, personaIds: string[]) => Promise<void>

  // ─── Dimension CRUD (on inputs/outputs) ─────────────────
  addDimension: (side: 'input' | 'output', itemId: string, capabilityId: string, name: string) => Promise<void>
  updateDimension: (side: 'input' | 'output', itemId: string, capabilityId: string, dimId: string, updates: Partial<Pick<Dimension, 'name' | 'description'>>) => Promise<void>
  removeDimension: (side: 'input' | 'output', itemId: string, capabilityId: string, dimId: string) => Promise<void>

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
  focusedItemId: null,
  setFocusedItem: (id) => set({ focusedItemId: id }),
  editingEntityType: null,
  editingEntityId: null,
  drawerOpen: false,
  drawerHeight: 420,

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

  addCapability: async (name, parentId, level, color) => {
    const { map, capabilities } = get()
    if (!map) return undefined
    const siblings = capabilities.filter(c => c.parent_id === (parentId || null))
    const sortOrder = siblings.length
    const cap = await api.createCapability(map.id, name, sortOrder, parentId, level, color)
    set({
      capabilities: [...capabilities, cap],
      inputs: { ...get().inputs, [cap.id]: [] },
      outputs: { ...get().outputs, [cap.id]: [] },
    })
    return cap.id
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
    const { inputs, outputs, capabilities } = get()
    const newInputs = { ...inputs }
    const newOutputs = { ...outputs }
    delete newInputs[id]
    delete newOutputs[id]
    set({
      // Remove the deleted capability; orphan its children (set parent_id to null)
      capabilities: capabilities
        .filter(c => c.id !== id)
        .map(c => c.parent_id === id ? { ...c, parent_id: null } : c),
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

  setSelectedCapability: (id) => set({ selectedCapabilityId: id, drawerOpen: id !== null }),

  getCapabilityTree: () => {
    const { capabilities } = get()
    const idSet = new Set(capabilities.map(c => c.id))

    // Fix broken parent references: if parent_id points to a non-existent capability, treat as root
    const getEffectiveParent = (c: Capability): string | null => {
      if (!c.parent_id) return null
      return idSet.has(c.parent_id) ? c.parent_id : null
    }

    const buildTree = (parentId: string | null): CapabilityTreeNode[] => {
      return capabilities
        .filter(c => getEffectiveParent(c) === parentId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(c => ({ ...c, children: buildTree(c.id) }))
    }
    return buildTree(null)
  },

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

  updateInputFeedingSystem: async (inputId, capabilityId, systemId) => {
    await api.updateCapabilityInput(inputId, { feeding_system_id: systemId })
    set({
      inputs: {
        ...get().inputs,
        [capabilityId]: (get().inputs[capabilityId] || []).map(i =>
          i.id === inputId ? { ...i, feeding_system_id: systemId } : i
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

  // ─── Dimension CRUD helpers ─────────────────────────────

  addDimension: async (side, itemId, capabilityId, name) => {
    const newDim: Dimension = { id: uuid(), name }
    const key = side === 'input' ? 'inputs' : 'outputs'
    const items = get()[key][capabilityId] || []
    const updated = items.map((item: CapabilityInput | CapabilityOutput) =>
      item.id === itemId ? { ...item, dimensions: [...(item.dimensions || []), newDim] } : item
    )
    set({ [key]: { ...get()[key], [capabilityId]: updated } })
    const target = updated.find((i: CapabilityInput | CapabilityOutput) => i.id === itemId)
    if (side === 'input') {
      await api.updateCapabilityInput(itemId, { dimensions: target?.dimensions })
    } else {
      await api.updateCapabilityOutput(itemId, { dimensions: target?.dimensions })
    }
  },

  updateDimension: async (side, itemId, capabilityId, dimId, updates) => {
    const key = side === 'input' ? 'inputs' : 'outputs'
    const items = get()[key][capabilityId] || []
    const updated = items.map((item: CapabilityInput | CapabilityOutput) =>
      item.id === itemId
        ? { ...item, dimensions: (item.dimensions || []).map(d => d.id === dimId ? { ...d, ...updates } : d) }
        : item
    )
    set({ [key]: { ...get()[key], [capabilityId]: updated } })
    const target = updated.find((i: CapabilityInput | CapabilityOutput) => i.id === itemId)
    if (side === 'input') {
      await api.updateCapabilityInput(itemId, { dimensions: target?.dimensions })
    } else {
      await api.updateCapabilityOutput(itemId, { dimensions: target?.dimensions })
    }
  },

  removeDimension: async (side, itemId, capabilityId, dimId) => {
    const key = side === 'input' ? 'inputs' : 'outputs'
    const items = get()[key][capabilityId] || []
    const updated = items.map((item: CapabilityInput | CapabilityOutput) =>
      item.id === itemId
        ? { ...item, dimensions: (item.dimensions || []).filter(d => d.id !== dimId) }
        : item
    )
    set({ [key]: { ...get()[key], [capabilityId]: updated } })
    const target = updated.find((i: CapabilityInput | CapabilityOutput) => i.id === itemId)
    if (side === 'input') {
      await api.updateCapabilityInput(itemId, { dimensions: target?.dimensions })
    } else {
      await api.updateCapabilityOutput(itemId, { dimensions: target?.dimensions })
    }
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
      system: cap.system_id ? sysMap.get(cap.system_id) || null : null,
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
        feedingSystem: input.feeding_system_id ? sysMap.get(input.feeding_system_id) || null : null,
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
