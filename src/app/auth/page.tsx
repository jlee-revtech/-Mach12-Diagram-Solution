'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mail } from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import { Button } from '@/components/common'
import { Mach12Logo } from '@/components/brand/Mach12Logo'
import VersionBadge from '@/components/VersionBadge'

const INPUT_CLASSES =
  'w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none transition-colors'

const LABEL_CLASSES = 'text-label uppercase text-text-secondary block mb-1'

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
      <div className="min-h-screen bg-surface-muted flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <Mail size={28} className="mx-auto mb-4 text-brand-500" />
          <h2 className="font-display text-heading-sm text-text-primary mb-2">Check your email</h2>
          <p className="text-body-sm text-text-secondary mb-6">
            We sent a confirmation link to <strong className="text-text-primary">{email}</strong>. Click it to activate your account.
          </p>
          <button
            type="button"
            onClick={() => { setSignupSuccess(false); setMode('signin') }}
            className="text-body-sm text-brand-500 hover:text-brand-600 transition-colors"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-muted flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2">
            <Mach12Logo size={32} />
            <span className="font-display font-bold text-xl tracking-wide">
              <span className="text-gradient">MACH12</span>
              <span className="text-text-tertiary">.AI</span>
            </span>
            <VersionBadge />
          </div>
          <p className="text-body-sm text-text-secondary mt-2">Data Architecture Diagrams</p>
        </div>

        <div className="bg-white border border-border rounded-xl shadow-card p-8">
          {/* Tab toggle */}
          <div className="flex mb-6 bg-surface-muted rounded-lg p-1">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null) }}
              className={`flex-1 py-2 text-body-sm font-medium rounded-md transition-colors ${
                mode === 'signin'
                  ? 'bg-brand-500 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null) }}
              className={`flex-1 py-2 text-body-sm font-medium rounded-md transition-colors ${
                mode === 'signup'
                  ? 'bg-brand-500 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className={LABEL_CLASSES}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder="Josh Lee"
                  className={INPUT_CLASSES}
                />
              </div>
            )}

            <div>
              <label className={LABEL_CLASSES}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className={INPUT_CLASSES}
              />
            </div>

            <div>
              <label className={LABEL_CLASSES}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min. 6 characters"
                className={INPUT_CLASSES}
              />
            </div>

            {error && (
              <div className="bg-status-red-bg border border-red-200 rounded-lg px-3 py-2 text-body-sm text-status-red">
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth loading={submitting}>
              {submitting ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
