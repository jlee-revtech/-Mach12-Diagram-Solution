import { create } from 'zustand'
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type XYPosition,
} from '@xyflow/react'
import { v4 as uuid } from 'uuid'
import { getDiagram, saveDiagram as saveDiagramApi } from '@/lib/supabase/diagrams'
import type {
  SystemNode,
  DataFlowEdge,
  SystemType,
  DataElement,
  DataObjectAttribute,
  DiagramMeta,
} from './types'

// ─── Store Interface ────────────────────────────────────
interface DiagramState {
  // Diagram metadata
  meta: DiagramMeta
  // React Flow state
  nodes: SystemNode[]
  edges: DataFlowEdge[]
  // UI state
  selectedNodeId: string | null
  selectedEdgeId: string | null
  sidebarTab: 'palette' | 'properties' | 'elements' | 'notes'
  // React Flow handlers
  onNodesChange: (changes: NodeChange<SystemNode>[]) => void
  onEdgesChange: (changes: EdgeChange<DataFlowEdge>[]) => void
  onConnect: (connection: Connection) => void
  // System node actions
  addSystem: (type: SystemType, label: string, position: XYPosition) => string
  updateSystemLabel: (nodeId: string, label: string) => void
  updateSystemPhysical: (nodeId: string, physicalSystem: string) => void
  deleteSelected: () => void
  // Data element actions
  addDataElement: (edgeId: string, element: Omit<DataElement, 'id'>) => void
  updateDataElement: (edgeId: string, elementId: string, updates: Partial<DataElement>) => void
  removeDataElement: (edgeId: string, elementId: string) => void
  // Data object attribute actions
  addAttribute: (edgeId: string, elementId: string, attr: Omit<DataObjectAttribute, 'id'>) => void
  removeAttribute: (edgeId: string, elementId: string, attrId: string) => void
  updateAttribute: (edgeId: string, elementId: string, attrId: string, updates: Partial<DataObjectAttribute>) => void
  // Selection
  setSelectedNode: (id: string | null) => void
  setSelectedEdge: (id: string | null) => void
  setSidebarTab: (tab: 'palette' | 'properties' | 'elements' | 'notes') => void
  // Diagram meta
  setTitle: (title: string) => void
  setProcessContext: (context: string) => void
  setNotes: (notes: string) => void
  // Persistence (Supabase)
  saveDiagram: (userId: string) => Promise<void>
  loadDiagram: (id: string) => Promise<boolean>
  setMeta: (meta: DiagramMeta) => void
}

function createEmptyMeta(): DiagramMeta {
  return {
    id: uuid(),
    title: 'Untitled Diagram',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  meta: createEmptyMeta(),
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  sidebarTab: 'palette',

  // ─── React Flow Handlers ──────────────────────────────
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) })
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) })
  },

  onConnect: (connection) => {
    const newEdge: DataFlowEdge = {
      ...connection,
      id: `edge-${uuid()}`,
      type: 'dataFlow',
      data: {
        label: '',
        dataElements: [],
        direction: 'forward',
      },
    }
    set({ edges: addEdge(newEdge, get().edges) as DataFlowEdge[] })
  },

  // ─── System Node Actions ──────────────────────────────
  addSystem: (type, label, position) => {
    const id = `system-${uuid()}`
    const newNode: SystemNode = {
      id,
      type: 'system',
      position,
      data: { label, systemType: type },
    }
    set({ nodes: [...get().nodes, newNode] })
    return id
  },

  updateSystemLabel: (nodeId, label) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label } } : n
      ),
    })
  },

  updateSystemPhysical: (nodeId, physicalSystem) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, physicalSystem } } : n
      ),
    })
  },

  deleteSelected: () => {
    const { selectedNodeId, selectedEdgeId, nodes, edges } = get()
    if (selectedNodeId) {
      set({
        nodes: nodes.filter((n) => n.id !== selectedNodeId),
        edges: edges.filter(
          (e) => e.source !== selectedNodeId && e.target !== selectedNodeId
        ),
        selectedNodeId: null,
      })
    } else if (selectedEdgeId) {
      set({
        edges: edges.filter((e) => e.id !== selectedEdgeId),
        selectedEdgeId: null,
      })
    }
  },

  // ─── Data Element Actions ─────────────────────────────
  addDataElement: (edgeId, element) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId && e.data
          ? {
              ...e,
              data: {
                ...e.data,
                dataElements: [
                  ...e.data.dataElements,
                  { ...element, id: uuid() },
                ],
              },
            }
          : e
      ),
    })
  },

  updateDataElement: (edgeId, elementId, updates) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId && e.data
          ? {
              ...e,
              data: {
                ...e.data,
                dataElements: e.data.dataElements.map((el) =>
                  el.id === elementId ? { ...el, ...updates } : el
                ),
              },
            }
          : e
      ),
    })
  },

  removeDataElement: (edgeId, elementId) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId && e.data
          ? {
              ...e,
              data: {
                ...e.data,
                dataElements: e.data.dataElements.filter(
                  (el) => el.id !== elementId
                ),
              },
            }
          : e
      ),
    })
  },

  addAttribute: (edgeId, elementId, attr) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId && e.data
          ? {
              ...e,
              data: {
                ...e.data,
                dataElements: e.data.dataElements.map((el) =>
                  el.id === elementId
                    ? { ...el, attributes: [...(el.attributes || []), { ...attr, id: uuid() }] }
                    : el
                ),
              },
            }
          : e
      ),
    })
  },

  removeAttribute: (edgeId, elementId, attrId) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId && e.data
          ? {
              ...e,
              data: {
                ...e.data,
                dataElements: e.data.dataElements.map((el) =>
                  el.id === elementId
                    ? { ...el, attributes: (el.attributes || []).filter((a) => a.id !== attrId) }
                    : el
                ),
              },
            }
          : e
      ),
    })
  },

  updateAttribute: (edgeId, elementId, attrId, updates) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId && e.data
          ? {
              ...e,
              data: {
                ...e.data,
                dataElements: e.data.dataElements.map((el) =>
                  el.id === elementId
                    ? {
                        ...el,
                        attributes: (el.attributes || []).map((a) =>
                          a.id === attrId ? { ...a, ...updates } : a
                        ),
                      }
                    : el
                ),
              },
            }
          : e
      ),
    })
  },

  // ─── Selection ────────────────────────────────────────
  setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  // ─── Diagram Meta ─────────────────────────────────────
  setTitle: (title) =>
    set({ meta: { ...get().meta, title } }),

  setProcessContext: (context) =>
    set({ meta: { ...get().meta, processContext: context } }),

  setNotes: (notes) =>
    set({ meta: { ...get().meta, notes } }),

  // ─── Persistence (Supabase) ────────────────────────────
  saveDiagram: async (userId: string) => {
    const { meta, nodes, edges } = get()
    await saveDiagramApi(meta.id, userId, {
      title: meta.title,
      description: meta.description,
      process_context: meta.processContext,
      canvas_data: { nodes, edges, notes: meta.notes },
    })
    set({ meta: { ...meta, updatedAt: new Date().toISOString() } })
  },

  loadDiagram: async (id: string) => {
    const row = await getDiagram(id)
    if (!row) return false
    const canvas = row.canvas_data as { nodes: SystemNode[]; edges: DataFlowEdge[]; notes?: string }
    set({
      meta: {
        id: row.id,
        title: row.title,
        description: row.description ?? undefined,
        processContext: row.process_context ?? undefined,
        notes: canvas.notes ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      nodes: canvas.nodes ?? [],
      edges: canvas.edges ?? [],
      selectedNodeId: null,
      selectedEdgeId: null,
    })
    return true
  },

  setMeta: (meta) => set({ meta }),
}))
