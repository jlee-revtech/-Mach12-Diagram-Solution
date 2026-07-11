'use client'

import { MessageSquare, Check } from 'lucide-react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import { anchorKey } from '@/lib/sipoc/types'
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
  className?: string
}

// Renders ONLY when there's at least one comment for this anchor.
// Click → opens the rail and expands that thread.
export default function ArtifactCommentBadge({ capabilityId, region, itemId = null, className = '' }: Props) {
  const comments = useSIPOCStore(s => s.comments)
  const setRailOpen = useSIPOCStore(s => s.setCommentsRailOpen)
  const setSelectedThreadKey = useSIPOCStore(s => s.setSelectedThreadKey)
  const setHighlightedAnchorKey = useSIPOCStore(s => s.setHighlightedAnchorKey)

  const matching = comments.filter(c =>
    c.capability_id === capabilityId &&
    c.region === region &&
    (c.item_id || null) === (itemId || null)
  )
  if (matching.length === 0) return null

  const sorted = [...matching].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const latest = sorted[sorted.length - 1]
  const resolved = !!latest.resolved_at
  const color = REGION_COLOR[region]
  const key = anchorKey({ capability_id: capabilityId, region, item_id: itemId })

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setRailOpen(true)
        setSelectedThreadKey(key)
        setHighlightedAnchorKey(key)
        setTimeout(() => setHighlightedAnchorKey(null), 2200)
      }}
      title={`${matching.length} comment${matching.length === 1 ? '' : 's'}${resolved ? ' (resolved)' : ''} · click to open thread`}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono font-bold transition-transform hover:scale-110 ${className}`}
      style={{
        backgroundColor: resolved ? 'transparent' : color,
        color: resolved ? color : '#fff',
        border: resolved ? `1px solid ${color}80` : 'none',
        boxShadow: resolved ? 'none' : `0 1px 4px ${color}40`,
      }}
    >
      <MessageSquare size={9} className="shrink-0" />
      <span>{matching.length}</span>
      {resolved && <Check size={8} className="shrink-0" />}
    </button>
  )
}
