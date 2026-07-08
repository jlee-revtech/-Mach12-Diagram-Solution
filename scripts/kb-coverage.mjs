#!/usr/bin/env node
// Knowledge coverage report (Workpackage A1). For each of the 13 canonical
// workstreams, shows which dossier layers have sources today, so the Phase 2
// curriculum can target the holes. Pairs with the eval harness (agent-core/eval):
// the eval says how well an agent answers; this says what knowledge it is
// standing on.
//
// Dossier layers (per the handoff): L0 SAP baseline, L1 GovCon overlay,
// L2 industry-model, L3 Dassian, L4 RevTech template, L5 tenant-specific.
// Plus the two structural sources every stream gets: config-capability (the SSS
// activity catalog) and the L2/L3 capability model.
//
// Usage (from diagram-app/):  node scripts/kb-coverage.mjs
//   --json   emit the raw coverage object instead of the table
// Reads .env.local for KNOWLEDGE_SUPABASE_URL / _SERVICE_KEY.

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

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
if (!URL || !KEY) { console.error('Missing KNOWLEDGE_SUPABASE_URL / _SERVICE_KEY'); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false } })

const { WORKSTREAMS } = await import('@jlee-revtech/agent-core')

// Classify a source into a dossier layer / genre by its code + kind. This is the
// heuristic the Phase 2 curriculum sharpens as new kinds (template, accelerator,
// criteria) land.
function classify(src) {
  const c = (src.code || '').toLowerCase()
  if (src.kind === 'config-capability' || c.startsWith('config-')) return 'config'
  if (src.kind === 'capability' || c.startsWith('capabilities-')) return 'capModel'
  if (src.kind === 'template' || c.startsWith('template-')) return 'L4-template'
  if (src.kind === 'accelerator' || c.startsWith('accelerator-')) return 'accelerator'
  if (src.kind === 'criteria') return 'criteria'
  if (src.kind === 'dimension-profile' || c.startsWith('dimensions-')) return 'dim'
  if (c.startsWith('dassian-')) return 'L3-dassian'
  if (c.includes('commercial-defense') || c.includes('govcon') || c.includes('dfars') || c.includes('cas') || c.includes('dcaa') || c.includes('itar')) return 'L1-govcon'
  return 'L0-skill' // sap-*, vibe-*, skill-*, generic prose
}

const GENRES = ['config', 'capModel', 'crosscut', 'dim', 'L0-skill', 'L1-govcon', 'L2-industry', 'L3-dassian', 'L4-template', 'accelerator', 'criteria']

const { data: sources, error } = await db.from('kb_sources').select('code, kind, workstream_codes, status, tenant_key')
if (error) { console.error(error.message); process.exit(1) }

// A source tagged to (almost) every stream is cross-cutting training, not domain
// depth for any one stream — it should not make a stream look "rich".
const CROSSCUT_THRESHOLD = 10

// Roll up per workstream. A source counts for every workstream it is tagged to.
const cov = {}
for (const w of WORKSTREAMS) cov[w.code] = { name: w.shortName, isPlatform: w.isPlatform, dassianModules: w.dassianModules.length, genres: Object.fromEntries(GENRES.map((g) => [g, []])), tenantSkills: 0 }

for (const s of sources || []) {
  if (s.status && s.status !== 'active') continue
  const codes = s.workstream_codes || []
  const broad = codes.length >= CROSSCUT_THRESHOLD
  let g = classify(s)
  // Reclassify a broadly-tagged prose skill as cross-cutting (config/capModel
  // are per-stream structural sources and keep their genre even when broad).
  if (broad && (g === 'L0-skill' || g === 'L1-govcon')) g = 'crosscut'
  for (const wc of codes) {
    if (!cov[wc]) continue
    if (cov[wc].genres[g]) cov[wc].genres[g].push(s.code)
    if (s.tenant_key) cov[wc].tenantSkills++
  }
}

// Verdict = depth of *stream-specific* domain prose (skill + govcon + industry +
// dassian), excluding cross-cutting and structural sources.
function verdict(c) {
  const domain = c.genres['dim'].length + c.genres['L0-skill'].length + c.genres['L1-govcon'].length + c.genres['L2-industry'].length + c.genres['L3-dassian'].length
  if (domain === 0) return 'EMPTY'
  if (domain === 1) return 'thin'
  if (domain === 2) return 'medium'
  return 'rich'
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(cov, null, 2))
  process.exit(0)
}

// Table.
const cell = (n) => (n ? String(n).padStart(3) : '  .')
console.log('\nKnowledge coverage by workstream (stream-specific source counts per genre) — active sources only\n')
console.log('workstream'.padEnd(24) + ' xc cfg cap dim  L0  L1  L2  L3  tpl acc crit  verdict')
for (const w of WORKSTREAMS) {
  const c = cov[w.code]
  const g = c.genres
  const row =
    w.shortName.padEnd(24) +
    [cell(g.crosscut.length), cell(g.config.length), cell(g.capModel.length), cell(g.dim.length), cell(g['L0-skill'].length), cell(g['L1-govcon'].length), cell(g['L2-industry'].length), cell(g['L3-dassian'].length), cell(g['L4-template'].length), cell(g.accelerator.length), cell(g.criteria.length)].join(' ') +
    '   ' + verdict(c) + (w.isPlatform ? ' (platform)' : '')
  console.log(row)
}
console.log('\nlegend: xc=cross-cutting (all-stream)  cfg=config-capability  cap=capability-model')
console.log('        dim=8-dimension operating profile  L0=stream SAP/technical skill  L1=GovCon overlay  L2=industry-model  L3=Dassian')
console.log('        tpl=RevTech template (H1)  acc=accelerator (H2)  crit=criteria')
console.log('\nverdict counts:', JSON.stringify(WORKSTREAMS.reduce((a, w) => { const v = verdict(cov[w.code]); a[v] = (a[v] || 0) + 1; return a }, {})))
console.log('Phase 2 targets the EMPTY/thin rows and the empty L1/L2/L4 columns first.\n')
