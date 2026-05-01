'use client'

import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useRouter } from 'next/navigation'
import { useDiagramStore } from '@/lib/diagram/store'
import { useAuth } from '@/lib/supabase/auth-context'
import { useTheme } from '@/lib/theme-context'
import ExportMenu from './ExportMenu'

export default function Toolbar({ onAiOpen, onHelpOpen, onShareOpen, onImportL3Open }: { onAiOpen?: () => void; onHelpOpen?: () => void; onShareOpen?: () => void; onImportL3Open?: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const deleteSelected = useDiagramStore((s) => s.deleteSelected)
  const saveDiagram = useDiagramStore((s) => s.saveDiagram)
  const autoLayout = useDiagramStore((s) => s.autoLayout)
  const selectedNodeId = useDiagramStore((s) => s.selectedNodeId)
  const selectedEdgeId = useDiagramStore((s) => s.selectedEdgeId)
  const connectMode = useDiagramStore((s) => s.connectMode)
  const toggleConnectMode = useDiagramStore((s) => s.toggleConnectMode)
  const spotlightNodeId = useDiagramStore((s) => s.spotlightNodeId)
  // shareOpen state removed — dialog now managed by parent (DiagramCanvas)
  const [saving, setSaving] = useState(false)

  const undo = useDiagramStore((s) => s.undo)
  const canUndo = useDiagramStore((s) => s.canUndo)
  const selectedGroupId = useDiagramStore((s) => s.selectedGroupId)
  const hasSelection = selectedNodeId || selectedEdgeId || selectedGroupId

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    await saveDiagram(user.id)
    setSaving(false)
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-[var(--m12-bg-card)]/90 backdrop-blur-sm border border-[var(--m12-border)]/60 rounded-xl px-2 py-1.5 shadow-lg">
      <ToolbarButton onClick={() => router.push('/')} title="Back to Dashboard">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </ToolbarButton>

      <div className="w-px h-5 bg-[var(--m12-border)] mx-1" />

      <ToolbarButton onClick={() => zoomIn()} title="Zoom In">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </ToolbarButton>

      <ToolbarButton onClick={() => zoomOut()} title="Zoom Out">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </ToolbarButton>

      <ToolbarButton onClick={() => fitView({ padding: 0.2, duration: 300 })} title="Fit View">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><rect x="5" y="5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1"/></svg>
      </ToolbarButton>

      <ToolbarButton onClick={() => { autoLayout(); setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50) }} title="Auto Layout — reorganize systems to show connections clearly">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="3" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/>
          <rect x="10" y="1" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/>
          <rect x="10" y="7" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/>
          <rect x="10" y="12" width="5" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M6 5h4M6 5l3-2M6 5l3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </ToolbarButton>

      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
          canUndo
            ? 'text-[var(--m12-text-secondary)] hover:bg-[var(--m12-border)]/60 hover:text-[var(--m12-text)]'
            : 'text-[var(--m12-border)] cursor-not-allowed'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6h6a3 3 0 010 6H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M7 3L4 6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div className="w-px h-5 bg-[var(--m12-border)] mx-1" />

      <button
        onClick={toggleConnectMode}
        disabled={!!spotlightNodeId && !connectMode}
        title={spotlightNodeId ? 'Click canvas to exit spotlight first' : connectMode ? 'Exit Connect Mode (Esc)' : 'Connect Systems — click two nodes to link them'}
        className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg transition-colors text-xs font-medium ${
          connectMode
            ? 'bg-[#2563EB]/20 text-[#2563EB] ring-1 ring-[#2563EB]/50'
            : spotlightNodeId
              ? 'text-[var(--m12-border)] cursor-not-allowed'
              : 'text-[var(--m12-text-secondary)] hover:bg-[var(--m12-border)]/60 hover:text-[var(--m12-text)]'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M5.5 5.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/>
        </svg>
        {connectMode ? 'Connecting...' : 'Connect'}
      </button>

      <div className="w-px h-5 bg-[var(--m12-border)] mx-1" />

      {hasSelection && (
        <ToolbarButton onClick={deleteSelected} title="Delete Selected" variant="danger">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1m1.5 0l-.5 8.5a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 12.5L4.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </ToolbarButton>
      )}

      <div className="w-px h-5 bg-[var(--m12-border)] mx-1" />

      {onAiOpen && (
        <button
          onClick={onAiOpen}
          title="AI Assistant (Ctrl+K)"
          className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[#06B6D4] hover:bg-[#06B6D4]/10 transition-colors"
        >
          <span className="text-[10px] font-bold font-[family-name:var(--font-space-mono)]">AI</span>
        </button>
      )}

      {onImportL3Open && (
        <button
          onClick={onImportL3Open}
          title="Import an L3 SIPOC as a Group"
          className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[var(--m12-text-secondary)] hover:bg-[#06B6D4]/10 hover:text-[#06B6D4] transition-colors text-xs font-medium"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="0.5" y="0.5" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1" />
            <rect x="8.5" y="0.5" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1" />
            <rect x="4.5" y="8.5" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1" />
            <path d="M3 5.5v2M11 5.5v2M7 7v1.5M3 7h8" stroke="currentColor" strokeWidth="0.8" />
          </svg>
          L3 SIPOC
        </button>
      )}

      <ExportMenu />

      <div className="w-px h-5 bg-[var(--m12-border)] mx-1" />

      <ToolbarButton onClick={handleSave} title={saving ? 'Saving...' : 'Save Diagram'}>
        {saving ? (
          <span className="text-[10px] text-[#06B6D4]">...</span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12.5 14H3.5a1 1 0 01-1-1V3a1 1 0 011-1h7l3 3v8a1 1 0 01-1 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 14v-4h6v4M5 2v3h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        )}
      </ToolbarButton>

      <div className="w-px h-5 bg-[var(--m12-border)] mx-1" />

      <button
        onClick={onShareOpen}
        title="Share Diagram"
        className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[#10B981] hover:bg-[#10B981]/10 transition-colors text-xs font-medium"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 8V13a1 1 0 001 1h6a1 1 0 001-1V8M11 4L8 1M8 1L5 4M8 1v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Share
      </button>

      {/* Theme toggle */}
      <div className="w-px h-5 bg-[var(--m12-border)] mx-1" />
      <ToolbarButton onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
        {theme === 'dark' ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.76 3.76l1.06 1.06M11.18 11.18l1.06 1.06M3.76 12.24l1.06-1.06M11.18 4.82l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 9.5a5.5 5.5 0 01-7-7 5.5 5.5 0 107 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </ToolbarButton>

      {onHelpOpen && (
        <>
          <div className="w-px h-5 bg-[var(--m12-border)] mx-1" />
          <ToolbarButton onClick={onHelpOpen} title="How to use this app">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6.5 6.5a1.5 1.5 0 112.12 1.37c-.33.19-.62.5-.62.88V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
            </svg>
          </ToolbarButton>
        </>
      )}

    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  title,
  variant = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  variant?: 'default' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
        variant === 'danger'
          ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300'
          : 'text-[var(--m12-text-secondary)] hover:bg-[var(--m12-border)]/60 hover:text-[var(--m12-text)]'
      }`}
    >
      {children}
    </button>
  )
}
