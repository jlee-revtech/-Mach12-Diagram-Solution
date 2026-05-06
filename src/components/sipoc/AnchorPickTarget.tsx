'use client'

import { useState } from 'react'
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
  children: React.ReactNode
  className?: string
}

// Wraps any region of the SIPOC canvas. Two responsibilities:
//   1. Marks the DOM node with data-anchor-key so the rail can scroll to it.
//   2. When in pickingAnchor mode, shows a hover outline + traps the click
//      to set the pending new-comment anchor (without bubbling to other handlers).
//   3. When the rail is hovering / has highlighted this anchor, pulses an outline.
export default function AnchorPickTarget({ capabilityId, region, itemId = null, children, className = '' }: Props) {
  const picking = useSIPOCStore(s => s.pickingAnchor)
  const setPicking = useSIPOCStore(s => s.setPickingAnchor)
  const setPendingNewAnchor = useSIPOCStore(s => s.setPendingNewAnchor)
  const highlightedKey = useSIPOCStore(s => s.highlightedAnchorKey)

  const myKey = anchorKey({ capability_id: capabilityId, region, item_id: itemId })
  const highlighted = highlightedKey === myKey
  const color = REGION_COLOR[region]
  const [hovered, setHovered] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    if (!picking) return
    e.stopPropagation()
    e.preventDefault()
    setPendingNewAnchor({ capability_id: capabilityId, region, item_id: itemId })
    setPicking(false)
    setHovered(false)
  }

  let boxShadow: string | undefined
  if (picking) {
    boxShadow = hovered
      ? `inset 0 0 0 2px ${color}`
      : `inset 0 0 0 1px ${color}55`
  } else if (highlighted) {
    boxShadow = `0 0 0 2px ${color}, 0 0 22px ${color}55`
  }

  return (
    <div
      data-anchor-key={myKey}
      onClickCapture={picking ? handleClick : undefined}
      onMouseEnter={picking ? () => setHovered(true) : undefined}
      onMouseLeave={picking ? () => setHovered(false) : undefined}
      className={`relative ${className} ${picking ? 'cursor-crosshair' : ''}`}
      style={boxShadow ? { boxShadow, transition: 'box-shadow 150ms ease' } : undefined}
    >
      {children}
    </div>
  )
}
