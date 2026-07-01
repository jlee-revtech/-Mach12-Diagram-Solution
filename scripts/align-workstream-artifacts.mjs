#!/usr/bin/env node
// Align the org's process models (and capability maps) to their value-stream
// workstreams so the Workstreams overview / agent cards show real content, and
// so each consultant agent + workshop has its best-practice process to work with.
//
// What it does (idempotent / re-runnable):
//   1. Links each of the 10 value-stream workstreams to its best-practice
//      reference L1 scenario (workstreams.source_reference_scenario_id).
//   2. Homes existing, non-archived process models to their workstream by title
//      (record-to-report, plan-to-produce, source-to-pay, bid-to-win->offer-to-cash).
//   3. Instantiates the reference L1 subtree for any value-stream workstream that
//      still has no homed process model (copy-on-instantiate, homed to the ws).
//   4. Best-effort homes capability maps by title.
//
// Node/capability/persona-level workstream_id inherits from the parent model/map
// in the UI, so homing the MODEL is what lights up the rollup + agent context.
//   node scripts/align-workstream-artifacts.mjs
// Reads .env.local for KNOWLEDGE_SUPABASE_URL / _SERVICE_KEY.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(join(DIR, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const URL = process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY
if (!URL || !KEY) { console.error('Missing KNOWLEDGE_SUPABASE_URL / KNOWLEDGE_SUPABASE_SERVICE_KEY'); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false } })

// name/title -> canonical workstream slug (part before '(', slugified)
const slugify = (s) => (s || '').split('(')[0].toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const LEGACY = { 'bid-to-win': 'offer-to-cash', 'contract-to-closeout': 'offer-to-cash', 'contract-to-close': 'offer-to-cash' }
const codeOf = (s) => { const k = slugify(s); return LEGACY[k] || k }

async function nodeCount(modelId) {
  const { count } = await db.from('process_nodes').select('id', { count: 'exact', head: true }).eq('process_model_id', modelId)
  return count || 0
}

async function instantiate(refRootId, orgId, wsId) {
  // Load the whole library, collect the subtree rooted at refRootId.
  const { data: root } = await db.from('process_reference_scenarios').select('*').eq('id', refRootId).single()
  const { data: all } = await db.from('process_reference_scenarios').select('*').eq('library_id', root.library_id)
  const byParent = new Map()
  for (const s of all) { const k = s.parent_id ?? null; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(s) }
  const subtree = []; const walk = (n) => { subtree.push(n); (byParent.get(n.id) || []).forEach(walk) }; walk(root)
  subtree.sort((a, b) => a.level - b.level || a.sort_order - b.sort_order)

  const { data: model, error: mErr } = await db.from('process_models').insert({
    organization_id: orgId, title: root.name, description: root.description ?? null,
    source_reference_id: root.id, workstream_id: wsId,
  }).select('id').single()
  if (mErr) throw new Error(`create model: ${mErr.message}`)

  const idMap = new Map()
  for (const s of subtree) {
    const parent = s.id === root.id ? null : (idMap.get(s.parent_id) || null)
    const isLeaf = (byParent.get(s.id) || []).length === 0
    const { data: node, error: nErr } = await db.from('process_nodes').insert({
      process_model_id: model.id, parent_id: parent, level: s.level, node_kind: s.node_kind,
      name: s.name, description: s.description ?? null, sort_order: s.sort_order ?? 0,
      is_leaf: isLeaf, graph_data: s.graph_data ?? null, scope_item_ref: s.scope_item_ref ?? null,
    }).select('id').single()
    if (nErr) throw new Error(`create node "${s.name}": ${nErr.message}`)
    idMap.set(s.id, node.id)
  }
  return { modelId: model.id, nodes: subtree.length }
}

async function main() {
  const { data: ws } = await db.from('workstreams').select('id,code,name,organization_id,source_reference_scenario_id')
  const orgId = ws[0].organization_id
  const wsByCode = Object.fromEntries(ws.map((w) => [w.code, w]))

  // 1. reference L1 -> workstream code, set source_reference_scenario_id
  const { data: refL1 } = await db.from('process_reference_scenarios').select('id,name,library_id').eq('level', 1)
  const refByCode = {}
  for (const r of refL1) { const c = codeOf(r.name); if (wsByCode[c]) refByCode[c] = r.id }
  let linked = 0
  for (const [code, refId] of Object.entries(refByCode)) {
    const w = wsByCode[code]
    if (w.source_reference_scenario_id === refId) continue
    const { error } = await db.from('workstreams').update({ source_reference_scenario_id: refId }).eq('id', w.id)
    if (error) throw new Error(`link ${code}: ${error.message}`)
    linked++
  }
  console.log(`1. Linked ${linked} workstream(s) to a reference scenario (${Object.keys(refByCode).length}/13 have a best-practice reference).`)

  // 2. home existing non-archived process models by title (best = most nodes)
  const { data: models } = await db.from('process_models').select('id,title,workstream_id,archived_at').eq('organization_id', orgId)
  const homedWs = new Set(ws.filter((w) => false).map((w) => w.code)) // recomputed below
  // build candidate list
  const candidates = []
  for (const m of models) {
    if (m.archived_at) continue
    const code = codeOf(m.title)
    if (!wsByCode[code]) continue
    const n = await nodeCount(m.id)
    if (n === 0) continue
    candidates.push({ model: m, code, nodes: n })
  }
  // group by code, home the richest
  const best = {}
  for (const c of candidates) { if (!best[c.code] || c.nodes > best[c.code].nodes) best[c.code] = c }
  let homed = 0
  for (const [code, c] of Object.entries(best)) {
    homedWs.add(code)
    if (c.model.workstream_id === wsByCode[code].id) continue
    const { error } = await db.from('process_models').update({ workstream_id: wsByCode[code].id }).eq('id', c.model.id)
    if (error) throw new Error(`home ${code}: ${error.message}`)
    homed++
    console.log(`   homed "${c.model.title}" (${c.nodes} nodes) -> ${code}`)
  }
  // also count models already homed (idempotent re-run)
  for (const m of models) { if (!m.archived_at && m.workstream_id) { const w = ws.find((x) => x.id === m.workstream_id); if (w) homedWs.add(w.code) } }
  console.log(`2. Homed ${homed} existing process model(s) by title.`)

  // 3. instantiate reference for value-stream workstreams still missing a model
  let made = 0
  for (const [code, refId] of Object.entries(refByCode)) {
    if (homedWs.has(code)) continue
    const w = wsByCode[code]
    const res = await instantiate(refId, orgId, w.id)
    homedWs.add(code)
    made++
    console.log(`   instantiated ${code}: model ${res.modelId.slice(0, 8)} (${res.nodes} nodes)`)
  }
  console.log(`3. Instantiated ${made} best-practice process model(s) for streams that had none.`)

  // 4. best-effort home capability maps by title
  const { data: caps } = await db.from('capability_maps').select('id,title,workstream_id,archived_at').eq('organization_id', orgId)
  let capHomed = 0
  for (const cm of (caps || [])) {
    if (cm.archived_at || cm.workstream_id) continue
    const code = codeOf(cm.title)
    if (!wsByCode[code]) continue
    const { error } = await db.from('capability_maps').update({ workstream_id: wsByCode[code].id }).eq('id', cm.id)
    if (!error) { capHomed++; console.log(`   homed capability map "${cm.title}" -> ${code}`) }
  }
  console.log(`4. Homed ${capHomed} capability map(s) by title.`)

  // report the resulting rollup
  const { data: ru } = await db.from('workstream_rollup').select('code,process_models,capabilities,capability_maps').order('code')
  console.log('\nResulting rollup (process_models / capabilities / capability_maps):')
  for (const r of (ru || [])) console.log(`   ${r.code.padEnd(24)} proc=${r.process_models}  caps=${r.capabilities}  maps=${r.capability_maps}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
