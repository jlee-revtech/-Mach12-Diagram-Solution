'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { Lock, Download } from 'lucide-react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import {
  getShareByCode, getCapabilityMapAnon, listCapabilitiesAnon,
  listCapabilityInputsAnon, listCapabilityOutputsAnon,
  listPersonasAnon, listInformationProductsAnon, listLogicalSystemsAnon, listTagsAnon,
  listSystemDataElementsAnon, listWorkstreamsAnon,
} from '@/lib/supabase/capability-maps'
import type { CapabilityInput, CapabilityOutput } from '@/lib/sipoc/types'
import SIPOCDrawer from '@/components/sipoc/SIPOCDrawer'
import CapabilityMapView from '@/components/sipoc/CapabilityMapView'
import VersionBadge from '@/components/VersionBadge'
import { Button, EmptyState, LoadingState } from '@/components/common'
import { Mach12Logo } from '@/components/brand/Mach12Logo'
import { exportCapabilityMapWorkbook } from '@/lib/export/capabilityMap'

export default function SharePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready'>('loading')
  const [mapTitle, setMapTitle] = useState('')
  const [mapDescription, setMapDescription] = useState('')

  const selectedCapabilityId = useSIPOCStore(s => s.selectedCapabilityId)
  const drawerFullscreen = useSIPOCStore(s => s.drawerFullscreen)

  useEffect(() => {
    async function load() {
      // Set read-only mode
      useSIPOCStore.setState({ readOnly: true })

      const share = await getShareByCode(code)
      if (!share) { setStatus('invalid'); return }

      const map = await getCapabilityMapAnon(share.capability_map_id)
      if (!map) { setStatus('invalid'); return }

      setMapTitle(map.title)
      setMapDescription(map.description || '')

      // Load capabilities
      const caps = await listCapabilitiesAnon(share.capability_map_id)

      // Load inputs/outputs for all capabilities
      const [inputResults, outputResults] = await Promise.all([
        Promise.all(caps.map(c => listCapabilityInputsAnon(c.id))),
        Promise.all(caps.map(c => listCapabilityOutputsAnon(c.id))),
      ])
      const inputs: Record<string, CapabilityInput[]> = {}
      const outputs: Record<string, CapabilityOutput[]> = {}
      caps.forEach((c, i) => { inputs[c.id] = inputResults[i]; outputs[c.id] = outputResults[i] })

      // Load entity pools (systemDataElements + workstreams feed the Excel export)
      const [personas, informationProducts, logicalSystems, tags, systemDataElements, workstreams] = await Promise.all([
        listPersonasAnon(map.organization_id),
        listInformationProductsAnon(map.organization_id),
        listLogicalSystemsAnon(map.organization_id),
        listTagsAnon(map.organization_id),
        listSystemDataElementsAnon(map.organization_id),
        listWorkstreamsAnon(map.organization_id),
      ])

      // Populate the SIPOC store directly (same shape as loadMap + loadOrgEntities)
      useSIPOCStore.setState({
        map,
        capabilities: caps,
        inputs,
        outputs,
        personas,
        informationProducts,
        logicalSystems,
        tags,
        systemDataElements,
        workstreams,
        loading: false,
      })

      // Load comments (anon path)
      useSIPOCStore.getState().loadComments(map.id, true)

      setStatus('ready')
    }
    load()

    // Clean up readOnly on unmount
    return () => { useSIPOCStore.setState({ readOnly: false }) }
  }, [code])

  const handleSelectCapability = useCallback((id: string) => {
    const current = useSIPOCStore.getState().selectedCapabilityId
    useSIPOCStore.getState().setSelectedCapability(current === id ? null : id)
  }, [])

  // Full capability-map Excel export — identical workbook to the authed editor,
  // driven off the read-only store the share page already hydrated.
  const handleExportAll = useCallback(() => {
    const store = useSIPOCStore.getState()
    const map = store.map
    if (!map) return
    try {
      exportCapabilityMapWorkbook({
        title: map.title,
        tree: store.getCapabilityTree(),
        hydrated: store.getHydratedCapabilities(),
        informationProducts: store.informationProducts,
        systemDataElements: store.systemDataElements,
        logicalSystems: store.logicalSystems,
        personas: store.personas,
        workstreams: store.workstreams,
      })
    } catch (e) {
      console.error('Export failed:', e)
      alert(e instanceof Error ? e.message : 'Export failed')
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 bg-surface-muted flex items-center justify-center">
        <LoadingState variant="inline" label="Loading shared capability map..." />
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="fixed inset-0 bg-surface-muted flex items-center justify-center p-6">
        <EmptyState
          variant="inline"
          icon={<Lock size={32} />}
          title="Link expired or invalid"
          description="This share link is no longer active. Ask the map owner to generate a new one."
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-surface-muted flex flex-col">
      {/* Top bar — minimal white read-only chrome over the shared map */}
      <div className="h-14 bg-white border-b border-border flex items-center px-4 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Mach12Logo size={24} />
          <span className="text-gradient font-display font-bold text-body-md tracking-wide">
            MACH12
          </span>
        </div>
        <VersionBadge />
        <span className="text-body-sm text-text-tertiary">/</span>
        <span className="text-body-md font-semibold text-text-primary truncate max-w-[400px]">
          {mapTitle}
        </span>
        <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded bg-status-blue-bg text-status-blue shrink-0">
          Capability Map
        </span>

        <div className="flex-1" />

        <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shrink-0">
          <Lock size={10} />
          Read-Only
        </span>

        {/* Easy button: full capability-map Excel export (same workbook as the editor) */}
        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={12} />}
          onClick={handleExportAll}
          title="Download the full capability map (L1 to L2 to L3 to SIPOC, IPs, data elements, use cases) as a structured Excel workbook"
        >
          Export to Excel
        </Button>
      </div>

      {/* Main content — same layout as the real capability map page */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {!drawerFullscreen && (
          <div className="flex-1 overflow-auto p-6 min-h-0 min-w-0">
            <CapabilityMapView
              onSelectCapability={handleSelectCapability}
            />
          </div>
        )}
        <SIPOCDrawer
          orgId=""
          editorOpen={false}
          onToggleEditor={() => {}}
          onShowAI={() => {}}
          mapTitle={mapTitle}
        />
      </div>
    </div>
  )
}
