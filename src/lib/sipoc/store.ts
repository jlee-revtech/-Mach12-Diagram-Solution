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
  Tag,
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
  tags: Tag[]

  // Capabilities and their I/O
  capabilities: Capability[]
  inputs: Record<string, CapabilityInput[]>   // keyed by capability_id
  outputs: Record<string, CapabilityOutput[]>  // keyed by capability_id

  // UI state
  readOnly: boolean
  setReadOnly: (v: boolean) => void
  selectedCapabilityId: string | null
  focusedItemId: string | null
  setFocusedItem: (id: string | null) => void
  editingEntityType: 'persona' | 'informationProduct' | 'logicalSystem' | null
  editingEntityId: string | null
  drawerOpen: boolean
  drawerHeight: number
  drawerFullscreen: boolean

  // ─── Data loading ─────────────────────────────────────
  loadMap: (mapId: string) => Promise<boolean>
  loadOrgEntities: (orgId: string) => Promise<void>

  // ─── Capability map meta ──────────────────────────────
  updateTitle: (title: string, userId: string) => Promise<void>
  updateDescription: (description: string, userId: string) => Promise<void>

  // ─── Capability CRUD ──────────────────────────────────
  addCapability: (name: string, parentId?: string | null, level?: number, color?: string | null) => Promise<string | undefined>
  updateCapability: (id: string, updates: Partial<Pick<Capability, 'name' | 'description' | 'system_id' | 'color' | 'parent_id' | 'level' | 'sort_order' | 'features' | 'use_cases' | 'depends_on_capability_ids'>>) => Promise<void>
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
  updateInputTags: (inputId: string, capabilityId: string, tagIds: string[]) => Promise<void>
  updateOutputTags: (outputId: string, capabilityId: string, tagIds: string[]) => Promise<void>
  updateDimensionTags: (side: 'input' | 'output', itemId: string, capabilityId: string, dimId: string, tagIds: string[]) => Promise<void>

  // ─── Output CRUD ──────────────────────────────────────
  addOutput: (capabilityId: string, informationProductId: string) => Promise<void>
  removeOutput: (outputId: string, capabilityId: string) => Promise<void>
  updateOutputConsumers: (outputId: string, capabilityId: string, personaIds: string[]) => Promise<void>
  updateOutputSystems: (outputId: string, capabilityId: string, systemIds: string[]) => Promise<void>

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

  addTag: (orgId: string, data: { name: string; color?: string; description?: string }) => Promise<Tag>
  updateTag: (id: string, updates: Partial<Pick<Tag, 'name' | 'color' | 'description'>>) => Promise<void>
  removeTag: (id: string) => Promise<void>

  // ─── Entity editing UI ────────────────────────────────
  setEditingEntity: (type: 'persona' | 'informationProduct' | 'logicalSystem' | null, id: string | null) => void

  // ─── Derived: hydrated capabilities ───────────────────
  getHydratedCapabilities: () => HydratedCapability[]

  // ─── Derived: L1/L2 rollup from descendant L3 SIPOCs ───
  getRollup: (capabilityId: string) => HydratedCapability | null

  // ─── Derived: Data & System Architecture ──────────────
  getDataArchitecture: () => {
    ipLineages: IPLineage[]
    systemUsage: Record<string, SystemUsage>
    systems: LogicalSystem[]
    flows: SystemFlow[]
  }

  // ─── Derived: System Network (L3s on edges) ───────────
  getSystemNetwork: () => {
    systems: LogicalSystem[]
    edges: SystemEdge[]
  }
}

export interface SystemEdge {
  from: string
  to: string
  l3s: {
    capability: Capability
    ips: InformationProduct[]
  }[]
  totalIps: number
}

export interface IPLineage {
  ip: InformationProduct
  tags: Tag[]
  dimensions: Dimension[]
  sourceSystems: LogicalSystem[]
  feedingSystems: LogicalSystem[]
  processingSystems: LogicalSystem[]
  destinationSystems: LogicalSystem[]
  consumedBy: Capability[]
  producedBy: Capability[]
  supplierPersonas: Persona[]
  consumerPersonas: Persona[]
}

export interface SystemUsage {
  system: LogicalSystem
  asSource: InformationProduct[]          // IPs where this system is a source_system
  asFeeding: InformationProduct[]         // IPs where this system is the feeding_system
  asProcessing: { capability: Capability; ips: InformationProduct[] }[] // L3s hosted here
  asDestination: InformationProduct[]     // IPs where this system is a destination
}

export interface SystemFlow {
  from: string     // system id
  to: string       // system id
  ips: InformationProduct[]
}

export const useSIPOCStore = create<SIPOCState>((set, get) => ({
  map: null,
  loading: false,
  personas: [],
  informationProducts: [],
  logicalSystems: [],
  tags: [],
  capabilities: [],
  inputs: {},
  outputs: {},
  readOnly: false,
  setReadOnly: (v) => set({ readOnly: v }),
  selectedCapabilityId: null,
  focusedItemId: null,
  setFocusedItem: (id) => set({ focusedItemId: id }),
  editingEntityType: null,
  editingEntityId: null,
  drawerOpen: false,
  drawerHeight: 420,
  drawerFullscreen: false,

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
    const [personas, informationProducts, logicalSystems, tags] = await Promise.all([
      api.listPersonas(orgId),
      api.listInformationProducts(orgId),
      api.listLogicalSystems(orgId),
      api.listTags(orgId),
    ])
    set({ personas, informationProducts, logicalSystems, tags })
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
    set({
      capabilities: get().capabilities.map(c =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })
    await api.updateCapability(id, updates)
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

  setSelectedCapability: (id) => set({ selectedCapabilityId: id, drawerOpen: id !== null, ...(id === null ? { drawerFullscreen: false } : {}) }),

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
    set({
      inputs: {
        ...get().inputs,
        [capabilityId]: (get().inputs[capabilityId] || []).filter(i => i.id !== inputId),
      },
    })
    await api.deleteCapabilityInput(inputId)
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

  updateInputTags: async (inputId, capabilityId, tagIds) => {
    await api.updateCapabilityInput(inputId, { tag_ids: tagIds })
    set({
      inputs: {
        ...get().inputs,
        [capabilityId]: (get().inputs[capabilityId] || []).map(i =>
          i.id === inputId ? { ...i, tag_ids: tagIds } : i
        ),
      },
    })
  },

  updateOutputTags: async (outputId, capabilityId, tagIds) => {
    await api.updateCapabilityOutput(outputId, { tag_ids: tagIds })
    set({
      outputs: {
        ...get().outputs,
        [capabilityId]: (get().outputs[capabilityId] || []).map(o =>
          o.id === outputId ? { ...o, tag_ids: tagIds } : o
        ),
      },
    })
  },

  updateDimensionTags: async (side, itemId, capabilityId, dimId, tagIds) => {
    const key = side === 'input' ? 'inputs' : 'outputs'
    const items = get()[key][capabilityId] || []
    const updated = items.map((item: CapabilityInput | CapabilityOutput) =>
      item.id === itemId
        ? { ...item, dimensions: (item.dimensions || []).map(d => d.id === dimId ? { ...d, tag_ids: tagIds } : d) }
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
    set({
      outputs: {
        ...get().outputs,
        [capabilityId]: (get().outputs[capabilityId] || []).filter(o => o.id !== outputId),
      },
    })
    await api.deleteCapabilityOutput(outputId)
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

  updateOutputSystems: async (outputId, capabilityId, systemIds) => {
    await api.updateCapabilityOutput(outputId, { destination_system_ids: systemIds })
    set({
      outputs: {
        ...get().outputs,
        [capabilityId]: (get().outputs[capabilityId] || []).map(o =>
          o.id === outputId ? { ...o, destination_system_ids: systemIds } : o
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
    set({ informationProducts: get().informationProducts.map(ip => ip.id === id ? { ...ip, ...updates } : ip) })
    await api.updateInformationProduct(id, updates)
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

  addTag: async (orgId, data) => {
    const tag = await api.createTag(orgId, data)
    set({ tags: [...get().tags, tag] })
    return tag
  },

  updateTag: async (id, updates) => {
    await api.updateTag(id, updates)
    set({ tags: get().tags.map(t => t.id === id ? { ...t, ...updates } : t) })
  },

  removeTag: async (id) => {
    await api.deleteTag(id)
    // Strip the tag from inputs + dimensions locally (DB retains orphan IDs; filtered on read)
    const tags = get().tags.filter(t => t.id !== id)
    const inputs = { ...get().inputs }
    for (const capId of Object.keys(inputs)) {
      inputs[capId] = inputs[capId].map(i => ({
        ...i,
        tag_ids: (i.tag_ids || []).filter(tid => tid !== id),
        dimensions: (i.dimensions || []).map(d => ({ ...d, tag_ids: (d.tag_ids || []).filter(tid => tid !== id) })),
      }))
    }
    set({ tags, inputs })
  },

  // ─── Entity editing UI ────────────────────────────────

  setEditingEntity: (type, id) => set({ editingEntityType: type, editingEntityId: id }),

  // ─── Derived: hydrated capabilities ───────────────────

  getHydratedCapabilities: () => {
    const { capabilities, inputs, outputs, personas, informationProducts, logicalSystems, tags } = get()
    const personaMap = new Map(personas.map(p => [p.id, p]))
    const ipMap = new Map(informationProducts.map(ip => [ip.id, ip]))
    const sysMap = new Map(logicalSystems.map(s => [s.id, s]))
    const tagMap = new Map(tags.map(t => [t.id, t]))
    const resolveTags = (ids?: string[]): Tag[] =>
      (ids || []).map(id => tagMap.get(id)).filter((t): t is Tag => !!t)

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
        tags: resolveTags(input.tag_ids),
        dimensions: (input.dimensions || []).map(d => ({ ...d, tags: resolveTags(d.tag_ids) })),
      })),
      outputs: (outputs[cap.id] || []).map(output => ({
        ...output,
        informationProduct: ipMap.get(output.information_product_id) || {
          id: output.information_product_id, organization_id: '', name: '(deleted)', created_at: '', updated_at: '',
        },
        consumerPersonas: output.consumer_persona_ids
          .map(id => personaMap.get(id))
          .filter((p): p is Persona => !!p),
        destinationSystems: (output.destination_system_ids || [])
          .map(id => sysMap.get(id))
          .filter((s): s is LogicalSystem => !!s),
        tags: resolveTags(output.tag_ids),
        dimensions: (output.dimensions || []).map(d => ({ ...d, tags: resolveTags(d.tag_ids) })),
      })),
    }))
  },

  // ─── Rollup: aggregate all descendant-L3 SIPOC detail ───
  getRollup: (capabilityId) => {
    const hydrated = get().getHydratedCapabilities()
    const byId = new Map(hydrated.map(h => [h.id, h]))
    const rawCaps = get().capabilities
    const root = byId.get(capabilityId)
    if (!root) return null

    // Collect all descendant leaves (capabilities with no children)
    const descendants: HydratedCapability[] = []
    const collect = (id: string) => {
      const children = rawCaps.filter(c => c.parent_id === id)
      if (children.length === 0) {
        const h = byId.get(id)
        if (h && h.id !== capabilityId) descendants.push(h)
        return
      }
      children.forEach(c => collect(c.id))
    }
    collect(capabilityId)

    if (descendants.length === 0) return null

    type HInput = HydratedCapability['inputs'][0]
    type HOutput = HydratedCapability['outputs'][0]

    // Merge dimensions by case-insensitive name; union tags
    const mergeDimensions = (accDims: (import('./types').Dimension & { tags: Tag[] })[], newDims: (import('./types').Dimension & { tags: Tag[] })[]) => {
      const byName = new Map(accDims.map(d => [d.name.toLowerCase(), d]))
      for (const nd of newDims) {
        const key = nd.name.toLowerCase()
        const existing = byName.get(key)
        if (existing) {
          const tagIds = new Set(existing.tags.map(t => t.id))
          nd.tags.forEach(t => { if (!tagIds.has(t.id)) { existing.tags.push(t); tagIds.add(t.id) } })
        } else {
          const copy = { ...nd, tags: [...nd.tags] }
          byName.set(key, copy)
          accDims.push(copy)
        }
      }
      return accDims
    }

    // Aggregate inputs by IP id
    const inputAgg = new Map<string, HInput>()
    for (const d of descendants) {
      for (const inp of d.inputs) {
        const key = inp.information_product_id
        const existing = inputAgg.get(key)
        if (!existing) {
          inputAgg.set(key, {
            ...inp,
            id: `rollup-input-${capabilityId}-${key}`,
            supplier_persona_ids: [...inp.supplier_persona_ids],
            source_system_ids: [...inp.source_system_ids],
            tag_ids: [...(inp.tag_ids || [])],
            supplierPersonas: [...inp.supplierPersonas],
            sourceSystems: [...inp.sourceSystems],
            tags: [...inp.tags],
            dimensions: inp.dimensions.map(x => ({ ...x, tags: [...x.tags] })),
          })
        } else {
          const addIds = (target: string[], src: string[]) => { src.forEach(id => { if (!target.includes(id)) target.push(id) }) }
          addIds(existing.supplier_persona_ids, inp.supplier_persona_ids)
          addIds(existing.source_system_ids, inp.source_system_ids)
          addIds(existing.tag_ids || (existing.tag_ids = []), inp.tag_ids || [])
          const pIds = new Set(existing.supplierPersonas.map(p => p.id))
          inp.supplierPersonas.forEach(p => { if (!pIds.has(p.id)) existing.supplierPersonas.push(p) })
          const sIds = new Set(existing.sourceSystems.map(s => s.id))
          inp.sourceSystems.forEach(s => { if (!sIds.has(s.id)) existing.sourceSystems.push(s) })
          const tIds = new Set(existing.tags.map(t => t.id))
          inp.tags.forEach(t => { if (!tIds.has(t.id)) existing.tags.push(t) })
          if (existing.feeding_system_id && inp.feeding_system_id && existing.feeding_system_id !== inp.feeding_system_id) {
            existing.feeding_system_id = null
            existing.feedingSystem = null
          } else if (!existing.feeding_system_id && inp.feeding_system_id) {
            existing.feeding_system_id = inp.feeding_system_id
            existing.feedingSystem = inp.feedingSystem
          }
          mergeDimensions(existing.dimensions, inp.dimensions)
        }
      }
    }

    // Aggregate outputs by IP id
    const outputAgg = new Map<string, HOutput>()
    for (const d of descendants) {
      for (const out of d.outputs) {
        const key = out.information_product_id
        const existing = outputAgg.get(key)
        if (!existing) {
          outputAgg.set(key, {
            ...out,
            id: `rollup-output-${capabilityId}-${key}`,
            consumer_persona_ids: [...out.consumer_persona_ids],
            destination_system_ids: [...(out.destination_system_ids || [])],
            consumerPersonas: [...out.consumerPersonas],
            destinationSystems: [...out.destinationSystems],
            dimensions: out.dimensions.map(x => ({ ...x })),
          })
        } else {
          const addIds = (target: string[], src: string[]) => { src.forEach(id => { if (!target.includes(id)) target.push(id) }) }
          addIds(existing.consumer_persona_ids, out.consumer_persona_ids)
          addIds(existing.destination_system_ids || (existing.destination_system_ids = []), out.destination_system_ids || [])
          const cIds = new Set(existing.consumerPersonas.map(p => p.id))
          out.consumerPersonas.forEach(p => { if (!cIds.has(p.id)) existing.consumerPersonas.push(p) })
          const dIds = new Set(existing.destinationSystems.map(s => s.id))
          out.destinationSystems.forEach(s => { if (!dIds.has(s.id)) existing.destinationSystems.push(s) })
          const mergedDims = mergeDimensions(
            existing.dimensions.map(x => ({ ...x, tags: [] as Tag[] })),
            out.dimensions.map(x => ({ ...x, tags: [] as Tag[] }))
          )
          existing.dimensions = mergedDims
        }
      }
    }

    // Feature list = immediate-child names, sorted
    const immediateChildren = rawCaps
      .filter(c => c.parent_id === capabilityId)
      .sort((a, b) => a.sort_order - b.sort_order)
    const features = immediateChildren.map(c => c.name)

    return {
      ...root,
      features,
      inputs: [...inputAgg.values()],
      outputs: [...outputAgg.values()],
    }
  },

  // ─── Derived: Data & System Architecture ──────────────
  getDataArchitecture: () => {
    const hydrated = get().getHydratedCapabilities()
    const capMap = new Map(get().capabilities.map(c => [c.id, c]))

    // Aggregate by information product id
    const lineageMap = new Map<string, IPLineage>()
    const systemUsageMap = new Map<string, SystemUsage>()
    const flowMap = new Map<string, SystemFlow>()

    const ensureLineage = (ip: InformationProduct): IPLineage => {
      let l = lineageMap.get(ip.id)
      if (!l) {
        l = {
          ip, tags: [], dimensions: [],
          sourceSystems: [], feedingSystems: [], processingSystems: [], destinationSystems: [],
          consumedBy: [], producedBy: [],
          supplierPersonas: [], consumerPersonas: [],
        }
        lineageMap.set(ip.id, l)
      }
      return l
    }

    const ensureSystem = (s: LogicalSystem): SystemUsage => {
      let u = systemUsageMap.get(s.id)
      if (!u) {
        u = { system: s, asSource: [], asFeeding: [], asProcessing: [], asDestination: [] }
        systemUsageMap.set(s.id, u)
      }
      return u
    }

    const addUnique = <T extends { id: string }>(arr: T[], item: T) => {
      if (!arr.some(x => x.id === item.id)) arr.push(item)
    }

    const mergeDims = (target: Dimension[], src: Dimension[]) => {
      const byName = new Map(target.map(d => [d.name.toLowerCase(), d]))
      src.forEach(d => { if (!byName.has(d.name.toLowerCase())) { byName.set(d.name.toLowerCase(), d); target.push(d) } })
    }

    const addFlow = (fromId: string, toId: string, ip: InformationProduct) => {
      if (!fromId || !toId || fromId === toId) return
      const key = `${fromId}→${toId}`
      let f = flowMap.get(key)
      if (!f) { f = { from: fromId, to: toId, ips: [] }; flowMap.set(key, f) }
      if (!f.ips.some(i => i.id === ip.id)) f.ips.push(ip)
    }

    // Walk every capability's inputs/outputs
    hydrated.forEach(cap => {
      const processingSys = cap.system
      const capRaw = capMap.get(cap.id)
      if (!capRaw) return

      cap.inputs.forEach(inp => {
        const lin = ensureLineage(inp.informationProduct)
        addUnique(lin.consumedBy, capRaw)
        inp.tags.forEach(t => addUnique(lin.tags, t))
        mergeDims(lin.dimensions, inp.dimensions.map(d => ({ id: d.id, name: d.name, description: d.description })))
        inp.supplierPersonas.forEach(p => addUnique(lin.supplierPersonas, p))
        inp.sourceSystems.forEach(s => {
          addUnique(lin.sourceSystems, s)
          addUnique(ensureSystem(s).asSource, inp.informationProduct)
        })
        if (inp.feedingSystem) {
          addUnique(lin.feedingSystems, inp.feedingSystem)
          addUnique(ensureSystem(inp.feedingSystem).asFeeding, inp.informationProduct)
        }
        if (processingSys) {
          addUnique(lin.processingSystems, processingSys)
          const u = ensureSystem(processingSys)
          let entry = u.asProcessing.find(e => e.capability.id === capRaw.id)
          if (!entry) { entry = { capability: capRaw, ips: [] }; u.asProcessing.push(entry) }
          if (!entry.ips.some(i => i.id === inp.informationProduct.id)) entry.ips.push(inp.informationProduct)
        }

        // Flows: source → feeding → processing
        const chain = [
          ...inp.sourceSystems.map(s => s.id),
          inp.feedingSystem?.id,
          processingSys?.id,
        ].filter((x): x is string => !!x)
        for (let i = 0; i < chain.length - 1; i++) {
          addFlow(chain[i], chain[i + 1], inp.informationProduct)
        }
      })

      cap.outputs.forEach(out => {
        const lin = ensureLineage(out.informationProduct)
        addUnique(lin.producedBy, capRaw)
        // Pull tags from any input with same IP (outputs don't have their own tags schema)
        const matchingInputTags = hydrated.flatMap(c => c.inputs.filter(i => i.information_product_id === out.information_product_id).flatMap(i => i.tags))
        matchingInputTags.forEach(t => addUnique(lin.tags, t))
        mergeDims(lin.dimensions, out.dimensions.map(d => ({ id: d.id, name: d.name, description: d.description })))
        out.consumerPersonas.forEach(p => addUnique(lin.consumerPersonas, p))
        out.destinationSystems.forEach(s => {
          addUnique(lin.destinationSystems, s)
          addUnique(ensureSystem(s).asDestination, out.informationProduct)
        })
        if (processingSys) {
          addUnique(lin.processingSystems, processingSys)
          const u = ensureSystem(processingSys)
          let entry = u.asProcessing.find(e => e.capability.id === capRaw.id)
          if (!entry) { entry = { capability: capRaw, ips: [] }; u.asProcessing.push(entry) }
          if (!entry.ips.some(i => i.id === out.informationProduct.id)) entry.ips.push(out.informationProduct)
        }

        // Flows: processing → destinations
        if (processingSys) {
          out.destinationSystems.forEach(s => addFlow(processingSys.id, s.id, out.informationProduct))
        }
      })
    })

    const ipLineages = [...lineageMap.values()].sort((a, b) => a.ip.name.localeCompare(b.ip.name))
    const systemUsage: Record<string, SystemUsage> = {}
    systemUsageMap.forEach((v, k) => { systemUsage[k] = v })
    const systems = [...systemUsageMap.values()].map(u => u.system).sort((a, b) => a.name.localeCompare(b.name))
    const flows = [...flowMap.values()].sort((a, b) => b.ips.length - a.ips.length)

    return { ipLineages, systemUsage, systems, flows }
  },

  // ─── Derived: System Network ──────────────────────────
  getSystemNetwork: () => {
    const hydrated = get().getHydratedCapabilities()
    const capMap = new Map(get().capabilities.map(c => [c.id, c]))

    // Aggregate edges by (fromId → toId)
    const edgeMap = new Map<string, SystemEdge>()
    const systemsInvolved = new Set<string>()
    const systemById = new Map<string, LogicalSystem>()

    const touchSystem = (s: LogicalSystem) => {
      systemsInvolved.add(s.id)
      systemById.set(s.id, s)
    }

    const addEdge = (fromId: string, toId: string, capId: string, ip: InformationProduct) => {
      if (!fromId || !toId || fromId === toId) return
      const key = `${fromId}->${toId}`
      let edge = edgeMap.get(key)
      if (!edge) { edge = { from: fromId, to: toId, l3s: [], totalIps: 0 }; edgeMap.set(key, edge) }
      let l3entry = edge.l3s.find(e => e.capability.id === capId)
      if (!l3entry) {
        const cap = capMap.get(capId)
        if (!cap) return
        l3entry = { capability: cap, ips: [] }
        edge.l3s.push(l3entry)
      }
      if (!l3entry.ips.some(i => i.id === ip.id)) l3entry.ips.push(ip)
    }

    hydrated.forEach(cap => {
      const proc = cap.system
      if (proc) touchSystem(proc)

      cap.inputs.forEach(inp => {
        inp.sourceSystems.forEach(s => touchSystem(s))
        if (inp.feedingSystem) touchSystem(inp.feedingSystem)

        // Source systems → Processing system
        if (proc) {
          inp.sourceSystems.forEach(s => addEdge(s.id, proc.id, cap.id, inp.informationProduct))
          if (inp.feedingSystem) addEdge(inp.feedingSystem.id, proc.id, cap.id, inp.informationProduct)
        }
        // Also: source → feeding (upstream lineage) when different
        if (inp.feedingSystem) {
          inp.sourceSystems.forEach(s => addEdge(s.id, inp.feedingSystem!.id, cap.id, inp.informationProduct))
        }
      })

      cap.outputs.forEach(out => {
        out.destinationSystems.forEach(s => touchSystem(s))
        // Processing → Destinations
        if (proc) {
          out.destinationSystems.forEach(s => addEdge(proc.id, s.id, cap.id, out.informationProduct))
        }
      })
    })

    // Finalize: compute totalIps per edge
    edgeMap.forEach(e => {
      const ipSet = new Set<string>()
      e.l3s.forEach(l => l.ips.forEach(ip => ipSet.add(ip.id)))
      e.totalIps = ipSet.size
    })

    const systems = [...systemsInvolved].map(id => systemById.get(id)!).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
    const edges = [...edgeMap.values()].sort((a, b) => b.totalIps - a.totalIps)

    return { systems, edges }
  },
}))
