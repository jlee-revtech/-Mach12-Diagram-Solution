// ─────────────────────────────────────────────────────────────
// Generate a starter BPMN swimlane flow for EVERY reference leaf so the
// catalog isn't blank when instantiated. Output is cached to
// scripts/reference-graphs.json (keyed by node path) and merged into the
// seed by seed-reference.mjs. Resumable: re-run to fill any gaps.
//
//   node scripts/gen-reference-graphs.mjs            # fill missing
//   node scripts/gen-reference-graphs.mjs --force    # regenerate all
//
// Reads ANTHROPIC_API_KEY from .env.local. Content is generic/A&D and
// carries no client identifiers.
// ─────────────────────────────────────────────────────────────
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { enumerateLeaves } from './seed-reference.mjs'

const DIR = dirname(fileURLToPath(import.meta.url))
const CACHE = join(DIR, 'reference-graphs.json')
const FORCE = process.argv.includes('--force')
const CONCURRENCY = 6
const MODEL = 'claude-sonnet-4-6'

// ── API key from .env.local ──
function loadKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  const env = readFileSync(join(DIR, '..', '.env.local'), 'utf8')
  const m = env.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+)\s*$/m)
  if (!m) throw new Error('ANTHROPIC_API_KEY not found in env or .env.local')
  return m[1].trim().replace(/^["']|["']$/g, '')
}
const client = new Anthropic({ apiKey: loadKey() })

const BPMN_TYPES = new Set([
  'startEvent', 'endEvent', 'intermediateEvent', 'task', 'userTask', 'serviceTask',
  'manualTask', 'subProcess', 'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway',
])

const PROMPT = (name, desc) => `You are an expert SAP S/4HANA process architect for Aerospace & Defense / GovCon.
Draft a realistic BPMN 2.0 swimlane flow for the process "${name}".
${desc ? `Process intent: ${desc}` : ''}

Return ONLY valid JSON matching this schema (no markdown):
{
  "lanes": [ { "id": "lane1", "label": "Role or System", "order": 0 } ],
  "nodes": [ { "id": "n1", "elementType": "startEvent|endEvent|intermediateEvent|task|userTask|serviceTask|manualTask|subProcess|exclusiveGateway|parallelGateway|inclusiveGateway", "label": "Step", "laneId": "lane1", "x": 90, "y": 50 } ],
  "edges": [ { "id": "e1", "source": "n1", "target": "n2", "kind": "sequence|conditional|default", "label": "" } ]
}

Rules:
- 2-4 lanes (the responsible roles/systems). Lane order=k occupies y in [k*150, k*150+150); set node y ~ order*150+50.
- Flow left-to-right: x starts ~90, +185 per sequential step.
- Exactly one startEvent; at least one endEvent. Use a gateway for the key decision and label conditional edges.
- 6-12 nodes. Generic, professional A&D/GovCon terminology. No company names, no people, no custom system/object names.
- Every node has a unique id and a laneId that exists in "lanes".`

function normalize(data) {
  const lanes = (data.lanes || []).map((l, i) => ({
    id: String(l.id || `lane${i}`), label: l.label || `Lane ${i + 1}`,
    order: typeof l.order === 'number' ? l.order : i, systemId: null,
  }))
  if (lanes.length === 0) lanes.push({ id: 'lane0', label: 'Process', order: 0, systemId: null })
  const laneIds = new Set(lanes.map(l => l.id))
  const laneOrder = Object.fromEntries(lanes.map(l => [l.id, l.order]))
  const nodes = (data.nodes || []).map((n, i) => {
    const laneId = n.laneId && laneIds.has(String(n.laneId)) ? String(n.laneId) : lanes[0].id
    const elementType = BPMN_TYPES.has(n.elementType) ? n.elementType : 'task'
    return {
      id: String(n.id || `n${i}`),
      type: 'processElement',
      position: {
        x: Number.isFinite(n.x) ? Number(n.x) : 90 + i * 185,
        y: Number.isFinite(n.y) ? Number(n.y) : (laneOrder[laneId] ?? 0) * 150 + 50,
      },
      data: { label: n.label || 'Step', elementType, laneId },
    }
  })
  const ids = new Set(nodes.map(n => n.id))
  const edges = (data.edges || [])
    .filter(e => e.source && e.target && ids.has(String(e.source)) && ids.has(String(e.target)))
    .map((e, i) => ({
      id: String(e.id || `e${i}`), source: String(e.source), target: String(e.target),
      type: 'sequenceFlow', data: { kind: e.kind || 'sequence', ...(e.label ? { label: e.label } : {}) },
    }))
  return { lanes, nodes, edges }
}

async function genOne(leaf) {
  const res = await client.messages.create({
    model: MODEL, max_tokens: 3000,
    messages: [{ role: 'user', content: PROMPT(leaf.name, leaf.description) }],
  })
  const text = res.content[0].type === 'text' ? res.content[0].text : ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const data = JSON.parse(cleaned)
  const g = normalize(data)
  if (!g.nodes.length) throw new Error('empty graph')
  return g
}

async function run() {
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
  const leaves = enumerateLeaves().filter(l => !l.hasGraph) // hand-authored leaves keep their graph
  const todo = leaves.filter(l => FORCE || !cache[l.path])
  console.log(`${leaves.length} leaves; ${todo.length} to generate (${leaves.length - todo.length} cached). Model: ${MODEL}`)

  let done = 0, failed = 0
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async leaf => {
      try {
        cache[leaf.path] = await genOne(leaf)
        done++
      } catch (e) {
        failed++
        console.warn(`  ! ${leaf.name}: ${e instanceof Error ? e.message : e}`)
      }
    }))
    writeFileSync(CACHE, JSON.stringify(cache, null, 0), 'utf8') // checkpoint after each batch
    console.log(`  ${Math.min(i + CONCURRENCY, todo.length)}/${todo.length} (ok ${done}, fail ${failed})`)
  }
  console.log(`Done. Cache: ${CACHE} (${Object.keys(cache).length} graphs). Failed: ${failed}`)
}

run().catch(e => { console.error(e); process.exit(1) })
