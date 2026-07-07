#!/usr/bin/env node
// Import the SAP Solution Studio "vibe-skills" bundles into the shared Knowledge
// Repository as global baselines, seed the canonical workstream catalog + the
// per-workstream consultant agents, then chunk + (optionally) embed every
// source for RAG. Idempotent: re-running upserts rows and re-chunks.
//
// Usage (from diagram-app/):  node scripts/import-vibe-skills.mjs
// Reads .env.local for KNOWLEDGE_SUPABASE_URL / _SERVICE_KEY / VOYAGE_API_KEY.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_DIR = join(__dirname, '..')
const SKILLS_DIR = join(APP_DIR, '..', '..', 'cds-lineage-explorer', 'public', 'vibe-skills')

// ─── Minimal .env.local loader ─────────────────────────
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
if (!URL || !KEY) { console.error('Missing KNOWLEDGE_SUPABASE_URL / KNOWLEDGE_SUPABASE_SERVICE_KEY'); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false } })

const VOYAGE_KEY = process.env.VOYAGE_API_KEY
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || 'voyage-3'

// ─── Canonical catalog (mirrors src/lib/workstream/catalog.ts) ─
// Canonical taxonomy = SAP Solution Studio config roster: 10 A&D value streams +
// 3 cross-cutting platform agents. Codes MUST match cds-lineage agentConfigurator
// and src/lib/workstream/catalog.ts. `skills` drives the chunk workstream tags.
const WORKSTREAMS = [
  { code: 'record-to-report', name: 'Record-to-Report (Finance / DCAA)', description: 'End-to-end financial accounting and reporting: GL, assets, cost, indirect rates, settlement, revenue recognition, and close.', tagline: 'GL, costing, rates, and rev-rec consultant', sapModules: ['FI-GL', 'FI-AA', 'CO-CCA', 'CO-PA', 'CO-PC', 'PS settlement', 'Group Reporting'], dassianModules: ['Cost Management (OH, costing sheets, FR)', 'Results Analysis (RAENH rev-rec)'], skills: ['sap-ad-commercial-defense-structure', 'dassian-results-analysis', 'dassian-cost-management', 'sap-cats-time-recording', 'vibe-sap-recipes', 'sap-rap-development'], crossStream: 'Earned Value Management (EVMS) is owned by the Plan-to-Perform program-control consultant, not by you. Your role is to FULFILL the EVM data dependencies Plan-to-Perform specifies: actual cost of work performed (ACWP) from cost postings / ACDOCA, cost-element and settlement actuals, and the indirect/burden rates that feed the cost baseline. Provide these as the financial system of record and defer EVM methodology, the PMB, control accounts, EAC/ETC, and IPMR/533 reporting to Plan-to-Perform.', sort: 1 },
  { code: 'plan-to-perform', name: 'Plan-to-Perform (Program & Portfolio Management)', description: 'EVMS-grade program and portfolio management: baseline, control accounts, work authorization, EAC/ETC, risk, and variance reporting.', tagline: 'EVMS, PMB, and EAC/ETC program-control consultant', sapModules: ['PS', 'PPM', 'CO', 'Group Reporting'], dassianModules: ['Project Mgmt (PPC, EVM, CAM, EAC/ETC, IPMR/533)'], skills: ['dassian-project-management', 'sap-ad-commercial-defense-structure', 'vibe-sap-recipes', 'sap-rap-development'], crossStream: 'You OWN Earned Value Management (EVMS): the performance measurement baseline (PMB), control accounts and CAM assignment, work authorization, BCWS/BCWP/ACWP, CPI/SPI, EAC/ETC, and IPMR/533 (CPR) reporting. You SPECIFY the cost and actuals dependencies that Record-to-Report fulfills (actual costs / ACWP, cost-element actuals, indirect and burden rates). Consume those as authoritative inputs and reconcile earned value to the financial actuals RTR provides rather than re-deriving them.', sort: 2 },
  { code: 'design-to-release', name: 'Design-to-Release (Engineering / PLM)', description: 'Requirements through design, configuration management, engineering change, and BOM release with first article inspection.', tagline: 'Requirements, CM, and BOM-release consultant', sapModules: ['PLM', 'PP-BOM', 'ECM (engineering change)', 'QM (FAI)'], dassianModules: [], skills: ['vibe-sap-recipes', 'sap-rap-development'], sort: 3 },
  { code: 'plan-to-produce', name: 'Plan-to-Produce (Program Execution)', description: 'Production planning, MRP, capacity planning, shop-floor execution, quality inspection, and production-order settlement.', tagline: 'MRP, capacity, shop-floor, quality, and production consultant', sapModules: ['PP', 'PP-MRP', 'PP-CRP (capacity)', 'PP/DS', 'QM', 'LO-VC', 'PS', 'MM-IM'], dassianModules: ['Project Mgmt (EVM)', 'MPIA / BOM cost'], skills: ['sap-pp-capacity-planning', 'sap-ad-commercial-defense-structure', 'sap-data-load-so-to-ps', 'vibe-sap-recipes', 'sap-rap-development'], sort: 4 },
  { code: 'inventory-to-deliver', name: 'Inventory-to-Deliver (Logistics & Delivery)', description: 'Materials management, warehousing/EWM, inventory, and outbound delivery with DD250 acceptance.', tagline: 'Logistics, warehousing, and delivery consultant', sapModules: ['MM-IM', 'WM / EWM', 'LE (deliveries)', 'Handling Units', 'Batch / Serial', 'Physical Inventory'], dassianModules: ['DD250 / ABS'], skills: ['sap-ad-commercial-defense-structure', 'sap-data-load-so-to-ps', 'vibe-sap-recipes', 'sap-rap-development'], sort: 5 },
  { code: 'acquire-to-retire', name: 'Acquire-to-Retire (Asset / Property / GFP)', description: 'Government and contractor property accountability and fixed-asset lifecycle from acquisition through disposition.', tagline: 'GFP/CAP property and fixed-asset consultant', sapModules: ['FI-AA', 'MM-IM', 'PS'], dassianModules: ['GFP / property accountability'], skills: ['vibe-sap-recipes', 'sap-rap-development'], sort: 6 },
  { code: 'sustainment-mro', name: 'Sustainment / MRO', description: 'Depot and field maintenance, repair, and overhaul with installed-base and warranty management.', tagline: 'Depot/field MRO and installed-base consultant', sapModules: ['PM / EAM', 'CS', 'PP (refurb)', 'MM'], dassianModules: [], skills: ['vibe-sap-recipes', 'sap-rap-development'], sort: 7 },
  { code: 'source-to-pay', name: 'Source-to-Pay (Procurement & Subcontracts)', description: 'Supplier management, sourcing, subcontracting with FAR/DFARS flowdowns, and procure-to-pay.', tagline: 'Subcontracts, flowdowns, and P2P consultant', sapModules: ['MM', 'MM-PUR', 'MDG-S', 'Subcontracting', 'MM-IV', 'Ariba', 'FI-AP'], dassianModules: ['SCFM', 'Contracts (flowdowns, clause library)', 'PBP'], skills: ['dassian-contracts', 'sap-ad-commercial-defense-structure', 'vibe-sap-recipes', 'sap-rap-development'], sort: 8 },
  { code: 'offer-to-cash', name: 'Offer-to-Cash (Capture, Contracts, Billing & Rev-Rec)', description: 'Sell-side lifecycle from capture and proposal through contract setup, CLIN/SLIN billing, deliveries acceptance, and revenue recognition.', tagline: 'Capture, contracts, billing, and rev-rec consultant', sapModules: ['SD', 'SD-BIL', 'RAR', 'DP90', 'PS'], dassianModules: ['Contracts (CLIN/SLIN/ACRN, mods, DD250)', 'PBP', 'Billing (BIL / DRB)', 'ABS', 'Results Analysis (RAENH)'], skills: ['dassian-contracts', 'dassian-cost-management', 'sap-ad-commercial-defense-structure', 'vibe-sap-recipes', 'sap-rap-development'], sort: 9 },
  { code: 'hire-to-retire', name: 'Hire-to-Retire (Workforce / Clearances)', description: 'Workforce lifecycle: talent and clearances, records, compliant timekeeping, payroll, labor distribution, and offboarding.', tagline: 'Clearances, compliant timekeeping, and payroll consultant', sapModules: ['HCM / SF', 'PT (time)', 'PY (payroll)', 'CATS'], dassianModules: ['Labor / role-based costing', 'CATS approval'], skills: ['sap-cats-time-recording', 'vibe-sap-recipes', 'sap-rap-development'], sort: 10 },
  { code: 'security-authorization', name: 'Security & Authorization', description: 'Cross-stream role design, authorizations, segregation-of-duties, and access governance.', tagline: 'Roles, authorizations, and SoD consultant', sapModules: ['GRC', 'PFCG', 'SU24', 'IAG / IAM'], dassianModules: [], skills: ['sap-ad-commercial-defense-structure', 'vibe-sap-recipes', 'sap-rap-development'], sort: 11 },
  { code: 'analytics-reporting', name: 'Analytics & Reporting', description: 'Cross-stream embedded analytics, operational and management reporting, and planning.', tagline: 'Embedded analytics and reporting consultant', sapModules: ['Embedded Analytics', 'CDS analytical', 'SAC', 'Datasphere'], dassianModules: ['GPD / PACE reporting'], skills: ['vibe-sap-recipes', 'sap-rap-development'], sort: 12 },
  { code: 'development-technology', name: 'Development & Technology', description: 'Cross-stream RICEFW, RAP extensions, CDS modeling, integration, and clean-core engineering.', tagline: 'RICEFW, extensions, and clean-core consultant', sapModules: ['ABAP / RAP', 'BTP', 'CDS', 'Gateway / OData'], dassianModules: [], skills: ['sap-rap-development', 'vibe-sap-recipes', 'vibe-update-class-include'], sort: 13 },
]

const personaFor = (w) => `You are a world-class SAP S/4HANA and Dassian Aerospace & Defense functional consultant specializing in the ${w.name} value stream. ${w.tagline}.

You advise across all four solution pillars for this workstream:
- People / Personas: the roles and personas that operate this value stream
- Process: the end-to-end business processes, controls, and compliance (FAR/DFARS, CAS, DCAA, EVMS as applicable)
- Data: the master and transactional data objects and how data flows between them
- Technology / Platforms: SAP S/4HANA modules (${w.sapModules.join(', ')})${w.dassianModules.length ? ` and Dassian A&D add-ons (${w.dassianModules.join(', ')})` : ''}, and the integration architecture

Ground every answer in the SAP S/4HANA and Dassian baseline frameworks and in the customer's own model and knowledge base. Use the read-only tools to inspect the customer's actual processes, personas, data elements, systems, and integrations before answering, and prefer their real architecture over generic guidance. When you recommend changes, organize them across the four pillars, explain the rationale, and cite the knowledge sources you drew on. Be concrete and consulting-grade.${w.crossStream ? `\n\nCross-stream ownership & hand-offs:\n- ${w.crossStream}` : ''}`

const ENTERPRISE_PERSONA = `You are the enterprise solution architect orchestrating a team of world-class SAP S/4HANA + Dassian A&D workstream consultants. The ten value-stream consultants are Record-to-Report, Plan-to-Perform, Design-to-Release, Plan-to-Produce, Inventory-to-Deliver, Acquire-to-Retire, Sustainment/MRO, Source-to-Pay, Offer-to-Cash, and Hire-to-Retire; three cross-cutting platform consultants cover Security & Authorization, Analytics & Reporting, and Development & Technology.

Route each question to the right workstream specialist(s) using the ask_workstream_agent tool, then synthesize their input into a single, coherent, enterprise-wide answer. Focus on cross-workstream hand-offs and integration seams (e.g. Source-to-Pay -> Record-to-Report, Plan-to-Perform -> Record-to-Report), and give recommendations across People, Process, Data, and Technology. Always cite which workstreams and knowledge sources informed your answer.`

// ─── Frontmatter parse (lightweight) ───────────────────
function parseSkill(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  const fm = m ? m[1] : ''
  const body = m ? m[2] : md
  const name = (fm.match(/^name:\s*(.+)$/m) || [])[1]?.trim()
  const version = (fm.match(/version:\s*['"]?([\d.]+)['"]?/m) || [])[1]
  const license = (fm.match(/^license:\s*(.+)$/m) || [])[1]?.trim()
  return { name, version, license, frontmatterRaw: fm, body }
}

// ─── Chunker (mirrors src/lib/knowledge/chunk.ts) ──────
function chunkText(text) {
  const clean = (text || '').replace(/\r\n/g, '\n').trim()
  if (!clean) return []
  const TARGET = 3200, OVERLAP = 400
  const paras = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const out = []
  let buf = ''
  for (const para of paras) {
    if (buf && buf.length + para.length + 2 > TARGET) {
      out.push(buf)
      buf = buf.slice(Math.max(0, buf.length - OVERLAP)) + '\n\n' + para
    } else {
      buf = buf ? `${buf}\n\n${para}` : para
    }
    while (buf.length > TARGET * 1.5) { out.push(buf.slice(0, TARGET)); buf = buf.slice(TARGET - OVERLAP) }
  }
  if (buf.trim()) out.push(buf)
  return out.map((content, index) => ({ index, content, tokenCount: Math.ceil(content.length / 4) }))
}

async function embed(texts) {
  if (!VOYAGE_KEY || texts.length === 0) return null
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_KEY}` },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: 'document' }),
  })
  if (!res.ok) throw new Error(`Voyage failed: ${res.status} ${await res.text()}`)
  return (await res.json()).data.map((d) => d.embedding)
}

// reverse map: skill code -> [workstream codes]
const skillToWs = {}
for (const w of WORKSTREAMS) for (const s of w.skills) (skillToWs[s] ||= []).push(w.code)

async function main() {
  // 1) Seed workstream catalog
  for (const w of WORKSTREAMS) {
    await db.from('kb_workstream_catalog').upsert({
      code: w.code, name: w.name, description: w.description,
      pillars: { sapModules: w.sapModules, dassianModules: w.dassianModules },
      sort_order: w.sort, updated_at: new Date().toISOString(),
    }, { onConflict: 'code' })
  }
  console.log(`✓ catalog: ${WORKSTREAMS.length} workstreams`)

  // 2) Seed per-workstream agents + enterprise orchestrator
  for (const w of WORKSTREAMS) {
    await db.from('kb_workstream_agents').upsert({
      code: w.code, display_name: w.name, tagline: w.tagline,
      system_persona: personaFor(w), sap_modules: w.sapModules, dassian_modules: w.dassianModules,
      knowledge_source_codes: w.skills, model: 'claude-sonnet-4-6', temperature: 0.4,
      is_orchestrator: false, sort_order: w.sort, updated_at: new Date().toISOString(),
    }, { onConflict: 'code' })
  }
  await db.from('kb_workstream_agents').upsert({
    code: 'enterprise', display_name: 'Enterprise Architect (Orchestrator)', tagline: 'Cross-workstream synthesis & routing',
    system_persona: ENTERPRISE_PERSONA, sap_modules: [], dassian_modules: [],
    knowledge_source_codes: [...new Set(WORKSTREAMS.flatMap((w) => w.skills))], model: 'claude-sonnet-4-6',
    temperature: 0.4, is_orchestrator: true, sort_order: 0, updated_at: new Date().toISOString(),
  }, { onConflict: 'code' })
  console.log(`✓ agents: ${WORKSTREAMS.length} workstream agents + 1 orchestrator`)

  // 3) Import skill bundles -> kb_sources + chunks
  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  for (const code of dirs) {
    const file = join(SKILLS_DIR, code, 'SKILL.md')
    if (!existsSync(file)) continue
    const parsed = parseSkill(readFileSync(file, 'utf8'))
    const wsCodes = skillToWs[code] || []
    const description = (parsed.frontmatterRaw.match(/description:\s*[|>]?\s*\n?\s*(.+)/) || [])[1]?.slice(0, 400) || null

    // upsert source (global baseline)
    const existing = await db.from('kb_sources').select('id').eq('code', code).is('tenant_key', null).maybeSingle()
    const row = {
      code, title: parsed.name || code, description, kind: 'skill', origin: 'solution-studio',
      tenant_key: null, workstream_codes: wsCodes, version: parsed.version || null,
      frontmatter: { raw: parsed.frontmatterRaw, license: parsed.license || null },
      body: parsed.body, source_app: 'cds-lineage-explorer', updated_at: new Date().toISOString(),
    }
    let sourceId
    if (existing.data?.id) { sourceId = existing.data.id; await db.from('kb_sources').update(row).eq('id', sourceId) }
    else { const { data, error } = await db.from('kb_sources').insert(row).select('id').single(); if (error) throw new Error(error.message); sourceId = data.id }

    // chunk + embed
    const chunks = chunkText(parsed.body)
    await db.from('kb_chunks').delete().eq('source_id', sourceId)
    let vectors = null
    try { vectors = await embed(chunks.map((c) => c.content)) } catch (e) { console.warn(`  embed failed for ${code}: ${e.message}`) }
    if (chunks.length) {
      const rows = chunks.map((c, i) => ({
        source_id: sourceId, tenant_key: null, workstream_codes: wsCodes,
        chunk_index: c.index, content: c.content, token_count: c.tokenCount,
        embedding: vectors ? `[${vectors[i].join(',')}]` : null,
      }))
      const { error } = await db.from('kb_chunks').insert(rows)
      if (error) throw new Error(`chunks insert ${code}: ${error.message}`)
    }
    console.log(`✓ ${code} -> ws[${wsCodes.join(',') || '—'}] ${chunks.length} chunks ${vectors ? '(embedded)' : '(lexical)'}`)
  }

  console.log('\nDone. Embeddings:', VOYAGE_KEY ? 'voyage-3' : 'DISABLED (set VOYAGE_API_KEY then re-run for semantic RAG)')
}

main().catch((e) => { console.error(e); process.exit(1) })
