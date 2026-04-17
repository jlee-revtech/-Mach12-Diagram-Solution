'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import {
  getShareByCode, getCapabilityMapAnon, listCapabilitiesAnon,
  listCapabilityInputsAnon, listCapabilityOutputsAnon,
  listPersonasAnon, listInformationProductsAnon, listLogicalSystemsAnon, listTagsAnon,
} from '@/lib/supabase/capability-maps'
import type { CapabilityInput, CapabilityOutput } from '@/lib/sipoc/types'
import SIPOCDrawer from '@/components/sipoc/SIPOCDrawer'
import CapabilityMapView from '@/components/sipoc/CapabilityMapView'
import VersionBadge from '@/components/VersionBadge'
import { useTheme } from '@/lib/theme-context'

export default function SharePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready'>('loading')
  const [mapTitle, setMapTitle] = useState('')
  const [mapDescription, setMapDescription] = useState('')
  const { theme, toggleTheme } = useTheme()

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

      // Load entity pools
      const [personas, informationProducts, logicalSystems, tags] = await Promise.all([
        listPersonasAnon(map.organization_id),
        listInformationProductsAnon(map.organization_id),
        listLogicalSystemsAnon(map.organization_id),
        listTagsAnon(map.organization_id),
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
        loading: false,
      })

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

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 bg-[var(--m12-bg)] flex items-center justify-center">
        <div className="text-[var(--m12-text-muted)] text-sm">Loading shared capability map...</div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="fixed inset-0 bg-[var(--m12-bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-[var(--m12-text)] mb-2">Link expired or invalid</h1>
          <p className="text-[var(--m12-text-muted)] text-sm">This share link is no longer active. Ask the map owner to generate a new one.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[var(--m12-bg)] flex flex-col">
      {/* Top bar — mirrors the real capability map page but read-only */}
      <div className="h-12 border-b border-[var(--m12-border)]/40 bg-[var(--m12-bg-card)] flex items-center px-4 gap-4 shrink-0">
        <span className="text-gradient text-sm font-bold font-[family-name:var(--font-orbitron)] tracking-wide">
          MACH12
        </span>
        <VersionBadge />
        <span className="text-[var(--m12-text-muted)] text-xs">/</span>
        <span className="text-base font-semibold text-[var(--m12-text)] truncate max-w-[400px]">
          {mapTitle}
        </span>
        <span className="text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-1 rounded-md">
          Capability Map
        </span>

        <div className="flex-1" />

        <span className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-500 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 2a2 2 0 00-2 2v1H2.5a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5H7V4a2 2 0 00-2-2zm0 .8A1.2 1.2 0 016.2 4v1H3.8V4A1.2 1.2 0 015 2.8z" fill="currentColor"/>
          </svg>
          Read-Only
        </span>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:border-[var(--m12-border)] transition-colors"
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.76 3.76l1.06 1.06M11.18 11.18l1.06 1.06M3.76 12.24l1.06-1.06M11.18 4.82l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M13.5 9.5a5.5 5.5 0 01-7-7 5.5 5.5 0 107 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
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
