'use client'

import { useEffect, useState, useCallback } from 'react'
import { Check, Copy, Plus, Trash2, X } from 'lucide-react'
import { Button, LoadingState } from '@/components/common'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-[28rem] max-w-[92vw] bg-white border border-border rounded-xl shadow-card-hover overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="text-heading-sm font-display text-text-primary">Share process model</h3>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={16} />} aria-label="Close" onClick={onClose} />
        </div>

        <div className="p-5">
          <p className="text-body-sm text-text-secondary mb-4">
            Read-only links let anyone view this process model without an account.
          </p>

          <Button
            fullWidth
            icon={<Plus size={14} />}
            loading={creating}
            onClick={handleCreate}
            className="mb-4"
          >
            {creating ? 'Creating...' : 'Create share link'}
          </Button>

          {loading ? (
            <LoadingState variant="inline" compact label="Loading share links..." />
          ) : shares.length === 0 ? (
            <div className="text-center py-4 text-body-sm text-text-tertiary">No active share links.</div>
          ) : (
            <div className="space-y-2">
              {shares.map(s => (
                <div key={s.id} className="flex items-center gap-2 bg-surface-muted border border-border rounded-lg px-3 py-2">
                  <span className="flex-1 truncate text-[11px] font-mono text-text-secondary">
                    /share/process/{s.code}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={copiedCode === s.code ? <Check size={12} /> : <Copy size={12} />}
                    title="Copy link"
                    onClick={() => handleCopy(s.code)}
                  >
                    {copiedCode === s.code ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={<Trash2 size={14} />}
                    title="Revoke link"
                    aria-label="Revoke link"
                    onClick={() => handleRevoke(s.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
