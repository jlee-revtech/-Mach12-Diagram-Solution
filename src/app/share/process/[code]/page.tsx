'use client'

import { use, useEffect, useState } from 'react'
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
      <div className="h-screen flex items-center justify-center bg-[var(--m12-bg)] text-[var(--m12-text-muted)] text-sm">
        Loading shared process model…
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[var(--m12-bg)] text-center px-8">
        <div className="text-5xl mb-4 opacity-20">&#9888;</div>
        <h1 className="text-lg font-semibold text-[var(--m12-text-secondary)] mb-1">Link unavailable</h1>
        <p className="text-sm text-[var(--m12-text-muted)]">This share link is invalid or has expired.</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--m12-bg)] text-[var(--m12-text)]">
      <header className="flex items-center justify-between px-5 h-14 border-b border-[var(--m12-border)]/40 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-gradient text-sm font-bold font-[family-name:var(--font-orbitron)] tracking-wide">MACH12</span>
          <span className="text-[var(--m12-text-muted)]">/</span>
          <span className="inline-flex items-center gap-1.5 bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 rounded px-2 py-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9]" />
            <span className="text-[10px] font-[family-name:var(--font-space-mono)] text-[#0EA5E9] uppercase tracking-wider font-bold">Process Studio</span>
          </span>
          <span className="text-[var(--m12-border)]">|</span>
          <span className="text-sm font-semibold text-[var(--m12-text)] truncate">{model?.title}</span>
          <span className="text-[9px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] border border-[var(--m12-border)]/50 rounded px-1.5 py-0.5">Read-only</span>
        </div>
        <VersionBadge />
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-72 shrink-0 border-r border-[var(--m12-border)]/40 bg-[var(--m12-bg-card)]/40">
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
              <p className="text-xs text-[var(--m12-text-muted)] max-w-sm">Select a process node from the hierarchy to view its details.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
