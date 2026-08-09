'use client'

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  AlertTriangle, Check, ClipboardCopy, Download, FileCode2, Hammer, KeyRound, Link2,
  Radar, ScrollText, Server, ShieldAlert, ShieldCheck, Trash2, X,
} from 'lucide-react'
import { Button, CollapsibleSection, EmptyState } from '@/components/common'
import {
  createGovernedSystem, deleteGovernedSystem,
} from '@/lib/supabase/security-design'
import type {
  ExplorationFindings, GovernanceArtifact, GovernanceExploration, GovernancePlan,
  GovernancePlanDoc, GovernanceRoleMapEntry, GovernedKind, GovernedSystem, RiskSeverity,
} from '@/lib/security/types'
import type { ProcessRole } from '@/lib/process/types'
import type { Persona } from '@/lib/sipoc/types'
import { apiError, asFindings, asPlanDoc, authHeaders, newestFirst } from './designStudioShared'

const INPUT_CLASSES = 'h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none'

const SYSTEM_STATUS_STYLE: Record<string, string> = {
  registered: 'bg-gray-100 text-gray-500',
  explored: 'bg-status-blue-bg text-status-blue',
  planned: 'bg-purple-50 text-purple-700',
  approved: 'bg-amber-50 text-amber-800',
  governed: 'bg-status-green-bg text-status-green',
}

const PLAN_STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  review: 'bg-status-blue-bg text-status-blue',
  approved: 'bg-status-green-bg text-status-green',
  built: 'bg-purple-50 text-purple-700',
  rejected: 'bg-status-red-bg text-status-red',
}

const SEVERITY_ORDER: RiskSeverity[] = ['critical', 'high', 'medium', 'low']

const SEVERITY_STYLE: Record<RiskSeverity, { chip: string; card: string }> = {
  critical: { chip: 'bg-red-100 text-red-800 border-red-300', card: 'border-red-300 bg-red-50/70' },
  high: { chip: 'bg-orange-50 text-orange-700 border-orange-200', card: 'border-orange-200 bg-orange-50/60' },
  medium: { chip: 'bg-amber-50 text-amber-800 border-amber-200', card: 'border-amber-200 bg-amber-50/50' },
  low: { chip: 'bg-slate-50 text-slate-700 border-slate-200', card: 'border-slate-200 bg-slate-50/60' },
}

const DISPOSITION_STYLE: Record<string, string> = {
  map: 'bg-status-green-bg text-status-green',
  create: 'bg-status-blue-bg text-status-blue',
  retire: 'bg-slate-100 text-slate-600',
  review: 'bg-amber-50 text-amber-800',
}

const ARTIFACT_KIND_STYLE: Record<string, string> = {
  policy: 'bg-purple-50 text-purple-700 border-purple-200',
  config: 'bg-status-blue-bg text-status-blue border-blue-200',
  code: 'bg-slate-100 text-slate-700 border-slate-200',
  mapping: 'bg-amber-50 text-amber-800 border-amber-200',
  runbook: 'bg-status-green-bg text-status-green border-green-200',
  doc: 'bg-surface-muted text-text-secondary border-border',
}

const SURFACE_KIND_STYLE: Record<string, string> = {
  admin: 'bg-red-50 text-red-700',
  login: 'bg-amber-50 text-amber-800',
  api: 'bg-status-blue-bg text-status-blue',
  app: 'bg-surface-muted text-text-secondary',
}

// The build step never touches the target system. This sentence is repeated at
// every point the operator could mistake artifact generation for provisioning.
const HUMAN_STEP_NOTE = 'Artifacts are generated into the studio. Applying them to the target system is a human step.'

interface Props {
  orgId: string
  systems: GovernedSystem[]
  explorations: GovernanceExploration[]
  plans: GovernancePlan[]
  roleMap: GovernanceRoleMapEntry[]
  artifacts: GovernanceArtifact[]
  roles: ProcessRole[]
  personas: Persona[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  setSystems: Dispatch<SetStateAction<GovernedSystem[]>>
  reload: () => Promise<void> | void
}

// Tab 2 — Explore & Govern. Register the COTS and custom apps around SAP,
// explore them READ-ONLY, draft a governance plan harmonized with the SAP roles
// and personas already governed here, review + approve it, and only then
// generate artifacts into the studio.
export default function GovernToolsTab({
  orgId, systems, explorations, plans, roleMap, artifacts, roles, personas,
  selectedId, onSelect, setSystems, reload,
}: Props) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<GovernedKind>('custom')
  const [vendor, setVendor] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [sourcePath, setSourcePath] = useState('')
  const [criticality, setCriticality] = useState<'' | 'low' | 'medium' | 'high'>('')
  const [busy, setBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const selected = systems.find(s => s.id === selectedId) ?? null

  const handleCreate = async () => {
    if (!name.trim() || busy) return
    setBusy(true); setCreateError(null)
    try {
      const created = await createGovernedSystem(orgId, {
        name: name.trim(),
        kind,
        ...(vendor.trim() ? { vendor: vendor.trim() } : {}),
        ...(baseUrl.trim() ? { base_url: baseUrl.trim() } : {}),
        ...(sourcePath.trim() ? { source_path: sourcePath.trim() } : {}),
        ...(criticality ? { criticality } : {}),
      })
      setSystems(x => [...x, created])
      onSelect(created.id)
      setName(''); setVendor(''); setBaseUrl(''); setSourcePath(''); setCriticality(''); setKind('custom')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not register the system.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Stop governing this system? Its explorations, plan, role map, and generated artifacts are removed from the studio.')) return
    setSystems(x => x.filter(s => s.id !== id))
    if (selectedId === id) onSelect(null)
    await deleteGovernedSystem(id).catch(() => reload())
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,340px)_1fr] gap-4 items-start">
      {/* ─── Register + list (left) ─── */}
      <aside className="space-y-3">
        <div className="bg-white rounded-lg border border-border shadow-card p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Register a system to govern</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="System name (e.g. Field Service Portal)"
            aria-label="System name"
            className={`w-full ${INPUT_CLASSES}`}
          />
          <div className="flex gap-2">
            <select value={kind} onChange={e => setKind(e.target.value as GovernedKind)} aria-label="System kind" className={`flex-1 min-w-0 ${INPUT_CLASSES}`}>
              <option value="custom">Custom / vibe-coded</option>
              <option value="cots">COTS</option>
            </select>
            <select value={criticality} onChange={e => setCriticality(e.target.value as '' | 'low' | 'medium' | 'high')} aria-label="Criticality" className={`flex-1 min-w-0 ${INPUT_CLASSES}`}>
              <option value="">Criticality</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <input
            value={vendor}
            onChange={e => setVendor(e.target.value)}
            placeholder="Vendor (optional)"
            aria-label="Vendor"
            className={`w-full ${INPUT_CLASSES}`}
          />
          <input
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="Base URL (https://...)"
            aria-label="Base URL"
            className={`w-full ${INPUT_CLASSES} font-mono text-[11px] placeholder:font-sans placeholder:text-body-sm`}
          />
          <div className="flex gap-2">
            <input
              value={sourcePath}
              onChange={e => setSourcePath(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Source path (local repo)"
              aria-label="Source path"
              className={`flex-1 min-w-0 ${INPUT_CLASSES} font-mono text-[11px] placeholder:font-sans placeholder:text-body-sm`}
            />
            <Button onClick={handleCreate} disabled={busy || !name.trim()}>Add</Button>
          </div>
          <p className="text-[10px] text-text-tertiary">
            Register only systems you administer. Exploration is read-only reconnaissance — no credentials are submitted and nothing in the target is changed.
          </p>
          {createError && <p className="text-[10px] text-status-red">{createError}</p>}
        </div>

        <div className="bg-white rounded-lg border border-border shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-muted/60">
            <span className="text-label uppercase text-text-secondary">Governed systems</span>
            <span className="text-[11px] text-text-tertiary tabular-nums">({systems.length})</span>
          </div>
          {systems.length === 0 ? (
            <div className="text-body-sm text-text-tertiary py-6 px-4 text-center">
              Nothing under governance yet. Register a COTS or custom app above, or ask the security agent to register one.
            </div>
          ) : (
            <ul className="max-h-[65vh] overflow-y-auto">
              {systems.map(s => {
                const ex = explorations.filter(e => e.system_id === s.id).length
                const pl = plans.filter(p => p.system_id === s.id).length
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(s.id)}
                      className={`w-full border-b border-border last:border-0 px-3 py-2.5 text-left transition-colors ${selectedId === s.id ? 'bg-brand-50' : 'hover:bg-surface-muted/50'}`}
                    >
                      <div className="flex items-start gap-2">
                        <Server size={13} className="text-text-tertiary shrink-0 mt-0.5" />
                        <span className="text-body-sm font-medium text-text-primary flex-1 min-w-0">{s.name}</span>
                        <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 shrink-0 ${SYSTEM_STATUS_STYLE[s.status] ?? 'bg-surface-muted text-text-secondary'}`}>{s.status}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 pl-5">
                        <span className="text-[10px] uppercase tracking-wider text-text-tertiary">{s.kind}</span>
                        {s.vendor && <span className="text-[10px] text-text-secondary truncate">{s.vendor}</span>}
                        <span className="text-[10px] text-text-tertiary tabular-nums whitespace-nowrap ml-auto">
                          {ex} scan{ex === 1 ? '' : 's'} · {pl} plan{pl === 1 ? '' : 's'}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ─── System detail (right) ─── */}
      <section>
        {!selected ? (
          <EmptyState
            variant="dashed"
            icon={<ShieldCheck size={28} />}
            title="Select a governed system"
            description="Pick a system to explore it read-only, draft a governance plan harmonized with the SAP roles and personas already governed here, review and approve it, and generate the security design artifacts into the studio."
          />
        ) : (
          <SystemDetail
            key={selected.id}
            orgId={orgId}
            system={selected}
            explorations={explorations.filter(e => e.system_id === selected.id)}
            plans={plans.filter(p => p.system_id === selected.id)}
            roleMap={roleMap}
            artifacts={artifacts}
            roles={roles}
            personas={personas}
            onDelete={() => handleDelete(selected.id)}
            reload={reload}
          />
        )}
      </section>
    </div>
  )
}

// ─── System detail ─────────────────────────────────────

function SystemDetail({
  orgId, system, explorations, plans, roleMap, artifacts, roles, personas, onDelete, reload,
}: {
  orgId: string
  system: GovernedSystem
  explorations: GovernanceExploration[]
  plans: GovernancePlan[]
  roleMap: GovernanceRoleMapEntry[]
  artifacts: GovernanceArtifact[]
  roles: ProcessRole[]
  personas: Persona[]
  onDelete: () => void
  reload: () => Promise<void> | void
}) {
  const [exploring, setExploring] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmBuild, setConfirmBuild] = useState(false)

  const latestExploration = newestFirst(explorations)[0] ?? null
  const plan = newestFirst(plans)[0] ?? null
  const findings = asFindings(latestExploration)
  const planDoc = asPlanDoc(plan)
  const planStatus = plan ? plan.status : null
  const mapRows = plan ? roleMap.filter(r => r.plan_id === plan.id) : []
  const planArtifacts = plan ? artifacts.filter(a => a.plan_id === plan.id) : []

  const post = useCallback(async (url: string, body: Record<string, unknown>, method: 'POST' | 'PATCH' = 'POST') => {
    const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) })
    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(apiError(data, `Request failed (${res.status}).`))
    if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
      throw new Error((data as { error: string }).error)
    }
    return data
  }, [])

  const runExplore = async () => {
    setExploring(true); setError(null)
    try {
      await post('/api/security/explore', { orgId, systemId: system.id })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Exploration failed.')
    } finally {
      setExploring(false)
    }
  }

  const draftPlan = async () => {
    setPlanning(true); setError(null)
    try {
      await post('/api/security/plan', {
        orgId,
        systemId: system.id,
        ...(latestExploration ? { explorationId: latestExploration.id } : {}),
      })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Drafting the governance plan failed.')
    } finally {
      setPlanning(false)
    }
  }

  const setPlanStatus = async (status: 'review' | 'approved' | 'rejected') => {
    if (!plan) return
    setReviewing(true); setError(null)
    try {
      await post('/api/security/plan', { orgId, planId: plan.id, status }, 'PATCH')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the plan status.')
    } finally {
      setReviewing(false)
    }
  }

  const runBuild = async () => {
    if (!plan) return
    setConfirmBuild(false)
    setBuilding(true); setError(null)
    try {
      await post('/api/security/build', { orgId, planId: plan.id, humanConfirmed: true })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Artifact generation failed.')
    } finally {
      setBuilding(false)
    }
  }

  const canExplore = !!(system.base_url || system.source_path)

  return (
    <div className="space-y-3">
      {/* ─── System header ─── */}
      <div className="bg-white rounded-lg border border-border shadow-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Server size={15} className="text-brand-600 shrink-0" />
          <span className="text-body-md font-semibold text-text-primary flex-1 min-w-0 truncate">{system.name}</span>
          <span className="text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 shrink-0 bg-surface-muted text-text-secondary">{system.kind}</span>
          <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 shrink-0 ${SYSTEM_STATUS_STYLE[system.status] ?? 'bg-surface-muted text-text-secondary'}`}>{system.status}</span>
          <Button variant="ghost" size="sm" iconOnly icon={<Trash2 size={14} />} aria-label="Stop governing this system" title="Stop governing this system" onClick={onDelete} />
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {system.vendor && (
            <div className="flex items-baseline gap-2 min-w-0">
              <dt className="text-[10px] uppercase tracking-wider text-text-tertiary shrink-0">Vendor</dt>
              <dd className="text-[11px] text-text-secondary truncate">{system.vendor}</dd>
            </div>
          )}
          {system.criticality && (
            <div className="flex items-baseline gap-2 min-w-0">
              <dt className="text-[10px] uppercase tracking-wider text-text-tertiary shrink-0">Criticality</dt>
              <dd className="text-[11px] text-text-secondary">{system.criticality}</dd>
            </div>
          )}
          {system.base_url && (
            <div className="flex items-baseline gap-2 min-w-0">
              <dt className="text-[10px] uppercase tracking-wider text-text-tertiary shrink-0">Base URL</dt>
              <dd className="text-[11px] font-mono text-text-secondary truncate" title={system.base_url}>{system.base_url}</dd>
            </div>
          )}
          {system.source_path && (
            <div className="flex items-baseline gap-2 min-w-0">
              <dt className="text-[10px] uppercase tracking-wider text-text-tertiary shrink-0">Source</dt>
              <dd className="text-[11px] font-mono text-text-secondary truncate" title={system.source_path}>{system.source_path}</dd>
            </div>
          )}
          {system.description && (
            <div className="sm:col-span-2 flex items-baseline gap-2 min-w-0">
              <dt className="text-[10px] uppercase tracking-wider text-text-tertiary shrink-0">Notes</dt>
              <dd className="text-[11px] text-text-secondary">{system.description}</dd>
            </div>
          )}
        </dl>

        {/* ─── Actions ─── */}
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
          <Button variant="ai" size="sm" loading={exploring} disabled={!canExplore} icon={<Radar size={13} />} onClick={runExplore}>
            {latestExploration ? 'Explore again' : 'Explore'}
          </Button>
          <Button variant="secondary" size="sm" loading={planning} disabled={!latestExploration} icon={<ScrollText size={13} />} onClick={draftPlan}>
            {plan ? 'Draft a new plan' : 'Draft plan'}
          </Button>
          <span className="text-[10px] text-text-tertiary">
            {!canExplore
              ? 'Add a base URL or a source path before exploring.'
              : exploring
                ? 'Read-only reconnaissance in progress — GET/HEAD only, capped and same-origin.'
                : 'Exploration is read-only. Nothing is authenticated, submitted, or changed in the target system.'}
          </span>
        </div>
        {error && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-status-red-bg px-3 py-2 text-[11px] text-text-primary">
            <AlertTriangle size={14} className="text-status-red shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap">{error}</span>
          </div>
        )}
      </div>

      {/* ─── Findings ─── */}
      {latestExploration ? (
        <FindingsPanel findings={findings} exploration={latestExploration} />
      ) : (
        <EmptyState
          variant="dashed"
          compact
          icon={<Radar size={22} />}
          title="Not explored yet"
          description="Run Explore to gather the auth model, discovered roles and permissions, surfaces, header and cookie posture, and risks — read-only, with an honest list of anything unreachable."
        />
      )}

      {/* ─── Plan ─── */}
      {plan && (
        <>
          <CollapsibleSection
            id="gov-plan"
            storageKey="mach12-studio:sec-design"
            tone="purple"
            title="Governance plan"
            actions={
              <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 ${PLAN_STATUS_STYLE[planStatus ?? 'draft'] ?? 'bg-surface-muted text-text-secondary'}`}>
                {planStatus}
              </span>
            }
          >
            <PlanView doc={planDoc} />
          </CollapsibleSection>

          <CollapsibleSection
            id="gov-harmonization"
            storageKey="mach12-studio:sec-design"
            tone="blue"
            title="Harmonization with SAP roles and personas"
            count={mapRows.length}
          >
            <HarmonizationTable rows={mapRows} roles={roles} personas={personas} />
          </CollapsibleSection>

          {/* ─── Review bar ─── */}
          <div className="bg-white rounded-lg border border-border shadow-card px-4 py-3 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Operator review</span>
            <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 ${PLAN_STATUS_STYLE[planStatus ?? 'draft'] ?? 'bg-surface-muted text-text-secondary'}`}>
              {planStatus}
            </span>
            {plan.approved_at && (
              <span className="text-[10px] text-text-tertiary">approved {new Date(plan.approved_at).toLocaleString()}</span>
            )}
            {plan.built_at && (
              <span className="text-[10px] text-text-tertiary">built {new Date(plan.built_at).toLocaleString()}</span>
            )}
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              {planStatus === 'draft' && (
                <Button variant="secondary" size="sm" loading={reviewing} onClick={() => setPlanStatus('review')}>Submit for review</Button>
              )}
              {planStatus === 'review' && (
                <>
                  <Button variant="secondary" size="sm" loading={reviewing} icon={<Check size={12} />} onClick={() => setPlanStatus('approved')}>Approve</Button>
                  <Button variant="destructive" size="sm" loading={reviewing} icon={<X size={12} />} onClick={() => setPlanStatus('rejected')}>Reject</Button>
                </>
              )}
              {planStatus === 'approved' && (
                <Button variant="ai" size="sm" loading={building} icon={<Hammer size={13} />} onClick={() => setConfirmBuild(true)}>
                  Build security design
                </Button>
              )}
            </div>
            <p className="w-full text-[10px] text-text-tertiary">
              {planStatus === 'rejected'
                ? 'This plan was rejected. Explore again or draft a new plan.'
                : planStatus === 'built'
                  ? HUMAN_STEP_NOTE
                  : `Build is available only on an approved plan, and only with explicit confirmation. ${HUMAN_STEP_NOTE}`}
            </p>
          </div>

          {/* ─── Artifacts ─── */}
          {planArtifacts.length > 0 && (
            <CollapsibleSection
              id="gov-artifacts"
              storageKey="mach12-studio:sec-design"
              tone="green"
              title="Generated artifacts"
              count={planArtifacts.length}
            >
              <p className="text-[11px] text-text-tertiary mb-2">{HUMAN_STEP_NOTE}</p>
              <ul className="space-y-2">
                {planArtifacts.map(a => <ArtifactCard key={a.id} artifact={a} />)}
              </ul>
            </CollapsibleSection>
          )}
        </>
      )}

      {confirmBuild && plan && (
        <BuildConfirmDialog
          systemName={system.name}
          artifactPlan={planDoc.buildPlan}
          onCancel={() => setConfirmBuild(false)}
          onConfirm={runBuild}
        />
      )}
    </div>
  )
}

// ─── Findings ──────────────────────────────────────────

function FindingsPanel({ findings, exploration }: { findings: ExplorationFindings; exploration: GovernanceExploration }) {
  const risksBySeverity = SEVERITY_ORDER
    .map(sev => ({ sev, list: findings.risks.filter(r => r.severity === sev) }))
    .filter(g => g.list.length > 0)
  const unclassified = findings.risks.filter(r => !SEVERITY_ORDER.includes(r.severity))
  const headers = Object.entries(findings.posture.securityHeaders)
  const summary = exploration.summary

  return (
    <CollapsibleSection
      id="gov-findings"
      storageKey="mach12-studio:sec-design"
      tone="neutral"
      title="Exploration findings"
      count={findings.risks.length}
      actions={
        <span className="text-[10px] text-text-tertiary">
          {exploration.status}
          {exploration.created_at ? ` · ${new Date(exploration.created_at).toLocaleString()}` : ''}
        </span>
      }
    >
      <div className="space-y-4">
        {summary && <p className="text-[12px] text-text-secondary whitespace-pre-wrap">{summary}</p>}

        {/* Auth model + posture */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <KeyRound size={12} className="text-brand-600" />
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Auth model</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip label="Mechanism" value={findings.authModel.mechanism || 'not determined'} />
              {findings.authModel.idp && <Chip label="IdP" value={findings.authModel.idp} />}
              <Chip
                label="MFA"
                value={findings.authModel.mfa === true ? 'evidence found' : findings.authModel.mfa === false ? 'no evidence' : 'unknown'}
              />
            </div>
            {findings.authModel.notes.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {findings.authModel.notes.map((n, i) => (
                  <li key={i} className="text-[11px] text-text-secondary">· {n}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShieldCheck size={12} className="text-brand-600" />
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Posture</span>
            </div>
            {headers.length === 0 && findings.posture.cookieFlags.length === 0 && !findings.posture.framework && findings.posture.authLibraries.length === 0 ? (
              <p className="text-[11px] text-text-tertiary">Nothing observed — the system was not reachable over HTTP, or only source was scanned.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {headers.map(([h, v]) => (
                  <span
                    key={h}
                    title={v ?? 'header absent'}
                    className={`text-[10px] rounded px-1.5 py-0.5 border font-mono ${v ? 'bg-status-green-bg text-status-green border-green-200' : 'bg-status-red-bg text-status-red border-red-200'}`}
                  >
                    {h}{v ? '' : ' missing'}
                  </span>
                ))}
                {findings.posture.cookieFlags.map((c, i) => (
                  <span key={`c${i}`} className="text-[10px] rounded px-1.5 py-0.5 border border-border bg-white text-text-secondary font-mono">{c}</span>
                ))}
                {findings.posture.framework && <Chip label="Framework" value={findings.posture.framework} />}
                {findings.posture.authLibraries.map((l, i) => (
                  <span key={`l${i}`} className="text-[10px] rounded px-1.5 py-0.5 border border-blue-200 bg-status-blue-bg text-status-blue font-mono">{l}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Discovered roles */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1.5">
            Discovered roles <span className="tabular-nums">({findings.discoveredRoles.length})</span>
          </div>
          {findings.discoveredRoles.length === 0 ? (
            <p className="text-[11px] text-text-tertiary">No role enumeration was observed. Nothing is inferred that was not seen.</p>
          ) : (
            <ul className="space-y-1">
              {findings.discoveredRoles.map((r, i) => (
                <li key={i} className="rounded border border-border bg-white px-2 py-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-mono font-medium text-text-primary">{r.name}</span>
                    <span className="text-[9px] uppercase tracking-wider text-text-tertiary bg-surface-muted rounded px-1 py-0.5">{r.source}</span>
                    {r.description && <span className="text-[11px] text-text-secondary truncate">{r.description}</span>}
                  </div>
                  {(r.permissions ?? []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(r.permissions ?? []).slice(0, 24).map((p, j) => (
                        <span key={j} className="text-[10px] font-mono text-text-secondary bg-surface-muted rounded px-1 py-0.5">{p}</span>
                      ))}
                      {(r.permissions ?? []).length > 24 && (
                        <span className="text-[10px] text-text-tertiary">+{(r.permissions ?? []).length - 24} more</span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Permissions */}
        {findings.permissions.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1.5">
              Permissions <span className="tabular-nums">({findings.permissions.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {findings.permissions.slice(0, 80).map((p, i) => (
                <span key={i} className="text-[10px] font-mono text-text-secondary bg-surface-muted border border-border rounded px-1 py-0.5">{p}</span>
              ))}
              {findings.permissions.length > 80 && (
                <span className="text-[10px] text-text-tertiary">+{findings.permissions.length - 80} more</span>
              )}
            </div>
          </div>
        )}

        {/* Surfaces */}
        {findings.surfaces.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1.5">
              Surfaces <span className="tabular-nums">({findings.surfaces.length})</span>
            </div>
            <ul className="space-y-1">
              {findings.surfaces.map((s, i) => (
                <li key={i} className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  {s.kind && (
                    <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1 py-0.5 ${SURFACE_KIND_STYLE[s.kind] ?? 'bg-surface-muted text-text-secondary'}`}>{s.kind}</span>
                  )}
                  <span className="text-text-primary font-medium">{s.label}</span>
                  {s.url && <span className="font-mono text-text-tertiary truncate">{s.url}</span>}
                  {s.notes && <span className="text-text-secondary">— {s.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risks */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1.5">
            Risks <span className="tabular-nums">({findings.risks.length})</span>
          </div>
          {findings.risks.length === 0 ? (
            <p className="text-[11px] text-text-tertiary">No risks were recorded for what could be observed.</p>
          ) : (
            <div className="space-y-2">
              {risksBySeverity.map(({ sev, list }) => (
                <div key={sev}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShieldAlert size={12} className="text-text-tertiary" />
                    <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 border ${SEVERITY_STYLE[sev].chip}`}>{sev}</span>
                    <span className="text-[10px] text-text-tertiary tabular-nums">{list.length}</span>
                  </div>
                  <ul className="space-y-1">
                    {list.map(r => (
                      <li key={r.id} className={`rounded-lg border px-2.5 py-2 ${SEVERITY_STYLE[sev].card}`}>
                        <div className="text-[11px] font-semibold text-text-primary">{r.title}</div>
                        <p className="text-[11px] text-text-secondary whitespace-pre-wrap">{r.detail}</p>
                        {r.evidence && <p className="mt-0.5 text-[10px] font-mono text-text-tertiary break-all">{r.evidence}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {unclassified.length > 0 && (
                <ul className="space-y-1">
                  {unclassified.map(r => (
                    <li key={r.id} className="rounded-lg border border-border bg-surface-muted/50 px-2.5 py-2">
                      <div className="text-[11px] font-semibold text-text-primary">{r.title}</div>
                      <p className="text-[11px] text-text-secondary whitespace-pre-wrap">{r.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Evidence */}
        {findings.evidence.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1.5">
              Evidence <span className="tabular-nums">({findings.evidence.length})</span>
            </div>
            <ul className="space-y-0.5">
              {findings.evidence.map((e, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px]">
                  {e.kind === 'url' ? <Link2 size={11} className="text-text-tertiary shrink-0 mt-0.5" /> : <FileCode2 size={11} className="text-text-tertiary shrink-0 mt-0.5" />}
                  <span className="font-mono text-text-secondary break-all">{e.ref}</span>
                  {e.note && <span className="text-text-tertiary">— {e.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Honest footer */}
        <div className="rounded-lg border border-border bg-surface-muted/60 px-3 py-2">
          <p className="text-[11px] text-text-secondary tabular-nums">
            Scanned {findings.scanned.urls} URL{findings.scanned.urls === 1 ? '' : 's'} and {findings.scanned.files} file{findings.scanned.files === 1 ? '' : 's'}.
            {findings.unreachable.length > 0
              ? ` ${findings.unreachable.length} target${findings.unreachable.length === 1 ? ' was' : 's were'} unreachable.`
              : ' Nothing was reported unreachable.'}
          </p>
          {findings.unreachable.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-1">
              {findings.unreachable.map((u, i) => (
                <li key={i} className="text-[10px] font-mono text-text-tertiary bg-white border border-border rounded px-1 py-0.5 break-all">{u}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[10px] text-text-tertiary">
            Read-only reconnaissance: GET/HEAD only, capped and same-origin, no credentials submitted. Anything not listed above was not observed and is not inferred.
          </p>
        </div>
      </div>
    </CollapsibleSection>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[10px] rounded px-1.5 py-0.5 border border-border bg-white text-text-secondary">
      <span className="text-text-tertiary uppercase tracking-wider">{label}:</span> {value}
    </span>
  )
}

// ─── Plan view ─────────────────────────────────────────

function PlanView({ doc }: { doc: GovernancePlanDoc }) {
  return (
    <div className="space-y-3">
      {doc.objective && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Objective</div>
          <p className="text-[12px] text-text-secondary whitespace-pre-wrap">{doc.objective}</p>
        </div>
      )}

      {(doc.identity.target || doc.identity.steps.length > 0) && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Target identity model</div>
          {doc.identity.target && <p className="text-[12px] text-text-primary font-medium">{doc.identity.target}</p>}
          <ol className="mt-1 space-y-0.5 list-decimal list-inside">
            {doc.identity.steps.map((s, i) => <li key={i} className="text-[11px] text-text-secondary">{s}</li>)}
          </ol>
        </div>
      )}

      {doc.roleModel.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Least-privilege role model ({doc.roleModel.length})</div>
          <ul className="space-y-1">
            {doc.roleModel.map((r, i) => (
              <li key={i} className="rounded border border-border bg-surface-muted/40 px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono font-medium text-text-primary">{r.name}</span>
                  {r.mapsToSapRole && (
                    <span className="text-[10px] font-mono rounded px-1 py-0.5 bg-status-blue-bg text-status-blue">→ {r.mapsToSapRole}</span>
                  )}
                </div>
                {r.purpose && <p className="text-[11px] text-text-secondary">{r.purpose}</p>}
                {(r.permissions ?? []).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(r.permissions ?? []).map((p, j) => (
                      <span key={j} className="text-[10px] font-mono text-text-secondary bg-white border border-border rounded px-1 py-0.5">{p}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.controls.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Controls ({doc.controls.length})</div>
          <ul className="space-y-1">
            {doc.controls.map((c, i) => (
              <li key={i} className="text-[11px]">
                <span className="font-mono text-text-primary font-medium">{c.id}</span>
                {c.standard && <span className="ml-1 text-[10px] rounded px-1 py-0.5 bg-purple-50 text-purple-700">{c.standard}</span>}
                <span className="ml-1 text-text-primary">{c.title}</span>
                {c.detail && <span className="block text-text-secondary">{c.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.sod.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Segregation of duties ({doc.sod.length})</div>
          <ul className="space-y-1">
            {doc.sod.map((s, i) => (
              <li key={i} className="rounded border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-[11px]">
                <span className="font-medium text-amber-900">{s.pair}</span>
                {s.detail && <span className="block text-amber-900/80">{s.detail}</span>}
                {s.mitigation && <span className="block text-text-secondary">Mitigation: {s.mitigation}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.remediation.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Remediation ({doc.remediation.length})</div>
          <ul className="space-y-1">
            {doc.remediation.map((r, i) => (
              <li key={i} className={`rounded border px-2.5 py-1.5 ${SEVERITY_STYLE[r.severity]?.card ?? 'border-border bg-surface-muted/40'}`}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-text-tertiary">{r.id}</span>
                  <span className="text-[11px] font-medium text-text-primary">{r.title}</span>
                  {r.severity && (
                    <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1 py-0.5 border ${SEVERITY_STYLE[r.severity]?.chip ?? 'border-border bg-white text-text-secondary'}`}>{r.severity}</span>
                  )}
                  {r.effort && <span className="text-[10px] text-text-tertiary">effort: {r.effort}</span>}
                </div>
                {r.detail && <p className="text-[11px] text-text-secondary">{r.detail}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.buildPlan.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Build plan ({doc.buildPlan.length})</div>
          <ul className="space-y-1">
            {doc.buildPlan.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px]">
                <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1 py-0.5 border shrink-0 ${ARTIFACT_KIND_STYLE[b.kind] ?? 'bg-surface-muted text-text-secondary border-border'}`}>{b.kind}</span>
                <span className="text-text-primary font-medium">{b.artifact}</span>
                {b.targetPath && <span className="font-mono text-text-tertiary break-all">{b.targetPath}</span>}
                {b.purpose && <span className="text-text-secondary">— {b.purpose}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.openQuestions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Open questions ({doc.openQuestions.length})</div>
          <ul className="space-y-0.5">
            {doc.openQuestions.map((q, i) => <li key={i} className="text-[11px] text-text-secondary">· {q}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Harmonization ─────────────────────────────────────

function HarmonizationTable({ rows, roles, personas }: { rows: GovernanceRoleMapEntry[]; roles: ProcessRole[]; personas: Persona[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-text-tertiary">
        No harmonization yet. Ask the agent to harmonize this system&apos;s discovered roles with the SAP roles and personas already governed here, or draft the plan again.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-text-tertiary border-b border-border">
            <th className="py-1.5 pr-3 font-medium">External role</th>
            <th className="py-1.5 pr-3 font-medium">SAP role</th>
            <th className="py-1.5 pr-3 font-medium">Persona</th>
            <th className="py-1.5 pr-3 font-medium">Disposition</th>
            <th className="py-1.5 pr-3 font-medium text-right">Confidence</th>
            <th className="py-1.5 font-medium">Rationale</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const role = roles.find(x => x.id === r.role_id)
            const persona = personas.find(x => x.id === r.persona_id)
            const disposition = r.disposition
            const confidence = typeof r.confidence === 'number' ? r.confidence : null
            return (
              <tr key={r.id} className="border-b border-border last:border-0 align-top">
                <td className="py-1.5 pr-3 font-mono text-text-primary">{r.external_role}</td>
                <td className="py-1.5 pr-3">
                  {role ? (
                    <span className="text-text-secondary">
                      {role.name}
                      {role.sap_role_name && <span className="ml-1 font-mono text-text-tertiary">{role.sap_role_name}</span>}
                    </span>
                  ) : (
                    <span className="text-text-tertiary">—</span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-text-secondary">{persona ? persona.name : <span className="text-text-tertiary">—</span>}</td>
                <td className="py-1.5 pr-3">
                  <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 ${DISPOSITION_STYLE[disposition] ?? 'bg-surface-muted text-text-secondary'}`}>{disposition}</span>
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-text-secondary">
                  {confidence === null ? '—' : confidence.toFixed(2)}
                </td>
                <td className="py-1.5 text-text-secondary">{r.rationale || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Artifacts ─────────────────────────────────────────

function ArtifactCard({ artifact }: { artifact: GovernanceArtifact }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const content = artifact.content
  const kind = artifact.kind

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const download = () => {
    const path = artifact.target_path ?? ''
    const fallback = artifact.name.replace(/[^\w.\-]+/g, '_')
    const filename = path.split(/[\\/]/).filter(Boolean).pop() || fallback || 'artifact.txt'
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <li className="rounded-lg border border-border bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-muted/50 border-b border-border flex-wrap">
        <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 border shrink-0 ${ARTIFACT_KIND_STYLE[kind] ?? 'bg-surface-muted text-text-secondary border-border'}`}>{kind}</span>
        <span className="text-body-sm font-medium text-text-primary">{artifact.name}</span>
        {artifact.target_path && (
          <span className="text-[10px] font-mono text-text-tertiary truncate" title={artifact.target_path}>{artifact.target_path}</span>
        )}
        {artifact.language && <span className="text-[10px] text-text-tertiary">{artifact.language}</span>}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setOpen(v => !v)}>{open ? 'Hide' : 'View'}</Button>
          <Button variant="secondary" size="sm" icon={copied ? <Check size={12} /> : <ClipboardCopy size={12} />} onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="secondary" size="sm" icon={<Download size={12} />} onClick={download}>Download</Button>
        </div>
      </div>
      {open && (
        <pre className="max-h-80 overflow-auto px-3 py-2 text-[11px] font-mono text-text-secondary whitespace-pre-wrap break-words">{content}</pre>
      )}
    </li>
  )
}

// ─── Build confirmation ────────────────────────────────
// Dismissal keys off mousedown-on-backdrop (not click), so selecting text inside
// the dialog and releasing outside it does not close the dialog.

function BuildConfirmDialog({
  systemName, artifactPlan, onCancel, onConfirm,
}: {
  systemName: string
  artifactPlan: { artifact: string; kind: string; targetPath?: string; purpose: string }[]
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="build-confirm-title"
        className="w-[34rem] max-w-[94vw] max-h-[85vh] flex flex-col bg-white border border-border rounded-xl shadow-card-hover overflow-hidden"
      >
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
          <Hammer size={16} className="text-brand-600 shrink-0" />
          <h2 id="build-confirm-title" className="text-body-md font-semibold text-text-primary flex-1 min-w-0">
            Generate the security design for {systemName}
          </h2>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={14} />} aria-label="Cancel" onClick={onCancel} />
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <p className="text-body-sm text-text-secondary">
            This generates the approved plan&apos;s artifacts <span className="font-semibold text-text-primary">into this studio</span> — policy files, RBAC configuration, role-mapping tables, middleware scaffolding, and a runbook — where you can read, copy, and download them.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-body-sm font-semibold text-amber-900">
              <AlertTriangle size={13} /> Nothing is changed in {systemName}
            </div>
            <ul className="mt-1 space-y-0.5 text-[11px] text-amber-900/85">
              <li>· No file is written to the target repository.</li>
              <li>· No admin API is called and no access is provisioned.</li>
              <li>· <span className="font-semibold">Applying these artifacts to the target system is a human step.</span></li>
            </ul>
          </div>
          {artifactPlan.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Planned artifacts ({artifactPlan.length})</div>
              <ul className="space-y-1">
                {artifactPlan.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px]">
                    <span className={`text-[9px] uppercase tracking-wider font-bold rounded px-1 py-0.5 border shrink-0 ${ARTIFACT_KIND_STYLE[b.kind] ?? 'bg-surface-muted text-text-secondary border-border'}`}>{b.kind}</span>
                    <span className="text-text-primary font-medium">{b.artifact}</span>
                    {b.targetPath && <span className="font-mono text-text-tertiary break-all">{b.targetPath}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-surface-muted/40">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" icon={<Hammer size={14} />} onClick={onConfirm}>
            Generate artifacts into the studio
          </Button>
        </div>
      </div>
    </div>
  )
}
