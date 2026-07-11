'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, Check, ChevronDown, LogOut } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/supabase/auth-context'
import { labelForRoute } from './nav-config'

/**
 * StudioHeader per PPM design system section 4.3: h-14 white bar with the
 * current page label on the left and org switcher + user menu on the right.
 */

export function StudioHeader() {
  const pathname = usePathname() ?? '/'

  return (
    <header className="h-14 bg-white border-b border-border flex items-center px-4 gap-3 flex-shrink-0 z-20">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-body-md font-semibold text-text-primary truncate">
          {labelForRoute(pathname)}
        </span>
      </div>
      <div className="flex-1" />
      <OrgSwitcher />
      <UserMenu />
    </header>
  )
}

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  return ref
}

function OrgSwitcher() {
  const { organization, organizations, switchOrg } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))

  if (!organization) return null
  const multiple = organizations.length > 1

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => multiple && setOpen((v) => !v)}
        className={cn(
          'h-9 px-3 rounded-lg border border-border flex items-center gap-2 text-body-sm text-text-secondary transition-colors',
          multiple ? 'hover:bg-surface-muted hover:text-text-primary' : 'cursor-default'
        )}
        aria-haspopup={multiple ? 'menu' : undefined}
        aria-expanded={open}
      >
        <Building2 size={14} className="text-text-tertiary" />
        <span className="max-w-[160px] truncate hidden sm:inline">
          {organization.name}
        </span>
        {multiple && <ChevronDown size={12} className="text-text-tertiary" />}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-64 bg-white rounded-lg shadow-dropdown border border-border py-1 animate-slide-in-up z-50">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-text-tertiary">
            Organizations
          </div>
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={async () => {
                setOpen(false)
                if (org.id !== organization.id) await switchOrg(org.id)
              }}
              className="w-full text-left px-3 py-2 text-body-sm hover:bg-surface-muted flex items-center gap-2"
            >
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === organization.id && (
                <Check size={14} className="text-brand-600 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, profile, signOut } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))

  if (!user) return null

  const name = profile?.display_name || user.email || 'User'
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-muted transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="w-7 h-7 rounded-full bg-brand-500 text-white text-[11px] font-semibold inline-flex items-center justify-center">
          {initials || 'U'}
        </span>
        <ChevronDown size={12} className="text-text-tertiary hidden md:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-64 bg-white rounded-lg shadow-dropdown border border-border py-1 animate-slide-in-up z-50">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-body-sm font-medium text-text-primary truncate">
              {profile?.display_name || 'Signed in'}
            </div>
            <div className="text-[11px] text-text-tertiary truncate">
              {user.email}
            </div>
          </div>
          <button
            onClick={async () => {
              setOpen(false)
              await signOut()
              router.push('/auth')
            }}
            className="w-full text-left px-3 py-2 text-body-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
