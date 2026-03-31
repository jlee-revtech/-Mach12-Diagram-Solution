'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { listDiagrams, createDiagram, deleteDiagram as deleteDiagramApi } from '@/lib/supabase/diagrams'
import type { DiagramRow } from '@/lib/supabase/types'

export default function Dashboard() {
  const [diagrams, setDiagrams] = useState<DiagramRow[]>([])
  const [loadingDiagrams, setLoadingDiagrams] = useState(true)
  const router = useRouter()
  const { user, profile, organization, organizations, loading, signOut, switchOrg } = useAuth()
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)

  // Auth gating
  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  // Load diagrams
  useEffect(() => {
    if (organization) {
      listDiagrams(organization.id)
        .then(setDiagrams)
        .finally(() => setLoadingDiagrams(false))
    }
  }, [organization])

  const handleNew = useCallback(async () => {
    if (!organization || !user) return
    const diagram = await createDiagram(organization.id, user.id)
    router.push(`/diagram/${diagram.id}`)
  }, [organization, user, router])

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!confirm('Delete this diagram?') || !organization) return
      await deleteDiagramApi(id)
      setDiagrams(await listDiagrams(organization.id))
    },
    [organization]
  )

  if (loading || !user || !organization) return null

  return (
    <div className="min-h-screen bg-[#151E2E] p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-gradient text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wide">
                MACH12
              </span>
              <span className="text-[#64748B] text-lg font-light">/</span>
              <span className="text-[#CBD5E1] text-lg font-medium">Diagrams</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {/* Org switcher */}
              <div className="relative">
                <button
                  onClick={() => setOrgMenuOpen(!orgMenuOpen)}
                  className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#CBD5E1] transition-colors"
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
                    <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-[#1F2C3F] border border-[#374A5E]/60 rounded-lg shadow-xl overflow-hidden">
                      <div className="px-3 py-2 border-b border-[#374A5E]/40">
                        <span className="text-[9px] uppercase tracking-widest text-[#64748B] font-[family-name:var(--font-space-mono)] font-bold">
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
                            listDiagrams(org.id).then(setDiagrams).finally(() => setLoadingDiagrams(false))
                          }}
                          className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs transition-colors ${
                            org.id === organization.id
                              ? 'bg-[#2563EB]/10 text-[#93C5FD]'
                              : 'text-[#CBD5E1] hover:bg-[#151E2E]'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${org.id === organization.id ? 'bg-[#2563EB]' : 'bg-[#374A5E]'}`} />
                          <span className="flex-1 truncate">{org.name}</span>
                          <span className="text-[8px] uppercase text-[#64748B] font-[family-name:var(--font-space-mono)]">
                            {org.role}
                          </span>
                        </button>
                      ))}
                      <div className="border-t border-[#374A5E]/40">
                        <button
                          onClick={() => { setOrgMenuOpen(false); router.push('/setup') }}
                          className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-[#64748B] hover:text-[#CBD5E1] hover:bg-[#151E2E] transition-colors"
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
              <span className="text-[#374A5E]">|</span>
              <span className="text-xs text-[#64748B]">{profile?.display_name || profile?.email}</span>
              <button
                onClick={signOut}
                className="text-xs text-[#374A5E] hover:text-red-400 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#3B82F6] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#2563EB]/20"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            New Diagram
          </button>
        </div>

        {/* Diagram grid */}
        {loadingDiagrams ? (
          <div className="text-center py-24 text-[#64748B] text-sm">Loading diagrams...</div>
        ) : diagrams.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-[#374A5E]/60 rounded-2xl">
            <div className="text-5xl mb-4 opacity-20">&#9634;</div>
            <h2 className="text-lg font-semibold text-[#CBD5E1] mb-2">
              No diagrams yet
            </h2>
            <p className="text-sm text-[#64748B] mb-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* New diagram card */}
            <button
              onClick={handleNew}
              className="flex flex-col items-center justify-center border-2 border-dashed border-[#374A5E]/40 hover:border-[#2563EB]/60 rounded-xl p-8 transition-colors group"
            >
              <svg
                width="32" height="32" viewBox="0 0 32 32" fill="none"
                className="text-[#374A5E] group-hover:text-[#2563EB] transition-colors mb-2"
              >
                <path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-sm text-[#64748B] group-hover:text-[#CBD5E1] transition-colors">
                New Diagram
              </span>
            </button>

            {/* Existing diagrams */}
            {diagrams.map((d) => (
              <div
                key={d.id}
                onClick={() => router.push(`/diagram/${d.id}`)}
                className="bg-[#1F2C3F] border border-[#374A5E]/40 hover:border-[#374A5E] rounded-xl p-5 cursor-pointer transition-all card-glow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#F8FAFC] truncate flex-1">
                    {d.title}
                  </h3>
                  <button
                    onClick={(e) => handleDelete(d.id, e)}
                    className="text-[#374A5E] hover:text-red-400 transition-colors ml-2 shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                {d.process_context && (
                  <div className="inline-flex items-center gap-1.5 bg-[#151E2E] border border-[#374A5E]/40 rounded px-2 py-0.5 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
                    <span className="text-[10px] font-[family-name:var(--font-space-mono)] text-[#64748B] uppercase tracking-wider">
                      {d.process_context}
                    </span>
                  </div>
                )}
                <div className="text-[10px] text-[#374A5E] font-[family-name:var(--font-space-mono)]">
                  Updated {new Date(d.updated_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
