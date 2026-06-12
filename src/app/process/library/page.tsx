'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import ReferenceLibraryBrowser from '@/components/process/ReferenceLibraryBrowser'
import VersionBadge from '@/components/VersionBadge'

export default function ProcessLibraryPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  if (loading || !user || !organization) return null

  return (
    <div className="min-h-screen bg-[var(--m12-bg)] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
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
                <span className="text-[var(--m12-text-secondary)] text-base font-medium">Process Reference</span>
                <span className="self-end mb-0.5"><VersionBadge /></span>
              </div>
              <p className="text-xs text-[var(--m12-text-muted)] mt-0.5">
                SAP-style best-practice processes, tailored for Aerospace &amp; Defense. Instantiate one to start an editable model.
              </p>
            </div>
          </div>
        </div>

        <ReferenceLibraryBrowser orgId={organization.id} userId={user.id} />
      </div>
    </div>
  )
}
