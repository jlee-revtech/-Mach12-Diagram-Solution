'use client'

import { usePathname } from 'next/navigation'

import { cn } from '@/lib/cn'
import { useStudioStore } from '@/lib/studio-store'
import { StudioSidebar } from './StudioSidebar'
import { StudioHeader } from './StudioHeader'

/**
 * AppChrome per PPM design system section 4.1. Wraps shell routes (home,
 * lists, libraries) in the fixed Sidebar + Header + scrolling <main> grid.
 *
 * Full-canvas editors and public/auth routes render bare: the diagram,
 * BPMN, capability-map, and workshop editors own their entire viewport,
 * and /share/* must stay chrome-free for external viewers.
 */

function usesShell(pathname: string): boolean {
  if (pathname === '/') return true

  const barePrefixes = [
    '/auth',
    '/setup',
    '/invite',
    '/share',
    '/diagram',
    '/capability-map',
  ]
  if (barePrefixes.some((p) => pathname === p || pathname.startsWith(p + '/')))
    return false

  // Workshops: list page is shell, the workshop editor and present mode are bare.
  if (pathname === '/workshops') return true
  if (pathname.startsWith('/workshops/')) return false

  // Process: library and personas are shell reference pages; /process/[id]
  // is the full-canvas process editor.
  if (
    pathname === '/process/library' ||
    pathname.startsWith('/process/library/') ||
    pathname === '/process/personas' ||
    pathname.startsWith('/process/personas/')
  )
    return true
  if (pathname.startsWith('/process')) return false

  const shellPrefixes = ['/workstreams', '/workshops', '/deliverables', '/knowledge', '/data']
  return shellPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  const sidebarCollapsed = useStudioStore((s) => s.sidebarCollapsed)

  if (!usesShell(pathname)) return <>{children}</>

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted">
      <StudioSidebar />
      <div
        data-collapsed={sidebarCollapsed ? 'true' : 'false'}
        className={cn(
          'flex flex-1 flex-col min-w-0 transition-all duration-300',
          'data-[collapsed=true]:ml-14 data-[collapsed=false]:ml-52'
        )}
      >
        <StudioHeader />
        <main className="flex-1 overflow-auto p-6" role="main">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  )
}
