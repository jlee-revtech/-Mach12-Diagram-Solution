'use client'

import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Boxes,
  HelpCircle,
  Link2,
  Loader2,
  Maximize2,
  Network,
  Save,
  Share2,
  Sparkles,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useDiagramStore } from '@/lib/diagram/store'
import { useAuth } from '@/lib/supabase/auth-context'
import ExportMenu from './ExportMenu'

export default function Toolbar({ onAiOpen, onHelpOpen, onShareOpen, onImportL3Open }: { onAiOpen?: () => void; onHelpOpen?: () => void; onShareOpen?: () => void; onImportL3Open?: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const { user } = useAuth()
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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white border border-border rounded-lg px-2 py-1.5 shadow-card">
      <ToolbarButton onClick={() => router.push('/')} title="Back to Dashboard">
        <ArrowLeft size={16} />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolbarButton onClick={() => zoomIn()} title="Zoom In">
        <ZoomIn size={16} />
      </ToolbarButton>

      <ToolbarButton onClick={() => zoomOut()} title="Zoom Out">
        <ZoomOut size={16} />
      </ToolbarButton>

      <ToolbarButton onClick={() => fitView({ padding: 0.2, duration: 300 })} title="Fit View">
        <Maximize2 size={16} />
      </ToolbarButton>

      <ToolbarButton onClick={() => { autoLayout(); setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50) }} title="Auto Layout — reorganize systems to show connections clearly">
        <Network size={16} />
      </ToolbarButton>

      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
          canUndo
            ? 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
            : 'text-border-strong cursor-not-allowed'
        }`}
      >
        <Undo2 size={16} />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={toggleConnectMode}
        disabled={!!spotlightNodeId && !connectMode}
        title={spotlightNodeId ? 'Click canvas to exit spotlight first' : connectMode ? 'Exit Connect Mode (Esc)' : 'Connect Systems — click two nodes to link them'}
        className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg transition-colors text-[12px] font-medium ${
          connectMode
            ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-500/40'
            : spotlightNodeId
              ? 'text-border-strong cursor-not-allowed'
              : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
        }`}
      >
        <Link2 size={14} />
        {connectMode ? 'Connecting...' : 'Connect'}
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {hasSelection && (
        <ToolbarButton onClick={deleteSelected} title="Delete Selected" variant="danger">
          <Trash2 size={16} />
        </ToolbarButton>
      )}

      <div className="w-px h-5 bg-border mx-1" />

      {onAiOpen && (
        <button
          onClick={onAiOpen}
          title="AI Assistant (Ctrl+K)"
          className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors text-[12px] font-medium"
        >
          <Sparkles size={14} />
          AI
        </button>
      )}

      {onImportL3Open && (
        <button
          onClick={onImportL3Open}
          title="Import an L3 SIPOC as a Group"
          className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors text-[12px] font-medium"
        >
          <Boxes size={14} />
          L3 SIPOC
        </button>
      )}

      <ExportMenu />

      <div className="w-px h-5 bg-border mx-1" />

      <ToolbarButton onClick={handleSave} title={saving ? 'Saving...' : 'Save Diagram'}>
        {saving ? (
          <Loader2 size={16} className="animate-spin text-brand-600" />
        ) : (
          <Save size={16} />
        )}
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={onShareOpen}
        title="Share Diagram"
        className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors text-[12px] font-medium"
      >
        <Share2 size={14} />
        Share
      </button>

      {onHelpOpen && (
        <>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton onClick={onHelpOpen} title="How to use this app">
            <HelpCircle size={16} />
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
          ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
          : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}
