'use client'

import { useState } from 'react'
import { APP_VERSION, BUILD_DATE } from '@/lib/version'

export default function VersionBadge() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className="text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] hover:text-[var(--m12-text-muted)] transition-colors px-1 py-0.5 rounded"
      >
        v{APP_VERSION}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg shadow-xl p-3 space-y-2">
            <div className="text-[10px] font-semibold text-[var(--m12-text)]">Mach12.ai</div>
            <div className="space-y-1">
              <div className="flex justify-between text-[9px]">
                <span className="text-[var(--m12-text-muted)]">Version</span>
                <span className="text-[var(--m12-text)] font-[family-name:var(--font-space-mono)]">{APP_VERSION}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-[var(--m12-text-muted)]">Build</span>
                <span className="text-[var(--m12-text)] font-[family-name:var(--font-space-mono)]">{BUILD_DATE}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
