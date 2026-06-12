import { create } from 'zustand'
import type {
  ProcessModelRow,
  ProcessNode,
  ProcessNodeTreeNode,
  ProcessGraph,
  ProcessNodeKind,
} from './types'
import type { LogicalSystem, Persona } from '@/lib/sipoc/types'
import * as api from '@/lib/supabase/process-models'
import * as sipocApi from '@/lib/supabase/capability-maps'

interface ProcessState {
  // Model metadata
  model: ProcessModelRow | null
  loading: boolean

  // Hierarchy
  nodes: ProcessNode[]

  // Reused org pools (lanes reference these)
  logicalSystems: LogicalSystem[]
  personas: Persona[]

  // UI state
  readOnly: boolean
  setReadOnly: (v: boolean) => void
  selectedNodeId: string | null
  setSelectedNode: (id: string | null) => void

  // ─── Data loading ─────────────────────────────────────
  loadModel: (modelId: string, anon?: boolean) => Promise<boolean>
  loadOrgEntities: (orgId: string, anon?: boolean) => Promise<void>

  // ─── Model meta ───────────────────────────────────────
  updateTitle: (title: string, userId: string) => Promise<void>
  updateDescription: (description: string, userId: string) => Promise<void>

  // ─── Node CRUD ────────────────────────────────────────
  addNode: (name: string, parentId?: string | null, level?: number, color?: string | null) => Promise<string | undefined>
  updateNode: (id: string, updates: Partial<Pick<ProcessNode, 'name' | 'description' | 'color' | 'parent_id' | 'level' | 'node_kind' | 'sort_order' | 'is_leaf' | 'sipoc_capability_id' | 'scope_item_ref'>>) => Promise<void>
  removeNode: (id: string) => Promise<void>
  reorderNode: (id: string, newSortOrder: number) => Promise<void>
  getProcessTree: () => ProcessNodeTreeNode[]

  // ─── Leaf BPMN graph (Phase 2) ────────────────────────
  saveLeafGraph: (nodeId: string, graph: ProcessGraph) => Promise<void>
}

const kindForLevel = (level: number): ProcessNodeKind =>
  level === 1 ? 'scenario' : level === 2 ? 'process_group' : 'process'

export const useProcessStore = create<ProcessState>((set, get) => ({
  model: null,
  loading: false,
  nodes: [],
  logicalSystems: [],
  personas: [],
  readOnly: false,
  setReadOnly: (v) => set({ readOnly: v }),
  selectedNodeId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),

  // ─── Data loading ─────────────────────────────────────

  loadModel: async (modelId, anon) => {
    set({ loading: true })
    const model = anon ? await api.getProcessModelAnon(modelId) : await api.getProcessModel(modelId)
    if (!model) { set({ loading: false }); return false }
    const nodes = anon ? await api.listProcessNodesAnon(modelId) : await api.listProcessNodes(modelId)
    set({ model, nodes, loading: false })
    return true
  },

  loadOrgEntities: async (orgId, anon) => {
    const [systems, personas] = await Promise.all([
      anon ? sipocApi.listLogicalSystemsAnon(orgId) : sipocApi.listLogicalSystems(orgId),
      anon ? sipocApi.listPersonasAnon(orgId) : sipocApi.listPersonas(orgId),
    ])
    set({ logicalSystems: systems, personas })
  },

  // ─── Model meta ───────────────────────────────────────

  updateTitle: async (title, userId) => {
    const { model } = get()
    if (!model) return
    await api.updateProcessModel(model.id, userId, { title })
    set({ model: { ...model, title } })
  },

  updateDescription: async (description, userId) => {
    const { model } = get()
    if (!model) return
    await api.updateProcessModel(model.id, userId, { description })
    set({ model: { ...model, description } })
  },

  // ─── Node CRUD ────────────────────────────────────────

  addNode: async (name, parentId, level, color) => {
    const { model, nodes } = get()
    if (!model) return undefined
    const lvl = level ?? 1
    const siblings = nodes.filter(n => n.parent_id === (parentId || null))
    const sortOrder = siblings.length
    const node = await api.createProcessNode(model.id, name, sortOrder, parentId, lvl, kindForLevel(lvl), color)
    set({ nodes: [...nodes, node] })
    return node.id
  },

  updateNode: async (id, updates) => {
    set({ nodes: get().nodes.map(n => (n.id === id ? { ...n, ...updates } : n)) })
    await api.updateProcessNode(id, updates)
  },

  removeNode: async (id) => {
    await api.deleteProcessNode(id)
    // Remove the node; orphan its children to root (DB cascades the subtree,
    // but locally we null the parent so a single delete doesn't drop the UI subtree).
    set({
      nodes: get().nodes
        .filter(n => n.id !== id)
        .map(n => (n.parent_id === id ? { ...n, parent_id: null } : n)),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    })
  },

  reorderNode: async (id, newSortOrder) => {
    await api.updateProcessNode(id, { sort_order: newSortOrder })
    set({
      nodes: get().nodes
        .map(n => (n.id === id ? { ...n, sort_order: newSortOrder } : n))
        .sort((a, b) => a.sort_order - b.sort_order),
    })
  },

  getProcessTree: () => {
    const { nodes } = get()
    const idSet = new Set(nodes.map(n => n.id))
    const getEffectiveParent = (n: ProcessNode): string | null => {
      if (!n.parent_id) return null
      return idSet.has(n.parent_id) ? n.parent_id : null
    }
    const buildTree = (parentId: string | null): ProcessNodeTreeNode[] =>
      nodes
        .filter(n => getEffectiveParent(n) === parentId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(n => ({ ...n, children: buildTree(n.id) }))
    return buildTree(null)
  },

  // ─── Leaf BPMN graph (Phase 2) ────────────────────────

  saveLeafGraph: async (nodeId, graph) => {
    set({ nodes: get().nodes.map(n => (n.id === nodeId ? { ...n, graph_data: graph } : n)) })
    await api.saveProcessGraph(nodeId, graph)
  },
}))
