// Apply the Process Studio reference library (from seed-reference.mjs) to Supabase
// via the service-role client — a re-runnable alternative to piping the generated
// SQL through the Management API. Full replace: delete the library (cascades to
// scenarios + overlays) then re-insert. Run after editing seed-reference.mjs:
//   node scripts/seed-reference.mjs && node scripts/apply-reference-seed.mjs
// Reads .env.local for KNOWLEDGE_SUPABASE_URL / _SERVICE_KEY.

import { buildSql, LIB, libId } from './seed-reference.mjs'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const APP_DIR = join(DIR, '..')
for (const line of readFileSync(join(APP_DIR, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const URL = process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY
if (!URL || !KEY) { console.error('Missing KNOWLEDGE_SUPABASE_URL / KNOWLEDGE_SUPABASE_SERVICE_KEY'); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false } })

let graphs = {}
const cache = join(DIR, 'reference-graphs.json')
if (existsSync(cache)) { try { graphs = JSON.parse(readFileSync(cache, 'utf8')) } catch { /* no cache */ } }

const { scenarioRows, overlayRows } = buildSql(graphs)

const scen = scenarioRows.map((r) => ({
  id: r.id, library_id: libId, parent_id: r.parent || null, level: r.level, node_kind: r.kind,
  name: r.name, description: r.desc ?? null, scope_item_ref: r.scope ?? null, sort_order: r.sort,
  lifecycle: r.lifecycle ?? null, variant_label: r.variant ?? null, graph_data: r.graph ?? null,
}))
const ov = overlayRows.map((o) => ({
  id: o.id, reference_scenario_id: o.scenario, overlay_kind: o.kind, payload: o.payload, sort_order: o.sort,
}))

async function insertChunks(table, rows, size = 100) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).insert(rows.slice(i, i + size))
    if (error) throw new Error(`${table}@${i}: ${error.message}`)
  }
}

async function main() {
  const del = await db.from('process_reference_libraries').delete().eq('code', LIB.code)
  if (del.error) throw new Error(`delete library: ${del.error.message}`)
  const lib = await db.from('process_reference_libraries').insert({
    id: libId, code: LIB.code, title: LIB.title, version: LIB.version, source: LIB.source, is_active: true,
  })
  if (lib.error) throw new Error(`insert library: ${lib.error.message}`)
  await insertChunks('process_reference_scenarios', scen)
  await insertChunks('process_reference_overlays', ov)
  const byLevel = scen.reduce((m, r) => ((m[r.level] = (m[r.level] || 0) + 1), m), {})
  console.log(`Applied ${LIB.code} v${LIB.version}: ${scen.length} scenarios (by level ${JSON.stringify(byLevel)}), ${ov.length} overlays.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
