'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  GripVertical,
  Layers,
  Save,
  Square,
  Workflow,
  X,
} from 'lucide-react'
import { Button, EmptyState, LoadingState } from '@/components/common'
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
    <div className="w-[300px] bg-white border-l border-border flex flex-col shrink-0 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border">
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
      // Apply saved dimensions
      if (sys.width || sys.height) {
        useDiagramStore.setState({
          nodes: useDiagramStore.getState().nodes.map((n) =>
            n.id === id
              ? { ...n, width: sys.width, height: sys.height, style: { ...n.style, width: sys.width, height: sys.height } }
              : n
          ),
        })
      }
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
        sourceHandle: edge.sourceHandle || 'right-s2',
        targetHandle: edge.targetHandle || 'left-t1',
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
        <ChevronRight size={10} className={`text-text-tertiary transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-m12-ember">
          Saved Templates
        </span>
      </button>

      {expanded && (
        <div>
          {loading && (
            <LoadingState variant="inline" compact label="Loading templates..." />
          )}
          {!loading && templates.length === 0 && (
            <p className="text-[10px] text-text-tertiary italic py-2">
              No templates yet. Select a group and save it as a template in the Properties tab.
            </p>
          )}
          {!loading && templates.length > 0 && (
            <div className="space-y-1.5">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 bg-white hover:bg-surface-muted border border-m12-ember/20 hover:border-m12-ember/40 rounded-lg px-3 py-2 transition-colors cursor-pointer"
                >
                  <button
                    onClick={() => handleInsert(t)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-body-sm font-medium text-text-secondary">{t.name}</div>
                    <div className="text-[10px] text-text-tertiary">
                      {t.template_data.systems.length} system{t.template_data.systems.length !== 1 ? 's' : ''}
                      {t.template_data.edges.length > 0 && ` · ${t.template_data.edges.length} flow${t.template_data.edges.length !== 1 ? 's' : ''}`}
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleDelete(t.id, e)}
                    title="Delete template"
                    className="text-text-tertiary hover:text-red-600 transition-colors shrink-0"
                  >
                    <X size={12} />
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
        <p className="text-[11px] text-text-tertiary mb-2">
          Create a visual grouping around related systems.
        </p>
        <button
          onClick={handleAddGroup}
          className="w-full flex items-center gap-2 bg-white hover:bg-surface-muted border border-dashed border-border hover:border-border-strong rounded-lg px-3 py-2.5 transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-surface-muted text-text-tertiary border border-dashed border-border">
            <Layers size={14} />
          </div>
          <div className="min-w-0">
            <div className="text-body-sm font-medium text-text-secondary">Add Group</div>
            <div className="text-[10px] text-text-tertiary">Visual umbrella for systems</div>
          </div>
        </button>
      </div>

      {/* Reusable Group Templates */}
      <GroupTemplatesSection />

      <SidebarLabel>Add System</SidebarLabel>
      <p className="text-[11px] text-text-tertiary mb-3">
        Click to add a system to the canvas.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SYSTEM_TEMPLATES.map((t) => (
          <button
            key={t.type}
            onClick={() => handleAdd(t)}
            className="flex items-center gap-2 bg-white hover:bg-surface-muted border border-border hover:border-border-strong rounded-lg px-3 py-2.5 transition-colors text-left"
          >
            <div
              style={{ backgroundColor: t.color + '20', color: t.color }}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold font-mono shrink-0"
            >
              {t.label.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-body-sm font-medium text-text-secondary truncate">
                {t.label}
              </div>
              <div className="text-[10px] text-text-tertiary truncate">
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
        <label className="text-label uppercase text-text-secondary block mb-1">
          Title
        </label>
        <input
          value={meta.title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors"
        />
      </div>
      <div>
        <label className="text-label uppercase text-text-secondary block mb-1">
          Process Context
        </label>
        <select
          value={meta.processContext || ''}
          onChange={(e) => setProcessContext(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors"
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
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
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
          <label className="text-label uppercase text-text-secondary block mb-1">
            Group Name
          </label>
          <input
            value={selectedGroup.data.label}
            onChange={(e) => updateGroupLabel(selectedGroup.id, e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-label uppercase text-text-secondary block mb-1">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => updateGroupColor(selectedGroup.id, c)}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-md border-2 transition-all ${
                  selectedGroup.data.color === c ? 'border-text-primary scale-110' : 'border-transparent hover:scale-110'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Contained systems summary */}
        <div>
          <label className="text-label uppercase text-text-secondary block mb-1">
            Systems in Group
          </label>
          {containedSystems.length > 0 ? (
            <div className="space-y-1">
              {containedSystems.map((n) => (
                <div key={n.id} className="text-[10px] text-text-secondary bg-surface-muted rounded px-2 py-1 border border-border">
                  {n.data.label}
                  {n.data.physicalSystem && <span className="text-brand-600 font-mono ml-1">({n.data.physicalSystem})</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-text-tertiary italic">
              No systems inside this group yet. Drag nodes into the group area.
            </p>
          )}
        </div>

        {/* Save as reusable template */}
        {containedSystems.length > 0 && (
          <div className="pt-2 border-t border-border">
            {!showSave ? (
              <button
                onClick={() => { setShowSave(true); setTemplateName(selectedGroup.data.label) }}
                className="flex items-center gap-2 w-full text-left text-[11px] font-medium text-m12-ember hover:text-m12-flame transition-colors"
              >
                <Save size={14} />
                Save as Reusable Template
              </button>
            ) : (
              <div className="space-y-2">
                <label className="text-label uppercase text-m12-ember block">
                  Template Name
                </label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., SAP ECC Integration Stack"
                  className="w-full h-9 px-3 rounded-lg border border-m12-ember/40 bg-surface-input text-body-sm focus:ring-2 focus:ring-m12-ember/30 focus:border-m12-ember focus:outline-none transition-colors"
                />
                <p className="text-[10px] text-text-tertiary">
                  Saves {containedSystems.length} system{containedSystems.length !== 1 ? 's' : ''} and {containedEdges.length} connection{containedEdges.length !== 1 ? 's' : ''} as a reusable template for your organization.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={saving || !templateName.trim()}
                    className="flex-1 bg-m12-ember hover:bg-m12-flame disabled:opacity-30 text-white text-[12px] font-medium py-2 rounded-lg transition-colors"
                  >
                    {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Template'}
                  </button>
                  <Button variant="ghost" size="md" onClick={() => setShowSave(false)}>
                    Cancel
                  </Button>
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
      <p className="text-[11px] text-text-tertiary mb-2">
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
            className={`flex items-center gap-1.5 bg-surface-muted border rounded-lg px-2 py-1.5 transition-all ${
              dragIdx === idx ? 'opacity-40 border-brand-300' : dragOverIdx === idx ? 'border-brand-500' : 'border-border'
            }`}
          >
            <div className="cursor-grab active:cursor-grabbing text-text-tertiary hover:text-text-secondary shrink-0">
              <GripVertical size={12} />
            </div>
            <input
              value={mod.name}
              onChange={(e) => updateModule(nodeId, mod.id, { name: e.target.value })}
              aria-label="Module name"
              className="flex-1 bg-transparent text-body-sm text-text-secondary outline-none min-w-0"
            />
            <button
              onClick={() => removeModule(nodeId, mod.id)}
              title="Remove module"
              className="text-text-tertiary hover:text-red-600 transition-colors shrink-0"
            >
              <X size={10} />
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
          className="flex-1 h-8 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors"
        />
        <Button
          variant="primary"
          size="sm"
          disabled={!newModuleName.trim()}
          onClick={handleAdd}
        >
          Add
        </Button>
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
      <EmptyState
        variant="inline"
        icon={<Square size={28} />}
        title="No system selected"
        description="Select a system node to view properties"
      />
    )
  }

  return (
    <div>
      <SidebarLabel>System Properties</SidebarLabel>
      <div className="space-y-3">
        <div>
          <label className="text-label uppercase text-text-secondary block mb-1">
            Name
          </label>
          <input
            value={selectedNode.data.label}
            onChange={(e) => updateSystemLabel(selectedNode.id, e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-label uppercase text-text-secondary block mb-1">
            Physical System
          </label>
          <input
            value={selectedNode.data.physicalSystem || ''}
            onChange={(e) => updateSystemPhysical(selectedNode.id, e.target.value)}
            placeholder="e.g., SAP S/4HANA, Oracle PeopleSoft"
            className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-label uppercase text-text-secondary block mb-1">
            Logical Type
          </label>
          <div className="bg-surface-muted border border-border rounded-lg px-3 py-2">
            <div className="text-body-sm text-text-secondary font-mono">
              {selectedNode.data.systemType.toUpperCase()}
            </div>
            <div className="text-[10px] text-text-tertiary mt-0.5">
              {SYSTEM_TEMPLATES.find((t) => t.type === selectedNode.data.systemType)?.description ?? ''}
            </div>
          </div>
        </div>
        <div>
          <label className="text-label uppercase text-text-secondary block mb-1">
            Node ID
          </label>
          <div className="bg-surface-muted border border-border rounded-lg px-3 py-2 text-[10px] text-text-tertiary font-mono truncate">
            {selectedNode.id}
          </div>
        </div>
      </div>

      {/* Module Editor */}
      <ModuleEditor nodeId={selectedNode.id} />

      {/* Duplicate System */}
      <div className="mt-5 pt-4 border-t border-border">
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          icon={<Copy size={12} />}
          onClick={() => {
            useDiagramStore.getState().copyNode(selectedNode.id)
            useDiagramStore.getState().pasteNode()
          }}
        >
          Duplicate System
        </Button>
      </div>
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
        className="flex items-center gap-1.5 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
      >
        <Copy size={12} />
        {copied ? 'Copied!' : 'Copy data elements from another connection'}
        <ChevronDown size={8} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
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
                className="flex items-center gap-2 w-full text-left bg-white hover:bg-surface-muted border border-border hover:border-border-strong rounded-lg px-3 py-2 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-text-secondary truncate max-w-[80px]">{src?.data.label ?? '?'}</span>
                    <span className="text-text-tertiary">→</span>
                    <span className="text-text-secondary truncate max-w-[80px]">{tgt?.data.label ?? '?'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(e.data?.dataElements ?? []).slice(0, 3).map((el) => (
                      <span key={el.id} className="text-[10px] bg-surface-muted text-text-tertiary px-1 py-0.5 rounded border border-border">
                        {el.name}
                      </span>
                    ))}
                    {elCount > 3 && (
                      <span className="text-[10px] text-text-tertiary">+{elCount - 3}</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-brand-600 font-medium shrink-0">Copy</span>
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
        <p className="text-[10px] text-text-tertiary italic">
          No artifacts defined. Add them in the Data tab (click canvas first).
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4">
      <SidebarLabel>Output Artifacts</SidebarLabel>
      <p className="text-[11px] text-text-tertiary mb-2">
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
                  ? 'bg-m12-ember/10 border border-m12-ember/40'
                  : 'bg-white border border-border hover:border-border-strong'
              }`}
            >
              <button
                onClick={() => toggleEdgeArtifact(edgeId, art.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                  isTagged ? 'border-m12-ember bg-m12-ember' : 'border-border-strong'
                }`}>
                  {isTagged && (
                    <Check size={9} strokeWidth={3} className="text-white" />
                  )}
                </div>
                <span className={`text-body-sm transition-colors truncate ${isTagged ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
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
                  className="w-12 px-1.5 py-1 rounded border border-border bg-surface-input text-center text-[10px] text-text-primary font-bold font-mono focus:border-m12-ember focus:outline-none transition-colors placeholder:font-normal shrink-0"
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
      <p className="text-[11px] text-text-tertiary mb-3">
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
                  ? 'bg-m12-ember/10 border border-m12-ember/40 shadow-card'
                  : 'bg-white border border-border hover:border-m12-ember/30'
              }`}
            >
              <button
                onClick={() => setSpotlightArtifact(isActive ? null : art.id)}
                title={isActive ? 'Clear spotlight' : 'Spotlight this artifact'}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 transition-colors ${isActive ? 'bg-m12-ember' : 'bg-m12-ember/40'}`} />
                <div className="flex-1 min-w-0">
                  <input
                    value={art.name}
                    onChange={(e) => { e.stopPropagation(); updateArtifact(art.id, { name: e.target.value }) }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Artifact name"
                    className="w-full bg-transparent text-body-sm text-text-secondary outline-none font-medium"
                  />
                  <div className="flex items-center gap-2">
                    {count > 0 && (
                      <span className="text-[10px] text-m12-ember/70 font-mono">
                        {count} flow{count !== 1 ? 's' : ''}
                      </span>
                    )}
                    {count === 0 && (
                      <span className="text-[10px] text-text-tertiary italic">untagged</span>
                    )}
                  </div>
                </div>
              </button>
              <button
                onClick={() => { if (isActive) setSpotlightArtifact(null); removeArtifact(art.id) }}
                title="Remove artifact"
                className="text-text-tertiary hover:text-red-600 transition-colors shrink-0"
              >
                <X size={12} />
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
          className="flex-1 h-8 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-m12-ember/30 focus:border-m12-ember focus:outline-none transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="bg-m12-ember hover:bg-m12-flame disabled:opacity-30 text-white text-[12px] font-medium h-8 px-3 rounded-lg transition-colors"
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
              className="text-[10px] bg-m12-ember/5 text-m12-ember/70 hover:text-m12-ember border border-m12-ember/15 hover:border-m12-ember/30 px-1.5 py-0.5 rounded transition-colors"
            >
              + {preset}
            </button>
          ))}
        </div>
      )}

      {/* Active spotlight banner */}
      {spotlightArtifactId && (
        <div className="mt-3 flex items-center gap-2 bg-m12-ember/10 border border-m12-ember/30 rounded-lg px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-m12-ember animate-pulse" />
          <span className="text-[10px] text-m12-ember font-medium flex-1">
            Spotlighting: {artifacts.find((a) => a.id === spotlightArtifactId)?.name}
          </span>
          <button
            onClick={() => setSpotlightArtifact(null)}
            className="text-[10px] text-text-secondary hover:text-text-primary transition-colors"
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
      <p className="text-[11px] text-text-tertiary mb-3">
        {edges.length} connection{edges.length !== 1 ? 's' : ''} in this diagram. Click to edit.
      </p>

      {/* Filters */}
      <div className="space-y-2 mb-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full h-8 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors"
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
          className="w-full h-8 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors"
        />
      </div>

      {/* Results count */}
      {(filter || search) && (
        <div className="text-[10px] text-text-tertiary mb-2 font-mono">
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
              className="w-full text-left bg-white hover:bg-surface-muted border border-border hover:border-border-strong rounded-lg px-3 py-2 transition-colors group"
            >
              {/* Source → Target */}
              <div className="flex items-center gap-1.5 mb-1">
                <div className="truncate max-w-[110px]">
                  <span className="text-[11px] font-medium text-text-secondary">
                    {srcNode.data.label}
                  </span>
                  {srcNode.data.physicalSystem && (
                    <span className="block text-[10px] text-brand-600 font-mono truncate">
                      {srcNode.data.physicalSystem}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-tertiary shrink-0">
                  {isBidi ? '↔' : '→'}
                </span>
                <div className="truncate max-w-[110px]">
                  <span className="text-[11px] font-medium text-text-secondary">
                    {tgtNode.data.label}
                  </span>
                  {tgtNode.data.physicalSystem && (
                    <span className="block text-[10px] text-brand-600 font-mono truncate">
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
                      className="text-[10px] bg-surface-muted text-text-tertiary px-1.5 py-0.5 rounded border border-border"
                    >
                      {el.name}
                    </span>
                  ))}
                  {elements.length > 3 && (
                    <span className="text-[10px] text-text-tertiary px-1 py-0.5">
                      +{elements.length - 3} more
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[10px] text-text-tertiary italic">No data elements</span>
              )}
            </button>
          )
        })}
      </div>

      {edges.length === 0 && (
        <EmptyState
          variant="dashed"
          compact
          icon={<Workflow size={24} />}
          title="No connections yet"
          description="Use the Connect button in the toolbar or drag between system handles to create connections."
        />
      )}

      {edges.length > 0 && filteredEdges.length === 0 && (
        <div className="text-center py-6">
          <p className="text-body-sm text-text-tertiary">No connections match your filter</p>
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
  const groups = useDiagramStore((s) => s.groups)
  const updateEdgeEndpoint = useDiagramStore((s) => s.updateEdgeEndpoint)
  const reverseEdge = useDiagramStore((s) => s.reverseEdge)
  const copyEdgeData = useDiagramStore((s) => s.copyEdgeData)
  const pasteEdgeData = useDiagramStore((s) => s.pasteEdgeData)
  const copiedEdgeData = useDiagramStore((s) => s.copiedEdgeData)
  const setSelectedEdge = useDiagramStore((s) => s.setSelectedEdge)

  const edge = edges.find((e) => e.id === edgeId)
  if (!edge) return null

  const allEndpoints = [...nodes as any[], ...groups]
  const srcNode = allEndpoints.find((n: any) => n.id === edge.source)
  const tgtNode = allEndpoints.find((n: any) => n.id === edge.target)

  return (
    <div className="mb-4 space-y-3">
      <SidebarLabel>Connection</SidebarLabel>

      {/* Source dropdown */}
      <div>
        <label className="text-label uppercase text-text-secondary block mb-1">
          Source
        </label>
        <select
          value={edge.source}
          onChange={(e) => updateEdgeEndpoint(edgeId, 'source', e.target.value)}
          className="w-full h-8 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors"
        >
          {nodes.map((n) => (
            <option key={n.id} value={n.id} disabled={n.id === edge.target}>
              {n.data.label}{n.data.physicalSystem ? ` (${n.data.physicalSystem})` : ''}
            </option>
          ))}
          {groups.map((g) => (
            <option key={g.id} value={g.id} disabled={g.id === edge.target}>
              {g.data.label} (Group)
            </option>
          ))}
        </select>
      </div>

      {/* Direction indicator + reverse button */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 text-text-tertiary">
          <div className="h-px w-6 bg-border" />
          <button
            onClick={() => reverseEdge(edgeId)}
            title="Reverse direction"
            className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-border hover:border-brand-300 text-text-secondary hover:text-brand-600 transition-all text-[10px] font-medium"
          >
            <ArrowLeftRight size={12} />
            Reverse
          </button>
          <div className="h-px w-6 bg-border" />
        </div>
      </div>

      {/* Target dropdown */}
      <div>
        <label className="text-label uppercase text-text-secondary block mb-1">
          Target
        </label>
        <select
          value={edge.target}
          onChange={(e) => updateEdgeEndpoint(edgeId, 'target', e.target.value)}
          className="w-full h-8 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors"
        >
          {nodes.map((n) => (
            <option key={n.id} value={n.id} disabled={n.id === edge.source}>
              {n.data.label}{n.data.physicalSystem ? ` (${n.data.physicalSystem})` : ''}
            </option>
          ))}
          {groups.map((g) => (
            <option key={g.id} value={g.id} disabled={g.id === edge.source}>
              {g.data.label} (Group)
            </option>
          ))}
        </select>
      </div>

      {/* Copy / Paste buttons */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<Copy size={12} />}
          onClick={() => copyEdgeData(edgeId)}
          title="Copy data elements (Ctrl+C)"
          className="flex-1"
        >
          Copy Data
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<ClipboardPaste size={12} />}
          onClick={() => { pasteEdgeData(edgeId) }}
          disabled={!copiedEdgeData}
          title="Paste data elements (Ctrl+V)"
          className="flex-1"
        >
          Paste Data
        </Button>
      </div>

      {/* Copied indicator */}
      {copiedEdgeData && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-brand-50 border border-brand-200 rounded-md">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
          <span className="text-[10px] text-brand-600 font-mono">
            {copiedEdgeData.dataElements.length} element{copiedEdgeData.dataElements.length !== 1 ? 's' : ''} on clipboard
          </span>
        </div>
      )}

      <div className="border-b border-border" />
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

      {/* Condition (If/Then) */}
      <div className="mb-4">
        <label className="text-label uppercase text-status-yellow block mb-1">
          Condition (If / Then)
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-status-yellow font-mono shrink-0">IF</span>
          <input
            value={selectedEdge.data?.condition || ''}
            onChange={(e) => {
              useDiagramStore.setState({
                edges: useDiagramStore.getState().edges.map((ed) =>
                  ed.id === selectedEdge.id
                    ? { ...ed, data: { ...ed.data!, condition: e.target.value || undefined } }
                    : ed
                ),
              })
            }}
            placeholder="e.g. Material Type = FERT"
            className="w-full h-8 px-3 rounded-lg border border-border bg-surface-input text-body-sm font-mono focus:ring-2 focus:ring-status-yellow/30 focus:border-status-yellow focus:outline-none transition-colors"
          />
        </div>
        {selectedEdge.data?.condition && (
          <p className="text-[10px] text-text-tertiary mt-1 italic">
            This data flow applies only when the condition is met.
          </p>
        )}
      </div>

      {/* Sequence is now per-artifact — shown in the artifact tagger below */}

      <SidebarLabel>Data Elements</SidebarLabel>
      <p className="text-[11px] text-text-tertiary mb-4">
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
            className={`bg-surface-muted border rounded-lg px-3 py-2 transition-all ${
              dragIndex === idx
                ? 'opacity-40 border-brand-300'
                : dragOverIndex === idx
                  ? 'border-brand-500 shadow-card'
                  : 'border-border'
            }`}
          >
            <div className="flex items-center gap-2">
              {/* Drag handle */}
              <div className="cursor-grab active:cursor-grabbing text-text-tertiary hover:text-text-secondary transition-colors shrink-0" title="Drag to reorder">
                <GripVertical size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <input
                  value={el.name}
                  onChange={(e) =>
                    updateDataElement(selectedEdge.id, el.id, {
                      name: e.target.value,
                    })
                  }
                  aria-label="Data element name"
                  className="w-full bg-transparent text-body-sm text-text-secondary outline-none"
                />
                <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-mono">
                  {el.elementType.replace('_', ' ')}
                </div>
              </div>
              <button
                onClick={() => removeDataElement(selectedEdge.id, el.id)}
                title="Remove data element"
                className="text-text-tertiary hover:text-red-600 transition-colors shrink-0"
              >
                <X size={14} />
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
                aria-label="Value stream"
                title="Value stream"
                className="w-full px-2 py-1 rounded border border-border bg-surface-input text-[10px] text-text-secondary focus:border-brand-500 focus:outline-none transition-colors"
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
                <ChevronRight
                  size={10}
                  className={`text-text-tertiary transition-transform ${expandedProps.has(el.id) ? 'rotate-90' : ''}`}
                />
                <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold group-hover/tp:text-text-secondary transition-colors">
                  Technical Details
                </span>
                {(el.technicalProperties?.length ?? 0) > 0 && (
                  <span className="text-[10px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full font-medium">
                    {el.technicalProperties!.length}
                  </span>
                )}
              </button>

              {expandedProps.has(el.id) && (
                <div className="mt-1.5 ml-2 pl-2 border-l border-brand-200 space-y-1.5">
                  {/* Existing properties */}
                  {(el.technicalProperties || []).map((prop) => (
                    <div key={prop.id} className="flex items-start gap-1.5">
                      <div className="flex-1 min-w-0">
                        <input
                          value={prop.key}
                          onChange={(e) =>
                            updateTechnicalProperty(selectedEdge.id, el.id, prop.id, { key: e.target.value })
                          }
                          aria-label="Property name"
                          className="w-full bg-transparent text-[10px] text-text-tertiary outline-none font-mono uppercase tracking-wider"
                        />
                        <input
                          value={prop.value}
                          onChange={(e) =>
                            updateTechnicalProperty(selectedEdge.id, el.id, prop.id, { value: e.target.value })
                          }
                          placeholder="Enter value..."
                          className="w-full bg-transparent text-[11px] text-text-secondary font-mono outline-none"
                        />
                      </div>
                      <button
                        onClick={() => removeTechnicalProperty(selectedEdge.id, el.id, prop.id)}
                        title="Remove property"
                        className="text-text-tertiary hover:text-red-600 transition-colors shrink-0 mt-1"
                      >
                        <X size={10} />
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
                          className="text-[10px] bg-surface-muted text-text-tertiary hover:text-text-secondary hover:border-border-strong border border-border px-1.5 py-0.5 rounded transition-colors"
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
              <div className="mt-2 ml-2 pl-2 border-l border-border">
                {(el.attributes || []).map((attr) => (
                  <div key={attr.id} className="flex items-center gap-1.5 mb-1">
                    <input
                      value={attr.name}
                      onChange={(e) =>
                        updateAttribute(selectedEdge.id, el.id, attr.id, {
                          name: e.target.value,
                        })
                      }
                      aria-label="Attribute name"
                      className="flex-1 bg-transparent text-[11px] text-text-secondary outline-none"
                    />
                    <button
                      onClick={() => removeAttribute(selectedEdge.id, el.id, attr.id)}
                      title="Remove attribute"
                      className="text-text-tertiary hover:text-red-600 transition-colors shrink-0"
                    >
                      <X size={10} />
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
                    className="flex-1 bg-transparent text-[10px] text-text-secondary outline-none"
                  />
                  <button
                    onClick={() => handleAddAttr(el.id)}
                    title="Add attribute"
                    className="text-[10px] text-brand-600 hover:text-brand-700 font-medium transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Per-element artifact tags */}
            {artifacts.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold mb-1">
                  Artifacts
                </div>
                <div className="flex flex-wrap gap-1">
                  {artifacts.map((art) => {
                    const isTagged = (el.outputArtifactIds ?? []).includes(art.id)
                    return (
                      <button
                        key={art.id}
                        onClick={() => toggleElementArtifact(selectedEdge.id, el.id, art.id)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all ${
                          isTagged
                            ? 'bg-m12-ember/15 border border-m12-ember/40 text-m12-ember font-medium'
                            : 'bg-white border border-border text-text-tertiary hover:border-m12-ember/30 hover:text-m12-ember/70'
                        }`}
                      >
                        {isTagged && <Check size={8} strokeWidth={3} />}
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
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border hover:border-brand-300 text-text-secondary hover:text-brand-600 transition-all"
          >
            <ChevronDown
              size={10}
              className={`transition-transform ${showAllElements ? 'rotate-180' : ''}`}
            />
            <span className="text-[10px] font-medium">
              {showAllElements ? 'Show less' : `Show ${sidebarHiddenCount} more element${sidebarHiddenCount !== 1 ? 's' : ''}`}
            </span>
          </button>
        )}
        {dataElements.length === 0 && (
          <div className="text-body-sm text-text-tertiary text-center py-3 border border-dashed border-border rounded-lg">
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
          className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as DataElementType)}
          aria-label="Element type"
          title="Element type"
          className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors"
        >
          {ELEMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          size="md"
          fullWidth
          disabled={!newName.trim()}
          onClick={handleAdd}
        >
          Add Element
        </Button>
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
      <p className="text-[11px] text-text-tertiary mb-3">
        Add notes, decisions, and context for this diagram.
      </p>
      <textarea
        value={meta.notes || ''}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Type your notes here...&#10;&#10;e.g., Design decisions, open questions, change history..."
        className="flex-1 min-h-[200px] px-3 py-2.5 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors resize-none leading-relaxed"
      />
      <div className="mt-2 text-[10px] text-text-tertiary font-mono">
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
      className={`flex-1 px-3 py-2.5 text-[12px] font-medium transition-colors ${
        active
          ? 'text-brand-600 border-b-2 border-brand-500'
          : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent'
      }`}
    >
      {children}
    </button>
  )
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider font-semibold text-text-tertiary mb-2">
      {children}
    </div>
  )
}
