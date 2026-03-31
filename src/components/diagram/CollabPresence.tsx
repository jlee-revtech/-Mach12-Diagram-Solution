'use client'

interface CollabUser {
  id: string
  name: string
  color: string
  cursor?: { x: number; y: number }
}

// ─── Presence Badge (who's here) ────────────────────────
export function PresenceBadge({ users, connected }: { users: CollabUser[]; connected: boolean }) {
  if (!connected && users.length === 0) return null

  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-[#1F2C3F]/90 backdrop-blur-sm border border-[#374A5E]/60 rounded-lg px-3 py-1.5">
      {/* Connection indicator */}
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />

      {users.length === 0 ? (
        <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-space-mono)]">
          {connected ? 'Connected' : 'Offline'}
        </span>
      ) : (
        <div className="flex items-center gap-1">
          {users.slice(0, 5).map((u) => (
            <div
              key={u.id}
              title={u.name}
              style={{ backgroundColor: u.color }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
            >
              {u.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {users.length > 5 && (
            <span className="text-[10px] text-[#64748B] ml-1">
              +{users.length - 5}
            </span>
          )}
          <span className="text-[10px] text-[#64748B] font-[family-name:var(--font-space-mono)] ml-1">
            {users.length} collaborator{users.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Remote Cursors Overlay ─────────────────────────────
export function RemoteCursors({ users }: { users: CollabUser[] }) {
  return (
    <>
      {users
        .filter((u) => u.cursor)
        .map((u) => (
          <div
            key={u.id}
            className="pointer-events-none absolute z-50 transition-all duration-100"
            style={{
              left: u.cursor!.x,
              top: u.cursor!.y,
              transform: 'translate(-2px, -2px)',
            }}
          >
            {/* Cursor arrow */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path
                d="M1 1L6 18L8.5 10.5L15 8L1 1Z"
                fill={u.color}
                stroke="#151E2E"
                strokeWidth="1"
              />
            </svg>
            {/* Name label */}
            <div
              style={{ backgroundColor: u.color }}
              className="absolute left-4 top-3 px-1.5 py-0.5 rounded text-[9px] font-medium text-white whitespace-nowrap shadow-lg"
            >
              {u.name}
            </div>
          </div>
        ))}
    </>
  )
}
