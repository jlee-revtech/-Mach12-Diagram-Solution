'use client'

// Manage the workshop's public, read-only prep share link. Enables/disables a
// code stored in workshops.settings.share and shows the copyable public URL.

import { useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { setWorkshopShare, type WorkshopShare } from '@/lib/supabase/workshops'
import { Button } from '@/components/common'

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[32rem] max-w-[94vw] bg-white rounded-xl shadow-card-hover overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <h3 className="text-heading-sm font-display text-text-primary">Share workshop prep</h3>
            <div className="text-[11px] text-text-tertiary">A public, read-only link to the brief and section content.</div>
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={14} />} title="Close" aria-label="Close" onClick={onClose} />
        </div>

        <div className="px-5 py-4 space-y-3">
          {error && <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          {enabled ? (
            <>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-status-green" />
                <span className="text-[11px] text-text-secondary">Public link is on. Anyone with the link can view (read only).</span>
              </div>
              <div className="flex items-center gap-2">
                <input readOnly value={url} className="flex-1 h-9 px-3 rounded-lg border border-border bg-surface-input text-[11px] text-text-primary focus:outline-none" />
                <Button variant="primary" size="sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
              </div>
              <div className="flex items-center justify-between pt-1">
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:underline">Open link <ExternalLink size={11} /></a>
                <Button variant="secondary" size="sm" onClick={() => set(false)} disabled={busy}>{busy ? 'Working...' : 'Turn off link'}</Button>
              </div>
              <div className="text-[11px] text-text-tertiary leading-snug pt-1">The link always reflects the latest saved prep. Turn it off anytime to revoke access; the same link works again if you turn it back on.</div>
            </>
          ) : (
            <>
              <p className="text-body-sm text-text-secondary leading-relaxed">Create a public link to share the workshop brief and section content, read only. No sign-in required for viewers.</p>
              <Button variant="primary" size="sm" onClick={() => set(true)} loading={busy} disabled={busy}>
                {busy ? 'Creating...' : (share?.code ? 'Turn link back on' : 'Create public link')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
