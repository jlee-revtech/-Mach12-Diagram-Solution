'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from './client'
import type { Profile, Organization } from './types'

interface AuthState {
  user: User | null
  profile: Profile | null
  organization: Organization | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  createOrg: (name: string, slug: string) => Promise<{ error: string | null }>
  joinOrg: (inviteCode: string) => Promise<{ error: string | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchProfile = useCallback(async (userId: string, accessToken: string) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const headers = {
      'apikey': anonKey,
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.pgrst.object+json',
    }

    const profRes = await fetch(
      `${url}/rest/v1/profiles?id=eq.${userId}&select=*`,
      { headers: { ...headers, 'Accept': 'application/json' } }
    )
    if (!profRes.ok) return
    const profArr = await profRes.json()
    if (!profArr.length) return

    const data = profArr[0]
    setProfile(data)

    if (data.organization_id) {
      const orgRes = await fetch(
        `${url}/rest/v1/organizations?id=eq.${data.organization_id}&select=*`,
        { headers: { ...headers, 'Accept': 'application/json' } }
      )
      if (orgRes.ok) {
        const orgArr = await orgRes.json()
        if (orgArr.length) setOrganization(orgArr[0])
      }
    } else {
      setOrganization(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user && session) await fetchProfile(user.id, session.access_token)
  }, [user, session, fetchProfile])

  useEffect(() => {
    const supabase = createClient()
    let initialDone = false

    // onAuthStateChange fires immediately with INITIAL_SESSION event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // console.log('[auth] event:', event, session?.user?.email ?? 'none')
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user && session.access_token) {
          await fetchProfile(session.user.id, session.access_token).catch(err => console.error('[auth] profile error:', err))
        } else {
          setProfile(null)
          setOrganization(null)
        }
        if (!initialDone) {
          initialDone = true
          setLoading(false)
        }
      }
    )

    // Fallback: if onAuthStateChange doesn't fire within 2s, stop loading
    const timeout = setTimeout(() => {
      if (!initialDone) {
        // timeout fallback
        initialDone = true
        setLoading(false)
      }
    }, 2000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [fetchProfile])

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    return { error: error?.message ?? null }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setOrganization(null)
    setSession(null)
  }, [])

  const createOrg = useCallback(async (name: string, slug: string) => {
    const currentUser = user
    const currentSession = session
    if (!currentUser || !currentSession) return { error: 'Not authenticated' }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const headers = {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${currentSession.access_token}`,
      'Prefer': 'return=representation',
    }

    // Insert org
    // insert org
    const orgRes = await fetch(`${url}/rest/v1/organizations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') }),
    })
    const orgData = await orgRes.json()
    if (!orgRes.ok) return { error: orgData.message || 'Failed to create org' }

    const org = Array.isArray(orgData) ? orgData[0] : orgData

    // Update profile
    // update profile
    const profRes = await fetch(
      `${url}/rest/v1/profiles?id=eq.${currentUser.id}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ organization_id: org.id, role: 'admin' }),
      }
    )
    if (!profRes.ok) {
      const profErr = await profRes.json()
      return { error: profErr.message || 'Failed to update profile' }
    }

    window.location.href = '/'
    return { error: null }
  }, [user, session])

  const joinOrg = useCallback(async (inviteCode: string) => {
    const currentUser = user
    const currentSession = session
    if (!currentUser || !currentSession) return { error: 'Not authenticated' }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const headers = {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${currentSession.access_token}`,
    }

    // Look up invite
    const inviteRes = await fetch(
      `${url}/rest/v1/org_invites?code=eq.${inviteCode}&select=*`,
      { headers: { ...headers, 'Accept': 'application/vnd.pgrst.object+json' } }
    )
    if (!inviteRes.ok) return { error: 'Invalid invite code' }
    const invite = await inviteRes.json()

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { error: 'Invite code has expired' }
    }

    // Update profile
    const profRes = await fetch(
      `${url}/rest/v1/profiles?id=eq.${currentUser.id}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ organization_id: invite.organization_id, role: 'member' }),
      }
    )
    if (!profRes.ok) return { error: 'Failed to join organization' }

    window.location.href = '/'
    return { error: null }
  }, [user])

  return (
    <AuthContext.Provider
      value={{
        user, profile, organization, session, loading,
        signUp, signIn, signOut, createOrg, joinOrg, refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
