'use client'

import { use, useEffect, useState } from 'react'
import {
  getCmShareByCode, listCapabilityMapAnon, listBedrockCatalogAnon, listWorkstreamsAnon,
} from '@/lib/supabase/capmap-shares'
import CapabilityMapShareView from '@/components/capmap/CapabilityMapShareView'
import { LoadingState } from '@/components/common'
import { Mach12Logo } from '@/components/brand/Mach12Logo'
import type { CapabilityWithSystems } from '@/lib/capmap/types'
import type { BedrockSystemWithPhysicals } from '@/lib/bedrock/types'
import type { Workstream } from '@/lib/workstream/types'

// Public, read-only Capability Map share. No auth: data comes through the anon
// fetchers, which RLS only permits while a valid (non-expired) cm_capability_share
// exists for the org (migration 039).
export default function CapmapSharePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [state, setState] = useState<'loading' | 'invalid' | 'ready'>('loading')
  const [caps, setCaps] = useState<CapabilityWithSystems[]>([])
  const [catalog, setCatalog] = useState<BedrockSystemWithPhysicals[]>([])
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const share = await getCmShareByCode(code)
      if (!share) { if (!cancelled) setState('invalid'); return }
      const [c, cat, ws] = await Promise.all([
        listCapabilityMapAnon(share.organization_id),
        listBedrockCatalogAnon(share.organization_id),
        listWorkstreamsAnon(share.organization_id),
      ])
      if (cancelled) return
      setCaps(c); setCatalog(cat); setWorkstreams(ws); setExpiresAt(share.expires_at); setState('ready')
    })()
    return () => { cancelled = true }
  }, [code])

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center">
        <LoadingState variant="inline" label="Loading capability map…" />
      </div>
    )
  }
  if (state === 'invalid') {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Mach12Logo size={24} />
            <span className="text-gradient font-display font-bold text-body-md tracking-wide">MACH12</span>
          </div>
          <h1 className="font-display text-heading-sm text-text-primary mb-2">Link unavailable</h1>
          <p className="text-body-sm text-text-secondary">This share link is invalid or has expired. Ask the owner for a new one.</p>
        </div>
      </div>
    )
  }
  return <CapabilityMapShareView caps={caps} catalog={catalog} workstreams={workstreams} title="Capability Map" expiresAt={expiresAt} />
}
