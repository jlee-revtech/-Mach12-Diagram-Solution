// Sync the Solution Architecture Studio value-stream CAPABILITY model into the
// shared Knowledge Repository so the workstream agents are "trained" on it. One
// `capabilities-<workstream>` source per stream (the L2 capability groups + their
// L3 sub-capabilities from src/lib/capmap/standardCapabilities.ts), tagged by the
// canonical workstream code, chunked + embedded (voyage-3).
//
// RE-RUNNABLE: run this whenever you update the capability catalog (or the
// workstream catalog) in Solution Architecture Studio and the agents pick up the
// change on their next knowledge search. Idempotent (upsert by code + re-chunk).
//
//   node scripts/import-capabilities.ts        (Node 24+ runs .ts natively)
//
// Reads .env.local for KNOWLEDGE_SUPABASE_URL / _SERVICE_KEY / VOYAGE_API_KEY.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STANDARD_CAPABILITIES } from '../src/lib/capmap/standardCapabilities.ts'
import { STANDARD_WORKSTREAMS } from '../src/lib/workstream/catalog.ts'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const p = join(APP_DIR, '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
loadEnv()

const URL = process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY
if (!URL || !KEY) {
  console.error('Missing KNOWLEDGE_SUPABASE_URL / KNOWLEDGE_SUPABASE_SERVICE_KEY')
  process.exit(1)
}
const db = createClient(URL, KEY, { auth: { persistSession: false } })
const VOYAGE_KEY = process.env.VOYAGE_API_KEY
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || 'voyage-3'

function chunkText(text: string) {
  const clean = (text || '').replace(/\r\n/g, '\n').trim()
  if (!clean) return [] as { index: number; content: string; tokenCount: number }[]
  const TARGET = 3200, OVERLAP = 400
  const paras = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const out: string[] = []
  let buf = ''
  for (const para of paras) {
    if (buf && buf.length + para.length + 2 > TARGET) {
      out.push(buf)
      buf = buf.slice(Math.max(0, buf.length - OVERLAP)) + '\n\n' + para
    } else {
      buf = buf ? `${buf}\n\n${para}` : para
    }
    while (buf.length > TARGET * 1.5) { out.push(buf.slice(0, TARGET)); buf = buf.slice(TARGET - OVERLAP) }
  }
  if (buf.trim()) out.push(buf)
  return out.map((content, index) => ({ index, content, tokenCount: Math.ceil(content.length / 4) }))
}

async function embed(texts: string[]): Promise<number[][] | null> {
  if (!VOYAGE_KEY || texts.length === 0) return null
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_KEY}` },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: 'document' }),
  })
  if (!res.ok) throw new Error(`Voyage failed: ${res.status} ${await res.text()}`)
  return (await res.json()).data.map((d: { embedding: number[] }) => d.embedding)
}

function renderBody(name: string, code: string, groups: { name: string; description?: string; children: { name: string; description?: string }[] }[]) {
  const L: string[] = []
  L.push(`# ${name} — Value-Stream Capabilities`)
  L.push('')
  L.push(`Workstream: ${code}. The Aerospace & Defense best-practice capability model for this value stream: L2 capability groups and their L3 sub-capabilities.`)
  for (const g of groups) {
    L.push('')
    L.push(`## ${g.name}`)
    if (g.description) L.push(g.description)
    for (const c of g.children) L.push(`- ${c.name}${c.description ? `: ${c.description}` : ''}`)
  }
  return L.join('\n')
}

async function main() {
  let sources = 0
  for (const w of STANDARD_WORKSTREAMS) {
    const groups = (STANDARD_CAPABILITIES as Record<string, { name: string; description?: string; children: { name: string; description?: string }[] }[]>)[w.code]
    if (!groups || !groups.length) continue
    const subCount = groups.reduce((n, g) => n + g.children.length, 0)
    const code = `capabilities-${w.code}`
    const body = renderBody(w.name, w.code, groups)
    const description = `A&D best-practice capability model (${groups.length} groups, ${subCount} sub-capabilities) for the ${w.name} value stream.`.slice(0, 400)

    const existing = await db.from('kb_sources').select('id').eq('code', code).is('tenant_key', null).maybeSingle()
    const row = {
      code, title: `${w.name} — Value-Stream Capabilities`, description,
      kind: 'capability', origin: 'diagram-app', tenant_key: null,
      workstream_codes: [w.code], version: null,
      frontmatter: { groupCount: groups.length, subCapabilityCount: subCount },
      body, source_app: 'mach12-diagram', updated_at: new Date().toISOString(),
    }
    let sourceId: string
    if (existing.data?.id) { sourceId = existing.data.id; await db.from('kb_sources').update(row).eq('id', sourceId) }
    else { const { data, error } = await db.from('kb_sources').insert(row).select('id').single(); if (error) throw new Error(error.message); sourceId = data.id }

    const chunks = chunkText(body)
    await db.from('kb_chunks').delete().eq('source_id', sourceId)
    let vectors: number[][] | null = null
    try { vectors = await embed(chunks.map((c) => c.content)) } catch (e) { console.warn(`  embed failed for ${code}: ${(e as Error).message}`) }
    if (chunks.length) {
      const rows = chunks.map((c, i) => ({
        source_id: sourceId, tenant_key: null, workstream_codes: [w.code],
        chunk_index: c.index, content: c.content, token_count: c.tokenCount,
        embedding: vectors ? `[${vectors[i].join(',')}]` : null,
      }))
      const { error } = await db.from('kb_chunks').insert(rows)
      if (error) throw new Error(`chunks insert ${code}: ${error.message}`)
    }
    sources++
    console.log(`✓ ${code} -> ws[${w.code}] ${groups.length}grp/${subCount}sub ${chunks.length} chunks ${vectors ? '(embedded)' : '(lexical)'}`)
  }
  console.log(`\nDone. ${sources} capability sources synced. Embeddings:`, VOYAGE_KEY ? 'voyage-3' : 'DISABLED (set VOYAGE_API_KEY)')
}

main().catch((e) => { console.error(e); process.exit(1) })
