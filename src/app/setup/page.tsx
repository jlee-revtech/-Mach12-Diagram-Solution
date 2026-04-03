'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import VersionBadge from '@/components/VersionBadge'

export default function SetupPage() {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { user, organization, loading, createOrg, joinOrg } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
  }, [user, loading, router])

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await createOrg(orgName, orgSlug)
    if (error) setError(error)
    setSubmitting(false)
  }, [orgName, orgSlug, createOrg])

  const handleJoin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await joinOrg(inviteCode)
    if (error) setError(error)
    setSubmitting(false)
  }, [inviteCode, joinOrg])

  // Auto-generate slug from name
  const handleNameChange = useCallback((name: string) => {
    setOrgName(name)
    setOrgSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }, [])

  if (loading) return null

  return (
    <div className="min-h-screen bg-[var(--m12-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-gradient text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wide">
            MACH12
          </span>
          <span className="text-[var(--m12-text-muted)] text-xl">.AI</span>
          <span className="self-end mb-1"><VersionBadge /></span>
          <h2 className="text-lg font-semibold text-[var(--m12-text)] mt-4">Set Up Your Organization</h2>
          <p className="text-sm text-[var(--m12-text-muted)] mt-1">
            Create a new organization or join an existing one by name or invite code.
          </p>
        </div>

        <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-2xl p-8">
          {/* Tab toggle */}
          <div className="flex mb-6 bg-[var(--m12-bg)] rounded-lg p-1">
            <button
              onClick={() => { setMode('create'); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'create'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
              }`}
            >
              Create / Join Org
            </button>
            <button
              onClick={() => { setMode('join'); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'join'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
              }`}
            >
              Join with Code
            </button>
          </div>

          {mode === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] block mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  placeholder="Revelation Technologies"
                  className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/60 rounded-lg px-3 py-2.5 text-sm text-[var(--m12-text)] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[var(--m12-border)]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] block mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  required
                  placeholder="revtech"
                  className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/60 rounded-lg px-3 py-2.5 text-sm text-[var(--m12-text)] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[var(--m12-border)] font-[family-name:var(--font-space-mono)]"
                />
                <p className="text-[10px] text-[var(--m12-border)] mt-1">Used as a URL-friendly identifier</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? 'Joining...' : 'Create / Join Organization'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] block mb-1">
                  Invite Code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  placeholder="Enter invite code"
                  className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/60 rounded-lg px-3 py-2.5 text-sm text-[var(--m12-text)] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[var(--m12-border)] font-[family-name:var(--font-space-mono)] tracking-wider text-center"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? 'Joining...' : 'Join Organization'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
