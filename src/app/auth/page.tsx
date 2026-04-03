'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { APP_VERSION } from '@/lib/version'

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const { signIn, signUp, user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/')
    }
  }, [user, loading, router])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    if (mode === 'signin') {
      const { error } = await signIn(email, password)
      if (error) setError(error)
    } else {
      const { error } = await signUp(email, password, displayName)
      if (error) {
        setError(error)
      } else {
        setSignupSuccess(true)
      }
    }

    setSubmitting(false)
  }, [mode, email, password, displayName, signIn, signUp])

  if (loading) return null

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-[var(--m12-bg)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-4">&#9993;</div>
          <h2 className="text-lg font-semibold text-[var(--m12-text)] mb-2">Check your email</h2>
          <p className="text-sm text-[var(--m12-text-muted)] mb-6">
            We sent a confirmation link to <strong className="text-[var(--m12-text-secondary)]">{email}</strong>. Click it to activate your account.
          </p>
          <button
            onClick={() => { setSignupSuccess(false); setMode('signin') }}
            className="text-sm text-[#2563EB] hover:text-[#3B82F6] transition-colors"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--m12-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-gradient text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wide">
            MACH12
          </span>
          <span className="text-[var(--m12-text-muted)] text-xl">.AI</span>
          <span className="text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] ml-2 self-end mb-1">v{APP_VERSION}</span>
          <p className="text-sm text-[var(--m12-text-muted)] mt-2">Data Architecture Diagrams</p>
        </div>

        <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-2xl p-8">
          {/* Tab toggle */}
          <div className="flex mb-6 bg-[var(--m12-bg)] rounded-lg p-1">
            <button
              onClick={() => { setMode('signin'); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'signin'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'signup'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder="Josh Lee"
                  className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/60 rounded-lg px-3 py-2.5 text-sm text-[var(--m12-text)] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[var(--m12-border)]"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] block mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/60 rounded-lg px-3 py-2.5 text-sm text-[var(--m12-text)] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[var(--m12-border)]"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] block mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min. 6 characters"
                className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/60 rounded-lg px-3 py-2.5 text-sm text-[var(--m12-text)] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[var(--m12-border)]"
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
              {submitting ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
