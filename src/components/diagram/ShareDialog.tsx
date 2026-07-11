'use client'

import { useState, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/common'
import { useAuth } from '@/lib/supabase/auth-context'
import { useDiagramStore } from '@/lib/diagram/store'

interface ShareDialogProps {
  open: boolean
  onClose: () => void
}

export default function ShareDialog({ open, onClose }: ShareDialogProps) {
  const { user, organization } = useAuth()
  const meta = useDiagramStore((s) => s.meta)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [permission, setPermission] = useState<'editor' | 'viewer'>('editor')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [existingShares, setExistingShares] = useState<any[]>([])

  // Load existing shares
  useEffect(() => {
    if (!open || !meta.id) return
    loadShares()
  }, [open, meta.id])

  const loadShares = async () => {
    const token = getToken()
    if (!token) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const res = await fetch(
      `${url}/rest/v1/diagram_shares?diagram_id=eq.${meta.id}&select=*`,
      {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    )
    if (res.ok) {
      setExistingShares(await res.json())
    }
  }

  const handleCreateLink = useCallback(async () => {
    if (!user || !organization) return
    setCreating(true)

    try {
      const token = getToken()
      if (!token) throw new Error('Not authenticated')

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const headers = {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=representation',
      }

      // Create a share record with a unique code
      const code = crypto.randomUUID().substring(0, 12)
      const res = await fetch(`${url}/rest/v1/diagram_shares`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          diagram_id: meta.id,
          organization_id: organization.id,
          code,
          permission,
          created_by: user.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to create share link')
      }

      const link = `${window.location.origin}/invite/${code}`
      setShareLink(link)
      await loadShares()
    } catch (err) {
      console.error('Share error:', err)
    } finally {
      setCreating(false)
    }
  }, [user, organization, meta.id, permission])

  const handleCopy = useCallback(() => {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareLink])

  if (!open) return null

  return (
    <div className="fixed inset-0" style={{ zIndex: 9999 }} onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />
      {/* Scrollable centering wrapper */}
      <div className="absolute inset-0 overflow-y-auto flex items-start justify-center py-8 px-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-white rounded-xl shadow-card-hover my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-heading-sm font-display text-text-primary">Share Diagram</h3>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<X size={16} />}
              aria-label="Close"
              title="Close"
              onClick={onClose}
            />
          </div>

          <div className="p-6">
          <p className="text-body-sm text-text-secondary mb-4">
            Generate a share link for <strong className="text-text-primary">{meta.title}</strong>. Recipients will be added to your organization and granted access to this diagram.
          </p>

          {/* Permission selector */}
          <div className="mb-4">
            <label className="text-label uppercase text-text-secondary block mb-1.5">
              Permission Level
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setPermission('editor')}
                className={`flex-1 py-2 text-[12px] font-medium rounded-lg transition-colors ${
                  permission === 'editor'
                    ? 'bg-brand-500 text-white'
                    : 'bg-white text-text-secondary hover:text-text-primary hover:bg-surface-muted border border-border'
                }`}
              >
                Editor
              </button>
              <button
                onClick={() => setPermission('viewer')}
                className={`flex-1 py-2 text-[12px] font-medium rounded-lg transition-colors ${
                  permission === 'viewer'
                    ? 'bg-brand-500 text-white'
                    : 'bg-white text-text-secondary hover:text-text-primary hover:bg-surface-muted border border-border'
                }`}
              >
                View Only
              </button>
            </div>
          </div>

          {/* Generate / Show link */}
          {!shareLink ? (
            <Button
              variant="primary"
              size="md"
              fullWidth
              loading={creating}
              disabled={creating}
              onClick={handleCreateLink}
            >
              {creating ? 'Creating...' : 'Generate Share Link'}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-surface-input border border-border rounded-lg px-3 py-2.5">
                <input
                  readOnly
                  value={shareLink}
                  aria-label="Share link"
                  className="flex-1 bg-transparent text-body-sm text-text-secondary outline-none font-mono"
                />
                <button
                  onClick={handleCopy}
                  className="text-brand-600 hover:text-brand-700 text-[12px] font-medium shrink-0 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-[10px] text-text-tertiary">
                Link expires in 7 days. Anyone with this link can join as {permission}.
              </p>
              <button
                onClick={() => { setShareLink(null); setCopied(false) }}
                className="text-[12px] text-text-secondary hover:text-text-primary transition-colors"
              >
                Generate new link
              </button>
            </div>
          )}

          {/* Existing shares */}
          {existingShares.length > 0 && (
            <div className="mt-5">
              <label className="text-label uppercase text-text-secondary block mb-2">
                Active Share Links
              </label>
              <div className="space-y-1.5">
                {existingShares.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between bg-surface-muted border border-border rounded-lg px-3 py-2">
                    <div>
                      <span className="text-[10px] text-text-secondary font-mono">
                        ...{s.code.slice(-6)}
                      </span>
                      <span className={`ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${
                        s.permission === 'editor' ? 'bg-status-blue-bg text-status-blue' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {s.permission}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-tertiary">
                      {new Date(s.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)?.access_token ?? null
  } catch { return null }
}
