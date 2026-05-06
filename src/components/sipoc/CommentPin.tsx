'use client'

import { useSIPOCStore } from '@/lib/sipoc/store'
import type { SipocRegion } from '@/lib/sipoc/types'

const REGION_COLOR: Record<SipocRegion, string> = {
  S: '#F97316',
  I: '#EAB308',
  P: '#2563EB',
  O: '#10B981',
  C: '#8B5CF6',
}

interface Props {
  capabilityId: string
  region: SipocRegion
  itemId?: string | null
  size?: 'sm' | 'md'
  label?: string
  className?: string
}

export default function CommentPin({ capabilityId, region, itemId = null, size = 'sm', label, className = '' }: Props) {
  const comments = useSIPOCStore(s => s.comments)
  const setAnchor = useSIPOCStore(s => s.setCommentsAnchor)

  const count = comments.filter(c =>
    c.capability_id === capabilityId &&
    c.region === region &&
    (c.item_id || null) === (itemId || null)
  ).length

  const dim = size === 'md' ? 18 : 14
  const color = REGION_COLOR[region]

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setAnchor({ capability_id: capabilityId, region, item_id: itemId }) }}
      title={count > 0 ? `${count} comment${count === 1 ? '' : 's'}` : 'Add comment'}
      className={`inline-flex items-center gap-0.5 rounded transition-colors ${count > 0 ? 'opacity-100' : 'opacity-50 hover:opacity-100'} ${className}`}
      style={{ color }}
    >
      <svg width={dim} height={dim} viewBox="0 0 16 16" fill="none">
        <path
          d="M3 3h10a1 1 0 011 1v6a1 1 0 01-1 1H8.5L5.5 13.5V11H3a1 1 0 01-1-1V4a1 1 0 011-1z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          fill={count > 0 ? 'currentColor' : 'none'}
          fillOpacity={count > 0 ? 0.18 : 0}
        />
      </svg>
      {(count > 0 || label) && (
        <span className="text-[9px] font-[family-name:var(--font-space-mono)] font-bold leading-none">
          {label}{count > 0 ? (label ? ` ${count}` : count) : ''}
        </span>
      )}
    </button>
  )
}
