'use client'

import { useState, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useDiagramStore } from '@/lib/diagram/store'
import {
  SYSTEM_TEMPLATES,
  PROCESS_CONTEXTS,
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
          <div className="bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2 text-sm text-[#64748B]">
            {selectedNode.data.systemType.toUpperCase()}
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

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<DataElementType>('transaction')
  const [newAttrName, setNewAttrName] = useState<Record<string, string>>({})

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
    return (
      <div className="text-center py-12">
        <div className="text-[#374A5E] text-3xl mb-3">&#8646;</div>
        <p className="text-sm text-[#64748B]">Select a data flow (arrow) to manage data elements</p>
      </div>
    )
  }

  const dataElements = selectedEdge.data?.dataElements ?? []

  return (
    <div>
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
