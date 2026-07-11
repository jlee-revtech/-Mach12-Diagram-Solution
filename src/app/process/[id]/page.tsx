'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Pencil, Share2, Sparkles, Workflow } from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import { useProcessStore } from '@/lib/process/store'
import { Button, EmptyState, LoadingState } from '@/components/common'
import ProcessTree from '@/components/process/ProcessTree'
import ProcessNodeDetail from '@/components/process/ProcessNodeDetail'
import ProcessLeafView from '@/components/process/ProcessLeafView'
import ProcessShareDialog from '@/components/process/ProcessShareDialog'
import ProcessGapAssessment from '@/components/process/ProcessGapAssessment'
import RicefwPanel from '@/components/process/RicefwPanel'
import ProcessExportMenu from '@/components/process/ProcessExportMenu'
import ProcessPresence from '@/components/process/ProcessPresence'
import { useProcessCollab } from '@/lib/collab/useProcessCollab'
import VersionBadge from '@/components/VersionBadge'

export default function ProcessModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, profile, organization, loading: authLoading } = useAuth()

  const model = useProcessStore(s => s.model)
  const loading = useProcessStore(s => s.loading)
  const selectedNodeId = useProcessStore(s => s.selectedNodeId)
  const selectedNode = useProcessStore(s => s.nodes.find(n => n.id === s.selectedNodeId))
  const updateTitle = useProcessStore(s => s.updateTitle)

  const [titleInput, setTitleInput] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [gapOpen, setGapOpen] = useState(false)
  const [ricefwOpen, setRicefwOpen] = useState(false)
  const loadedRef = useRef(false)
  const orgLoadedRef = useRef<string | null>(null)

  // Collaboration presence
  const collabName = profile?.display_name?.trim() || (user?.email ? user.email.split('@')[0] : '') || 'Anonymous'
  const collab = useProcessCollab(id, user?.id, collabName)
  useEffect(() => { collab.setEditingNode(selectedNodeId) }, [selectedNodeId, collab.setEditingNode])

  // Auth gating
  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
  }, [user, authLoading, router])

  // Load model (once)
  useEffect(() => {
    if (id && !loadedRef.current) {
      loadedRef.current = true
      useProcessStore.getState().loadModel(id).then(ok => {
        if (!ok) router.push('/')
      })
    }
  }, [id, router])

  // Load org pools when org is available
  useEffect(() => {
    if (organization && orgLoadedRef.current !== organization.id) {
      orgLoadedRef.current = organization.id
      useProcessStore.getState().loadOrgEntities(organization.id)
    }
  }, [organization])

  useEffect(() => {
    if (model) setTitleInput(model.title)
  }, [model])

  const commitTitle = useCallback(async () => {
    if (!user) return
    const t = titleInput.trim()
    if (t && model && t !== model.title) await updateTitle(t, user.id)
    setEditingTitle(false)
  }, [titleInput, model, user, updateTitle])

  if (authLoading || !user) return null

  return (
    <div className="h-screen flex flex-col bg-surface-muted text-text-primary">
      {/* Header */}
      <header className="h-14 border-b border-border bg-white flex items-center px-4 gap-3 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Back to dashboard"
          title="Back to dashboard"
          onClick={() => router.push('/')}
          icon={<ArrowLeft size={16} />}
        />

        {/* Branding */}
        <span className="text-gradient text-sm font-bold font-display tracking-wide shrink-0">MACH12</span>
        <VersionBadge />
        <span className="text-text-tertiary text-body-sm shrink-0">/</span>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md shrink-0">
          Process Studio
        </span>

        {/* Title (inline editable) */}
        {editingTitle ? (
          <input
            autoFocus
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleInput(model?.title || ''); setEditingTitle(false) } }}
            onBlur={commitTitle}
            aria-label="Model title"
            className="bg-transparent border-b border-brand-500 text-heading-sm font-semibold text-text-primary py-0.5 focus:outline-none max-w-[400px] min-w-0"
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="flex items-center gap-1.5 group text-heading-sm font-semibold text-text-primary hover:text-brand-600 transition-colors truncate max-w-[400px]"
          >
            {model?.title || 'Loading...'}
            <Pencil size={12} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </button>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ai"
            size="sm"
            onClick={() => setGapOpen(true)}
            icon={<Sparkles size={12} />}
          >
            Gap Assessment
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRicefwOpen(true)}
            icon={<FileText size={12} />}
          >
            RICEFW
          </Button>
          <ProcessExportMenu />
          <ProcessPresence users={collab.users} myClientId={collab.myClientId} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShareOpen(true)}
            icon={<Share2 size={12} />}
          >
            Share
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Hierarchy sidebar */}
        <aside className="w-72 shrink-0 border-r border-border bg-white">
          {loading ? (
            <LoadingState variant="inline" compact label="Loading hierarchy..." className="pt-8" />
          ) : (
            <ProcessTree />
          )}
        </aside>

        {/* Detail / canvas area */}
        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          {selectedNodeId && selectedNode?.is_leaf ? (
            <ProcessLeafView nodeId={selectedNodeId} orgId={organization?.id} userId={user.id} />
          ) : selectedNodeId ? (
            <div className="flex-1 overflow-y-auto">
              <ProcessNodeDetail nodeId={selectedNodeId} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center px-8">
              <EmptyState
                variant="inline"
                icon={<Workflow size={40} strokeWidth={1.5} />}
                title="Build your process hierarchy"
                description="Add L1 scenarios in the sidebar, drill down to process groups and leaf processes, then select a node to edit its details. Leaf processes get a BPMN swimlane editor."
              />
            </div>
          )}
        </main>
      </div>

      {shareOpen && model && organization && (
        <ProcessShareDialog
          modelId={model.id}
          orgId={organization.id}
          userId={user.id}
          onClose={() => setShareOpen(false)}
        />
      )}

      {gapOpen && <ProcessGapAssessment onClose={() => setGapOpen(false)} />}
      {ricefwOpen && organization && <RicefwPanel orgId={organization.id} onClose={() => setRicefwOpen(false)} />}
    </div>
  )
}
