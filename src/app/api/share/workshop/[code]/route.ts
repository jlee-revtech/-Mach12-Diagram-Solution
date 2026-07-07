import { NextRequest } from 'next/server'
import { serverModelDb } from '@/lib/workshop/server'

// Public, read-only fetch of a workshop's PREP by share code. The code lives in
// workshops.settings.share ({ code, enabled }); this route uses the service key
// server-side and returns only the code's workshop when the share is enabled, so
// there is no auth and no RLS to maintain. Read-only: brief + agenda + section
// content, nothing writable and nothing sensitive (facilitation prompt, etc.).

type Row = Record<string, unknown>

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    if (!code) return json({ error: 'Missing code' }, 400)
    const db = serverModelDb()

    const { data: rows } = await db
      .from('workshops')
      .select('id, title, topic, objective, customer_name, duration_minutes, status, brief, settings')
      .filter('settings->share->>code', 'eq', code)
      .limit(1)
    const ws = (rows || [])[0] as Row | undefined
    const share = (ws?.settings as { share?: { enabled?: boolean } } | undefined)?.share
    if (!ws || !share?.enabled) return json({ error: 'This share link is not available.' }, 404)

    const [{ data: agenda }, { data: content }] = await Promise.all([
      db.from('workshop_agenda_items').select('id, title, objective, section_kind, workstream_code, timebox_minutes, sort_order').eq('workshop_id', ws.id).order('sort_order', { ascending: true }),
      db.from('workshop_agenda_content').select('agenda_item_id, section_kind, content, status').eq('workshop_id', ws.id),
    ])

    return json({
      workshop: {
        id: ws.id,
        title: ws.title,
        topic: ws.topic,
        objective: ws.objective,
        customer_name: ws.customer_name,
        duration_minutes: ws.duration_minutes,
        status: ws.status,
        brief: ws.brief ?? null,
      },
      agenda: agenda || [],
      content: content || [],
    }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
