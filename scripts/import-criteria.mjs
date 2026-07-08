#!/usr/bin/env node
// Ingest scripts/criteria/<workstream-code>.json into `kb_criteria`: the RevTech
// S/4HANA template as machine-checkable criteria (Workpackage H1).
//
// A criterion is one testable assertion about what a conforming RevTech design
// looks like, plus the evidence needed to verify it:
//   sap_query  -> a natural-language introspection request against live SAP config
//   sas_query  -> a read of the customer's architecture model (processes, personas,
//                 systems, data, integrations, ricefw, overview)
//   manual     -> a question to ask the client
//
// This is RevTech IP. It powers agent-core's `check_template_conformance` tool,
// which turns a fit-gap assessment from an opinion into a scored, evidenced report.
//
// Criteria go in as `status = active`, `tenant_key = null` (the global template).
// Tenant overlays are inserted by the app, not by this script.
//
// RE-RUNNABLE: upsert by (code) for global rows. Editing a criterion and re-running
// updates it in place; nothing is orphaned. Criteria REMOVED from a file are NOT
// deleted (a criterion someone has already assessed against should be archived, not
// vanished): pass --archive-missing to set status='archived' on those instead.
//   node scripts/import-criteria.mjs [--archive-missing]
// Reads .env.local for KNOWLEDGE_SUPABASE_URL / _SERVICE_KEY.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const APP_DIR = join(DIR, '..')
const CRITERIA_DIR = join(DIR, 'criteria')
const ARCHIVE_MISSING = process.argv.includes('--archive-missing')

for (const line of readFileSync(join(APP_DIR, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const URL = process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY
if (!URL || !KEY) { console.error('Missing KNOWLEDGE_SUPABASE_URL / KNOWLEDGE_SUPABASE_SERVICE_KEY'); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false } })

const PILLARS = new Set(['People', 'Process', 'Data', 'Technology'])
const SEVERITIES = new Set(['must', 'should', 'may'])
const HOWS = new Set(['sap_query', 'sas_query', 'manual'])
const SAS_ENTITIES = new Set(['overview', 'processes', 'personas', 'systems', 'data', 'integrations', 'ricefw'])
const DASH = /[‐-―−]/

/** Validate one criterion. Returns an error string, or null when valid. */
function validate(c, file) {
  if (!c.code || typeof c.code !== 'string') return 'missing code'
  if (!c.workstream_code) return `${c.code}: missing workstream_code`
  if (c.workstream_code !== basename(file, '.json')) return `${c.code}: workstream_code does not match the file name`
  if (!c.statement) return `${c.code}: missing statement`
  if (c.pillar && !PILLARS.has(c.pillar)) return `${c.code}: bad pillar "${c.pillar}"`
  if (!SEVERITIES.has(c.severity)) return `${c.code}: bad severity "${c.severity}"`
  const ev = c.evidence
  if (!ev || !HOWS.has(ev.how)) return `${c.code}: evidence.how must be sap_query | sas_query | manual`
  if (ev.how === 'sap_query' && (!ev.query || !ev.expect)) return `${c.code}: sap_query needs query + expect`
  if (ev.how === 'sas_query' && (!SAS_ENTITIES.has(ev.entity) || !ev.expect)) return `${c.code}: sas_query needs a valid entity + expect`
  if (ev.how === 'manual' && (!ev.question || !ev.expect)) return `${c.code}: manual needs question + expect`
  // House rule: no em-dashes or en-dashes anywhere in kb content.
  const text = [c.statement, c.rationale, ev.query, ev.question, ev.expect].filter(Boolean).join(' ')
  if (DASH.test(text)) return `${c.code}: contains an em-dash or en-dash`
  return null
}

async function main() {
  const files = existsSync(CRITERIA_DIR) ? readdirSync(CRITERIA_DIR).filter((f) => f.endsWith('.json')) : []
  if (!files.length) { console.log('No criteria .json files in scripts/criteria/.'); return }

  const { data: cat } = await db.from('kb_workstream_catalog').select('code')
  const valid = new Set((cat || []).map((c) => c.code))

  const all = []
  const errors = []
  for (const file of files) {
    const stream = basename(file, '.json')
    if (valid.size && !valid.has(stream)) { errors.push(`${file}: "${stream}" is not a canonical workstream`); continue }
    let rows
    try { rows = JSON.parse(readFileSync(join(CRITERIA_DIR, file), 'utf8').replace(/^﻿/, '')) }
    catch (e) { errors.push(`${file}: bad JSON (${e.message})`); continue }
    if (!Array.isArray(rows)) { errors.push(`${file}: expected a JSON array`); continue }
    for (const c of rows) {
      const err = validate(c, file)
      if (err) errors.push(`${file}: ${err}`)
      else all.push(c)
    }
  }

  const seen = new Map()
  for (const c of all) {
    if (seen.has(c.code)) errors.push(`duplicate criterion code "${c.code}"`)
    seen.set(c.code, c)
  }

  if (errors.length) {
    console.error(`\n✗ ${errors.length} validation error(s). Nothing was written:\n`)
    for (const e of errors.slice(0, 40)) console.error(`  ${e}`)
    process.exit(1)
  }

  // Write the global template rows. The uniqueness on (code) is a PARTIAL index
  // (`where tenant_key is null`), which PostgREST cannot use for ON CONFLICT, so
  // this is an explicit read-then-insert-or-update rather than an upsert.
  const now = new Date().toISOString()
  const rowOf = (c) => ({
    code: c.code,
    workstream_code: c.workstream_code,
    pillar: c.pillar ?? null,
    statement: c.statement,
    rationale: c.rationale ?? null,
    evidence: c.evidence,
    severity: c.severity,
    source_ref: c.source_ref ?? null,
    version: c.version ?? null,
    status: 'active',
    tenant_key: null,
    updated_at: now,
  })

  const { data: existingRows, error: readErr } = await db.from('kb_criteria').select('id, code').is('tenant_key', null)
  if (readErr) throw new Error(`kb_criteria read: ${readErr.message}`)
  const existingByCode = new Map((existingRows || []).map((r) => [r.code, r.id]))

  const toInsert = all.filter((c) => !existingByCode.has(c.code)).map(rowOf)
  const toUpdate = all.filter((c) => existingByCode.has(c.code))

  if (toInsert.length) {
    const { error } = await db.from('kb_criteria').insert(toInsert)
    if (error) throw new Error(`kb_criteria insert: ${error.message}`)
  }
  for (const c of toUpdate) {
    const { error } = await db.from('kb_criteria').update(rowOf(c)).eq('id', existingByCode.get(c.code))
    if (error) throw new Error(`kb_criteria update ${c.code}: ${error.message}`)
  }
  console.log(`  ${toInsert.length} inserted, ${toUpdate.length} updated`)

  if (ARCHIVE_MISSING) {
    const codes = [...seen.keys()]
    const streams = [...new Set(all.map((c) => c.workstream_code))]
    const { data: stale } = await db
      .from('kb_criteria')
      .select('code')
      .is('tenant_key', null)
      .eq('status', 'active')
      .in('workstream_code', streams)
    const toArchive = (stale || []).map((r) => r.code).filter((c) => !codes.includes(c))
    if (toArchive.length) {
      await db.from('kb_criteria').update({ status: 'archived', updated_at: now }).is('tenant_key', null).in('code', toArchive)
      console.log(`  archived ${toArchive.length} criterion(s) no longer present in the files: ${toArchive.join(', ')}`)
    }
  }

  const byStream = {}
  const bySeverity = {}
  const byHow = {}
  for (const c of all) {
    byStream[c.workstream_code] = (byStream[c.workstream_code] || 0) + 1
    bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1
    byHow[c.evidence.how] = (byHow[c.evidence.how] || 0) + 1
  }
  for (const [s, n] of Object.entries(byStream)) console.log(`✓ ${s}: ${n} criteria`)
  console.log(`\nDone. ${all.length} RevTech template criteria active.`)
  console.log(`  severity: ${Object.entries(bySeverity).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  console.log(`  evidence: ${Object.entries(byHow).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  if (!ARCHIVE_MISSING) console.log('  (pass --archive-missing to archive criteria removed from the files)')
}

main().catch((e) => { console.error(e); process.exit(1) })
