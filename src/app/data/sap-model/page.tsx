'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import SapModelExplorer from '@/components/sap-model/SapModelExplorer'
import VersionBadge from '@/components/VersionBadge'

export default function SapModelPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  if (loading || !user || !organization) return null

  return (
    <div className="min-h-screen bg-[var(--m12-bg)] p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors shrink-0"
              title="Back to dashboard"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11 4l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-gradient text-lg font-bold font-[family-name:var(--font-orbitron)] tracking-wide">MACH12</span>
                <span className="text-[var(--m12-text-muted)]">/</span>
                <span className="text-[var(--m12-text-secondary)] text-base font-medium">SAP Enterprise Data Model</span>
                <span className="self-end mb-0.5"><VersionBadge /></span>
              </div>
              <p className="text-xs text-[var(--m12-text-muted)] mt-0.5 max-w-2xl">
                The SAP organizational data model — controlling area, company codes, plants, storage locations,
                profit &amp; cost centers, sales &amp; purchasing orgs, and the project / WBS structure down to the
                levels where a Results Analysis key drives revenue recognition. Pulled live from the connected S/4HANA system.
              </p>
            </div>
          </div>
        </div>

        <SapModelExplorer />
      </div>
    </div>
  )
}
