// Assign each persona to its best-fit value stream (workstream) so the Workstreams
// overview cards show a real Personas count instead of 0. Personas do not carry a
// deterministic workstream signal, so this classifies each one (name + role +
// description) into the 13 canonical value streams with a temperature-0 AI pass,
// then sets personas.workstream_id.
//
//   node scripts/assign-personas-to-workstreams.mjs            (ANALYZE, no writes)
//   node scripts/assign-personas-to-workstreams.mjs --apply    (set workstream_id)
//
// IDEMPOTENT: only classifies personas that are not already aligned. Re-runnable.

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
const ORG = (args.indexOf('--org') >= 0 && args[args.indexOf('--org') + 1]) || '6e08fb20-59b3-4ea7-8d5d-48b0fc0b1f24'
const BATCH = 50

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
  name: 'assign_personas',
  description: 'Assign each persona to the single best-fit value stream by its primary responsibility.',
  input_schema: {
    type: 'object',
    properties: {
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer', description: 'The persona index from the list.' },
            workstream_code: { type: 'string', description: "The best-fit value-stream code, or 'none' only if the persona is genuinely enterprise-wide with no primary stream." },
          },
          required: ['index', 'workstream_code'],
        },
      },
    },
    required: ['assignments'],
  },
}

async function classify(batch, wsList) {
  const system = `You are an SAP Aerospace & Defense enterprise architect. Assign each persona to the single value stream (workstream) that best matches the persona's PRIMARY responsibility. A persona is a role, department, external party, or system actor that supplies or consumes data in a process. Pick exactly one code per persona from the provided list. Use 'none' only when a persona is genuinely enterprise-wide with no primary stream. Prefer assigning a best-fit stream over 'none'. Examples: a Cost Accountant -> record-to-report; a Buyer or Subcontract Administrator -> source-to-pay; a Contracts Manager or Proposal Manager -> offer-to-cash; a Control Account Manager or Scheduler -> plan-to-perform; a Production Planner -> plan-to-produce; a Design Engineer -> design-to-release; a Warehouse Clerk -> inventory-to-deliver; a Property Administrator -> acquire-to-retire; a Maintenance Planner -> sustainment-mro; a Recruiter or Timekeeper -> hire-to-retire; a Security Officer or Role Administrator -> security-authorization; a BI Developer -> analytics-reporting; a Developer or Integration Specialist -> development-technology.`
  const user = `Value streams (code: name — description):
${wsList.map((w) => `- ${w.code}: ${w.name} — ${w.description || ''}`).join('\n')}

Personas to assign:
${batch.map((p, i) => `${i + 1}. ${p.name}${p.role ? ` — role: ${p.role}` : ''}${p.description ? ` — ${p.description}` : ''}`).join('\n')}

Return one assignment per persona (by index).`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, temperature: 0, system, tools: [CLASSIFY_TOOL], tool_choice: { type: 'tool', name: CLASSIFY_TOOL.name }, messages: [{ role: 'user', content: user }] }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const block = (data.content || []).find((b) => b.type === 'tool_use')
  return block?.input?.assignments ?? []
}

async function main() {
  const [wsRows, personas] = await Promise.all([
    fetchAll(`workstreams?organization_id=eq.${ORG}&select=id,code,name,description,sort_order&archived_at=is.null`),
    fetchAll(`personas?organization_id=eq.${ORG}&select=id,name,role,description,workstream_id`),
  ])
  const wsByCode = new Map(wsRows.map((w) => [w.code, w]))
  const wsById = new Map(wsRows.map((w) => [w.id, w]))
  const todo = personas.filter((p) => !p.workstream_id)
  console.log(`Personas: ${personas.length} total, ${personas.length - todo.length} already aligned, ${todo.length} to classify.`)
  if (!todo.length) { console.log('Nothing to do.'); return }

  const assignByCode = new Map() // code -> [personaId]
  let none = 0
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH)
    const assignments = await classify(batch, wsRows.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99)))
    const byIndex = new Map(assignments.map((a) => [a.index, a.workstream_code]))
    batch.forEach((p, j) => {
      const code = byIndex.get(j + 1)
      if (!code || code === 'none' || !wsByCode.has(code)) { none++; return }
      const arr = assignByCode.get(code) ?? []
      arr.push(p)
      assignByCode.set(code, arr)
    })
    process.stdout.write(`  classified ${Math.min(i + BATCH, todo.length)}/${todo.length}\r`)
  }

  console.log('\n\nProposed assignments by value stream:')
  for (const w of wsRows.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))) {
    const list = assignByCode.get(w.code) ?? []
    if (list.length) console.log(`\n  ${w.code} (${list.length}): ${list.map((p) => p.name).slice(0, 12).join(', ')}${list.length > 12 ? ', ...' : ''}`)
  }
  console.log(`\n  none / unassigned: ${none}`)

  if (!APPLY) { console.log('\nANALYZE only. Re-run with --apply to set personas.workstream_id.'); return }

  console.log('\nApplying...')
  for (const [code, list] of assignByCode) {
    const wid = wsByCode.get(code).id
    const ids = list.map((p) => p.id)
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      await patch(`personas?id=in.(${chunk.join(',')})`, { workstream_id: wid })
    }
    console.log(`  ${code}: ${ids.length}`)
  }
  console.log('Done.')
}

main().catch((e) => { console.error(e); process.exit(1) })
