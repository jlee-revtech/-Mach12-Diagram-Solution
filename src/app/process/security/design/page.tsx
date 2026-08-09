'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import { PageHeader } from '@/components/common'
import SecurityDesignStudio from '@/components/security/SecurityDesignStudio'

export default function ProcessSecurityDesignPage() {
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
        title="Security Design"
        icon={<ShieldCheck size={24} />}
        subtitle="Work a security design with the agent — grounded best practice, and solution options with pros, cons, effort, and risk wherever standard SAP will not cover the requirement — then bring the COTS and custom apps around SAP under one governed security model."
      />
      <SecurityDesignStudio orgId={organization.id} userId={user.id} />
    </div>
  )
}
