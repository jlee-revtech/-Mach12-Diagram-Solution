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

  const color = data.color || '#374A5E'

  const handleDoubleClick = useCallback(() => {
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

  const handleClick = useCallback(() => {
    setSelectedGroup(id)
    setSidebarTab('properties')
  }, [id, setSelectedGroup, setSidebarTab])

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        borderColor: selected ? '#06B6D4' : color + '60',
        backgroundColor: color + '08',
        width: '100%',
        height: '100%',
        minWidth: 300,
        minHeight: 200,
      }}
      className="border-2 border-dashed rounded-2xl relative"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={300}
        minHeight={200}
        lineClassName="!border-[#06B6D4]/30"
        handleClassName="!w-2.5 !h-2.5 !bg-[#06B6D4] !border-[#1F2C3F] !border-2 !rounded-sm"
      />

      {/* Group label — top-left badge */}
      <div
        style={{ backgroundColor: color + '20', borderColor: color + '40' }}
        className="absolute -top-3 left-4 border rounded-md px-3 py-0.5 backdrop-blur-sm"
      >
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="bg-transparent border-b border-[#06B6D4] text-[#F8FAFC] text-xs font-semibold outline-none min-w-[80px]"
          />
        ) : (
          <span style={{ color }} className="text-xs font-bold uppercase tracking-wider font-[family-name:var(--font-space-mono)]">
            {data.label}
          </span>
        )}
      </div>
    </div>
  )
}

export default memo(GroupNodeComponent)
