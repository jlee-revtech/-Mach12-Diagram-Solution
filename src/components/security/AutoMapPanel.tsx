'use client'

import { useCallback, useState } from 'react'
import { AlertTriangle, Check, Wand2, X } from 'lucide-react'
import { Button, EmptyState } from '@/components/common'
import { sbFetch } from '@/lib/supabase/fetch'
import { runAutoDetermination } from '@/lib/security/autodetermine'
import type { AutoDetermineResult, PersonaRoleProposal, PersonaFootprintItem, RoleAccessItem } from '@/lib/security/types'
import { addPersonaRole, listPersonaRoleLinks } from '@/lib/supabase/process-models'
import { updatePersonaRoleLink } from '@/lib/supabase/security-roles'
import type { ProcessRole, PersonaRoleLink } from '@/lib/process/types'
import type { Persona } from '@/lib/sipoc/types'

// ─── Minimal org-scoped graph fetch ────────────────────
// The auto-map needs every leaf process graph in the org. process-models.ts has
// no single-shot org-wide graph fetch (listProcessNodes is per-model), so this
// local read helper uses the same sbFetch/header idioms with a PostgREST
// embedded join rather than N+1 per-model calls. Read-only; owned by this panel.

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    return JSON.parse(localStorage.getItem(key) || '{}')?.access_token ?? null
  } catch {
    return null
  }
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': SB_ANON,
    'Authorization': `Bearer ${getToken()}`,
    'Accept': 'application/json',
  }
}

async function fetchOrgProcessGraphs(orgId: string): Promise<{ processTitle: string; graph: unknown }[]> {
  const out: { processTitle: string; graph: unknown }[] = []
  const pageSize = 200
  let from = 0
  while (true) {
    const res = await sbFetch(
      `${SB_URL}/rest/v1/process_nodes?select=name,graph_data,process_models!inner(organization_id,title)&process_models.organization_id=eq.${orgId}&graph_data=not.is.null`,
      { headers: { ...headers(), 'Range-Unit': 'items', 'Range': `${from}-${from + pageSize - 1}` } }
    )
    if (!res.ok) break
    const rows = (await res.json()) as { name: string; graph_data: unknown; process_models?: { title?: string } }[]
    for (const r of rows) {
      if (!r.graph_data) continue
      // Same "{model title}: {node name}" label the agent tool builds, so
      // rationales read identically in chat and in this panel.
      out.push({ processTitle: [r.process_models?.title, r.name].filter(Boolean).join(': ') || 'Process', graph: r.graph_data })
    }
    if (rows.length < pageSize) break
    from += pageSize
  }
  return out
}

// ─── Panel ─────────────────────────────────────────────

interface Props {
  orgId: string
  roles: ProcessRole[]
  personas: Persona[]
  links: PersonaRoleLink[]
  access: RoleAccessItem[]
  /** Fresh links after an apply (so the studio's chips update without a full reload). */
  onLinksRefreshed: (links: PersonaRoleLink[]) => void
  onClose: () => void
}

const pairKey = (personaId: string, roleId: string) => `${personaId}:${roleId}`

function itemLabel(it: PersonaFootprintItem): string {
  if (it.tcode) return it.tcode
  if (it.fioriTitle) return it.fioriAppId ? `${it.fioriTitle} (${it.fioriAppId})` : it.fioriTitle
  return it.fioriTileId || it.fioriAppId || '(unknown)'
}

export default function AutoMapPanel({ orgId, roles, personas, links, access, onLinksRefreshed, onClose }: Props) {
  const [running, setRunning] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AutoDetermineResult | null>(null)
  const [applied, setApplied] = useState<Set<string>>(new Set())

  const run = useCallback(async () => {
    setRunning(true)
    setError(null)
    try {
      const graphs = await fetchOrgProcessGraphs(orgId)
      const res = runAutoDetermination(graphs, {
        personas: personas.map(p => ({ id: p.id, name: p.name })),
        roles: roles.map(r => ({ id: r.id, name: r.name, sap_role_name: r.sap_role_name ?? null })),
        access,
        existingLinks: links.map(l => ({ persona_id: l.persona_id, role_id: l.role_id })),
      })
      setResult(res)
      setApplied(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-determination failed.')
    } finally {
      setRunning(false)
    }
  }, [orgId, roles, personas, links, access])

  // Upsert persona→role links with AI provenance. Insert first (ignore-duplicates),
  // then patch source/confidence/rationale onto the real link rows. Already-linked
  // pairs are skipped so manual links keep their source.
  const apply = useCallback(async (proposals: PersonaRoleProposal[]) => {
    const todo = proposals.filter(p => !p.alreadyLinked && !applied.has(pairKey(p.personaId, p.roleId)))
    if (todo.length === 0 || applying) return
    setApplying(true)
    try {
      for (const p of todo) await addPersonaRole(p.personaId, p.roleId)
      const fresh = await listPersonaRoleLinks(orgId)
      for (const p of todo) {
        const link = fresh.find(l => l.persona_id === p.personaId && l.role_id === p.roleId)
        if (link) {
          await updatePersonaRoleLink(link.id, { source: 'ai', confidence: p.coverage, rationale: p.rationale }).catch(() => {})
        }
      }
      onLinksRefreshed(fresh)
      setApplied(prev => {
        const next = new Set(prev)
        for (const p of todo) next.add(pairKey(p.personaId, p.roleId))
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Applying persona links failed.')
    } finally {
      setApplying(false)
    }
  }, [orgId, applied, applying, onLinksRefreshed])

  const openTodo = (result?.proposals ?? []).filter(p => !p.alreadyLinked && !applied.has(pairKey(p.personaId, p.roleId)))

  // Group proposals by persona (matcher returns them ranked desc within persona).
  const byPersona: { personaId: string; personaName: string; list: PersonaRoleProposal[] }[] = []
  for (const p of result?.proposals ?? []) {
    const grp = byPersona.find(g => g.personaId === p.personaId)
    if (grp) grp.list.push(p)
    else byPersona.push({ personaId: p.personaId, personaName: p.personaName, list: [p] })
  }

  return (
    <div className="bg-white rounded-lg border border-brand-200 shadow-card">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-brand-50/60">
        <Wand2 size={15} className="text-brand-600 shrink-0" />
        <span className="text-body-sm font-semibold text-text-primary">Auto-map personas to security roles</span>
        <span className="text-[11px] text-text-tertiary hidden sm:inline">Derived from the SAP access (tcodes, Fiori tiles) on process steps in each persona&apos;s swimlanes.</span>
        <div className="ml-auto flex items-center gap-2">
          {result && openTodo.length > 0 && (
            <Button variant="ai" size="sm" loading={applying} icon={<Check size={13} />} onClick={() => apply(openTodo)}>
              Apply all ({openTodo.length})
            </Button>
          )}
          <Button variant="secondary" size="sm" loading={running} onClick={run}>
            {result ? 'Run again' : 'Run analysis'}
          </Button>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={14} />} aria-label="Close auto-map" onClick={onClose} />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-status-red-border bg-status-red-bg px-3 py-2 text-body-sm text-text-primary">
            <AlertTriangle size={14} className="text-status-red shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!result && !error && (
          <p className="text-body-sm text-text-tertiary">
            {running
              ? 'Walking process graphs and matching persona footprints against role access...'
              : 'Run the analysis to propose persona → role assignments with coverage and rationale. Nothing is written until you apply.'}
          </p>
        )}

        {result && (
          <>
            <p className="text-[11px] text-text-tertiary">
              Scanned {result.processesScanned} process graph{result.processesScanned === 1 ? '' : 's'} ·{' '}
              {result.personasScanned} persona{result.personasScanned === 1 ? '' : 's'} with SAP access footprints ·{' '}
              {roles.length} role{roles.length === 1 ? '' : 's'} considered
            </p>

            {result.proposals.length === 0 ? (
              <EmptyState
                variant="dashed"
                compact
                title="No persona-role matches found"
                description="Matches need swimlanes assigned to personas, steps carrying tcodes or Fiori tiles, and roles with matching access items. Add role access (or ask the security agent to) and run again."
              />
            ) : (
              <div className="space-y-3">
                {byPersona.map(grp => (
                  <div key={grp.personaId} className="rounded-lg border border-border overflow-hidden">
                    <div className="px-3 py-2 bg-surface-muted/60 border-b border-border text-body-sm font-semibold text-text-primary">
                      {grp.personaName}
                    </div>
                    <ul>
                      {grp.list.map(p => {
                        const key = pairKey(p.personaId, p.roleId)
                        const done = p.alreadyLinked || applied.has(key)
                        return (
                          <li key={key} className="px-3 py-2.5 border-b border-border last:border-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-body-sm font-medium text-text-primary">{p.roleName}</span>
                              {p.sapRoleName && (
                                <span className="text-[10px] font-mono text-text-secondary bg-surface-muted border border-border rounded px-1 py-0.5">{p.sapRoleName}</span>
                              )}
                              <span className="text-[11px] text-text-secondary tabular-nums">{Math.round(p.coverage * 100)}% coverage</span>
                              <div className="ml-auto shrink-0">
                                {p.alreadyLinked ? (
                                  <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Already linked</span>
                                ) : applied.has(key) ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-status-green"><Check size={11} /> Applied</span>
                                ) : (
                                  <Button variant="ai" size="sm" disabled={applying} onClick={() => apply([p])}>Apply</Button>
                                )}
                              </div>
                            </div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-surface-muted overflow-hidden" role="presentation">
                              <div
                                className={`h-full rounded-full ${done ? 'bg-status-green' : 'bg-brand-500'}`}
                                style={{ width: `${Math.max(4, Math.round(p.coverage * 100))}%` }}
                              />
                            </div>
                            <p className="mt-1.5 text-[11px] text-text-secondary">{p.rationale}</p>
                            {p.matched.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {p.matched.map((m, i) => (
                                  <span key={i} className="text-[10px] font-mono text-text-secondary bg-surface-muted rounded px-1 py-0.5" title={`${m.stepLabel} — ${m.processTitle}`}>
                                    {itemLabel(m)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {result.gaps.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-body-sm font-semibold text-amber-800">
                  <AlertTriangle size={13} /> Access gaps ({result.gaps.length})
                </div>
                <p className="text-[11px] text-amber-800/80 mt-0.5">
                  Process steps these personas perform with no covering role access. Add the access to an existing role, or create a new role for it.
                </p>
                <ul className="mt-1.5 space-y-1">
                  {result.gaps.map((g, i) => (
                    <li key={i} className="text-[11px] text-amber-900">
                      <span className="font-medium">{g.personaName}</span>
                      {' — '}
                      <span className="font-mono">{itemLabel(g.item)}</span>
                      <span className="text-amber-800/70"> · {g.item.stepLabel} ({g.item.processTitle})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.roleAccessSuggestions.length > 0 && (
              <div className="rounded-lg border border-border bg-surface-muted/50 px-3 py-2.5">
                <div className="text-body-sm font-semibold text-text-primary">Suggested role access additions ({result.roleAccessSuggestions.length})</div>
                <p className="text-[11px] text-text-tertiary mt-0.5">
                  Lanes assigned directly to these roles use SAP access the role design does not carry yet. Add them in the role detail pane, or ask the security agent to run auto-determination with role-access sync.
                </p>
                <ul className="mt-1.5 space-y-1">
                  {result.roleAccessSuggestions.map((s, i) => (
                    <li key={i} className="text-[11px] text-text-secondary">
                      <span className="font-medium text-text-primary">{s.roleName}</span>
                      {' — '}
                      <span className="font-mono">{itemLabel(s.item)}</span>
                      <span className="text-text-tertiary"> · {s.item.stepLabel} ({s.item.processTitle})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
