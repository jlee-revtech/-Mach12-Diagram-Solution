'use client'

import type { CollabUser } from '@/lib/collab/useCapabilityMapCollab'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function CollabPresence({
  users,
  myClientId,
  connected,
}: {
  users: CollabUser[]
  myClientId: number | null
  connected: boolean
}) {
  const others = users.filter(u => u.clientId !== myClientId)
  if (!connected && others.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      {others.length > 0 && (
        <div className="flex -space-x-1.5">
          {others.slice(0, 4).map(u => (
            <div
              key={u.clientId}
              title={u.editingCapabilityId ? `${u.name} (editing)` : u.name}
              className="w-6 h-6 rounded-full border-2 border-[var(--m12-bg-card)] flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
              style={{ backgroundColor: u.color }}
            >
              {initials(u.name)}
            </div>
          ))}
          {others.length > 4 && (
            <div className="w-6 h-6 rounded-full border-2 border-[var(--m12-bg-card)] bg-[var(--m12-bg)] flex items-center justify-center text-[9px] font-bold text-[var(--m12-text-muted)] shadow-sm">
              +{others.length - 4}
            </div>
          )}
        </div>
      )}
      <div
        title={connected ? 'Live' : 'Connecting...'}
        className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#10B981]' : 'bg-[var(--m12-text-faint)]'}`}
      />
    </div>
  )
}
