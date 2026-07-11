'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'

import { Mach12Logo } from '@/components/brand/Mach12Logo'
import { APP_VERSION } from '@/lib/version'
import { cn } from '@/lib/cn'
import { useStudioStore } from '@/lib/studio-store'
import { NAV_SECTIONS, isNavItemActive, type NavItem } from './nav-config'

/**
 * StudioSidebar per PPM design system section 4.2.
 * 208px expanded / 56px collapsed, 300ms transition, deep-navy brand-800
 * tint. Collapsed items show a Radix tooltip with the label.
 */

export function StudioSidebar() {
  const pathname = usePathname() ?? '/'
  const collapsed = useStudioStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useStudioStore((s) => s.toggleSidebar)

  return (
    <Tooltip.Provider delayDuration={150}>
      <aside
        data-collapsed={collapsed ? 'true' : 'false'}
        className={cn(
          'fixed left-0 top-0 h-full z-30 text-white flex flex-col transition-all duration-300 bg-brand-800',
          'data-[collapsed=true]:w-14 data-[collapsed=false]:w-52'
        )}
      >
        <Link
          href="/"
          className="h-12 flex items-center gap-2.5 px-3 border-b border-white/10 shrink-0 hover:bg-white/5 transition-colors"
        >
          <Mach12Logo size={28} className="shrink-0" />
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-display font-bold text-[11px] tracking-wide truncate">
                MACH12 <span className="text-cyan-400">STUDIO</span>
              </span>
              <span className="text-[9px] text-white/40 truncate">
                MACH12.AI
              </span>
            </div>
          )}
        </Link>

        <nav
          className="flex-1 overflow-y-auto py-2 scrollbar-hide"
          aria-label="Mach12 Studio navigation"
        >
          {NAV_SECTIONS.map((section, idx) => (
            <div key={section.label}>
              {idx > 0 && (
                <div className="ml-4 mt-1.5 mb-0 w-1/3 border-t border-white/10" />
              )}
              {!collapsed && (
                <div className="px-4 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-white/35 font-medium">
                  {section.label}
                </div>
              )}
              <ul className="space-y-0.5 px-2 py-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={isNavItemActive(item, pathname)}
                      collapsed={collapsed}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="h-10 border-t border-white/10 flex items-center shrink-0">
          <button
            onClick={toggleSidebar}
            className="flex-1 h-full flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          {!collapsed && (
            <span className="pr-3 text-[10px] text-white/25 tabular-nums font-mono">
              v{APP_VERSION}
            </span>
          )}
        </div>
      </aside>
    </Tooltip.Provider>
  )
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
}) {
  const Icon = item.icon
  const link = (
    <Link
      href={item.href}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] transition-colors',
        active
          ? 'bg-brand-500 text-white'
          : 'text-white/70 hover:bg-white/10 hover:text-white',
        collapsed && 'justify-center px-0'
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={16} className="flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg border border-white/10 animate-fade-in z-50"
        >
          {item.label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
