'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Archive,
  ArrowLeftRight,
  BookOpen,
  Boxes,
  Building2,
  ChevronRight,
  Copy,
  Database,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  Map as MapIcon,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Upload,
  Users,
  Workflow,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import { listDiagrams, createDiagram, archiveDiagram, restoreDiagram } from '@/lib/supabase/diagrams'
import { listCapabilityMaps, createCapabilityMap, archiveCapabilityMap, restoreCapabilityMap, duplicateCapabilityMap } from '@/lib/supabase/capability-maps'
import { listProcessModels, createProcessModel, archiveProcessModel, restoreProcessModel, duplicateProcessModel } from '@/lib/supabase/process-models'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'
import type { Workstream } from '@/lib/workstream/types'
import { importBpmnFile, importHierarchyFile } from '@/lib/process/import'
import { generateBedrockIntegrationDiagram } from '@/lib/bedrock/generate'
import { pushMapToNewDiagram } from '@/lib/sipoc/pushToDiagram'
import { useSIPOCStore } from '@/lib/sipoc/store'
import WorkstreamPicker from '@/components/workstream/WorkstreamPicker'
import CapabilityMapWorkspace from '@/components/capmap/CapabilityMapWorkspace'
import type { DiagramRow } from '@/lib/supabase/types'
import type { CapabilityMapRow } from '@/lib/sipoc/types'
import type { ProcessModelRow } from '@/lib/process/types'
import {
  Button,
  CollapsibleSection,
  EmptyState,
  KpiCard,
  KpiCardSkeleton,
  LoadingState,
  PageHeader,
} from '@/components/common'

const SELECT_CLASSES =
  'w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none'

export default function Dashboard() {
  const [diagrams, setDiagrams] = useState<DiagramRow[]>([])
  const [capabilityMaps, setCapabilityMaps] = useState<CapabilityMapRow[]>([])
  const [processModels, setProcessModels] = useState<ProcessModelRow[]>([])
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [loadingDiagrams, setLoadingDiagrams] = useState(true)
  const [activeTab, setActiveTab] = useState<'diagrams' | 'sipoc' | 'process' | 'capmap'>('sipoc')
  const router = useRouter()
  const { user, organization, loading } = useAuth()

  // Bedrock Data Integration generation
  const [bedrockOpen, setBedrockOpen] = useState(false)
  const [bedrockModelId, setBedrockModelId] = useState('')
  const [bedrockWorkstreamId, setBedrockWorkstreamId] = useState<string | null>(null)
  const [bedrockBusy, setBedrockBusy] = useState(false)
  const [bedrockError, setBedrockError] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  // Generate a data diagram from a SIPOC map
  const [sipocOpen, setSipocOpen] = useState(false)
  const [sipocMapId, setSipocMapId] = useState('')
  const [sipocBusy, setSipocBusy] = useState(false)
  const [sipocError, setSipocError] = useState<string | null>(null)

  // Auth gating
  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  // Load diagrams + capability maps
  const loadAll = useCallback(async () => {
    if (!organization) return
    setLoadingDiagrams(true)
    const [allDiagrams, allMaps, allProcesses, allWorkstreams] = await Promise.all([
      listDiagrams(organization.id, true),
      listCapabilityMaps(organization.id, true),
      listProcessModels(organization.id, true),
      listWorkstreams(organization.id),
    ])
    setDiagrams(allDiagrams)
    setCapabilityMaps(allMaps)
    setProcessModels(allProcesses)
    setWorkstreams(allWorkstreams)
    setLoadingDiagrams(false)
  }, [organization])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleNew = useCallback(async () => {
    if (!organization || !user) return
    const diagram = await createDiagram(organization.id, user.id)
    router.push(`/diagram/${diagram.id}`)
  }, [organization, user, router])

  const handleNewCapabilityMap = useCallback(async () => {
    if (!organization || !user) return
    const map = await createCapabilityMap(organization.id, user.id)
    router.push(`/capability-map/${map.id}`)
  }, [organization, user, router])

  const handleNewProcessModel = useCallback(async () => {
    if (!organization || !user) return
    const pm = await createProcessModel(organization.id, user.id)
    router.push(`/process/${pm.id}`)
  }, [organization, user, router])

  const importInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !organization || !user) return
    setImporting(true)
    try {
      const isBpmn = /\.(bpmn|xml)$/i.test(file.name)
      const modelId = isBpmn
        ? await importBpmnFile(file, organization.id, user.id)
        : await importHierarchyFile(file, organization.id, user.id)
      router.push(`/process/${modelId}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed')
      setImporting(false)
    }
  }, [organization, user, router])

  const handleGenerateBedrock = useCallback(async () => {
    if (!organization || !user || !bedrockModelId) return
    setBedrockBusy(true)
    setBedrockError(null)
    try {
      const id = await generateBedrockIntegrationDiagram(bedrockModelId, organization.id, user.id, { workstreamId: bedrockWorkstreamId })
      router.push(`/diagram/${id}`)
    } catch (err) {
      setBedrockError(err instanceof Error ? err.message : 'Generation failed')
      setBedrockBusy(false)
    }
  }, [organization, user, bedrockModelId, bedrockWorkstreamId, router])

  const handleGenerateFromSipoc = useCallback(async () => {
    if (!organization || !user || !sipocMapId) return
    setSipocBusy(true)
    setSipocError(null)
    try {
      const store = useSIPOCStore.getState()
      const ok = await store.loadMap(sipocMapId)
      if (!ok) throw new Error('Could not load that SIPOC map.')
      await store.loadOrgEntities(organization.id)
      const s = useSIPOCStore.getState()
      const raw = s.capabilities
      // Leaves = L3 SIPOCs (capabilities with no children) that have something to draw.
      const leaves = s.getHydratedCapabilities().filter(
        (h) => !raw.some((c) => c.parent_id === h.id) && (h.inputs.some((i) => !i.archived_at) || !!h.system)
      )
      if (leaves.length === 0) throw new Error('This SIPOC has no L3 capabilities with inputs or a host system to diagram yet.')
      const mapTitle = capabilityMaps.find((m) => m.id === sipocMapId)?.title
      const id = await pushMapToNewDiagram(leaves, organization.id, user.id, mapTitle, s.systemDataElements)
      router.push(`/diagram/${id}`)
    } catch (err) {
      setSipocError(err instanceof Error ? err.message : 'Generation failed')
      setSipocBusy(false)
    }
  }, [organization, user, sipocMapId, capabilityMaps, router])

  const handleRegenerateBedrock = useCallback(
    async (d: DiagramRow, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!organization || !user || !d.source_process_model_id) return
      if (!confirm('Regenerate replaces this diagram’s contents from the current process model. Manual edits will be lost. Continue?')) return
      setRegeneratingId(d.id)
      try {
        await generateBedrockIntegrationDiagram(d.source_process_model_id, organization.id, user.id, { existingDiagramId: d.id, workstreamId: d.workstream_id ?? null })
        await loadAll()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Regeneration failed')
      } finally {
        setRegeneratingId(null)
      }
    },
    [organization, user, loadAll]
  )

  const handleArchiveProcess = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!confirm('Archive this process model? You can restore it later.')) return
      await archiveProcessModel(id)
      await loadAll()
    },
    [loadAll]
  )

  const handleRestoreProcess = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      await restoreProcessModel(id)
      await loadAll()
    },
    [loadAll]
  )

  const [duplicatingProcess, setDuplicatingProcess] = useState<string | null>(null)
  const handleDuplicateProcess = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!organization || !user) return
      setDuplicatingProcess(id)
      try {
        await duplicateProcessModel(id, organization.id, user.id)
        await loadAll()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to duplicate process model')
      } finally {
        setDuplicatingProcess(null)
      }
    },
    [organization, user, loadAll]
  )

  const handleArchiveMap = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!confirm('Archive this capability map? You can restore it later.')) return
      await archiveCapabilityMap(id)
      await loadAll()
    },
    [loadAll]
  )

  const handleRestoreMap = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      await restoreCapabilityMap(id)
      await loadAll()
    },
    [loadAll]
  )

  const [duplicating, setDuplicating] = useState<string | null>(null)
  const handleDuplicateMap = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!organization || !user) return
      setDuplicating(id)
      try {
        await duplicateCapabilityMap(id, organization.id, user.id)
        await loadAll()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to duplicate map')
      } finally {
        setDuplicating(null)
      }
    },
    [organization, user, loadAll]
  )

  const handleArchive = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!confirm('Archive this diagram? You can restore it later.')) return
      await archiveDiagram(id)
      await loadAll()
    },
    [loadAll]
  )

  const handleRestore = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      await restoreDiagram(id)
      await loadAll()
    },
    [loadAll]
  )

  if (loading || !user || !organization) return null

  const activeDiagrams = diagrams.filter((d) => !d.archived_at)
  const archivedDiagrams = diagrams.filter((d) => d.archived_at)
  const activeMaps = capabilityMaps.filter((m) => !m.archived_at)
  const archivedMaps = capabilityMaps.filter((m) => m.archived_at)
  const activeProcesses = processModels.filter((p) => !p.archived_at)
  const archivedProcesses = processModels.filter((p) => p.archived_at)

  // Group data-architecture diagrams by value stream (workstream), ordered by the
  // workstream sort order, with an "Unaligned" bucket last - mirrors how Process
  // Studio organizes its content by value stream.
  const wsById = new Map(workstreams.map((w) => [w.id, w]))
  const diagramsByWs = new Map<string, DiagramRow[]>()
  for (const d of activeDiagrams) {
    const key = d.workstream_id && wsById.has(d.workstream_id) ? d.workstream_id : '__none__'
    const arr = diagramsByWs.get(key) ?? []
    arr.push(d)
    diagramsByWs.set(key, arr)
  }
  const orderedWs = [...workstreams].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
  const diagramGroups: { key: string; name: string; color: string; icon: string | null; diagrams: DiagramRow[] }[] = [
    ...orderedWs
      .filter((w) => diagramsByWs.has(w.id))
      .map((w) => ({ key: w.id, name: w.name, color: w.color || '#2563EB', icon: w.icon ?? null, diagrams: diagramsByWs.get(w.id)! })),
    ...(diagramsByWs.get('__none__')?.length
      ? [{ key: '__none__', name: 'Unaligned', color: '#64748B', icon: null, diagrams: diagramsByWs.get('__none__')! }]
      : []),
  ]
  for (const g of diagramGroups) g.diagrams.sort((a, b) => (a.process_context || '').localeCompare(b.process_context || '') || a.title.localeCompare(b.title))

  const pillBase = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-body-sm font-medium transition-colors'
  const pillActive = 'bg-brand-500 text-white'
  const pillInactive = 'text-text-secondary hover:bg-surface-muted'
  const subPillBase = 'flex items-center gap-1.5 px-2.5 py-1 rounded text-body-sm transition-colors'
  const subPillActive = 'bg-brand-50 text-brand-600 font-medium'
  const subPillInactive = 'text-text-secondary hover:bg-surface-muted'

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Studio"
        icon={<LayoutDashboard size={24} />}
        subtitle={`Process models, data architecture diagrams, and capability maps for ${organization.name}`}
        actions={
          <>
            <Button variant="secondary" icon={<Plus size={14} />} onClick={handleNewProcessModel}>
              New Process Model
            </Button>
            <Button variant="secondary" icon={<Plus size={14} />} onClick={handleNewCapabilityMap}>
              New SIPOC Map
            </Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={handleNew}>
              New Diagram
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingDiagrams ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              title="Process Models"
              value={activeProcesses.length}
              subtitle={archivedProcesses.length > 0 ? `${archivedProcesses.length} archived` : undefined}
              icon={<Workflow size={16} />}
              color="brand"
            />
            <KpiCard
              title="Diagrams"
              value={activeDiagrams.length}
              subtitle={archivedDiagrams.length > 0 ? `${archivedDiagrams.length} archived` : undefined}
              icon={<Network size={16} />}
              color="brand"
            />
            <KpiCard
              title="Capability Maps"
              value={activeMaps.length}
              subtitle={archivedMaps.length > 0 ? `${archivedMaps.length} archived` : undefined}
              icon={<MapIcon size={16} />}
              color="brand"
            />
            <KpiCard
              title="Workstreams"
              value={workstreams.length}
              subtitle="Value streams"
              icon={<Layers size={16} />}
              color="brand"
            />
          </>
        )}
      </div>

      <div className="space-y-4">
        {/* Pillar filter pills: Process Studio / Data Architecture / Capability Map */}
        <div className="space-y-2">
          <div className="bg-white rounded-lg border border-border p-1 flex items-center gap-1 w-fit">
            <button
              onClick={() => setActiveTab('process')}
              className={`${pillBase} ${activeTab === 'process' ? pillActive : pillInactive}`}
            >
              <Workflow size={14} />
              Process Studio ({activeProcesses.length})
            </button>
            <button
              onClick={() => setActiveTab(t => (t === 'diagrams' || t === 'sipoc') ? t : 'sipoc')}
              className={`${pillBase} ${activeTab === 'diagrams' || activeTab === 'sipoc' ? pillActive : pillInactive}`}
            >
              <Database size={14} />
              Data Architecture ({activeDiagrams.length + activeMaps.length})
            </button>
            <button
              onClick={() => setActiveTab('capmap')}
              className={`${pillBase} ${activeTab === 'capmap' ? pillActive : pillInactive}`}
            >
              <LayoutGrid size={14} />
              Capability Map
            </button>
          </div>

          {/* Sub-pills under Data Architecture: Diagrams + SIPOC Maps */}
          {(activeTab === 'diagrams' || activeTab === 'sipoc') && (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => setActiveTab('diagrams')}
                className={`${subPillBase} ${activeTab === 'diagrams' ? subPillActive : subPillInactive}`}
              >
                <Network size={12} />
                Diagrams ({activeDiagrams.length})
              </button>
              <span className="text-text-tertiary">/</span>
              <button
                onClick={() => setActiveTab('sipoc')}
                className={`${subPillBase} ${activeTab === 'sipoc' ? subPillActive : subPillInactive}`}
              >
                <ArrowLeftRight size={12} />
                SIPOC Maps ({activeMaps.length})
              </button>
            </div>
          )}
        </div>

        {/* Process: reference-library + import entry points */}
        {activeTab === 'process' && (
          <div className="flex items-stretch gap-3">
            <input
              ref={importInputRef}
              type="file"
              accept=".bpmn,.xml,.xlsx,.xls,.csv"
              onChange={handleImportFile}
              className="hidden"
              aria-label="Import process file"
            />
            <button
              onClick={() => router.push('/process/library')}
              className="flex-1 flex items-center gap-3 bg-white rounded-lg border border-border shadow-card hover:shadow-card-hover px-4 py-3 transition-all group text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <BookOpen size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body-md font-semibold text-text-primary">Start from a best-practice reference</div>
                <div className="text-[11px] text-text-tertiary">Browse the SAP-style A&amp;D process library and instantiate a scenario into an editable model.</div>
              </div>
              <ChevronRight size={16} className="text-text-tertiary group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              title="Import a BPMN (.bpmn/.xml) flow or a Signavio/Solution Manager BPML spreadsheet (.xlsx/.csv)"
              className="flex items-center gap-2 bg-white rounded-lg border border-border shadow-card hover:bg-surface-muted px-4 transition-colors text-left shrink-0 disabled:opacity-50 disabled:cursor-wait"
            >
              {importing ? (
                <Loader2 size={16} className="animate-spin text-text-tertiary" />
              ) : (
                <Upload size={16} className="text-text-secondary" />
              )}
              <span className="text-body-sm font-medium text-text-secondary">{importing ? 'Importing…' : 'Import'}</span>
            </button>
            <button
              onClick={() => router.push('/process/personas')}
              title="Persona Catalog - personas, roles, and role-as-swimlane"
              className="flex items-center gap-2 bg-white rounded-lg border border-border shadow-card hover:bg-surface-muted px-4 transition-colors text-left shrink-0"
            >
              <Users size={16} className="text-purple-600" />
              <span className="text-body-sm font-medium text-text-secondary">Personas</span>
            </button>
          </div>
        )}

        {/* Diagrams: bedrock data integration entry points */}
        {activeTab === 'diagrams' && (
          <div className="flex items-stretch gap-3">
            <button
              onClick={() => { setBedrockOpen(true); setBedrockError(null) }}
              className="flex-1 flex items-center gap-3 bg-white rounded-lg border border-border shadow-card hover:shadow-card-hover px-4 py-3 transition-all group text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Boxes size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body-md font-semibold text-text-primary">Generate a Bedrock Data Integration</div>
                <div className="text-[11px] text-text-tertiary">Map the data passed between systems for a process model&apos;s L1/L2/L3 processes, grounded in your bedrock systems.</div>
              </div>
              <ChevronRight size={16} className="text-text-tertiary group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
            <button
              onClick={() => { setSipocOpen(true); setSipocError(null) }}
              className="flex-1 flex items-center gap-3 bg-white rounded-lg border border-border shadow-card hover:shadow-card-hover px-4 py-3 transition-all group text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                <ArrowLeftRight size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body-md font-semibold text-text-primary">Generate a diagram from a SIPOC</div>
                <div className="text-[11px] text-text-tertiary">Turn a SIPOC capability map into a data-architecture diagram - one system flow per L3 capability, with information products on the wires.</div>
              </div>
              <ChevronRight size={16} className="text-text-tertiary group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
            <button
              onClick={() => router.push('/data/bedrock')}
              title="Bedrock Systems - logical platform categories and their physical systems"
              className="flex items-center gap-2 bg-white rounded-lg border border-border shadow-card hover:bg-surface-muted px-4 transition-colors text-left shrink-0"
            >
              <Database size={16} className="text-brand-600" />
              <span className="text-body-sm font-medium text-text-secondary">Bedrock Systems</span>
            </button>
            <button
              onClick={() => router.push('/data/sap-model')}
              title="SAP Enterprise Data Model - controlling area, company codes, plants, org units and RA-keyed WBS, pulled live from S/4HANA"
              className="flex items-center gap-2 bg-white rounded-lg border border-border shadow-card hover:bg-surface-muted px-4 transition-colors text-left shrink-0"
            >
              <Building2 size={16} className="text-text-secondary" />
              <span className="text-body-sm font-medium text-text-secondary">SAP Data Model</span>
            </button>
          </div>
        )}

        {/* Content grid */}
        {loadingDiagrams ? (
          <LoadingState variant="card" label="Loading studio content..." />
        ) : activeTab === 'diagrams' ? (
          /* ─── Diagrams Tab ─────────────────────────────── */
          activeDiagrams.length === 0 && archivedDiagrams.length === 0 ? (
            <EmptyState
              variant="dashed"
              icon={<Network size={40} />}
              title="No diagrams yet"
              description="Create your first data architecture diagram to get started."
              action={
                <Button variant="primary" icon={<Plus size={14} />} onClick={handleNew}>
                  Create Diagram
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={handleNew}
                  className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border hover:border-brand-500 hover:bg-brand-50/30 p-8 transition-colors group"
                >
                  <Plus size={28} className="text-text-tertiary group-hover:text-brand-600 transition-colors mb-2" />
                  <span className="text-body-sm text-text-secondary group-hover:text-text-primary transition-colors">New Diagram</span>
                </button>
              </div>
              {/* Grouped by value stream (mirrors Process Studio organization) */}
              {diagramGroups.map((grp) => (
                <CollapsibleSection
                  key={grp.key}
                  id={grp.key}
                  storageKey="mach12-studio:diagram-ws"
                  tone="neutral"
                  count={grp.diagrams.length}
                  title={
                    <span className="inline-flex items-center gap-2">
                      {grp.icon && (
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${grp.color}1A`, color: grp.color }}
                        >
                          <WorkstreamIcon icon={grp.icon} size={12} />
                        </span>
                      )}
                      {grp.name}
                    </span>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grp.diagrams.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => router.push(`/diagram/${d.id}`)}
                        className="bg-white rounded-lg border border-border shadow-card p-5 cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-display text-heading-sm text-text-primary truncate flex-1">{d.title}</h3>
                          <div className="flex items-center gap-1 ml-2 shrink-0">
                            {d.diagram_kind === 'bedrock_integration' && d.source_process_model_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                iconOnly
                                aria-label="Regenerate from the source process model"
                                title="Regenerate from the source process model"
                                loading={regeneratingId === d.id}
                                icon={<RefreshCw size={14} />}
                                onClick={(e) => handleRegenerateBedrock(d, e)}
                              />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              iconOnly
                              aria-label="Archive diagram"
                              title="Archive diagram"
                              icon={<Archive size={14} />}
                              onClick={(e) => handleArchive(d.id, e)}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-3 empty:hidden">
                          {d.diagram_kind === 'bedrock_integration' && (
                            <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-status-blue-bg text-status-blue">Bedrock</span>
                          )}
                          {d.process_context && (
                            <span className="inline-flex items-center gap-1.5 rounded bg-surface-muted px-2 py-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                              <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">{d.process_context}</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-tertiary">
                          Updated {new Date(d.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              ))}
              {archivedDiagrams.length > 0 && (
                <CollapsibleSection
                  id="archived-diagrams"
                  storageKey="mach12-studio:home"
                  tone="slate"
                  title="Archived"
                  count={archivedDiagrams.length}
                  defaultOpen={false}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {archivedDiagrams.map((d) => (
                      <div key={d.id} className="bg-white rounded-lg border border-border shadow-card p-5 opacity-60 hover:opacity-100 transition-opacity">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-display text-heading-sm text-text-primary truncate flex-1">{d.title}</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Restore diagram"
                            title="Restore diagram"
                            icon={<RotateCcw size={12} />}
                            onClick={(e) => handleRestore(d.id, e)}
                            className="ml-2 shrink-0"
                          >
                            Restore
                          </Button>
                        </div>
                        {d.process_context && (
                          <div className="inline-flex items-center gap-1.5 rounded bg-surface-muted px-2 py-0.5 mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                            <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">{d.process_context}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-text-tertiary">
                          Archived {new Date(d.archived_at!).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
            </div>
          )
        ) : activeTab === 'sipoc' ? (
          /* ─── SIPOC Maps Tab ───────────────────────────── */
          activeMaps.length === 0 && archivedMaps.length === 0 ? (
            <EmptyState
              variant="dashed"
              icon={<MapIcon size={40} />}
              title="No capability maps yet"
              description="Create a SIPOC capability map to model data inputs, outputs, and personas."
              action={
                <Button variant="primary" icon={<Plus size={14} />} onClick={handleNewCapabilityMap}>
                  Create SIPOC Map
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={handleNewCapabilityMap}
                  className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border hover:border-brand-500 hover:bg-brand-50/30 p-8 transition-colors group"
                >
                  <Plus size={28} className="text-text-tertiary group-hover:text-brand-600 transition-colors mb-2" />
                  <span className="text-body-sm text-text-secondary group-hover:text-text-primary transition-colors">New SIPOC Map</span>
                </button>
                {activeMaps.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => router.push(`/capability-map/${m.id}`)}
                    className="bg-white rounded-lg border border-border shadow-card p-5 cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-display text-heading-sm text-text-primary truncate flex-1">{m.title}</h3>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          aria-label="Duplicate capability map"
                          title="Duplicate capability map"
                          loading={duplicating === m.id}
                          icon={<Copy size={14} />}
                          onClick={(e) => handleDuplicateMap(m.id, e)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          aria-label="Archive capability map"
                          title="Archive capability map"
                          icon={<Archive size={14} />}
                          onClick={(e) => handleArchiveMap(m.id, e)}
                        />
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded bg-purple-50 px-2 py-0.5 mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      <span className="text-[10px] font-mono text-purple-700 uppercase tracking-wider font-bold">SIPOC</span>
                    </div>
                    {m.description && (
                      <div className="text-body-sm text-text-secondary mb-2 line-clamp-2">{m.description}</div>
                    )}
                    <div className="text-[11px] text-text-tertiary">
                      Updated {new Date(m.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
              {archivedMaps.length > 0 && (
                <CollapsibleSection
                  id="archived-sipoc"
                  storageKey="mach12-studio:home"
                  tone="slate"
                  title="Archived"
                  count={archivedMaps.length}
                  defaultOpen={false}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {archivedMaps.map((m) => (
                      <div key={m.id} className="bg-white rounded-lg border border-border shadow-card p-5 opacity-60 hover:opacity-100 transition-opacity">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-display text-heading-sm text-text-primary truncate flex-1">{m.title}</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Restore capability map"
                            title="Restore capability map"
                            icon={<RotateCcw size={12} />}
                            onClick={(e) => handleRestoreMap(m.id, e)}
                            className="ml-2 shrink-0"
                          >
                            Restore
                          </Button>
                        </div>
                        <div className="text-[11px] text-text-tertiary">
                          Archived {new Date(m.archived_at!).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
            </div>
          )
        ) : activeTab === 'capmap' ? (
          /* ─── Capability Map Tab ───────────────────────── */
          <CapabilityMapWorkspace orgId={organization.id} userId={user.id} />
        ) : (
          /* ─── Process Studio Tab ───────────────────────── */
          activeProcesses.length === 0 && archivedProcesses.length === 0 ? (
            <EmptyState
              variant="dashed"
              icon={<Workflow size={40} />}
              title="No process models yet"
              description="Model end-to-end business processes with a navigable value-chain hierarchy and BPMN flows."
              action={
                <Button variant="primary" icon={<Plus size={14} />} onClick={handleNewProcessModel}>
                  Create Process Model
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={handleNewProcessModel}
                  className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border hover:border-brand-500 hover:bg-brand-50/30 p-8 transition-colors group"
                >
                  <Plus size={28} className="text-text-tertiary group-hover:text-brand-600 transition-colors mb-2" />
                  <span className="text-body-sm text-text-secondary group-hover:text-text-primary transition-colors">New Process Model</span>
                </button>
                {activeProcesses.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/process/${p.id}`)}
                    className="bg-white rounded-lg border border-border shadow-card p-5 cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-display text-heading-sm text-text-primary truncate flex-1">{p.title}</h3>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          aria-label="Duplicate process model"
                          title="Duplicate process model"
                          loading={duplicatingProcess === p.id}
                          icon={<Copy size={14} />}
                          onClick={(e) => handleDuplicateProcess(p.id, e)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          aria-label="Archive process model"
                          title="Archive process model"
                          icon={<Archive size={14} />}
                          onClick={(e) => handleArchiveProcess(p.id, e)}
                        />
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded bg-status-blue-bg px-2 py-0.5 mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-blue" />
                      <span className="text-[10px] font-mono text-status-blue uppercase tracking-wider font-bold">Process</span>
                    </div>
                    {p.description && (
                      <div className="text-body-sm text-text-secondary mb-2 line-clamp-2">{p.description}</div>
                    )}
                    <div className="text-[11px] text-text-tertiary">
                      Updated {new Date(p.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
              {archivedProcesses.length > 0 && (
                <CollapsibleSection
                  id="archived-process"
                  storageKey="mach12-studio:home"
                  tone="slate"
                  title="Archived"
                  count={archivedProcesses.length}
                  defaultOpen={false}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {archivedProcesses.map((p) => (
                      <div key={p.id} className="bg-white rounded-lg border border-border shadow-card p-5 opacity-60 hover:opacity-100 transition-opacity">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-display text-heading-sm text-text-primary truncate flex-1">{p.title}</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Restore process model"
                            title="Restore process model"
                            icon={<RotateCcw size={12} />}
                            onClick={(e) => handleRestoreProcess(p.id, e)}
                            className="ml-2 shrink-0"
                          >
                            Restore
                          </Button>
                        </div>
                        <div className="text-[11px] text-text-tertiary">
                          Archived {new Date(p.archived_at!).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
            </div>
          )
        )}
      </div>

      {/* Generate Bedrock Data Integration dialog */}
      {bedrockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !bedrockBusy && setBedrockOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-xl shadow-card-hover p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h2 className="text-heading-sm font-display text-text-primary">Generate a Bedrock Data Integration</h2>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Close"
                icon={<X size={14} />}
                onClick={() => setBedrockOpen(false)}
                disabled={bedrockBusy}
                className="-mt-1 -mr-1"
              />
            </div>
            <p className="text-body-sm text-text-secondary mb-4">Maps the data passed between systems for each L1/L2/L3 process in a model, grounded in your Bedrock Systems catalog. Creates an editable data-architecture diagram.</p>

            <label className="block text-label uppercase text-text-secondary mb-1">Process model</label>
            <select
              value={bedrockModelId}
              onChange={(e) => setBedrockModelId(e.target.value)}
              aria-label="Process model"
              className={`${SELECT_CLASSES} mb-1`}
            >
              <option value="">Select a process model…</option>
              {activeProcesses.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {activeProcesses.length === 0 && (
              <div className="text-body-sm text-text-tertiary mb-3">No process models yet - create one in Process Studio first.</div>
            )}

            <label className="block text-label uppercase text-text-secondary mt-3 mb-1">Workstream (optional)</label>
            <div className="mb-4">
              <WorkstreamPicker orgId={organization.id} value={bedrockWorkstreamId} onChange={setBedrockWorkstreamId} />
            </div>

            {bedrockError && <div className="text-body-sm text-red-600 mb-3">{bedrockError}</div>}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setBedrockOpen(false)} disabled={bedrockBusy}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleGenerateBedrock} disabled={!bedrockModelId} loading={bedrockBusy}>
                Generate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generate a diagram from a SIPOC dialog */}
      {sipocOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !sipocBusy && setSipocOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-xl shadow-card-hover p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h2 className="text-heading-sm font-display text-text-primary">Generate a diagram from a SIPOC</h2>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Close"
                icon={<X size={14} />}
                onClick={() => setSipocOpen(false)}
                disabled={sipocBusy}
                className="-mt-1 -mr-1"
              />
            </div>
            <p className="text-body-sm text-text-secondary mb-4">Builds a data-architecture diagram from a SIPOC capability map. Each L3 capability becomes a source → feeding → host system flow, with its information products on the wires.</p>

            <label className="block text-label uppercase text-text-secondary mb-1">SIPOC map</label>
            <select
              value={sipocMapId}
              onChange={(e) => setSipocMapId(e.target.value)}
              aria-label="SIPOC map"
              className={`${SELECT_CLASSES} mb-1`}
            >
              <option value="">Select a SIPOC map…</option>
              {activeMaps.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
            {activeMaps.length === 0 && (
              <div className="text-body-sm text-text-tertiary mb-3">No SIPOC maps yet - create one first.</div>
            )}

            {sipocError && <div className="text-body-sm text-red-600 mt-3 mb-1">{sipocError}</div>}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setSipocOpen(false)} disabled={sipocBusy}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleGenerateFromSipoc} disabled={!sipocMapId} loading={sipocBusy}>
                Generate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
