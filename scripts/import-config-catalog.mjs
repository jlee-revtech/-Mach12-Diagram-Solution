#!/usr/bin/env node
// Import the SAP Solution Studio Agent Configurator catalog (per-agent config-step
// checklists + standalone activities) into the shared Knowledge Repository as
// global "config-capability" sources, one per agent, tagged by canonical
// workstream. This is the SAP-configuration half of the Super Consultant brain:
// after this runs, a workstream consultant agent's RAG retrieves not just the
// prose vibe-skills but the actual SAP objects / tcodes / activities Solution
// Studio knows how to deliver for that value stream.
//
// Reads cds-lineage-explorer/public/agent-config-catalog.json (produced by
// `npx tsx scripts/export-agent-catalog.ts` in that repo).
// Idempotent: upserts kb_sources by code and re-chunks.
//
// Usage (from diagram-app/):  node scripts/import-config-catalog.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_DIR = join(__dirname, '..')
const CATALOG = join(APP_DIR, '..', '..', 'cds-lineage-explorer', 'public', 'agent-config-catalog.json')

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
if (!URL || !KEY) { console.error('Missing KNOWLEDGE_SUPABASE_URL / KNOWLEDGE_SUPABASE_SERVICE_KEY'); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false } })

const VOYAGE_KEY = process.env.VOYAGE_API_KEY
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || 'voyage-3'

// ─── Chunker (mirrors scripts/import-vibe-skills.mjs) ──
function chunkText(text) {
  const clean = (text || '').replace(/\r\n/g, '\n').trim()
  if (!clean) return []
  const TARGET = 3200, OVERLAP = 400
  const paras = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const out = []
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

// ─── Render one agent's config knowledge as a markdown body ─
function renderAgentBody(a) {
  const L = []
  L.push(`# ${a.shortName} — SAP + Dassian configuration capabilities`)
  L.push('')
  L.push(`Canonical workstream: ${a.code}`)
  L.push(`Readiness: ${a.readiness}`)
  if (a.tagline) L.push(`Focus: ${a.tagline}`)
  if (a.description) { L.push(''); L.push(a.description) }
  L.push('')
  L.push(`SAP modules: ${a.sapModules.length ? a.sapModules.join(', ') : 'none'}`)
  L.push(`Dassian A&D modules: ${a.dassianModules.length ? a.dassianModules.join(', ') : 'none'}`)
  if (a.dependsOn?.length) L.push(`Depends on (configure first): ${a.dependsOn.join(', ')}`)

  if (a.steps?.length) {
    L.push('')
    L.push('## Standard configuration checklist')
    for (const s of a.steps) {
      L.push('')
      L.push(`### ${s.title}`)
      const meta = [`area ${s.area}`, `object ${s.object}`]
      if (s.txn) meta.push(`tcode ${s.txn}`)
      meta.push(`type ${s.objectType}`, `risk ${s.risk}`, `source ${s.source}`)
      L.push(`(${meta.join(' | ')})`)
      L.push(s.detail)
    }
  }

  if (a.activities?.length) {
    L.push('')
    L.push('## Standalone activities (guided, runnable)')
    for (const act of a.activities) {
      L.push('')
      L.push(`### ${act.name}`)
      const meta = [`category ${act.category}`, `area ${act.area}`, `object ${act.object}`]
      if (act.txn) meta.push(`tcode ${act.txn}`)
      meta.push(`risk ${act.risk}`, `source ${act.source}`)
      L.push(`(${meta.join(' | ')})`)
      L.push(act.summary)
      if (act.inputs?.length) L.push(`Inputs: ${act.inputs.map((i) => i.label).join('; ')}`)
    }
  }
  return L.join('\n')
}

async function main() {
  if (!existsSync(CATALOG)) {
    console.error(`Catalog not found: ${CATALOG}\nRun \`npx tsx scripts/export-agent-catalog.ts\` in cds-lineage-explorer first.`)
    process.exit(1)
  }
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
  console.log(`catalog: ${catalog.agents.length} agents (Solution Studio v${catalog.version})`)

  for (const a of catalog.agents) {
    const code = `config-${a.code}`
    const body = renderAgentBody(a)
    const description = `SAP S/4HANA + Dassian configuration capabilities for the ${a.shortName} value stream (${a.steps.length} config steps, ${a.activities.length} activities).`.slice(0, 400)

    const existing = await db.from('kb_sources').select('id').eq('code', code).is('tenant_key', null).maybeSingle()
    const row = {
      code, title: `${a.shortName} — SAP Configuration`, description,
      kind: 'config-capability', origin: 'solution-studio', tenant_key: null,
      workstream_codes: [a.code], version: catalog.version || null,
      frontmatter: { agentCode: a.code, readiness: a.readiness, sapModules: a.sapModules, dassianModules: a.dassianModules, stepCount: a.steps.length, activityCount: a.activities.length },
      body, source_app: 'cds-lineage-explorer', updated_at: new Date().toISOString(),
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
        source_id: sourceId, tenant_key: null, workstream_codes: [a.code],
        chunk_index: c.index, content: c.content, token_count: c.tokenCount,
        embedding: vectors ? `[${vectors[i].join(',')}]` : null,
      }))
      const { error } = await db.from('kb_chunks').insert(rows)
      if (error) throw new Error(`chunks insert ${code}: ${error.message}`)
    }
    console.log(`✓ ${code} -> ws[${a.code}] ${a.steps.length}st/${a.activities.length}ac ${chunks.length} chunks ${vectors ? '(embedded)' : '(lexical)'}`)
  }

  console.log('\nDone. Embeddings:', VOYAGE_KEY ? 'voyage-3' : 'DISABLED (set VOYAGE_API_KEY then re-run for semantic RAG)')
}

main().catch((e) => { console.error(e); process.exit(1) })
