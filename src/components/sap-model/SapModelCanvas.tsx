'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { FileCode, FileText, Loader2 } from 'lucide-react'

import OrgNodeComponent from './OrgNode'
import DrillDrawer from './DrillDrawer'
import VisibilityPanel from './VisibilityPanel'
import { buildSchemaGraph, buildInstanceGraph, buildInstanceTree, type InstanceTreeNode } from '@/lib/sap-model/buildModelDiagram'
import { exportLiveConfigHtml, exportLiveConfigPdf } from '@/lib/sap-model/exportLiveConfig'
import { ENTITY_META } from '@/lib/sap-model/entityMeta'
import type { DrillData, OrgNodeData, SapEnterpriseModel } from '@/lib/sap-model/types'

const nodeTypes = { org: OrgNodeComponent }

function Legend() {
  const items = Object.values(ENTITY_META)
  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1 max-w-[560px] bg-white/85 backdrop-blur-sm border border-border rounded-lg shadow-card px-3 py-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: it.color }} />
          <span className="text-[10px] text-text-secondary">{it.label}</span>
        </div>
      ))}
    </div>
  )
}

// Parent/descendant lookups for cascading show/hide.
function buildTreeMaps(tree: InstanceTreeNode) {
  const parentOf = new Map<string, string>()
  const childrenOf = new Map<string, string[]>()
  ;(function walk(n: InstanceTreeNode) {
    childrenOf.set(n.id, n.children.map((c) => c.id))
    for (const c of n.children) {
      parentOf.set(c.id, n.id)
      walk(c)
    }
  })(tree)
  const subtreeIds = (id: string): string[] => {
    const out: string[] = [id]
    for (const c of childrenOf.get(id) ?? []) out.push(...subtreeIds(c))
    return out
  }
  const ancestorIds = (id: string): string[] => {
    const out: string[] = []
    let cur = parentOf.get(id)
    while (cur) { out.push(cur); cur = parentOf.get(cur) }
    return out
  }
  return { subtreeIds, ancestorIds }
}

const TOOLBAR_BTN =
  'flex items-center gap-1.5 rounded-lg border border-border bg-white/85 backdrop-blur-sm px-2.5 py-1.5 text-[11px] font-medium text-text-secondary shadow-card transition-colors hover:text-text-primary disabled:opacity-50'

function CanvasInner({ model, mode }: { model: SapEnterpriseModel; mode: 'schema' | 'instances' }) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [pdfBusy, setPdfBusy] = useState(false)
  const [drill, setDrill] = useState<DrillData | null>(null)
  const { fitView } = useReactFlow()

  const tree = useMemo(() => (mode === 'instances' ? buildInstanceTree(model) : null), [model, mode])
  const maps = useMemo(() => (tree ? buildTreeMaps(tree) : null), [tree])

  const { nodes, edges } = useMemo(
    () => (mode === 'schema' ? buildSchemaGraph(model) : buildInstanceGraph(model, hidden)),
    [model, mode, hidden]
  )

  // Re-fit after a show/hide change (layout re-packs the tree).
  const firstFit = useRef(true)
  useEffect(() => {
    if (firstFit.current) { firstFit.current = false; return }
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50)
    return () => clearTimeout(t)
  }, [hidden, fitView])

  const toggle = useCallback((id: string) => {
    if (!maps) return
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        // show: the element, its subtree, and any hidden ancestors
        maps.subtreeIds(id).forEach((i) => next.delete(i))
        maps.ancestorIds(id).forEach((i) => next.delete(i))
      } else {
        // hide: cascades down to everything beneath it
        maps.subtreeIds(id).forEach((i) => next.add(i))
      }
      return next
    })
  }, [maps])

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const d = (node.data as OrgNodeData).drill
    setDrill(d ?? null)
  }, [])

  const onExportPdf = useCallback(async () => {
    setPdfBusy(true)
    try {
      await exportLiveConfigPdf(model, hidden)
    } finally {
      setPdfBusy(false)
    }
  }, [model, hidden])

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2.5}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={onNodeClick}
        onPaneClick={() => setDrill(null)}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: 'var(--m12-bg)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} style={{ color: 'var(--m12-canvas-dot)' } as React.CSSProperties} />
        <Controls showInteractive={false} className="!bg-white !border-border !shadow-card" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const d = n.data as { kind?: keyof typeof ENTITY_META }
            return d.kind ? ENTITY_META[d.kind].color : '#64748B'
          }}
          nodeBorderRadius={6}
          maskColor="var(--m12-minimap-mask)"
          style={{ width: 150, height: 96, backgroundColor: 'var(--m12-minimap-bg)', borderColor: 'var(--m12-minimap-stroke)', borderRadius: 8 }}
        />
      </ReactFlow>

      {mode === 'instances' && tree && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportLiveConfigHtml(model, hidden)}
            title="Download as a standalone HTML report"
            className={TOOLBAR_BTN}
          >
            <FileCode size={13} /> HTML
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={pdfBusy}
            title="Download as PDF"
            className={TOOLBAR_BTN}
          >
            {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} PDF
          </button>
          <VisibilityPanel tree={tree} hidden={hidden} onToggle={toggle} onShowAll={() => setHidden(new Set())} />
        </div>
      )}

      <Legend />
      {drill && <DrillDrawer data={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}

export default function SapModelCanvas({ model, mode }: { model: SapEnterpriseModel; mode: 'schema' | 'instances' }) {
  return (
    <ReactFlowProvider>
      <CanvasInner model={model} mode={mode} />
    </ReactFlowProvider>
  )
}
