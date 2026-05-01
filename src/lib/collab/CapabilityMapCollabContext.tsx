'use client'

import { createContext, useContext, useMemo } from 'react'
import type { CollabUser } from './useCapabilityMapCollab'

interface CapabilityMapCollabContextValue {
  users: CollabUser[]
  myClientId: number | null
  /** Returns the OTHER user currently editing this capability, or null if free / locked by me. */
  lockHolder: (capabilityId: string) => CollabUser | null
}

const Ctx = createContext<CapabilityMapCollabContextValue | null>(null)

export function CapabilityMapCollabProvider({
  users,
  myClientId,
  children,
}: {
  users: CollabUser[]
  myClientId: number | null
  children: React.ReactNode
}) {
  const value = useMemo<CapabilityMapCollabContextValue>(() => ({
    users,
    myClientId,
    lockHolder: (capabilityId: string) =>
      users.find(u => u.editingCapabilityId === capabilityId && u.clientId !== myClientId) ?? null,
  }), [users, myClientId])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCapabilityMapCollabContext() {
  return useContext(Ctx)
}

/** Convenience: returns the other user editing this capability, or null. Safe when no provider. */
export function useLockHolder(capabilityId: string | null | undefined): CollabUser | null {
  const ctx = useContext(Ctx)
  if (!ctx || !capabilityId) return null
  return ctx.lockHolder(capabilityId)
}
