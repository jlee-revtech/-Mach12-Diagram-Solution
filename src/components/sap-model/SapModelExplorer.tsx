'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

import { SAP_ENTERPRISE_MODEL as REFERENCE_MODEL } from '@/lib/sap-model/data'
import type { SapEnterpriseModel } from '@/lib/sap-model/types'
import { LoadingState } from '@/components/common'
import { useAuth } from '@/lib/supabase/auth-context'
import {
  deleteSnapshot as deleteSnapshotApi, fetchSnapshot, fetchSnapshots, pullOrgModel,
} from '@/lib/sap/browserClient'
import type { PullDiagnostic, SapSystem, SnapshotSummary } from '@/lib/sap/types'
import ConfigReport from './ConfigReport'
import ChangeSetPanel from './ChangeSetPanel'
import SapSystemsPanel from './SapSystemsPanel'
import SourceBar, { REFERENCE_SOURCE } from './SourceBar'

// React Flow touches window/document — load the canvas client-side only.
const SapModelCanvas = dynamic(() => import('./SapModelCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <LoadingState variant="inline" label="Loading model..." />
    </div>
  ),
})

type View = 'schema' | 'instances' | 'report' | 'changes' | 'systems'

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: 'schema', label: 'Enterprise Schema', hint: 'Entity types & how each assignment is configured' },
  { id: 'instances', label: 'Live Configuration', hint: 'The real org structure pulled from the system' },
  { id: 'report', label: 'Configuration Report', hint: 'Tabular report-out of every entity' },
  { id: 'changes', label: 'Changes', hint: 'Draft changes to the org model → generate Configuration Instructions for the workstream agents' },
  { id: 'systems', label: 'Systems', hint: 'Hook into an SAP system and pull its org model directly' },
]

export default function SapModelExplorer({ orgId, userId }: { orgId: string; userId: string }) {
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const [view, setView] = useState<View>('schema')

  // Which model is on screen: the snapshot committed with the app, or a pull.
  const [model, setModel] = useState<SapEnterpriseModel>(REFERENCE_MODEL)
  const [selected, setSelected] = useState<string>(REFERENCE_SOURCE)
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([])
  const [diagnostics, setDiagnostics] = useState<PullDiagnostic[] | null>(null)

  const [pullingSystemId, setPullingSystemId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const loadSnapshots = useCallback(async () => {
    try {
      setSnapshots(await fetchSnapshots(token, orgId))
    } catch {
      // The registry may not be migrated yet on this environment. The reference
      // snapshot still renders, so this is not worth an error banner.
    }
  }, [orgId, token])

  useEffect(() => {
    void loadSnapshots()
  }, [loadSnapshots])

  async function handleSelect(id: string) {
    if (id === REFERENCE_SOURCE) {
      setModel(REFERENCE_MODEL)
      setSelected(REFERENCE_SOURCE)
      setDiagnostics(null)
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const found = await fetchSnapshot(token, orgId, id)
      setModel(found.model)
      setDiagnostics(found.diagnostics)
      setSelected(id)
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Could not load that pull.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteSnapshot(id: string) {
    if (!confirm('Delete this stored pull? The system stays registered.')) return
    setBusy(true)
    try {
      await deleteSnapshotApi(token, orgId, id)
      await loadSnapshots()
      setModel(REFERENCE_MODEL)
      setSelected(REFERENCE_SOURCE)
      setDiagnostics(null)
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Could not delete the pull.' })
    } finally {
      setBusy(false)
    }
  }

  async function handlePull(system: SapSystem) {
    setPullingSystemId(system.id)
    setNotice(null)
    try {
      const result = await pullOrgModel(token, orgId, userId, system.id)
      setModel(result.model)
      setDiagnostics(result.diagnostics)
      if (result.snapshot) setSelected(result.snapshot.id)
      await loadSnapshots()

      const failed = result.diagnostics.filter((d) => d.error).length
      setNotice({
        tone: 'ok',
        text:
          `Pulled controlling area ${result.controllingArea} from ${system.name} in ` +
          `${(result.elapsedMs / 1000).toFixed(1)}s via ${result.pulledVia === 'classrun' ? 'the dump class' : 'read-only SQL'}` +
          (failed > 0 ? `. ${failed} read${failed === 1 ? '' : 's'} did not come back - see the banner above.` : '.'),
      })
      setView('instances')
    } catch (err) {
      const e = err as Error & { needsLogon?: boolean }
      setNotice({
        tone: 'error',
        text: e.needsLogon ? `${e.message} Sign in to it first.` : e.message || 'The pull failed.',
      })
    } finally {
      setPullingSystemId(null)
    }
  }

  const live = selected !== REFERENCE_SOURCE

  return (
    <div>
      <SourceBar
        model={model}
        snapshots={snapshots}
        selected={selected}
        onSelect={handleSelect}
        onDelete={handleDeleteSnapshot}
        live={live}
        diagnostics={diagnostics}
        busy={busy}
      />

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
              {v.id === 'instances' && (
                <span className="ml-1.5 text-[10px] font-mono text-text-tertiary">
                  {model.source.controllingArea}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-text-tertiary">{VIEWS.find((v) => v.id === view)?.hint}</span>
      </div>

      {notice && (
        <div
          className={`mb-4 rounded-lg px-3 py-2 text-body-sm border ${
            notice.tone === 'ok'
              ? 'border-status-green/30 bg-status-green-bg text-status-green'
              : 'border-status-red/30 bg-status-red-bg text-status-red'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Content */}
      {view === 'systems' ? (
        <SapSystemsPanel
          orgId={orgId}
          userId={userId}
          token={token}
          onPull={handlePull}
          pullingSystemId={pullingSystemId}
        />
      ) : view === 'report' ? (
        <ConfigReport model={model} />
      ) : view === 'changes' ? (
        <ChangeSetPanel orgId={orgId} userId={userId} model={model} />
      ) : (
        <div className="rounded-lg border border-border shadow-card overflow-hidden h-[74vh] min-h-[500px] bg-surface-muted">
          <SapModelCanvas key={`${view}-${selected}`} model={model} mode={view === 'instances' ? 'instances' : 'schema'} />
        </div>
      )}
    </div>
  )
}
