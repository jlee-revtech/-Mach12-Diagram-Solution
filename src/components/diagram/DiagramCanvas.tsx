'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlowProvider,
  ConnectionMode,
  SelectionMode,
  applyNodeChanges,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useDiagramStore } from '@/lib/diagram/store'
import { useAuth } from '@/lib/supabase/auth-context'
import { useCollaboration } from '@/lib/collab/useCollaboration'
import SystemNodeComponent from './SystemNode'
import GroupNodeComponent from './GroupNode'
import DataFlowEdgeComponent, { EdgeMarkerDefs } from './DataFlowEdge'
import Toolbar from './Toolbar'
import Sidebar from './Sidebar'
import AICommandPalette from './AICommandPalette'
import OnboardingGuide from './OnboardingGuide'
import ShareDialog from './ShareDialog'
import { PresenceBadge, RemoteCursors } from './CollabPresence'

const nodeTypes = { system: SystemNodeComponent, systemGroup: GroupNodeComponent }
const edgeTypes = { dataFlow: DataFlowEdgeComponent }

// Static CSS for group node pointer-events — outside render to avoid style recalc per frame
const GROUP_NODE_STYLE = `.react-flow__node-systemGroup { pointer-events: none !important; } .react-flow__node-systemGroup .react-flow__handle { pointer-events: auto !important; }`

function ArtifactSpotlightBar() {
  const artifacts = useDiagramStore((s) => s.artifacts)
  const spotlightArtifactId = useDiagramStore((s) => s.spotlightArtifactId)
  const setSpotlightArtifact = useDiagramStore((s) => s.setSpotlightArtifact)

  if (artifacts.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 px-1 py-1">
      {artifacts.map((art) => {
        const isActive = spotlightArtifactId === art.id
        return (
          <button
            key={art.id}
            onClick={() => setSpotlightArtifact(isActive ? null : art.id)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-medium transition-all ${
              isActive
                ? 'bg-[#F97316]/20 text-[#FB923C] border border-[#F97316]/40 shadow-[0_0_8px_rgba(249,115,22,0.2)]'
                : 'bg-[#1F2C3F]/80 text-[#64748B] border border-[#374A5E]/30 hover:text-[#CBD5E1] hover:border-[#374A5E]/60'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#F97316]' : 'bg-[#F97316]/30'}`} />
            {art.name}
          </button>
        )
      })}
    </div>
  )
}

function DiagramCanvasInner({ diagramId }: { diagramId?: string }) {
  const { user, profile } = useAuth()
  const [aiOpen, setAiOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const { connected, users, syncToYjs, updateCursor, seedFromStore } = useCollaboration(
    diagramId,
    profile?.display_name || user?.email || 'Anonymous'
  )
  const systemNodes = useDiagramStore((s) => s.nodes)
  const groups = useDiagramStore((s) => s.groups)
  const edges = useDiagramStore((s) => s.edges)
  // Merge groups (rendered first/behind) and system nodes for ReactFlow
  const nodes = useMemo(() => [...groups as any[], ...systemNodes], [groups, systemNodes])

  // Split node changes by type: group changes update groups array, system changes update nodes
  const groupIdsRef = useRef(new Set<string>())
  groupIdsRef.current = new Set(groups.map((g) => g.id))
  const handleNodesChange = useCallback((changes: NodeChange<any>[]) => {
    const gids = groupIdsRef.current
    const systemChanges: NodeChange<any>[] = []
    const groupChanges: NodeChange<any>[] = []
    for (const c of changes) {
      if ('id' in c && gids.has((c as any).id)) {
        groupChanges.push(c)
      } else {
        systemChanges.push(c)
      }
    }
    // Batch into a single setState to avoid double re-render
    const updates: Record<string, any> = {}
    if (systemChanges.length > 0) {
      updates.nodes = applyNodeChanges(systemChanges, useDiagramStore.getState().nodes)
    }
    if (groupChanges.length > 0) {
      updates.groups = applyNodeChanges(groupChanges, useDiagramStore.getState().groups)
    }
    if (Object.keys(updates).length > 0) {
      useDiagramStore.setState(updates)
    }
  }, [])
  const onEdgesChange = useDiagramStore((s) => s.onEdgesChange)
  const onConnect = useDiagramStore((s) => s.onConnect)
  const setSelectedNode = useDiagramStore((s) => s.setSelectedNode)
  const setSelectedEdge = useDiagramStore((s) => s.setSelectedEdge)
  const deleteSelected = useDiagramStore((s) => s.deleteSelected)
  const loadDiagram = useDiagramStore((s) => s.loadDiagram)
  const meta = useDiagramStore((s) => s.meta)
  const onReconnect = useDiagramStore((s) => s.onReconnect)
  const copyEdgeData = useDiagramStore((s) => s.copyEdgeData)
  const pasteEdgeData = useDiagramStore((s) => s.pasteEdgeData)
  const connectMode = useDiagramStore((s) => s.connectMode)
  const toggleConnectMode = useDiagramStore((s) => s.toggleConnectMode)
  const pendingConnectionSource = useDiagramStore((s) => s.pendingConnectionSource)

  // Track reconnect in progress for visual feedback
  const [reconnecting, setReconnecting] = useState(false)
  // Toast for copy/paste feedback
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2000)
  }, [])

  // Load diagram from Supabase, then seed Yjs
  useEffect(() => {
    if (diagramId) {
      loadDiagram(diagramId).then(() => {
        // Give Yjs a moment to connect, then seed if we're the first client
        setTimeout(seedFromStore, 500)
      })
    }
  }, [diagramId, loadDiagram, seedFromStore])

  // Autosave status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaveRef = useRef<string>('')
  const savingRef = useRef(false)

  // Debounced sync to Yjs + autosave to Supabase on ANY change
  // Use a cheap change counter instead of JSON.stringify on every frame
  const changeTickRef = useRef(0)
  useEffect(() => {
    // Increment tick — the actual fingerprint comparison is deferred to the debounced callbacks
    changeTickRef.current++
    const tick = changeTickRef.current

    setSaveStatus('unsaved')

    // Sync to Yjs quickly (300ms) for real-time collaboration
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      syncToYjs()
    }, 300)

    // Autosave to Supabase after changes settle (2s debounce)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!user || savingRef.current) return
      // Only save if no more changes came in during the debounce period
      if (changeTickRef.current !== tick) return
      // Fingerprint check — only run once when we're actually about to save
      const fp = JSON.stringify({
        n: useDiagramStore.getState().nodes,
        e: useDiagramStore.getState().edges,
        g: useDiagramStore.getState().groups,
      })
      if (fp === lastSaveRef.current) {
        setSaveStatus('saved')
        return
      }
      savingRef.current = true
      setSaveStatus('saving')
      try {
        await useDiagramStore.getState().saveDiagram(user.id)
        lastSaveRef.current = fp
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
      } finally {
        savingRef.current = false
      }
    }, 2000)

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemNodes, edges, groups, user])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setAiOpen((prev) => !prev)
        return
      }
      // Ctrl+Z — undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        e.preventDefault()
        useDiagramStore.getState().undo()
        return
      }
      // Ctrl+C — copy selected node or edge data
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        const { selectedNodeId, selectedEdgeId } = useDiagramStore.getState()
        if (selectedNodeId) {
          e.preventDefault()
          useDiagramStore.getState().copyNode(selectedNodeId)
          showToast('System copied')
        } else if (selectedEdgeId) {
          e.preventDefault()
          copyEdgeData(selectedEdgeId)
          showToast('Connection data copied')
        }
        return
      }
      // Ctrl+V — paste node or edge data
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        const state = useDiagramStore.getState()
        // If an edge is selected and we have copied edge data, paste onto edge
        if (state.selectedEdgeId && state.copiedEdgeData) {
          e.preventDefault()
          pasteEdgeData(state.selectedEdgeId)
          showToast('Connection data pasted')
        }
        // Otherwise if we have a copied node, paste it
        else if (state.copiedNodeData) {
          e.preventDefault()
          state.pasteNode()
          showToast('System pasted')
        }
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
  }, [deleteSelected, connectMode, toggleConnectMode, copyEdgeData, pasteEdgeData, showToast])

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
    useDiagramStore.setState({ selectedGroupId: null })
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
          {/* Autosave indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
              saveStatus === 'saved' ? 'bg-[#10B981]' :
              saveStatus === 'saving' ? 'bg-[#EAB308] animate-pulse' :
              'bg-[#64748B]'
            }`} />
            <span className="text-[9px] text-[#64748B] font-[family-name:var(--font-space-mono)]">
              {saveStatus === 'saved' ? 'Saved' :
               saveStatus === 'saving' ? 'Saving...' :
               'Unsaved changes'}
            </span>
          </div>
          {/* Output Artifacts quick-spotlight */}
          <ArtifactSpotlightBar />
        </div>

        <Toolbar onAiOpen={() => setAiOpen(true)} onHelpOpen={() => setHelpOpen(true)} onShareOpen={() => setShareOpen(true)} />
        <EdgeMarkerDefs />
        <AICommandPalette open={aiOpen} onClose={() => setAiOpen(false)} />
        <OnboardingGuide open={helpOpen} onClose={() => setHelpOpen(false)} />
        <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />

        {/* Toast notification */}
        {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#06B6D4]/15 backdrop-blur-sm border border-[#06B6D4]/40 rounded-lg px-4 py-2 shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7l3 3 5-6" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs text-[#67E8F9] font-medium">{toast}</span>
          </div>
        )}

        {/* Reconnect mode indicator */}
        {reconnecting && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[#06B6D4]/15 backdrop-blur-sm border border-[#06B6D4]/40 rounded-lg px-4 py-2 shadow-lg animate-in fade-in">
            <div className="w-2 h-2 rounded-full bg-[#06B6D4] animate-pulse" />
            <span className="text-xs text-[#67E8F9] font-medium">
              Drop on a system to reconnect
            </span>
          </div>
        )}

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

        {/* Override pointer-events for group nodes so clicks pass through to edges/labels */}
        <style dangerouslySetInnerHTML={{ __html: GROUP_NODE_STYLE }} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          elevateEdgesOnSelect
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onReconnectStart={() => setReconnecting(true)}
          onReconnectEnd={() => setReconnecting(false)}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{
            type: 'dataFlow',
            data: { dataElements: [], direction: 'forward' },
          }}
          fitView
          minZoom={0.05}
          maxZoom={4}
          snapToGrid
          snapGrid={[16, 16]}
          selectionOnDrag={false}
          selectionMode={SelectionMode.Partial}
          selectionKeyCode="Shift"
          connectionMode={ConnectionMode.Loose}
          connectionLineStyle={{ stroke: reconnecting ? '#06B6D4' : '#2563EB', strokeWidth: 2.5, strokeDasharray: '6 3' }}
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
