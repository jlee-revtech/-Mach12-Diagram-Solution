'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Shell UI state for the Mach12 Studio chrome (sidebar collapse).
 * Persisted so the workspace remembers the analyst's layout preference.
 */
interface StudioState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'm12-studio-shell' }
  )
)
