#!/usr/bin/env node
// Ingest scripts/accelerators/*.md as the ACCELERATOR CATALOG (Workpackage H2).
//
// Each accelerator source teaches the agents what a RevTech / Mach12 internal
// asset does, when to position it (and when NOT to), how it fits the SAP design,
// its integration points and SAP-side objects, the demo path, and the positioning
// against Deltek Costpoint / Cognitus / standalone Dassian.
//
// Unlike blueprints (all-stream), each accelerator is tagged to the workstreams it
// actually serves, read from its YAML frontmatter:
//   ---
//   workstreams: offer-to-cash, record-to-report
//   ---
// A missing or empty `workstreams:` line falls back to all streams (an accelerator
// like the Solution Architecture Studio genuinely serves every one).
//
// kb source: code `accelerator-<slug>`, kind `accelerator`.
// RE-RUNNABLE: drop/update a .md and re-run. Idempotent (upsert by code +
// re-chunk + re-embed voyage-3).
//   node scripts/import-accelerators.mjs
// Reads .env.local for KNOWLEDGE_SUPABASE_URL / _SERVICE_KEY / VOYAGE_API_KEY.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const APP_DIR = join(DIR, '..')
const ACCEL_DIR = join(DIR, 'accelerators')

for (const line of readFileSync(join(APP_DIR, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const URL = process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY
if (!URL || !KEY) { console.error('Missing KNOWLEDGE_SUPABASE_URL / KNOWLEDGE_SUPABASE_SERVICE_KEY'); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false } })
const VOYAGE_KEY = process.env.VOYAGE_API_KEY
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || 'voyage-3'

function chunkText(text) {
  const clean = (text || '').replace(/\r\n/g, '\n').trim()
  if (!clean) return []
  const TARGET = 3200, OVERLAP = 400
  const paras = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const out = []
  let buf = ''
  for (const para of paras) {
    if (buf && buf.length + para.length + 2 > TARGET) { out.push(buf); buf = buf.slice(Math.max(0, buf.length - OVERLAP)) + '\n\n' + para }
    else { buf = buf ? `${buf}\n\n${para}` : para }
    while (buf.length > TARGET * 1.5) { out.push(buf.slice(0, TARGET)); buf = buf.slice(TARGET - OVERLAP) }
  }
  if (buf.trim()) out.push(buf)
  return out.map((content, index) => ({ index, content, tokenCount: Math.ceil(content.length / 4) }))
}

async function embed(texts) {
  if (!VOYAGE_KEY || texts.length === 0) return null
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_KEY}` },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: 'document' }),
  })
  if (!res.ok) throw new Error(`Voyage failed: ${res.status} ${await res.text()}`)
  return (await res.json()).data.map((d) => d.embedding)
}

const frontmatter = (md) => {
  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fm) return {}
  const out = {}
  for (const line of fm[1].split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}
const titleOf = (md, fallback) => (md.match(/^#\s+(.+)$/m) || [])[1]?.trim() || fallback

async function main() {
  const { data: cat, error: catErr } = await db.from('kb_workstream_catalog').select('code').order('sort_order')
  if (catErr) throw new Error(`workstream catalog: ${catErr.message}`)
  const allCodes = (cat || []).map((c) => c.code)
  if (!allCodes.length) { console.error('No workstreams in kb_workstream_catalog. Run import-vibe-skills first.'); process.exit(1) }
  const valid = new Set(allCodes)

  const files = existsSync(ACCEL_DIR) ? readdirSync(ACCEL_DIR).filter((f) => f.endsWith('.md')) : []
  if (!files.length) { console.log('No accelerator .md files in scripts/accelerators/.'); return }

  let ok = 0
  for (const file of files) {
    const body = readFileSync(join(ACCEL_DIR, file), 'utf8').replace(/^﻿/, '')
    const slug = basename(file, '.md')
    const fm = frontmatter(body)
    const code = `accelerator-${slug}`
    const title = fm.name || titleOf(body, slug)
    const description = (fm.description || `RevTech accelerator: ${title}`).slice(0, 400)

    const declared = (fm.workstreams || '').split(',').map((s) => s.trim()).filter(Boolean)
    const unknown = declared.filter((c) => !valid.has(c))
    if (unknown.length) console.warn(`  note: ${file} lists unknown workstream(s) ${unknown.join(', ')}; ignoring them`)
    const codes = declared.filter((c) => valid.has(c))
    const workstreamCodes = codes.length ? codes : allCodes
    if (!codes.length) console.warn(`  note: ${file} declared no valid workstreams; tagging to all ${allCodes.length}`)

    const existing = await db.from('kb_sources').select('id').eq('code', code).is('tenant_key', null).maybeSingle()
    const row = {
      code, title, description,
      kind: 'accelerator', origin: 'diagram-app', tenant_key: null, workstream_codes: workstreamCodes,
      version: null, frontmatter: { ...fm, file, accelerator: slug }, body, source_app: 'mach12-diagram',
      updated_at: new Date().toISOString(),
    }
    let sourceId
    if (existing.data?.id) { sourceId = existing.data.id; await db.from('kb_sources').update(row).eq('id', sourceId) }
    else { const { data, error } = await db.from('kb_sources').insert(row).select('id').single(); if (error) throw new Error(error.message); sourceId = data.id }

    const chunks = chunkText(body)
    await db.from('kb_chunks').delete().eq('source_id', sourceId)
    let vectors = null
    try { vectors = await embed(chunks.map((c) => c.content)) } catch (e) { console.warn(`  embed failed for ${code}: ${e.message}`) }
    if (chunks.length) {
      const rows = chunks.map((c, i) => ({
        source_id: sourceId, tenant_key: null, workstream_codes: workstreamCodes,
        chunk_index: c.index, content: c.content, token_count: c.tokenCount,
        embedding: vectors ? `[${vectors[i].join(',')}]` : null,
      }))
      const { error } = await db.from('kb_chunks').insert(rows)
      if (error) throw new Error(`chunks insert ${code}: ${error.message}`)
    }
    ok++
    console.log(`✓ ${code} ("${title}") -> ${workstreamCodes.length} workstream(s), ${chunks.length} chunks ${vectors ? '(embedded)' : '(lexical)'}`)
  }
  console.log(`\nDone. ${ok}/${files.length} accelerator(s) synced. Embeddings:`, VOYAGE_KEY ? 'voyage-3' : 'DISABLED (set VOYAGE_API_KEY)')
}

main().catch((e) => { console.error(e); process.exit(1) })
