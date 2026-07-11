'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { useSIPOCStore } from '@/lib/sipoc/store'
import SIPOCDrawer from '@/components/sipoc/SIPOCDrawer'
import CapabilityEditor from '@/components/sipoc/CapabilityEditor'
import AIGeneratePanel from '@/components/sipoc/AIGeneratePanel'
import ExecutiveSummary from '@/components/sipoc/ExecutiveSummary'
import CapabilityMapView from '@/components/sipoc/CapabilityMapView'
import AIBulkLoadPanel from '@/components/sipoc/AIBulkLoadPanel'
import AIAutoFillBlankL3sPanel from '@/components/sipoc/AIAutoFillBlankL3sPanel'
import DataArchitectureView from '@/components/sipoc/DataArchitectureView'
import VersionBadge from '@/components/VersionBadge'
import { Button, LoadingState } from '@/components/common'
import { ArrowLeft, Share2, Network, Download, Sparkles, FileText, Plus, X, Pencil } from 'lucide-react'
import { createCapabilityMapShare, listCapabilityMapShares, deleteCapabilityMapShare, type CapabilityMapShare } from '@/lib/supabase/capability-maps'
import { useCapabilityMapCollab } from '@/lib/collab/useCapabilityMapCollab'
import { CapabilityMapCollabProvider } from '@/lib/collab/CapabilityMapCollabContext'
import CollabPresence from '@/components/sipoc/CollabPresence'
import { pushL3ToNewDiagram } from '@/lib/sipoc/pushToDiagram'
import { exportCapabilityMapWorkbook } from '@/lib/export/capabilityMap'

export default function CapabilityMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, profile, organization, loading: authLoading } = useAuth()
  const pageMountTimeRef = useRef<number>(performance.now())
  const firstRenderLoggedRef = useRef(false)

  const map = useSIPOCStore(s => s.map)
  const mapTitle = map?.title ?? ''
  const loading = useSIPOCStore(s => s.loading)
  const selectedCapabilityId = useSIPOCStore(s => s.selectedCapabilityId)
  const drawerFullscreen = useSIPOCStore(s => s.drawerFullscreen)

  const [titleInput, setTitleInput] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [aiPromptOverride, setAiPromptOverride] = useState<string | null>(null)
  const [showExecSummary, setShowExecSummary] = useState(false)
  const [showDataArch, setShowDataArch] = useState(false)
  const [bulkLoadTarget, setBulkLoadTarget] = useState<{ id: string; name: string } | null>(null)
  const [showAutoFill, setShowAutoFill] = useState(false)
  const loadedRef = useRef(false)
  const orgLoadedRef = useRef<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shares, setShares] = useState<CapabilityMapShare[]>([])
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)

  // Auth gating
  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
  }, [user, authLoading, router])

  // Collaboration: presence + per-L3 lock via Yjs awareness
  const collabName =
    profile?.display_name?.trim() ||
    (user?.email ? user.email.split('@')[0] : '') ||
    'Anonymous'
  const collab = useCapabilityMapCollab(id, user?.id, collabName)

  // Sync our editing-target awareness to whichever L3 is open in the drawer
  useEffect(() => {
    collab.setEditingCapability(selectedCapabilityId)
  }, [selectedCapabilityId, collab.setEditingCapability])

  // Whether another collaborator already holds the lock on the selected L3
  const lockedByOther = !!(
    selectedCapabilityId &&
    collab.users.find(
      u => u.editingCapabilityId === selectedCapabilityId && u.clientId !== collab.myClientId,
    )
  )

  // If we open a locked L3, force the editor side-panel closed so the user
  // can't even see edit affordances.
  useEffect(() => {
    if (lockedByOther && editorOpen) setEditorOpen(false)
  }, [lockedByOther, editorOpen])

  // Push the currently-selected L3 SIPOC into a brand-new data diagram.
  const [pushingToDiagram, setPushingToDiagram] = useState(false)
  const handlePushToDiagram = useCallback(async () => {
    if (!user || !organization || !selectedCapabilityId || pushingToDiagram) return
    const store = useSIPOCStore.getState()
    const cap = store.capabilities.find(c => c.id === selectedCapabilityId)
    if (!cap) return
    const hydrated = store.getHydratedCapabilities().find(h => h.id === selectedCapabilityId)
    if (!hydrated) return
    const ok = window.confirm(`Push "${cap.name}" into a new data architecture diagram?`)
    if (!ok) return
    setPushingToDiagram(true)
    try {
      const newDiagramId = await pushL3ToNewDiagram(
        hydrated,
        organization.id,
        user.id,
        map?.title,
        store.systemDataElements,
      )
      router.push(`/diagram/${newDiagramId}`)
    } catch (err) {
      console.error('Push to diagram failed:', err)
      alert(err instanceof Error ? err.message : 'Failed to push to diagram')
      setPushingToDiagram(false)
    }
  }, [user, organization, selectedCapabilityId, pushingToDiagram, map?.title, router])

  // Load map data (once)
  useEffect(() => {
    if (id && !loadedRef.current) {
      loadedRef.current = true
      const tStart = performance.now()
      console.log(`[capmap-perf] loadMap kicked off at +${(tStart - pageMountTimeRef.current).toFixed(0)}ms after mount`)
      useSIPOCStore.getState().loadMap(id).then(ok => {
        if (ok) useSIPOCStore.getState().loadComments(id, false)
      })
    }
  }, [id])

  // Log when the page gate releases (auth + map both ready)
  useEffect(() => {
    if (!authLoading && user && !loading && map && !firstRenderLoggedRef.current) {
      firstRenderLoggedRef.current = true
      const total = performance.now() - pageMountTimeRef.current
      console.log(`[capmap-perf] page-ready total=${total.toFixed(0)}ms (mount → first usable render)`)
    }
  }, [authLoading, user, loading, map])

  // Load org entities when org is available (once per org)
  useEffect(() => {
    if (organization && orgLoadedRef.current !== organization.id) {
      orgLoadedRef.current = organization.id
      useSIPOCStore.getState().loadOrgEntities(organization.id)
    }
  }, [organization])

  // Sync title input
  useEffect(() => {
    if (mapTitle) setTitleInput(mapTitle)
  }, [mapTitle])

  const handleTitleBlur = useCallback(() => {
    setEditingTitle(false)
    if (user && titleInput.trim() && titleInput !== mapTitle) {
      useSIPOCStore.getState().updateTitle(titleInput.trim(), user.id)
    }
  }, [user, titleInput, mapTitle])

  // Share popover click-outside
  useEffect(() => {
    if (!shareOpen) return
    const h = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [shareOpen])

  const loadShares = useCallback(async () => {
    const s = await listCapabilityMapShares(id)
    setShares(s)
  }, [id])

  const handleOpenShare = useCallback(async () => {
    setShareOpen(o => !o)
    if (!shareOpen) await loadShares()
  }, [shareOpen, loadShares])

  const handleCreateShare = useCallback(async () => {
    if (!organization || !user) return
    setShareLoading(true)
    try {
      await createCapabilityMapShare(id, organization.id, user.id)
      await loadShares()
    } catch (e) {
      console.error('Share link error:', e)
      alert(e instanceof Error ? e.message : 'Failed to create share link. Has the migration been run?')
    }
    setShareLoading(false)
  }, [id, organization, user, loadShares])

  const handleRevokeShare = useCallback(async (shareId: string) => {
    await deleteCapabilityMapShare(shareId)
    await loadShares()
  }, [loadShares])

  const handleExportAll = useCallback(() => {
    const store = useSIPOCStore.getState()
    if (!map) return
    try {
      exportCapabilityMapWorkbook({
        title: map.title,
        tree: store.getCapabilityTree(),
        hydrated: store.getHydratedCapabilities(),
        informationProducts: store.informationProducts,
        systemDataElements: store.systemDataElements,
        logicalSystems: store.logicalSystems,
        personas: store.personas,
        workstreams: store.workstreams,
      })
    } catch (e) {
      console.error('Export failed:', e)
      alert(e instanceof Error ? e.message : 'Export failed')
    }
  }, [map])

  const handleCopyLink = useCallback((code: string) => {
    const url = `${window.location.origin}/share/${code}`
    navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }, [])

  if (authLoading || !user || loading || !map) {
    return (
      <div className="fixed inset-0 bg-surface-muted flex items-center justify-center">
        <LoadingState variant="inline" label="Loading capability map..." />
      </div>
    )
  }

  return (
    <CapabilityMapCollabProvider users={collab.users} myClientId={collab.myClientId}>
    <div className="fixed inset-0 bg-surface-muted flex flex-col">
      {/* Top bar */}
      <div className="h-14 border-b border-border bg-white flex items-center px-4 gap-3 shrink-0">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Back to home"
          onClick={() => router.push('/')}
          icon={<ArrowLeft size={16} />}
        />

        {/* Branding */}
        <span className="text-gradient text-sm font-bold font-display tracking-wide">
          MACH12
        </span>
        <VersionBadge />
        <span className="text-text-tertiary text-body-sm">/</span>

        {/* Title (inline editable) */}
        {editingTitle ? (
          <input
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => e.key === 'Enter' && handleTitleBlur()}
            autoFocus
            aria-label="Map title"
            className="bg-transparent border-b border-brand-500 text-heading-sm font-semibold text-text-primary py-0.5 focus:outline-none max-w-[400px]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className="flex items-center gap-1.5 group text-heading-sm font-semibold text-text-primary hover:text-brand-600 transition-colors truncate max-w-[400px]"
          >
            {map.title}
            <Pencil size={12} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </button>
        )}

        {/* View label */}
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md">
          Capability Map
        </span>

        <div className="flex-1" />

        {/* Live presence (other users in this map) */}
        <CollabPresence
          users={collab.users}
          myClientId={collab.myClientId}
          connected={collab.connected}
        />

        {/* Share (read-only link) */}
        <div ref={shareRef} className="relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenShare}
            icon={<Share2 size={12} />}
          >
            Share
          </Button>
          {shareOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-white border border-border rounded-lg shadow-dropdown overflow-hidden animate-slide-in-up">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-body-sm font-semibold text-text-primary">Read-Only Share Link</div>
                <div className="text-[10px] text-text-tertiary mt-0.5">Anyone with the link can view this map (no login required).</div>
              </div>
              <div className="p-3 space-y-2">
                {shares.filter(s => !s.expires_at || new Date(s.expires_at) > new Date()).map(s => (
                  <div key={s.id} className="flex items-center gap-2 bg-surface-muted rounded-lg px-3 py-2">
                    <input
                      readOnly
                      aria-label="Share link URL"
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/share/${s.code}`}
                      className="flex-1 bg-transparent text-[10px] text-text-secondary font-mono truncate focus:outline-none"
                      onClick={e => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(s.code)}
                      className="shrink-0 text-[10px] font-medium text-brand-600 hover:text-brand-500 transition-colors"
                    >
                      {shareCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevokeShare(s.id)}
                      className="shrink-0 text-text-tertiary hover:text-red-600 transition-colors"
                      title="Revoke this link"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={handleCreateShare}
                  loading={shareLoading}
                  icon={<Plus size={12} />}
                >
                  {shareLoading ? 'Generating...' : 'Generate New Link'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Data Architecture button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowDataArch(true)}
          icon={<Network size={12} />}
        >
          Data Architecture
        </Button>

        {/* Easy button: full capability-map Excel export */}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportAll}
          title="Download the full capability map (L1 to L2 to L3 to SIPOC, IPs, data elements, use cases) as a structured Excel workbook"
          icon={<Download size={12} />}
        >
          Export to Excel
        </Button>

        {/* AI auto-fill blank L3s */}
        <Button
          variant="ai"
          size="sm"
          onClick={() => setShowAutoFill(true)}
          title="Auto-generate SIPOC for every L3 with no inputs/outputs"
          icon={<Sparkles size={12} />}
        >
          Fill Blank L3s
        </Button>

        {/* Executive summary button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowExecSummary(true)}
          icon={<FileText size={12} />}
        >
          Executive Summary
        </Button>
      </div>

      {/* Main content: MAP + SIPOC drawer */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* MAP area (hidden in fullscreen) */}
        {!drawerFullscreen && (
          <div className="flex-1 overflow-auto p-6 min-h-0 min-w-0">
            <CapabilityMapView
              onSelectCapability={(id) => {
                useSIPOCStore.getState().setSelectedCapability(id)
              }}
              onAILoad={(id, name) => setBulkLoadTarget({ id, name })}
            />
          </div>
        )}

        {/* SIPOC Drawer + Editor */}
        {organization && (
          <SIPOCDrawer orgId={organization.id} editorOpen={editorOpen} onToggleEditor={() => setEditorOpen(e => !e)} onShowAI={(prompt?: string) => { if (prompt) setAiPromptOverride(prompt); setShowAI(true) }} onPushToDiagram={handlePushToDiagram} pushingToDiagram={pushingToDiagram} mapTitle={map.title}>
            {editorOpen && selectedCapabilityId && !lockedByOther && (
              <CapabilityEditor orgId={organization.id} />
            )}
          </SIPOCDrawer>
        )}
      </div>

      {/* AI Generate Panel */}
      {showAI && selectedCapabilityId && organization && (
        <AIGeneratePanel
          capabilityId={selectedCapabilityId}
          orgId={organization.id}
          initialPrompt={aiPromptOverride || undefined}
          onClose={() => { setShowAI(false); setAiPromptOverride(null) }}
        />
      )}

      {/* Executive Summary */}
      {showExecSummary && (
        <ExecutiveSummary onClose={() => setShowExecSummary(false)} />
      )}

      {/* Data & System Architecture */}
      {showDataArch && (
        <DataArchitectureView onClose={() => setShowDataArch(false)} />
      )}

      {/* AI Bulk Load Panel */}
      {bulkLoadTarget && (
        <AIBulkLoadPanel
          coreAreaId={bulkLoadTarget.id}
          coreAreaName={bulkLoadTarget.name}
          onClose={() => setBulkLoadTarget(null)}
        />
      )}

      {/* AI Auto-Fill Blank L3s */}
      {showAutoFill && organization && (
        <AIAutoFillBlankL3sPanel
          orgId={organization.id}
          mapTitle={map.title}
          onClose={() => setShowAutoFill(false)}
        />
      )}
    </div>
    </CapabilityMapCollabProvider>
  )
}
