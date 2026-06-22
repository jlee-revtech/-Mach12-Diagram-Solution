import { NextRequest, NextResponse } from 'next/server'
import { knowledgeAdmin } from '@/lib/knowledge/sharedClient'
import { ingestSource } from '@/lib/knowledge/ingest'

// GET: list knowledge sources. Optional ?tenantKey= to include a tenant's docs
// alongside global baselines; ?workstream= to filter by workstream tag.
export async function GET(req: NextRequest) {
  try {
    const db = knowledgeAdmin()
    const url = new URL(req.url)
    const tenantKey = url.searchParams.get('tenantKey')
    const workstream = url.searchParams.get('workstream')

    let q = db.from('kb_sources').select('id, code, title, description, kind, origin, tenant_key, workstream_codes, version, updated_at')
    q = tenantKey ? q.or(`tenant_key.is.null,tenant_key.eq.${tenantKey}`) : q.is('tenant_key', null)
    if (workstream) q = q.contains('workstream_codes', [workstream])
    const { data, error } = await q.order('kind').order('title')
    if (error) throw new Error(error.message)
    return NextResponse.json({ sources: data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'list failed' }, { status: 500 })
  }
}

// POST: create or update a customer knowledge document, then ingest (chunk +
// embed) it. Body: { code, title, description?, body, workstreamCodes?,
// tenantKey?, kind? }.
export async function POST(req: NextRequest) {
  try {
    const db = knowledgeAdmin()
    const b = await req.json()
    if (!b.code || !b.title || !b.body) {
      return NextResponse.json({ error: 'code, title, and body are required' }, { status: 400 })
    }
    const row = {
      code: b.code,
      title: b.title,
      description: b.description ?? null,
      kind: b.kind ?? 'customer-doc',
      origin: 'diagram-app' as const,
      tenant_key: b.tenantKey ?? null,
      workstream_codes: b.workstreamCodes ?? [],
      version: b.version ?? null,
      frontmatter: b.frontmatter ?? null,
      body: b.body,
      source_app: 'mach12-diagram',
      updated_at: new Date().toISOString(),
    }
    // Upsert on (code, tenant_key). Two partial unique indexes back this; match
    // on the existing row when present, else insert.
    const existing = await db.from('kb_sources').select('id')
      .eq('code', b.code)
      .is('tenant_key', b.tenantKey ?? null)
      .maybeSingle()

    let sourceId: string
    if (existing.data?.id) {
      sourceId = existing.data.id
      const { error } = await db.from('kb_sources').update(row).eq('id', sourceId)
      if (error) throw new Error(error.message)
    } else {
      const { data, error } = await db.from('kb_sources').insert(row).select('id').single()
      if (error) throw new Error(error.message)
      sourceId = data.id
    }

    const ingest = await ingestSource(sourceId)
    return NextResponse.json({ id: sourceId, ...ingest })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'save failed' }, { status: 500 })
  }
}
