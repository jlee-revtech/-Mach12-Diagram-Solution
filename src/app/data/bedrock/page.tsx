'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import BedrockCatalog from '@/components/bedrock/BedrockCatalog'
import VersionBadge from '@/components/VersionBadge'

export default function BedrockSystemsPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  if (loading || !user || !organization) return null

  return (
    <div className="min-h-screen bg-[var(--m12-bg)] p-8">
      <div className="max-w-5xl mx-auto">
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
                <span className="text-[var(--m12-text-secondary)] text-base font-medium">Bedrock Systems</span>
                <span className="self-end mb-0.5"><VersionBadge /></span>
              </div>
              <p className="text-xs text-[var(--m12-text-muted)] mt-0.5">
                Your best-of-breed platform architecture. Logical bedrock systems (the Systems palette categories) each carry physical systems and ground the AI-generated data integration diagrams.
              </p>
            </div>
          </div>
        </div>

        <BedrockCatalog orgId={organization.id} userId={user.id} />
      </div>
    </div>
  )
}
