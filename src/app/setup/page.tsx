'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'

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
    if (!loading && organization) router.push('/')
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
    <div className="min-h-screen bg-[#151E2E] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-gradient text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wide">
            MACH12
          </span>
          <span className="text-[#64748B] text-xl">.AI</span>
          <h2 className="text-lg font-semibold text-[#F8FAFC] mt-4">Set Up Your Organization</h2>
          <p className="text-sm text-[#64748B] mt-1">
            Create a new organization or join an existing one with an invite code.
          </p>
        </div>

        <div className="bg-[#1F2C3F] border border-[#374A5E]/40 rounded-2xl p-8">
          {/* Tab toggle */}
          <div className="flex mb-6 bg-[#151E2E] rounded-lg p-1">
            <button
              onClick={() => { setMode('create'); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'create'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              Create Org
            </button>
            <button
              onClick={() => { setMode('join'); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'join'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              Join with Code
            </button>
          </div>

          {mode === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  placeholder="Revelation Technologies"
                  className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2.5 text-sm text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#374A5E]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  required
                  placeholder="revtech"
                  className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2.5 text-sm text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#374A5E] font-[family-name:var(--font-space-mono)]"
                />
                <p className="text-[10px] text-[#374A5E] mt-1">Used as a URL-friendly identifier</p>
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
                {submitting ? 'Creating...' : 'Create Organization'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#64748B] font-[family-name:var(--font-space-mono)] block mb-1">
                  Invite Code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  placeholder="Enter invite code"
                  className="w-full bg-[#151E2E] border border-[#374A5E]/60 rounded-lg px-3 py-2.5 text-sm text-[#F8FAFC] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#374A5E] font-[family-name:var(--font-space-mono)] tracking-wider text-center"
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
