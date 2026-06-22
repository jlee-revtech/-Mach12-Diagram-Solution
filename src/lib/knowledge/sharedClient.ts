import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-only admin client for the shared Knowledge Repository. Uses the
// service-role key, so it must never be imported into client components.
// Defaults to the diagram app's own project; point KNOWLEDGE_SUPABASE_* at a
// dedicated project to relocate the repo without code changes.
let client: SupabaseClient | null = null

export function knowledgeAdmin(): SupabaseClient {
  if (client) return client
  const url = process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('Knowledge repository is not configured (KNOWLEDGE_SUPABASE_URL / KNOWLEDGE_SUPABASE_SERVICE_KEY).')
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}
