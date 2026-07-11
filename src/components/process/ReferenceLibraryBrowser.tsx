'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Copy } from 'lucide-react'
import { Button, CollapsibleSection, EmptyState, LoadingState } from '@/components/common'
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

  if (loading) return <LoadingState label="Loading reference library..." />
  if (!library) {
    return (
      <EmptyState
        icon={<BookOpen size={32} />}
        title="No reference library published"
        description="A published best-practice library will appear here once it is available."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-status-blue-bg text-status-blue">
          Reference Library
        </span>
        <span className="text-body-md font-semibold text-text-primary">{library.title}</span>
        <span className="text-[11px] text-text-tertiary font-mono">v{library.version}</span>
      </div>

      <div className="space-y-3">
        {tree.map(scenario => (
          <ScenarioSection
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

function ScenarioSection({ node, overlaysByScenario, onInstantiate, instantiating }: {
  node: RefTreeNode
  overlaysByScenario: Record<string, ProcessOverlay[]>
  onInstantiate: (s: ReferenceScenario) => void
  instantiating: string | null
}) {
  const l3count = node.children.reduce((n, g) => n + g.children.length, 0)

  return (
    <CollapsibleSection
      id={node.id}
      storageKey="process-library:scenario"
      title={node.name}
      tone="blue"
      defaultOpen={false}
      actions={
        <>
          <span className="text-[11px] text-text-tertiary tabular-nums whitespace-nowrap">
            {node.children.length} groups · {l3count} processes
          </span>
          <Button
            size="sm"
            icon={<Copy size={12} />}
            loading={instantiating === node.id}
            onClick={() => onInstantiate(node)}
          >
            {instantiating === node.id ? 'Creating...' : 'Instantiate'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {node.description && (
          <p className="text-body-sm text-text-secondary">{node.description}</p>
        )}
        {node.children.map(group => (
          <div key={group.id}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span className="text-body-sm font-semibold text-text-secondary">{group.name}</span>
              <Button
                variant="ghost"
                size="sm"
                loading={instantiating === group.id}
                onClick={() => onInstantiate(group)}
              >
                Instantiate
              </Button>
            </div>
            <div className="pl-3.5 space-y-1">
              {group.children.map(proc => {
                const overlays = overlaysByScenario[proc.id] || []
                return (
                  <div key={proc.id} className="flex items-start gap-2 py-1">
                    <span className="w-1 h-1 rounded-full bg-status-green mt-2 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-body-sm text-text-primary">{proc.name}</span>
                        {proc.scope_item_ref && (
                          <span className="text-[10px] font-mono text-text-tertiary border border-border rounded px-1 py-0.5">{proc.scope_item_ref}</span>
                        )}
                        {overlays.map(o => <OverlayChip key={o.id} overlay={o} />)}
                      </div>
                      {proc.description && <div className="text-[11px] text-text-tertiary">{proc.description}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  )
}

function OverlayChip({ overlay }: { overlay: ProcessOverlay }) {
  const p = overlay.payload
  const cls = overlay.overlay_kind === 'compliance' ? 'bg-status-red-bg text-status-red'
    : overlay.overlay_kind === 'kpi' ? 'bg-status-green-bg text-status-green'
    : overlay.overlay_kind === 'accelerator' ? 'bg-purple-50 text-purple-700'
    : 'bg-gray-100 text-gray-500'
  const label = overlay.overlay_kind === 'compliance'
    ? `${p.framework || ''} ${p.code || ''}`.trim()
    : overlay.overlay_kind === 'kpi'
      ? `${p.title}${p.kpiTarget ? ` ${p.kpiTarget}` : ''}`
      : p.title || overlay.overlay_kind
  return (
    <span
      title={p.notes || p.title}
      className={`text-[10px] font-mono rounded px-1 py-0.5 ${cls}`}
    >
      {label}
    </span>
  )
}
