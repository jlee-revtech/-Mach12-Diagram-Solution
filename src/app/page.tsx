'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { listDiagrams, createDiagram, archiveDiagram, restoreDiagram } from '@/lib/supabase/diagrams'
import { listCapabilityMaps, createCapabilityMap, archiveCapabilityMap, restoreCapabilityMap } from '@/lib/supabase/capability-maps'
import type { DiagramRow } from '@/lib/supabase/types'
import type { CapabilityMapRow } from '@/lib/sipoc/types'

export default function Dashboard() {
  const [diagrams, setDiagrams] = useState<DiagramRow[]>([])
  const [capabilityMaps, setCapabilityMaps] = useState<CapabilityMapRow[]>([])
  const [loadingDiagrams, setLoadingDiagrams] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [activeTab, setActiveTab] = useState<'diagrams' | 'sipoc'>('diagrams')
  const router = useRouter()
  const { user, profile, organization, organizations, loading, signOut, switchOrg } = useAuth()
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)

  // Auth gating
  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  // Load diagrams + capability maps
  const loadAll = useCallback(async () => {
    if (!organization) return
    setLoadingDiagrams(true)
    const [allDiagrams, allMaps] = await Promise.all([
      listDiagrams(organization.id, true),
      listCapabilityMaps(organization.id, true),
    ])
    setDiagrams(allDiagrams)
    setCapabilityMaps(allMaps)
    setLoadingDiagrams(false)
  }, [organization])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleNew = useCallback(async () => {
    if (!organization || !user) return
    const diagram = await createDiagram(organization.id, user.id)
    router.push(`/diagram/${diagram.id}`)
  }, [organization, user, router])

  const handleNewCapabilityMap = useCallback(async () => {
    if (!organization || !user) return
    const map = await createCapabilityMap(organization.id, user.id)
    router.push(`/capability-map/${map.id}`)
  }, [organization, user, router])

  const handleArchiveMap = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!confirm('Archive this capability map? You can restore it later.')) return
      await archiveCapabilityMap(id)
      await loadAll()
    },
    [loadAll]
  )

  const handleRestoreMap = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      await restoreCapabilityMap(id)
      await loadAll()
    },
    [loadAll]
  )

  const handleArchive = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!confirm('Archive this diagram? You can restore it later.')) return
      await archiveDiagram(id)
      await loadAll()
    },
    [loadAll]
  )

  const handleRestore = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      await restoreDiagram(id)
      await loadAll()
    },
    [loadAll]
  )

  if (loading || !user || !organization) return null

  const activeDiagrams = diagrams.filter((d) => !d.archived_at)
  const archivedDiagrams = diagrams.filter((d) => d.archived_at)
  const activeMaps = capabilityMaps.filter((m) => !m.archived_at)
  const archivedMaps = capabilityMaps.filter((m) => m.archived_at)

  return (
    <div className="min-h-screen bg-[var(--m12-bg)] p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-gradient text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wide">
                MACH12
              </span>
              <span className="text-[var(--m12-text-muted)] text-lg font-light">/</span>
              <span className="text-[var(--m12-text-secondary)] text-lg font-medium">Studio</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {/* Org switcher */}
              <div className="relative">
                <button
                  onClick={() => setOrgMenuOpen(!orgMenuOpen)}
                  className="flex items-center gap-1.5 text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] transition-colors"
                >
                  {organization.name}
                  {organizations.length > 1 && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${orgMenuOpen ? 'rotate-180' : ''}`}>
                      <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
                {orgMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOrgMenuOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-lg shadow-xl overflow-hidden">
                      <div className="px-3 py-2 border-b border-[var(--m12-border)]/40">
                        <span className="text-[9px] uppercase tracking-widest text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] font-bold">
                          Organizations
                        </span>
                      </div>
                      {organizations.map((org) => (
                        <button
                          key={org.id}
                          onClick={async () => {
                            await switchOrg(org.id)
                            setOrgMenuOpen(false)
                            setLoadingDiagrams(true)
                            Promise.all([
                              listDiagrams(org.id, true).then(setDiagrams),
                              listCapabilityMaps(org.id, true).then(setCapabilityMaps),
                            ]).finally(() => setLoadingDiagrams(false))
                          }}
                          className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs transition-colors ${
                            org.id === organization.id
                              ? 'bg-[#2563EB]/10 text-[#93C5FD]'
                              : 'text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg)]'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${org.id === organization.id ? 'bg-[#2563EB]' : 'bg-[#374A5E]'}`} />
                          <span className="flex-1 truncate">{org.name}</span>
                          <span className="text-[8px] uppercase text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
                            {org.role}
                          </span>
                        </button>
                      ))}
                      <div className="border-t border-[var(--m12-border)]/40">
                        <button
                          onClick={() => { setOrgMenuOpen(false); router.push('/setup') }}
                          className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg)] transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                          </svg>
                          Create or join org
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <span className="text-[var(--m12-border)]">|</span>
              <span className="text-xs text-[var(--m12-text-muted)]">{profile?.display_name || profile?.email}</span>
              <button
                onClick={signOut}
                className="text-xs text-[var(--m12-border)] hover:text-red-400 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNew}
              className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#3B82F6] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#2563EB]/20"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              New Diagram
            </button>
            <button
              onClick={handleNewCapabilityMap}
              className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#8B5CF6]/20"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              New SIPOC Map
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('diagrams')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'diagrams'
                ? 'bg-[#2563EB]/10 text-[#2563EB] shadow-sm'
                : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Data Architecture ({activeDiagrams.length})
          </button>
          <button
            onClick={() => setActiveTab('sipoc')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'sipoc'
                ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] shadow-sm'
                : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h3M10 7h3M5.5 7h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M4 5l1.5 2L4 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8.5 5L10 7l-1.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            SIPOC Maps ({activeMaps.length})
          </button>
        </div>

        {/* Content grid */}
        {loadingDiagrams ? (
          <div className="text-center py-24 text-[var(--m12-text-muted)] text-sm">Loading...</div>
        ) : activeTab === 'diagrams' ? (
          /* ─── Diagrams Tab ─────────────────────────────── */
          activeDiagrams.length === 0 && archivedDiagrams.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-[var(--m12-border)]/60 rounded-2xl">
              <div className="text-5xl mb-4 opacity-20">&#9634;</div>
              <h2 className="text-lg font-semibold text-[var(--m12-text-secondary)] mb-2">
                No diagrams yet
              </h2>
              <p className="text-sm text-[var(--m12-text-muted)] mb-6">
                Create your first data architecture diagram to get started.
              </p>
              <button
                onClick={handleNew}
                className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#3B82F6] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Create Diagram
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={handleNew}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--m12-border)]/40 hover:border-[#2563EB]/60 rounded-xl p-8 transition-colors group"
                >
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-[var(--m12-border)] group-hover:text-[#2563EB] transition-colors mb-2">
                    <path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span className="text-sm text-[var(--m12-text-muted)] group-hover:text-[var(--m12-text-secondary)] transition-colors">New Diagram</span>
                </button>
                {activeDiagrams.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => router.push(`/diagram/${d.id}`)}
                    className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 hover:border-[var(--m12-border)] rounded-xl p-5 cursor-pointer transition-all card-glow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-sm font-semibold text-[var(--m12-text)] truncate flex-1">{d.title}</h3>
                      <button
                        onClick={(e) => handleArchive(d.id, e)}
                        title="Archive diagram"
                        className="text-[var(--m12-border)] hover:text-[#EAB308] transition-colors ml-2 shrink-0"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <rect x="2" y="3" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M3 6v7a1 1 0 001 1h8a1 1 0 001-1V6" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M6.5 9h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                    {d.process_context && (
                      <div className="inline-flex items-center gap-1.5 bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded px-2 py-0.5 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
                        <span className="text-[10px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] uppercase tracking-wider">{d.process_context}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-[var(--m12-border)] font-[family-name:var(--font-space-mono)]">
                      Updated {new Date(d.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
              {archivedDiagrams.length > 0 && (
                <div className="mt-8">
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className="flex items-center gap-2 text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] transition-colors mb-3"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}>
                      <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-60">
                      <rect x="2" y="3" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M3 6v7a1 1 0 001 1h8a1 1 0 001-1V6" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M6.5 9h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    Archived ({archivedDiagrams.length})
                  </button>
                  {showArchived && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {archivedDiagrams.map((d) => (
                        <div key={d.id} className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/20 rounded-xl p-5 opacity-60 hover:opacity-80 transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="text-sm font-semibold text-[var(--m12-text)] truncate flex-1">{d.title}</h3>
                            <button
                              onClick={(e) => handleRestore(d.id, e)}
                              title="Restore diagram"
                              className="text-[var(--m12-border)] hover:text-[#10B981] transition-colors ml-2 shrink-0 text-[10px] font-medium font-[family-name:var(--font-space-mono)] uppercase tracking-wider flex items-center gap-1"
                            >
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                <path d="M4 6h6a3 3 0 010 6H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M7 3L4 6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Restore
                            </button>
                          </div>
                          {d.process_context && (
                            <div className="inline-flex items-center gap-1.5 bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded px-2 py-0.5 mb-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
                              <span className="text-[10px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] uppercase tracking-wider">{d.process_context}</span>
                            </div>
                          )}
                          <div className="text-[10px] text-[var(--m12-border)] font-[family-name:var(--font-space-mono)]">
                            Archived {new Date(d.archived_at!).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        ) : (
          /* ─── SIPOC Maps Tab ───────────────────────────── */
          activeMaps.length === 0 && archivedMaps.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-[var(--m12-border)]/60 rounded-2xl">
              <div className="text-5xl mb-4 opacity-20">&#9645;</div>
              <h2 className="text-lg font-semibold text-[var(--m12-text-secondary)] mb-2">
                No capability maps yet
              </h2>
              <p className="text-sm text-[var(--m12-text-muted)] mb-6">
                Create a SIPOC capability map to model data inputs, outputs, and personas.
              </p>
              <button
                onClick={handleNewCapabilityMap}
                className="inline-flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Create SIPOC Map
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={handleNewCapabilityMap}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--m12-border)]/40 hover:border-[#8B5CF6]/60 rounded-xl p-8 transition-colors group"
                >
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-[var(--m12-border)] group-hover:text-[#8B5CF6] transition-colors mb-2">
                    <path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span className="text-sm text-[var(--m12-text-muted)] group-hover:text-[var(--m12-text-secondary)] transition-colors">New SIPOC Map</span>
                </button>
                {activeMaps.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => router.push(`/capability-map/${m.id}`)}
                    className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 hover:border-[var(--m12-border)] rounded-xl p-5 cursor-pointer transition-all card-glow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-sm font-semibold text-[var(--m12-text)] truncate flex-1">{m.title}</h3>
                      <button
                        onClick={(e) => handleArchiveMap(m.id, e)}
                        title="Archive capability map"
                        className="text-[var(--m12-border)] hover:text-[#EAB308] transition-colors ml-2 shrink-0"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <rect x="2" y="3" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M3 6v7a1 1 0 001 1h8a1 1 0 001-1V6" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M6.5 9h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                    <div className="inline-flex items-center gap-1.5 bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded px-2 py-0.5 mb-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                      <span className="text-[10px] font-[family-name:var(--font-space-mono)] text-[#8B5CF6] uppercase tracking-wider font-bold">SIPOC</span>
                    </div>
                    {m.description && (
                      <div className="text-[11px] text-[var(--m12-text-muted)] mb-2 line-clamp-2">{m.description}</div>
                    )}
                    <div className="text-[10px] text-[var(--m12-border)] font-[family-name:var(--font-space-mono)]">
                      Updated {new Date(m.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
              {archivedMaps.length > 0 && (
                <div className="mt-8">
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className="flex items-center gap-2 text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] transition-colors mb-3"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}>
                      <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-60">
                      <rect x="2" y="3" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M3 6v7a1 1 0 001 1h8a1 1 0 001-1V6" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M6.5 9h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    Archived ({archivedMaps.length})
                  </button>
                  {showArchived && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {archivedMaps.map((m) => (
                        <div key={m.id} className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/20 rounded-xl p-5 opacity-60 hover:opacity-80 transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="text-sm font-semibold text-[var(--m12-text)] truncate flex-1">{m.title}</h3>
                            <button
                              onClick={(e) => handleRestoreMap(m.id, e)}
                              title="Restore capability map"
                              className="text-[var(--m12-border)] hover:text-[#10B981] transition-colors ml-2 shrink-0 text-[10px] font-medium font-[family-name:var(--font-space-mono)] uppercase tracking-wider flex items-center gap-1"
                            >
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                <path d="M4 6h6a3 3 0 010 6H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M7 3L4 6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Restore
                            </button>
                          </div>
                          <div className="text-[10px] text-[var(--m12-border)] font-[family-name:var(--font-space-mono)]">
                            Archived {new Date(m.archived_at!).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  )
}
