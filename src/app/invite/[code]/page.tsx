'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'

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

      // Add user to org if not already a member
      if (!profile?.organization_id || profile.organization_id !== share.organization_id) {
        const profRes = await fetch(
          `${url}/rest/v1/profiles?id=eq.${user.id}`,
          {
            method: 'PATCH',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({
              organization_id: share.organization_id,
              role: 'member',
            }),
          }
        )
        if (!profRes.ok) throw new Error('Failed to join organization')
      }

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
    <div className="min-h-screen bg-[#151E2E] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1F2C3F] border border-[#374A5E]/40 rounded-2xl p-8 text-center">
        <div className="mb-4">
          <span className="text-gradient text-xl font-bold font-[family-name:var(--font-orbitron)] tracking-wide">
            MACH12
          </span>
          <span className="text-[#64748B] text-lg">.AI</span>
        </div>

        {status === 'loading' && (
          <>
            <div className="w-6 h-6 border-2 border-[#06B6D4] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#64748B]">Loading invite...</p>
          </>
        )}

        {status === 'accepting' && (
          <>
            <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#CBD5E1]">Joining diagram...</p>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="text-3xl mb-3">&#10003;</div>
            <h2 className="text-lg font-semibold text-[#F8FAFC] mb-2">You're in!</h2>
            <p className="text-sm text-[#64748B] mb-6">
              You've been added to the diagram and organization.
            </p>
            <button
              onClick={() => router.push(diagramId ? `/diagram/${diagramId}` : '/')}
              className="bg-[#2563EB] hover:bg-[#3B82F6] text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              Open Diagram
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-3xl mb-3">&#10007;</div>
            <h2 className="text-lg font-semibold text-[#F8FAFC] mb-2">Invite Error</h2>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400 mb-4">
              {error}
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-sm text-[#2563EB] hover:text-[#3B82F6] transition-colors"
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
