import {
  BookOpen,
  Boxes,
  Database,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Library,
  Presentation,
  Shield,
  ShieldCheck,
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
      { label: 'Security Roles', href: '/process/security', icon: Shield },
      { label: 'Security Design', href: '/process/security/design', icon: ShieldCheck },
      { label: 'SAP Model', href: '/data/sap-model', icon: Boxes },
      { label: 'Bedrock Catalog', href: '/data/bedrock', icon: Database },
    ],
  },
]

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items)

/** Does another nav item claim this route more specifically? Nested entries
 *  (e.g. /process/security/design under /process/security) must win, or the
 *  parent would both own the header label and light up in the sidebar. */
function hasMoreSpecificItem(item: NavItem, pathname: string): boolean {
  return ALL_NAV_ITEMS.some(
    (other) =>
      other.href !== item.href &&
      other.href.length > item.href.length &&
      (pathname === other.href || pathname.startsWith(other.href + '/'))
  )
}

export function labelForRoute(pathname: string): string {
  // The home route is the "Solution Architecture Studio" landing page; the sidebar
  // keeps the compact "Home" shortcut, but the header shows the full page name.
  if (pathname === '/') return 'Solution Architecture Studio'
  let best: NavItem | null = null
  for (const item of ALL_NAV_ITEMS) {
    if (item.href === '/') continue
    if (pathname !== item.href && !pathname.startsWith(item.href + '/')) continue
    if (!best || item.href.length > best.href.length) best = item
  }
  return best?.label ?? 'Studio'
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/'
  if (pathname === item.href) return true
  if (pathname.startsWith(item.href + '/'))
    return !hasMoreSpecificItem(item, pathname)
  return (item.activePrefixes ?? []).some((p) => pathname.startsWith(p))
}
