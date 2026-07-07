import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Restore a workstream-agent conversation. Returns the most recent thread for an
// (org, agent) pair plus its messages in order, so the chat panel rehydrates the
// last conversation instead of starting empty on every open. RLS (the caller's
// auth header) scopes reads to the user's org; there is no service-role bypass.

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId')
  const agentCode = url.searchParams.get('agentCode')
  if (!orgId || !agentCode) return json({ error: 'orgId and agentCode are required' }, 400)

  const auth = req.headers.get('authorization') || ''
  const userDb = createClient(SUPA_URL, SUPA_ANON, {
    global: { headers: auth ? { Authorization: auth } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: thread } = await userDb
    .from('agent_threads')
    .select('id, title, updated_at')
    .eq('organization_id', orgId)
    .eq('agent_code', agentCode)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!thread) return json({ thread: null, messages: [] }, 200)

  const { data: messages } = await userDb
    .from('agent_messages')
    .select('role, content, created_at')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })

  return json({ thread, messages: messages ?? [] }, 200)
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
