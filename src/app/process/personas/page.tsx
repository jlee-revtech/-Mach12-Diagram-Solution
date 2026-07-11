'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import { PageHeader } from '@/components/common'
import PersonaCatalog from '@/components/process/PersonaCatalog'

export default function ProcessPersonasPage() {
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
        title="Persona Catalog"
        icon={<Users size={24} />}
        subtitle="Personas are made up of roles (many-to-many). A role can be instantiated as a swimlane in a process model."
      />
      <PersonaCatalog orgId={organization.id} />
    </div>
  )
}
