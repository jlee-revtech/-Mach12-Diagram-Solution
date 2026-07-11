import {
  BookOpen,
  Boxes,
  Database,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Library,
  Presentation,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * Navigation config for the Mach12 Studio shell (PPM design system 4.2).
 * Editor canvases (/diagram/[id], /process/[id], /capability-map/[id],
 * /workshops/[id]) and public/auth routes render without the shell; see
 * AppChrome.usesShell.
 */

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Also mark active for these route prefixes. */
  activePrefixes?: string[]
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Studio',
    items: [
      { label: 'Home', href: '/', icon: LayoutDashboard },
      { label: 'Workstreams', href: '/workstreams', icon: FolderKanban },
      { label: 'Workshops', href: '/workshops', icon: Presentation },
      { label: 'Deliverables', href: '/deliverables', icon: FileText },
      { label: 'Knowledge', href: '/knowledge', icon: BookOpen },
    ],
  },
  {
    label: 'Reference',
    items: [
      { label: 'Process Library', href: '/process/library', icon: Library },
      { label: 'Personas', href: '/process/personas', icon: Users },
      { label: 'SAP Model', href: '/data/sap-model', icon: Boxes },
      { label: 'Bedrock Catalog', href: '/data/bedrock', icon: Database },
    ],
  },
]

export function labelForRoute(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.href === pathname) return item.label
      if (item.href !== '/' && pathname.startsWith(item.href + '/'))
        return item.label
    }
  }
  return 'Studio'
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/'
  if (pathname === item.href || pathname.startsWith(item.href + '/'))
    return true
  return (item.activePrefixes ?? []).some((p) => pathname.startsWith(p))
}
