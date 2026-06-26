'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { OrgNodeData } from '@/lib/sap-model/types'
import { ENTITY_META } from '@/lib/sap-model/entityMeta'

const handleCls = '!w-1.5 !h-1.5 !bg-[var(--m12-border)] !border-0 opacity-0'

function OrgNodeComponent({ data, selected }: NodeProps & { data: OrgNodeData }) {
  const meta = ENTITY_META[data.kind]
  const color = meta.color

  return (
    <div
      style={{
        backgroundColor: 'var(--m12-node-bg)',
        borderColor: selected ? color : color + '55',
        boxShadow: selected ? `0 0 0 1px ${color}, 0 0 18px ${color}33` : 'var(--m12-node-shadow)',
      }}
      className="relative rounded-xl border w-[220px] px-3.5 py-2.5 transition-all"
    >
      <Handle id="in" type="target" position={Position.Top} className={handleCls} />
      <Handle id="lin" type="target" position={Position.Left} className={handleCls} />
      <Handle id="out" type="source" position={Position.Bottom} className={handleCls} />
      <Handle id="rout" type="source" position={Position.Right} className={handleCls} />

      <div className="flex items-start gap-2.5">
        <div
          style={{ backgroundColor: color + '22', color }}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-bold font-[family-name:var(--font-space-mono)] shrink-0"
        >
          {meta.abbr}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-[var(--m12-text)] font-[family-name:var(--font-space-mono)] truncate">
              {data.code}
            </span>
            {data.badge && (
              <span
                style={{ borderColor: color + '55', color }}
                className="ml-auto shrink-0 border rounded px-1 py-px text-[8px] font-medium font-[family-name:var(--font-space-mono)] uppercase tracking-wide"
              >
                {data.badge}
              </span>
            )}
          </div>
          <div className="text-[11px] font-medium text-[var(--m12-text-secondary)] leading-tight truncate mt-0.5">
            {data.title}
          </div>
          <div className="text-[8px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] mt-0.5">
            {meta.label}
          </div>
        </div>
      </div>

      {data.subtitle && (
        <div className="mt-1.5 text-[10px] text-[var(--m12-text-muted)] truncate">{data.subtitle}</div>
      )}
      {data.meta && data.meta.length > 0 && (
        <div className="mt-1 pt-1 border-t border-[var(--m12-border)]/30 space-y-0.5">
          {data.meta.map((line, i) => (
            <div key={i} className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] truncate">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(OrgNodeComponent)
