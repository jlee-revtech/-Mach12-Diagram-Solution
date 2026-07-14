'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { SAP_ENTERPRISE_MODEL as M } from '@/lib/sap-model/data'
import { LoadingState } from '@/components/common'
import ConfigReport from './ConfigReport'
import ChangeSetPanel from './ChangeSetPanel'

// React Flow touches window/document — load the canvas client-side only.
const SapModelCanvas = dynamic(() => import('./SapModelCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <LoadingState variant="inline" label="Loading model..." />
    </div>
  ),
})

type View = 'schema' | 'instances' | 'report' | 'changes'

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: 'schema', label: 'Enterprise Schema', hint: 'Entity types & how each assignment is configured' },
  { id: 'instances', label: 'Live Configuration (A000)', hint: 'The real org structure pulled from the system' },
  { id: 'report', label: 'Configuration Report', hint: 'Tabular report-out of every entity' },
  { id: 'changes', label: 'Changes', hint: 'Draft changes to the org model → generate Configuration Instructions for the workstream agents' },
]

export default function SapModelExplorer({ orgId, userId }: { orgId: string; userId: string }) {
  const [view, setView] = useState<View>('schema')

  return (
    <div>
      {/* Source provenance banner */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4 text-[11px] text-text-tertiary">
        <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 bg-status-green-bg text-status-green font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-status-green animate-pulse" /> Live snapshot
        </span>
        <span className="font-mono">{M.source.system}</span>
        <span className="text-border-strong">·</span>
        <span>client {M.source.client}</span>
        <span className="text-border-strong">·</span>
        <span>Controlling Area <b className="text-text-secondary">{M.source.controllingArea}</b></span>
        <span className="text-border-strong">·</span>
        <span>pulled {M.source.pulledOn}</span>
        <span className="text-border-strong">·</span>
        <span className="font-mono">{M.source.via}</span>
      </div>

      {/* View switcher */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 bg-white border border-border rounded-lg p-1 shadow-card">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              title={v.hint}
              className={`px-3 py-1.5 rounded text-body-sm font-medium transition-colors ${
                view === v.id ? 'bg-brand-50 text-brand-600' : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-text-tertiary">{VIEWS.find((v) => v.id === view)?.hint}</span>
      </div>

      {/* Content */}
      {view === 'report' ? (
        <ConfigReport model={M} />
      ) : view === 'changes' ? (
        <ChangeSetPanel orgId={orgId} userId={userId} />
      ) : (
        <div className="rounded-lg border border-border shadow-card overflow-hidden h-[74vh] min-h-[500px] bg-surface-muted">
          <SapModelCanvas key={view} model={M} mode={view} />
        </div>
      )}
    </div>
  )
}
