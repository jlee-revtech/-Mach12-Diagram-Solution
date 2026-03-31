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
  DataFlowData,
  SystemType,
  DataElement,
  DataObjectAttribute,
  TechnicalProperty,
  OutputArtifact,
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
  // Edge reconnection (drag endpoint to new node)
  onReconnect: (oldEdge: DataFlowEdge, newConnection: Connection) => void
  // System node actions
  addSystem: (type: SystemType, label: string, position: XYPosition) => string
  updateSystemLabel: (nodeId: string, label: string) => void
  updateSystemPhysical: (nodeId: string, physicalSystem: string) => void
  deleteSelected: () => void
  // Edge endpoint editing (sidebar dropdowns)
  updateEdgeEndpoint: (edgeId: string, endpoint: 'source' | 'target', newNodeId: string) => void
  // Edge label position (0–1 along path)
  updateEdgeLabelPosition: (edgeId: string, position: number) => void
  // Edge data copy/paste
  copiedEdgeData: DataFlowData | null
  copyEdgeData: (edgeId: string) => void
  pasteEdgeData: (edgeId: string) => void
  // Data element actions
  addDataElement: (edgeId: string, element: Omit<DataElement, 'id'>) => void
  updateDataElement: (edgeId: string, elementId: string, updates: Partial<DataElement>) => void
  removeDataElement: (edgeId: string, elementId: string) => void
  reorderDataElements: (edgeId: string, fromIndex: number, toIndex: number) => void
  toggleElementArtifact: (edgeId: string, elementId: string, artifactId: string) => void
  // Data object attribute actions
  addAttribute: (edgeId: string, elementId: string, attr: Omit<DataObjectAttribute, 'id'>) => void
  removeAttribute: (edgeId: string, elementId: string, attrId: string) => void
  updateAttribute: (edgeId: string, elementId: string, attrId: string, updates: Partial<DataObjectAttribute>) => void
  // Technical property actions
  addTechnicalProperty: (edgeId: string, elementId: string, prop: Omit<TechnicalProperty, 'id'>) => void
  removeTechnicalProperty: (edgeId: string, elementId: string, propId: string) => void
  updateTechnicalProperty: (edgeId: string, elementId: string, propId: string, updates: Partial<TechnicalProperty>) => void
  // Output artifact actions
  addOutputArtifact: (edgeId: string, artifact: Omit<OutputArtifact, 'id'>) => void
  removeOutputArtifact: (edgeId: string, artifactId: string) => void
  updateOutputArtifact: (edgeId: string, artifactId: string, updates: Partial<OutputArtifact>) => void
  // Diagram-level output artifacts
  artifacts: OutputArtifact[]
  addArtifact: (artifact: Omit<OutputArtifact, 'id'>) => void
  removeArtifact: (artifactId: string) => void
  updateArtifact: (artifactId: string, updates: Partial<OutputArtifact>) => void
  toggleEdgeArtifact: (edgeId: string, artifactId: string) => void
  // Spotlight — auto-highlights connections for selected node
  spotlightNodeId: string | null
  spotlightEdgeIds: Set<string>
  spotlightNodeIds: Set<string>
  // Spotlight by artifact
  spotlightArtifactId: string | null
  setSpotlightArtifact: (artifactId: string | null) => void
  // Connect mode (click source, click target)
  connectMode: boolean
  pendingConnectionSource: string | null
  toggleConnectMode: () => void
  handleConnectModeClick: (nodeId: string) => void
  // Selection
  setSelectedNode: (id: string | null) => void
  setSelectedEdge: (id: string | null) => void
  setSidebarTab: (tab: 'palette' | 'properties' | 'elements' | 'notes') => void
  // Auto layout
  autoLayout: () => void
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
  artifacts: [],
  spotlightNodeId: null,
  spotlightEdgeIds: new Set<string>(),
  spotlightNodeIds: new Set<string>(),
  spotlightArtifactId: null,
  copiedEdgeData: null,
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

  onReconnect: (oldEdge, newConnection) => {
    // Replace the old edge with the reconnected one, preserving all data
    set({
      edges: get().edges.map((e) =>
        e.id === oldEdge.id
          ? {
              ...e,
              source: newConnection.source,
              target: newConnection.target,
              sourceHandle: newConnection.sourceHandle ?? e.sourceHandle,
              targetHandle: newConnection.targetHandle ?? e.targetHandle,
            }
          : e
      ),
    })
  },

  // ─── Edge Label Position ───────────────────────────────
  updateEdgeLabelPosition: (edgeId, position) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId && e.data
          ? { ...e, data: { ...e.data, labelPosition: Math.max(0, Math.min(1, position)) } }
          : e
      ),
    })
  },

  // ─── Edge Endpoint Editing (sidebar) ──────────────────
  updateEdgeEndpoint: (edgeId, endpoint, newNodeId) => {
    const { edges, nodes } = get()
    const edge = edges.find((e) => e.id === edgeId)
    if (!edge) return
    // Don't allow self-loops
    const otherEnd = endpoint === 'source' ? edge.target : edge.source
    if (newNodeId === otherEnd) return
    // Recalculate best handles for new layout
    const srcId = endpoint === 'source' ? newNodeId : edge.source
    const tgtId = endpoint === 'target' ? newNodeId : edge.target
    const srcNode = nodes.find((n) => n.id === srcId)
    const tgtNode = nodes.find((n) => n.id === tgtId)
    if (!srcNode || !tgtNode) return
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
    set({
      edges: edges.map((e) =>
        e.id === edgeId
          ? { ...e, source: srcId, target: tgtId, sourceHandle, targetHandle }
          : e
      ),
    })
  },

  // ─── Edge Data Copy/Paste ─────────────────────────────
  copyEdgeData: (edgeId) => {
    const edge = get().edges.find((e) => e.id === edgeId)
    if (!edge?.data) return
    // Deep clone the data, assigning new IDs so paste creates independent copies
    const cloned: DataFlowData = {
      ...edge.data,
      dataElements: edge.data.dataElements.map((el) => ({
        ...el,
        id: uuid(),
        attributes: el.attributes?.map((a) => ({ ...a, id: uuid() })),
        technicalProperties: el.technicalProperties?.map((p) => ({ ...p, id: uuid() })),
      })),
    }
    set({ copiedEdgeData: cloned })
  },

  pasteEdgeData: (edgeId) => {
    const { copiedEdgeData, edges } = get()
    if (!copiedEdgeData) return
    // Re-generate IDs for each paste so multiple pastes produce unique elements
    const freshData: DataFlowData = {
      ...copiedEdgeData,
      dataElements: copiedEdgeData.dataElements.map((el) => ({
        ...el,
        id: uuid(),
        attributes: el.attributes?.map((a) => ({ ...a, id: uuid() })),
        technicalProperties: el.technicalProperties?.map((p) => ({ ...p, id: uuid() })),
      })),
    }
    set({
      edges: edges.map((e) =>
        e.id === edgeId && e.data
          ? { ...e, data: { ...freshData, label: e.data.label } }
          : e
      ),
    })
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

  reorderDataElements: (edgeId, fromIndex, toIndex) => {
    set({
      edges: get().edges.map((e) => {
        if (e.id !== edgeId || !e.data) return e
        const items = [...e.data.dataElements]
        const [moved] = items.splice(fromIndex, 1)
        items.splice(toIndex, 0, moved)
        return { ...e, data: { ...e.data, dataElements: items } }
      }),
    })
  },

  toggleElementArtifact: (edgeId, elementId, artifactId) => {
    set({
      edges: get().edges.map((e) => {
        if (e.id !== edgeId || !e.data) return e
        return {
          ...e,
          data: {
            ...e.data,
            dataElements: e.data.dataElements.map((el) => {
              if (el.id !== elementId) return el
              const ids = el.outputArtifactIds ?? []
              const has = ids.includes(artifactId)
              return {
                ...el,
                outputArtifactIds: has ? ids.filter((id) => id !== artifactId) : [...ids, artifactId],
              }
            }),
          },
        }
      }),
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

  // ─── Diagram-Level Artifacts ───────────────────────────
  addArtifact: (artifact) => {
    set({ artifacts: [...get().artifacts, { ...artifact, id: uuid() }] })
  },

  removeArtifact: (artifactId) => {
    // Remove from diagram list and untag from all edges + elements
    set({
      artifacts: get().artifacts.filter((a) => a.id !== artifactId),
      edges: get().edges.map((e) => {
        if (!e.data) return e
        const edgeIds = e.data.outputArtifactIds?.includes(artifactId)
          ? e.data.outputArtifactIds.filter((id) => id !== artifactId)
          : e.data.outputArtifactIds
        const dataElements = e.data.dataElements.map((el) =>
          el.outputArtifactIds?.includes(artifactId)
            ? { ...el, outputArtifactIds: el.outputArtifactIds.filter((id) => id !== artifactId) }
            : el
        )
        return { ...e, data: { ...e.data, outputArtifactIds: edgeIds, dataElements } }
      }),
    })
  },

  updateArtifact: (artifactId, updates) => {
    set({
      artifacts: get().artifacts.map((a) =>
        a.id === artifactId ? { ...a, ...updates } : a
      ),
    })
  },

  toggleEdgeArtifact: (edgeId, artifactId) => {
    set({
      edges: get().edges.map((e) => {
        if (e.id !== edgeId || !e.data) return e
        const ids = e.data.outputArtifactIds ?? []
        const has = ids.includes(artifactId)
        return {
          ...e,
          data: {
            ...e.data,
            outputArtifactIds: has ? ids.filter((id) => id !== artifactId) : [...ids, artifactId],
          },
        }
      }),
    })
  },

  // Spotlight by artifact
  setSpotlightArtifact: (artifactId) => {
    if (!artifactId) {
      set({ spotlightArtifactId: null, spotlightNodeId: null, spotlightEdgeIds: new Set(), spotlightNodeIds: new Set(), selectedNodeId: null })
      return
    }
    const { edges } = get()
    const edgeIds = new Set<string>()
    const nodeIds = new Set<string>()
    for (const e of edges) {
      const edgeTagged = e.data?.outputArtifactIds?.includes(artifactId)
      const elementTagged = e.data?.dataElements.some((el) => el.outputArtifactIds?.includes(artifactId))
      if (edgeTagged || elementTagged) {
        edgeIds.add(e.id)
        nodeIds.add(e.source)
        nodeIds.add(e.target)
      }
    }
    set({
      spotlightArtifactId: artifactId,
      spotlightNodeId: '__artifact__', // sentinel so spotlight rendering activates
      spotlightEdgeIds: edgeIds,
      spotlightNodeIds: nodeIds,
      selectedNodeId: null,
      selectedEdgeId: null,
    })
  },

  // ─── Per-Edge Output Artifacts (legacy) ──────────────
  addOutputArtifact: (edgeId, artifact) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId && e.data
          ? {
              ...e,
              data: {
                ...e.data,
                outputArtifacts: [...(e.data.outputArtifacts || []), { ...artifact, id: uuid() }],
              },
            }
          : e
      ),
    })
  },

  removeOutputArtifact: (edgeId, artifactId) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId && e.data
          ? {
              ...e,
              data: {
                ...e.data,
                outputArtifacts: (e.data.outputArtifacts || []).filter((a) => a.id !== artifactId),
              },
            }
          : e
      ),
    })
  },

  updateOutputArtifact: (edgeId, artifactId, updates) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId && e.data
          ? {
              ...e,
              data: {
                ...e.data,
                outputArtifacts: (e.data.outputArtifacts || []).map((a) =>
                  a.id === artifactId ? { ...a, ...updates } : a
                ),
              },
            }
          : e
      ),
    })
  },

  // ─── Technical Properties ──────────────────────────────
  addTechnicalProperty: (edgeId, elementId, prop) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId && e.data
          ? {
              ...e,
              data: {
                ...e.data,
                dataElements: e.data.dataElements.map((el) =>
                  el.id === elementId
                    ? { ...el, technicalProperties: [...(el.technicalProperties || []), { ...prop, id: uuid() }] }
                    : el
                ),
              },
            }
          : e
      ),
    })
  },

  removeTechnicalProperty: (edgeId, elementId, propId) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId && e.data
          ? {
              ...e,
              data: {
                ...e.data,
                dataElements: e.data.dataElements.map((el) =>
                  el.id === elementId
                    ? { ...el, technicalProperties: (el.technicalProperties || []).filter((p) => p.id !== propId) }
                    : el
                ),
              },
            }
          : e
      ),
    })
  },

  updateTechnicalProperty: (edgeId, elementId, propId, updates) => {
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
                        technicalProperties: (el.technicalProperties || []).map((p) =>
                          p.id === propId ? { ...p, ...updates } : p
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
    const { connectMode, spotlightNodeId } = get()
    // Can't enter connect mode while spotlight is active
    if (!connectMode && spotlightNodeId) return
    set({ connectMode: !connectMode, pendingConnectionSource: null })
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
  setSelectedNode: (id) => {
    if (id) {
      const { edges } = get()
      const spotlightEdgeIds = new Set<string>()
      const spotlightNodeIds = new Set<string>([id])
      for (const e of edges) {
        if (e.source === id || e.target === id) {
          spotlightEdgeIds.add(e.id)
          spotlightNodeIds.add(e.source)
          spotlightNodeIds.add(e.target)
        }
      }
      set({ selectedNodeId: id, selectedEdgeId: null, spotlightNodeId: id, spotlightEdgeIds, spotlightNodeIds, spotlightArtifactId: null })
    } else {
      set({ selectedNodeId: null, selectedEdgeId: null, spotlightNodeId: null, spotlightEdgeIds: new Set(), spotlightNodeIds: new Set(), spotlightArtifactId: null })
    }
  },
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null, spotlightNodeId: null, spotlightEdgeIds: new Set(), spotlightNodeIds: new Set(), spotlightArtifactId: null }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  // ─── Auto Layout ──────────────────────────────────────
  autoLayout: () => {
    const { nodes, edges } = get()
    if (nodes.length === 0) return

    const NODE_W = 240
    const NODE_H = 100
    const COL_GAP = 200 // horizontal gap between columns (no labels here — labels are on horizontal edges)

    // ── 1. Group nodes by systemType into vertical columns ──
    // Order columns by: ERP first, then by connection density
    const typeGroups = new Map<string, string[]>()
    for (const n of nodes) {
      const t = n.data.systemType
      if (!typeGroups.has(t)) typeGroups.set(t, [])
      typeGroups.get(t)!.push(n.id)
    }

    // Build adjacency for sorting
    const adj = new Map<string, Set<string>>()
    nodes.forEach((n) => adj.set(n.id, new Set()))
    edges.forEach((e) => {
      adj.get(e.source)?.add(e.target)
      adj.get(e.target)?.add(e.source)
    })

    // Sort columns: most connected types first, ERP always first
    const typeOrder = [...typeGroups.entries()].sort((a, b) => {
      if (a[0] === 'erp') return -1
      if (b[0] === 'erp') return 1
      // Sum connections for all nodes of this type
      const aConns = a[1].reduce((s, id) => s + (adj.get(id)?.size ?? 0), 0)
      const bConns = b[1].reduce((s, id) => s + (adj.get(id)?.size ?? 0), 0)
      return bConns - aConns
    })

    // ── 2. Measure edge label heights for vertical spacing ──
    const edgeLabelH = (e: DataFlowEdge): number => {
      const els = e.data?.dataElements ?? []
      if (els.length === 0) return 40
      let h = 24 // padding
      for (const el of els) {
        h += 20 // element name row
        h += (el.attributes?.length ?? 0) * 14
      }
      return h
    }

    // For each node, find the max label height on edges to nodes
    // in OTHER columns (horizontal edges that need label room)
    const nodeTypeMap = new Map(nodes.map((n) => [n.id, n.data.systemType]))
    const maxHorizLabel = new Map<string, number>()
    for (const e of edges) {
      const srcType = nodeTypeMap.get(e.source)
      const tgtType = nodeTypeMap.get(e.target)
      if (srcType !== tgtType) {
        // Cross-column edge — its label will appear horizontally
        // Doesn't affect vertical spacing directly
      } else {
        // Same-column edge — label appears between vertically stacked nodes
        const lh = edgeLabelH(e)
        maxHorizLabel.set(e.source, Math.max(maxHorizLabel.get(e.source) ?? 0, lh))
        maxHorizLabel.set(e.target, Math.max(maxHorizLabel.get(e.target) ?? 0, lh))
      }
    }

    // ── 3. Position: each systemType is a vertical column ──
    const positioned = new Map<string, { x: number; y: number }>()
    let curX = 0

    // Track column x positions for gap calculation
    const colInfo: { type: string; nodeIds: string[]; x: number }[] = []

    for (const [sysType, nodeIds] of typeOrder) {
      // Sort nodes within column by connection count (most connected on top)
      nodeIds.sort((a, b) => (adj.get(b)?.size ?? 0) - (adj.get(a)?.size ?? 0))

      let curY = 0
      for (let i = 0; i < nodeIds.length; i++) {
        const nid = nodeIds[i]
        positioned.set(nid, { x: curX, y: curY })

        // Gap below this node: base gap + extra for same-column edge labels
        const labelSpace = maxHorizLabel.get(nid) ?? 0
        const gap = Math.max(180, labelSpace + 80)
        curY += NODE_H + gap
      }

      colInfo.push({ type: sysType, nodeIds, x: curX })

      // Compute gap to next column: measure widest label on cross-column edges
      let maxCrossLabel = 0
      const colNodeSet = new Set(nodeIds)
      for (const e of edges) {
        const srcIn = colNodeSet.has(e.source)
        const tgtIn = colNodeSet.has(e.target)
        if ((srcIn && !tgtIn) || (!srcIn && tgtIn)) {
          const longest = (e.data?.dataElements ?? []).reduce(
            (max, el) => Math.max(max, el.name.length), 0
          )
          maxCrossLabel = Math.max(maxCrossLabel, longest)
        }
      }
      const dynamicGap = Math.max(COL_GAP, maxCrossLabel * 8 + 160)
      curX += NODE_W + dynamicGap
    }

    // ── 4. Vertical centering: align all columns to the tallest ──
    const colHeights = colInfo.map((c) => {
      if (c.nodeIds.length === 0) return 0
      const last = c.nodeIds[c.nodeIds.length - 1]
      return (positioned.get(last)?.y ?? 0) + NODE_H
    })
    const maxH = Math.max(...colHeights)
    for (let i = 0; i < colInfo.length; i++) {
      const offset = (maxH - colHeights[i]) / 2
      if (offset > 0) {
        for (const nid of colInfo[i].nodeIds) {
          const p = positioned.get(nid)!
          positioned.set(nid, { x: p.x, y: p.y + offset })
        }
      }
    }

    // ── 5. Apply positions and fix edge handles ──
    const updatedNodes = nodes.map((n) => {
      const pos = positioned.get(n.id)
      return pos ? { ...n, position: pos } : n
    })

    const nodeMap = new Map(updatedNodes.map((n) => [n.id, n]))
    const updatedEdges = edges.map((e) => {
      const src = nodeMap.get(e.source)
      const tgt = nodeMap.get(e.target)
      if (!src || !tgt) return e
      const dx = tgt.position.x - src.position.x
      const dy = tgt.position.y - src.position.y
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

    set({ nodes: updatedNodes, edges: updatedEdges })
  },

  // ─── Diagram Meta ─────────────────────────────────────
  setTitle: (title) =>
    set({ meta: { ...get().meta, title } }),

  setProcessContext: (context) =>
    set({ meta: { ...get().meta, processContext: context } }),

  setNotes: (notes) =>
    set({ meta: { ...get().meta, notes } }),

  // ─── Persistence (Supabase) ────────────────────────────
  saveDiagram: async (userId: string) => {
    const { meta, nodes, edges, artifacts } = get()
    await saveDiagramApi(meta.id, userId, {
      title: meta.title,
      description: meta.description,
      process_context: meta.processContext,
      canvas_data: { nodes, edges, notes: meta.notes, artifacts },
    })
    set({ meta: { ...meta, updatedAt: new Date().toISOString() } })
  },

  loadDiagram: async (id: string) => {
    const row = await getDiagram(id)
    if (!row) return false
    const canvas = row.canvas_data as { nodes: SystemNode[]; edges: DataFlowEdge[]; notes?: string; artifacts?: OutputArtifact[] }
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
      artifacts: canvas.artifacts ?? [],
      selectedNodeId: null,
      selectedEdgeId: null,
    })
    return true
  },

  setMeta: (meta) => set({ meta }),
}))
