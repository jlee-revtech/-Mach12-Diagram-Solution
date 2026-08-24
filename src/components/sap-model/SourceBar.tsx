'use client'

import { Clock, Database, Trash2 } from 'lucide-react'

import { Button } from '@/components/common'
import type { SapEnterpriseModel } from '@/lib/sap-model/types'
import type { PullDiagnostic, SnapshotSummary } from '@/lib/sap/types'

/**
 * Provenance for whatever model is on screen, and the control for switching
 * between the reference snapshot committed with the app and every org model
 * pulled from a live system.
 */

export const REFERENCE_SOURCE = 'reference'

interface Props {
  model: SapEnterpriseModel
  snapshots: SnapshotSummary[]
  selected: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  live: boolean
  diagnostics: PullDiagnostic[] | null
  busy?: boolean
}

export default function SourceBar({
  model, snapshots, selected, onSelect, onDelete, live, diagnostics, busy,
}: Props) {
  const failures = (diagnostics ?? []).filter((d) => d.error)

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-tertiary">
        <span
          className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-medium ${
            live ? 'bg-status-green-bg text-status-green' : 'bg-status-blue-bg text-status-blue'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-status-green animate-pulse' : 'bg-status-blue'}`}
          />
          {live ? 'Live pull' : 'Reference snapshot'}
        </span>
        <span className="font-mono">{model.source.system}</span>
        <span className="text-border-strong">·</span>
        <span>client {model.source.client}</span>
        <span className="text-border-strong">·</span>
        <span>
          Controlling Area <b className="text-text-secondary">{model.source.controllingArea}</b>
        </span>
        <span className="text-border-strong">·</span>
        <span>pulled {model.source.pulledOn}</span>
        <span className="text-border-strong">·</span>
        <span className="font-mono">{model.source.via}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2">
          <span className="text-[11px] font-medium text-text-secondary inline-flex items-center gap-1">
            <Database size={12} /> Source
          </span>
          <select
            value={selected}
            onChange={(e) => onSelect(e.target.value)}
            disabled={busy}
            className="h-8 px-2 rounded-lg border border-border bg-white text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 max-w-[28rem]"
          >
            <option value={REFERENCE_SOURCE}>
              Reference snapshot — vhcals4hcs A000 (committed with the app)
            </option>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.systemLabel} · {s.controllingArea}
                {s.sapClient ? ` · client ${s.sapClient}` : ''} · {formatWhen(s.pulledAt)}
              </option>
            ))}
          </select>
        </label>

        {selected !== REFERENCE_SOURCE && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={13} />}
            onClick={() => onDelete(selected)}
            disabled={busy}
          >
            Delete pull
          </Button>
        )}

        {snapshots.length > 0 && (
          <span className="text-[11px] text-text-tertiary inline-flex items-center gap-1">
            <Clock size={11} />
            {snapshots.length} stored {snapshots.length === 1 ? 'pull' : 'pulls'}
          </span>
        )}
      </div>

      {failures.length > 0 && (
        <div className="rounded-lg border border-status-yellow/40 bg-status-yellow-bg px-3 py-2 text-[11px] text-text-secondary">
          <b className="text-text-primary">
            {failures.length} of {diagnostics!.length} reads did not come back.
          </b>{' '}
          Those sections are empty rather than wrong:{' '}
          {failures.map((f) => f.table).join(', ')}.
        </div>
      )}
    </div>
  )
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
