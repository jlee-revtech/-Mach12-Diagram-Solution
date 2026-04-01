'use client'

import { memo, useState, useCallback } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import type { SystemData, SystemType } from '@/lib/diagram/types'
import { useDiagramStore } from '@/lib/diagram/store'

const SYSTEM_ICONS: Record<SystemType, string> = {
  erp: 'E',
  crm: 'C',
  plm: 'P',
  scm: 'S',
  middleware: 'M',
  database: 'D',
  data_warehouse: 'DW',
  analytics: 'A',
  mes: 'ME',
  clm: 'CL',
  cloud: 'CD',
  legacy: 'L',
  ppm: 'PP',
  ims: 'IM',
  siop: 'SI',
  mps: 'MS',
  custom: '?',
}

const SYSTEM_COLORS: Record<SystemType, string> = {
  erp: '#2563EB',
  crm: '#06B6D4',
  plm: '#8B5CF6',
  scm: '#10B981',
  middleware: '#F97316',
  database: '#EF4444',
  data_warehouse: '#EAB308',
  analytics: '#EC4899',
  mes: '#D946EF',
  clm: '#F43F5E',
  cloud: '#14B8A6',
  legacy: '#64748B',
  ppm: '#0EA5E9',
  ims: '#6366F1',
  siop: '#84CC16',
  mps: '#22D3EE',
  custom: '#A855F7',
}

function SystemNodeComponent({ id, data, selected }: NodeProps & { data: SystemData }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(data.label)
  const updateSystemLabel = useDiagramStore((s) => s.updateSystemLabel)
  const setSelectedNode = useDiagramStore((s) => s.setSelectedNode)
  const setSidebarTab = useDiagramStore((s) => s.setSidebarTab)
  const connectMode = useDiagramStore((s) => s.connectMode)
  const handleConnectModeClick = useDiagramStore((s) => s.handleConnectModeClick)
  const pendingConnectionSource = useDiagramStore((s) => s.pendingConnectionSource)
  const spotlightNodeId = useDiagramStore((s) => s.spotlightNodeId)
  const spotlightNodeIds = useDiagramStore((s) => s.spotlightNodeIds)

  const color = SYSTEM_COLORS[data.systemType]
  const icon = SYSTEM_ICONS[data.systemType]
  const isPendingSource = pendingConnectionSource === id
  const isDimmed = spotlightNodeId !== null && !spotlightNodeIds.has(id)
  const isSpotlit = spotlightNodeId !== null && spotlightNodeIds.has(id) && spotlightNodeId !== id

  const handleDoubleClick = useCallback(() => {
    setEditValue(data.label)
    setIsEditing(true)
  }, [data.label])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    if (editValue.trim()) {
      updateSystemLabel(id, editValue.trim())
    }
  }, [id, editValue, updateSystemLabel])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleBlur()
      } else if (e.key === 'Escape') {
        setIsEditing(false)
        setEditValue(data.label)
      }
    },
    [handleBlur, data.label]
  )

  const handleClick = useCallback(() => {
    if (connectMode) {
      handleConnectModeClick(id)
      return
    }
    setSelectedNode(id)
    setSidebarTab('properties')
  }, [id, connectMode, handleConnectModeClick, setSelectedNode, setSidebarTab])

  // Primary handles (one per side at midpoint) — visible on hover
  // Secondary handles — invisible but functional for drag connections
  const primaryHandle = `!border-2 transition-all duration-200 !rounded-full`
  const primaryVisible = `!w-3 !h-3 !bg-[#1F2C3F] !border-[#64748B] hover:!bg-[#2563EB] hover:!border-[#2563EB] hover:!w-4 hover:!h-4`
  const primarySelected = `!w-3.5 !h-3.5 !bg-[#06B6D4]/20 !border-[#06B6D4] hover:!bg-[#06B6D4] hover:!w-4 hover:!h-4`
  const secondaryHandle = `!border transition-all duration-200`
  const secondaryVisible = `!w-2 !h-2 !bg-[#1F2C3F] !border-[#374A5E] hover:!bg-[#2563EB] hover:!border-[#2563EB] hover:!w-3 hover:!h-3`
  const secondaryHidden = `!w-3 !h-3 !bg-transparent !border-transparent`

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        borderColor: isPendingSource
          ? '#2563EB'
          : isSpotlit
            ? '#06B6D4'
            : selected
              ? '#06B6D4'
              : connectMode
                ? color + '80'
                : isDimmed
                  ? '#374A5E30'
                  : color + '60',
        boxShadow: isPendingSource
          ? `0 0 24px #2563EB50, 0 0 48px #2563EB20`
          : isSpotlit
            ? `0 0 16px ${color}50, 0 0 32px ${color}20`
            : selected
              ? `0 0 20px ${color}40, 0 0 40px ${color}15`
              : `0 2px 12px rgba(0,0,0,0.3)`,
        opacity: isDimmed ? 0.2 : 1,
        transition: 'opacity 0.3s, border-color 0.2s, box-shadow 0.2s',
      }}
      className={`group relative bg-[#1F2C3F] border-2 rounded-xl px-5 py-4 min-w-[180px] min-h-[60px] cursor-pointer transition-all duration-200 ${!selected ? 'hover:scale-[1.02]' : ''} ${connectMode ? 'hover:!border-[#2563EB] hover:shadow-[0_0_20px_rgba(37,99,235,0.3)]' : ''} ${isDimmed ? 'hover:!opacity-40' : ''}`}
    >
      {/* Resize handles — only visible when selected */}
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={60}
        lineClassName="!border-[#06B6D4]/30"
        handleClassName="!w-2.5 !h-2.5 !bg-[#06B6D4] !border-[#1F2C3F] !border-2 !rounded-sm"
      />

      {/* ── Primary handles: 1 per side at midpoint, visible on hover ── */}
      <Handle type="source" position={Position.Top} id="top-s2"
        className={`${primaryHandle} ${selected ? primarySelected : primaryVisible} ${!selected ? 'opacity-0 group-hover:opacity-100' : ''}`}
        style={{ left: '50%' }} />
      <Handle type="source" position={Position.Bottom} id="bot-s2"
        className={`${primaryHandle} ${selected ? primarySelected : primaryVisible} ${!selected ? 'opacity-0 group-hover:opacity-100' : ''}`}
        style={{ left: '50%' }} />
      <Handle type="source" position={Position.Left} id="left-s2"
        className={`${primaryHandle} ${selected ? primarySelected : primaryVisible} ${!selected ? 'opacity-0 group-hover:opacity-100' : ''}`}
        style={{ top: '50%' }} />
      <Handle type="source" position={Position.Right} id="right-s2"
        className={`${primaryHandle} ${selected ? primarySelected : primaryVisible} ${!selected ? 'opacity-0 group-hover:opacity-100' : ''}`}
        style={{ top: '50%' }} />

      {/* ── Secondary handles: additional connection points ── */}
      {/* Top */}
      <Handle type="source" position={Position.Top} id="top-s1" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ left: '15%' }} />
      <Handle type="target" position={Position.Top} id="top-t1" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ left: '30%' }} />
      <Handle type="target" position={Position.Top} id="top-t2" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ left: '60%' }} />
      <Handle type="source" position={Position.Top} id="top-s3" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ left: '75%' }} />
      <Handle type="target" position={Position.Top} id="top-t3" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ left: '90%' }} />
      {/* Bottom */}
      <Handle type="source" position={Position.Bottom} id="bot-s1" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ left: '15%' }} />
      <Handle type="target" position={Position.Bottom} id="bot-t1" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ left: '30%' }} />
      <Handle type="target" position={Position.Bottom} id="bot-t2" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ left: '60%' }} />
      <Handle type="source" position={Position.Bottom} id="bot-s3" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ left: '75%' }} />
      <Handle type="target" position={Position.Bottom} id="bot-t3" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ left: '90%' }} />
      {/* Left */}
      <Handle type="source" position={Position.Left} id="left-s1" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ top: '15%' }} />
      <Handle type="target" position={Position.Left} id="left-t1" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ top: '35%' }} />
      <Handle type="target" position={Position.Left} id="left-t2" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ top: '75%' }} />
      <Handle type="source" position={Position.Left} id="left-s3" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ top: '90%' }} />
      {/* Right */}
      <Handle type="source" position={Position.Right} id="right-s1" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ top: '15%' }} />
      <Handle type="target" position={Position.Right} id="right-t1" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ top: '35%' }} />
      <Handle type="target" position={Position.Right} id="right-t2" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ top: '75%' }} />
      <Handle type="source" position={Position.Right} id="right-s3" className={`${secondaryHandle} ${selected ? secondaryVisible : secondaryHidden}`} style={{ top: '90%' }} />

      {/* Icon badge */}
      <div className="flex items-center gap-3">
        <div
          style={{ backgroundColor: color + '20', color }}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-xs font-bold font-[family-name:var(--font-space-mono)] shrink-0"
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-b border-[#06B6D4] text-[#F8FAFC] text-sm font-semibold outline-none"
            />
          ) : (
            <div className="text-sm font-semibold text-[#F8FAFC]">
              {data.label}
            </div>
          )}
          {data.physicalSystem && (
            <div className="text-[11px] text-[#06B6D4]">
              {data.physicalSystem}
            </div>
          )}
          <div className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)]">
            {data.systemType}
          </div>
        </div>
      </div>

      {/* Modules list */}
      {data.modules && data.modules.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#374A5E]/30">
          <div className="flex flex-wrap gap-1">
            {data.modules.map((mod) => (
              <div
                key={mod.id}
                style={{ borderColor: color + '40', backgroundColor: color + '08' }}
                className="border rounded px-1.5 py-0.5"
              >
                <span style={{ color: color + 'CC' }} className="text-[9px] font-medium font-[family-name:var(--font-space-mono)]">
                  {mod.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(SystemNodeComponent)
