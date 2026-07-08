#!/usr/bin/env node
// One-command knowledge sync for the shared Super Consultant kb fabric.
//
// Runs the whole pipeline end to end, in order, then prints retrieval smoke
// checks so you can see the kb is actually answering:
//   1. Export the SAP Solution Studio Agent Configurator catalog
//      (cds-lineage-explorer -> public/agent-config-catalog.json)
//   2. import-vibe-skills.mjs     (skill bundles + catalog + agents + personas)
//   3. import-config-catalog.mjs  (per-agent SAP config-capability sources)
//   4. import-capabilities.ts     (L2/L3 value-stream capability model)
//   5. import-skills.mjs          (cross-cutting scripts/skills/*.md)
//   6. import-dimension-profiles  (per-stream 8-dimension operating profiles)
//   7. import-blueprints.mjs      (the 7 A&D industry blueprints, all-stream)
//   8. import-accelerators.mjs    (the RevTech/Mach12 accelerator catalog, H2)
//   9. import-criteria.mjs        (the RevTech template criteria, H1 -> kb_criteria)
//  10. Retrieval smoke checks against the freshly-loaded kb
//
// Acceptance target: adding a knowledge bundle is "drop the file + edit ONE
// mapping + run this one command". The importers are each idempotent (upsert by
// code + re-chunk), so re-running is always safe.
//
// Usage (from diagram-app/):  node scripts/sync-knowledge.mjs
//   --skip-export   don't regenerate the SSS catalog (use the checked-in JSON)
//   --skip-smoke    don't run the retrieval smoke checks
// Reads .env.local for KNOWLEDGE_SUPABASE_URL / _SERVICE_KEY / VOYAGE_API_KEY.

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const SSS_DIR = join(APP_DIR, '..', '..', 'cds-lineage-explorer')
const args = new Set(process.argv.slice(2))
const SKIP_EXPORT = args.has('--skip-export')
const SKIP_SMOKE = args.has('--skip-smoke')

// ─── Minimal .env.local loader (matches the importers) ───────────────────────
function loadEnv() {
  const p = join(APP_DIR, '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
loadEnv()

const t0 = Date.now()
const results = []

/** Run one pipeline step as a child process, streaming its output. */
function step(label, cmd, cmdArgs, cwd) {
  const bar = '─'.repeat(Math.max(4, 60 - label.length))
  console.log(`\n\x1b[1m▶ ${label}\x1b[0m ${bar}`)
  const started = Date.now()
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  const ok = r.status === 0 && !r.error
  results.push({ label, ok, ms: Date.now() - started, detail: r.error ? r.error.message : `exit ${r.status}` })
  if (!ok) console.error(`\x1b[31m✗ ${label} failed (${r.error ? r.error.message : `exit ${r.status}`})\x1b[0m`)
  return ok
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────
if (!SKIP_EXPORT) {
  if (!existsSync(SSS_DIR)) {
    console.warn(`\x1b[33m! SAP Solution Studio repo not found at ${SSS_DIR}; skipping catalog export (using checked-in JSON).\x1b[0m`)
    results.push({ label: 'export-agent-catalog', ok: true, ms: 0, detail: 'skipped (repo absent)' })
  } else {
    // The SSS export uses extensionless TS imports (./registry), which node's
    // native TS loader will not resolve, so it runs through tsx. tsx is not a
    // dependency there (npx fetches/caches it on first use).
    step('export-agent-catalog (SSS)', 'npx', ['--yes', 'tsx', 'scripts/export-agent-catalog.ts'], SSS_DIR)
  }
}

step('import-vibe-skills', 'node', ['scripts/import-vibe-skills.mjs'], APP_DIR)
step('import-config-catalog', 'node', ['scripts/import-config-catalog.mjs'], APP_DIR)
step('import-capabilities', 'node', ['scripts/import-capabilities.ts'], APP_DIR)
step('import-skills', 'node', ['scripts/import-skills.mjs'], APP_DIR)
step('import-dimension-profiles', 'node', ['scripts/import-dimension-profiles.mjs'], APP_DIR)
step('import-blueprints', 'node', ['scripts/import-blueprints.mjs'], APP_DIR)
step('import-accelerators', 'node', ['scripts/import-accelerators.mjs'], APP_DIR)
step('import-criteria', 'node', ['scripts/import-criteria.mjs'], APP_DIR)

// ─── Retrieval smoke checks ─────────────────────────────────────────────────
async function smoke() {
  const { createKnowledgeClient } = await import('@jlee-revtech/agent-core')
  const kb = createKnowledgeClient({
    url: process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY,
    voyageKey: process.env.VOYAGE_API_KEY,
    voyageModel: process.env.VOYAGE_MODEL,
  })
  if (!kb.enabled) {
    console.warn('\x1b[33m! Knowledge client not configured (no kb URL / service key); skipping smoke checks.\x1b[0m')
    return
  }
  // One probe per representative stream: a question the kb should now answer.
  const probes = [
    ['record-to-report', 'How do I configure results analysis for revenue recognition on a project?'],
    ['offer-to-cash', 'How are CLIN and SLIN modeled for a government contract billing plan?'],
    ['plan-to-produce', 'What order types and MRP settings does a make-to-order production run need?'],
    ['source-to-pay', 'How do FAR/DFARS flowdown clauses attach to a subcontract PO?'],
    [null, 'Which workstream owns EVMS and which one fulfills its cost data dependencies?'],
    // The Phase 2 corpus: each probe should land on the source that answers it.
    ['record-to-report', 'Which of the six DFARS contractor business systems does finance own, and what are the withholding consequences?'],
    ['plan-to-produce', 'What are the ten MMAS standards and how does S/4HANA satisfy each?'],
    ['acquire-to-retire', 'How does a defense OEM prime differ from a component supplier in property accountability?'],
    ['offer-to-cash', 'When does TINA apply and what are the exceptions to certified cost or pricing data?'],
    ['plan-to-perform', 'What does Contract Studio do and when should I position it against Deltek Costpoint?'],
    [null, 'Who adjudicates the seam between offer-to-cash and record-to-report on performance obligations?'],
  ]
  console.log(`\n\x1b[1m▶ Retrieval smoke checks\x1b[0m ${'─'.repeat(37)}`)
  let answered = 0
  for (const [ws, q] of probes) {
    try {
      const res = await kb.search({ query: q, workstreams: ws, limit: 3 })
      const top = res.hits[0]
      if (top) {
        answered++
        console.log(`  \x1b[32m✓\x1b[0m [${ws ?? 'all'}] ${res.mode} -> ${top.sourceTitle || top.sourceCode} (+${res.hits.length - 1} more)`)
      } else {
        console.log(`  \x1b[33m∅\x1b[0m [${ws ?? 'all'}] no hits for: ${q}`)
      }
    } catch (e) {
      console.log(`  \x1b[31m✗\x1b[0m [${ws ?? 'all'}] ${e instanceof Error ? e.message : 'search failed'}`)
    }
  }
  results.push({ label: 'smoke-checks', ok: answered === probes.length, ms: 0, detail: `${answered}/${probes.length} answered` })

  // The RevTech template criteria (H1) live in kb_criteria, not kb_sources, so the
  // retrieval probes above cannot see them. Check them directly: the conformance
  // tool is useless if the criteria did not land.
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      process.env.KNOWLEDGE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY,
      { auth: { persistSession: false } }
    )
    const { data, error } = await sb.from('kb_criteria').select('workstream_code, severity').eq('status', 'active').is('tenant_key', null)
    if (error) throw new Error(error.message)
    const byStream = {}
    for (const r of data || []) byStream[r.workstream_code] = (byStream[r.workstream_code] || 0) + 1
    const total = (data || []).length
    console.log(`  [32m✓[0m kb_criteria: ${total} active template criteria across ${Object.keys(byStream).length} stream(s)`)
    for (const [k, v] of Object.entries(byStream)) console.log(`      ${k}: ${v}`)
    results.push({ label: 'criteria-check', ok: total > 0, ms: 0, detail: `${total} active criteria` })
  } catch (e) {
    console.log(`  [31m✗[0m kb_criteria check failed: ${e instanceof Error ? e.message : e}`)
    results.push({ label: 'criteria-check', ok: false, ms: 0, detail: 'failed' })
  }
}

if (!SKIP_SMOKE) await smoke()

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n\x1b[1m═══ sync-knowledge summary (${((Date.now() - t0) / 1000).toFixed(1)}s) ═══\x1b[0m`)
for (const r of results) {
  const mark = r.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`  ${mark} ${r.label.padEnd(28)} ${r.detail}${r.ms ? ` (${(r.ms / 1000).toFixed(1)}s)` : ''}`)
}
const failed = results.filter((r) => !r.ok)
if (failed.length) {
  console.error(`\n\x1b[31m${failed.length} step(s) failed.\x1b[0m`)
  process.exit(1)
}
console.log('\n\x1b[32mAll steps succeeded.\x1b[0m')
