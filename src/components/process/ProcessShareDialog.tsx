'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  createProcessModelShare,
  listProcessModelShares,
  deleteProcessModelShare,
  type ProcessModelShare,
} from '@/lib/supabase/process-models'

export default function ProcessShareDialog({
  modelId, orgId, userId, onClose,
}: {
  modelId: string
  orgId: string
  userId: string
  onClose: () => void
}) {
  const [shares, setShares] = useState<ProcessModelShare[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setShares(await listProcessModelShares(modelId))
    setLoading(false)
  }, [modelId])

  useEffect(() => { load() }, [load])

  const shareUrl = (code: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/share/process/${code}` : ''

  const handleCreate = async () => {
    setCreating(true)
    try {
      await createProcessModelShare(modelId, orgId, userId)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create share link')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(code))
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 1500)
    } catch { /* ignore */ }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this share link? Anyone holding it will lose access.')) return
    await deleteProcessModelShare(id)
    await load()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-[28rem] max-w-[92vw] bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--m12-border)]/40">
          <h3 className="text-sm font-semibold text-[var(--m12-text)]">Share process model</h3>
          <button onClick={onClose} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <p className="text-xs text-[var(--m12-text-muted)] mb-4">
            Read-only links let anyone view this process model without an account.
          </p>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 bg-[#0EA5E9] hover:bg-[#38BDF8] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors mb-4"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {creating ? 'Creating…' : 'Create share link'}
          </button>

          {loading ? (
            <div className="text-center py-4 text-xs text-[var(--m12-text-muted)]">Loading…</div>
          ) : shares.length === 0 ? (
            <div className="text-center py-4 text-xs text-[var(--m12-text-muted)]">No active share links.</div>
          ) : (
            <div className="space-y-2">
              {shares.map(s => (
                <div key={s.id} className="flex items-center gap-2 bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2">
                  <span className="flex-1 truncate text-[11px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-secondary)]">
                    /share/process/{s.code}
                  </span>
                  <button
                    onClick={() => handleCopy(s.code)}
                    title="Copy link"
                    className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] text-[#0EA5E9] hover:text-[#38BDF8]"
                  >
                    {copiedCode === s.code ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => handleRevoke(s.id)}
                    title="Revoke link"
                    className="text-[var(--m12-border)] hover:text-red-400"
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
