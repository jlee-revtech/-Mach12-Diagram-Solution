'use client'

import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import OrgNodeComponent from './OrgNode'
import { buildSchemaGraph, buildInstanceGraph } from '@/lib/sap-model/buildModelDiagram'
import { ENTITY_META } from '@/lib/sap-model/entityMeta'
import type { SapEnterpriseModel } from '@/lib/sap-model/types'

const nodeTypes = { org: OrgNodeComponent }

function Legend() {
  const items = Object.values(ENTITY_META)
  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1 max-w-[560px] bg-[var(--m12-bg-card)]/85 backdrop-blur-sm border border-[var(--m12-border)]/50 rounded-lg px-3 py-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: it.color }} />
          <span className="text-[9px] text-[var(--m12-text-muted)]">{it.label}</span>
        </div>
      ))}
    </div>
  )
}

function CanvasInner({ model, mode }: { model: SapEnterpriseModel; mode: 'schema' | 'instances' }) {
  const { nodes, edges } = useMemo(
    () => (mode === 'schema' ? buildSchemaGraph(model) : buildInstanceGraph(model)),
    [model, mode]
  )

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
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: 'var(--m12-bg)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} style={{ color: 'var(--m12-canvas-dot)' } as React.CSSProperties} />
        <Controls showInteractive={false} className="!bg-[var(--m12-bg-card)] !border-[var(--m12-border)]" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const d = n.data as { kind?: keyof typeof ENTITY_META }
            return d.kind ? ENTITY_META[d.kind].color : '#64748B'
          }}
          nodeBorderRadius={6}
          maskColor="var(--m12-minimap-mask)"
          style={{ width: 150, height: 96, backgroundColor: 'var(--m12-minimap-bg)', borderColor: 'var(--m12-border)', borderRadius: 8 }}
        />
      </ReactFlow>
      <Legend />
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
