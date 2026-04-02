'use client'

import { memo, useState, useCallback } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import type { SystemGroupData } from '@/lib/diagram/types'
import { useDiagramStore } from '@/lib/diagram/store'

function GroupNodeComponent({ id, data, selected }: NodeProps & { data: SystemGroupData }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(data.label)
  const updateGroupLabel = useDiagramStore((s) => s.updateGroupLabel)
  const setSelectedGroup = useDiagramStore((s) => s.setSelectedGroup)
  const setSidebarTab = useDiagramStore((s) => s.setSidebarTab)
  const selectedGroupId = useDiagramStore((s) => s.selectedGroupId)
  const connectMode = useDiagramStore((s) => s.connectMode)
  const handleConnectModeClick = useDiagramStore((s) => s.handleConnectModeClick)

  const color = data.color || 'var(--m12-border)'
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
    if (connectMode) {
      handleConnectModeClick(id)
      return
    }
    setSelectedGroup(id)
    setSidebarTab('properties')
  }, [id, connectMode, handleConnectModeClick, setSelectedGroup, setSidebarTab])

  const handleClass = "!border-2 !rounded-full !w-3 !h-3 !bg-[var(--m12-handle-bg)] !border-[var(--m12-handle-border)] hover:!bg-[#F97316] hover:!border-[#F97316] hover:!w-4 hover:!h-4 transition-all duration-200"

  return (
    <>
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
              handleClassName="!w-2.5 !h-2.5 !bg-[#06B6D4] !border-[var(--m12-bg-card)] !border-2 !rounded-sm"
            />
          </div>
        )}

        {/* Border hit areas — clickable strips along the edges for selection + dragging */}
        <div onClick={handleBorderClick} style={{ pointerEvents: 'auto' }} className="absolute -top-2 left-0 right-0 h-5 cursor-pointer" />
        <div onClick={handleBorderClick} style={{ pointerEvents: 'auto' }} className="absolute -bottom-2 left-0 right-0 h-5 cursor-pointer" />
        <div onClick={handleBorderClick} style={{ pointerEvents: 'auto' }} className="absolute top-0 -left-2 bottom-0 w-5 cursor-pointer" />
        <div onClick={handleBorderClick} style={{ pointerEvents: 'auto' }} className="absolute top-0 -right-2 bottom-0 w-5 cursor-pointer" />

        {/* Connection handles */}
        <div style={{ pointerEvents: 'auto' }} className={`${isSelected ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity`}>
          <Handle type="source" position={Position.Top} id="grp-top-s" className={handleClass} style={{ left: '50%', top: -6, pointerEvents: 'auto' }} />
          <Handle type="target" position={Position.Top} id="grp-top-t" className={handleClass} style={{ left: '40%', top: -6, pointerEvents: 'auto' }} />
          <Handle type="source" position={Position.Bottom} id="grp-bot-s" className={handleClass} style={{ left: '50%', bottom: -6, top: 'auto', pointerEvents: 'auto' }} />
          <Handle type="target" position={Position.Bottom} id="grp-bot-t" className={handleClass} style={{ left: '40%', bottom: -6, top: 'auto', pointerEvents: 'auto' }} />
          <Handle type="source" position={Position.Left} id="grp-left-s" className={handleClass} style={{ top: '50%', left: -6, pointerEvents: 'auto' }} />
          <Handle type="target" position={Position.Left} id="grp-left-t" className={handleClass} style={{ top: '40%', left: -6, pointerEvents: 'auto' }} />
          <Handle type="source" position={Position.Right} id="grp-right-s" className={handleClass} style={{ top: '50%', right: -6, left: 'auto', pointerEvents: 'auto' }} />
          <Handle type="target" position={Position.Right} id="grp-right-t" className={handleClass} style={{ top: '40%', right: -6, left: 'auto', pointerEvents: 'auto' }} />
        </div>

        {/* Group label — top-left badge */}
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
              className="bg-transparent border-b border-[#06B6D4] text-[var(--m12-text)] text-xs font-semibold outline-none min-w-[80px]"
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
