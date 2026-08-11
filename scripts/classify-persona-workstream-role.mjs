// Determine, for every persona aligned to a value stream (workstream), whether it is a
// PRIMARY persona for that stream (executes / owns the work) or a STAKEHOLDER / RECEIVER
// (consumes the stream's outputs, governs or approves it, or feeds it reference data
// from somewhere else). Writes personas.workstream_role + .workstream_role_note.
//
//   node scripts/classify-persona-workstream-role.mjs             (ANALYZE, no writes)
//   node scripts/classify-persona-workstream-role.mjs --apply     (write the determination)
//   node scripts/classify-persona-workstream-role.mjs --apply --reclassify   (redo all)
//
// IDEMPOTENT: only classifies personas whose workstream_role is null unless --reclassify.
// Personas with no workstream_id are skipped (align them first with
// scripts/assign-personas-to-workstreams.mjs).
//
// The determination is an AI pass grounded in whatever structural evidence the model
// already holds: SIPOC supplier/consumer counts on the stream's capabilities, and BPMN
// swimlane hits in the stream's process flows. That evidence is partial (not every
// capability carries a workstream, not every lane is bound to a persona), so it is fed
// to the model as a hint rather than used as the rule.

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
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.WORKSTREAM_MODEL || 'claude-sonnet-4-6'
if (!SUPA_URL || !SRK) { console.error('Missing Supabase URL / service key'); process.exit(1) }
if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1) }

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const RECLASSIFY = args.includes('--reclassify')
const ORG = (args.indexOf('--org') >= 0 && args[args.indexOf('--org') + 1]) || '6e08fb20-59b3-4ea7-8d5d-48b0fc0b1f24'
const BATCH = 25

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
async function patch(path, body) {
  const res = await fetch(`${REST}/${path}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`PATCH ${path} -> ${res.status} ${await res.text()}`)
}

const CLASSIFY_TOOL = {
  name: 'classify_personas',
  description: 'For each persona, decide whether it is a primary persona for its value stream or a stakeholder/receiver of data within it.',
  input_schema: {
    type: 'object',
    properties: {
      determinations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer', description: 'The persona index from the list.' },
            role: { type: 'string', enum: ['primary', 'stakeholder'], description: "'primary' = executes/owns the stream's work; 'stakeholder' = receives its data, governs it, or feeds it from elsewhere." },
            note: { type: 'string', description: 'One short sentence (max ~20 words) justifying the call, in the language of the value stream.' },
          },
          required: ['index', 'role', 'note'],
        },
      },
    },
    required: ['determinations'],
  },
}

const SYSTEM = `You are an SAP Aerospace & Defense enterprise architect classifying personas against the value stream they are aligned to.

PRIMARY persona — performs, owns, or is accountable for the day-to-day work of THIS value stream. They would be a swimlane in the stream's process flows, they create or change its transactional data, they make the in-stream decisions, and they are the people you put in the room for a workshop on this stream. Automated/system actors count as primary when they execute the stream's processing steps.

STAKEHOLDER / RECEIVER — touches the stream mainly by receiving its outputs (reports, data, notifications, deliverables), by approving/governing/auditing it, or by supplying reference or master data that originates in another stream. Typical stakeholders/receivers:
- external parties: customer, contracting officer, DCAA, DCMA, DFAS, regulators, auditors, suppliers, subcontractors
- oversight and governance: executive leadership, board, program review boards, internal audit, compliance
- downstream consumers: analytics/BI platforms and reporting consumers that read the stream's data but do not run it
- personas whose real operating home is a different value stream and who only interact with this one at the boundary

Judge by the persona's actual work, not by its title's seniority. A Controller is primary in Record-to-Report but a stakeholder in Plan-to-Produce. When a persona both executes and receives, ask what would break if they were removed: if the stream cannot run, it is primary; if only visibility or approval is lost, it is a stakeholder/receiver.

The evidence counts you are given are partial and only a hint. "supplies" = the persona is a SIPOC supplier of inputs to capabilities in this stream. "receives" = the persona is a SIPOC consumer of the stream's outputs. "swimlanes" = the persona owns a lane in one of the stream's BPMN flows (a strong primary signal). Zero counts mean no data, not absence of involvement.`

function evidenceLine(e) {
  if (!e) return 'no modeled evidence'
  const parts = []
  if (e.lanes) parts.push(`${e.lanes} swimlane${e.lanes === 1 ? '' : 's'}`)
  parts.push(`supplies ${e.sup}`, `receives ${e.con}`)
  const other = e.otherStreams?.length ? `; also active in ${e.otherStreams.join(', ')}` : ''
  return parts.join(', ') + other
}

async function classify(batch, wsById) {
  const user = `Personas to classify (each with the value stream it is aligned to, then its modeled evidence inside that stream):

${batch.map((p, i) => {
  const w = wsById.get(p.workstream_id)
  return `${i + 1}. ${p.name}${p.role ? ` — role: ${p.role}` : ''}${p.description ? ` — ${p.description}` : ''}
   value stream: ${w?.name ?? '?'}${w?.description ? ` (${w.description})` : ''}
   evidence: ${evidenceLine(p.__ev)}`
}).join('\n')}

Return one determination per persona (by index).`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 3000, temperature: 0, system: SYSTEM, tools: [CLASSIFY_TOOL], tool_choice: { type: 'tool', name: CLASSIFY_TOOL.name }, messages: [{ role: 'user', content: user }] }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const block = (data.content || []).find((b) => b.type === 'tool_use')
  return block?.input?.determinations ?? []
}

// ─── Structural evidence: SIPOC supplier/consumer + BPMN swimlanes, per stream ───
function buildEvidence({ personas, wsRows, maps, caps, ins, outs, models, nodes }) {
  const mapWs = new Map(maps.map((m) => [m.id, m.workstream_id]))
  const capWs = new Map(caps.map((c) => [c.id, c.workstream_id || mapWs.get(c.capability_map_id) || null]))
  const pById = new Map(personas.map((p) => [p.id, p]))
  const ev = new Map() // personaId -> Map(wsId -> {sup, con, lanes})
  const cell = (pid, wid) => {
    if (!pid || !wid || !pById.has(pid)) return null
    if (!ev.has(pid)) ev.set(pid, new Map())
    const m = ev.get(pid)
    if (!m.has(wid)) m.set(wid, { sup: 0, con: 0, lanes: 0 })
    return m.get(wid)
  }
  for (const i of ins) { const w = capWs.get(i.capability_id); for (const pid of i.supplier_persona_ids || []) { const c = cell(pid, w); if (c) c.sup++ } }
  for (const o of outs) { const w = capWs.get(o.capability_id); for (const pid of o.consumer_persona_ids || []) { const c = cell(pid, w); if (c) c.con++ } }

  // Lanes: graph_data.lanes carry personaId when bound, otherwise match the label by name.
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const pByName = new Map(personas.map((p) => [norm(p.name), p]))
  const modelById = new Map(models.map((m) => [m.id, m]))
  for (const n of nodes) {
    const model = modelById.get(n.process_model_id)
    if (!model || model.archived_at) continue
    const wid = n.workstream_id || model.workstream_id
    for (const l of n.graph_data?.lanes || []) {
      const p = (l.personaId && pById.get(l.personaId)) || pByName.get(norm(l.label))
      const c = p && cell(p.id, wid)
      if (c) c.lanes++
    }
  }
  return ev
}

async function main() {
  const [wsRows, personas, maps, caps, ins, outs, models, nodes] = await Promise.all([
    fetchAll(`workstreams?organization_id=eq.${ORG}&select=id,code,name,description,sort_order&archived_at=is.null`),
    fetchAll(`personas?organization_id=eq.${ORG}&select=id,name,role,description,workstream_id,workstream_role`),
    fetchAll(`capability_maps?organization_id=eq.${ORG}&select=id,workstream_id`),
    fetchAll(`capabilities?select=id,capability_map_id,workstream_id`),
    fetchAll(`capability_inputs?select=capability_id,supplier_persona_ids`),
    fetchAll(`capability_outputs?select=capability_id,consumer_persona_ids`),
    fetchAll(`process_models?organization_id=eq.${ORG}&select=id,workstream_id,archived_at`),
    fetchAll(`process_nodes?select=id,process_model_id,workstream_id,graph_data`),
  ])
  const wsById = new Map(wsRows.map((w) => [w.id, w]))
  const ev = buildEvidence({ personas, wsRows, maps, caps, ins, outs, models, nodes })

  const aligned = personas.filter((p) => p.workstream_id && wsById.has(p.workstream_id))
  const todo = RECLASSIFY ? aligned : aligned.filter((p) => !p.workstream_role)
  console.log(`Personas: ${personas.length} total, ${aligned.length} aligned to a value stream, ${todo.length} to determine.`)
  if (!todo.length) { console.log('Nothing to do.'); return }

  // Attach each persona's evidence inside its own stream (+ where else it shows up).
  for (const p of todo) {
    const m = ev.get(p.id)
    const home = m?.get(p.workstream_id)
    const others = [...(m?.entries() ?? [])]
      .filter(([wid, c]) => wid !== p.workstream_id && c.sup + c.con + c.lanes >= 5)
      .sort((a, b) => (b[1].sup + b[1].con) - (a[1].sup + a[1].con))
      .slice(0, 3)
      .map(([wid]) => wsById.get(wid)?.code ?? wid)
    p.__ev = home ? { ...home, otherStreams: others } : (others.length ? { sup: 0, con: 0, lanes: 0, otherStreams: others } : null)
  }

  const results = [] // {persona, role, note}
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH)
    const dets = await classify(batch, wsById)
    const byIndex = new Map(dets.map((d) => [d.index, d]))
    batch.forEach((p, j) => {
      const d = byIndex.get(j + 1)
      if (!d || (d.role !== 'primary' && d.role !== 'stakeholder')) return
      results.push({ persona: p, role: d.role, note: (d.note || '').trim().slice(0, 240) })
    })
    process.stdout.write(`  determined ${Math.min(i + BATCH, todo.length)}/${todo.length}\r`)
  }

  console.log('\n')
  for (const w of [...wsRows].sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))) {
    const list = results.filter((r) => r.persona.workstream_id === w.id)
    if (!list.length) continue
    const prim = list.filter((r) => r.role === 'primary')
    const stak = list.filter((r) => r.role === 'stakeholder')
    console.log(`${w.name}  —  ${prim.length} primary / ${stak.length} stakeholder`)
    for (const r of prim) console.log(`   [P] ${r.persona.name}  · ${r.note}`)
    for (const r of stak) console.log(`   [S] ${r.persona.name}  · ${r.note}`)
    console.log('')
  }
  const missed = todo.length - results.length
  if (missed) console.log(`(${missed} persona(s) returned no determination)`)

  if (!APPLY) { console.log('\nANALYZE only. Re-run with --apply to write personas.workstream_role.'); return }

  console.log('Applying...')
  // Group identical (role, note) is unlikely, so patch per persona but in parallel batches.
  for (let i = 0; i < results.length; i += 20) {
    const chunk = results.slice(i, i + 20)
    await Promise.all(chunk.map((r) => patch(`personas?id=eq.${r.persona.id}`, { workstream_role: r.role, workstream_role_note: r.note })))
    process.stdout.write(`  wrote ${Math.min(i + 20, results.length)}/${results.length}\r`)
  }
  console.log(`\nDone. ${results.filter(r => r.role === 'primary').length} primary, ${results.filter(r => r.role === 'stakeholder').length} stakeholder/receiver.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
