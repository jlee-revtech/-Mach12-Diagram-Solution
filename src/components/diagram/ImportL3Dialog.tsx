'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/supabase/auth-context'
import { useDiagramStore } from '@/lib/diagram/store'
import { useSIPOCStore } from '@/lib/sipoc/store'
import { listCapabilityMaps, listCapabilities } from '@/lib/supabase/capability-maps'
import type { CapabilityMapRow, Capability } from '@/lib/sipoc/types'
import { buildL3GroupCanvasData } from '@/lib/sipoc/pushToDiagram'

export default function ImportL3Dialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported?: (groupId: string) => void
}) {
  const { organization } = useAuth()
  const insertSeed = useDiagramStore(s => s.insertSeed)

  const [maps, setMaps] = useState<CapabilityMapRow[]>([])
  const [mapFilter, setMapFilter] = useState('')
  const [loadingMaps, setLoadingMaps] = useState(false)

  const [selectedMapId, setSelectedMapId] = useState<string | null>(null)
  const [caps, setCaps] = useState<Capability[]>([])
  const [capFilter, setCapFilter] = useState('')
  const [loadingCaps, setLoadingCaps] = useState(false)

  const [selectedCapId, setSelectedCapId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load maps when opened
  useEffect(() => {
    if (!open || !organization) return
    setLoadingMaps(true)
    listCapabilityMaps(organization.id).then(rows => {
      setMaps(rows)
      setLoadingMaps(false)
    })
  }, [open, organization])

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setSelectedMapId(null)
      setSelectedCapId(null)
      setCaps([])
      setMapFilter('')
      setCapFilter('')
      setError(null)
    }
  }, [open])

  // Load capabilities when a map is selected
  useEffect(() => {
    if (!selectedMapId) return
    setLoadingCaps(true)
    setSelectedCapId(null)
    listCapabilities(selectedMapId).then(rows => {
      setCaps(rows.filter(c => c.level === 3))
      setLoadingCaps(false)
    })
  }, [selectedMapId])

  const filteredMaps = useMemo(() => {
    const q = mapFilter.trim().toLowerCase()
    return q ? maps.filter(m => m.title.toLowerCase().includes(q)) : maps
  }, [maps, mapFilter])

  const filteredCaps = useMemo(() => {
    const q = capFilter.trim().toLowerCase()
    return q ? caps.filter(c => c.name.toLowerCase().includes(q)) : caps
  }, [caps, capFilter])

  const handleImport = useCallback(async () => {
    if (!selectedMapId || !selectedCapId || !organization) return
    setImporting(true)
    setError(null)
    try {
      const sipocStore = useSIPOCStore.getState()
      const promises: Promise<unknown>[] = []
      if (sipocStore.map?.id !== selectedMapId) {
        promises.push(sipocStore.loadMap(selectedMapId))
      }
      if (sipocStore.informationProducts.length === 0 || sipocStore.logicalSystems.length === 0) {
        promises.push(sipocStore.loadOrgEntities(organization.id))
      }
      await Promise.all(promises)

      const fresh = useSIPOCStore.getState()
      const hydrated = fresh.getHydratedCapabilities().find(c => c.id === selectedCapId)
      if (!hydrated) throw new Error('Could not load that L3 — try again')

      const seed = buildL3GroupCanvasData(hydrated, {
        systemDataElements: fresh.systemDataElements,
      })
      const groupId = insertSeed(seed)
      onImported?.(groupId)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setImporting(false)
    }
  }, [selectedMapId, selectedCapId, organization, insertSeed, onImported, onClose])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-2xl shadow-2xl w-[820px] max-w-[92vw] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--m12-border)]/30 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[10px] font-[family-name:var(--font-space-mono)] uppercase tracking-widest font-bold text-[#06B6D4]">
              Import L3 SIPOC
            </div>
            <div className="text-xs text-[var(--m12-text-muted)] mt-0.5">
              Pick a capability map, then an L3 to insert as a Group on this diagram.
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)] transition-colors"
            title="Close (Esc)"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body: two columns */}
        <div className="flex-1 grid grid-cols-2 overflow-hidden">
          {/* Maps column */}
          <div className="flex flex-col border-r border-[var(--m12-border)]/30 min-h-0">
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-widest font-bold text-[var(--m12-text-muted)] mb-1.5">
                Capability Maps
              </div>
              <input
                value={mapFilter}
                onChange={e => setMapFilter(e.target.value)}
                placeholder="Filter maps..."
                className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded-md px-2.5 py-1.5 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#06B6D4]/60"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {loadingMaps ? (
                <div className="text-[11px] italic text-[var(--m12-text-faint)] px-2 py-3">Loading...</div>
              ) : filteredMaps.length === 0 ? (
                <div className="text-[11px] italic text-[var(--m12-text-faint)] px-2 py-3">No maps</div>
              ) : (
                filteredMaps.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMapId(m.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors mb-0.5 ${
                      selectedMapId === m.id
                        ? 'bg-[#06B6D4]/15 text-[var(--m12-text)] font-medium'
                        : 'text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg)]'
                    }`}
                  >
                    <div className="truncate">{m.title}</div>
                    {m.description && (
                      <div className="text-[10px] text-[var(--m12-text-faint)] truncate mt-0.5">{m.description}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* L3 column */}
          <div className="flex flex-col min-h-0">
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-widest font-bold text-[var(--m12-text-muted)] mb-1.5">
                L3 Functionalities
              </div>
              <input
                value={capFilter}
                onChange={e => setCapFilter(e.target.value)}
                placeholder={selectedMapId ? 'Filter L3s...' : 'Pick a map first'}
                disabled={!selectedMapId}
                className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded-md px-2.5 py-1.5 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#06B6D4]/60 disabled:opacity-40"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {!selectedMapId ? (
                <div className="text-[11px] italic text-[var(--m12-text-faint)] px-2 py-3">
                  Select a map on the left to see its L3 functionalities.
                </div>
              ) : loadingCaps ? (
                <div className="text-[11px] italic text-[var(--m12-text-faint)] px-2 py-3">Loading...</div>
              ) : filteredCaps.length === 0 ? (
                <div className="text-[11px] italic text-[var(--m12-text-faint)] px-2 py-3">No L3s in this map</div>
              ) : (
                filteredCaps.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCapId(c.id)}
                    onDoubleClick={() => { setSelectedCapId(c.id); handleImport() }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors mb-0.5 flex items-center gap-2 ${
                      selectedCapId === c.id
                        ? 'bg-[#06B6D4]/15 text-[var(--m12-text)] font-medium'
                        : 'text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg)]'
                    }`}
                  >
                    {c.color && (
                      <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: c.color }} />
                    )}
                    <span className="truncate">{c.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--m12-border)]/30 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-red-400 truncate">{error || ''}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!selectedCapId || importing}
              className="bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-40 disabled:hover:bg-[#06B6D4] text-white px-4 py-1.5 rounded-md text-xs font-medium transition-colors"
            >
              {importing ? 'Importing...' : 'Import as Group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
