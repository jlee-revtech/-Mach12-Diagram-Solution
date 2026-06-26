'use client'

import { useMemo, useState } from 'react'
import type { DrillData, DrillItem, DrillTreeNode } from '@/lib/sap-model/types'
import { ENTITY_META } from '@/lib/sap-model/entityMeta'

function ItemRow({ it, color }: { it: DrillItem; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-t border-[var(--m12-border)]/20 hover:bg-[var(--m12-bg)]/40">
      <span className="text-[11px] font-bold font-[family-name:var(--font-space-mono)] shrink-0" style={{ color }}>{it.code}</span>
      {it.label && <span className="text-[11px] text-[var(--m12-text-secondary)] truncate">{it.label}</span>}
      {it.meta && <span className="ml-auto text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] shrink-0">{it.meta}</span>}
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
      <div className="flex items-center gap-2 py-1 border-t border-[var(--m12-border)]/15 hover:bg-[var(--m12-bg)]/40" style={{ paddingLeft: pad + 16, paddingRight: 12 }}>
        <span className="text-[11px] font-bold font-[family-name:var(--font-space-mono)] shrink-0" style={{ color }}>{node.code}</span>
        {node.label && <span className="text-[11px] text-[var(--m12-text-secondary)] truncate">{node.label}</span>}
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 w-full text-left py-1.5 border-t border-[var(--m12-border)]/20 hover:bg-[var(--m12-bg)]/50"
        style={{ paddingLeft: pad, paddingRight: 12 }}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className={`shrink-0 text-[var(--m12-text-muted)] transition-transform ${isOpen ? 'rotate-90' : ''}`}>
          <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[11px] font-semibold text-[var(--m12-text)] truncate">{node.label || node.code}</span>
        <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] truncate">{node.code}</span>
        <span className="ml-auto text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] shrink-0">{countLeaves(node)}</span>
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
    <div className="absolute top-0 right-0 z-20 h-full w-[360px] max-w-[88vw] bg-[var(--m12-bg-card)] border-l border-[var(--m12-border)]/60 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* header */}
      <div className="px-3.5 py-3 border-b border-[var(--m12-border)]/40" style={{ background: color + '0f' }}>
        <div className="flex items-start gap-2.5">
          <div style={{ backgroundColor: color + '22', color }} className="flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-bold font-[family-name:var(--font-space-mono)] shrink-0">
            {meta.abbr}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--m12-text)] truncate">{data.title}</span>
              <span className="text-[11px] font-bold font-[family-name:var(--font-space-mono)] shrink-0" style={{ color }}>{data.count}</span>
            </div>
            {data.subtitle && <div className="text-[10px] text-[var(--m12-text-muted)] truncate mt-0.5">{data.subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} title="Close" className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] shrink-0 -mr-1">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        {data.count > 12 && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={data.tree ? 'Filter groups & profit centers…' : 'Filter…'}
            className="mt-2.5 w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-md px-2.5 py-1.5 text-[11px] text-[var(--m12-text)] placeholder:text-[var(--m12-text-muted)] outline-none focus:border-[var(--m12-border)]"
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
              <div className="sticky top-0 z-10 px-3 py-1.5 bg-[var(--m12-bg-card)] border-b border-[var(--m12-border)]/40 flex items-baseline gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--m12-text-secondary)] font-[family-name:var(--font-space-mono)]">{g.name}</span>
                {g.caption && <span className="text-[10px] text-[var(--m12-text-muted)] truncate">{g.caption}</span>}
                <span className="ml-auto text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">{g.items.length}</span>
              </div>
              {g.items.map((it, i) => <ItemRow key={it.code + i} it={it} color={color} />)}
            </div>
          ))
        ) : (
          (filtered.items ?? []).map((it, i) => <ItemRow key={it.code + i} it={it} color={color} />)
        )}
        {shown === 0 && <div className="px-3 py-6 text-center text-[11px] text-[var(--m12-text-muted)]">No matches.</div>}
      </div>

      <div className="px-3 py-2 border-t border-[var(--m12-border)]/40 text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
        {data.tree ? `${shown} profit centers in hierarchy` : `showing ${shown} of ${data.count}`}
      </div>
    </div>
  )
}
