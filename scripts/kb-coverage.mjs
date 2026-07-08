#!/usr/bin/env node
// Knowledge coverage report (Workpackage A1, extended by J1).
//
// Two axes, both per workstream:
//   1. DOSSIER LAYER: which genres of source a stream stands on today.
//      L0 SAP baseline, L1 GovCon overlay, L2 industry-model (blueprints),
//      L3 Dassian, L4 RevTech template, plus dimension profiles, accelerators,
//      criteria, and the structural config-capability / capability-model sources.
//   2. SME DIMENSION (J1): which of the eight dimensions a stream's sources
//      actually serve. People, Process, Technology and Systems, Data, Security and
//      Authorizations, Analytics and Reporting, Role of AI, Operating Model.
//      A source declares its dimensions in frontmatter (`dimensions: People, Data`);
//      otherwise a keyword heuristic classifies it.
//
// Pairs with the eval harness (agent-core/eval): the eval says how well an agent
// answers; this says what knowledge it is standing on.
//
// Usage (from diagram-app/):  node scripts/kb-coverage.mjs
//   --json         emit the raw coverage object instead of the tables
//   --dimensions   print only the dimension matrix
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

const { WORKSTREAMS, SME_DIMENSIONS } = await import('@jlee-revtech/agent-core')

// Classify a source into a dossier layer / genre by its code + kind.
function classify(src) {
  const c = (src.code || '').toLowerCase()
  if (src.kind === 'config-capability' || c.startsWith('config-')) return 'config'
  if (src.kind === 'capability' || c.startsWith('capabilities-')) return 'capModel'
  if (src.kind === 'template' || c.startsWith('template-')) return 'L4-template'
  if (src.kind === 'accelerator' || c.startsWith('accelerator-')) return 'accelerator'
  if (src.kind === 'blueprint' || c.startsWith('blueprint-')) return 'L2-industry'
  if (src.kind === 'criteria') return 'criteria'
  if (src.kind === 'dimension-profile' || c.startsWith('dimensions-')) return 'dim'
  if (c.startsWith('dassian-')) return 'L3-dassian'
  if (c.includes('commercial-defense') || c.includes('govcon') || c.includes('dfars') || c.includes('cas') || c.includes('dcaa') || c.includes('itar')) return 'L1-govcon'
  return 'L0-skill' // sap-*, vibe-*, skill-*, generic prose
}

const GENRES = ['config', 'capModel', 'crosscut', 'dim', 'L0-skill', 'L1-govcon', 'L2-industry', 'L3-dassian', 'L4-template', 'accelerator', 'criteria']

// ─── Dimension classification (J1) ────────────────────────────────────────────
// Sources that teach the whole rubric by construction.
const ALL_DIMS = [...SME_DIMENSIONS]
const WHOLE_RUBRIC_KINDS = new Set(['dimension-profile', 'blueprint'])
const WHOLE_RUBRIC_CODES = new Set(['skill-govcon-sme-dimensions', 'skill-s4-consultant-task-catalog'])

// Keyword heuristic for existing sources that predate the frontmatter convention.
// Deliberately conservative: a false positive makes a stream look covered when it
// is not, which is the failure this report exists to prevent.
const DIM_PATTERNS = {
  'People': /\b(role map|client role|persona|who signs|sign.?off|reporting line|controller|manager|administrator|officer|analyst|workshop attendee)\b/i,
  'Process': /\b(process|end.to.end|workflow|process step|cycle|procedure|posting run|close calendar)\b/i,
  'Technology and Systems': /\b(SAP|S\/4HANA|module|transaction|IMG|table|CDS|BAPI|interface|integration|middleware|Costpoint|Primavera|Teamcenter|PIEE)\b/i,
  'Data': /\b(master data|data object|migration|data model|material master|ACDOCA|BOM|field mapping|reconciliation|load)\b/i,
  'Security and Authorizations': /\b(PFCG|authorization object|segregation of duties|\bSoD\b|firefighter|ITAR|EAR\b|export control|deemed export|role design|access control)\b/i,
  'Analytics and Reporting': /\b(report|reporting|analytical|analytics|dashboard|\bKPI\b|IPMR|IPMDAR|ICE schedule|533|query browser|embedded analytics)\b/i,
  'Role of AI': /\b(\bAI\b|artificial intelligence|\bLLM\b|machine learning|agentic|human.in.the.loop|certification boundary)\b/i,
  'Operating Model': /\b(operating model|cadence|month.?end close|shared services|program.?aligned|matrixed|governance|organiz(ed|ation) as|how the function)\b/i,
}

function dimensionsOf(src) {
  if (WHOLE_RUBRIC_KINDS.has(src.kind) || WHOLE_RUBRIC_CODES.has(src.code)) return ALL_DIMS
  // Explicit frontmatter wins.
  const declared = src.frontmatter?.dimensions
  if (typeof declared === 'string' && declared.trim()) {
    const named = declared.split(',').map((d) => d.trim()).filter((d) => ALL_DIMS.includes(d))
    if (named.length) return named
  }
  const body = src.body || ''
  if (!body) return []
  return ALL_DIMS.filter((d) => DIM_PATTERNS[d].test(body))
}

// ─── Load ─────────────────────────────────────────────────────────────────────
const { data: sources, error } = await db
  .from('kb_sources')
  .select('code, kind, workstream_codes, status, tenant_key, frontmatter, body')
if (error) { console.error(error.message); process.exit(1) }

// Criteria live in their own table (kb_criteria), not in kb_sources.
const { data: criteriaRows } = await db
  .from('kb_criteria')
  .select('workstream_code')
  .eq('status', 'active')
  .is('tenant_key', null)
const criteriaByStream = {}
for (const r of criteriaRows || []) criteriaByStream[r.workstream_code] = (criteriaByStream[r.workstream_code] || 0) + 1

// A source tagged to (almost) every stream is cross-cutting training, not domain
// depth for any one stream: it should not make a stream look "rich".
const CROSSCUT_THRESHOLD = 10

const cov = {}
for (const w of WORKSTREAMS) {
  cov[w.code] = {
    name: w.shortName,
    isPlatform: w.isPlatform,
    dassianModules: w.dassianModules.length,
    genres: Object.fromEntries(GENRES.map((g) => [g, []])),
    dims: Object.fromEntries(ALL_DIMS.map((d) => [d, 0])),
    criteria: criteriaByStream[w.code] || 0,
    tenantSkills: 0,
  }
}

for (const s of sources || []) {
  if (s.status && s.status !== 'active') continue
  const codes = s.workstream_codes || []
  const broad = codes.length >= CROSSCUT_THRESHOLD
  let g = classify(s)
  // Reclassify a broadly-tagged prose skill as cross-cutting (config/capModel are
  // per-stream structural sources and keep their genre even when broad). Blueprints
  // are all-stream by design and stay L2-industry: they ARE the industry layer.
  if (broad && (g === 'L0-skill' || g === 'L1-govcon')) g = 'crosscut'
  const dims = dimensionsOf(s)
  for (const wc of codes) {
    if (!cov[wc]) continue
    if (cov[wc].genres[g]) cov[wc].genres[g].push(s.code)
    for (const d of dims) cov[wc].dims[d]++
    if (s.tenant_key) cov[wc].tenantSkills++
  }
}

// Verdict = depth of stream-specific domain prose (dimension profile + skill +
// govcon + industry + dassian), excluding cross-cutting and structural sources.
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

const cell = (n) => (n ? String(n).padStart(3) : '  .')
const onlyDims = process.argv.includes('--dimensions')

if (!onlyDims) {
  console.log('\nKnowledge coverage by workstream (stream-specific source counts per genre), active sources only\n')
  console.log('workstream'.padEnd(24) + ' xc cfg cap dim  L0  L1  L2  L3  tpl acc crit  verdict')
  for (const w of WORKSTREAMS) {
    const c = cov[w.code]
    const g = c.genres
    const row =
      w.shortName.padEnd(24) +
      [cell(g.crosscut.length), cell(g.config.length), cell(g.capModel.length), cell(g.dim.length), cell(g['L0-skill'].length), cell(g['L1-govcon'].length), cell(g['L2-industry'].length), cell(g['L3-dassian'].length), cell(g['L4-template'].length), cell(g.accelerator.length), cell(c.criteria)].join(' ') +
      '   ' + verdict(c) + (w.isPlatform ? ' (platform)' : '')
    console.log(row)
  }
  console.log('\nlegend: xc=cross-cutting (all-stream)  cfg=config-capability  cap=capability-model')
  console.log('        dim=8-dimension operating profile  L0=stream SAP/technical skill  L1=GovCon overlay')
  console.log('        L2=industry blueprint  L3=Dassian  tpl=RevTech template (H1)  acc=accelerator (H2)  crit=kb_criteria rows')
  console.log('\nverdict counts:', JSON.stringify(WORKSTREAMS.reduce((a, w) => { const v = verdict(cov[w.code]); a[v] = (a[v] || 0) + 1; return a }, {})))
}

// ─── The dimension matrix (J1 acceptance) ─────────────────────────────────────
const SHORT = { 'People': 'Ppl', 'Process': 'Prc', 'Technology and Systems': 'Tec', 'Data': 'Dat', 'Security and Authorizations': 'Sec', 'Analytics and Reporting': 'Ana', 'Role of AI': ' AI', 'Operating Model': ' OM' }
console.log('\nSME dimension coverage (sources serving each dimension, per workstream)\n')
console.log('workstream'.padEnd(24) + ALL_DIMS.map((d) => SHORT[d].padStart(4)).join('') + '   gaps')
let totalGaps = 0
for (const w of WORKSTREAMS) {
  const c = cov[w.code]
  const gaps = ALL_DIMS.filter((d) => c.dims[d] === 0)
  totalGaps += gaps.length
  console.log(
    w.shortName.padEnd(24) +
      ALL_DIMS.map((d) => String(c.dims[d] || '.').padStart(4)).join('') +
      '   ' + (gaps.length ? gaps.map((d) => SHORT[d].trim()).join(',') : 'none')
  )
}
console.log(`\n${totalGaps} stream x dimension gap(s) across ${WORKSTREAMS.length * ALL_DIMS.length} cells.`)
console.log('Acceptance (J2): every stream non-empty on all eight dimensions.\n')
