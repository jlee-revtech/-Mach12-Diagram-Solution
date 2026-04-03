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
import VersionBadge from '@/components/VersionBadge'

export default function CapabilityMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, organization, loading: authLoading } = useAuth()

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
  const [bulkLoadTarget, setBulkLoadTarget] = useState<{ id: string; name: string } | null>(null)
  const loadedRef = useRef(false)
  const orgLoadedRef = useRef<string | null>(null)

  // Auth gating
  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
  }, [user, authLoading, router])

  // Load map data (once)
  useEffect(() => {
    if (id && !loadedRef.current) {
      loadedRef.current = true
      useSIPOCStore.getState().loadMap(id)
    }
  }, [id])

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

  if (authLoading || !user || loading || !map) {
    return (
      <div className="fixed inset-0 bg-[var(--m12-bg)] flex items-center justify-center">
        <div className="text-[var(--m12-text-muted)] text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[var(--m12-bg)] flex flex-col">
      {/* Top bar */}
      <div className="h-12 border-b border-[var(--m12-border)]/40 bg-[var(--m12-bg-card)] flex items-center px-4 gap-4 shrink-0">
        {/* Back button */}
        <button
          onClick={() => router.push('/')}
          className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Branding */}
        <span className="text-gradient text-sm font-bold font-[family-name:var(--font-orbitron)] tracking-wide">
          MACH12
        </span>
        <VersionBadge />
        <span className="text-[var(--m12-text-muted)] text-xs">/</span>

        {/* Title (inline editable) */}
        {editingTitle ? (
          <input
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => e.key === 'Enter' && handleTitleBlur()}
            autoFocus
            className="bg-transparent border-b border-[#2563EB] text-base font-semibold text-[var(--m12-text)] py-0.5 focus:outline-none max-w-[400px]"
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="flex items-center gap-1.5 group text-base font-semibold text-[var(--m12-text)] hover:text-[#2563EB] transition-colors truncate max-w-[400px]"
          >
            {map.title}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0">
              <path d="M8.5 1.5l2 2M1.5 8.5l-.5 2.5 2.5-.5L9.5 4.5l-2-2-6 6z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {/* View label */}
        <span className="text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-1 rounded-md">
          Capability Map
        </span>

        <div className="flex-1" />

        {/* Executive summary button */}
        <button
          onClick={() => setShowExecSummary(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-[#8B5CF6]/20 to-[#2563EB]/20 border border-[#8B5CF6]/30 hover:border-[#8B5CF6]/50 text-[#8B5CF6] px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L7.5 4.5L11 5.5L8.5 8L9 11L6 9.5L3 11L3.5 8L1 5.5L4.5 4.5L6 1Z" fill="currentColor" />
          </svg>
          Executive Summary
        </button>


      </div>

      {/* Main content: MAP + SIPOC drawer */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* MAP area (hidden in fullscreen) */}
        {!drawerFullscreen && (
          <div className="flex-1 overflow-auto p-6 min-h-0">
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
          <SIPOCDrawer orgId={organization.id} editorOpen={editorOpen} onToggleEditor={() => setEditorOpen(e => !e)} onShowAI={(prompt?: string) => { if (prompt) setAiPromptOverride(prompt); setShowAI(true) }} mapTitle={map.title}>
            {editorOpen && selectedCapabilityId && (
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

      {/* AI Bulk Load Panel */}
      {bulkLoadTarget && (
        <AIBulkLoadPanel
          coreAreaId={bulkLoadTarget.id}
          coreAreaName={bulkLoadTarget.name}
          onClose={() => setBulkLoadTarget(null)}
        />
      )}
    </div>
  )
}
