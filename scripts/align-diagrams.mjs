#!/usr/bin/env node
// Tie the data-architecture DIAGRAMS to the workstream agents.
//
// The diagrams are the richest content in the model (systems, the data flows
// between them, and the payload each flow carries down to the SAP object), and
// until this script ran, every one of them was aligned to no value stream. That
// meant `list_diagrams` returned nothing for every agent, and so did
// `list_systems` and `list_data`, because those filter on workstream_id too. The
// agents were telling clients their architecture was empty while the model held
// 14 diagrams, 130+ systems, and 2,000+ data elements.
//
// What this does (idempotent / re-runnable):
//   1. Homes each diagram to ONE workstream (diagrams.workstream_id): the stream
//      that owns the data objects on the canvas.
//   2. Records the other streams a diagram serves in `workstream_alignments`
//      (entity_type='diagram'), because a data architecture rarely stops at a
//      value-stream boundary. The seam contract map (agent-core src/seams.ts) is
//      the reason each span exists, and each mapping states it.
//   3. Derives `logical_systems.workstream_id` from the diagrams a system appears
//      on (matched by name), plus alignments for systems that span streams.
//   4. Derives `system_data_elements.workstream_id` the same way, from the data
//      elements carried on the flows.
//
// Nothing is invented. A diagram whose content does not clearly belong to a
// stream is left unaligned and REPORTED, because an agent that reads a wrongly
// homed diagram is worse off than one that reads none. Enterprise-wide landscape
// diagrams are deliberately homed to no single stream and aligned to all of them.
//
// Usage (from diagram-app/):
//   node scripts/align-diagrams.mjs            # dry run: print the plan, write nothing
//   node scripts/align-diagrams.mjs --apply    # write it
// Reads .env.local for NEXT_PUBLIC_SUPABASE_URL / KNOWLEDGE_SUPABASE_SERVICE_KEY.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(join(DIR, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY
if (!URL || !KEY) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / KNOWLEDGE_SUPABASE_SERVICE_KEY'); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

// Normalize a title for matching: lowercase, every dash variant to '-', collapse space.
const norm = (s) => (s || '').toLowerCase().replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').trim()

// ─── The mapping. Edit THIS and re-run; nothing else needs to change. ─────────
//
// home:  the stream that owns the data objects drawn on the canvas.
// spans: the other streams whose agents must be able to read it, each justified
//        by a seam from agent-core src/seams.ts.
// match: normalized title, OR a `systems` signature for untitled canvases.
const MAP = [
  {
    title: 'plan to produce capability map - data architecture',
    home: 'plan-to-produce',
    spans: ['inventory-to-deliver', 'source-to-pay', 'design-to-release'],
    why: 'Production planning and execution owns it. Spans I2D (p2pr-i2d-stock: the goods receipt decides the stock paradigm), S2P (s2p-p2pr-subcontract), and D2R (d2r-p2pr-bom).',
  },
  {
    title: 'inventory to deliver capability map - data architecture',
    home: 'inventory-to-deliver',
    spans: ['plan-to-produce', 'offer-to-cash', 'acquire-to-retire'],
    why: 'Logistics owns it. Spans P2Produce (stock paradigm), O2C (i2d-o2c-dd250: acceptance is a contractual act on a CLIN), and A2R (GFP storage and property records).',
  },
  {
    title: 'labor costing - 3.1.01',
    home: 'hire-to-retire',
    spans: ['record-to-report', 'plan-to-perform'],
    why: 'The canvas is HR mini-master, timesheets (ETS), enterprise labor distribution, and payroll. Per seam h2r-r2r-labor, Hire-to-Retire OWNS the timekeeping control and hands R2R attested hours; R2R owns the rate applied. P2Perform consumes the labor actuals as ACWP.',
  },
  {
    title: 'material costing - 3.1.02',
    home: 'plan-to-produce',
    spans: ['record-to-report', 'plan-to-perform'],
    why: 'The canvas is material master, BOM, routings, work centers, production orders, plant stock, and PMMO pegging. R2R spans in via p2pr-r2r-settlement (it owns the settlement rule and its accounting consequence).',
  },
  {
    title: 's4 hana project systems',
    home: 'plan-to-perform',
    spans: ['record-to-report', 'plan-to-produce'],
    why: 'Project System, WBS, and PMMO are the program-control cost object. Spans R2R (p2pf-r2r-evms: R2R fulfills the actual-cost dependencies) and P2Produce (production demand off the project).',
  },
  {
    title: 'plan to perform',
    home: 'plan-to-perform',
    spans: [],
    why: 'Program and portfolio control landscape.',
  },
  {
    title: 'fixed asset',
    home: 'acquire-to-retire',
    spans: ['record-to-report', 'plan-to-perform'],
    why: 'The asset lifecycle object model: WBS, AUC, fixed asset, depreciation posting. Per seam a2r-r2r-assets, A2R owns the asset lifecycle and R2R owns the capitalization policy and depreciation areas, so R2R must be able to read it.',
  },
  {
    title: 'financial asset accounting - 3.6',
    home: 'record-to-report',
    spans: ['acquire-to-retire'],
    why: 'Depreciation areas, ACDOCA posting, lease accounting: the accounting side of the same seam (a2r-r2r-assets), homed to the ledger owner.',
  },
  {
    title: 'intercompany matching and reconciliations - 3.2.03',
    home: 'record-to-report',
    spans: [],
    why: 'Intercompany AR/AP matching in the universal journal. Pure close-cycle content.',
  },
  {
    // The financial consolidation / ERP landscape canvas (Gov Ops, Commercial Ops,
    // Distribution, E-Hub, EAS GL/AR, Hyperion, enterprise consolidation).
    systems: ['hyperion', 'enterprise financial consolidation'],
    home: 'record-to-report',
    spans: ['analytics-reporting', 'development-technology'],
    why: 'Multi-box S/4 plus legacy EAS ledgers consolidating into Hyperion. R2R owns the consolidated ledger; Analytics owns the reporting layer over it; Dev-Tech owns the batch interfaces between the boxes.',
  },
  {
    // The enterprise systems landscape (SAC, MDG, PLM, MOM, S/4 ops boxes, eHub).
    systems: ['mdg', 'manufacturing operations management (mom)'],
    home: null, // enterprise-wide: homed to no single stream, visible to all
    spansAll: true,
    why: 'An enterprise landscape canvas, not a value-stream design. Homed to no stream on purpose; aligned to all 13 so every agent (and the Solution Architect) can read the surround landscape.',
  },
  {
    title: 'a&d reference architecture diagram',
    home: null,
    spansAll: true,
    why: 'The A&D reference architecture: digital ERP core, EVM, EPM/FP&A, MES, CRM, CLM, SCM, IMS, PLM. Enterprise-wide by construction.',
  },
]

// Deliberately NOT aligned, and why. Reported, never guessed at.
const EXCLUDE = [
  { match: (d) => /example \/ test diagram/i.test(d.title || ''), why: 'Test/demo content. Aligning it would feed an agent fabricated architecture.' },
  { match: (d) => ((d.canvas_data?.nodes) || []).length === 0, why: 'Empty canvas: nothing to align.' },
]

const canvasSystems = (d) => ((d.canvas_data?.nodes) || []).filter((n) => n.type === 'system').map((n) => String(n.data?.label || '').trim()).filter(Boolean)
const canvasElements = (d) => ((d.canvas_data?.edges) || []).flatMap((e) => (e.data?.dataElements || [])).map((x) => String(x.name || '').trim()).filter(Boolean)

function ruleFor(d) {
  const t = norm(d.title)
  const sys = canvasSystems(d).map(norm)
  for (const r of MAP) {
    if (r.title && norm(r.title) === t) return r
    if (r.systems && r.systems.every((s) => sys.some((x) => x.includes(norm(s))))) return r
  }
  return null
}

async function main() {
  const { data: orgs } = await db.from('organizations').select('id, name')
  const orgName = Object.fromEntries((orgs || []).map((o) => [o.id, o.name]))

  const { data: wsRows, error: wsErr } = await db.from('workstreams').select('id, code, organization_id')
  if (wsErr) throw new Error(wsErr.message)
  // org -> code -> id
  const wsByOrg = {}
  for (const w of wsRows || []) (wsByOrg[w.organization_id] ||= {})[w.code] = w.id

  const { data: diagrams, error } = await db
    .from('diagrams')
    .select('id, title, organization_id, workstream_id, canvas_data')
  if (error) throw new Error(error.message)

  const plan = { home: [], spans: [], skipped: [], unmatched: [] }

  for (const d of diagrams) {
    const ex = EXCLUDE.find((e) => e.match(d))
    if (ex) { plan.skipped.push({ d, why: ex.why }); continue }
    const rule = ruleFor(d)
    if (!rule) { plan.unmatched.push(d); continue }
    const ws = wsByOrg[d.organization_id]
    if (!ws) { plan.skipped.push({ d, why: `org "${orgName[d.organization_id]}" has no workstreams seeded` }); continue }

    const homeId = rule.home ? ws[rule.home] : null
    if (rule.home && !homeId) { plan.skipped.push({ d, why: `workstream "${rule.home}" not present in this org` }); continue }
    plan.home.push({ d, rule, homeId })

    const spanCodes = rule.spansAll ? Object.keys(ws) : (rule.spans || [])
    for (const code of spanCodes) {
      if (code === rule.home) continue
      const wid = ws[code]
      if (wid) plan.spans.push({ d, code, wid })
    }
  }

  // ─── report ────────────────────────────────────────────────────────────────
  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN (pass --apply to write)'}\n`)
  console.log('─── Diagram homing ─────────────────────────────────────────────')
  for (const { d, rule } of plan.home) {
    const spans = rule.spansAll ? 'ALL 13 (enterprise-wide)' : (rule.spans || []).join(', ') || '(none)'
    console.log(`\n  "${d.title}"  [${orgName[d.organization_id]}]`)
    console.log(`    home:  ${rule.home ?? '(none: enterprise-wide)'}`)
    console.log(`    spans: ${spans}`)
    console.log(`    why:   ${rule.why}`)
  }
  if (plan.unmatched.length) {
    console.log('\n─── NOT aligned: no rule matched (left alone on purpose) ───────')
    for (const d of plan.unmatched) console.log(`  "${d.title}" [${orgName[d.organization_id]}] systems: ${canvasSystems(d).slice(0, 6).join(' | ') || '(none)'}`)
  }
  if (plan.skipped.length) {
    console.log('\n─── Skipped ────────────────────────────────────────────────────')
    for (const { d, why } of plan.skipped) console.log(`  "${d.title}": ${why}`)
  }

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply.\n')
    return
  }

  // ─── 1 + 2: diagrams ───────────────────────────────────────────────────────
  let homed = 0
  for (const { d, homeId } of plan.home) {
    if (d.workstream_id === homeId) { homed++; continue }
    const { error: e } = await db.from('diagrams').update({ workstream_id: homeId }).eq('id', d.id)
    if (e) throw new Error(`home ${d.title}: ${e.message}`)
    homed++
  }
  const spanRows = plan.spans.map(({ d, wid }) => ({
    organization_id: d.organization_id, workstream_id: wid, entity_type: 'diagram', entity_id: d.id,
  }))
  if (spanRows.length) {
    const { error: e } = await db.from('workstream_alignments').upsert(spanRows, { onConflict: 'workstream_id,entity_type,entity_id' })
    if (e) throw new Error(`alignments: ${e.message}`)
  }
  console.log(`\n✓ ${homed} diagram(s) homed, ${spanRows.length} cross-stream alignment(s) recorded`)

  // ─── 3: logical_systems, derived from the diagrams they appear on ──────────
  const homeOf = new Map(plan.home.map(({ d, homeId }) => [d.id, homeId]))
  const spansOf = new Map()
  for (const { d, wid } of plan.spans) (spansOf.get(d.id) ?? spansOf.set(d.id, []).get(d.id)).push(wid)

  const { data: systems } = await db.from('logical_systems').select('id, name, organization_id, workstream_id')
  const sysHits = new Map() // system id -> Map(wsId -> count)
  for (const s of systems || []) {
    const key = norm(s.name)
    for (const d of diagrams) {
      if (d.organization_id !== s.organization_id) continue
      if (!canvasSystems(d).some((label) => norm(label) === key)) continue
      const wids = [homeOf.get(d.id), ...(spansOf.get(d.id) || [])].filter(Boolean)
      const m = sysHits.get(s.id) ?? sysHits.set(s.id, new Map()).get(s.id)
      for (const w of wids) m.set(w, (m.get(w) || 0) + 1)
    }
  }
  let sysHomed = 0
  const sysAlign = []
  for (const s of systems || []) {
    const m = sysHits.get(s.id)
    if (!m || !m.size) continue
    const ranked = [...m.entries()].sort((a, b) => b[1] - a[1])
    const primary = ranked[0][0]
    if (s.workstream_id !== primary) {
      const { error: e } = await db.from('logical_systems').update({ workstream_id: primary }).eq('id', s.id)
      if (e) throw new Error(`system ${s.name}: ${e.message}`)
    }
    sysHomed++
    for (const [wid] of ranked.slice(1)) sysAlign.push({ organization_id: s.organization_id, workstream_id: wid, entity_type: 'logical_system', entity_id: s.id })
  }
  if (sysAlign.length) await db.from('workstream_alignments').upsert(sysAlign, { onConflict: 'workstream_id,entity_type,entity_id' })
  const sysTotal = (systems || []).length
  console.log(`✓ ${sysHomed}/${sysTotal} logical system(s) homed from diagram membership, ${sysAlign.length} cross-stream alignment(s)`)
  if (sysHomed < sysTotal) console.log(`  ${sysTotal - sysHomed} system(s) appear on no aligned diagram and stay unaligned (correct: nothing invented)`)

  // ─── 4: system_data_elements, derived from the flows that carry them ───────
  const { data: elems } = await db.from('system_data_elements').select('id, name, organization_id, workstream_id')
  const elHits = new Map()
  for (const el of elems || []) {
    const key = norm(el.name)
    for (const d of diagrams) {
      if (d.organization_id !== el.organization_id) continue
      if (!canvasElements(d).some((n) => norm(n) === key)) continue
      const wids = [homeOf.get(d.id), ...(spansOf.get(d.id) || [])].filter(Boolean)
      const m = elHits.get(el.id) ?? elHits.set(el.id, new Map()).get(el.id)
      for (const w of wids) m.set(w, (m.get(w) || 0) + 1)
    }
  }
  let elHomed = 0
  const elAlign = []
  for (const el of elems || []) {
    const m = elHits.get(el.id)
    if (!m || !m.size) continue
    const ranked = [...m.entries()].sort((a, b) => b[1] - a[1])
    if (el.workstream_id !== ranked[0][0]) {
      const { error: e } = await db.from('system_data_elements').update({ workstream_id: ranked[0][0] }).eq('id', el.id)
      if (e) throw new Error(`data element ${el.name}: ${e.message}`)
    }
    elHomed++
    for (const [wid] of ranked.slice(1)) elAlign.push({ organization_id: el.organization_id, workstream_id: wid, entity_type: 'data_element', entity_id: el.id })
  }
  if (elAlign.length) await db.from('workstream_alignments').upsert(elAlign, { onConflict: 'workstream_id,entity_type,entity_id' })
  const elTotal = (elems || []).length
  console.log(`✓ ${elHomed}/${elTotal} data element(s) homed from the flows that carry them, ${elAlign.length} cross-stream alignment(s)`)

  console.log('\nDone. Re-runnable: homing and alignments are upserts.\n')
}

main().catch((e) => { console.error(e); process.exit(1) })
