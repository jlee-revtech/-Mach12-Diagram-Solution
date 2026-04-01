'use client'

import { memo, useState, useCallback } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import type { SystemGroupData } from '@/lib/diagram/types'
import { useDiagramStore } from '@/lib/diagram/store'

function GroupNodeComponent({ id, data, selected }: NodeProps & { data: SystemGroupData }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(data.label)
  const updateGroupLabel = useDiagramStore((s) => s.updateGroupLabel)
  const setSelectedGroup = useDiagramStore((s) => s.setSelectedGroup)
  const setSidebarTab = useDiagramStore((s) => s.setSidebarTab)
  const selectedGroupId = useDiagramStore((s) => s.selectedGroupId)

  const color = data.color || '#374A5E'
  const isSelected = selectedGroupId === id

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(data.label)
    setIsEditing(true)
  }, [data.label])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    if (editValue.trim()) {
      updateGroupLabel(id, editValue.trim())
    }
  }, [id, editValue, updateGroupLabel])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleBlur()
      else if (e.key === 'Escape') {
        setIsEditing(false)
        setEditValue(data.label)
      }
    },
    [handleBlur, data.label]
  )

  const handleBorderClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedGroup(id)
    setSidebarTab('properties')
  }, [id, setSelectedGroup, setSidebarTab])

  return (
    <>
      {/*
        The main body has pointerEvents:none so clicks pass through to
        system nodes and edge labels underneath. Only border hit areas
        and the label badge are interactive (pointerEvents:auto).
      */}
      <div
        style={{
          borderColor: isSelected ? '#06B6D4' : color + '60',
          backgroundColor: color + '08',
          width: '100%',
          height: '100%',
          minWidth: 300,
          minHeight: 200,
          pointerEvents: 'none',
        }}
        className="border-2 border-dashed rounded-2xl relative"
      >
        {/* Resize handles — only when group is selected */}
        {isSelected && (
          <div style={{ pointerEvents: 'auto' }}>
            <NodeResizer
              isVisible
              minWidth={300}
              minHeight={200}
              lineClassName="!border-[#06B6D4]/30"
              handleClassName="!w-2.5 !h-2.5 !bg-[#06B6D4] !border-[#1F2C3F] !border-2 !rounded-sm"
            />
          </div>
        )}

        {/* Border hit areas — clickable strips along the edges for selection + dragging */}
        {/* Top */}
        <div
          onClick={handleBorderClick}
          style={{ pointerEvents: 'auto' }}
          className="absolute -top-2 left-0 right-0 h-5 cursor-pointer"
        />
        {/* Bottom */}
        <div
          onClick={handleBorderClick}
          style={{ pointerEvents: 'auto' }}
          className="absolute -bottom-2 left-0 right-0 h-5 cursor-pointer"
        />
        {/* Left */}
        <div
          onClick={handleBorderClick}
          style={{ pointerEvents: 'auto' }}
          className="absolute top-0 -left-2 bottom-0 w-5 cursor-pointer"
        />
        {/* Right */}
        <div
          onClick={handleBorderClick}
          style={{ pointerEvents: 'auto' }}
          className="absolute top-0 -right-2 bottom-0 w-5 cursor-pointer"
        />

        {/* Group label — top-left badge (always clickable) */}
        <div
          onClick={handleBorderClick}
          onDoubleClick={handleDoubleClick}
          style={{ backgroundColor: color + '20', borderColor: color + '40', pointerEvents: 'auto' }}
          className="absolute -top-3 left-4 border rounded-md px-3 py-0.5 backdrop-blur-sm cursor-pointer z-10"
        >
          {isEditing ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent border-b border-[#06B6D4] text-[#F8FAFC] text-xs font-semibold outline-none min-w-[80px]"
              style={{ pointerEvents: 'auto' }}
            />
          ) : (
            <span style={{ color }} className="text-xs font-bold uppercase tracking-wider font-[family-name:var(--font-space-mono)]">
              {data.label}
            </span>
          )}
        </div>
      </div>
    </>
  )
}

export default memo(GroupNodeComponent)
