'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { listWorkstreams, getWorkstreamRollups, seedStandardWorkstreams } from '@/lib/supabase/workstreams'
import type { Workstream, WorkstreamRollup } from '@/lib/workstream/types'
import { WORKSTREAM_BY_CODE } from '@/lib/workstream/catalog'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'
import AgentChatPanel from '@/components/agents/AgentChatPanel'
import VersionBadge from '@/components/VersionBadge'
import DataArchitectureDialog from '@/components/process/DataArchitectureDialog'

const EMPTY_ROLLUP = {
  process_models: 0, process_nodes: 0, capabilities: 0, capability_maps: 0,
  personas: 0, roles: 0, information_products: 0, data_elements: 0,
  systems: 0, diagrams: 0, integrations: 0,
}

export default function WorkstreamsPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuth()
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [rollups, setRollups] = useState<Record<string, WorkstreamRollup>>({})
  const [loadingData, setLoadingData] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)
  const [agentCode, setAgentCode] = useState('enterprise')
  const [archWs, setArchWs] = useState<Workstream | null>(null)

  const openAgent = (code: string) => { setAgentCode(code); setAgentOpen(true) }

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  const load = useCallback(async () => {
    if (!organization) return
    setLoadingData(true)
    const [ws, rs] = await Promise.all([
      listWorkstreams(organization.id),
      getWorkstreamRollups(organization.id),
    ])
    setWorkstreams(ws)
    setRollups(Object.fromEntries(rs.map((r) => [r.workstream_id, r])))
    setLoadingData(false)
  }, [organization])

  useEffect(() => { load() }, [load])

  const handleSeed = useCallback(async () => {
    if (!organization || !user) return
    setSeeding(true)
    try {
      await seedStandardWorkstreams(organization.id, user.id)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to seed workstreams')
    } finally {
      setSeeding(false)
    }
  }, [organization, user, load])

  if (loading || !user || !organization) return null

  return (
    <div className="min-h-screen bg-[var(--m12-bg)] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] transition-colors"
              title="Back to dashboard"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11 4l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-gradient text-xl font-bold font-[family-name:var(--font-orbitron)] tracking-wide">MACH12</span>
            <span className="text-[var(--m12-text-muted)] text-lg font-light">/</span>
            <span className="text-[var(--m12-text-secondary)] text-lg font-medium">Workstreams</span>
            <span className="self-end mb-0.5"><VersionBadge /></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/workshops')}
              title="Workshops — agent-facilitated delivery sessions"
              className="flex items-center gap-2 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 hover:border-[var(--m12-border)] text-[var(--m12-text-secondary)] px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" /><circle cx="11" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" /><path d="M2 13c0-1.7 1.3-3 3-3s3 1.3 3 3M8 13c0-1.7 1.3-3 3-3s3 1.3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              Workshops
            </button>
            <button
              onClick={() => router.push('/knowledge')}
              title="Knowledge base — SAP/Dassian baselines + customer knowledge"
              className="flex items-center gap-2 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 hover:border-[var(--m12-border)] text-[var(--m12-text-secondary)] px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3.5A1.5 1.5 0 014.5 2H13v10.5H4.5A1.5 1.5 0 003 14V3.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M13 12.5H4.5A1.5 1.5 0 003 14" stroke="currentColor" strokeWidth="1.3" /></svg>
              Knowledge
            </button>
            {workstreams.length > 0 && (
              <>
                <button
                  onClick={() => openAgent('enterprise')}
                  className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#3B82F6] text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-lg shadow-[#2563EB]/20"
                >
                  <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                    <rect x="2.5" y="9" width="3" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
                    <rect x="7.5" y="5.5" width="3" height="9.5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
                    <rect x="12.5" y="2.5" width="3" height="12.5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                  Ask the Enterprise Architect
                </button>
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="flex items-center gap-2 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 hover:border-[var(--m12-border)] disabled:opacity-50 text-[var(--m12-text-secondary)] px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                >
                  {seeding ? 'Seeding…' : 'Add missing'}
                </button>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-[var(--m12-text-muted)] mb-8 ml-9">
          Every process, persona, data element, and system aligns to a workstream. Each has a world-class SAP S/4HANA + Dassian consultant agent.
        </p>

        {loadingData ? (
          <div className="text-center py-24 text-[var(--m12-text-muted)] text-sm">Loading…</div>
        ) : workstreams.length === 0 ? (
          /* Empty state — seed the standard 10 */
          <div className="text-center py-24 border border-dashed border-[var(--m12-border)]/60 rounded-2xl">
            <div className="flex justify-center mb-4 text-[var(--m12-border)]">
              <WorkstreamIcon icon="portfolio" size={48} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--m12-text-secondary)] mb-2">No workstreams yet</h2>
            <p className="text-sm text-[var(--m12-text-muted)] mb-6 max-w-md mx-auto">
              Seed the 10 standard Aerospace &amp; Defense value streams from Process Studio to start aligning your architecture.
            </p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {seeding ? 'Seeding…' : 'Seed standard workstreams'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workstreams.map((w) => {
              const r = rollups[w.id] ?? EMPTY_ROLLUP
              const tagline = WORKSTREAM_BY_CODE[w.code]?.agentTagline
              const color = w.color || '#2563EB'
              const kpis: { label: string; value: number }[] = [
                { label: 'Processes', value: r.process_nodes },
                { label: 'Capabilities', value: r.capabilities },
                { label: 'Personas', value: r.personas },
                { label: 'Data', value: r.data_elements + r.information_products },
                { label: 'Systems', value: r.systems },
                { label: 'Integrations', value: r.integrations },
              ]
              return (
                <div
                  key={w.id}
                  className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 hover:border-[var(--m12-border)] rounded-xl p-5 transition-all card-glow"
                  style={{ borderTopColor: color, borderTopWidth: 2 }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A`, color }}>
                      <WorkstreamIcon icon={w.icon} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-[var(--m12-text)] leading-tight">{w.name}</h3>
                      {tagline && <div className="text-[10px] text-[var(--m12-text-muted)] mt-0.5 truncate">{tagline}</div>}
                    </div>
                  </div>
                  {w.description && (
                    <p className="text-[11px] text-[var(--m12-text-muted)] mb-4 line-clamp-2">{w.description}</p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {kpis.map((k) => (
                      <div key={k.label} className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/30 rounded-lg px-2 py-1.5 text-center">
                        <div className="text-sm font-bold text-[var(--m12-text)] font-[family-name:var(--font-space-mono)]">{k.value}</div>
                        <div className="text-[8px] uppercase tracking-wider text-[var(--m12-text-muted)]">{k.label}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => openAgent(w.code)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 border rounded-lg py-1.5 text-[11px] font-medium transition-colors"
                    style={{ color, borderColor: `${color}55` }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10a1 1 0 011 1v4a1 1 0 01-1 1H7l-3 2.5V10.5a1 1 0 01-1-1v-4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                    Ask the consultant
                  </button>
                  <button
                    onClick={() => setArchWs(w)}
                    title="Generate a data-architecture diagram from this workstream's L3 process flows and assigned capabilities"
                    className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium text-white transition-colors"
                    style={{ backgroundColor: color }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="5" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.2" /><rect x="9" y="2.5" width="5" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.2" /><rect x="5.5" y="9.5" width="5" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.2" /><path d="M4.5 6.5v1.5a1 1 0 001 1h5a1 1 0 001-1V6.5M8 9.3V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                    Generate data architecture
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {agentOpen && (
        <AgentChatPanel orgId={organization.id} userId={user.id} workstreams={workstreams} initialAgentCode={agentCode} onClose={() => setAgentOpen(false)} />
      )}
      {archWs && (
        <DataArchitectureDialog
          orgId={organization.id}
          userId={user.id}
          workstream={{ id: archWs.id, name: archWs.name, ...(archWs.color ? { color: archWs.color } : {}) }}
          onClose={() => setArchWs(null)}
        />
      )}
    </div>
  )
}
