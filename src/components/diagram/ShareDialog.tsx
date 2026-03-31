'use client'

import { useState, useCallback, useEffect } from 'react'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#1A2435] border border-[#374A5E]/60 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#374A5E]/40">
          <h3 className="text-sm font-semibold text-[#F8FAFC]">Share Diagram</h3>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="p-6">
          <p className="text-xs text-[#64748B] mb-4">
            Generate a share link for <strong className="text-[#CBD5E1]">{meta.title}</strong>. Recipients will be added to your organization and granted access to this diagram.
          </p>

          {/* Permission selector */}
          <div className="mb-4">
            <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1.5">
              Permission Level
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setPermission('editor')}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                  permission === 'editor'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#151E2E] text-[#64748B] hover:text-[#CBD5E1] border border-[#374A5E]/40'
                }`}
              >
                Editor
              </button>
              <button
                onClick={() => setPermission('viewer')}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                  permission === 'viewer'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#151E2E] text-[#64748B] hover:text-[#CBD5E1] border border-[#374A5E]/40'
                }`}
              >
                View Only
              </button>
            </div>
          </div>

          {/* Generate / Show link */}
          {!shareLink ? (
            <button
              onClick={handleCreateLink}
              disabled={creating}
              className="w-full bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {creating ? 'Creating...' : 'Generate Share Link'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-[#151E2E] border border-[#374A5E]/40 rounded-lg px-3 py-2.5">
                <input
                  readOnly
                  value={shareLink}
                  className="flex-1 bg-transparent text-xs text-[#CBD5E1] outline-none font-[family-name:var(--font-space-mono)]"
                />
                <button
                  onClick={handleCopy}
                  className="text-[#2563EB] hover:text-[#3B82F6] text-xs font-medium shrink-0 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-[10px] text-[#374A5E]">
                Link expires in 7 days. Anyone with this link can join as {permission}.
              </p>
              <button
                onClick={() => { setShareLink(null); setCopied(false) }}
                className="text-xs text-[#64748B] hover:text-[#CBD5E1] transition-colors"
              >
                Generate new link
              </button>
            </div>
          )}

          {/* Existing shares */}
          {existingShares.length > 0 && (
            <div className="mt-5">
              <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-2">
                Active Share Links
              </label>
              <div className="space-y-1.5">
                {existingShares.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between bg-[#151E2E] border border-[#374A5E]/30 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-[10px] text-[#CBD5E1] font-[family-name:var(--font-space-mono)]">
                        ...{s.code.slice(-6)}
                      </span>
                      <span className={`ml-2 text-[9px] uppercase px-1.5 py-0.5 rounded ${
                        s.permission === 'editor' ? 'bg-[#2563EB]/20 text-[#2563EB]' : 'bg-[#64748B]/20 text-[#64748B]'
                      }`}>
                        {s.permission}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#374A5E]">
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
