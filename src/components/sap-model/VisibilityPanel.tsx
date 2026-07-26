'use client'

import { useMemo, useState } from 'react'
import { Eye, EyeOff, RotateCcw, X } from 'lucide-react'
import type { InstanceTreeNode } from '@/lib/sap-model/buildModelDiagram'
import { ENTITY_META } from '@/lib/sap-model/entityMeta'
import type { OrgEntityKind } from '@/lib/sap-model/types'

type Row = { id: string; depth: number; kind: OrgEntityKind; code: string; title: string }

function flatten(tree: InstanceTreeNode): Row[] {
  const rows: Row[] = []
  // Skip the controlling-area root — hiding the whole model is never useful.
  ;(function walk(n: InstanceTreeNode, depth: number) {
    rows.push({ id: n.id, depth, kind: n.data.kind, code: n.data.code, title: n.data.title })
    n.children.forEach((c) => walk(c, depth + 1))
  })(tree, -1)
  return rows.slice(1)
}

export default function VisibilityPanel({
  tree, hidden, onToggle, onShowAll,
}: {
  tree: InstanceTreeNode
  hidden: ReadonlySet<string>
  onToggle: (id: string) => void
  onShowAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const rows = useMemo(() => flatten(tree), [tree])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Show or hide org elements"
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium shadow-card backdrop-blur-sm transition-colors ${
          open || hidden.size
            ? 'bg-brand-50 border-brand-200 text-brand-600'
            : 'bg-white/85 border-border text-text-secondary hover:text-text-primary'
        }`}
      >
        {hidden.size ? <EyeOff size={13} /> : <Eye size={13} />}
        Show/Hide
        {hidden.size > 0 && (
          <span className="rounded-full bg-brand-600 text-white px-1.5 py-px text-[9px] font-bold">{hidden.size}</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 z-20 w-[290px] max-h-[56vh] flex flex-col bg-white border border-border rounded-lg shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-muted/60">
            <span className="text-[11px] font-semibold text-text-primary flex-1">Org elements</span>
            {hidden.size > 0 && (
              <button
                type="button"
                onClick={onShowAll}
                className="flex items-center gap-1 text-[10px] font-medium text-brand-600 hover:text-brand-700"
              >
                <RotateCcw size={11} /> Show all
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="text-text-tertiary hover:text-text-primary">
              <X size={13} />
            </button>
          </div>
          <div className="px-3 py-1.5 text-[10px] text-text-tertiary border-b border-border">
            Hiding an element also hides everything beneath it.
          </div>
          <div className="overflow-y-auto py-1">
            {rows.map((r) => {
              const isHidden = hidden.has(r.id)
              return (
                <label
                  key={r.id}
                  className={`flex items-center gap-2 pr-3 py-1 cursor-pointer hover:bg-surface-muted ${isHidden ? 'opacity-45' : ''}`}
                  style={{ paddingLeft: 12 + r.depth * 16 }}
                >
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    onChange={() => onToggle(r.id)}
                    className="w-3 h-3 accent-brand-600 shrink-0"
                  />
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: ENTITY_META[r.kind].color }} />
                  <span className="text-[10px] font-mono font-semibold text-text-primary shrink-0">{r.code}</span>
                  <span className="text-[10px] text-text-secondary truncate">{r.title}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
