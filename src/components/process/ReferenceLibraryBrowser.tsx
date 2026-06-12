'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  listReferenceLibraries, listReferenceScenarios, listReferenceOverlays,
  instantiateReferenceScenario,
} from '@/lib/supabase/process-models'
import type { ReferenceLibraryRow, ReferenceScenario, ProcessOverlay } from '@/lib/process/types'

interface RefTreeNode extends ReferenceScenario {
  children: RefTreeNode[]
}

export default function ReferenceLibraryBrowser({ orgId, userId }: { orgId: string; userId: string }) {
  const router = useRouter()
  const [library, setLibrary] = useState<ReferenceLibraryRow | null>(null)
  const [scenarios, setScenarios] = useState<ReferenceScenario[]>([])
  const [overlaysByScenario, setOverlaysByScenario] = useState<Record<string, ProcessOverlay[]>>({})
  const [loading, setLoading] = useState(true)
  const [instantiating, setInstantiating] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const libs = await listReferenceLibraries(true)
      if (cancelled) return
      const lib = libs[0] || null
      setLibrary(lib)
      if (!lib) { setLoading(false); return }
      const [scen, overlays] = await Promise.all([
        listReferenceScenarios(lib.id),
        listReferenceOverlays(lib.id),
      ])
      if (cancelled) return
      const grouped: Record<string, ProcessOverlay[]> = {}
      for (const o of overlays) {
        ;(grouped[o.process_node_id] ||= []).push(o)
      }
      setScenarios(scen)
      setOverlaysByScenario(grouped)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const tree = useMemo<RefTreeNode[]>(() => {
    const byParent = new Map<string | null, ReferenceScenario[]>()
    for (const s of scenarios) {
      const k = s.parent_id ?? null
      if (!byParent.has(k)) byParent.set(k, [])
      byParent.get(k)!.push(s)
    }
    const build = (parentId: string | null): RefTreeNode[] =>
      (byParent.get(parentId) || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(s => ({ ...s, children: build(s.id) }))
    return build(null)
  }, [scenarios])

  const handleInstantiate = useCallback(async (scenario: ReferenceScenario) => {
    if (!confirm(`Create an editable process model from "${scenario.name}" and its sub-processes?`)) return
    setInstantiating(scenario.id)
    try {
      const model = await instantiateReferenceScenario(scenario.id, orgId, userId)
      router.push(`/process/${model.id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to instantiate')
      setInstantiating(null)
    }
  }, [orgId, userId, router])

  if (loading) return <div className="py-24 text-center text-sm text-[var(--m12-text-muted)]">Loading reference library…</div>
  if (!library) return <div className="py-24 text-center text-sm text-[var(--m12-text-muted)]">No reference library is published yet.</div>

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <span className="inline-flex items-center gap-1.5 bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 rounded px-2 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9]" />
          <span className="text-[10px] font-[family-name:var(--font-space-mono)] text-[#0EA5E9] uppercase tracking-wider font-bold">Reference Library</span>
        </span>
        <span className="text-sm font-semibold text-[var(--m12-text)]">{library.title}</span>
        <span className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">v{library.version}</span>
      </div>

      <div className="space-y-3">
        {tree.map(scenario => (
          <ScenarioCard
            key={scenario.id}
            node={scenario}
            overlaysByScenario={overlaysByScenario}
            onInstantiate={handleInstantiate}
            instantiating={instantiating}
          />
        ))}
      </div>
    </div>
  )
}

function ScenarioCard({ node, overlaysByScenario, onInstantiate, instantiating }: {
  node: RefTreeNode
  overlaysByScenario: Record<string, ProcessOverlay[]>
  onInstantiate: (s: ReferenceScenario) => void
  instantiating: string | null
}) {
  const [open, setOpen] = useState(false)
  const l3count = node.children.reduce((n, g) => n + g.children.length, 0)

  return (
    <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform shrink-0 ${open ? 'rotate-90' : ''}`}>
            <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="w-2 h-2 rounded-full bg-[#0EA5E9] shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--m12-text)] truncate">{node.name}</div>
            {node.description && <div className="text-[11px] text-[var(--m12-text-muted)] truncate">{node.description}</div>}
          </div>
        </button>
        <span className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] shrink-0">
          {node.children.length} groups · {l3count} processes
        </span>
        <button
          onClick={() => onInstantiate(node)}
          disabled={instantiating === node.id}
          className="shrink-0 flex items-center gap-1.5 bg-[#0EA5E9] hover:bg-[#38BDF8] disabled:opacity-50 text-white text-[11px] font-medium px-3 py-1.5 rounded-md transition-colors"
        >
          {instantiating === node.id ? 'Creating…' : 'Instantiate'}
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--m12-border)]/30 px-4 py-3 space-y-3">
          {node.children.map(group => (
            <div key={group.id}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                <span className="text-xs font-semibold text-[var(--m12-text-secondary)]">{group.name}</span>
                <button
                  onClick={() => onInstantiate(group)}
                  disabled={instantiating === group.id}
                  className="text-[9px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[#0EA5E9] hover:text-[#38BDF8] disabled:opacity-50"
                >
                  {instantiating === group.id ? '…' : 'Instantiate'}
                </button>
              </div>
              <div className="pl-3.5 space-y-1">
                {group.children.map(proc => {
                  const overlays = overlaysByScenario[proc.id] || []
                  return (
                    <div key={proc.id} className="flex items-start gap-2 py-1">
                      <span className="w-1 h-1 rounded-full bg-[#10B981] mt-2 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-[var(--m12-text)]">{proc.name}</span>
                          {proc.scope_item_ref && (
                            <span className="text-[9px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] border border-[var(--m12-border)]/50 rounded px-1 py-0.5">{proc.scope_item_ref}</span>
                          )}
                          {overlays.map(o => <OverlayChip key={o.id} overlay={o} />)}
                        </div>
                        {proc.description && <div className="text-[10px] text-[var(--m12-text-muted)]">{proc.description}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OverlayChip({ overlay }: { overlay: ProcessOverlay }) {
  const p = overlay.payload
  const color = overlay.overlay_kind === 'compliance' ? '#EF4444'
    : overlay.overlay_kind === 'kpi' ? '#10B981'
    : overlay.overlay_kind === 'accelerator' ? '#8B5CF6' : '#64748B'
  const label = overlay.overlay_kind === 'compliance'
    ? `${p.framework || ''} ${p.code || ''}`.trim()
    : overlay.overlay_kind === 'kpi'
      ? `${p.title}${p.kpiTarget ? ` ${p.kpiTarget}` : ''}`
      : p.title || overlay.overlay_kind
  return (
    <span
      title={p.notes || p.title}
      className="text-[9px] font-[family-name:var(--font-space-mono)] rounded px-1 py-0.5 border"
      style={{ color, borderColor: `${color}55`, background: `${color}12` }}
    >
      {label}
    </span>
  )
}
