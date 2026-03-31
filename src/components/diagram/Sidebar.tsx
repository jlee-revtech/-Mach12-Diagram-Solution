'use client'

import { useState, useCallback, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useDiagramStore } from '@/lib/diagram/store'
import {
  SYSTEM_TEMPLATES,
  PROCESS_CONTEXTS,
  OUTPUT_ARTIFACT_PRESETS,
  type SystemTemplate,
  type DataElementType,
} from '@/lib/diagram/types'
import AISuggest from './AISuggest'

const ELEMENT_TYPE_OPTIONS: { value: DataElementType; label: string }[] = [
  { value: 'transaction', label: 'Transaction' },
  { value: 'master_data', label: 'Master Data' },
  { value: 'data_object', label: 'Data Object' },
  { value: 'document', label: 'Document' },
  { value: 'event', label: 'Event' },
  { value: 'custom', label: 'Custom' },
]

export default function Sidebar() {
  const sidebarTab = useDiagramStore((s) => s.sidebarTab)
  const setSidebarTab = useDiagramStore((s) => s.setSidebarTab)

  return (
    <div className="w-[300px] bg-[#1A2435] border-l border-[#374A5E]/40 flex flex-col shrink-0 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[#374A5E]/40">
        <TabButton
          active={sidebarTab === 'palette'}
          onClick={() => setSidebarTab('palette')}
        >
          Systems
        </TabButton>
        <TabButton
          active={sidebarTab === 'properties'}
          onClick={() => setSidebarTab('properties')}
        >
          Properties
        </TabButton>
        <TabButton
          active={sidebarTab === 'elements'}
          onClick={() => setSidebarTab('elements')}
        >
          Data
        </TabButton>
        <TabButton
          active={sidebarTab === 'notes'}
          onClick={() => setSidebarTab('notes')}
        >
          Notes
        </TabButton>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {sidebarTab === 'palette' && <PaletteTab />}
        {sidebarTab === 'properties' && <PropertiesTab />}
        {sidebarTab === 'elements' && <ElementsTab />}
        {sidebarTab === 'notes' && <NotesTab />}
      </div>
    </div>
  )
}

// ─── Palette Tab ────────────────────────────────────────
function PaletteTab() {
  const addSystem = useDiagramStore((s) => s.addSystem)
  const { screenToFlowPosition } = useReactFlow()

  const handleAdd = useCallback(
    (template: SystemTemplate) => {
      // Place new nodes in a scattered pattern from center
      const pos = screenToFlowPosition({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
        y: window.innerHeight / 2 + (Math.random() - 0.5) * 200,
      })
      addSystem(template.type, template.label, pos)
    },
    [addSystem, screenToFlowPosition]
  )

  return (
    <div>
      <SidebarLabel>Diagram Settings</SidebarLabel>
      <DiagramSettings />
      <div className="mt-5" />
      <SidebarLabel>Add System</SidebarLabel>
      <p className="text-[11px] text-[#64748B] mb-3">
        Click to add a system to the canvas.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SYSTEM_TEMPLATES.map((t) => (
          <button
            key={t.type}
            onClick={() => handleAdd(t)}
            className="flex items-center gap-2 bg-[#1F2C3F] hover:bg-[#263448] border border-[#374A5E]/40 hover:border-[#374A5E] rounded-lg px-3 py-2.5 transition-colors text-left"
          >
            <div
              style={{ backgroundColor: t.color + '20', color: t.color }}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold font-[family-name:var(--font-space-mono)] shrink-0"
            >
              {t.label.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#CBD5E1] truncate">
                {t.label}
              </div>
              <div className="text-[9px] text-[#64748B] truncate">
                {t.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Diagram Settings ───────────────────────────────────
function DiagramSettings() {
  const meta = useDiagramStore((s) => s.meta)
  const setTitle = useDiagramStore((s) => s.setTitle)
  const setProcessContext = useDiagramStore((s) => s.setProcessContext)

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
          Title
        </label>
        <input
          value={meta.title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
          Process Context
        </label>
        <select
          value={meta.processContext || ''}
          onChange={(e) => setProcessContext(e.target.value)}
          className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors"
        >
          <option value="">Select process...</option>
          {PROCESS_CONTEXTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ─── Properties Tab ─────────────────────────────────────
function PropertiesTab() {
  const selectedNodeId = useDiagramStore((s) => s.selectedNodeId)
  const nodes = useDiagramStore((s) => s.nodes)
  const updateSystemLabel = useDiagramStore((s) => s.updateSystemLabel)
  const updateSystemPhysical = useDiagramStore((s) => s.updateSystemPhysical)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  if (!selectedNode) {
    return (
      <div className="text-center py-12">
        <div className="text-[#374A5E] text-3xl mb-3">&#9634;</div>
        <p className="text-sm text-[#64748B]">Select a system node to view properties</p>
      </div>
    )
  }

  return (
    <div>
      <SidebarLabel>System Properties</SidebarLabel>
      <div className="space-y-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
            Name
          </label>
          <input
            value={selectedNode.data.label}
            onChange={(e) => updateSystemLabel(selectedNode.id, e.target.value)}
            className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
            Physical System
          </label>
          <input
            value={selectedNode.data.physicalSystem || ''}
            onChange={(e) => updateSystemPhysical(selectedNode.id, e.target.value)}
            placeholder="e.g., SAP S/4HANA, Oracle PeopleSoft"
            className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#374A5E]"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
            Logical Type
          </label>
          <div className="bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2">
            <div className="text-sm text-[#64748B]">
              {selectedNode.data.systemType.toUpperCase()}
            </div>
            <div className="text-[10px] text-[#94A3B8] mt-0.5">
              {SYSTEM_TEMPLATES.find((t) => t.type === selectedNode.data.systemType)?.description ?? ''}
            </div>
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
            Node ID
          </label>
          <div className="bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2 text-[10px] text-[#374A5E] font-[family-name:var(--font-space-mono)] truncate">
            {selectedNode.id}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Artifact Tagger (shown on edge edit) ──────────────
function ArtifactTagger({ edgeId, taggedIds }: { edgeId: string; taggedIds: string[] }) {
  const artifacts = useDiagramStore((s) => s.artifacts)
  const toggleEdgeArtifact = useDiagramStore((s) => s.toggleEdgeArtifact)

  if (artifacts.length === 0) {
    return (
      <div className="mb-4">
        <SidebarLabel>Output Artifacts</SidebarLabel>
        <p className="text-[10px] text-[#374A5E] italic">
          No artifacts defined. Add them in the Data tab (click canvas first).
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4">
      <SidebarLabel>Output Artifacts</SidebarLabel>
      <p className="text-[11px] text-[#64748B] mb-2">
        Tag which artifacts this data flow contributes to.
      </p>
      <div className="space-y-1">
        {artifacts.map((art) => {
          const isTagged = taggedIds.includes(art.id)
          return (
            <button
              key={art.id}
              onClick={() => toggleEdgeArtifact(edgeId, art.id)}
              className={`flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-lg transition-all ${
                isTagged
                  ? 'bg-[#F97316]/10 border border-[#F97316]/40'
                  : 'bg-[#151E2E] border border-[#374A5E]/30 hover:border-[#374A5E]/60'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                isTagged ? 'border-[#F97316] bg-[#F97316]' : 'border-[#374A5E]'
              }`}>
                {isTagged && (
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className={`text-xs transition-colors ${isTagged ? 'text-[#CBD5E1] font-medium' : 'text-[#64748B]'}`}>
                {art.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Artifacts Manager ─────────────────────────────────
function ArtifactsManager() {
  const artifacts = useDiagramStore((s) => s.artifacts)
  const addArtifact = useDiagramStore((s) => s.addArtifact)
  const removeArtifact = useDiagramStore((s) => s.removeArtifact)
  const updateArtifact = useDiagramStore((s) => s.updateArtifact)
  const spotlightArtifactId = useDiagramStore((s) => s.spotlightArtifactId)
  const setSpotlightArtifact = useDiagramStore((s) => s.setSpotlightArtifact)
  const edges = useDiagramStore((s) => s.edges)
  const [newName, setNewName] = useState('')

  const handleAdd = useCallback(() => {
    if (!newName.trim()) return
    addArtifact({ name: newName.trim() })
    setNewName('')
  }, [newName, addArtifact])

  // Count tagged edges per artifact
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of edges) {
      for (const aid of e.data?.outputArtifactIds ?? []) {
        counts.set(aid, (counts.get(aid) ?? 0) + 1)
      }
    }
    return counts
  }, [edges])

  return (
    <div className="mb-5">
      <SidebarLabel>Output Artifacts</SidebarLabel>
      <p className="text-[11px] text-[#64748B] mb-3">
        Deliverables produced by data flows. Click to spotlight.
      </p>

      <div className="space-y-1.5 mb-3">
        {artifacts.map((art) => {
          const isActive = spotlightArtifactId === art.id
          const count = tagCounts.get(art.id) ?? 0
          return (
            <div
              key={art.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#F97316]/10 border border-[#F97316]/40 shadow-[0_0_12px_rgba(249,115,22,0.15)]'
                  : 'bg-[#151E2E] border border-[#374A5E]/30 hover:border-[#F97316]/30'
              }`}
            >
              <button
                onClick={() => setSpotlightArtifact(isActive ? null : art.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 transition-colors ${isActive ? 'bg-[#F97316]' : 'bg-[#F97316]/40'}`} />
                <div className="flex-1 min-w-0">
                  <input
                    value={art.name}
                    onChange={(e) => { e.stopPropagation(); updateArtifact(art.id, { name: e.target.value }) }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-transparent text-xs text-[#CBD5E1] outline-none font-medium"
                  />
                  <div className="flex items-center gap-2">
                    {count > 0 && (
                      <span className="text-[8px] text-[#F97316]/70 font-[family-name:var(--font-space-mono)]">
                        {count} flow{count !== 1 ? 's' : ''}
                      </span>
                    )}
                    {count === 0 && (
                      <span className="text-[8px] text-[#374A5E] italic">untagged</span>
                    )}
                  </div>
                </div>
              </button>
              <button
                onClick={() => { if (isActive) setSpotlightArtifact(null); removeArtifact(art.id) }}
                className="text-[#374A5E] hover:text-red-400 transition-colors shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          )
        })}
      </div>

      {/* Add new artifact */}
      <div className="flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="New artifact name..."
          className="flex-1 bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-1.5 text-xs text-[#F8FAFC] outline-none focus:border-[#F97316] transition-colors placeholder:text-[#374A5E]"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="bg-[#F97316] hover:bg-[#FB923C] disabled:opacity-30 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          Add
        </button>
      </div>

      {/* Presets */}
      {artifacts.length === 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {OUTPUT_ARTIFACT_PRESETS.slice(0, 6).map((preset) => (
            <button
              key={preset}
              onClick={() => addArtifact({ name: preset })}
              className="text-[8px] bg-[#F97316]/5 text-[#F97316]/60 hover:text-[#F97316] border border-[#F97316]/15 hover:border-[#F97316]/30 px-1.5 py-0.5 rounded transition-colors"
            >
              + {preset}
            </button>
          ))}
        </div>
      )}

      {/* Active spotlight banner */}
      {spotlightArtifactId && (
        <div className="mt-3 flex items-center gap-2 bg-[#F97316]/10 border border-[#F97316]/30 rounded-lg px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-[#F97316] animate-pulse" />
          <span className="text-[10px] text-[#FB923C] font-medium flex-1">
            Spotlighting: {artifacts.find((a) => a.id === spotlightArtifactId)?.name}
          </span>
          <button
            onClick={() => setSpotlightArtifact(null)}
            className="text-[9px] text-[#64748B] hover:text-[#CBD5E1] transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Connections Catalog (shown when no edge is selected) ─
function ConnectionsCatalog() {
  const edges = useDiagramStore((s) => s.edges)
  const nodes = useDiagramStore((s) => s.nodes)
  const setSelectedEdge = useDiagramStore((s) => s.setSelectedEdge)
  const setSidebarTab = useDiagramStore((s) => s.setSidebarTab)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')

  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes]
  )

  // Build unique system list for filter dropdown
  const systemOptions = useMemo(() => {
    const seen = new Map<string, { label: string; physical?: string }>()
    nodes.forEach((n) => {
      if (!seen.has(n.id)) seen.set(n.id, { label: n.data.label, physical: n.data.physicalSystem })
    })
    return Array.from(seen.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
  }, [nodes])

  // Filter + search
  const filteredEdges = useMemo(() => {
    return edges.filter((e) => {
      const srcNode = nodeMap.get(e.source)
      const tgtNode = nodeMap.get(e.target)
      if (!srcNode || !tgtNode) return false
      // System filter
      if (filter && e.source !== filter && e.target !== filter) return false
      // Text search across labels and data element names
      if (search) {
        const q = search.toLowerCase()
        const srcMatch = srcNode.data.label.toLowerCase().includes(q)
          || (srcNode.data.physicalSystem?.toLowerCase().includes(q) ?? false)
        const tgtMatch = tgtNode.data.label.toLowerCase().includes(q)
          || (tgtNode.data.physicalSystem?.toLowerCase().includes(q) ?? false)
        const elMatch = (e.data?.dataElements ?? []).some((el) =>
          el.name.toLowerCase().includes(q)
        )
        if (!srcMatch && !tgtMatch && !elMatch) return false
      }
      return true
    })
  }, [edges, nodeMap, filter, search])

  const handleSelect = useCallback(
    (edgeId: string) => {
      setSelectedEdge(edgeId)
      setSidebarTab('elements')
    },
    [setSelectedEdge, setSidebarTab]
  )

  return (
    <div>
      {/* Artifacts section */}
      <ArtifactsManager />

      <SidebarLabel>All Connections</SidebarLabel>
      <p className="text-[11px] text-[#64748B] mb-3">
        {edges.length} connection{edges.length !== 1 ? 's' : ''} in this diagram. Click to edit.
      </p>

      {/* Filters */}
      <div className="space-y-2 mb-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-1.5 text-xs text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors"
        >
          <option value="">All systems</option>
          {systemOptions.map(([id, info]) => (
            <option key={id} value={id}>
              {info.label}{info.physical ? ` (${info.physical})` : ''}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search connections..."
          className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-1.5 text-xs text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#374A5E]"
        />
      </div>

      {/* Results count */}
      {(filter || search) && (
        <div className="text-[10px] text-[#64748B] mb-2 font-[family-name:var(--font-space-mono)]">
          {filteredEdges.length} of {edges.length} shown
        </div>
      )}

      {/* Connection list */}
      <div className="space-y-1.5">
        {filteredEdges.map((e) => {
          const srcNode = nodeMap.get(e.source)
          const tgtNode = nodeMap.get(e.target)
          if (!srcNode || !tgtNode) return null
          const elements = e.data?.dataElements ?? []
          const isBidi = e.data?.direction === 'bidirectional'
          return (
            <button
              key={e.id}
              onClick={() => handleSelect(e.id)}
              className="w-full text-left bg-[#151E2E] hover:bg-[#1F2C3F] border border-[#374A5E]/30 hover:border-[#374A5E]/60 rounded-lg px-3 py-2 transition-colors group"
            >
              {/* Source → Target */}
              <div className="flex items-center gap-1.5 mb-1">
                <div className="truncate max-w-[110px]">
                  <span className="text-[11px] font-medium text-[#CBD5E1]">
                    {srcNode.data.label}
                  </span>
                  {srcNode.data.physicalSystem && (
                    <span className="block text-[9px] text-[#06B6D4] truncate">
                      {srcNode.data.physicalSystem}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[#64748B] shrink-0">
                  {isBidi ? '↔' : '→'}
                </span>
                <div className="truncate max-w-[110px]">
                  <span className="text-[11px] font-medium text-[#CBD5E1]">
                    {tgtNode.data.label}
                  </span>
                  {tgtNode.data.physicalSystem && (
                    <span className="block text-[9px] text-[#06B6D4] truncate">
                      {tgtNode.data.physicalSystem}
                    </span>
                  )}
                </div>
              </div>
              {/* Data elements summary */}
              {elements.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {elements.slice(0, 3).map((el) => (
                    <span
                      key={el.id}
                      className="text-[9px] bg-[#1A2435] text-[#94A3B8] px-1.5 py-0.5 rounded border border-[#374A5E]/30"
                    >
                      {el.name}
                    </span>
                  ))}
                  {elements.length > 3 && (
                    <span className="text-[9px] text-[#64748B] px-1 py-0.5">
                      +{elements.length - 3} more
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[9px] text-[#374A5E] italic">No data elements</span>
              )}
            </button>
          )
        })}
      </div>

      {edges.length === 0 && (
        <div className="text-center py-8">
          <div className="text-[#374A5E] text-2xl mb-2">&#8646;</div>
          <p className="text-xs text-[#64748B] mb-1">No connections yet</p>
          <p className="text-[10px] text-[#374A5E]">
            Use the Connect button in the toolbar or drag between system handles to create connections.
          </p>
        </div>
      )}

      {edges.length > 0 && filteredEdges.length === 0 && (
        <div className="text-center py-6">
          <p className="text-xs text-[#64748B]">No connections match your filter</p>
        </div>
      )}
    </div>
  )
}

const TECHNICAL_PROPERTY_PRESETS = [
  'Source System ID',
  'Target System ID',
  'Table',
  'Field',
  'Transaction Code',
  'BAPI / API',
  'IDoc Type',
  'Message Type',
  'Middleware Route',
  'Frequency',
  'Volume',
  'Format',
]

// ─── Connection Header (source/target + copy/paste) ────
function ConnectionHeader({ edgeId }: { edgeId: string }) {
  const edges = useDiagramStore((s) => s.edges)
  const nodes = useDiagramStore((s) => s.nodes)
  const updateEdgeEndpoint = useDiagramStore((s) => s.updateEdgeEndpoint)
  const copyEdgeData = useDiagramStore((s) => s.copyEdgeData)
  const pasteEdgeData = useDiagramStore((s) => s.pasteEdgeData)
  const copiedEdgeData = useDiagramStore((s) => s.copiedEdgeData)
  const setSelectedEdge = useDiagramStore((s) => s.setSelectedEdge)

  const edge = edges.find((e) => e.id === edgeId)
  if (!edge) return null

  const srcNode = nodes.find((n) => n.id === edge.source)
  const tgtNode = nodes.find((n) => n.id === edge.target)

  return (
    <div className="mb-4 space-y-3">
      <SidebarLabel>Connection</SidebarLabel>

      {/* Source dropdown */}
      <div>
        <label className="text-[9px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
          Source
        </label>
        <select
          value={edge.source}
          onChange={(e) => updateEdgeEndpoint(edgeId, 'source', e.target.value)}
          className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-1.5 text-xs text-[#F8FAFC] outline-none focus:border-[#06B6D4] transition-colors"
        >
          {nodes.map((n) => (
            <option key={n.id} value={n.id} disabled={n.id === edge.target}>
              {n.data.label}{n.data.physicalSystem ? ` (${n.data.physicalSystem})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Direction indicator */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#64748B]">
          <div className="h-px w-8 bg-[#374A5E]" />
          <span className="text-xs">{edge.data?.direction === 'bidirectional' ? '↕' : '↓'}</span>
          <div className="h-px w-8 bg-[#374A5E]" />
        </div>
      </div>

      {/* Target dropdown */}
      <div>
        <label className="text-[9px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
          Target
        </label>
        <select
          value={edge.target}
          onChange={(e) => updateEdgeEndpoint(edgeId, 'target', e.target.value)}
          className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-1.5 text-xs text-[#F8FAFC] outline-none focus:border-[#06B6D4] transition-colors"
        >
          {nodes.map((n) => (
            <option key={n.id} value={n.id} disabled={n.id === edge.source}>
              {n.data.label}{n.data.physicalSystem ? ` (${n.data.physicalSystem})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Copy / Paste buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => copyEdgeData(edgeId)}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#151E2E] hover:bg-[#1F2C3F] border border-[#374A5E]/40 hover:border-[#06B6D4]/40 rounded-lg px-3 py-1.5 text-xs text-[#94A3B8] hover:text-[#06B6D4] transition-all"
          title="Copy data elements (Ctrl+C)"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          Copy Data
        </button>
        <button
          onClick={() => { pasteEdgeData(edgeId) }}
          disabled={!copiedEdgeData}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#151E2E] hover:bg-[#1F2C3F] border border-[#374A5E]/40 hover:border-[#06B6D4]/40 rounded-lg px-3 py-1.5 text-xs text-[#94A3B8] hover:text-[#06B6D4] transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[#374A5E]/40 disabled:hover:text-[#94A3B8]"
          title="Paste data elements (Ctrl+V)"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M10 2h1.5A1.5 1.5 0 0113 3.5v9a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 12.5v-9A1.5 1.5 0 014.5 2H6" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="6" y="1" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          Paste Data
        </button>
      </div>

      {/* Copied indicator */}
      {copiedEdgeData && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#06B6D4]/5 border border-[#06B6D4]/20 rounded-md">
          <div className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
          <span className="text-[9px] text-[#06B6D4]/80 font-[family-name:var(--font-space-mono)]">
            {copiedEdgeData.dataElements.length} element{copiedEdgeData.dataElements.length !== 1 ? 's' : ''} on clipboard
          </span>
        </div>
      )}

      <div className="border-b border-[#374A5E]/30" />
    </div>
  )
}

// ─── Elements Tab ───────────────────────────────────────
function ElementsTab() {
  const selectedEdgeId = useDiagramStore((s) => s.selectedEdgeId)
  const edges = useDiagramStore((s) => s.edges)
  const addDataElement = useDiagramStore((s) => s.addDataElement)
  const removeDataElement = useDiagramStore((s) => s.removeDataElement)
  const updateDataElement = useDiagramStore((s) => s.updateDataElement)
  const addAttribute = useDiagramStore((s) => s.addAttribute)
  const removeAttribute = useDiagramStore((s) => s.removeAttribute)
  const updateAttribute = useDiagramStore((s) => s.updateAttribute)
  const addTechnicalProperty = useDiagramStore((s) => s.addTechnicalProperty)
  const removeTechnicalProperty = useDiagramStore((s) => s.removeTechnicalProperty)
  const updateTechnicalProperty = useDiagramStore((s) => s.updateTechnicalProperty)
  const addOutputArtifact = useDiagramStore((s) => s.addOutputArtifact)
  const removeOutputArtifact = useDiagramStore((s) => s.removeOutputArtifact)
  const updateOutputArtifact = useDiagramStore((s) => s.updateOutputArtifact)

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<DataElementType>('transaction')
  const [newAttrName, setNewAttrName] = useState<Record<string, string>>({})
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set())

  const toggleProps = useCallback((elementId: string) => {
    setExpandedProps((prev) => {
      const next = new Set(prev)
      if (next.has(elementId)) next.delete(elementId)
      else next.add(elementId)
      return next
    })
  }, [])

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId)

  const handleAdd = useCallback(() => {
    if (!selectedEdgeId || !newName.trim()) return
    addDataElement(selectedEdgeId, {
      name: newName.trim(),
      elementType: newType,
    })
    setNewName('')
  }, [selectedEdgeId, newName, newType, addDataElement])

  const handleAddAttr = useCallback(
    (elementId: string) => {
      if (!selectedEdgeId) return
      const name = (newAttrName[elementId] || '').trim()
      if (!name) return
      addAttribute(selectedEdgeId, elementId, { name })
      setNewAttrName((prev) => ({ ...prev, [elementId]: '' }))
    },
    [selectedEdgeId, newAttrName, addAttribute]
  )

  if (!selectedEdge) {
    return <ConnectionsCatalog />
  }

  const dataElements = selectedEdge.data?.dataElements ?? []

  return (
    <div>
      <ConnectionHeader edgeId={selectedEdge.id} />
      <SidebarLabel>Data Elements</SidebarLabel>
      <p className="text-[11px] text-[#64748B] mb-4">
        Data elements flowing through this connection.
      </p>

      {/* Existing elements */}
      <div className="space-y-2 mb-4">
        {dataElements.map((el) => (
          <div key={el.id} className="bg-[#151E2E] border border-[#374A5E]/40 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input
                  value={el.name}
                  onChange={(e) =>
                    updateDataElement(selectedEdge.id, el.id, {
                      name: e.target.value,
                    })
                  }
                  className="w-full bg-transparent text-xs text-[#CBD5E1] outline-none"
                />
                <div className="text-[9px] text-[#64748B] uppercase tracking-wider font-[family-name:var(--font-space-mono)]">
                  {el.elementType.replace('_', ' ')}
                </div>
              </div>
              <button
                onClick={() => removeDataElement(selectedEdge.id, el.id)}
                className="text-[#64748B] hover:text-red-400 transition-colors shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Process context / value stream */}
            <div className="mt-1.5 ml-0.5">
              <select
                value={el.processContext || ''}
                onChange={(e) =>
                  updateDataElement(selectedEdge.id, el.id, {
                    processContext: e.target.value || undefined,
                  })
                }
                className="w-full bg-[#0F172A] border border-[#374A5E]/30 rounded px-2 py-1 text-[10px] text-[#64748B] outline-none focus:border-[#2563EB] transition-colors"
              >
                <option value="">Value stream...</option>
                {PROCESS_CONTEXTS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Technical Properties — collapsible */}
            <div className="mt-2">
              <button
                onClick={() => toggleProps(el.id)}
                className="flex items-center gap-1.5 w-full text-left group/tp"
              >
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  className={`transition-transform ${expandedProps.has(el.id) ? 'rotate-90' : ''}`}
                >
                  <path d="M3 1l4 4-4 4" stroke="#64748B" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-[9px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] font-bold group-hover/tp:text-[#94A3B8] transition-colors">
                  Technical Details
                </span>
                {(el.technicalProperties?.length ?? 0) > 0 && (
                  <span className="text-[8px] bg-[#2563EB]/20 text-[#2563EB] px-1.5 py-0.5 rounded-full font-medium">
                    {el.technicalProperties!.length}
                  </span>
                )}
              </button>

              {expandedProps.has(el.id) && (
                <div className="mt-1.5 ml-2 pl-2 border-l border-[#2563EB]/30 space-y-1.5">
                  {/* Existing properties */}
                  {(el.technicalProperties || []).map((prop) => (
                    <div key={prop.id} className="flex items-start gap-1.5">
                      <div className="flex-1 min-w-0">
                        <input
                          value={prop.key}
                          onChange={(e) =>
                            updateTechnicalProperty(selectedEdge.id, el.id, prop.id, { key: e.target.value })
                          }
                          className="w-full bg-transparent text-[9px] text-[#64748B] outline-none font-[family-name:var(--font-space-mono)] uppercase tracking-wider"
                        />
                        <input
                          value={prop.value}
                          onChange={(e) =>
                            updateTechnicalProperty(selectedEdge.id, el.id, prop.id, { value: e.target.value })
                          }
                          placeholder="Enter value..."
                          className="w-full bg-transparent text-[11px] text-[#CBD5E1] outline-none placeholder:text-[#374A5E]"
                        />
                      </div>
                      <button
                        onClick={() => removeTechnicalProperty(selectedEdge.id, el.id, prop.id)}
                        className="text-[#374A5E] hover:text-red-400 transition-colors shrink-0 mt-1"
                      >
                        <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  ))}

                  {/* Quick-add preset buttons */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {TECHNICAL_PROPERTY_PRESETS
                      .filter((preset) => !(el.technicalProperties || []).some((p) => p.key === preset))
                      .slice(0, 6)
                      .map((preset) => (
                        <button
                          key={preset}
                          onClick={() => addTechnicalProperty(selectedEdge.id, el.id, { key: preset, value: '' })}
                          className="text-[8px] bg-[#0F172A] text-[#64748B] hover:text-[#CBD5E1] hover:border-[#374A5E] border border-[#374A5E]/30 px-1.5 py-0.5 rounded transition-colors"
                        >
                          + {preset}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Attributes for data objects */}
            {el.elementType === 'data_object' && (
              <div className="mt-2 ml-2 pl-2 border-l border-[#374A5E]/40">
                {(el.attributes || []).map((attr) => (
                  <div key={attr.id} className="flex items-center gap-1.5 mb-1">
                    <input
                      value={attr.name}
                      onChange={(e) =>
                        updateAttribute(selectedEdge.id, el.id, attr.id, {
                          name: e.target.value,
                        })
                      }
                      className="flex-1 bg-transparent text-[11px] text-[#94A3B8] outline-none"
                    />
                    <button
                      onClick={() => removeAttribute(selectedEdge.id, el.id, attr.id)}
                      className="text-[#374A5E] hover:text-red-400 transition-colors shrink-0"
                    >
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-1 mt-1">
                  <input
                    value={newAttrName[el.id] || ''}
                    onChange={(e) =>
                      setNewAttrName((prev) => ({ ...prev, [el.id]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAttr(el.id)}
                    placeholder="Add attribute..."
                    className="flex-1 bg-transparent text-[10px] text-[#64748B] outline-none placeholder:text-[#374A5E]"
                  />
                  <button
                    onClick={() => handleAddAttr(el.id)}
                    className="text-[10px] text-[#2563EB] hover:text-[#3B82F6] font-medium transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {dataElements.length === 0 && (
          <div className="text-xs text-[#374A5E] text-center py-3 border border-dashed border-[#374A5E]/40 rounded-lg">
            No data elements yet
          </div>
        )}
      </div>

      {/* ── Output Artifacts (tag this connection) ─────── */}
      <ArtifactTagger edgeId={selectedEdge.id} taggedIds={selectedEdge.data?.outputArtifactIds ?? []} />

      {/* Add new element */}
      <SidebarLabel>Add Element</SidebarLabel>
      <div className="space-y-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="e.g., Purchase Order"
          className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#374A5E]"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as DataElementType)}
          className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors"
        >
          {ELEMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="w-full bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2 transition-colors"
        >
          Add Element
        </button>
      </div>

      {/* AI Suggestions */}
      <AISuggest />
    </div>
  )
}

// ─── Notes Tab ──────────────────────────────────────────
function NotesTab() {
  const meta = useDiagramStore((s) => s.meta)
  const setNotes = useDiagramStore((s) => s.setNotes)

  return (
    <div className="flex flex-col h-full">
      <SidebarLabel>Diagram Notes</SidebarLabel>
      <p className="text-[11px] text-[#64748B] mb-3">
        Add notes, decisions, and context for this diagram.
      </p>
      <textarea
        value={meta.notes || ''}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Type your notes here...&#10;&#10;e.g., Design decisions, open questions, change history..."
        className="flex-1 min-h-[200px] bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2.5 text-sm text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#374A5E] resize-none leading-relaxed"
      />
      <div className="mt-2 text-[10px] text-[#374A5E] font-[family-name:var(--font-space-mono)]">
        Notes are saved with the diagram
      </div>
    </div>
  )
}

// ─── Shared Components ──────────────────────────────────
function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
        active
          ? 'text-[#06B6D4] border-b-2 border-[#06B6D4]'
          : 'text-[#64748B] hover:text-[#CBD5E1] border-b-2 border-transparent'
      }`}
    >
      {children}
    </button>
  )
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-widest text-[#64748B] font-[family-name:var(--font-space-mono)] font-bold mb-2">
      {children}
    </div>
  )
}
