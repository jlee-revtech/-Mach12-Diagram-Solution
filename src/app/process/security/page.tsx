'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield } from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import { PageHeader } from '@/components/common'
import SecurityRoleStudio from '@/components/security/SecurityRoleStudio'

export default function ProcessSecurityPage() {
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
        title="Security Roles"
        icon={<Shield size={24} />}
        subtitle="Design single, derived, and composite Z*/Y* PFCG roles, assign their SAP access, and map personas to roles — by hand or from the access already captured on process steps."
      />
      <SecurityRoleStudio orgId={organization.id} userId={user.id} />
    </div>
  )
}
