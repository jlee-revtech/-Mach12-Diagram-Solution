'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { useProcessStore } from '@/lib/process/store'
import ProcessTree from '@/components/process/ProcessTree'
import ProcessNodeDetail from '@/components/process/ProcessNodeDetail'
import ProcessLeafView from '@/components/process/ProcessLeafView'
import ProcessShareDialog from '@/components/process/ProcessShareDialog'
import ProcessGapAssessment from '@/components/process/ProcessGapAssessment'
import VersionBadge from '@/components/VersionBadge'

export default function ProcessModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user, organization, loading: authLoading } = useAuth()

  const model = useProcessStore(s => s.model)
  const loading = useProcessStore(s => s.loading)
  const selectedNodeId = useProcessStore(s => s.selectedNodeId)
  const selectedNode = useProcessStore(s => s.nodes.find(n => n.id === s.selectedNodeId))
  const updateTitle = useProcessStore(s => s.updateTitle)

  const [titleInput, setTitleInput] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [gapOpen, setGapOpen] = useState(false)
  const loadedRef = useRef(false)
  const orgLoadedRef = useRef<string | null>(null)

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
    <div className="h-screen flex flex-col bg-[var(--m12-bg)] text-[var(--m12-text)]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 h-14 border-b border-[var(--m12-border)]/40 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/')}
            className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors shrink-0"
            title="Back to dashboard"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-gradient text-sm font-bold font-[family-name:var(--font-orbitron)] tracking-wide">MACH12</span>
            <span className="text-[var(--m12-text-muted)]">/</span>
            <span className="inline-flex items-center gap-1.5 bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 rounded px-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9]" />
              <span className="text-[10px] font-[family-name:var(--font-space-mono)] text-[#0EA5E9] uppercase tracking-wider font-bold">Process Studio</span>
            </span>
          </div>
          <span className="text-[var(--m12-border)] shrink-0">|</span>
          {editingTitle ? (
            <input
              autoFocus
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleInput(model?.title || ''); setEditingTitle(false) } }}
              onBlur={commitTitle}
              className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)] rounded px-2 py-1 text-sm text-[var(--m12-text)] focus:outline-none min-w-0"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-sm font-semibold text-[var(--m12-text)] hover:text-[#0EA5E9] transition-colors truncate"
            >
              {model?.title || 'Loading…'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setGapOpen(true)}
            className="flex items-center gap-1.5 text-xs text-[#0EA5E9] border border-[#0EA5E9]/40 hover:border-[#0EA5E9]/70 rounded-lg px-3 py-1.5 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5l1.3 3.2 3.2 1.3-3.2 1.3L7 10.5 5.7 7.3 2.5 6l3.2-1.3L7 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
            </svg>
            Gap Assessment
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 text-xs text-[var(--m12-text-secondary)] hover:text-[var(--m12-text)] border border-[var(--m12-border)]/60 hover:border-[var(--m12-border)] rounded-lg px-3 py-1.5 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="3.5" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="10.5" cy="3" r="1.8" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="10.5" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.2 6.1l3.6-2M5.2 7.9l3.6 2" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Share
          </button>
          <VersionBadge />
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Hierarchy sidebar */}
        <aside className="w-72 shrink-0 border-r border-[var(--m12-border)]/40 bg-[var(--m12-bg-card)]/40">
          {loading ? (
            <div className="p-4 text-xs text-[var(--m12-text-muted)]">Loading…</div>
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
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="text-5xl mb-4 opacity-15">&#8694;</div>
              <h2 className="text-base font-semibold text-[var(--m12-text-secondary)] mb-1">Build your process hierarchy</h2>
              <p className="text-xs text-[var(--m12-text-muted)] max-w-sm">
                Add L1 scenarios in the sidebar, drill down to process groups and leaf processes,
                then select a node to edit its details. Leaf processes get a BPMN swimlane editor.
              </p>
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
    </div>
  )
}
