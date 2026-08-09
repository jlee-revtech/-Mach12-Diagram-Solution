'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessagesSquare, ShieldCheck, Sparkles } from 'lucide-react'
import { Button, LoadingState } from '@/components/common'
import AgentChatPanel from '@/components/agents/AgentChatPanel'
import { listPersonas } from '@/lib/supabase/capability-maps'
import { listProcessRoles } from '@/lib/supabase/process-models'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import {
  listDesignSessions, listDesignGuidance, listDesignOptions,
  listGovernedSystems, listExplorations, listPlans, listRoleMap, listArtifacts,
} from '@/lib/supabase/security-design'
import type {
  DesignGuidance, DesignOption, DesignSession,
  GovernanceArtifact, GovernanceExploration, GovernancePlan, GovernanceRoleMapEntry, GovernedSystem,
} from '@/lib/security/types'
import type { ProcessRole } from '@/lib/process/types'
import type { Persona } from '@/lib/sipoc/types'
import type { Workstream } from '@/lib/workstream/types'
import DesignAdvisoryTab from './DesignAdvisoryTab'
import GovernToolsTab from './GovernToolsTab'

type TabKey = 'advisory' | 'govern'

const TABS: { key: TabKey; label: string; icon: typeof MessagesSquare }[] = [
  { key: 'advisory', label: 'Design Advisory', icon: MessagesSquare },
  { key: 'govern', label: 'Govern Tools', icon: ShieldCheck },
]

// The twelve security-design tools the agent can reach for from this page.
// Named in pageContext so the agent picks the right one without guessing.
const ADVISORY_TOOLS = [
  'start_design_session', 'list_design_sessions', 'capture_design_guidance',
  'propose_design_options', 'record_design_decision',
]
const GOVERN_TOOLS = [
  'register_governed_system', 'list_governed_systems', 'explore_governed_system',
  'draft_governance_plan', 'harmonize_governance_with_sap', 'get_governance_plan',
  'build_governance_design',
]

// Security Design Studio: two surfaces over one security agent.
//   Design Advisory — conversational design sessions: captured best-practice
//     guidance, solution design options (standard / configuration / enhancement /
//     third-party / process control) with pros, cons, effort, risk, and a
//     recorded decision; promotable into an Authorization Concept deliverable.
//   Govern Tools — register the COTS and custom apps around SAP, explore them
//     read-only, draft a governance plan harmonized with the SAP roles and
//     personas already governed here, review + approve it, and only then
//     generate artifacts INTO THE STUDIO. Applying them is a human step.
export default function SecurityDesignStudio({ orgId, userId }: { orgId: string; userId?: string }) {
  const [tab, setTab] = useState<TabKey>('advisory')

  // F1 — design advisory
  const [sessions, setSessions] = useState<DesignSession[]>([])
  const [guidance, setGuidance] = useState<DesignGuidance[]>([])
  const [options, setOptions] = useState<DesignOption[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // F2 — explore & govern
  const [systems, setSystems] = useState<GovernedSystem[]>([])
  const [explorations, setExplorations] = useState<GovernanceExploration[]>([])
  const [plans, setPlans] = useState<GovernancePlan[]>([])
  const [roleMap, setRoleMap] = useState<GovernanceRoleMapEntry[]>([])
  const [artifacts, setArtifacts] = useState<GovernanceArtifact[]>([])
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null)

  // Shared reference data (harmonization names its SAP role + persona by id).
  const [roles, setRoles] = useState<ProcessRole[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [se, gu, op, sy, ex, pl, rm, ar, ro, pe, ws] = await Promise.all([
        listDesignSessions(orgId), listDesignGuidance(orgId), listDesignOptions(orgId),
        listGovernedSystems(orgId), listExplorations(orgId), listPlans(orgId),
        listRoleMap(orgId), listArtifacts(orgId),
        listProcessRoles(orgId), listPersonas(orgId), listWorkstreams(orgId),
      ])
      setSessions(se); setGuidance(gu); setOptions(op)
      setSystems(sy); setExplorations(ex); setPlans(pl); setRoleMap(rm); setArtifacts(ar)
      setRoles(ro); setPersonas(pe); setWorkstreams(ws)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not reach the security design tables.')
    } finally {
      setLoading(false)
    }
  }, [orgId])
  useEffect(() => { load() }, [load])

  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? null
  const selectedSystem = systems.find(s => s.id === selectedSystemId) ?? null

  // What the security-authorization agent sees about this page: which tab is
  // open, what is selected, the catalogs, and every tool it may reach for
  // (modeled on deliverables/page.tsx).
  const pageContext = useMemo(() => {
    const tabLabel = TABS.find(t => t.key === tab)?.label ?? 'Design Advisory'
    const sessionList = sessions
      .map(s => `"${s.title}" (id ${s.id}, ${s.status}${s.scope ? `, scope: ${s.scope}` : ''})`)
      .join('; ')
    const systemList = systems
      .map(s => `"${s.name}" (id ${s.id}, ${s.kind}, status ${s.status}${s.base_url ? `, ${s.base_url}` : ''}${s.source_path ? `, source ${s.source_path}` : ''})`)
      .join('; ')
    const sel = selectedSession
      ? `The selected design session is "${selectedSession.title}" (id ${selectedSession.id}, status ${selectedSession.status}) — it has ${guidance.filter(g => g.session_id === selectedSession.id).length} captured guidance note(s) and ${options.filter(o => o.session_id === selectedSession.id).length} design option(s).`
      : 'No design session is selected.'
    const selSys = selectedSystem
      ? `The selected governed system is "${selectedSystem.name}" (id ${selectedSystem.id}, ${selectedSystem.kind}, status ${selectedSystem.status}).`
      : 'No governed system is selected.'
    return (
      `The user has the Security Design Studio (/process/security/design) open on the "${tabLabel}" tab. ` +
      `The page has two tabs: "Design Advisory" (conversational security design sessions — grounded best-practice guidance and solution design options with pros, cons, effort, risk, and a recorded decision) ` +
      `and "Govern Tools" (registering the COTS and custom apps around SAP as governed systems, read-only exploration, a governance plan harmonized with the SAP security roles and personas already governed in this suite, operator review and approval, and artifact generation into the studio). ` +
      `Active tab: ${tabLabel}. ${sel} ${selSys} ` +
      `Design sessions in this org: ${sessionList || '(none yet)'}. ` +
      `Governed systems in this org: ${systemList || '(none yet)'}. ` +
      `SAP security roles available for harmonization: ${roles.map(r => r.name).join(', ') || '(none yet)'}. ` +
      `Personas: ${personas.map(p => p.name).join(', ') || '(none yet)'}. ` +
      `For design advisory work use ${ADVISORY_TOOLS.join(', ')}. ` +
      `For governing an external, COTS, or vibe-coded application use ${GOVERN_TOOLS.join(', ')}. ` +
      `Exploration is read-only reconnaissance of systems the operator administers — never authenticate, never submit credentials, never exploit a finding, and report honestly what was unreachable. ` +
      `build_governance_design only runs on a plan the operator has approved, with explicit human confirmation, and it generates artifacts INTO THIS STUDIO — applying them to the target system is a human step.`
    )
  }, [tab, sessions, systems, selectedSession, selectedSystem, guidance, options, roles, personas])

  if (loading) return <LoadingState label="Loading the security design studio..." />

  if (loadError) return (
    <div className="rounded-lg border border-red-200 bg-status-red-bg px-4 py-6 text-center">
      <p className="text-body-sm text-text-primary font-semibold mb-1">Could not load the security design studio</p>
      <p className="text-[11px] text-text-tertiary mb-4">{loadError}</p>
      <Button onClick={load}>Retry</Button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* ─── Tabs + agent ─── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div role="tablist" aria-label="Security design surfaces" className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 shadow-card">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium transition-colors ${active ? 'bg-brand-50 text-brand-700' : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'}`}
              >
                <Icon size={13} />
                {t.label}
                <span className="text-[10px] tabular-nums opacity-70">
                  {t.key === 'advisory' ? sessions.length : systems.length}
                </span>
              </button>
            )
          })}
        </div>
        <div className="ml-auto">
          <Button variant="ai" size="sm" icon={<Sparkles size={14} />} onClick={() => setChatOpen(true)}>
            Ask the security agent
          </Button>
        </div>
      </div>

      {tab === 'advisory' ? (
        <DesignAdvisoryTab
          orgId={orgId}
          sessions={sessions}
          guidance={guidance}
          options={options}
          workstreams={workstreams}
          selectedId={selectedSessionId}
          onSelect={setSelectedSessionId}
          setSessions={setSessions}
          setGuidance={setGuidance}
          setOptions={setOptions}
          reload={load}
        />
      ) : (
        <GovernToolsTab
          orgId={orgId}
          systems={systems}
          explorations={explorations}
          plans={plans}
          roleMap={roleMap}
          artifacts={artifacts}
          roles={roles}
          personas={personas}
          selectedId={selectedSystemId}
          onSelect={setSelectedSystemId}
          setSystems={setSystems}
          reload={load}
        />
      )}

      {chatOpen && (
        <AgentChatPanel
          orgId={orgId}
          userId={userId}
          workstreams={workstreams}
          initialAgentCode="security-authorization"
          pageContext={pageContext}
          onClose={() => { setChatOpen(false); load() }}
        />
      )}
    </div>
  )
}
