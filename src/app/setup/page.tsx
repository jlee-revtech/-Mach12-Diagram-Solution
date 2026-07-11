'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { Button } from '@/components/common'
import { Mach12Logo } from '@/components/brand/Mach12Logo'
import VersionBadge from '@/components/VersionBadge'

const INPUT_CLASSES =
  'w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors'

const LABEL_CLASSES = 'text-label uppercase text-text-secondary block mb-1'

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

  // If the user already has an active org (or it resolves after a token
  // refresh), leave setup. Without this, a bounced user is stranded here
  // even though their org loaded moments later.
  useEffect(() => {
    if (!loading && user && organization) router.replace('/')
  }, [user, organization, loading, router])

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
    <div className="min-h-screen bg-surface-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2">
            <Mach12Logo size={32} />
            <span className="font-display font-bold text-xl tracking-wide">
              <span className="text-gradient">MACH12</span>
              <span className="text-text-tertiary">.AI</span>
            </span>
            <VersionBadge />
          </div>
          <h2 className="text-heading-md text-text-primary mt-4">Set Up Your Organization</h2>
          <p className="text-body-sm text-text-secondary mt-1">
            Create a new organization or join an existing one by name or invite code.
          </p>
        </div>

        <div className="bg-white border border-border rounded-xl shadow-card p-8">
          {/* Tab toggle */}
          <div className="flex mb-6 bg-surface-muted rounded-lg p-1">
            <button
              type="button"
              onClick={() => { setMode('create'); setError(null) }}
              className={`flex-1 py-2 text-body-sm font-medium rounded-md transition-colors ${
                mode === 'create'
                  ? 'bg-brand-500 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Create / Join Org
            </button>
            <button
              type="button"
              onClick={() => { setMode('join'); setError(null) }}
              className={`flex-1 py-2 text-body-sm font-medium rounded-md transition-colors ${
                mode === 'join'
                  ? 'bg-brand-500 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Join with Code
            </button>
          </div>

          {mode === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className={LABEL_CLASSES}>
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  placeholder="Revelation Technologies"
                  className={INPUT_CLASSES}
                />
              </div>
              <div>
                <label className={LABEL_CLASSES}>
                  Slug
                </label>
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  required
                  placeholder="revtech"
                  className={`${INPUT_CLASSES} font-mono`}
                />
                <p className="text-[11px] text-text-tertiary mt-1">Used as a URL-friendly identifier</p>
              </div>

              {error && (
                <div className="bg-status-red-bg border border-red-200 rounded-lg px-3 py-2 text-body-sm text-status-red">
                  {error}
                </div>
              )}

              <Button type="submit" variant="primary" fullWidth loading={submitting}>
                {submitting ? 'Joining...' : 'Create / Join Organization'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className={LABEL_CLASSES}>
                  Invite Code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  placeholder="Enter invite code"
                  className={`${INPUT_CLASSES} font-mono tracking-wider text-center`}
                />
              </div>

              {error && (
                <div className="bg-status-red-bg border border-red-200 rounded-lg px-3 py-2 text-body-sm text-status-red">
                  {error}
                </div>
              )}

              <Button type="submit" variant="primary" fullWidth loading={submitting}>
                {submitting ? 'Joining...' : 'Join Organization'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
