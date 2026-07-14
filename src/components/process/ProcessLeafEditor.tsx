'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  reconnectEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { v4 as uuid } from 'uuid'
import { LayoutGrid, Sparkles, Trash2, Undo2, X } from 'lucide-react'

import { Button } from '@/components/common'
import { useProcessStore } from '@/lib/process/store'
import * as api from '@/lib/supabase/process-models'
import type {
  ProcessGraph, ProcessLane, ProcessElementData, BpmnElementType, SequenceFlowKind,
} from '@/lib/process/types'
import { BPMN_PALETTE, SAP_MODULES } from '@/lib/process/types'
import FioriTilePicker from './FioriTilePicker'
import ProcessElementNode from './nodes/ProcessElementNode'
import LaneNode from './nodes/LaneNode'
import SequenceFlowEdge, { SequenceFlowMarkerDefs } from './edges/SequenceFlowEdge'
import { anchorHandles } from './edges/floating'
import ProcessPalette from './ProcessPalette'
import CrossingMarkers from './CrossingMarkers'
import { autoLayoutProcess } from '@/lib/process/autoLayout'

const LANE_H = 150
const LANE_W = 2400
const LANE_COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#6366F1']

const nodeTypes = { processElement: ProcessElementNode, processLane: LaneNode }
const edgeTypes = { sequenceFlow: SequenceFlowEdge }

const LANE_STYLE = `
.react-flow__node-processLane { pointer-events: none !important; }
.react-flow__node-processLane [data-lane-gutter] { pointer-events: auto !important; }
/* Full-node connection drop target: inert until a connection is in progress,
   then active so an arrow can be dropped onto any portion of a task. */
.pm-cover { pointer-events: none !important; }
.pm-flow.pm-connecting .pm-cover { pointer-events: all !important; }
`

const paletteLabel = (t: BpmnElementType) => BPMN_PALETTE.find(p => p.type === t)?.label || 'Task'

// ─── graph_data <-> xyflow nodes ───────────────────────
function laneToNode(lane: ProcessLane, systemLabel: string | null): Node {
  return {
    id: `lane-${lane.id}`,
    type: 'processLane',
    position: { x: 0, y: lane.order * LANE_H },
    data: {
      label: lane.label,
      laneColor: lane.color || LANE_COLORS[lane.order % LANE_COLORS.length],
      systemId: lane.systemId ?? null,
      personaId: lane.personaId ?? null,
      roleId: lane.roleId ?? null,
      systemLabel,
      order: lane.order,
    },
    draggable: false,
    selectable: true,
    deletable: false,
    width: LANE_W,
    height: LANE_H,
    zIndex: 0,
  }
}

function buildInitialNodes(graph: ProcessGraph | null | undefined, systemName: (id?: string | null) => string | null): Node[] {
  const lanes = graph?.lanes?.length ? graph.lanes : [{ id: uuid(), label: 'Lane 1', order: 0 } as ProcessLane]
  const laneNodes = lanes.map(l => laneToNode(l, systemName(l.systemId)))
  const elementNodes = (graph?.nodes || []) as Node[]
  // Seed a start event for a brand-new graph
  if (!graph?.nodes?.length) {
    elementNodes.push({
      id: uuid(),
      type: 'processElement',
      position: { x: 90, y: 50 },
      data: { label: 'Start', elementType: 'startEvent', laneId: lanes[0].id } as ProcessElementData,
    })
  }
  return [...laneNodes, ...elementNodes]
}

function extractGraph(nodes: Node[], edges: Edge[], viewport?: { x: number; y: number; zoom: number }): ProcessGraph {
  const laneNodes = nodes.filter(n => n.type === 'processLane').sort((a, b) => a.position.y - b.position.y)
  const lanes: ProcessLane[] = laneNodes.map((n, i) => ({
    id: n.id.replace(/^lane-/, ''),
    label: (n.data as any).label,
    systemId: (n.data as any).systemId ?? null,
    personaId: (n.data as any).personaId ?? null,
    roleId: (n.data as any).roleId ?? null,
    order: i,
    color: (n.data as any).laneColor,
  }))
  const elementNodes = nodes
    .filter(n => n.type === 'processElement')
    .map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })) as any
  return { lanes, nodes: elementNodes, edges: edges as any, viewport }
}

// Resolve which lane band a y-coordinate falls in, using the lanes' ACTUAL
// positions/heights (they can vary after auto-layout), not a fixed band size.
function laneBareIdForY(laneNodes: Node[], centerY: number): string | undefined {
  const sorted = [...laneNodes].sort((a, b) => a.position.y - b.position.y)
  for (const ln of sorted) {
    const top = ln.position.y
    const h = (ln.height ?? (ln.style?.height as number) ?? LANE_H)
    if (centerY >= top && centerY < top + h) return ln.id.replace(/^lane-/, '')
  }
  // above first / below last → clamp to nearest
  if (sorted.length && centerY < sorted[0].position.y) return sorted[0].id.replace(/^lane-/, '')
  const last = sorted[sorted.length - 1]
  return last ? last.id.replace(/^lane-/, '') : undefined
}

// ─── Editor inner (inside provider) ────────────────────
function EditorInner({ nodeId, readOnly }: { nodeId: string; readOnly: boolean }) {
  const node = useProcessStore(s => s.nodes.find(n => n.id === nodeId))
  const logicalSystems = useProcessStore(s => s.logicalSystems)
  const personas = useProcessStore(s => s.personas)
  const roles = useProcessStore(s => s.roles)
  const saveLeafGraph = useProcessStore(s => s.saveLeafGraph)

  const systemName = useCallback(
    (id?: string | null) => (id ? logicalSystems.find(s => s.id === id)?.name ?? null : null),
    [logicalSystems]
  )

  const { screenToFlowPosition, getViewport, fitView, getInternalNode } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selection, setSelection] = useState<{ type: 'node' | 'edge' | 'lane'; id: string } | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [connecting, setConnecting] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiDots, setAiDots] = useState('')

  // Animate the "Drafting…" ellipsis while the model works.
  useEffect(() => {
    if (!aiBusy) { setAiDots(''); return }
    const id = setInterval(() => setAiDots(d => (d.length >= 3 ? '' : d + '.')), 400)
    return () => clearInterval(id)
  }, [aiBusy])

  const loadedForRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>('')
  const dirtyRef = useRef(false)

  // Always-current snapshot for debounced/unmount save closures (avoids stale state)
  const graphRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })
  graphRef.current = { nodes, edges }

  // ─── Undo history (up to 20 actions) ──────────────────
  const UNDO_LIMIT = 20
  const undoStackRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([])
  const [undoDepth, setUndoDepth] = useState(0)
  const lastSnapRef = useRef(0)
  const cloneGraph = (g: { nodes: Node[]; edges: Edge[] }) => ({
    nodes: g.nodes.map(n => ({ ...n, position: { ...n.position }, data: { ...(n.data as object) }, style: n.style ? { ...n.style } : undefined })),
    edges: g.edges.map(e => ({ ...e, data: e.data ? { ...e.data } : undefined })),
  })
  // Snapshot the current graph before a mutating action. Rapid multi-change
  // actions (e.g. deleting a node + its edges) are coalesced into one step.
  const takeSnapshot = useCallback(() => {
    if (readOnly) return
    const now = Date.now()
    if (now - lastSnapRef.current < 60) return
    lastSnapRef.current = now
    const stack = undoStackRef.current
    stack.push(cloneGraph(graphRef.current))
    if (stack.length > UNDO_LIMIT) stack.shift()
    setUndoDepth(stack.length)
  }, [readOnly])
  const undo = useCallback(() => {
    const stack = undoStackRef.current
    const snap = stack.pop()
    if (!snap) return
    setNodes(snap.nodes)
    setEdges(snap.edges)
    setUndoDepth(stack.length)
  }, [setNodes, setEdges])

  // Snapshot before removals (keyboard delete, the edge × button, deleteElements).
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (changes.some(c => c.type === 'remove')) takeSnapshot()
    onNodesChange(changes)
  }, [onNodesChange, takeSnapshot])
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some(c => c.type === 'remove')) takeSnapshot()
    onEdgesChange(changes)
  }, [onEdgesChange, takeSnapshot])
  const onNodeDragStart = useCallback(() => takeSnapshot(), [takeSnapshot])

  // Ctrl/Cmd+Z → undo (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (readOnly) return
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        const t = e.target as HTMLElement | null
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, readOnly])

  // Load the leaf graph once per node. Strip any stored handle bindings so
  // connectors render purely as floating edges (attach to the perimeter),
  // regardless of which handle id an older connection recorded.
  useEffect(() => {
    if (!node || loadedForRef.current === nodeId) return
    loadedForRef.current = nodeId
    const init = buildInitialNodes(node.graph_data, systemName)
    const loadedEdges = ((node.graph_data?.edges || []) as Edge[]).map(e => ({ ...e, sourceHandle: undefined, targetHandle: undefined }))
    setNodes(init)
    setEdges(loadedEdges)
    lastSavedRef.current = JSON.stringify(extractGraph(init, loadedEdges))
    dirtyRef.current = false
    setSaveStatus('saved')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, nodeId])

  // Reconcile normalized lane→system rows so Phase 3 scaffold can read them
  const syncLanes = useCallback(async (graph: ProcessGraph) => {
    try {
      const existing = await api.listProcessNodeLanes(nodeId)
      const keep = new Set(graph.lanes.map(l => l.id))
      await Promise.all(existing.filter(e => !keep.has(e.lane_key)).map(e => api.deleteProcessNodeLane(e.id)))
      await Promise.all(graph.lanes.map(l =>
        api.upsertProcessNodeLane(nodeId, l.id, {
          logical_system_id: l.systemId ?? null,
          persona_id: l.personaId ?? null,
          role_id: l.roleId ?? null,
          label: l.label,
          sort_order: l.order,
        })
      ))
    } catch (e) {
      console.error('lane sync failed', e)
    }
  }, [nodeId])

  // Debounced autosave to graph_data
  const scheduleSave = useCallback(() => {
    if (readOnly) return
    dirtyRef.current = true
    setSaveStatus('unsaved')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const graph = extractGraph(
        graphRef.current.nodes,
        graphRef.current.edges,
        getViewport(),
      )
      const fp = JSON.stringify({ lanes: graph.lanes, nodes: graph.nodes, edges: graph.edges })
      if (fp === lastSavedRef.current) { dirtyRef.current = false; setSaveStatus('saved'); return }
      setSaveStatus('saving')
      try {
        await saveLeafGraph(nodeId, graph)
        await syncLanes(graph)
        lastSavedRef.current = fp
        dirtyRef.current = false
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
      }
    }, 1500)
  }, [readOnly, getViewport, saveLeafGraph, nodeId, syncLanes])

  // Trigger save whenever the graph changes (after initial load)
  useEffect(() => {
    if (loadedForRef.current !== nodeId) return
    scheduleSave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  // Flush on unmount
  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (dirtyRef.current && !readOnly) {
      const graph = extractGraph(graphRef.current.nodes, graphRef.current.edges, getViewport())
      saveLeafGraph(nodeId, graph).then(() => syncLanes(graph)).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Interactions ─────────────────────────────────────
  const onConnect = useCallback((c: Connection) => {
    if (readOnly) return
    takeSnapshot()
    setEdges(eds => addEdge({ ...c, type: 'sequenceFlow', data: { kind: 'sequence' as SequenceFlowKind } }, eds))
  }, [readOnly, setEdges, takeSnapshot])

  // Reconnect (drag an arrow endpoint onto another task). Dropping on empty
  // canvas removes the connector. Reconnecting preserves the flow's data.
  const reconnectOkRef = useRef(true)
  const onReconnectStart = useCallback(() => { reconnectOkRef.current = false; setConnecting(true) }, [])
  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    if (readOnly) return
    reconnectOkRef.current = true
    takeSnapshot()
    setEdges(eds => reconnectEdge(oldEdge, newConnection, eds))
  }, [readOnly, setEdges, takeSnapshot])
  const onReconnectEnd = useCallback((_: unknown, edge: Edge) => {
    if (!reconnectOkRef.current && !readOnly) { takeSnapshot(); setEdges(eds => eds.filter(e => e.id !== edge.id)) }
    reconnectOkRef.current = true
    setConnecting(false)
  }, [readOnly, setEdges, takeSnapshot])

  // Connection in progress → enable the full-node drop target so an arrow can
  // be dropped onto any portion of a task (matches the data-architecture editor).
  const onConnectStart = useCallback(() => setConnecting(true), [])
  const onConnectEnd = useCallback(() => setConnecting(false), [])

  // Clean, swimlane-aware auto-layout.
  const handleAutoLayout = useCallback(() => {
    if (readOnly) return
    takeSnapshot()
    setNodes(nds => autoLayoutProcess(nds, graphRef.current.edges))
    setTimeout(() => fitView({ padding: 0.18, duration: 450 }), 60)
  }, [readOnly, setNodes, fitView, takeSnapshot])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (readOnly) return
    const type = e.dataTransfer.getData('application/bpmn-element') as BpmnElementType
    if (!type) return
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const laneNodes = nodes.filter(n => n.type === 'processLane')
    const laneId = laneBareIdForY(laneNodes, pos.y)
    takeSnapshot()
    setNodes(nds => nds.concat({
      id: uuid(),
      type: 'processElement',
      position: pos,
      data: { label: paletteLabel(type), elementType: type, laneId } as ProcessElementData,
      selected: true,
    }))
  }, [readOnly, screenToFlowPosition, nodes, setNodes, takeSnapshot])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  // Reassign laneId when an element is dropped into a different band (using the
  // lanes' real positions/heights, which vary after auto-layout).
  const onNodeDragStop = useCallback((_: unknown, dragged: Node) => {
    if (dragged.type !== 'processElement') return
    const laneNodes = nodes.filter(n => n.type === 'processLane')
    const centerY = dragged.position.y + (dragged.height ?? 64) / 2
    const laneId = laneBareIdForY(laneNodes, centerY)
    if (!laneId) return
    setNodes(nds => nds.map(n => n.id === dragged.id ? { ...n, data: { ...n.data, laneId } } : n))
  }, [nodes, setNodes])

  const onSelectionChange = useCallback((p: OnSelectionChangeParams) => {
    if (p.nodes.length) {
      const n = p.nodes[0]
      setSelection({ type: n.type === 'processLane' ? 'lane' : 'node', id: n.id })
    } else if (p.edges.length) {
      setSelection({ type: 'edge', id: p.edges[0].id })
    } else {
      setSelection(null)
    }
  }, [])

  const addLane = useCallback(() => {
    if (readOnly) return
    const lanes = nodes.filter(n => n.type === 'processLane')
    const order = lanes.length
    const id = uuid()
    takeSnapshot()
    setNodes(nds => nds.concat(laneToNode({ id, label: `Lane ${order + 1}`, order }, null)))
  }, [readOnly, nodes, setNodes, takeSnapshot])

  // ─── AI: draft BPMN flow from text ────────────────────
  const loadAiGraph = useCallback((data: {
    lanes?: { id?: string; label?: string; order?: number }[]
    nodes?: { id?: string; elementType?: string; label?: string; laneId?: string; x?: number; y?: number }[]
    edges?: { id?: string; source?: string; target?: string; kind?: string; label?: string }[]
  }) => {
    const lanes = (data.lanes || []).map((l, i) => ({
      id: String(l.id || `lane${i}`),
      label: l.label || `Lane ${i + 1}`,
      order: typeof l.order === 'number' ? l.order : i,
    }))
    const laneNodes = lanes.map(l => laneToNode(l, null))
    const laneIds = new Set(lanes.map(l => l.id))
    const elementNodes: Node[] = (data.nodes || []).map((n, i) => ({
      id: String(n.id || uuid()),
      type: 'processElement',
      position: { x: Number.isFinite(n.x) ? Number(n.x) : 90 + i * 60, y: Number.isFinite(n.y) ? Number(n.y) : 50 },
      data: {
        label: n.label || 'Step',
        elementType: (n.elementType || 'task') as ProcessElementData['elementType'],
        laneId: n.laneId && laneIds.has(String(n.laneId)) ? String(n.laneId) : lanes[0]?.id,
      } as ProcessElementData,
    }))
    const elemIds = new Set(elementNodes.map(n => n.id))
    const aiEdges: Edge[] = (data.edges || [])
      .filter(e => e.source && e.target && elemIds.has(String(e.source)) && elemIds.has(String(e.target)))
      .map((e, i) => ({
        id: String(e.id || `e${i}`),
        source: String(e.source),
        target: String(e.target),
        type: 'sequenceFlow',
        data: { kind: (e.kind || 'sequence') as SequenceFlowKind, ...(e.label ? { label: e.label } : {}) },
      }))
    takeSnapshot()
    setNodes([...laneNodes, ...elementNodes])
    setEdges(aiEdges)
  }, [setNodes, setEdges, takeSnapshot])

  const handleAiDraft = useCallback(async () => {
    if (!aiPrompt.trim() || aiBusy) return
    const hasContent = nodes.some(n => n.type === 'processElement')
    if (hasContent && !confirm('Replace the current flow with the AI draft?')) return
    setAiBusy(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bpmn-from-text', prompt: aiPrompt, context: { processName: node?.name, systems: logicalSystems.map(s => s.name) } }),
      })
      const data = await res.json()
      if (!res.ok || !data.nodes) throw new Error(data.error || 'Draft failed')
      loadAiGraph(data)
      setAiOpen(false); setAiPrompt('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Draft failed')
    } finally {
      setAiBusy(false)
    }
  }, [aiPrompt, aiBusy, nodes, node?.name, logicalSystems, loadAiGraph])

  // Inspector mutators
  const patchNodeData = useCallback((id: string, patch: Record<string, unknown>) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
  }, [setNodes])
  const patchEdgeData = useCallback((id: string, patch: Record<string, unknown>) => {
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...(e.data || {}), ...patch } } : e))
  }, [setEdges])
  const deleteSelected = useCallback(() => {
    if (!selection || readOnly) return
    takeSnapshot()
    if (selection.type === 'edge') setEdges(eds => eds.filter(e => e.id !== selection.id))
    else setNodes(nds => nds.filter(n => n.id !== selection.id))
    setSelection(null)
  }, [selection, readOnly, setEdges, setNodes, takeSnapshot])

  const selectedNode = selection && selection.type !== 'edge' ? nodes.find(n => n.id === selection.id) : null
  const selectedEdge = selection?.type === 'edge' ? edges.find(e => e.id === selection.id) : null

  // Bind each connector to the side handle facing the other task. This keeps
  // endpoints on the box, makes reconnect handles grabbable at the visible
  // arrow ends, and re-snaps the side as tasks move. Recomputes on node moves.
  const displayEdges = useMemo(() => edges.map(e => {
    const s = getInternalNode(e.source)
    const t = getInternalNode(e.target)
    if (!s || !t) return { ...e, reconnectable: true }
    const { sourceHandle, targetHandle } = anchorHandles(s, t)
    return { ...e, sourceHandle, targetHandle, reconnectable: true }
  }), [edges, nodes, getInternalNode])

  return (
    <div className="flex h-full min-h-0">
      {!readOnly && <ProcessPalette onAddLane={addLane} />}

      <div className={`flex-1 relative min-w-0 pm-flow${connecting ? ' pm-connecting' : ''}`}>
        <style dangerouslySetInnerHTML={{ __html: LANE_STYLE }} />
        <SequenceFlowMarkerDefs />

        {/* Top-right controls */}
        {!readOnly && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={undo}
              disabled={undoDepth === 0}
              title={`Undo${undoDepth ? ` (${undoDepth})` : ''}  ·  Ctrl+Z`}
              icon={<Undo2 size={12} />}
              className="shadow-card"
            >
              Undo
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAutoLayout}
              title="Auto Layout - tidy the flow into clean swimlane columns"
              icon={<LayoutGrid size={12} />}
              className="shadow-card"
            >
              Auto Layout
            </Button>
            <Button
              variant="ai"
              size="sm"
              onClick={() => setAiOpen(true)}
              title="Draft this flow from a text description"
              icon={<Sparkles size={12} />}
              className="shadow-card"
            >
              AI Draft
            </Button>
            <div className="flex items-center gap-1.5 h-8 bg-white border border-border shadow-card rounded-lg px-2">
              <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saved' ? 'bg-status-green' : saveStatus === 'saving' ? 'bg-status-yellow animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-[10px] text-text-tertiary font-mono">
                {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
              </span>
            </div>
          </div>
        )}

        {/* AI draft modal */}
        {aiOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40" onClick={() => { if (!aiBusy) setAiOpen(false) }}>
            <div onClick={e => e.stopPropagation()} className="w-[26rem] max-w-[90%] bg-white rounded-xl shadow-card-hover p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-heading-sm font-display text-text-primary">Draft flow from text</h3>
                {!aiBusy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label="Close"
                    onClick={() => setAiOpen(false)}
                    icon={<X size={14} />}
                  />
                )}
              </div>

              {aiBusy ? (
                <div className="py-8 flex flex-col items-center text-center">
                  <div className="relative w-12 h-12 mb-4">
                    <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-500 animate-spin" />
                    <Sparkles size={18} className="absolute inset-0 m-auto text-brand-500 animate-pulse" />
                  </div>
                  <div className="text-body-md font-medium text-text-primary mb-1">Drafting your process flow{aiDots}</div>
                  <div className="text-[11px] text-text-tertiary max-w-[18rem]">
                    Designing swimlanes, tasks, gateways and sequence flows. This usually takes 10-20 seconds.
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    autoFocus
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    rows={4}
                    aria-label="Flow description"
                    placeholder="Describe the process steps, who does each, and the decision points..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-y mb-3"
                  />
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleAiDraft}
                    disabled={!aiPrompt.trim()}
                  >
                    Generate flow
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={displayEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onReconnect={onReconnect}
          onReconnectStart={onReconnectStart}
          onReconnectEnd={onReconnectEnd}
          reconnectRadius={22}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'sequenceFlow', data: { kind: 'sequence' }, reconnectable: true }}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={40}
          connectionLineStyle={{ stroke: '#0EA5E9', strokeWidth: 2, strokeDasharray: '6 3' }}
          deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
          fitView
          minZoom={0.2}
          maxZoom={2.5}
          snapToGrid
          snapGrid={[10, 10]}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          style={{ backgroundColor: 'var(--m12-bg)' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} style={{ color: 'var(--m12-canvas-dot)' } as any} />
          <CrossingMarkers />
          <Controls showInteractive={false} />
          <MiniMap
            nodeStrokeColor="var(--m12-minimap-stroke)"
            nodeColor="var(--m12-minimap-node)"
            maskColor="var(--m12-minimap-mask)"
            style={{ width: 140, height: 90, backgroundColor: 'var(--m12-minimap-bg)', borderColor: 'var(--m12-border)', borderRadius: 8 }}
          />
        </ReactFlow>
      </div>

      {/* Inspector */}
      {!readOnly && selection && (
        <Inspector
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          isLane={selection.type === 'lane'}
          systems={logicalSystems}
          personas={personas}
          roles={roles}
          systemName={systemName}
          onPatchNode={patchNodeData}
          onPatchEdge={patchEdgeData}
          onDelete={deleteSelected}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  )
}

// ─── Inspector panel ───────────────────────────────────
function Inspector({
  selectedNode, selectedEdge, isLane, systems, personas, roles, systemName,
  onPatchNode, onPatchEdge, onDelete, onClose,
}: {
  selectedNode: Node | null | undefined
  selectedEdge: Edge | null | undefined
  isLane: boolean
  systems: { id: string; name: string }[]
  personas: { id: string; name: string }[]
  roles: { id: string; name: string }[]
  systemName: (id?: string | null) => string | null
  onPatchNode: (id: string, patch: Record<string, unknown>) => void
  onPatchEdge: (id: string, patch: Record<string, unknown>) => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <aside className="w-64 shrink-0 border-l border-border bg-white overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-text-tertiary">
          {isLane ? 'Lane' : selectedEdge ? 'Sequence Flow' : 'Element'}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-6 w-6 rounded inline-flex items-center justify-center text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      <div className="p-3 space-y-4">
        {/* ─── Lane ─── */}
        {isLane && selectedNode && (
          <>
            <Field label="Lane name">
              <input
                value={(selectedNode.data as any).label}
                onChange={e => onPatchNode(selectedNode.id, { label: e.target.value })}
                aria-label="Lane name"
                className="ins-input"
              />
            </Field>
            <Field label="Persona (swimlane)">
              <select
                value={(selectedNode.data as any).personaId || ''}
                onChange={e => onPatchNode(selectedNode.id, { personaId: e.target.value || null })}
                aria-label="Persona (swimlane)"
                className="ins-input"
              >
                <option value="">- none -</option>
                {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Role (group of personas)">
              <select
                value={(selectedNode.data as any).roleId || ''}
                onChange={e => onPatchNode(selectedNode.id, { roleId: e.target.value || null })}
                aria-label="Role (group of personas)"
                className="ins-input"
              >
                <option value="">- none -</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="System">
              <select
                value={(selectedNode.data as any).systemId || ''}
                onChange={e => {
                  const id = e.target.value || null
                  onPatchNode(selectedNode.id, { systemId: id, systemLabel: systemName(id) })
                }}
                aria-label="System"
                className="ins-input"
              >
                <option value="">- none -</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </>
        )}

        {/* ─── Element ─── */}
        {!isLane && selectedNode && (
          <>
            <Field label="Label">
              <input
                value={(selectedNode.data as any).label}
                onChange={e => onPatchNode(selectedNode.id, { label: e.target.value })}
                aria-label="Element label"
                className="ins-input"
              />
            </Field>
            <Field label="Type">
              <div className="text-[11px] text-text-secondary font-mono">
                {(selectedNode.data as any).elementType}
              </div>
            </Field>
            <Field label="Description">
              <textarea
                rows={2}
                value={(selectedNode.data as any).description || ''}
                onChange={e => onPatchNode(selectedNode.id, { description: e.target.value })}
                aria-label="Element description"
                className="ins-input resize-y"
              />
            </Field>

            {/* ─── Delivery metadata (from real SAP process docs) ─── */}
            <div className="pt-1 border-t border-border" />
            <Field label="Responsible role">
              <input
                value={(selectedNode.data as any).responsibleRole || ''}
                onChange={e => onPatchNode(selectedNode.id, { responsibleRole: e.target.value })}
                className="ins-input" placeholder="e.g. Payroll Analyst"
              />
            </Field>
            <Field label="RACI">
              <div className="grid grid-cols-2 gap-1.5">
                {(['r', 'a', 'c', 'i'] as const).map(k => (
                  <input
                    key={k}
                    value={(((selectedNode.data as any).raci?.[k]) || []).join(', ')}
                    onChange={e => {
                      const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      const raci = { ...((selectedNode.data as any).raci || {}), [k]: arr }
                      onPatchNode(selectedNode.id, { raci })
                    }}
                    className="ins-input" placeholder={k.toUpperCase()}
                    aria-label={`RACI ${k.toUpperCase()}`}
                  />
                ))}
              </div>
            </Field>
            <Field label="IT systems">
              <div className="flex flex-wrap gap-1">
                {systems.length === 0 && <span className="text-[10px] text-text-tertiary">No systems defined yet.</span>}
                {systems.map(s => {
                  const on = ((selectedNode.data as any).systemIds || []).includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const cur: string[] = (selectedNode.data as any).systemIds || []
                        const next = on ? cur.filter(x => x !== s.id) : [...cur, s.id]
                        onPatchNode(selectedNode.id, { systemIds: next })
                      }}
                      className={`text-[10px] rounded px-1.5 py-0.5 border transition-colors ${on ? 'bg-brand-50 border-brand-300 text-brand-700' : 'border-border text-text-tertiary hover:text-text-secondary hover:border-border-strong'}`}
                    >
                      {s.name}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label="Module">
              <input
                value={(selectedNode.data as any).module || ''}
                onChange={e => onPatchNode(selectedNode.id, { module: e.target.value })}
                className="ins-input font-mono"
                placeholder="e.g. FI, CO, PS, MM"
                list="sap-module-list"
              />
              <datalist id="sap-module-list">
                {SAP_MODULES.map(m => <option key={m} value={m} />)}
              </datalist>
            </Field>
            <Field label="Fiori / Dassian tile">
              <FioriTilePicker
                value={(selectedNode.data as any).fioriTile}
                onChange={t => onPatchNode(selectedNode.id, { fioriTile: t })}
              />
            </Field>
            <Field label="T-code">
              <input value={(selectedNode.data as any).tcode || ''} onChange={e => onPatchNode(selectedNode.id, { tcode: e.target.value })} className="ins-input font-mono" placeholder="e.g. FB50" />
            </Field>
            <Field label="RICEFW codes">
              <input
                value={(((selectedNode.data as any).ricefwCodes) || []).join(', ')}
                onChange={e => onPatchNode(selectedNode.id, { ricefwCodes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                className="ins-input font-mono" placeholder="e.g. INT-014, RPT-003"
              />
            </Field>
          </>
        )}

        {/* ─── Edge ─── */}
        {selectedEdge && (
          <>
            <Field label="Flow type">
              <select
                value={(selectedEdge.data as any)?.kind || 'sequence'}
                onChange={e => onPatchEdge(selectedEdge.id, { kind: e.target.value })}
                aria-label="Flow type"
                className="ins-input"
              >
                <option value="sequence">Sequence</option>
                <option value="conditional">Conditional</option>
                <option value="default">Default</option>
                <option value="message">Message</option>
              </select>
            </Field>
            <Field label="Condition / label">
              <input
                value={(selectedEdge.data as any)?.label || ''}
                onChange={e => onPatchEdge(selectedEdge.id, { label: e.target.value })}
                aria-label="Condition / label"
                className="ins-input"
                placeholder="e.g. Approved"
              />
            </Field>
          </>
        )}

        <Button
          variant="destructive"
          size="sm"
          fullWidth
          onClick={onDelete}
          icon={<Trash2 size={12} />}
        >
          Delete {isLane ? 'lane' : selectedEdge ? 'flow' : 'element'}
        </Button>
      </div>

      <style jsx>{`
        :global(.ins-input) {
          width: 100%;
          background: #f2f2f2;
          border: 1px solid #e2e2e2;
          border-radius: 8px;
          padding: 5px 8px;
          font-size: 12px;
          line-height: 1.5;
          color: #1b1b1b;
          outline: none;
        }
        :global(.ins-input:focus) {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
        }
      `}</style>
    </aside>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider font-semibold text-text-secondary mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export default function ProcessLeafEditor({ nodeId, readOnly = false }: { nodeId: string; readOnly?: boolean }) {
  return (
    <ReactFlowProvider>
      <EditorInner nodeId={nodeId} readOnly={readOnly} />
    </ReactFlowProvider>
  )
}
