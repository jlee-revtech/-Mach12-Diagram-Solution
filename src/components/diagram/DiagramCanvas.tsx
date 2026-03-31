'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlowProvider,
  ConnectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useDiagramStore } from '@/lib/diagram/store'
import { useAuth } from '@/lib/supabase/auth-context'
import { useCollaboration } from '@/lib/collab/useCollaboration'
import SystemNodeComponent from './SystemNode'
import DataFlowEdgeComponent, { EdgeMarkerDefs } from './DataFlowEdge'
import Toolbar from './Toolbar'
import Sidebar from './Sidebar'
import AICommandPalette from './AICommandPalette'
import { PresenceBadge, RemoteCursors } from './CollabPresence'

const nodeTypes = { system: SystemNodeComponent }
const edgeTypes = { dataFlow: DataFlowEdgeComponent }

function DiagramCanvasInner({ diagramId }: { diagramId?: string }) {
  const { user, profile } = useAuth()
  const [aiOpen, setAiOpen] = useState(false)
  const { connected, users, syncToYjs, updateCursor, seedFromStore } = useCollaboration(
    diagramId,
    profile?.display_name || user?.email || 'Anonymous'
  )
  const nodes = useDiagramStore((s) => s.nodes)
  const edges = useDiagramStore((s) => s.edges)
  const onNodesChange = useDiagramStore((s) => s.onNodesChange)
  const onEdgesChange = useDiagramStore((s) => s.onEdgesChange)
  const onConnect = useDiagramStore((s) => s.onConnect)
  const setSelectedNode = useDiagramStore((s) => s.setSelectedNode)
  const setSelectedEdge = useDiagramStore((s) => s.setSelectedEdge)
  const deleteSelected = useDiagramStore((s) => s.deleteSelected)
  const loadDiagram = useDiagramStore((s) => s.loadDiagram)
  const meta = useDiagramStore((s) => s.meta)

  // Load diagram from Supabase, then seed Yjs
  useEffect(() => {
    if (diagramId) {
      loadDiagram(diagramId).then(() => {
        // Give Yjs a moment to connect, then seed if we're the first client
        setTimeout(seedFromStore, 500)
      })
    }
  }, [diagramId, loadDiagram, seedFromStore])

  // Debounced sync to Yjs — only fires after user stops making changes
  useEffect(() => {
    const timer = setTimeout(() => {
      syncToYjs()
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setAiOpen((prev) => !prev)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return
        }
        deleteSelected()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteSelected])

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [setSelectedNode, setSelectedEdge])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    updateCursor(e.clientX, e.clientY)
  }, [updateCursor])

  return (
    <div className="flex h-screen w-full bg-[#151E2E]">
      {/* Canvas area */}
      <div className="flex-1 relative" onMouseMove={handleMouseMove}>
        <RemoteCursors users={users} />
        <PresenceBadge users={users} connected={connected} />
        {/* Logo + Title + Process context */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
          {/* Mach12.ai logo */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-gradient text-sm font-bold font-[family-name:var(--font-orbitron)] tracking-wide">
              MACH12
            </span>
            <span className="text-[#64748B] text-xs">.AI</span>
          </div>
          {/* Diagram title */}
          <div className="bg-[#1F2C3F]/90 backdrop-blur-sm border border-[#374A5E]/60 rounded-lg px-3 py-1.5">
            <span className="text-[13px] font-semibold text-[#F8FAFC]">
              {meta.title}
            </span>
          </div>
          {meta.processContext && (
            <div className="bg-[#1F2C3F]/90 backdrop-blur-sm border border-[#374A5E]/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#06B6D4]" />
              <span className="text-[11px] font-medium text-[#CBD5E1] font-[family-name:var(--font-space-mono)] uppercase tracking-wider">
                {meta.processContext}
              </span>
            </div>
          )}
        </div>

        <Toolbar onAiOpen={() => setAiOpen(true)} />
        <EdgeMarkerDefs />
        <AICommandPalette open={aiOpen} onClose={() => setAiOpen(false)} />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{
            type: 'dataFlow',
            data: { dataElements: [], direction: 'forward' },
          }}
          fitView
          snapToGrid
          snapGrid={[16, 16]}
          connectionMode={ConnectionMode.Loose}
          connectionLineStyle={{ stroke: '#2563EB', strokeWidth: 2 }}
          proOptions={{ hideAttribution: true }}
          className="!bg-[#151E2E]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#374A5E40"
          />
          <MiniMap
            nodeStrokeColor="#374A5E"
            nodeColor="#1F2C3F"
            nodeBorderRadius={8}
            maskColor="rgba(21, 30, 46, 0.85)"
            className="!bg-[#1A2435] !border-[#374A5E]/40 !rounded-lg"
            style={{ width: 160, height: 100 }}
          />
        </ReactFlow>
      </div>

      {/* Sidebar */}
      <Sidebar />
    </div>
  )
}

export default function DiagramCanvas({ diagramId }: { diagramId?: string }) {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInner diagramId={diagramId} />
    </ReactFlowProvider>
  )
}
