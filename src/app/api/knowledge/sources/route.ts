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
// tenantKey?, kind?, origin? }.
export async function POST(req: NextRequest) {
  try {
    const db = knowledgeAdmin()
    const b = await req.json()
    if (!b.code || !b.title || !b.body) {
      return NextResponse.json({ error: 'code, title, and body are required' }, { status: 400 })
    }
    const origin = b.origin === 'upload' ? 'upload' : 'diagram-app'
    const row = {
      code: b.code,
      title: b.title,
      description: b.description ?? null,
      kind: b.kind ?? 'customer-doc',
      origin,
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
    const existing = await db.from('kb_sources').select('id, origin')
      .eq('code', b.code)
      .is('tenant_key', b.tenantKey ?? null)
      .maybeSingle()

    let sourceId: string
    if (existing.data?.id) {
      // Never let an app-authored doc silently overwrite an imported baseline
      // skill (those are owned by the vibe-skills importer).
      if (existing.data.origin === 'solution-studio') {
        return NextResponse.json(
          { error: `Code "${b.code}" belongs to a baseline skill. Choose a different code.` },
          { status: 409 }
        )
      }
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

// DELETE ?id=<sourceId>: remove an app-authored source (chunks cascade).
// Baseline skills imported from Solution Studio are protected; re-running the
// importer is their lifecycle.
export async function DELETE(req: NextRequest) {
  try {
    const db = knowledgeAdmin()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { data: source, error } = await db.from('kb_sources').select('id, origin').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    if (source.origin === 'solution-studio') {
      return NextResponse.json({ error: 'Baseline skills cannot be deleted here.' }, { status: 403 })
    }

    const { error: delErr } = await db.from('kb_sources').delete().eq('id', id)
    if (delErr) throw new Error(delErr.message)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'delete failed' }, { status: 500 })
  }
}
