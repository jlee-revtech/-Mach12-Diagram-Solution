'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FolderKanban, MessageSquare, Network, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import { listWorkstreams, getWorkstreamRollups, seedStandardWorkstreams } from '@/lib/supabase/workstreams'
import type { Workstream, WorkstreamRollup } from '@/lib/workstream/types'
import { WORKSTREAM_BY_CODE } from '@/lib/workstream/catalog'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'
import AgentChatPanel from '@/components/agents/AgentChatPanel'
import DataArchitectureDialog from '@/components/process/DataArchitectureDialog'
import { Button, PageHeader, EmptyState, LoadingState } from '@/components/common'

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
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Workstreams"
        icon={<FolderKanban size={24} />}
        subtitle="Every process, persona, data element, and system aligns to a workstream. Each has a world-class SAP S/4HANA + Dassian consultant agent."
        actions={
          workstreams.length > 0 ? (
            <>
              <Button
                variant="ai"
                icon={<Sparkles size={14} />}
                onClick={() => openAgent('enterprise')}
              >
                Ask the Enterprise Architect
              </Button>
              <Button variant="secondary" onClick={handleSeed} loading={seeding}>
                {seeding ? 'Seeding...' : 'Add missing'}
              </Button>
            </>
          ) : undefined
        }
      />

      {loadingData ? (
        <LoadingState label="Loading workstreams..." />
      ) : workstreams.length === 0 ? (
        /* Empty state - seed the standard 10 */
        <EmptyState
          variant="dashed"
          icon={<WorkstreamIcon icon="portfolio" size={40} />}
          title="No workstreams yet"
          description="Seed the 10 standard Aerospace & Defense value streams from Process Studio to start aligning your architecture."
          action={
            <Button variant="primary" onClick={handleSeed} loading={seeding}>
              {seeding ? 'Seeding...' : 'Seed standard workstreams'}
            </Button>
          }
        />
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
                className="bg-white rounded-lg border border-border shadow-card p-5 transition-all"
                style={{ borderTopColor: color, borderTopWidth: 2 }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A`, color }}>
                    <WorkstreamIcon icon={w.icon} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-heading-sm text-text-primary leading-tight">{w.name}</h3>
                    {tagline && <div className="text-[11px] text-text-tertiary mt-0.5 truncate">{tagline}</div>}
                  </div>
                </div>
                {w.description && (
                  <p className="text-body-sm text-text-secondary mb-4 line-clamp-2">{w.description}</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {kpis.map((k) => (
                    <div key={k.label} className="bg-surface-muted border border-border rounded-lg px-2 py-1.5 text-center">
                      <div className="text-body-md font-bold font-mono text-text-primary">{k.value}</div>
                      <div className="text-[10px] uppercase tracking-wider text-text-tertiary">{k.label}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => openAgent(w.code)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 border rounded-lg py-1.5 text-[11px] font-medium transition-colors hover:bg-surface-muted"
                  style={{ color, borderColor: `${color}55` }}
                >
                  <MessageSquare size={12} />
                  Ask the consultant
                </button>
                <button
                  onClick={() => setArchWs(w)}
                  title="Generate a data-architecture diagram from this workstream's L3 process flows and assigned capabilities"
                  className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: color }}
                >
                  <Network size={12} />
                  Generate data architecture
                </button>
              </div>
            )
          })}
        </div>
      )}
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
