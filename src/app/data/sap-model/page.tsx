'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Boxes } from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import SapModelExplorer from '@/components/sap-model/SapModelExplorer'
import { PageHeader } from '@/components/common'

export default function SapModelPage() {
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
        title="SAP Enterprise Data Model"
        icon={<Boxes size={24} />}
        subtitle="The SAP organizational data model - controlling area, company codes, plants, storage locations, profit & cost centers, sales & purchasing orgs, and the project / WBS structure down to the levels where a Results Analysis key drives revenue recognition. Pulled live from the connected S/4HANA system."
      />
      <SapModelExplorer />
    </div>
  )
}
