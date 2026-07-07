'use client'

// Manage the workshop's public, read-only prep share link. Enables/disables a
// code stored in workshops.settings.share and shows the copyable public URL.

import { useState } from 'react'
import { setWorkshopShare, type WorkshopShare } from '@/lib/supabase/workshops'

export default function WorkshopShareDialog({
  workshopId, initialShare, onClose, onChange,
}: {
  workshopId: string
  initialShare: WorkshopShare | null
  onClose: () => void
  onChange: (share: WorkshopShare) => void
}) {
  const [share, setShare] = useState<WorkshopShare | null>(initialShare)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const url = share?.code && typeof window !== 'undefined' ? `${window.location.origin}/share/workshop/${share.code}` : ''
  const enabled = !!share?.enabled

  const set = async (on: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const s = await setWorkshopShare(workshopId, on)
      setShare(s)
      onChange(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update the share link')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[32rem] max-w-[94vw] bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--m12-border)]/40">
          <div>
            <h3 className="text-sm font-semibold text-[var(--m12-text)]">Share workshop prep</h3>
            <div className="text-[11px] text-[var(--m12-text-muted)]">A public, read-only link to the brief and section content.</div>
          </div>
          <button type="button" onClick={onClose} title="Close" aria-label="Close" className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {error && <div className="text-[11px] text-[#EF4444] bg-[#DC262614] border border-[#DC2626]/30 rounded-lg px-3 py-2">{error}</div>}

          {enabled ? (
            <>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#10B981]" />
                <span className="text-[11px] text-[var(--m12-text-secondary)]">Public link is on. Anyone with the link can view (read only).</span>
              </div>
              <div className="flex items-center gap-2">
                <input readOnly value={url} className="flex-1 bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-[11px] text-[var(--m12-text)] outline-none" />
                <button type="button" onClick={copy} className="text-[11px] px-3 py-2 rounded-lg font-medium text-white bg-[#2563EB] hover:bg-[#3B82F6] shrink-0">{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <div className="flex items-center justify-between pt-1">
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#3B82F6] hover:underline">Open link ↗</a>
                <button type="button" onClick={() => set(false)} disabled={busy} className="text-[11px] px-2.5 py-1 rounded-lg border border-[var(--m12-border)]/50 text-[var(--m12-text-secondary)] hover:border-[var(--m12-border)] disabled:opacity-50">{busy ? 'Working…' : 'Turn off link'}</button>
              </div>
              <div className="text-[10px] text-[var(--m12-text-muted)] leading-snug pt-1">The link always reflects the latest saved prep. Turn it off anytime to revoke access; the same link works again if you turn it back on.</div>
            </>
          ) : (
            <>
              <p className="text-xs text-[var(--m12-text-muted)] leading-relaxed">Create a public link to share the workshop brief and section content, read only. No sign-in required for viewers.</p>
              <button type="button" onClick={() => set(true)} disabled={busy} className="text-xs px-3 py-2 rounded-lg font-medium text-white bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50">
                {busy ? 'Creating…' : (share?.code ? 'Turn link back on' : 'Create public link')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
