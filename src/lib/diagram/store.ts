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
  SystemGroupNode,
  DataFlowEdge,
  DataFlowData,
  SystemType,
  SystemModule,
  DataElement,
  DataObjectAttribute,
  TechnicalProperty,
  OutputArtifact,
  DiagramMeta,
} from './types'


// ─── Undo History ───────────────────────────────────────
interface DiagramSnapshot {
  nodes: SystemNode[]
  edges: DataFlowEdge[]
  groups: SystemGroupNode[]
  artifacts: OutputArtifact[]
}
const MAX_UNDO = 20

// ─── Store Interface ────────────────────────────────────
interface DiagramState {
  // Diagram metadata
  meta: DiagramMeta
  // React Flow state
  nodes: SystemNode[]
  edges: DataFlowEdge[]
  groups: SystemGroupNode[]
  // UI state
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId: string | null
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
  // Module actions (sub-components within a system)
  addModule: (nodeId: string, module: Omit<SystemModule, 'id'>) => void
  removeModule: (nodeId: string, moduleId: string) => void
  updateModule: (nodeId: string, moduleId: string, updates: Partial<SystemModule>) => void
  reorderModules: (nodeId: string, fromIndex: number, toIndex: number) => void
  // System group actions
  addGroup: (label: string, position: XYPosition, color?: string, width?: number, height?: number) => string
  updateGroupLabel: (nodeId: string, label: string) => void
  updateGroupColor: (nodeId: string, color: string) => void
  // Edge endpoint editing (sidebar dropdowns)
  updateEdgeEndpoint: (edgeId: string, endpoint: 'source' | 'target', newNodeId: string) => void
  // Reverse edge direction (swap source and target)
  reverseEdge: (edgeId: string) => void
  // Edge label position (0–1 along path)
  updateEdgeLabelPosition: (edgeId: string, position: number) => void
  // Edge sequence per artifact
  updateEdgeArtifactSequence: (edgeId: string, artifactId: string, sequence: number | undefined) => void
  // System node copy/paste
  copiedNodeData: { data: SystemNode['data']; connectedEdges: DataFlowEdge[] } | null
  copyNode: (nodeId: string) => void
  pasteNode: () => void
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
  setSelectedGroup: (id: string | null) => void
  setSidebarTab: (tab: 'palette' | 'properties' | 'elements' | 'notes') => void
  // Auto layout
  autoLayout: () => void
  // Diagram meta
  setTitle: (title: string) => void
  setProcessContext: (context: string) => void
  setNotes: (notes: string) => void
  // Undo
  undoStack: DiagramSnapshot[]
  pushUndo: () => void
  undo: () => void
  canUndo: boolean
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
  groups: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedGroupId: null,
  sidebarTab: 'palette',
  artifacts: [],
  spotlightNodeId: null,
  spotlightEdgeIds: new Set<string>(),
  spotlightNodeIds: new Set<string>(),
  spotlightArtifactId: null,
  copiedNodeData: null,
  copiedEdgeData: null,
  undoStack: [],
  canUndo: false,
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
    get().pushUndo()
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
    get().pushUndo()
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

  // ─── Edge Sequence per Artifact ────────────────────────
  updateEdgeArtifactSequence: (edgeId, artifactId, sequence) => {
    set({
      edges: get().edges.map((e) => {
        if (e.id !== edgeId || !e.data) return e
        const seqs = { ...(e.data.artifactSequences ?? {}) }
        if (sequence != null && sequence > 0) {
          seqs[artifactId] = sequence
        } else {
          delete seqs[artifactId]
        }
        return { ...e, data: { ...e.data, artifactSequences: Object.keys(seqs).length > 0 ? seqs : undefined } }
      }),
    })
  },

  // ─── Edge Endpoint Editing (sidebar) ──────────────────
  updateEdgeEndpoint: (edgeId, endpoint, newNodeId) => {
    get().pushUndo()
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

  reverseEdge: (edgeId) => {
    get().pushUndo()
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId
          ? {
              ...e,
              source: e.target,
              target: e.source,
              sourceHandle: e.targetHandle?.replace('-t', '-s') ?? null,
              targetHandle: e.sourceHandle?.replace('-s', '-t') ?? null,
            }
          : e
      ),
    })
  },

  // ─── Edge Data Copy/Paste ─────────────────────────────
  // ─── System Node Copy/Paste ────────────────────────────
  copyNode: (nodeId) => {
    const { nodes, edges } = get()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    // Deep clone node data and connected edges
    const clone = typeof structuredClone === 'function' ? structuredClone : (v: any) => JSON.parse(JSON.stringify(v))
    const connectedEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId)
    set({ copiedNodeData: { data: clone(node.data), connectedEdges: clone(connectedEdges) } })
  },

  pasteNode: () => {
    const { copiedNodeData, nodes, edges } = get()
    if (!copiedNodeData) return
    get().pushUndo()

    // Create new node with offset position from the original or center of canvas
    const newId = `system-${uuid()}`
    // Find a position — offset from the last selected node or use a default
    const selectedId = get().selectedNodeId
    const refNode = selectedId ? nodes.find((n) => n.id === selectedId) : nodes[nodes.length - 1]
    const pos = refNode
      ? { x: refNode.position.x + 60, y: refNode.position.y + 60 }
      : { x: 200, y: 200 }

    const newNode: SystemNode = {
      id: newId,
      type: 'system',
      position: pos,
      data: {
        ...copiedNodeData.data,
        label: copiedNodeData.data.label + ' (copy)',
        // Give modules fresh IDs
        modules: copiedNodeData.data.modules?.map((m) => ({ ...m, id: uuid() })),
      },
    }

    set({
      nodes: [...nodes, newNode],
      selectedNodeId: newId,
      selectedEdgeId: null,
      selectedGroupId: null,
    })
  },

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
    get().pushUndo()
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
    get().pushUndo()
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
    get().pushUndo()
    const { selectedNodeId, selectedEdgeId, selectedGroupId, nodes, edges, groups } = get()

    // Check for multi-selection (box select / shift-click)
    const selectedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id))
    const selectedGroupIds = new Set(groups.filter((g) => g.selected).map((g) => g.id))
    const selectedEdgeIds = new Set(edges.filter((e) => e.selected).map((e) => e.id))

    if (selectedNodeIds.size > 0 || selectedGroupIds.size > 0 || selectedEdgeIds.size > 0) {
      const remainingNodes = nodes.filter((n) => !selectedNodeIds.has(n.id))
      const remainingGroups = groups.filter((g) => !selectedGroupIds.has(g.id))
      const remainingEndpoints = new Set([
        ...remainingNodes.map((n) => n.id),
        ...remainingGroups.map((g) => g.id),
      ])
      set({
        nodes: remainingNodes,
        edges: edges.filter(
          (e) => !selectedEdgeIds.has(e.id) && remainingEndpoints.has(e.source) && remainingEndpoints.has(e.target)
        ),
        groups: remainingGroups,
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedGroupId: null,
      })
    } else if (selectedGroupId) {
      set({
        groups: groups.filter((g) => g.id !== selectedGroupId),
        edges: edges.filter(
          (e) => e.source !== selectedGroupId && e.target !== selectedGroupId
        ),
        selectedGroupId: null,
      })
    } else if (selectedNodeId) {
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

  // ─── Module Actions ───────────────────────────────────
  addModule: (nodeId, module) => {
    get().pushUndo()
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId && n.type === 'system'
          ? { ...n, data: { ...n.data, modules: [...((n.data as any).modules || []), { ...module, id: uuid() }] } }
          : n
      ),
    })
  },

  removeModule: (nodeId, moduleId) => {
    get().pushUndo()
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId && n.type === 'system'
          ? { ...n, data: { ...n.data, modules: ((n.data as any).modules || []).filter((m: any) => m.id !== moduleId) } }
          : n
      ),
    })
  },

  updateModule: (nodeId, moduleId, updates) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId && n.type === 'system'
          ? { ...n, data: { ...n.data, modules: ((n.data as any).modules || []).map((m: any) => m.id === moduleId ? { ...m, ...updates } : m) } }
          : n
      ),
    })
  },

  reorderModules: (nodeId, fromIndex, toIndex) => {
    set({
      nodes: get().nodes.map((n) => {
        if (n.id !== nodeId || n.type !== 'system') return n
        const modules = [...((n.data as any).modules || [])]
        const [moved] = modules.splice(fromIndex, 1)
        modules.splice(toIndex, 0, moved)
        return { ...n, data: { ...n.data, modules } }
      }),
    })
  },

  // ─── System Group Actions ────────────────────────────
  addGroup: (label, position, color, width, height) => {
    get().pushUndo()
    const id = `group-${uuid()}`
    const newGroup: SystemGroupNode = {
      id,
      type: 'systemGroup',
      position,
      zIndex: -1,
      style: { width: width ?? 500, height: height ?? 400, pointerEvents: 'none' as const },
      focusable: false,
      data: { label, color: color || '#374A5E' },
    }
    set({ groups: [...get().groups, newGroup] })
    return id
  },

  updateGroupLabel: (nodeId, label) => {
    set({
      groups: get().groups.map((g) =>
        g.id === nodeId ? { ...g, data: { ...g.data, label } } : g
      ),
    })
  },

  updateGroupColor: (nodeId, color) => {
    set({
      groups: get().groups.map((g) =>
        g.id === nodeId ? { ...g, data: { ...g.data, color } } : g
      ),
    })
  },

  // ─── Data Element Actions ─────────────────────────────
  addDataElement: (edgeId, element) => {
    get().pushUndo()
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
    get().pushUndo()
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
    get().pushUndo()
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
    get().pushUndo()
    set({ artifacts: [...get().artifacts, { ...artifact, id: uuid() }] })
  },

  removeArtifact: (artifactId) => {
    get().pushUndo()
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
    const { pendingConnectionSource, nodes, groups, pushUndo } = get()
    if (!pendingConnectionSource) {
      set({ pendingConnectionSource: nodeId })
      return
    }
    if (pendingConnectionSource === nodeId) {
      set({ pendingConnectionSource: null })
      return
    }
    // Search both system nodes and groups for source/target
    const allNodes = [...nodes, ...groups]
    const sourceNode = allNodes.find((n) => n.id === pendingConnectionSource)
    const targetNode = allNodes.find((n) => n.id === nodeId)
    if (!sourceNode || !targetNode) {
      set({ pendingConnectionSource: null })
      return
    }
    const dx = targetNode.position.x - sourceNode.position.x
    const dy = targetNode.position.y - sourceNode.position.y
    const srcIsGroup = sourceNode.type === 'systemGroup'
    const tgtIsGroup = targetNode.type === 'systemGroup'
    let sourceHandle: string
    let targetHandle: string
    if (Math.abs(dx) > Math.abs(dy)) {
      sourceHandle = dx > 0
        ? (srcIsGroup ? 'grp-right-s' : 'right-s2')
        : (srcIsGroup ? 'grp-left-s' : 'left-s2')
      targetHandle = dx > 0
        ? (tgtIsGroup ? 'grp-left-t' : 'left-t1')
        : (tgtIsGroup ? 'grp-right-t' : 'right-t1')
    } else {
      sourceHandle = dy > 0
        ? (srcIsGroup ? 'grp-bot-s' : 'bot-s2')
        : (srcIsGroup ? 'grp-top-s' : 'top-s2')
      targetHandle = dy > 0
        ? (tgtIsGroup ? 'grp-top-t' : 'top-t1')
        : (tgtIsGroup ? 'grp-bot-t' : 'bot-t1')
    }
    pushUndo()
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
      set({ selectedNodeId: id, selectedEdgeId: null, selectedGroupId: null, spotlightNodeId: id, spotlightEdgeIds, spotlightNodeIds, spotlightArtifactId: null })
    } else {
      set({ selectedNodeId: null, selectedEdgeId: null, selectedGroupId: null, spotlightNodeId: null, spotlightEdgeIds: new Set(), spotlightNodeIds: new Set(), spotlightArtifactId: null })
    }
  },
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null, selectedGroupId: null, spotlightNodeId: null, spotlightEdgeIds: new Set(), spotlightNodeIds: new Set(), spotlightArtifactId: null }),
  setSelectedGroup: (id) => set({ selectedGroupId: id, selectedNodeId: null, selectedEdgeId: null, spotlightNodeId: null, spotlightEdgeIds: new Set(), spotlightNodeIds: new Set(), spotlightArtifactId: null }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  // ─── Auto Layout ──────────────────────────────────────
  autoLayout: () => {
    const { nodes, edges } = get()
    if (nodes.length === 0) return
    get().pushUndo()

    const NODE_W = 240
    const NODE_H = 100
    const H_GAP = 280  // horizontal gap between layers
    const V_GAP = 160  // vertical gap between nodes in same layer

    // ── 1. Build directed adjacency (source → targets) ──
    const outEdges = new Map<string, string[]>()
    const inEdges = new Map<string, string[]>()
    const nodeIds = new Set(nodes.map((n) => n.id))
    for (const n of nodes) {
      outEdges.set(n.id, [])
      inEdges.set(n.id, [])
    }
    for (const e of edges) {
      if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
        outEdges.get(e.source)!.push(e.target)
        inEdges.get(e.target)!.push(e.source)
      }
    }

    // ── 2. Topological layering (longest-path from sources) ──
    // Sources = nodes with no incoming edges from other nodes
    const layer = new Map<string, number>()
    const queue: string[] = []

    for (const n of nodes) {
      if (inEdges.get(n.id)!.length === 0) {
        layer.set(n.id, 0)
        queue.push(n.id)
      }
    }

    // If no sources found (all in cycles), pick most-connected as layer 0
    if (queue.length === 0) {
      const sorted = [...nodes].sort((a, b) => {
        const aConns = (outEdges.get(a.id)?.length ?? 0) + (inEdges.get(a.id)?.length ?? 0)
        const bConns = (outEdges.get(b.id)?.length ?? 0) + (inEdges.get(b.id)?.length ?? 0)
        return bConns - aConns
      })
      layer.set(sorted[0].id, 0)
      queue.push(sorted[0].id)
    }

    // BFS to assign layers (longest path from any source)
    let head = 0
    while (head < queue.length) {
      const nid = queue[head++]
      const myLayer = layer.get(nid)!
      for (const tgt of outEdges.get(nid) ?? []) {
        const prevLayer = layer.get(tgt)
        if (prevLayer === undefined || prevLayer < myLayer + 1) {
          layer.set(tgt, myLayer + 1)
          queue.push(tgt)
        }
      }
    }

    // Assign unvisited nodes (disconnected) to layer 0
    for (const n of nodes) {
      if (!layer.has(n.id)) layer.set(n.id, 0)
    }

    // ── 3. Group by layer, sort within layer by systemType then connections ──
    const TYPE_PRIORITY: Record<string, number> = {
      erp: 0, middleware: 1, database: 2, data_warehouse: 3,
      crm: 4, plm: 5, scm: 6, analytics: 7, mes: 8,
      cloud: 9, legacy: 10, custom: 11,
    }
    const layers = new Map<number, string[]>()
    for (const [nid, l] of layer) {
      if (!layers.has(l)) layers.set(l, [])
      layers.get(l)!.push(nid)
    }
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    for (const [, nids] of layers) {
      nids.sort((a, b) => {
        const na = nodeMap.get(a)!
        const nb = nodeMap.get(b)!
        const pa = TYPE_PRIORITY[na.data.systemType] ?? 50
        const pb = TYPE_PRIORITY[nb.data.systemType] ?? 50
        if (pa !== pb) return pa - pb
        // Secondary: more connections first
        const ca = (outEdges.get(a)?.length ?? 0) + (inEdges.get(a)?.length ?? 0)
        const cb = (outEdges.get(b)?.length ?? 0) + (inEdges.get(b)?.length ?? 0)
        return cb - ca
      })
    }

    // ── 4. Position: layers left-to-right, nodes top-to-bottom ──
    const positioned = new Map<string, { x: number; y: number }>()
    const sortedLayers = [...layers.entries()].sort((a, b) => a[0] - b[0])

    // Measure the tallest layer for vertical centering
    const maxLayerSize = Math.max(...sortedLayers.map(([, nids]) => nids.length))

    for (const [l, nids] of sortedLayers) {
      const x = l * (NODE_W + H_GAP)
      const totalH = nids.length * NODE_H + (nids.length - 1) * V_GAP
      const maxTotalH = maxLayerSize * NODE_H + (maxLayerSize - 1) * V_GAP
      const yOffset = (maxTotalH - totalH) / 2

      for (let i = 0; i < nids.length; i++) {
        positioned.set(nids[i], {
          x,
          y: yOffset + i * (NODE_H + V_GAP),
        })
      }
    }

    // ── 5. Apply positions and fix edge handles ──
    const updatedNodes = nodes.map((n) => {
      const pos = positioned.get(n.id)
      return pos ? { ...n, position: pos } : n
    })

    const updNodeMap = new Map(updatedNodes.map((n) => [n.id, n]))
    const updatedEdges = edges.map((e) => {
      const src = updNodeMap.get(e.source)
      const tgt = updNodeMap.get(e.target)
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

  // ─── Undo ─────────────────────────────────────────────
  pushUndo: () => {
    const { nodes, edges, groups, artifacts, undoStack } = get()
    const clone = typeof structuredClone === 'function' ? structuredClone : (v: any) => JSON.parse(JSON.stringify(v))
    const snapshot: DiagramSnapshot = {
      nodes: clone(nodes),
      edges: clone(edges),
      groups: clone(groups),
      artifacts: clone(artifacts),
    }
    const newStack = [...undoStack, snapshot].slice(-MAX_UNDO)
    set({ undoStack: newStack, canUndo: true })
  },

  undo: () => {
    const { undoStack } = get()
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    const newStack = undoStack.slice(0, -1)
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      groups: prev.groups,
      artifacts: prev.artifacts,
      undoStack: newStack,
      canUndo: newStack.length > 0,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedGroupId: null,
    })
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
    const { meta, nodes, edges, artifacts, groups } = get()
    const canvasData = { nodes, edges, notes: meta.notes, artifacts, groups }
    // Local backup in case remote save fails silently
    try {
      localStorage.setItem(`m12-backup-${meta.id}`, JSON.stringify({
        meta, canvasData, savedAt: new Date().toISOString(),
      }))
    } catch { /* quota exceeded — ignore */ }
    await saveDiagramApi(meta.id, userId, {
      title: meta.title,
      description: meta.description,
      process_context: meta.processContext,
      canvas_data: canvasData,
    })
    set({ meta: { ...meta, updatedAt: new Date().toISOString() } })
  },

  loadDiagram: async (id: string) => {
    const row = await getDiagram(id)
    if (!row) return false
    const canvas = row.canvas_data as { nodes: SystemNode[]; edges: DataFlowEdge[]; notes?: string; artifacts?: OutputArtifact[]; groups?: SystemGroupNode[] }
    const nodes = canvas.nodes ?? []
    let edges = canvas.edges ?? []

    const groups = canvas.groups ?? []

    // Repair edges with invalid handle IDs (e.g. 'right-src', 'left-tgt')
    const validHandles = new Set([
      'top-s1','top-t1','top-s2','top-t2','top-s3','top-t3',
      'bot-s1','bot-t1','bot-s2','bot-t2','bot-s3','bot-t3',
      'left-s1','left-t1','left-s2','left-t2','left-s3',
      'right-s1','right-t1','right-s2','right-t2','right-s3',
      'grp-top-s','grp-top-t','grp-bot-s','grp-bot-t',
      'grp-left-s','grp-left-t','grp-right-s','grp-right-t',
    ])
    const allNodesForMap = [...nodes as any[], ...groups]
    const nodeMap = new Map(allNodesForMap.map((n: any) => [n.id, n]))
    edges = edges.map((e) => {
      const srcNode = nodeMap.get(e.source)
      const tgtNode = nodeMap.get(e.target)
      const needsFix =
        (e.sourceHandle && !validHandles.has(e.sourceHandle)) ||
        (e.targetHandle && !validHandles.has(e.targetHandle))
      if (!needsFix || !srcNode || !tgtNode) return e
      const dx = tgtNode.position.x - srcNode.position.x
      const dy = tgtNode.position.y - srcNode.position.y
      const srcIsGroup = srcNode.type === 'systemGroup'
      const tgtIsGroup = tgtNode.type === 'systemGroup'
      let sourceHandle: string
      let targetHandle: string
      if (Math.abs(dx) > Math.abs(dy)) {
        sourceHandle = dx > 0 ? (srcIsGroup ? 'grp-right-s' : 'right-s2') : (srcIsGroup ? 'grp-left-s' : 'left-s2')
        targetHandle = dx > 0 ? (tgtIsGroup ? 'grp-left-t' : 'left-t1') : (tgtIsGroup ? 'grp-right-t' : 'right-t1')
      } else {
        sourceHandle = dy > 0 ? (srcIsGroup ? 'grp-bot-s' : 'bot-s2') : (srcIsGroup ? 'grp-top-s' : 'top-s2')
        targetHandle = dy > 0 ? (tgtIsGroup ? 'grp-top-t' : 'top-t1') : (tgtIsGroup ? 'grp-bot-t' : 'bot-t1')
      }
      return { ...e, sourceHandle, targetHandle }
    })

    // Remove orphaned edges (source or target node no longer exists)
    const allNodeIds = new Set(allNodesForMap.map((n: any) => n.id))
    edges = edges.filter((e) => allNodeIds.has(e.source) && allNodeIds.has(e.target))

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
      groups,
      artifacts: canvas.artifacts ?? [],
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedGroupId: null,
    })
    return true
  },

  setMeta: (meta) => set({ meta }),
}))
