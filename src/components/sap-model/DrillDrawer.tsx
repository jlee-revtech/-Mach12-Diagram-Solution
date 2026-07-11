'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import type { DrillData, DrillItem, DrillTreeNode } from '@/lib/sap-model/types'
import { ENTITY_META } from '@/lib/sap-model/entityMeta'

// Canvas-scoped drill drawer. It intentionally mirrors the common DrillDrawer
// visual language (white panel, border-l, shadow-modal, sticky header,
// slide-in-right) but stays local: it overlays only the React Flow canvas
// (absolute within the canvas container, no portal/backdrop) and carries the
// entity-colored header + filter + tree API the org model needs.

function ItemRow({ it, color }: { it: DrillItem; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border hover:bg-surface-muted/60">
      <span className="text-[11px] font-bold font-mono shrink-0" style={{ color }}>{it.code}</span>
      {it.label && <span className="text-[11px] text-text-secondary truncate">{it.label}</span>}
      {it.meta && <span className="ml-auto text-[10px] text-text-tertiary font-mono shrink-0">{it.meta}</span>}
    </div>
  )
}

function countLeaves(n: DrillTreeNode): number {
  if (n.kind === 'leaf') return 1
  return (n.children ?? []).reduce((s, c) => s + countLeaves(c), 0)
}

function TreeNode({ node, depth, color, forceOpen }: { node: DrillTreeNode; depth: number; color: string; forceOpen: boolean }) {
  const [open, setOpen] = useState(true)
  const isOpen = forceOpen || open
  const pad = 8 + depth * 14

  if (node.kind === 'leaf') {
    return (
      <div className="flex items-center gap-2 py-1 border-t border-border hover:bg-surface-muted/60" style={{ paddingLeft: pad + 16, paddingRight: 12 }}>
        <span className="text-[11px] font-bold font-mono shrink-0" style={{ color }}>{node.code}</span>
        {node.label && <span className="text-[11px] text-text-secondary truncate">{node.label}</span>}
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 w-full text-left py-1.5 border-t border-border hover:bg-surface-muted/60"
        style={{ paddingLeft: pad, paddingRight: 12 }}
      >
        <ChevronRight size={10} className={`shrink-0 text-text-tertiary transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        <span className="text-[11px] font-semibold text-text-primary truncate">{node.label || node.code}</span>
        <span className="text-[10px] text-text-tertiary font-mono truncate">{node.code}</span>
        <span className="ml-auto text-[10px] text-text-tertiary font-mono shrink-0">{countLeaves(node)}</span>
      </button>
      {isOpen && (node.children ?? []).map((c, i) => (
        <TreeNode key={c.code + ':' + depth + ':' + i} node={c} depth={depth + 1} color={color} forceOpen={forceOpen} />
      ))}
    </div>
  )
}

function filterTree(node: DrillTreeNode, needle: string): DrillTreeNode | null {
  const selfMatch = !needle || node.code.toLowerCase().includes(needle) || (node.label ?? '').toLowerCase().includes(needle)
  if (node.kind === 'leaf') return selfMatch ? node : null
  if (selfMatch) return node // group matches -> keep whole subtree
  const kids = (node.children ?? []).map((c) => filterTree(c, needle)).filter(Boolean) as DrillTreeNode[]
  return kids.length ? { ...node, children: kids } : null
}

export default function DrillDrawer({ data, onClose }: { data: DrillData; onClose: () => void }) {
  const meta = ENTITY_META[data.kind]
  const color = meta.color
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (data.tree) {
      const roots = data.tree.map((t) => filterTree(t, needle)).filter(Boolean) as DrillTreeNode[]
      return { tree: roots, groups: undefined, items: undefined }
    }
    const match = (it: DrillItem) => !needle || it.code.toLowerCase().includes(needle) || (it.label ?? '').toLowerCase().includes(needle) || (it.meta ?? '').toLowerCase().includes(needle)
    if (data.groups) return { tree: undefined, groups: data.groups.map((g) => ({ ...g, items: g.items.filter(match) })).filter((g) => g.items.length), items: undefined }
    return { tree: undefined, groups: undefined, items: (data.items ?? []).filter(match) }
  }, [data, needle])

  const shown = filtered.tree
    ? filtered.tree.reduce((n, t) => n + countLeaves(t), 0)
    : (filtered.groups ? filtered.groups.reduce((n, g) => n + g.items.length, 0) : filtered.items?.length) ?? 0

  return (
    <div className="absolute top-0 right-0 z-20 h-full w-[360px] max-w-[88vw] bg-white border-l border-border shadow-modal flex flex-col animate-slide-in-right">
      {/* header */}
      <div className="sticky top-0 px-3.5 py-3 border-b border-border" style={{ background: color + '0f' }}>
        <div className="flex items-start gap-2.5">
          <div style={{ backgroundColor: color + '22', color }} className="flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-bold font-mono shrink-0">
            {meta.abbr}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-semibold text-text-primary truncate">{data.title}</span>
              <span className="text-[11px] font-bold font-mono shrink-0" style={{ color }}>{data.count}</span>
            </div>
            {data.subtitle && <div className="text-[10px] text-text-tertiary truncate mt-0.5">{data.subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="h-8 w-8 -mr-1 rounded inline-flex items-center justify-center text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        {data.count > 12 && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={data.tree ? 'Filter groups & profit centers…' : 'Filter…'}
            className="mt-2.5 w-full h-8 px-2.5 rounded-lg border border-border bg-surface-input text-[11px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        )}
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto">
        {filtered.tree ? (
          filtered.tree.map((t, i) => <TreeNode key={t.code + i} node={t} depth={0} color={color} forceOpen={needle.length > 0} />)
        ) : filtered.groups ? (
          filtered.groups.map((g) => (
            <div key={g.name}>
              <div className="sticky top-0 z-10 px-3 py-1.5 bg-white border-b border-border flex items-baseline gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary font-mono">{g.name}</span>
                {g.caption && <span className="text-[10px] text-text-tertiary truncate">{g.caption}</span>}
                <span className="ml-auto text-[10px] text-text-tertiary font-mono">{g.items.length}</span>
              </div>
              {g.items.map((it, i) => <ItemRow key={it.code + i} it={it} color={color} />)}
            </div>
          ))
        ) : (
          (filtered.items ?? []).map((it, i) => <ItemRow key={it.code + i} it={it} color={color} />)
        )}
        {shown === 0 && <div className="px-3 py-6 text-center text-[11px] text-text-tertiary">No matches.</div>}
      </div>

      <div className="px-3 py-2 border-t border-border text-[10px] text-text-tertiary font-mono">
        {data.tree ? `${shown} profit centers in hierarchy` : `showing ${shown} of ${data.count}`}
      </div>
    </div>
  )
}
