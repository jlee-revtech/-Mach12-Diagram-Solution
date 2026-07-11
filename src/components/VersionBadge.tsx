'use client'

import { useState } from 'react'
import { APP_VERSION, BUILD_DATE } from '@/lib/version'

export default function VersionBadge() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] font-mono text-text-tertiary hover:text-text-secondary transition-colors px-1 py-0.5 rounded"
      >
        v{APP_VERSION}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-white border border-border rounded-lg shadow-dropdown p-3 space-y-2 animate-slide-in-up">
            <div className="text-[10px] font-semibold text-text-primary">Mach12.ai</div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-text-tertiary">Version</span>
                <span className="text-text-primary font-mono">{APP_VERSION}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-text-tertiary">Build</span>
                <span className="text-text-primary font-mono">{BUILD_DATE}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
