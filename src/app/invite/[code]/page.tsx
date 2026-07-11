'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import { Button } from '@/components/common'
import { Mach12Logo } from '@/components/brand/Mach12Logo'

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)?.access_token ?? null
  } catch { return null }
}

export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'accepting' | 'done' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [diagramId, setDiagramId] = useState<string | null>(null)

  const acceptInvite = useCallback(async () => {
    if (!user) return
    setStatus('accepting')

    try {
      const token = getToken()
      if (!token) throw new Error('Not authenticated')

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const headers = {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      }

      // Look up the share
      const shareRes = await fetch(
        `${url}/rest/v1/diagram_shares?code=eq.${code}&select=*`,
        { headers }
      )
      if (!shareRes.ok) throw new Error('Invalid share link')
      const shares = await shareRes.json()
      if (!shares.length) throw new Error('Share link not found or expired')

      const share = shares[0]

      // Check expiry
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        throw new Error('This share link has expired')
      }

      setDiagramId(share.diagram_id)

      // Add user to org via org_members (upsert)
      const memberRes = await fetch(`${url}/rest/v1/org_members`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: user.id,
          organization_id: share.organization_id,
          role: 'member',
        }),
      })
      if (!memberRes.ok) {
        const err = await memberRes.json().catch(() => ({}))
        // Ignore duplicate key errors (already a member)
        if (!err.message?.includes('duplicate')) throw new Error('Failed to join organization')
      }

      // Set as active org on profile
      await fetch(
        `${url}/rest/v1/profiles?id=eq.${user.id}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ organization_id: share.organization_id }),
        }
      )

      // Grant diagram permission
      const permRes = await fetch(`${url}/rest/v1/diagram_permissions`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          diagram_id: share.diagram_id,
          user_id: user.id,
          permission: share.permission,
          granted_by: share.created_by,
        }),
      })
      // Ignore conflict errors (already has permission)

      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite')
      setStatus('error')
    }
  }, [user, profile, code])

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      // Store invite code so we can redirect back after auth
      sessionStorage.setItem('pending-invite', code)
      router.push('/auth')
    }
  }, [user, loading, router, code])

  // Auto-accept when logged in
  useEffect(() => {
    if (user && status === 'loading') {
      acceptInvite()
    }
  }, [user, status, acceptInvite])

  // Check for pending invite after auth
  useEffect(() => {
    const pending = sessionStorage.getItem('pending-invite')
    if (pending && user) {
      sessionStorage.removeItem('pending-invite')
    }
  }, [user])

  return (
    <div className="min-h-screen bg-surface-muted flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-border rounded-xl shadow-card p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Mach12Logo size={28} />
          <span className="font-display font-bold text-lg tracking-wide">
            <span className="text-gradient">MACH12</span>
            <span className="text-text-tertiary">.AI</span>
          </span>
        </div>

        {status === 'loading' && (
          <>
            <Loader2 size={24} className="animate-spin text-text-tertiary mx-auto mb-3" />
            <p className="text-body-sm text-text-secondary">Loading invite...</p>
          </>
        )}

        {status === 'accepting' && (
          <>
            <Loader2 size={24} className="animate-spin text-brand-500 mx-auto mb-3" />
            <p className="text-body-sm text-text-secondary">Joining diagram...</p>
          </>
        )}

        {status === 'done' && (
          <>
            <CheckCircle2 size={32} className="text-status-green mx-auto mb-3" />
            <h2 className="font-display text-heading-sm text-text-primary mb-2">You're in!</h2>
            <p className="text-body-sm text-text-secondary mb-6">
              You've been added to the diagram and organization.
            </p>
            <Button
              variant="primary"
              onClick={() => router.push(diagramId ? `/diagram/${diagramId}` : '/')}
            >
              Open Diagram
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={32} className="text-status-red mx-auto mb-3" />
            <h2 className="font-display text-heading-sm text-text-primary mb-2">Invite Error</h2>
            <div className="bg-status-red-bg border border-red-200 rounded-lg px-3 py-2 text-body-sm text-status-red mb-4">
              {error}
            </div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-body-sm text-brand-500 hover:text-brand-600 transition-colors"
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
