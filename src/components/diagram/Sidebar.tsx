'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useDiagramStore } from '@/lib/diagram/store'
import { useAuth } from '@/lib/supabase/auth-context'
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
function GroupTemplatesSection() {
  const { organization, user } = useAuth()
  const addSystem = useDiagramStore((s) => s.addSystem)
  const addGroup = useDiagramStore((s) => s.addGroup)
  const { screenToFlowPosition } = useReactFlow()
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Load templates when expanded
  useEffect(() => {
    if (!expanded || !organization) return
    setLoading(true)
    import('@/lib/supabase/diagrams').then(({ listGroupTemplates }) =>
      listGroupTemplates(organization.id).then(setTemplates).finally(() => setLoading(false))
    )
  }, [expanded, organization])

  const handleInsert = useCallback(async (template: any) => {
    const pos = screenToFlowPosition({
      x: window.innerWidth / 2 - 250,
      y: window.innerHeight / 2 - 200,
    })
    const td = template.template_data
    // Create group with saved dimensions
    addGroup(td.group.label, pos, td.group.color, td.group.width, td.group.height)

    // Create systems with relative positions
    const newNodeIds: string[] = []
    for (const sys of td.systems) {
      const id = addSystem(
        sys.systemType as any,
        sys.label,
        { x: pos.x + sys.relativeX, y: pos.y + sys.relativeY }
      )
      newNodeIds.push(id)
      // Apply physical system and modules
      if (sys.physicalSystem) {
        useDiagramStore.getState().updateSystemPhysical(id, sys.physicalSystem)
      }
      if (sys.modules?.length) {
        for (const mod of sys.modules as any[]) {
          useDiagramStore.getState().addModule(id, mod.name)
        }
      }
    }

    // Create edges between contained systems and restore data elements
    const store = useDiagramStore.getState()
    for (const edge of td.edges) {
      const sourceId = newNodeIds[edge.sourceIdx]
      const targetId = newNodeIds[edge.targetIdx]
      if (!sourceId || !targetId) continue
      store.onConnect({
        source: sourceId,
        target: targetId,
        sourceHandle: 'right-s2',
        targetHandle: 'left-t1',
      })
      // Apply saved edge data (dataElements, direction, processContext, etc.)
      if (edge.data) {
        const updated = useDiagramStore.getState()
        const newEdge = updated.edges.find(
          (e) => e.source === sourceId && e.target === targetId
        )
        if (newEdge) {
          useDiagramStore.setState({
            edges: updated.edges.map((e) =>
              e.id === newEdge.id ? { ...e, data: { ...e.data, ...edge.data } } : e
            ),
          })
        }
      }
    }
  }, [addGroup, addSystem, screenToFlowPosition])

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this template?')) return
    const { deleteGroupTemplate } = await import('@/lib/supabase/diagrams')
    await deleteGroupTemplate(id)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <div className="mb-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left mb-2"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
          <path d="M3 1l4 4-4 4" stroke="#64748B" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-[10px] uppercase tracking-widest text-[#F97316] font-[family-name:var(--font-space-mono)] font-bold">
          Saved Templates
        </span>
      </button>

      {expanded && (
        <div>
          {loading && (
            <p className="text-[10px] text-[#64748B] py-2">Loading templates...</p>
          )}
          {!loading && templates.length === 0 && (
            <p className="text-[10px] text-[#374A5E] italic py-2">
              No templates yet. Select a group and save it as a template in the Properties tab.
            </p>
          )}
          {!loading && templates.length > 0 && (
            <div className="space-y-1.5">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 bg-[#1F2C3F] hover:bg-[#263448] border border-[#F97316]/20 hover:border-[#F97316]/40 rounded-lg px-3 py-2 transition-colors cursor-pointer"
                >
                  <button
                    onClick={() => handleInsert(t)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-xs font-medium text-[#CBD5E1]">{t.name}</div>
                    <div className="text-[9px] text-[#64748B]">
                      {t.template_data.systems.length} system{t.template_data.systems.length !== 1 ? 's' : ''}
                      {t.template_data.edges.length > 0 && ` · ${t.template_data.edges.length} flow${t.template_data.edges.length !== 1 ? 's' : ''}`}
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleDelete(t.id, e)}
                    className="text-[#374A5E] hover:text-red-400 transition-colors shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PaletteTab() {
  const addSystem = useDiagramStore((s) => s.addSystem)
  const addGroup = useDiagramStore((s) => s.addGroup)
  const setSidebarTab = useDiagramStore((s) => s.setSidebarTab)
  const setSelectedGroup = useDiagramStore((s) => s.setSelectedGroup)
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

  const handleAddGroup = useCallback(() => {
    const pos = screenToFlowPosition({
      x: window.innerWidth / 2 - 250,
      y: window.innerHeight / 2 - 200,
    })
    const id = addGroup('System Group', pos)
    setSelectedGroup(id)
    setSidebarTab('properties')
  }, [addGroup, setSelectedGroup, setSidebarTab, screenToFlowPosition])

  return (
    <div>
      <SidebarLabel>Diagram Settings</SidebarLabel>
      <DiagramSettings />

      {/* Add System Group */}
      <div className="mt-5 mb-5">
        <SidebarLabel>System Groups</SidebarLabel>
        <p className="text-[11px] text-[#64748B] mb-2">
          Create a visual grouping around related systems.
        </p>
        <button
          onClick={handleAddGroup}
          className="w-full flex items-center gap-2 bg-[#1F2C3F] hover:bg-[#263448] border border-dashed border-[#374A5E]/60 hover:border-[#374A5E] rounded-lg px-3 py-2.5 transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold font-[family-name:var(--font-space-mono)] shrink-0 bg-[#374A5E]/20 text-[#64748B] border border-dashed border-[#374A5E]/40">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
              <rect x="3" y="3" width="4" height="4" rx="1" fill="currentColor" opacity="0.4"/>
              <rect x="9" y="5" width="4" height="4" rx="1" fill="currentColor" opacity="0.4"/>
              <rect x="5" y="9" width="4" height="4" rx="1" fill="currentColor" opacity="0.4"/>
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#CBD5E1]">Add Group</div>
            <div className="text-[9px] text-[#64748B]">Visual umbrella for systems</div>
          </div>
        </button>
      </div>

      {/* Reusable Group Templates */}
      <GroupTemplatesSection />

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

// ─── Group Properties ───────────────────────────────────
const GROUP_COLORS = [
  '#374A5E', '#2563EB', '#06B6D4', '#10B981', '#8B5CF6',
  '#F97316', '#EF4444', '#EC4899', '#EAB308', '#14B8A6',
]

function GroupPropertiesTab() {
  const selectedGroupId = useDiagramStore((s) => s.selectedGroupId)
  const groups = useDiagramStore((s) => s.groups)
  const nodes = useDiagramStore((s) => s.nodes)
  const edges = useDiagramStore((s) => s.edges)
  const updateGroupLabel = useDiagramStore((s) => s.updateGroupLabel)
  const updateGroupColor = useDiagramStore((s) => s.updateGroupColor)
  const { user, organization } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [showSave, setShowSave] = useState(false)

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)
  if (!selectedGroup) return null

  // Find systems visually inside this group's bounding box
  // Use the node's center point for overlap detection with generous tolerance
  const groupBounds = {
    x: selectedGroup.position.x,
    y: selectedGroup.position.y,
    w: (selectedGroup.width as number) || (selectedGroup.style?.width as number) || 500,
    h: (selectedGroup.height as number) || (selectedGroup.style?.height as number) || 400,
  }
  const PAD = 40 // tolerance padding
  const containedSystems = nodes.filter((n) => {
    const nw = (n.width as number) || 220
    const nh = (n.height as number) || 80
    const cx = n.position.x + nw / 2
    const cy = n.position.y + nh / 2
    return (
      cx >= groupBounds.x - PAD &&
      cy >= groupBounds.y - PAD &&
      cx <= groupBounds.x + groupBounds.w + PAD &&
      cy <= groupBounds.y + groupBounds.h + PAD
    )
  })
  const containedIds = new Set(containedSystems.map((n) => n.id))

  // Find edges between contained systems
  const containedEdges = edges.filter(
    (e) => containedIds.has(e.source) && containedIds.has(e.target)
  )

  const handleSaveTemplate = useCallback(async () => {
    if (!user || !organization || !templateName.trim()) return
    setSaving(true)
    try {
      const { saveGroupTemplate } = await import('@/lib/supabase/diagrams')
      const systemIdxMap = new Map(containedSystems.map((n, i) => [n.id, i]))
      await saveGroupTemplate(organization.id, user.id, templateName.trim(), null, {
        group: {
          label: selectedGroup.data.label,
          color: selectedGroup.data.color,
          width: groupBounds.w,
          height: groupBounds.h,
        },
        systems: containedSystems.map((n) => ({
          label: n.data.label,
          systemType: n.data.systemType,
          physicalSystem: n.data.physicalSystem,
          modules: n.data.modules,
          relativeX: n.position.x - groupBounds.x,
          relativeY: n.position.y - groupBounds.y,
          width: n.width,
          height: n.height,
        })),
        edges: containedEdges.map((e) => ({
          sourceIdx: systemIdxMap.get(e.source) ?? 0,
          targetIdx: systemIdxMap.get(e.target) ?? 0,
          data: e.data,
        })),
      })
      // Mark the group as a saved template
      useDiagramStore.setState({
        groups: useDiagramStore.getState().groups.map((g) =>
          g.id === selectedGroupId
            ? { ...g, data: { ...g.data, isTemplate: true, templateName: templateName.trim() } }
            : g
        ),
      })
      setSaved(true)
      setTimeout(() => { setSaved(false); setShowSave(false) }, 2000)
    } catch (err) {
      console.error('Failed to save template:', err)
    } finally {
      setSaving(false)
    }
  }, [user, organization, templateName, selectedGroup, containedSystems, containedEdges, groupBounds])

  return (
    <div>
      <SidebarLabel>Group Properties</SidebarLabel>
      <div className="space-y-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
            Group Name
          </label>
          <input
            value={selectedGroup.data.label}
            onChange={(e) => updateGroupLabel(selectedGroup.id, e.target.value)}
            className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => updateGroupColor(selectedGroup.id, c)}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-md border-2 transition-all ${
                  selectedGroup.data.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-110'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Contained systems summary */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
            Systems in Group
          </label>
          {containedSystems.length > 0 ? (
            <div className="space-y-1">
              {containedSystems.map((n) => (
                <div key={n.id} className="text-[10px] text-[#94A3B8] bg-[#151E2E] rounded px-2 py-1 border border-[#374A5E]/20">
                  {n.data.label}
                  {n.data.physicalSystem && <span className="text-[#06B6D4] ml-1">({n.data.physicalSystem})</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-[#374A5E] italic">
              No systems inside this group yet. Drag nodes into the group area.
            </p>
          )}
        </div>

        {/* Save as reusable template */}
        {containedSystems.length > 0 && (
          <div className="pt-2 border-t border-[#374A5E]/30">
            {!showSave ? (
              <button
                onClick={() => { setShowSave(true); setTemplateName(selectedGroup.data.label) }}
                className="flex items-center gap-2 w-full text-left text-[11px] text-[#F97316] hover:text-[#FB923C] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M12.5 14H3.5a1 1 0 01-1-1V3a1 1 0 011-1h7l3 3v8a1 1 0 01-1 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 14v-4h6v4M5 2v3h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Save as Reusable Template
              </button>
            ) : (
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-[#F97316] font-[family-name:var(--font-space-mono)] block">
                  Template Name
                </label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., SAP ECC Integration Stack"
                  className="w-full bg-[#151E2E] border border-[#F97316]/40 rounded-lg px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#F97316] transition-colors placeholder:text-[#374A5E]"
                />
                <p className="text-[9px] text-[#64748B]">
                  Saves {containedSystems.length} system{containedSystems.length !== 1 ? 's' : ''} and {containedEdges.length} connection{containedEdges.length !== 1 ? 's' : ''} as a reusable template for your organization.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={saving || !templateName.trim()}
                    className="flex-1 bg-[#F97316] hover:bg-[#FB923C] disabled:opacity-30 text-white text-xs font-medium py-2 rounded-lg transition-colors"
                  >
                    {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Template'}
                  </button>
                  <button
                    onClick={() => setShowSave(false)}
                    className="text-xs text-[#64748B] hover:text-[#CBD5E1] px-3 py-2 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Module Editor ──────────────────────────────────────
function ModuleEditor({ nodeId }: { nodeId: string }) {
  const nodes = useDiagramStore((s) => s.nodes)
  const addModule = useDiagramStore((s) => s.addModule)
  const removeModule = useDiagramStore((s) => s.removeModule)
  const updateModule = useDiagramStore((s) => s.updateModule)
  const reorderModules = useDiagramStore((s) => s.reorderModules)
  const [newModuleName, setNewModuleName] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const modules = node.data.modules || []

  const handleAdd = () => {
    if (!newModuleName.trim()) return
    addModule(nodeId, { name: newModuleName.trim() })
    setNewModuleName('')
  }

  return (
    <div className="mt-4">
      <SidebarLabel>Modules</SidebarLabel>
      <p className="text-[11px] text-[#64748B] mb-2">
        Sub-components within this system (e.g., MM, FI, SD).
      </p>

      {/* Module list */}
      <div className="space-y-1 mb-2">
        {modules.map((mod, idx) => (
          <div
            key={mod.id}
            draggable
            onDragStart={(e) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx) }}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) reorderModules(nodeId, dragIdx, idx); setDragIdx(null); setDragOverIdx(null) }}
            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
            className={`flex items-center gap-1.5 bg-[#151E2E] border rounded-lg px-2 py-1.5 transition-all ${
              dragIdx === idx ? 'opacity-40 border-[#06B6D4]/40' : dragOverIdx === idx ? 'border-[#06B6D4]' : 'border-[#374A5E]/40'
            }`}
          >
            <div className="cursor-grab active:cursor-grabbing text-[#374A5E] hover:text-[#64748B] shrink-0">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
                <circle cx="2" cy="1.5" r="1"/><circle cx="6" cy="1.5" r="1"/>
                <circle cx="2" cy="6" r="1"/><circle cx="6" cy="6" r="1"/>
                <circle cx="2" cy="10.5" r="1"/><circle cx="6" cy="10.5" r="1"/>
              </svg>
            </div>
            <input
              value={mod.name}
              onChange={(e) => updateModule(nodeId, mod.id, { name: e.target.value })}
              className="flex-1 bg-transparent text-xs text-[#CBD5E1] outline-none min-w-0"
            />
            <button
              onClick={() => removeModule(nodeId, mod.id)}
              className="text-[#374A5E] hover:text-red-400 transition-colors shrink-0"
            >
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        ))}
      </div>

      {/* Add module */}
      <div className="flex items-center gap-2">
        <input
          value={newModuleName}
          onChange={(e) => setNewModuleName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="e.g., MM, FI, SD..."
          className="flex-1 bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-1.5 text-xs text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#374A5E]"
        />
        <button
          onClick={handleAdd}
          disabled={!newModuleName.trim()}
          className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-30 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ─── Properties Tab ─────────────────────────────────────
function PropertiesTab() {
  const selectedNodeId = useDiagramStore((s) => s.selectedNodeId)
  const selectedGroupId = useDiagramStore((s) => s.selectedGroupId)
  const nodes = useDiagramStore((s) => s.nodes)
  const updateSystemLabel = useDiagramStore((s) => s.updateSystemLabel)
  const updateSystemPhysical = useDiagramStore((s) => s.updateSystemPhysical)

  // Show group properties if a group is selected
  if (selectedGroupId) return <GroupPropertiesTab />

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

      {/* Module Editor */}
      <ModuleEditor nodeId={selectedNode.id} />
    </div>
  )
}

// ─── Copy Data From Sibling Connection ─────────────────
function CopyFromSibling({ edgeId, sourceId, targetId }: { edgeId: string; sourceId: string; targetId: string }) {
  const edges = useDiagramStore((s) => s.edges)
  const nodes = useDiagramStore((s) => s.nodes)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Find sibling connections: same source OR same target, excluding self
  const siblings = useMemo(() => {
    return edges.filter((e) => {
      if (e.id === edgeId) return false
      if ((e.data?.dataElements?.length ?? 0) === 0) return false
      return e.source === sourceId || e.target === sourceId || e.source === targetId || e.target === targetId
    })
  }, [edges, edgeId, sourceId, targetId])

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const handleCopy = useCallback((fromEdgeId: string) => {
    const fromEdge = edges.find((e) => e.id === fromEdgeId)
    if (!fromEdge?.data?.dataElements) return
    const store = useDiagramStore.getState()
    // Clone data elements with new IDs
    const clonedElements = fromEdge.data.dataElements.map((el) => ({
      ...el,
      id: Math.random().toString(36).substring(2, 10),
      attributes: el.attributes?.map((a) => ({ ...a, id: Math.random().toString(36).substring(2, 10) })),
      technicalProperties: el.technicalProperties?.map((p) => ({ ...p, id: Math.random().toString(36).substring(2, 10) })),
    }))
    store.pushUndo()
    useDiagramStore.setState({
      edges: store.edges.map((e) =>
        e.id === edgeId && e.data
          ? { ...e, data: { ...e.data, dataElements: [...e.data.dataElements, ...clonedElements] } }
          : e
      ),
    })
    setCopied(true)
    setTimeout(() => { setCopied(false); setOpen(false) }, 1200)
  }, [edges, edgeId])

  if (siblings.length === 0) return null

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] text-[#64748B] hover:text-[#CBD5E1] transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M6 4V2.5A1.5 1.5 0 017.5 1h5A1.5 1.5 0 0114 2.5v5a1.5 1.5 0 01-1.5 1.5H11" stroke="currentColor" strokeWidth="1.3"/>
        </svg>
        {copied ? 'Copied!' : 'Copy data elements from another connection'}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="mt-2 space-y-1">
          {siblings.map((e) => {
            const src = nodeMap.get(e.source)
            const tgt = nodeMap.get(e.target)
            const elCount = e.data?.dataElements?.length ?? 0
            return (
              <button
                key={e.id}
                onClick={() => handleCopy(e.id)}
                className="flex items-center gap-2 w-full text-left bg-[#151E2E] hover:bg-[#1F2C3F] border border-[#374A5E]/30 hover:border-[#374A5E]/60 rounded-lg px-3 py-2 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-[#CBD5E1] truncate max-w-[80px]">{src?.data.label ?? '?'}</span>
                    <span className="text-[#64748B]">→</span>
                    <span className="text-[#CBD5E1] truncate max-w-[80px]">{tgt?.data.label ?? '?'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(e.data?.dataElements ?? []).slice(0, 3).map((el) => (
                      <span key={el.id} className="text-[8px] bg-[#0F172A] text-[#94A3B8] px-1 py-0.5 rounded border border-[#374A5E]/20">
                        {el.name}
                      </span>
                    ))}
                    {elCount > 3 && (
                      <span className="text-[8px] text-[#64748B]">+{elCount - 3}</span>
                    )}
                  </div>
                </div>
                <span className="text-[9px] text-[#2563EB] font-medium shrink-0">Copy</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Artifact Tagger (shown on edge edit) ──────────────
function ArtifactTagger({ edgeId, taggedIds, artifactSequences }: { edgeId: string; taggedIds: string[]; artifactSequences?: Record<string, number> }) {
  const artifacts = useDiagramStore((s) => s.artifacts)
  const toggleEdgeArtifact = useDiagramStore((s) => s.toggleEdgeArtifact)
  const updateEdgeArtifactSequence = useDiagramStore((s) => s.updateEdgeArtifactSequence)

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
        Tag artifacts and set step order for each.
      </p>
      <div className="space-y-1">
        {artifacts.map((art) => {
          const isTagged = taggedIds.includes(art.id)
          const seq = artifactSequences?.[art.id]
          return (
            <div
              key={art.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                isTagged
                  ? 'bg-[#F97316]/10 border border-[#F97316]/40'
                  : 'bg-[#151E2E] border border-[#374A5E]/30 hover:border-[#374A5E]/60'
              }`}
            >
              <button
                onClick={() => toggleEdgeArtifact(edgeId, art.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                  isTagged ? 'border-[#F97316] bg-[#F97316]' : 'border-[#374A5E]'
                }`}>
                  {isTagged && (
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className={`text-xs transition-colors truncate ${isTagged ? 'text-[#CBD5E1] font-medium' : 'text-[#64748B]'}`}>
                  {art.name}
                </span>
              </button>
              {isTagged && (
                <input
                  type="number"
                  min={1}
                  value={seq ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                    updateEdgeArtifactSequence(edgeId, art.id, val && val > 0 ? val : undefined)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Step"
                  title="Step sequence for this artifact"
                  className="w-12 bg-[#0F172A] border border-[#374A5E]/50 rounded px-1.5 py-1 text-center text-[10px] text-[#F8FAFC] font-bold font-[family-name:var(--font-space-mono)] outline-none focus:border-[#F97316] transition-colors placeholder:text-[#374A5E] placeholder:font-normal shrink-0"
                />
              )}
            </div>
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

  // Count tagged edges + elements per artifact
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of edges) {
      for (const aid of e.data?.outputArtifactIds ?? []) {
        counts.set(aid, (counts.get(aid) ?? 0) + 1)
      }
      for (const el of e.data?.dataElements ?? []) {
        for (const aid of el.outputArtifactIds ?? []) {
          counts.set(aid, (counts.get(aid) ?? 0) + 1)
        }
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
  const reorderDataElements = useDiagramStore((s) => s.reorderDataElements)
  const toggleElementArtifact = useDiagramStore((s) => s.toggleElementArtifact)
  const artifacts = useDiagramStore((s) => s.artifacts)
  const addOutputArtifact = useDiagramStore((s) => s.addOutputArtifact)
  const removeOutputArtifact = useDiagramStore((s) => s.removeOutputArtifact)
  const updateOutputArtifact = useDiagramStore((s) => s.updateOutputArtifact)

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<DataElementType>('transaction')
  const [newAttrName, setNewAttrName] = useState<Record<string, string>>({})
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [showAllElements, setShowAllElements] = useState(false)

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
  const SIDEBAR_VISIBLE_LIMIT = 10
  const hasSidebarOverflow = dataElements.length > SIDEBAR_VISIBLE_LIMIT
  const visibleDataElements = showAllElements ? dataElements : dataElements.slice(0, SIDEBAR_VISIBLE_LIMIT)
  const sidebarHiddenCount = dataElements.length - SIDEBAR_VISIBLE_LIMIT

  return (
    <div>
      <ConnectionHeader edgeId={selectedEdge.id} />

      {/* Sequence is now per-artifact — shown in the artifact tagger below */}

      <SidebarLabel>Data Elements</SidebarLabel>
      <p className="text-[11px] text-[#64748B] mb-4">
        Data elements flowing through this connection.
      </p>

      {/* Existing elements (drag to reorder) */}
      <div className="space-y-2 mb-4">
        {visibleDataElements.map((el, idx) => (
          <div
            key={el.id}
            draggable
            onDragStart={(e) => {
              setDragIndex(idx)
              e.dataTransfer.effectAllowed = 'move'
              // Make drag image semi-transparent
              if (e.currentTarget instanceof HTMLElement) {
                e.dataTransfer.setDragImage(e.currentTarget, 0, 0)
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDragOverIndex(idx)
            }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => {
              e.preventDefault()
              if (dragIndex !== null && dragIndex !== idx) {
                reorderDataElements(selectedEdge.id, dragIndex, idx)
              }
              setDragIndex(null)
              setDragOverIndex(null)
            }}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
            className={`bg-[#151E2E] border rounded-lg px-3 py-2 transition-all ${
              dragIndex === idx
                ? 'opacity-40 border-[#06B6D4]/40'
                : dragOverIndex === idx
                  ? 'border-[#06B6D4] shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                  : 'border-[#374A5E]/40'
            }`}
          >
            <div className="flex items-center gap-2">
              {/* Drag handle */}
              <div className="cursor-grab active:cursor-grabbing text-[#374A5E] hover:text-[#64748B] transition-colors shrink-0" title="Drag to reorder">
                <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                  <circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
                  <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
                  <circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
                </svg>
              </div>
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

            {/* Per-element artifact tags */}
            {artifacts.length > 0 && (
              <div className="mt-2">
                <div className="text-[9px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] font-bold mb-1">
                  Artifacts
                </div>
                <div className="flex flex-wrap gap-1">
                  {artifacts.map((art) => {
                    const isTagged = (el.outputArtifactIds ?? []).includes(art.id)
                    return (
                      <button
                        key={art.id}
                        onClick={() => toggleElementArtifact(selectedEdge.id, el.id, art.id)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-all ${
                          isTagged
                            ? 'bg-[#F97316]/15 border border-[#F97316]/40 text-[#FB923C] font-medium'
                            : 'bg-[#151E2E] border border-[#374A5E]/30 text-[#64748B] hover:border-[#F97316]/30 hover:text-[#F97316]/70'
                        }`}
                      >
                        {isTagged && (
                          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {art.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
        {hasSidebarOverflow && (
          <button
            onClick={() => setShowAllElements(!showAllElements)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-[#374A5E]/40 hover:border-[#06B6D4]/40 text-[#64748B] hover:text-[#06B6D4] transition-all"
          >
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={`transition-transform ${showAllElements ? 'rotate-180' : ''}`}
            >
              <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[10px] font-medium font-[family-name:var(--font-space-mono)]">
              {showAllElements ? 'Show less' : `Show ${sidebarHiddenCount} more element${sidebarHiddenCount !== 1 ? 's' : ''}`}
            </span>
          </button>
        )}
        {dataElements.length === 0 && (
          <div className="text-xs text-[#374A5E] text-center py-3 border border-dashed border-[#374A5E]/40 rounded-lg">
            No data elements yet
          </div>
        )}
      </div>

      {/* ── Output Artifacts (tag this connection) ─────── */}
      <ArtifactTagger edgeId={selectedEdge.id} taggedIds={selectedEdge.data?.outputArtifactIds ?? []} artifactSequences={selectedEdge.data?.artifactSequences} />

      {/* Copy data elements from sibling connection */}
      <CopyFromSibling edgeId={selectedEdge.id} sourceId={selectedEdge.source} targetId={selectedEdge.target} />

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
