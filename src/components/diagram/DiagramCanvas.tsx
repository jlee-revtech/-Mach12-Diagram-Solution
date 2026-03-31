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
import OnboardingGuide from './OnboardingGuide'
import ShareDialog from './ShareDialog'
import { PresenceBadge, RemoteCursors } from './CollabPresence'

const nodeTypes = { system: SystemNodeComponent }
const edgeTypes = { dataFlow: DataFlowEdgeComponent }

function DiagramCanvasInner({ diagramId }: { diagramId?: string }) {
  const { user, profile } = useAuth()
  const [aiOpen, setAiOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
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
  const connectMode = useDiagramStore((s) => s.connectMode)
  const toggleConnectMode = useDiagramStore((s) => s.toggleConnectMode)
  const pendingConnectionSource = useDiagramStore((s) => s.pendingConnectionSource)

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
      if (e.key === 'Escape' && connectMode) {
        e.preventDefault()
        toggleConnectMode()
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
  }, [deleteSelected, connectMode, toggleConnectMode])

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
    // Cancel pending connection source on blank canvas click
    if (pendingConnectionSource) {
      useDiagramStore.setState({ pendingConnectionSource: null })
    }
  }, [setSelectedNode, setSelectedEdge, pendingConnectionSource])

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

        <Toolbar onAiOpen={() => setAiOpen(true)} onHelpOpen={() => setHelpOpen(true)} onShareOpen={() => setShareOpen(true)} />
        <EdgeMarkerDefs />
        <AICommandPalette open={aiOpen} onClose={() => setAiOpen(false)} />
        <OnboardingGuide open={helpOpen} onClose={() => setHelpOpen(false)} />
        <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />

        {/* Connect mode status banner */}
        {connectMode && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[#2563EB]/15 backdrop-blur-sm border border-[#2563EB]/40 rounded-lg px-4 py-2 shadow-lg animate-in fade-in">
            <div className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
            <span className="text-xs text-[#93C5FD] font-medium">
              {pendingConnectionSource
                ? 'Now click a target system to connect'
                : 'Click a source system to start connecting'}
            </span>
            <button
              onClick={toggleConnectMode}
              className="text-[10px] text-[#64748B] hover:text-[#CBD5E1] ml-2 transition-colors"
            >
              Esc to cancel
            </button>
          </div>
        )}

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
          connectionLineStyle={{ stroke: '#2563EB', strokeWidth: 2.5, strokeDasharray: '6 3' }}
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
