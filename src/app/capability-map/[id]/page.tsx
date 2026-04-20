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
import DataArchitectureView from '@/components/sipoc/DataArchitectureView'
import VersionBadge from '@/components/VersionBadge'
import { useTheme } from '@/lib/theme-context'
import { createCapabilityMapShare, listCapabilityMapShares, deleteCapabilityMapShare, type CapabilityMapShare } from '@/lib/supabase/capability-maps'

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
  const [showDataArch, setShowDataArch] = useState(false)
  const [bulkLoadTarget, setBulkLoadTarget] = useState<{ id: string; name: string } | null>(null)
  const loadedRef = useRef(false)
  const orgLoadedRef = useRef<string | null>(null)
  const { theme, toggleTheme } = useTheme()
  const [shareOpen, setShareOpen] = useState(false)
  const [shares, setShares] = useState<CapabilityMapShare[]>([])
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)

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

  const handleCopyLink = useCallback((code: string) => {
    const url = `${window.location.origin}/share/${code}`
    navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }, [])

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

        {/* Share (read-only link) */}
        <div ref={shareRef} className="relative">
          <button
            onClick={handleOpenShare}
            className="flex items-center gap-1.5 border border-[var(--m12-border)]/40 hover:border-[var(--m12-border)] text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 7.5a2 2 0 01-2-2v0a2 2 0 012-2h1M8 4.5a2 2 0 012 2v0a2 2 0 01-2 2H7M4 6h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Share
          </button>
          {shareOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--m12-border)]/20">
                <div className="text-xs font-semibold text-[var(--m12-text)]">Read-Only Share Link</div>
                <div className="text-[10px] text-[var(--m12-text-muted)] mt-0.5">Anyone with the link can view this map (no login required).</div>
              </div>
              <div className="p-3 space-y-2">
                {shares.filter(s => !s.expires_at || new Date(s.expires_at) > new Date()).map(s => (
                  <div key={s.id} className="flex items-center gap-2 bg-[var(--m12-bg)] rounded-lg px-3 py-2">
                    <input
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/share/${s.code}`}
                      className="flex-1 bg-transparent text-[10px] text-[var(--m12-text-secondary)] font-[family-name:var(--font-space-mono)] truncate focus:outline-none"
                      onClick={e => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => handleCopyLink(s.code)}
                      className="shrink-0 text-[9px] font-medium text-[#2563EB] hover:text-[#3B82F6] transition-colors"
                    >
                      {shareCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => handleRevokeShare(s.id)}
                      className="shrink-0 text-[var(--m12-text-muted)] hover:text-red-400 transition-colors"
                      title="Revoke this link"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleCreateShare}
                  disabled={shareLoading}
                  className="w-full flex items-center justify-center gap-1.5 bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  {shareLoading ? 'Generating...' : 'Generate New Link'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Data Architecture button */}
        <button
          onClick={() => setShowDataArch(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-[#06B6D4]/20 to-[#2563EB]/20 border border-[#06B6D4]/30 hover:border-[#06B6D4]/50 text-[#06B6D4] px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="0.5" y="0.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1" />
            <rect x="7.5" y="0.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1" />
            <rect x="4" y="7.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1" />
            <path d="M2.5 4.5v1.5M9.5 4.5v1.5M6 6v1.5M2.5 6h7" stroke="currentColor" strokeWidth="0.8" />
          </svg>
          Data Architecture
        </button>

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

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:border-[var(--m12-border)] transition-colors"
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.76 3.76l1.06 1.06M11.18 11.18l1.06 1.06M3.76 12.24l1.06-1.06M11.18 4.82l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M13.5 9.5a5.5 5.5 0 01-7-7 5.5 5.5 0 107 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
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
    </div>
  )
}
