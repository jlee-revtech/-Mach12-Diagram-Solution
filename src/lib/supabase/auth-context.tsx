'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from './client'
import type { Profile, Organization, OrgWithRole } from './types'

interface AuthState {
  user: User | null
  profile: Profile | null
  organization: Organization | null  // active org
  organizations: OrgWithRole[]       // all orgs the user belongs to
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  createOrg: (name: string, slug: string) => Promise<{ error: string | null }>
  joinOrg: (inviteCode: string) => Promise<{ error: string | null }>
  switchOrg: (orgId: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<OrgWithRole[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const apiHeaders = useCallback((accessToken: string) => ({
    'Content-Type': 'application/json',
    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
  }), [])

  const fetchProfile = useCallback(async (userId: string, accessToken: string) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const headers = apiHeaders(accessToken)

    // Fetch profile
    const profRes = await fetch(
      `${url}/rest/v1/profiles?id=eq.${userId}&select=*`,
      { headers }
    )
    if (!profRes.ok) return
    const profArr = await profRes.json()
    if (!profArr.length) return
    const data = profArr[0]
    setProfile(data)

    // Fetch all org memberships
    const membersRes = await fetch(
      `${url}/rest/v1/org_members?user_id=eq.${userId}&select=organization_id,role`,
      { headers }
    )
    let userOrgs: OrgWithRole[] = []
    if (membersRes.ok) {
      const memberships = await membersRes.json()
      if (memberships.length > 0) {
        const orgIds = memberships.map((m: { organization_id: string }) => m.organization_id)
        const orgRes = await fetch(
          `${url}/rest/v1/organizations?id=in.(${orgIds.join(',')})&select=*`,
          { headers }
        )
        if (orgRes.ok) {
          const orgs = await orgRes.json()
          userOrgs = orgs.map((org: Organization) => {
            const membership = memberships.find((m: { organization_id: string }) => m.organization_id === org.id)
            return { ...org, role: membership?.role ?? 'member' }
          })
        }
      }
    }
    setOrganizations(userOrgs)

    // Set active org: use profile.organization_id if it's in the list, otherwise first org
    if (userOrgs.length > 0) {
      const activeOrg = data.organization_id
        ? userOrgs.find((o) => o.id === data.organization_id) ?? userOrgs[0]
        : userOrgs[0]
      setOrganization(activeOrg)
    } else if (data.organization_id) {
      // Fallback: old-style single org (before migration runs)
      const orgRes = await fetch(
        `${url}/rest/v1/organizations?id=eq.${data.organization_id}&select=*`,
        { headers }
      )
      if (orgRes.ok) {
        const orgArr = await orgRes.json()
        if (orgArr.length) {
          setOrganization(orgArr[0])
          setOrganizations([{ ...orgArr[0], role: data.role }])
        }
      }
    } else {
      setOrganization(null)
    }
  }, [apiHeaders])

  const refreshProfile = useCallback(async () => {
    if (user && session) await fetchProfile(user.id, session.access_token)
  }, [user, session, fetchProfile])

  useEffect(() => {
    const supabase = createClient()
    let initialDone = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user && session.access_token) {
          await fetchProfile(session.user.id, session.access_token).catch(err => console.error('[auth] profile error:', err))
        } else {
          setProfile(null)
          setOrganization(null)
          setOrganizations([])
        }
        if (!initialDone) {
          initialDone = true
          setLoading(false)
        }
      }
    )

    const timeout = setTimeout(() => {
      if (!initialDone) {
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
    setOrganizations([])
    setSession(null)
  }, [])

  const createOrg = useCallback(async (name: string, slug: string) => {
    const currentUser = user
    const currentSession = session
    if (!currentUser || !currentSession) return { error: 'Not authenticated' }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const headers = {
      ...apiHeaders(currentSession.access_token),
      'Prefer': 'return=representation',
    }

    // Create org
    const orgRes = await fetch(`${url}/rest/v1/organizations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') }),
    })
    const orgData = await orgRes.json()
    if (!orgRes.ok) return { error: orgData.message || 'Failed to create org' }
    const org = Array.isArray(orgData) ? orgData[0] : orgData

    // Create org_members entry
    const memberRes = await fetch(`${url}/rest/v1/org_members`, {
      method: 'POST',
      headers: { ...apiHeaders(currentSession.access_token), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id: currentUser.id, organization_id: org.id, role: 'admin' }),
    })
    if (!memberRes.ok) {
      const err = await memberRes.json()
      return { error: err.message || 'Failed to add membership' }
    }

    // Set as active org on profile
    await fetch(
      `${url}/rest/v1/profiles?id=eq.${currentUser.id}`,
      {
        method: 'PATCH',
        headers: { ...apiHeaders(currentSession.access_token), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ organization_id: org.id, role: 'admin' }),
      }
    )

    window.location.href = '/'
    return { error: null }
  }, [user, session, apiHeaders])

  const joinOrg = useCallback(async (inviteCode: string) => {
    const currentUser = user
    const currentSession = session
    if (!currentUser || !currentSession) return { error: 'Not authenticated' }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const headers = apiHeaders(currentSession.access_token)

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

    // Create org_members entry (upsert)
    const memberRes = await fetch(`${url}/rest/v1/org_members`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: currentUser.id, organization_id: invite.organization_id, role: 'member' }),
    })
    if (!memberRes.ok) {
      const err = await memberRes.json().catch(() => ({}))
      return { error: err.message || 'Failed to join organization' }
    }

    // Set as active org on profile
    await fetch(
      `${url}/rest/v1/profiles?id=eq.${currentUser.id}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ organization_id: invite.organization_id }),
      }
    )

    window.location.href = '/'
    return { error: null }
  }, [user, session, apiHeaders])

  const switchOrg = useCallback(async (orgId: string) => {
    const currentUser = user
    const currentSession = session
    if (!currentUser || !currentSession) return

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const headers = { ...apiHeaders(currentSession.access_token), 'Prefer': 'return=minimal' }

    // Update profile's active org
    await fetch(
      `${url}/rest/v1/profiles?id=eq.${currentUser.id}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ organization_id: orgId }),
      }
    )

    // Update local state immediately
    const newOrg = organizations.find((o) => o.id === orgId)
    if (newOrg) {
      setOrganization(newOrg)
      setProfile((prev) => prev ? { ...prev, organization_id: orgId } : prev)
    }
  }, [user, session, organizations, apiHeaders])

  return (
    <AuthContext.Provider
      value={{
        user, profile, organization, organizations, session, loading,
        signUp, signIn, signOut, createOrg, joinOrg, switchOrg, refreshProfile,
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
