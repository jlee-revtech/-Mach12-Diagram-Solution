'use client'

import { use, useEffect, useState } from 'react'
import { AlertTriangle, Lock } from 'lucide-react'
import { useProcessStore } from '@/lib/process/store'
import {
  getProcessShareByCode,
  getProcessModelAnon,
  listProcessNodesAnon,
} from '@/lib/supabase/process-models'
import ProcessTree from '@/components/process/ProcessTree'
import ProcessNodeDetail from '@/components/process/ProcessNodeDetail'
import ProcessLeafView from '@/components/process/ProcessLeafView'
import VersionBadge from '@/components/VersionBadge'
import { EmptyState, LoadingState } from '@/components/common'
import { Mach12Logo } from '@/components/brand/Mach12Logo'

export default function ProcessSharePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready'>('loading')
  const selectedNodeId = useProcessStore(s => s.selectedNodeId)
  const selectedNode = useProcessStore(s => s.nodes.find(n => n.id === s.selectedNodeId))
  const model = useProcessStore(s => s.model)

  useEffect(() => {
    async function load() {
      useProcessStore.setState({ readOnly: true })

      const share = await getProcessShareByCode(code)
      if (!share) { setStatus('invalid'); return }

      const m = await getProcessModelAnon(share.process_model_id)
      if (!m) { setStatus('invalid'); return }

      const nodes = await listProcessNodesAnon(share.process_model_id)
      // Reuse the store's org-entity loader in anon mode for lane resolution
      await useProcessStore.getState().loadOrgEntities(m.organization_id, true)

      useProcessStore.setState({ model: m, nodes, loading: false })
      setStatus('ready')
    }
    load()
    return () => { useProcessStore.setState({ readOnly: false, model: null, nodes: [], selectedNodeId: null }) }
  }, [code])

  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-muted">
        <LoadingState variant="inline" label="Loading shared process model…" />
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-muted px-8">
        <EmptyState
          variant="inline"
          icon={<AlertTriangle size={32} />}
          title="Link unavailable"
          description="This share link is invalid or has expired."
        />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-surface-muted">
      {/* Top bar — minimal white read-only chrome over the shared model */}
      <header className="flex items-center justify-between px-5 h-14 bg-white border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <Mach12Logo size={24} />
            <span className="text-gradient font-display font-bold text-body-md tracking-wide">MACH12</span>
          </div>
          <span className="text-body-sm text-text-tertiary">/</span>
          <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded bg-status-blue-bg text-status-blue shrink-0">
            Process Studio
          </span>
          <span className="text-body-md font-semibold text-text-primary truncate">{model?.title}</span>
          <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0">
            <Lock size={10} />
            Read-Only
          </span>
        </div>
        <VersionBadge />
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-72 shrink-0 border-r border-border bg-white">
          <ProcessTree />
        </aside>
        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          {selectedNodeId && selectedNode?.is_leaf ? (
            <ProcessLeafView nodeId={selectedNodeId} readOnly />
          ) : selectedNodeId ? (
            <div className="flex-1 overflow-y-auto">
              <ProcessNodeDetail nodeId={selectedNodeId} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center px-8">
              <p className="text-body-sm text-text-secondary max-w-sm">Select a process node from the hierarchy to view its details.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
