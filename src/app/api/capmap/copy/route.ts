import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { STANDARD_WORKSTREAMS } from '@/lib/workstream/catalog'
import { SYSTEM_TEMPLATES } from '@/lib/diagram/types'

// Copy the base capability library from one organization into another.
//
//   POST /api/capmap/copy   { sourceOrgId, targetOrgId | newOrgName, ... }
//
// Why this is a server route rather than two client calls: cm_capabilities RLS
// scopes on profiles.organization_id — the caller's *active* org — so a browser
// session can never hold both the source and the target org open at once. The
// route re-establishes the same guarantee explicitly: it resolves the caller
// from their JWT, checks org_members for BOTH orgs, and only then uses the
// service key to move rows. A caller who is not a member of both gets a 403.
//
// The copy is idempotent. Re-running it after the base library grows brings the
// new capabilities across and leaves every existing client row — and every scope
// decision made on it — untouched.

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY!

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

interface CapRow {
  id: string
  name: string
  description: string | null
  domain: string | null
  workstream_id: string | null
  color: string | null
  sort_order: number
}

// Dedup key: the same granular verb may legitimately appear under different
// capability groups or value streams, so all three take part.
const keyOf = (wsCode: string, domain: string | null, name: string) =>
  `${wsCode}|${(domain || '').trim().toLowerCase()}|${name.trim().toLowerCase()}`

async function isMember(db: SupabaseClient, userId: string, orgId: string): Promise<boolean> {
  const { data } = await db
    .from('org_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .maybeSingle()
  return !!data
}

export async function POST(req: NextRequest) {
  if (!SERVICE_KEY) return json({ error: 'Server is not configured for cross-org copy (missing service key).' }, 500)

  const auth = req.headers.get('authorization') || ''
  if (!auth) return json({ error: 'Not signed in.' }, 401)

  // Resolve the caller from their own token — never from the request body.
  const asUser = createClient(SUPA_URL, SUPA_ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData } = await asUser.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) return json({ error: 'Not signed in.' }, 401)

  const body = await req.json().catch(() => ({})) as {
    sourceOrgId?: string
    targetOrgId?: string
    newOrgName?: string
    includeLogicalSystems?: boolean
    includeMembers?: boolean
    dryRun?: boolean
  }
  const sourceOrgId = body.sourceOrgId
  const includeLogicalSystems = body.includeLogicalSystems !== false
  const includeMembers = body.includeMembers !== false
  const dryRun = !!body.dryRun
  if (!sourceOrgId) return json({ error: 'sourceOrgId is required.' }, 400)

  const db = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  if (!(await isMember(db, userId, sourceOrgId))) {
    return json({ error: 'You are not a member of the source organization.' }, 403)
  }

  // ─── Resolve (or create) the target org ───
  let targetOrgId = body.targetOrgId
  let targetOrgName = ''
  let createdOrg = false

  if (targetOrgId) {
    if (!(await isMember(db, userId, targetOrgId))) {
      return json({ error: 'You are not a member of the target organization.' }, 403)
    }
    const { data: org } = await db.from('organizations').select('id,name').eq('id', targetOrgId).maybeSingle()
    if (!org) return json({ error: 'Target organization not found.' }, 404)
    targetOrgName = org.name
  } else {
    const name = (body.newOrgName || '').trim()
    if (!name) return json({ error: 'Provide a targetOrgId or a newOrgName.' }, 400)
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!slug) return json({ error: 'That organization name has no usable slug.' }, 400)

    const { data: existing } = await db.from('organizations').select('id,name').eq('slug', slug).maybeSingle()
    if (existing) {
      targetOrgId = existing.id
      targetOrgName = existing.name
    } else {
      if (dryRun) {
        // Nothing is created on a preview — report what would happen instead.
        return json({
          dryRun: true, willCreateOrg: name, targetOrgName: name,
          ...(await previewCounts(db, sourceOrgId, null, includeLogicalSystems)),
          ...(await previewMembers(db, sourceOrgId, null, includeMembers)),
        })
      }
      const { data: created, error } = await db.from('organizations').insert({ name, slug }).select('id,name').single()
      if (error || !created) return json({ error: error?.message || 'Failed to create the organization.' }, 500)
      targetOrgId = created.id
      targetOrgName = created.name
      createdOrg = true
    }
    // Make the caller an admin of the target so the org switcher can reach it.
    await db.from('org_members')
      .upsert({ user_id: userId, organization_id: targetOrgId, role: createdOrg ? 'admin' : 'member' },
        { onConflict: 'user_id,organization_id' })
  }

  if (!targetOrgId) return json({ error: 'Could not resolve the target organization.' }, 500)
  if (targetOrgId === sourceOrgId) return json({ error: 'Source and target organizations are the same.' }, 400)

  if (dryRun) {
    return json({
      dryRun: true, targetOrgId, targetOrgName,
      ...(await previewCounts(db, sourceOrgId, targetOrgId, includeLogicalSystems)),
      ...(await previewMembers(db, sourceOrgId, targetOrgId, includeMembers)),
    })
  }

  // ─── Carry the source org's team across ───
  // Without this a client org is a solo org: nobody but the caller can switch
  // into it, so the copied capabilities are invisible to the rest of the team.
  // ignore-duplicates, never merge — merging on role would demote an existing
  // admin of the target org to 'member'.
  let membersAdded = 0
  if (includeMembers) {
    const { data: srcMembers } = await db
      .from('org_members').select('user_id').eq('organization_id', sourceOrgId)
    const { data: tgtMembers } = await db
      .from('org_members').select('user_id').eq('organization_id', targetOrgId)
    const already = new Set((tgtMembers || []).map(m => m.user_id as string))
    const rows = (srcMembers || [])
      .map(m => m.user_id as string)
      .filter(uid => !already.has(uid))
      .map(uid => ({ user_id: uid, organization_id: targetOrgId, role: 'member' }))
    if (rows.length) {
      const { error } = await db.from('org_members').insert(rows)
      if (!error) membersAdded = rows.length
    }
  }

  // ─── Source capabilities (live only — archived rows are the library's history) ───
  const { data: srcCapsRaw, error: capErr } = await db
    .from('cm_capabilities')
    .select('id,name,description,domain,workstream_id,color,sort_order')
    .eq('organization_id', sourceOrgId)
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (capErr) return json({ error: capErr.message }, 500)
  const srcCaps = (srcCapsRaw || []) as CapRow[]
  if (srcCaps.length === 0) return json({ error: 'The source organization has no capabilities to copy.' }, 400)

  // ─── Value streams: remap source workstream_id -> target id by canonical code ───
  const { data: srcWs } = await db.from('workstreams').select('id,code').eq('organization_id', sourceOrgId)
  const srcWsCode = new Map((srcWs || []).map(w => [w.id as string, w.code as string]))

  const neededCodes = new Set<string>()
  for (const c of srcCaps) {
    const code = c.workstream_id ? srcWsCode.get(c.workstream_id) : undefined
    if (code) neededCodes.add(code)
  }

  const { data: tgtWsExisting } = await db.from('workstreams').select('id,code').eq('organization_id', targetOrgId)
  const tgtWsByCode = new Map((tgtWsExisting || []).map(w => [w.code as string, w.id as string]))

  const missingWs = [...neededCodes].filter(code => !tgtWsByCode.has(code))
  let workstreamsSeeded = 0
  if (missingWs.length) {
    // Seed from the canonical catalog so the target org's streams carry the
    // standard name/colour/icon rather than a bare code copied across.
    const rows = missingWs.map(code => {
      const def = STANDARD_WORKSTREAMS.find(w => w.code === code)
      return {
        organization_id: targetOrgId, created_by: userId, code,
        name: def?.name || code, description: def?.description || null,
        color: def?.color || null, icon: def?.icon || null,
        sort_order: def?.sortOrder ?? 999, is_standard: !!def,
      }
    })
    const { data: seeded, error } = await db.from('workstreams').insert(rows).select('id,code')
    if (error) return json({ error: `Could not seed value streams in the target org: ${error.message}` }, 500)
    for (const w of seeded || []) tgtWsByCode.set(w.code as string, w.id as string)
    workstreamsSeeded = (seeded || []).length
  }

  // ─── Logical systems: remap by system_type ───
  const srcSysType = new Map<string, string>()
  const tgtSysByType = new Map<string, string>()
  let systemsSeeded = 0
  if (includeLogicalSystems) {
    const { data: srcSys } = await db.from('bedrock_systems').select('id,system_type').eq('organization_id', sourceOrgId)
    for (const s of srcSys || []) srcSysType.set(s.id as string, s.system_type as string)

    const { data: tgtSys } = await db.from('bedrock_systems').select('id,system_type').eq('organization_id', targetOrgId)
    for (const s of tgtSys || []) tgtSysByType.set(s.system_type as string, s.id as string)

    const missingSys = [...new Set(srcSysType.values())].filter(t => !tgtSysByType.has(t))
    if (missingSys.length) {
      const rows = missingSys.map(type => {
        const t = SYSTEM_TEMPLATES.find(x => x.type === type)
        const idx = SYSTEM_TEMPLATES.findIndex(x => x.type === type)
        return {
          organization_id: targetOrgId, created_by: userId, system_type: type,
          label: t?.label || type, description: t?.description || null,
          color: t?.color || null, sort_order: idx >= 0 ? idx : 999, is_standard: !!t,
        }
      })
      const { data: seeded, error } = await db.from('bedrock_systems').insert(rows).select('id,system_type')
      if (error) return json({ error: `Could not seed logical systems in the target org: ${error.message}` }, 500)
      for (const s of seeded || []) tgtSysByType.set(s.system_type as string, s.id as string)
      systemsSeeded = (seeded || []).length
    }
  }

  // ─── Skip anything already in the target (idempotent re-run) ───
  const { data: tgtCaps } = await db
    .from('cm_capabilities')
    .select('name,domain,workstream_id')
    .eq('organization_id', targetOrgId)
  const tgtWsCode = new Map([...tgtWsByCode.entries()].map(([code, id]) => [id, code]))
  const present = new Set(
    (tgtCaps || []).map(c => keyOf(
      c.workstream_id ? (tgtWsCode.get(c.workstream_id as string) || '') : '',
      c.domain as string | null,
      c.name as string,
    ))
  )

  const toCopy = srcCaps.filter(c => {
    const code = c.workstream_id ? (srcWsCode.get(c.workstream_id) || '') : ''
    return !present.has(keyOf(code, c.domain, c.name))
  })

  if (toCopy.length === 0) {
    return json({
      targetOrgId, targetOrgName, createdOrg,
      copied: 0, skipped: srcCaps.length, systemLinks: 0, workstreamsSeeded, systemsSeeded, membersAdded,
      message: `${targetOrgName} is already up to date with the base library.`,
    })
  }

  const copiedAt = new Date().toISOString()
  const rows = toCopy.map((c, i) => {
    const code = c.workstream_id ? srcWsCode.get(c.workstream_id) : undefined
    return {
      organization_id: targetOrgId,
      created_by: userId,
      name: c.name,
      description: c.description,
      domain: c.domain,
      workstream_id: code ? (tgtWsByCode.get(code) ?? null) : null,
      color: c.color,
      sort_order: i,
      source: 'copied',
      // Scope is deliberately left null: the client's assessment has to be made,
      // not inherited from the library.
      source_capability_id: c.id,
      source_organization_id: sourceOrgId,
      copied_at: copiedAt,
    }
  })

  // Insert in chunks — keeps the payload well inside limits as the library grows.
  const created: { id: string; source_capability_id: string }[] = []
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await db.from('cm_capabilities').insert(rows.slice(i, i + 200)).select('id,source_capability_id')
    if (error) return json({ error: `Copy failed after ${created.length} capabilities: ${error.message}` }, 500)
    created.push(...(data || []) as { id: string; source_capability_id: string }[])
  }

  // ─── Carry the logical system mappings ───
  let systemLinks = 0
  if (includeLogicalSystems && created.length) {
    const copiedIds = toCopy.map(c => c.id)
    const srcLinks: { capability_id: string; bedrock_system_id: string | null }[] = []
    for (let i = 0; i < copiedIds.length; i += 200) {
      const { data } = await db
        .from('cm_capability_systems')
        .select('capability_id,bedrock_system_id')
        .eq('organization_id', sourceOrgId)
        .not('bedrock_system_id', 'is', null)
        .in('capability_id', copiedIds.slice(i, i + 200))
      srcLinks.push(...(data || []) as { capability_id: string; bedrock_system_id: string | null }[])
    }

    const newIdBySource = new Map(created.map(c => [c.source_capability_id, c.id]))
    const linkRows: Record<string, unknown>[] = []
    const seen = new Set<string>()
    for (const l of srcLinks) {
      const newCapId = newIdBySource.get(l.capability_id)
      const type = l.bedrock_system_id ? srcSysType.get(l.bedrock_system_id) : undefined
      const newSysId = type ? tgtSysByType.get(type) : undefined
      if (!newCapId || !newSysId) continue
      const k = `${newCapId}|${newSysId}`
      if (seen.has(k)) continue        // the unique index would reject a dupe anyway
      seen.add(k)
      linkRows.push({ organization_id: targetOrgId, created_by: userId, capability_id: newCapId, bedrock_system_id: newSysId })
    }
    for (let i = 0; i < linkRows.length; i += 500) {
      const chunk = linkRows.slice(i, i + 500)
      const { error } = await db.from('cm_capability_systems').insert(chunk)
      if (!error) systemLinks += chunk.length
    }
  }

  return json({
    targetOrgId, targetOrgName, createdOrg,
    copied: created.length,
    skipped: srcCaps.length - toCopy.length,
    systemLinks, workstreamsSeeded, systemsSeeded, membersAdded,
  })
}

// How many of the source org's members do not yet have access to the target.
async function previewMembers(db: SupabaseClient, sourceOrgId: string, targetOrgId: string | null, includeMembers: boolean) {
  if (!includeMembers) return { willAddMembers: 0 }
  const { data: srcMembers } = await db.from('org_members').select('user_id').eq('organization_id', sourceOrgId)
  if (!targetOrgId) return { willAddMembers: (srcMembers || []).length }
  const { data: tgtMembers } = await db.from('org_members').select('user_id').eq('organization_id', targetOrgId)
  const already = new Set((tgtMembers || []).map(m => m.user_id as string))
  return { willAddMembers: (srcMembers || []).filter(m => !already.has(m.user_id as string)).length }
}

// What a copy would do, without writing anything.
async function previewCounts(db: SupabaseClient, sourceOrgId: string, targetOrgId: string | null, includeLogicalSystems: boolean) {
  const { data: srcCaps } = await db
    .from('cm_capabilities')
    .select('id,name,domain,workstream_id')
    .eq('organization_id', sourceOrgId)
    .is('archived_at', null)
  const caps = (srcCaps || []) as { id: string; name: string; domain: string | null; workstream_id: string | null }[]

  const { data: srcWs } = await db.from('workstreams').select('id,code').eq('organization_id', sourceOrgId)
  const srcWsCode = new Map((srcWs || []).map(w => [w.id as string, w.code as string]))

  let present = new Set<string>()
  if (targetOrgId) {
    const { data: tgtWs } = await db.from('workstreams').select('id,code').eq('organization_id', targetOrgId)
    const tgtWsCode = new Map((tgtWs || []).map(w => [w.id as string, w.code as string]))
    const { data: tgtCaps } = await db.from('cm_capabilities').select('name,domain,workstream_id').eq('organization_id', targetOrgId)
    present = new Set((tgtCaps || []).map(c => keyOf(
      c.workstream_id ? (tgtWsCode.get(c.workstream_id as string) || '') : '',
      c.domain as string | null, c.name as string,
    )))
  }

  const willCopy = caps.filter(c => !present.has(keyOf(
    c.workstream_id ? (srcWsCode.get(c.workstream_id) || '') : '', c.domain, c.name,
  )))

  let systemLinks = 0
  if (includeLogicalSystems && willCopy.length) {
    const ids = willCopy.map(c => c.id)
    for (let i = 0; i < ids.length; i += 200) {
      const { count } = await db
        .from('cm_capability_systems')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', sourceOrgId)
        .not('bedrock_system_id', 'is', null)
        .in('capability_id', ids.slice(i, i + 200))
      systemLinks += count || 0
    }
  }

  return { sourceTotal: caps.length, willCopy: willCopy.length, willSkip: caps.length - willCopy.length, systemLinks }
}
