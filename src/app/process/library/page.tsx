'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Library } from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import { PageHeader } from '@/components/common'
import ReferenceLibraryBrowser from '@/components/process/ReferenceLibraryBrowser'

export default function ProcessLibraryPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  if (loading || !user || !organization) return null

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Process Reference"
        icon={<Library size={24} />}
        subtitle="SAP-style best-practice processes, tailored for Aerospace & Defense. Instantiate one to start an editable model."
      />
      <ReferenceLibraryBrowser orgId={organization.id} userId={user.id} />
    </div>
  )
}
