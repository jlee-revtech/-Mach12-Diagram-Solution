'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  type Node,
  type Edge,
  type Connection,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { v4 as uuid } from 'uuid'

import { useProcessStore } from '@/lib/process/store'
import * as api from '@/lib/supabase/process-models'
import type {
  ProcessGraph, ProcessLane, ProcessElementData, BpmnElementType, SequenceFlowKind,
} from '@/lib/process/types'
import { BPMN_PALETTE } from '@/lib/process/types'
import ProcessElementNode from './nodes/ProcessElementNode'
import LaneNode from './nodes/LaneNode'
import SequenceFlowEdge, { SequenceFlowMarkerDefs } from './edges/SequenceFlowEdge'
import ProcessPalette from './ProcessPalette'

const LANE_H = 150
const LANE_W = 2400
const LANE_COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#6366F1']

const nodeTypes = { processElement: ProcessElementNode, processLane: LaneNode }
const edgeTypes = { sequenceFlow: SequenceFlowEdge }

const LANE_STYLE = `.react-flow__node-processLane { pointer-events: none !important; } .react-flow__node-processLane [data-lane-gutter] { pointer-events: auto !important; }`

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
    order: i,
    color: (n.data as any).laneColor,
  }))
  const elementNodes = nodes
    .filter(n => n.type === 'processElement')
    .map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })) as any
  return { lanes, nodes: elementNodes, edges: edges as any, viewport }
}

function laneIndexForY(centerY: number, laneCount: number): number {
  return Math.max(0, Math.min(laneCount - 1, Math.floor(centerY / LANE_H)))
}

// ─── Editor inner (inside provider) ────────────────────
function EditorInner({ nodeId, readOnly }: { nodeId: string; readOnly: boolean }) {
  const node = useProcessStore(s => s.nodes.find(n => n.id === nodeId))
  const logicalSystems = useProcessStore(s => s.logicalSystems)
  const personas = useProcessStore(s => s.personas)
  const saveLeafGraph = useProcessStore(s => s.saveLeafGraph)

  const systemName = useCallback(
    (id?: string | null) => (id ? logicalSystems.find(s => s.id === id)?.name ?? null : null),
    [logicalSystems]
  )

  const { screenToFlowPosition, getViewport } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selection, setSelection] = useState<{ type: 'node' | 'edge' | 'lane'; id: string } | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
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

  // Load the leaf graph once per node
  useEffect(() => {
    if (!node || loadedForRef.current === nodeId) return
    loadedForRef.current = nodeId
    const init = buildInitialNodes(node.graph_data, systemName)
    setNodes(init)
    setEdges(((node.graph_data?.edges || []) as Edge[]))
    lastSavedRef.current = JSON.stringify(extractGraph(init, (node.graph_data?.edges || []) as Edge[]))
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
    setEdges(eds => addEdge({ ...c, type: 'sequenceFlow', data: { kind: 'sequence' as SequenceFlowKind } }, eds))
  }, [readOnly, setEdges])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (readOnly) return
    const type = e.dataTransfer.getData('application/bpmn-element') as BpmnElementType
    if (!type) return
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const lanes = nodes.filter(n => n.type === 'processLane').sort((a, b) => a.position.y - b.position.y)
    const laneIdx = laneIndexForY(pos.y, lanes.length)
    const laneId = lanes[laneIdx]?.id.replace(/^lane-/, '')
    setNodes(nds => nds.concat({
      id: uuid(),
      type: 'processElement',
      position: pos,
      data: { label: paletteLabel(type), elementType: type, laneId } as ProcessElementData,
      selected: true,
    }))
  }, [readOnly, screenToFlowPosition, nodes, setNodes])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  // Reassign laneId when an element is dropped into a different band
  const onNodeDragStop = useCallback((_: unknown, dragged: Node) => {
    if (dragged.type !== 'processElement') return
    const lanes = nodes.filter(n => n.type === 'processLane').sort((a, b) => a.position.y - b.position.y)
    const centerY = dragged.position.y + (dragged.height ?? 64) / 2
    const laneId = lanes[laneIndexForY(centerY, lanes.length)]?.id.replace(/^lane-/, '')
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
    setNodes(nds => nds.concat(laneToNode({ id, label: `Lane ${order + 1}`, order }, null)))
  }, [readOnly, nodes, setNodes])

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
    setNodes([...laneNodes, ...elementNodes])
    setEdges(aiEdges)
  }, [setNodes, setEdges])

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
    if (selection.type === 'edge') setEdges(eds => eds.filter(e => e.id !== selection.id))
    else setNodes(nds => nds.filter(n => n.id !== selection.id))
    setSelection(null)
  }, [selection, readOnly, setEdges, setNodes])

  const selectedNode = selection && selection.type !== 'edge' ? nodes.find(n => n.id === selection.id) : null
  const selectedEdge = selection?.type === 'edge' ? edges.find(e => e.id === selection.id) : null

  return (
    <div className="flex h-full min-h-0">
      {!readOnly && <ProcessPalette onAddLane={addLane} />}

      <div className="flex-1 relative min-w-0">
        <style dangerouslySetInnerHTML={{ __html: LANE_STYLE }} />
        <SequenceFlowMarkerDefs />

        {/* Top-right controls */}
        {!readOnly && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
            <button
              onClick={() => setAiOpen(true)}
              title="Draft this flow from a text description"
              className="flex items-center gap-1 bg-[var(--m12-bg-card)]/80 backdrop-blur-sm border border-[#0EA5E9]/40 hover:border-[#0EA5E9]/70 rounded-md px-2 py-1 text-[10px] text-[#0EA5E9] transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5l1.3 3.2 3.2 1.3-3.2 1.3L7 10.5 5.7 7.3 2.5 6l3.2-1.3L7 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
              </svg>
              AI Draft
            </button>
            <div className="flex items-center gap-1.5 bg-[var(--m12-bg-card)]/80 backdrop-blur-sm border border-[var(--m12-border)]/40 rounded-md px-2 py-1">
              <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saved' ? 'bg-[#10B981]' : saveStatus === 'saving' ? 'bg-[#EAB308] animate-pulse' : 'bg-[var(--m12-text-muted)]'}`} />
              <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
                {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : 'Unsaved'}
              </span>
            </div>
          </div>
        )}

        {/* AI draft modal */}
        {aiOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40" onClick={() => { if (!aiBusy) setAiOpen(false) }}>
            <div onClick={e => e.stopPropagation()} className="w-[26rem] max-w-[90%] bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-xl shadow-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--m12-text)]">Draft flow from text</h3>
                {!aiBusy && (
                  <button onClick={() => setAiOpen(false)} aria-label="Close" className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                  </button>
                )}
              </div>

              {aiBusy ? (
                <div className="py-8 flex flex-col items-center text-center">
                  <div className="relative w-12 h-12 mb-4">
                    <div className="absolute inset-0 rounded-full border-2 border-[#0EA5E9]/20" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#0EA5E9] animate-spin" />
                    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" className="absolute inset-0 m-auto text-[#0EA5E9] animate-pulse">
                      <path d="M7 1.5l1.3 3.2 3.2 1.3-3.2 1.3L7 10.5 5.7 7.3 2.5 6l3.2-1.3L7 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="text-sm font-medium text-[var(--m12-text)] mb-1">Drafting your process flow{aiDots}</div>
                  <div className="text-[11px] text-[var(--m12-text-muted)] max-w-[18rem]">
                    Designing swimlanes, tasks, gateways and sequence flows. This usually takes 10–20 seconds.
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
                    placeholder="Describe the process steps, who does each, and the decision points…"
                    className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none focus:border-[#0EA5E9]/60 resize-y mb-3"
                  />
                  <button
                    onClick={handleAiDraft}
                    disabled={!aiPrompt.trim()}
                    className="w-full bg-[#0EA5E9] hover:bg-[#38BDF8] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Generate flow
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'sequenceFlow', data: { kind: 'sequence' } }}
          connectionMode={ConnectionMode.Loose}
          connectionLineStyle={{ stroke: '#0EA5E9', strokeWidth: 2, strokeDasharray: '6 3' }}
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
  selectedNode, selectedEdge, isLane, systems, personas, systemName,
  onPatchNode, onPatchEdge, onDelete, onClose,
}: {
  selectedNode: Node | null | undefined
  selectedEdge: Edge | null | undefined
  isLane: boolean
  systems: { id: string; name: string }[]
  personas: { id: string; name: string }[]
  systemName: (id?: string | null) => string | null
  onPatchNode: (id: string, patch: Record<string, unknown>) => void
  onPatchEdge: (id: string, patch: Record<string, unknown>) => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <aside className="w-64 shrink-0 border-l border-[var(--m12-border)]/40 bg-[var(--m12-bg-card)]/40 overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--m12-border)]/40">
        <span className="text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold">
          {isLane ? 'Lane' : selectedEdge ? 'Sequence Flow' : 'Element'}
        </span>
        <button onClick={onClose} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
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
                className="ins-input"
              />
            </Field>
            <Field label="System">
              <select
                value={(selectedNode.data as any).systemId || ''}
                onChange={e => {
                  const id = e.target.value || null
                  onPatchNode(selectedNode.id, { systemId: id, systemLabel: systemName(id) })
                }}
                className="ins-input"
              >
                <option value="">— none —</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Owner role">
              <select
                value={(selectedNode.data as any).personaId || ''}
                onChange={e => onPatchNode(selectedNode.id, { personaId: e.target.value || null })}
                className="ins-input"
              >
                <option value="">— none —</option>
                {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                className="ins-input"
              />
            </Field>
            <Field label="Type">
              <div className="text-[11px] text-[var(--m12-text-secondary)] font-[family-name:var(--font-space-mono)]">
                {(selectedNode.data as any).elementType}
              </div>
            </Field>
            <Field label="Description">
              <textarea
                rows={3}
                value={(selectedNode.data as any).description || ''}
                onChange={e => onPatchNode(selectedNode.id, { description: e.target.value })}
                className="ins-input resize-y"
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
                className="ins-input"
                placeholder="e.g. Approved"
              />
            </Field>
          </>
        )}

        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] text-red-400 border border-red-400/30 hover:border-red-400/60 hover:bg-red-400/5 rounded-md py-1.5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Delete {isLane ? 'lane' : selectedEdge ? 'flow' : 'element'}
        </button>
      </div>

      <style jsx>{`
        :global(.ins-input) {
          width: 100%;
          background: var(--m12-bg);
          border: 1px solid color-mix(in srgb, var(--m12-border) 50%, transparent);
          border-radius: 6px;
          padding: 5px 8px;
          font-size: 12px;
          color: var(--m12-text);
          outline: none;
        }
        :global(.ins-input:focus) { border-color: #0EA5E9; }
      `}</style>
    </aside>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold mb-1.5">{label}</label>
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
