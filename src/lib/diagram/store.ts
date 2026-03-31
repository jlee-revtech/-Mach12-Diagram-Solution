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
  // Connect mode (click source, click target)
  connectMode: boolean
  pendingConnectionSource: string | null
  toggleConnectMode: () => void
  handleConnectModeClick: (nodeId: string) => void
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
  connectMode: false,
  pendingConnectionSource: null,

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

  // ─── Connect Mode ─────────────────────────────────────
  toggleConnectMode: () => {
    const current = get().connectMode
    set({ connectMode: !current, pendingConnectionSource: null })
  },

  handleConnectModeClick: (nodeId: string) => {
    const { pendingConnectionSource, nodes } = get()
    if (!pendingConnectionSource) {
      // First click — set as source
      set({ pendingConnectionSource: nodeId })
      return
    }
    if (pendingConnectionSource === nodeId) {
      // Clicked same node — cancel
      set({ pendingConnectionSource: null })
      return
    }
    // Second click — pick best handles based on relative position
    const sourceNode = nodes.find((n) => n.id === pendingConnectionSource)
    const targetNode = nodes.find((n) => n.id === nodeId)
    if (!sourceNode || !targetNode) {
      set({ pendingConnectionSource: null })
      return
    }
    const dx = targetNode.position.x - sourceNode.position.x
    const dy = targetNode.position.y - sourceNode.position.y
    let sourceHandle: string
    let targetHandle: string
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal: source's right → target's left, or vice versa
      sourceHandle = dx > 0 ? 'right-s2' : 'left-s2'
      targetHandle = dx > 0 ? 'left-t1' : 'right-t1'
    } else {
      // Vertical: source's bottom → target's top, or vice versa
      sourceHandle = dy > 0 ? 'bot-s2' : 'top-s2'
      targetHandle = dy > 0 ? 'top-t1' : 'bot-t1'
    }
    const newEdge: DataFlowEdge = {
      id: `edge-${uuid()}`,
      type: 'dataFlow',
      source: pendingConnectionSource,
      target: nodeId,
      sourceHandle,
      targetHandle,
      data: { label: '', dataElements: [], direction: 'forward' },
    }
    set({
      edges: [...get().edges, newEdge],
      pendingConnectionSource: null,
      selectedEdgeId: newEdge.id,
      sidebarTab: 'elements',
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
    const nodes = canvas.nodes ?? []
    let edges = canvas.edges ?? []

    // Repair edges with invalid handle IDs (e.g. 'right-src', 'left-tgt')
    const validHandles = new Set([
      'top-s1','top-t1','top-s2','top-t2','top-s3','top-t3',
      'bot-s1','bot-t1','bot-s2','bot-t2','bot-s3','bot-t3',
      'left-s1','left-t1','left-s2','left-t2','left-s3',
      'right-s1','right-t1','right-s2','right-t2','right-s3',
    ])
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    edges = edges.map((e) => {
      const srcNode = nodeMap.get(e.source)
      const tgtNode = nodeMap.get(e.target)
      const needsFix =
        (e.sourceHandle && !validHandles.has(e.sourceHandle)) ||
        (e.targetHandle && !validHandles.has(e.targetHandle))
      if (!needsFix || !srcNode || !tgtNode) return e
      const dx = tgtNode.position.x - srcNode.position.x
      const dy = tgtNode.position.y - srcNode.position.y
      let sourceHandle: string
      let targetHandle: string
      if (Math.abs(dx) > Math.abs(dy)) {
        sourceHandle = dx > 0 ? 'right-s2' : 'left-s2'
        targetHandle = dx > 0 ? 'left-t1' : 'right-t1'
      } else {
        sourceHandle = dy > 0 ? 'bot-s2' : 'top-s2'
        targetHandle = dy > 0 ? 'top-t1' : 'bot-t1'
      }
      return { ...e, sourceHandle, targetHandle }
    })

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
      nodes,
      edges,
      selectedNodeId: null,
      selectedEdgeId: null,
    })
    return true
  },

  setMeta: (meta) => set({ meta }),
}))
