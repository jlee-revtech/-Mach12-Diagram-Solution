// Generate a DRAFT data-architecture diagram for every capability in the seeded
// Bedrock Capability Map (cm_capabilities). One diagram per L3 capability.
//
// Pipeline per capability (HYBRID, mirrors src/lib/process/dataArchitecture.ts):
//   1. Deterministic backbone from the capability's cm_capability_systems
//      assignments (Logical Bedrock Systems + Physical Systems), resolved to the
//      org's named systems where possible.
//   2. AI-expanded enrichment (temperature > 0): the model may add realistic
//      systems, name the data elements on each flow, and organize systems into
//      role bands (System of Record / Source Systems / Downstream Consumers /
//      Integration & Analytics). Grounded in the org's 82-system catalog so it
//      reuses real product names (SAP S4 Ops, Dassian CMB, Deltek Cobra, ...).
//   3. Union merge (AI can add, never drop the backbone) -> canvas layout.
//   4. Persist a `diagrams` row (diagram_kind=architecture, workstream_id set so
//      it groups by value stream) + insert any net-new Logical Systems into
//      logical_systems so they become reusable catalog entries.
//
// IDEMPOTENT: skips any capability that already has a diagram carrying its
// sourceCapabilityId marker. Re-runnable.
//
//   node scripts/generate-capability-data-architectures.mjs [--limit N]
//        [--concurrency N] [--dry-run] [--only <substr>] [--org <uuid>]
//
// Reads .env.local for NEXT_PUBLIC_SUPABASE_URL, KNOWLEDGE_SUPABASE_SERVICE_KEY
// (service role), ANTHROPIC_API_KEY.

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

// ─── env ─────────────────────────────────────────────────────────────────────
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
const SRK = process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.WORKSTREAM_MODEL || 'claude-sonnet-4-6'
if (!SUPA_URL || !SRK) { console.error('Missing Supabase URL / service key'); process.exit(1) }
if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1) }

// ─── args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const argVal = (flag, def) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : def }
const LIMIT = parseInt(argVal('--limit', '0'), 10) || 0
const CONCURRENCY = parseInt(argVal('--concurrency', '6'), 10) || 6
const DRY_RUN = args.includes('--dry-run')
const ONLY = (argVal('--only', '') || '').toLowerCase()
const ORG = argVal('--org', '6e08fb20-59b3-4ea7-8d5d-48b0fc0b1f24') // RevTech
const CREATED_BY = 'ed35f87c-e5e2-4507-aaa8-7ac950ce61f9'           // jlee@revtech.consulting

const REST = `${SUPA_URL}/rest/v1`
const H = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Accept: 'application/json' }

// ─── system palette (the 19 SYSTEM_TEMPLATES types) ──────────────────────────
const SYSTEM_TEMPLATES = [
  ['erp', 'ERP'], ['crm', 'CRM'], ['plm', 'PLM'], ['scm', 'SCM'], ['middleware', 'Middleware'],
  ['database', 'Database'], ['data_warehouse', 'Data Warehouse'], ['analytics', 'Analytics'],
  ['mes', 'MES'], ['clm', 'CLM'], ['cloud', 'Cloud'], ['legacy', 'Legacy'], ['ppm', 'PPM'],
  ['ims', 'IMS'], ['siop', 'SIOP'], ['mps', 'MPS'], ['hcm', 'HCM'], ['fpa', 'FP&A'], ['custom', 'Custom'],
]
const VALID_TYPES = new Set(SYSTEM_TEMPLATES.map((t) => t[0]))
const LABEL_BY_TYPE = Object.fromEntries(SYSTEM_TEMPLATES)
const coerceType = (t) => (VALID_TYPES.has((t || '').trim()) ? (t || '').trim() : 'custom')
const norm = (s) => (s || '').trim().toLowerCase()
const clean = (s) => (s || '').trim()

// ─── REST helpers ────────────────────────────────────────────────────────────
async function fetchAll(path) {
  const rows = []
  const PAGE = 1000
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
async function post(path, body, prefer = 'return=minimal') {
  const res = await fetch(`${REST}/${path}`, { method: 'POST', headers: { ...H, Prefer: prefer }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status} ${await res.text()}`)
  return prefer.includes('representation') ? res.json() : null
}

// ─── layout: ArchSpec -> canvas (ported from process/dataArchitecture.ts) ─────
const SYSTEM_W = 190, SYSTEM_H = 84, SYS_GAP_X = 90, SYS_GAP_Y = 60, MAX_PER_ROW = 4
const BAND_X = 60, BAND_TOP = 60, BAND_PAD_X = 40, BAND_PAD_TOP = 56, BAND_PAD_BOTTOM = 30, BAND_GAP_Y = 60
const GROUP_COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#F43F5E', '#14B8A6']

function archSpecToCanvas(spec) {
  const systemByName = new Map()
  for (const s of spec.systems) systemByName.set(norm(s.name), s)
  const placed = new Set()
  const bands = []
  spec.groups.forEach((g, gi) => {
    const members = []
    for (const name of g.systems) {
      const key = norm(name)
      const sys = systemByName.get(key)
      if (sys && !placed.has(key)) { placed.add(key); members.push(sys) }
    }
    if (members.length) bands.push({ label: g.label, color: g.color || GROUP_COLORS[gi % GROUP_COLORS.length], systems: members })
  })
  const leftovers = spec.systems.filter((s) => !placed.has(norm(s.name)))
  if (leftovers.length) bands.push({ label: 'Shared systems', color: '#64748B', systems: leftovers })

  const systemNodes = []
  const groupNodes = []
  const nodeIdByName = new Map()
  let cursorY = BAND_TOP
  for (const band of bands) {
    const count = band.systems.length
    const perRow = Math.min(MAX_PER_ROW, count)
    const rows = Math.ceil(count / perRow)
    const width = BAND_PAD_X * 2 + perRow * SYSTEM_W + (perRow - 1) * SYS_GAP_X
    const height = BAND_PAD_TOP + rows * SYSTEM_H + (rows - 1) * SYS_GAP_Y + BAND_PAD_BOTTOM
    groupNodes.push({
      id: `group-${randomUUID()}`, type: 'systemGroup', position: { x: BAND_X, y: cursorY }, zIndex: -1,
      style: { width, height, pointerEvents: 'none' }, focusable: false,
      data: { label: band.label, color: band.color },
    })
    band.systems.forEach((sys, i) => {
      const row = Math.floor(i / perRow), col = i % perRow
      const id = `system-${randomUUID()}`
      nodeIdByName.set(norm(sys.name), id)
      systemNodes.push({
        id, type: 'system',
        position: { x: BAND_X + BAND_PAD_X + col * (SYSTEM_W + SYS_GAP_X), y: cursorY + BAND_PAD_TOP + row * (SYSTEM_H + SYS_GAP_Y) },
        data: { label: sys.name, systemType: coerceType(sys.systemType), ...(sys.description ? { description: sys.description } : {}) },
      })
    })
    cursorY += height + BAND_GAP_Y
  }
  const edges = []
  for (const f of spec.flows) {
    const source = nodeIdByName.get(norm(f.from))
    const target = nodeIdByName.get(norm(f.to))
    if (!source || !target || source === target) continue
    const dataElements = (f.dataElements.length ? f.dataElements : ['Data']).map((name) => ({ id: randomUUID(), name, elementType: 'document' }))
    edges.push({
      id: `edge-${randomUUID()}`, source, target, type: 'dataFlow',
      data: { label: f.label || (dataElements.length === 1 ? dataElements[0].name : ''), dataElements, direction: 'forward' },
    })
  }
  return { nodes: systemNodes, edges, groups: groupNodes }
}

// ─── union merge of AI spec onto the deterministic backbone ──────────────────
function mergeSpecs(base, ai) {
  if (!ai) return base
  const systems = new Map()
  for (const s of base.systems) systems.set(norm(s.name), s)
  for (const s of ai.systems ?? []) {
    const n = clean(s.name); if (!n) continue
    const key = norm(n)
    if (!systems.has(key)) systems.set(key, { name: n, systemType: coerceType(s.systemType), ...(s.description ? { description: clean(s.description) } : {}) })
    else if (s.description && !systems.get(key).description) systems.get(key).description = clean(s.description)
  }
  const flows = new Map()
  const putFlow = (f) => {
    const from = clean(f.from), to = clean(f.to)
    if (!from || !to || norm(from) === norm(to)) return
    const key = `${norm(from)}->${norm(to)}`
    let flow = flows.get(key)
    if (!flow) { flow = { from, to, dataElements: [] }; flows.set(key, flow) }
    for (const de of f.dataElements ?? []) { const d = clean(de); if (d && !flow.dataElements.some((x) => norm(x) === norm(d))) flow.dataElements.push(d) }
    if (f.label && !flow.label) flow.label = clean(f.label)
  }
  for (const f of base.flows) putFlow(f)
  for (const f of ai.flows ?? []) putFlow(f)
  const groups = new Map()
  const putGroup = (g) => {
    const label = clean(g.label); if (!label) return
    const key = norm(label)
    let grp = groups.get(key)
    if (!grp) { grp = { label, ...(g.color ? { color: g.color } : {}), systems: [] }; groups.set(key, grp) }
    for (const s of g.systems ?? []) { const n = clean(s); if (n && !grp.systems.some((x) => norm(x) === norm(n))) grp.systems.push(n) }
  }
  for (const g of base.groups) putGroup(g)
  for (const g of ai.groups ?? []) putGroup(g)
  return {
    systems: [...systems.values()],
    flows: [...flows.values()].map((f) => ({ ...f, label: f.label || (f.dataElements.length === 1 ? f.dataElements[0] : '') })),
    groups: [...groups.values()],
    title: clean(ai.title) || base.title,
    description: clean(ai.description) || base.description,
  }
}

// Snap AI-invented names onto existing catalog entries so diagrams reference real
// systems and the catalog does not accumulate near-duplicates. Matches on a loose
// key (lowercased, & -> and, punctuation/space stripped) plus a small alias map
// for high-prior SAP names the model reinvents.
// Bridge the Bedrock physical-product vocabulary (what capabilities are mapped
// to) onto the Data Architecture catalog names (what the diagrams speak).
const NAME_ALIASES = {
  'saps4hana': 'SAP S4 HANA - Ops', 's4hana': 'SAP S4 HANA - Ops', 'saps4': 'SAP S4 HANA - Ops',
  'saperp': 'SAP S4 HANA - Ops', 'sapecc': 'EAS (Legacy ERP)',
  'salesforce': 'SalesForce/CRM',
}
const looseKey = (s) => norm(s).replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '')
function buildCanonicalizer(catalog) {
  const byLoose = new Map()
  for (const c of catalog) byLoose.set(looseKey(c.name), c.name)
  return (name) => {
    const lk = looseKey(name)
    if (byLoose.has(lk)) return byLoose.get(lk)
    if (NAME_ALIASES[lk]) return NAME_ALIASES[lk]
    return clean(name)
  }
}
function canonicalizeSpec(spec, canon) {
  if (!spec) return spec
  return {
    ...spec,
    systems: (spec.systems ?? []).map((s) => ({ ...s, name: canon(s.name) })),
    flows: (spec.flows ?? []).map((f) => ({ ...f, from: canon(f.from), to: canon(f.to) })),
    groups: (spec.groups ?? []).map((g) => ({ ...g, systems: (g.systems ?? []).map(canon) })),
  }
}

function sanitizeAiSpec(raw) {
  if (!raw || typeof raw !== 'object') return null
  const arr = (x) => (Array.isArray(x) ? x : [])
  const systems = arr(raw.systems).map((s) => ({ name: String(s?.name ?? ''), systemType: coerceType(s?.systemType), ...(s?.description ? { description: String(s.description) } : {}) })).filter((s) => s.name.trim())
  const flows = arr(raw.flows).map((f) => ({ from: String(f?.from ?? ''), to: String(f?.to ?? ''), dataElements: arr(f?.dataElements).map(String), ...(f?.label ? { label: String(f.label) } : {}) })).filter((f) => f.from.trim() && f.to.trim())
  const groups = arr(raw.groups).map((g) => ({ label: String(g?.label ?? ''), ...(g?.color ? { color: String(g.color) } : {}), systems: arr(g?.systems).map(String) })).filter((g) => g.label.trim())
  return { systems, flows, groups, ...(raw.title ? { title: String(raw.title) } : {}), ...(raw.description ? { description: String(raw.description) } : {}) }
}

// ─── Anthropic enrichment ────────────────────────────────────────────────────
const STR = { type: 'string' }
const ARCH_TOOL = {
  name: 'data_architecture',
  description: 'Return a presentation-ready data-architecture spec for ONE business capability: the systems involved, directed data flows between them (each carrying named data elements), and role-based grouping bands.',
  input_schema: {
    type: 'object',
    properties: {
      title: STR,
      description: { type: 'string', description: 'One or two sentences describing this capability data architecture.' },
      systems: { type: 'array', description: 'Every system involved. Keep all provided systems; add realistic ones the capability needs (system of record, upstream feeders, downstream consumers, integration middleware, data warehouse, analytics). Reuse the exact names from the org system catalog when a system fits.', items: { type: 'object', properties: { name: STR, systemType: { type: 'string', enum: [...VALID_TYPES] }, description: STR }, required: ['name', 'systemType'] } },
      flows: { type: 'array', description: 'Directed data flows between systems (by name). Name the data element(s) that move on each flow (a document or data object, e.g. Journal Entry, Purchase Order, Bill of Materials), not a step name.', items: { type: 'object', properties: { from: STR, to: STR, dataElements: { type: 'array', items: STR }, label: STR }, required: ['from', 'to', 'dataElements'] } },
      groups: { type: 'array', description: 'Role-based grouping bands. Use bands like "System of Record", "Source Systems", "Downstream Consumers", "Integration & Analytics". Every system belongs to exactly one band.', items: { type: 'object', properties: { label: STR, color: STR, systems: { type: 'array', items: STR } }, required: ['label', 'systems'] } },
    },
    required: ['systems', 'flows', 'groups'],
  },
}

async function enrich(cap, wsName, assigned, catalog) {
  const system = `You are a world-class SAP S/4HANA + Dassian Aerospace & Defense enterprise data architect. Draw a clean, presentation-ready DATA ARCHITECTURE for ONE business capability.
- Show the system of record, the upstream systems that feed it, the downstream systems it feeds, and any integration, data warehouse, or analytics systems the data clearly passes through.
- CRITICAL: reuse the EXACT name from the org system catalog whenever that system participates (for example use "SAP S4 HANA - Ops", never "SAP S/4HANA"; use "Analytics & BI Platform", never "Analytics and BI Platform"). Only invent a new system name for a platform that is genuinely absent from the catalog.
- Include only systems that genuinely participate in THIS capability, typically 6 to 12. Do not pad the diagram with unrelated platforms.
- Every data flow must carry a concrete data element name (a document or data object that moves), not a step name.
- Organize systems into role bands: System of Record, Source Systems, Downstream Consumers, Integration & Analytics (only the bands you need). Every system belongs to exactly one band.
- Keep labels short. Never use em-dashes or en-dashes; use commas, colons, parentheses, or periods.`
  const user = `Value stream: ${wsName}
Capability group: ${cap.domain || '(none)'}
Capability (L3): ${cap.name}${cap.description ? `\nWhat it does: ${cap.description}` : ''}

Currently mapped systems (the backbone, keep these): ${assigned.length ? assigned.map((a) => `${a.name} [${a.systemType}]`).join(', ') : '(none mapped yet)'}

Org system catalog (reuse these exact names when a system fits):
${catalog.map((c) => `- ${c.name} [${c.systemType}]`).join('\n')}

Return the enriched data-architecture spec for this capability.`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2600, temperature: 0.5, system, tools: [ARCH_TOOL], tool_choice: { type: 'tool', name: ARCH_TOOL.name }, messages: [{ role: 'user', content: user }] }),
  })
  if (!res.ok) { const t = await res.text(); const err = new Error(`anthropic ${res.status}: ${t}`); err.status = res.status; throw err }
  const data = await res.json()
  const block = (data.content || []).find((b) => b.type === 'tool_use')
  return block?.input ?? null
}

async function withRetry(fn, tries = 4) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try { return await fn() } catch (e) {
      lastErr = e
      const retriable = !e.status || e.status === 429 || e.status >= 500
      if (!retriable || i === tries - 1) throw e
      await new Promise((r) => setTimeout(r, 800 * (i + 1) + Math.floor(Math.random() * 400)))
    }
  }
  throw lastErr
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Loading reference data for org ${ORG}...`)
  const [wsRows, bedrock, physical, logical, caps, capSys, existingDiag] = await Promise.all([
    fetchAll(`workstreams?organization_id=eq.${ORG}&select=id,name,code,color,sort_order`),
    fetchAll(`bedrock_systems?organization_id=eq.${ORG}&select=id,system_type,label`),
    fetchAll(`bedrock_physical_systems?select=id,bedrock_system_id,name,is_primary`),
    fetchAll(`logical_systems?organization_id=eq.${ORG}&select=id,name,system_type`),
    fetchAll(`cm_capabilities?organization_id=eq.${ORG}&archived_at=is.null&select=id,name,description,domain,workstream_id,sort_order`),
    fetchAll(`cm_capability_systems?organization_id=eq.${ORG}&select=capability_id,bedrock_system_id,physical_system_id`),
    fetchAll(`diagrams?organization_id=eq.${ORG}&diagram_kind=eq.architecture&select=id,scid:canvas_data->>sourceCapabilityId`),
  ])

  const wsById = new Map(wsRows.map((w) => [w.id, w]))
  const bedrockById = new Map(bedrock.map((b) => [b.id, b]))
  const physicalById = new Map(physical.map((p) => [p.id, p]))
  const primaryPhysical = new Map() // bedrock_system_id -> name (primary, else first)
  for (const p of physical) {
    if (!primaryPhysical.has(p.bedrock_system_id) || p.is_primary) primaryPhysical.set(p.bedrock_system_id, p.name)
  }
  const capSysByCap = new Map()
  for (const l of capSys) { const a = capSysByCap.get(l.capability_id) || []; a.push(l); capSysByCap.set(l.capability_id, a) }

  // Existing named systems (dedup + reuse) and the palette given to the AI.
  const existingLogical = new Set(logical.map((s) => norm(s.name)))
  const catalog = logical.filter((s) => s.name).map((s) => ({ name: s.name, systemType: s.system_type || 'custom' }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const canon = buildCanonicalizer(catalog)

  const doneCapIds = new Set(existingDiag.map((d) => d.scid).filter(Boolean))

  // Resolve a capability's assigned systems -> [{name, systemType}]
  const resolveAssigned = (capId) => {
    const out = []
    const seen = new Set()
    for (const l of capSysByCap.get(capId) || []) {
      let name = null, type = 'custom'
      if (l.physical_system_id) {
        const p = physicalById.get(l.physical_system_id)
        if (p) { name = p.name; type = bedrockById.get(p.bedrock_system_id)?.system_type || 'custom' }
      } else if (l.bedrock_system_id) {
        const b = bedrockById.get(l.bedrock_system_id)
        if (b) { name = primaryPhysical.get(l.bedrock_system_id) || b.label; type = b.system_type }
      }
      if (name && !seen.has(norm(name))) { seen.add(norm(name)); out.push({ name, systemType: coerceType(type) }) }
    }
    return out
  }

  // Build the work list.
  let work = caps
    .filter((c) => !doneCapIds.has(c.id))
    .filter((c) => (ONLY ? (c.name || '').toLowerCase().includes(ONLY) : true))
    .sort((a, b) => {
      const wa = wsById.get(a.workstream_id)?.sort_order ?? 999, wb = wsById.get(b.workstream_id)?.sort_order ?? 999
      return wa - wb || (a.domain || '').localeCompare(b.domain || '') || (a.sort_order - b.sort_order)
    })
  if (LIMIT) work = work.slice(0, LIMIT)

  console.log(`Capabilities: ${caps.length} total, ${doneCapIds.size} already have a diagram, ${work.length} to generate${LIMIT ? ` (limited to ${LIMIT})` : ''}.`)
  console.log(`Systems: ${logical.length} named logical systems, ${bedrock.length} bedrock logical, ${physical.length} physical.`)
  if (DRY_RUN) console.log('DRY RUN: no writes will be made.')
  if (!work.length) { console.log('Nothing to do.'); return }

  const newSystems = new Map() // normname -> {name, system_type}
  const results = []
  let idx = 0

  async function processOne(cap) {
    const ws = wsById.get(cap.workstream_id)
    const wsName = ws?.name || 'Unaligned'
    const assigned = resolveAssigned(cap.id).map((a) => ({ name: canon(a.name), systemType: a.systemType }))
    const base = {
      // Systems form the guaranteed backbone; leave grouping to the AI role bands
      // (any system the AI omits from a band lands in a "Shared systems" band).
      systems: assigned.map((a) => ({ name: a.name, systemType: a.systemType })),
      flows: [],
      groups: [],
      title: `${cap.name}: Data Architecture`,
    }
    let merged = base
    try {
      const ai = await withRetry(() => enrich(cap, wsName, assigned, catalog))
      merged = mergeSpecs(base, canonicalizeSpec(sanitizeAiSpec(ai), canon))
    } catch (e) {
      console.warn(`  ! AI enrich failed for "${cap.name}": ${e.message.slice(0, 120)} (using backbone only)`)
    }
    if (!merged.systems.length) { results.push({ cap: cap.name, skipped: 'no systems' }); return }

    const canvas = archSpecToCanvas(merged)

    // Track net-new logical systems to add to the catalog.
    for (const s of merged.systems) {
      const key = norm(s.name)
      if (!existingLogical.has(key) && !newSystems.has(key)) newSystems.set(key, { name: clean(s.name), system_type: coerceType(s.systemType) })
    }

    if (!DRY_RUN) {
      await withRetry(() => post('diagrams', {
        organization_id: ORG,
        title: merged.title,
        description: merged.description || null,
        process_context: cap.domain || cap.name,
        workstream_id: cap.workstream_id || null,
        diagram_kind: 'architecture',
        created_by: CREATED_BY,
        updated_by: CREATED_BY,
        canvas_data: {
          nodes: canvas.nodes, edges: canvas.edges, groups: canvas.groups, artifacts: [],
          sourceCapabilityId: cap.id,
          generatedBy: 'capability-data-architecture-batch',
        },
      }))
    }
    results.push({ cap: cap.name, ws: wsName, systems: canvas.nodes.length, flows: canvas.edges.length, bands: canvas.groups.length })
    const n = ++idx
    if (n % 10 === 0 || n === work.length) console.log(`  [${n}/${work.length}] ${cap.name} -> ${canvas.nodes.length} systems, ${canvas.edges.length} flows`)
  }

  // Concurrency pool.
  const queue = [...work]
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) { const cap = queue.shift(); await processOne(cap) }
  })
  await Promise.all(workers)

  // Add the net-new Logical Systems to the catalog (deduped).
  const toAdd = [...newSystems.values()]
  if (toAdd.length && !DRY_RUN) {
    console.log(`\nAdding ${toAdd.length} net-new logical systems to the catalog...`)
    // insert in chunks
    for (let i = 0; i < toAdd.length; i += 100) {
      const chunk = toAdd.slice(i, i + 100).map((s) => ({ organization_id: ORG, name: s.name, system_type: s.system_type }))
      await withRetry(() => post('logical_systems', chunk))
    }
  } else if (toAdd.length) {
    console.log(`\n[dry-run] would add ${toAdd.length} net-new logical systems.`)
  }

  const ok = results.filter((r) => !r.skipped)
  const report = {
    org: ORG, model: MODEL, dryRun: DRY_RUN, generatedAt: new Date().toISOString(),
    diagramsCreated: ok.length, skipped: results.filter((r) => r.skipped).length,
    newLogicalSystems: toAdd.map((s) => s.name).sort(),
    avgSystems: ok.length ? (ok.reduce((n, r) => n + r.systems, 0) / ok.length).toFixed(1) : 0,
    avgFlows: ok.length ? (ok.reduce((n, r) => n + r.flows, 0) / ok.length).toFixed(1) : 0,
  }
  const reportPath = join(APP_DIR, 'scripts', `capability-arch-report-${Date.now()}.json`)
  try { writeFileSync(reportPath, JSON.stringify({ ...report, results }, null, 2)) } catch { /* ignore */ }
  console.log('\n─── Summary ───')
  console.log(`Diagrams ${DRY_RUN ? 'planned' : 'created'}: ${report.diagramsCreated}`)
  console.log(`Net-new logical systems: ${toAdd.length}${toAdd.length ? ` (${report.newLogicalSystems.slice(0, 20).join(', ')}${toAdd.length > 20 ? ', ...' : ''})` : ''}`)
  console.log(`Avg systems/diagram: ${report.avgSystems}, avg flows/diagram: ${report.avgFlows}`)
  console.log(`Report: ${reportPath}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
