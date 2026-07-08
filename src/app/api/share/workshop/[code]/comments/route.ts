import { NextRequest } from 'next/server'
import { serverModelDb } from '@/lib/workshop/server'

// Public, code-gated comments on a shared workshop prep. Reviewers do not sign in:
// the share code (workshops.settings.share, enabled) is the capability. Both
// handlers resolve the code with the service key, so no anon RLS is involved.
//   GET  -> every comment on the workshop, oldest first
//   POST -> add one comment anchored to an entity/bullet (anchorKey)

type Row = Record<string, unknown>

const MAX_BODY = 2000
const MAX_NAME = 60
const MAX_ANCHOR = 200
const MAX_LABEL = 400

// Resolve the workshop id for an enabled share code, or null.
async function workshopIdForCode(db: ReturnType<typeof serverModelDb>, code: string): Promise<string | null> {
  const { data } = await db
    .from('workshops')
    .select('id, settings')
    .filter('settings->share->>code', 'eq', code)
    .limit(1)
  const ws = (data || [])[0] as Row | undefined
  const share = (ws?.settings as { share?: { enabled?: boolean } } | undefined)?.share
  return ws && share?.enabled ? (ws.id as string) : null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    if (!code) return json({ error: 'Missing code' }, 400)
    const db = serverModelDb()
    const workshopId = await workshopIdForCode(db, code)
    if (!workshopId) return json({ error: 'This share link is not available.' }, 404)

    const { data } = await db
      .from('workshop_comments')
      .select('id, anchor_key, anchor_label, author_name, body, created_at')
      .eq('workshop_id', workshopId)
      .order('created_at', { ascending: true })
    return json({ comments: data || [] }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    if (!code) return json({ error: 'Missing code' }, 400)
    const { anchorKey, anchorLabel, authorName, body } = (await req.json()) as {
      anchorKey?: string; anchorLabel?: string; authorName?: string; body?: string
    }
    const text = (body ?? '').trim()
    const anchor = (anchorKey ?? '').trim()
    if (!anchor) return json({ error: 'anchorKey is required' }, 400)
    if (!text) return json({ error: 'A comment is required' }, 400)
    if (text.length > MAX_BODY) return json({ error: `Comment is too long (max ${MAX_BODY} characters).` }, 400)
    if (anchor.length > MAX_ANCHOR) return json({ error: 'anchorKey is too long' }, 400)

    const db = serverModelDb()
    const workshopId = await workshopIdForCode(db, code)
    if (!workshopId) return json({ error: 'This share link is not available.' }, 404)

    const { data, error } = await db
      .from('workshop_comments')
      .insert({
        workshop_id: workshopId,
        anchor_key: anchor,
        anchor_label: (anchorLabel ?? '').trim().slice(0, MAX_LABEL) || null,
        author_name: ((authorName ?? '').trim() || 'Guest').slice(0, MAX_NAME),
        body: text,
      })
      .select('id, anchor_key, anchor_label, author_name, body, created_at')
      .single()
    if (error) return json({ error: error.message }, 500)

    return json({ comment: data }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
