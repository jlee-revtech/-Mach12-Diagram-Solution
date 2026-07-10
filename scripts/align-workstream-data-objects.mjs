// Align each workstream's DATA OBJECTS to it, derived from the data-architecture
// diagrams generated per capability. Every diagram's flows carry named data
// objects (edges[].data.dataElements[].name); this rolls those up per workstream
// and registers them as workstream-homed information_products so the Workstreams
// overview cards show a real data-object count instead of 0.
//
//   node scripts/align-workstream-data-objects.mjs            (ANALYZE, no writes)
//   node scripts/align-workstream-data-objects.mjs --apply    (write information_products)
//
// IDEMPOTENT: skips a (workstream, data object) that already has a workstream-homed
// information_product carrying the batch marker. Re-runnable.

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SRK = process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY
if (!SUPA_URL || !SRK) { console.error('Missing Supabase URL / service key'); process.exit(1) }

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const ORG = (args.indexOf('--org') >= 0 && args[args.indexOf('--org') + 1]) || '6e08fb20-59b3-4ea7-8d5d-48b0fc0b1f24'
const MARKER = 'capability-data-architecture-batch'

const REST = `${SUPA_URL}/rest/v1`
const H = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Accept: 'application/json' }

async function fetchAll(path) {
  const rows = []
  const PAGE = 500
  for (let offset = 0; ; offset += PAGE) {
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`${REST}/${path}${sep}limit=${PAGE}&offset=${offset}`, { headers: H })
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`)
    const chunk = await res.json()
    rows.push(...chunk)
    if (chunk.length < PAGE) break
  }
  return rows
}
async function post(path, body) {
  const res = await fetch(`${REST}/${path}`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status} ${await res.text()}`)
}

const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const norm = (s) => cleanName(s).toLowerCase()
// Collapse near-duplicate names to one dedup key so variants like "Incurred Cost
// Submission", "Incurred Cost Submission (ICS)", and "Incurred Cost Submission Data"
// map together (display keeps the first-seen full name). Conservative: drops
// parentheticals, a trailing "data", and a simple trailing plural.
function dedupKey(s) {
  let k = norm(s).replace(/\([^)]*\)/g, ' ').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
  k = k.replace(/\bdata\b$/,'').trim()
  k = k.replace(/s$/, '')
  return k.replace(/\s+/g, ' ').trim()
}

async function main() {
  const [wsRows, diagrams] = await Promise.all([
    fetchAll(`workstreams?organization_id=eq.${ORG}&select=id,name,code,sort_order`),
    fetchAll(`diagrams?organization_id=eq.${ORG}&diagram_kind=eq.architecture&select=id,workstream_id,canvas_data`),
  ])
  const wsById = new Map(wsRows.map((w) => [w.id, w]))

  // Recurring data objects are the real ones; one-off names are AI naming
  // variance. Track, per workstream, each data object's display name and the set
  // of distinct diagrams it appears in, then keep only those seen in >= MIN_DIAGS.
  const MIN_DIAGS = parseInt((args.indexOf('--min') >= 0 && args[args.indexOf('--min') + 1]) || '3', 10)
  // workstream_id -> Map(normName -> { display, diags:Set })
  const byWs = new Map()
  let edgeCount = 0
  for (const d of diagrams) {
    const wid = d.workstream_id
    if (!wid || !wsById.has(wid)) continue
    const cd = d.canvas_data || {}
    if ((cd.generatedBy || '') !== MARKER) continue
    let m = byWs.get(wid)
    if (!m) { m = new Map(); byWs.set(wid, m) }
    const seenInThisDiagram = new Set()
    for (const e of cd.edges || []) {
      for (const de of e?.data?.dataElements || []) {
        const nm = cleanName(de?.name)
        if (!nm) continue
        edgeCount++
        const k = dedupKey(nm)
        if (!k) continue
        let rec = m.get(k)
        if (!rec) { rec = { display: nm, diags: new Set() }; m.set(k, rec) }
        else if (nm.length < rec.display.length) rec.display = nm // prefer the shortest variant
        if (!seenInThisDiagram.has(k)) { rec.diags.add(d.id); seenInThisDiagram.add(k) }
      }
    }
  }

  // Kept set per workstream at the chosen recurrence threshold.
  const keptByWs = new Map()
  for (const [wid, m] of byWs) {
    const kept = new Map()
    for (const [k, rec] of m) if (rec.diags.size >= MIN_DIAGS) kept.set(k, rec.display)
    keptByWs.set(wid, kept)
  }

  console.log(`Scanned ${diagrams.filter((d) => (d.canvas_data?.generatedBy) === MARKER).length} generated diagrams, ${edgeCount} data-object references.`)
  console.log(`Recurrence threshold: appears in >= ${MIN_DIAGS} of the workstream's diagrams.`)
  const ordered = [...wsRows].sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
  let grand = 0
  console.log(`\n${'workstream'.padEnd(26)}${'all'.padStart(6)}${'>=2'.padStart(6)}${'>=3'.padStart(6)}${'>=4'.padStart(6)}${'KEPT'.padStart(7)}`)
  for (const w of ordered) {
    const m = byWs.get(w.id) ?? new Map()
    const at = (t) => [...m.values()].filter((r) => r.diags.size >= t).length
    const kept = keptByWs.get(w.id)?.size ?? 0
    grand += kept
    console.log(`${w.code.padEnd(26)}${String(m.size).padStart(6)}${String(at(2)).padStart(6)}${String(at(3)).padStart(6)}${String(at(4)).padStart(6)}${String(kept).padStart(7)}`)
  }
  console.log(`${'TOTAL kept'.padEnd(50)}${String(grand).padStart(7)}`)

  if (args.includes('--sample')) {
    const w = ordered.find((x) => x.code === (args[args.indexOf('--sample') + 1] || 'record-to-report')) || ordered[0]
    const kept = [...(keptByWs.get(w.id)?.values() ?? [])].sort()
    console.log(`\nSample kept data objects for ${w.code} (${kept.length}):\n  ${kept.join('\n  ')}`)
  }

  if (!APPLY) { console.log('\nANALYZE only. Re-run with --apply [--min N] to write information_products.'); return }

  // Idempotency: skip (workstream, name) already present as a batch-marked IP.
  const existingIps = await fetchAll(`information_products?organization_id=eq.${ORG}&select=name,workstream_id,category`)
  const existingKey = new Set(existingIps.filter((ip) => ip.workstream_id).map((ip) => `${ip.workstream_id}::${dedupKey(ip.name)}`))

  const rows = []
  for (const [wid, kept] of keptByWs) {
    for (const [k, display] of kept) {
      if (existingKey.has(`${wid}::${k}`)) continue
      rows.push({ organization_id: ORG, name: display, workstream_id: wid, category: 'Data Architecture' })
    }
  }
  console.log(`\nInserting ${rows.length} workstream-homed information_products...`)
  for (let i = 0; i < rows.length; i += 200) {
    await post('information_products', rows.slice(i, i + 200))
    process.stdout.write(`  ${Math.min(i + 200, rows.length)}/${rows.length}\r`)
  }
  console.log(`\nDone. Added ${rows.length} data-object alignments.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
