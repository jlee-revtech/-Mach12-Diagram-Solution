'use client'

import type { ProcessCollabUser } from '@/lib/collab/useProcessCollab'

// Compact presence avatars for collaborators currently in the model.
export default function ProcessPresence({ users, myClientId }: { users: ProcessCollabUser[]; myClientId: number | null }) {
  const others = users.filter(u => u.clientId !== myClientId)
  if (others.length === 0) return null
  const initial = (n: string) => (n.trim()[0] || '?').toUpperCase()
  return (
    <div className="flex items-center -space-x-1.5">
      {others.slice(0, 5).map(u => (
        <div
          key={u.clientId}
          title={u.name + (u.editingNodeId ? ' · editing' : '')}
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[var(--m12-bg)]"
          style={{ background: u.color }}
        >
          {initial(u.name)}
        </div>
      ))}
      {others.length > 5 && (
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-[var(--m12-text-secondary)] bg-[var(--m12-bg-card)] ring-2 ring-[var(--m12-bg)]">
          +{others.length - 5}
        </div>
      )}
    </div>
  )
}
