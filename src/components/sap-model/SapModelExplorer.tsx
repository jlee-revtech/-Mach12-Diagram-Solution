'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { SAP_ENTERPRISE_MODEL as M } from '@/lib/sap-model/data'
import ConfigReport from './ConfigReport'

// React Flow touches window/document — load the canvas client-side only.
const SapModelCanvas = dynamic(() => import('./SapModelCanvas'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center text-[var(--m12-text-muted)] text-sm">Loading model…</div>,
})

type View = 'schema' | 'instances' | 'report'

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: 'schema', label: 'Enterprise Schema', hint: 'Entity types & how each assignment is configured' },
  { id: 'instances', label: 'Live Configuration (A000)', hint: 'The real org structure pulled from the system' },
  { id: 'report', label: 'Configuration Report', hint: 'Tabular report-out of every entity' },
]

export default function SapModelExplorer() {
  const [view, setView] = useState<View>('schema')

  return (
    <div>
      {/* Source provenance banner */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4 text-[11px] text-[var(--m12-text-muted)]">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[#10B981]/40 bg-[#10B981]/10 px-2 py-0.5 text-[#34D399] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" /> Live snapshot
        </span>
        <span className="font-[family-name:var(--font-space-mono)]">{M.source.system}</span>
        <span className="text-[var(--m12-border)]">·</span>
        <span>client {M.source.client}</span>
        <span className="text-[var(--m12-border)]">·</span>
        <span>Controlling Area <b className="text-[var(--m12-text-secondary)]">{M.source.controllingArea}</b></span>
        <span className="text-[var(--m12-border)]">·</span>
        <span>pulled {M.source.pulledOn}</span>
        <span className="text-[var(--m12-border)]">·</span>
        <span className="font-[family-name:var(--font-space-mono)]">{M.source.via}</span>
      </div>

      {/* View switcher */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              title={v.hint}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === v.id ? 'bg-[#2563EB]/12 text-[#2563EB] shadow-sm' : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-[var(--m12-text-muted)]">{VIEWS.find((v) => v.id === view)?.hint}</span>
      </div>

      {/* Content */}
      {view === 'report' ? (
        <ConfigReport model={M} />
      ) : (
        <div className="rounded-xl border border-[var(--m12-border)]/40 overflow-hidden h-[74vh] min-h-[500px] bg-[var(--m12-bg)]">
          <SapModelCanvas key={view} model={M} mode={view} />
        </div>
      )}
    </div>
  )
}
