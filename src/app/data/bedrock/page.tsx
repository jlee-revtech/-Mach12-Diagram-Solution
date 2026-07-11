'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Database } from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import BedrockCatalog from '@/components/bedrock/BedrockCatalog'
import { PageHeader } from '@/components/common'

export default function BedrockSystemsPage() {
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
        title="Bedrock Systems"
        icon={<Database size={24} />}
        subtitle="Your best-of-breed platform architecture. Logical bedrock systems (the Systems palette categories) each carry physical systems and ground the AI-generated data integration diagrams."
      />
      <BedrockCatalog orgId={organization.id} userId={user.id} />
    </div>
  )
}
