import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { serverModelDb } from '@/lib/workshop/server'
import { harmonizeRoles } from '@/lib/security/harmonize'
import type {
  DiscoveredRole,
  ExplorationFindings,
  GovernancePlanDoc,
  PlanStatus,
  RoleAccessItem,
  RoleHarmonization,
} from '@/lib/security/types'

// Explore & Govern, step 2: draft the GOVERNANCE PLAN for an explored system,
// then harmonize its roles against the SAP roles and personas already governed
// in this suite.
//
//   POST  /api/security/plan   { orgId, systemId, explorationId? }
//   PATCH /api/security/plan   { orgId, planId, status }
//
// The draft is a single forced-tool Anthropic call whose input_schema IS the
// GovernancePlanDoc contract, grounded on the exploration findings plus a
// summary of the org's SAP roles and personas (pattern copied from
// src/app/api/workshops/section-fragment/route.ts). The harmonization is the
// deterministic, explainable matcher in src/lib/security/harmonize.ts.
//
// GUARDRAILS relevant here:
//   6. The plan is written as a DRAFT. Only 'review' may become 'approved', and
//      approval stamps approved_at. Nothing can be built until it is approved
//      (see /api/security/build).
//   7. Honest degradation: a system with no exploration cannot be planned from
//      observed evidence, so the route refuses rather than inventing findings.
//      The plan's open questions carry whatever the exploration could not answer.
//
// Server-side with the service key, scoped explicitly by organization_id (this
// route validates the system and the plan belong to the org), like the workshop
// routes. No secret ever reaches the response.

export const runtime = 'nodejs'
// Long-running LLM generation; allow up to 5 minutes on Vercel.
export const maxDuration = 300

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
const MODEL = process.env.WORKSHOP_MODEL || 'claude-sonnet-4-6'

const STR = { type: 'string' } as const
const STR_ARR = { type: 'array', items: STR } as const

// The forced tool's input_schema IS the GovernancePlanDoc shape.
const PLAN_TOOL = {
  name: 'governance_plan',
  description:
    'Return the governance plan for the system: objective, target identity model and the steps to reach it, a least-privilege role model, controls mapped to the standard that genuinely applies, segregation-of-duties pairs, remediation worst-first, the build plan, and the open questions the exploration could not answer. Ground every element in the observed findings; never invent a role, permission, or finding that was not observed.',
  input_schema: {
    type: 'object',
    properties: {
      objective: { type: 'string', description: 'One or two sentences: what governing this system achieves.' },
      identity: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'The target identity model (e.g. "Entra ID SSO with SCIM provisioning, local accounts retired").' },
          steps: { type: 'array', items: STR, description: 'The steps to get there, in order.' },
        },
        required: ['target', 'steps'],
      },
      roleModel: {
        type: 'array',
        description: 'The least-privilege role model for the system.',
        items: {
          type: 'object',
          properties: {
            name: STR,
            purpose: STR,
            permissions: STR_ARR,
            mapsToSapRole: { type: 'string', description: 'The SAP role this aligns to, when one genuinely exists in the listed catalog.' },
          },
          required: ['name', 'purpose', 'permissions'],
        },
      },
      controls: {
        type: 'array',
        description: 'Controls. Cite a standard only where it genuinely applies (NIST 800-171, CMMC, ITAR).',
        items: {
          type: 'object',
          properties: { id: STR, title: STR, detail: STR, standard: STR },
          required: ['id', 'title', 'detail'],
        },
      },
      sod: {
        type: 'array',
        description: 'Segregation-of-duties conflicts and their mitigations.',
        items: { type: 'object', properties: { pair: STR, detail: STR, mitigation: STR }, required: ['pair', 'detail', 'mitigation'] },
      },
      remediation: {
        type: 'array',
        description: 'What must be fixed, worst first, from the observed risks.',
        items: {
          type: 'object',
          properties: { id: STR, title: STR, detail: STR, severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, effort: STR },
          required: ['id', 'title', 'detail', 'severity'],
        },
      },
      buildPlan: {
        type: 'array',
        description: 'The artifacts the studio would generate once the operator approves the plan. Maximum 12.',
        items: {
          type: 'object',
          properties: { artifact: STR, kind: { type: 'string', enum: ['policy', 'config', 'code', 'mapping', 'runbook', 'doc'] }, targetPath: STR, purpose: STR },
          required: ['artifact', 'kind', 'purpose'],
        },
      },
      openQuestions: { type: 'array', items: STR, description: 'What the exploration could not answer and the operator must confirm.' },
    },
    required: ['objective', 'identity', 'roleModel', 'controls', 'sod', 'remediation', 'buildPlan', 'openQuestions'],
  },
} as const

// House rule: no em/en dashes in generated prose.
function stripDashesFromString(s: string): string {
  return s.replace(/\s*[—–]\s+/g, ', ').replace(/\s+[—–]\s*/g, ', ').replace(/(?<=\S)[—–](?=\S)/g, '-')
}
function stripDashes<T>(v: T): T {
  if (typeof v === 'string') return stripDashesFromString(v) as unknown as T
  if (Array.isArray(v)) return v.map((el) => stripDashes(el)) as unknown as T
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = stripDashes(val)
    return out as unknown as T
  }
  return v
}

interface SystemRow {
  id: string
  name: string
  kind: string
  vendor: string | null
  base_url: string | null
  source_path: string | null
  description: string | null
  criticality: string | null
  status: string
}

interface SapRoleRow {
  id: string
  name: string
  description: string | null
  sap_role_name: string | null
  role_type: string | null
}

const SAP_ROLE_SELECT = 'id, name, description, sap_role_name, role_type'

/** Compact, honest grounding text: exactly what the exploration observed. */
function findingsContext(f: ExplorationFindings): string {
  const lines: string[] = []
  lines.push(`Auth model: mechanism=${f.authModel?.mechanism || 'not determined'}; idp=${f.authModel?.idp || 'none observed'}; mfa=${f.authModel?.mfa === null || f.authModel?.mfa === undefined ? 'unknown' : String(f.authModel.mfa)}`)
  if ((f.authModel?.notes ?? []).length) lines.push(`Auth notes: ${f.authModel.notes.slice(0, 10).join(' | ')}`)
  lines.push(
    `Discovered roles (${(f.discoveredRoles ?? []).length}): ` +
      ((f.discoveredRoles ?? []).slice(0, 60).map((r) => `${r.name} [${r.source}${(r.permissions ?? []).length ? `, ${r.permissions!.length} perms` : ''}]`).join(', ') || 'none observed'),
  )
  lines.push(`Permissions (${(f.permissions ?? []).length}): ${(f.permissions ?? []).slice(0, 80).join(', ') || 'none observed'}`)
  lines.push(
    `Surfaces: ${(f.surfaces ?? []).slice(0, 20).map((s) => `${s.label}${s.kind ? ` (${s.kind})` : ''}${s.url ? ` ${s.url}` : ''}`).join('; ') || 'none observed'}`,
  )
  const headers = Object.entries(f.posture?.securityHeaders ?? {}).map(([k, v]) => `${k}=${v ?? 'absent'}`)
  lines.push(`Posture: framework=${f.posture?.framework || 'unknown'}; authLibraries=${(f.posture?.authLibraries ?? []).join(', ') || 'none observed'}`)
  if (headers.length) lines.push(`Security headers: ${headers.join('; ')}`)
  if ((f.posture?.cookieFlags ?? []).length) lines.push(`Cookie flags: ${f.posture.cookieFlags.join('; ')}`)
  lines.push(
    `Risks (${(f.risks ?? []).length}):\n` +
      ((f.risks ?? []).slice(0, 40).map((r) => `- [${r.severity}] ${r.title}: ${r.detail}${r.evidence ? ` (evidence: ${r.evidence})` : ''}`).join('\n') || '- none observed'),
  )
  lines.push(`Scanned: ${f.scanned?.urls ?? 0} URL(s), ${f.scanned?.files ?? 0} file(s).`)
  lines.push(`Unreachable or unscannable: ${(f.unreachable ?? []).join(', ') || 'none'}`)
  return lines.join('\n')
}

/** The org's SAP security roles and personas, so the plan can align rather than
 *  invent. Capped; a thin catalog is stated honestly instead of embellished. */
function sapContext(
  roles: SapRoleRow[],
  access: RoleAccessItem[],
  personas: { id: string; name: string }[],
): string {
  if (!roles.length && !personas.length) {
    return 'This organization has no SAP security roles or personas modelled yet. Do not claim alignment to an SAP role that does not exist; leave mapsToSapRole empty and raise the gap as an open question.'
  }
  const byRole = new Map<string, string[]>()
  for (const a of access) byRole.set(a.role_id, [...(byRole.get(a.role_id) ?? []), `${a.access_type}:${a.value}`])
  const roleLines = roles.slice(0, 60).map((r) => {
    const items = (byRole.get(r.id) ?? []).slice(0, 12)
    return `- ${r.name}${r.sap_role_name ? ` (${r.sap_role_name})` : ''} [${r.role_type ?? 'single'}]${items.length ? ` access: ${items.join(', ')}` : ' access: none captured'}`
  })
  return [
    `SAP security roles in this organization (${roles.length}):`,
    roleLines.join('\n') || '- none',
    `Personas (${personas.length}): ${personas.slice(0, 60).map((p) => p.name).join(', ') || 'none'}`,
  ].join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { orgId?: string; systemId?: string; explorationId?: string }
    const orgId = String(body.orgId || '')
    const systemId = String(body.systemId || '')
    const explorationIdArg = body.explorationId ? String(body.explorationId) : ''
    if (!orgId || !systemId) return json({ error: 'orgId and systemId are required' }, 400)
    if (!ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)

    const db = serverModelDb()
    const { data: systemRow, error: sErr } = await db
      .from('governed_systems')
      .select('id, name, kind, vendor, base_url, source_path, description, criticality, status')
      .eq('id', systemId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (sErr) return json({ error: sErr.message }, 500)
    if (!systemRow) return json({ error: 'Governed system not found for this organization' }, 404)
    const system = systemRow as SystemRow

    // Grounding: the exploration this plan is written from.
    let explorationId: string | null = null
    let findings: ExplorationFindings | null = null
    if (explorationIdArg) {
      const { data } = await db
        .from('governance_explorations')
        .select('id, system_id, findings, status')
        .eq('id', explorationIdArg)
        .eq('organization_id', orgId)
        .maybeSingle()
      const row = data as { id: string; system_id: string; findings: ExplorationFindings | null; status: string } | null
      if (!row || row.system_id !== system.id) return json({ error: 'That exploration does not belong to this system' }, 404)
      if (row.status !== 'complete') return json({ error: `That exploration is "${row.status}", so there is nothing grounded to plan from.` }, 400)
      explorationId = row.id
      findings = row.findings
    } else {
      const { data } = await db
        .from('governance_explorations')
        .select('id, findings')
        .eq('organization_id', orgId)
        .eq('system_id', system.id)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
      const rows = (data ?? []) as { id: string; findings: ExplorationFindings | null }[]
      if (rows.length) {
        explorationId = rows[0].id
        findings = rows[0].findings
      }
    }
    if (!explorationId || !findings) {
      return json(
        { error: `"${system.name}" has no completed exploration yet. Explore it first: a plan drafted without observed evidence would be invention, not governance.` },
        400,
      )
    }

    // The SAP side of the house, for alignment and for the harmonization.
    const [{ data: roleRows }, { data: accessRows }, { data: personaRows }] = await Promise.all([
      db.from('process_roles').select(SAP_ROLE_SELECT).eq('organization_id', orgId).order('name'),
      db
        .from('process_role_access')
        .select('id, organization_id, role_id, access_type, value, title, fiori_app_id, source, note, created_at')
        .eq('organization_id', orgId),
      db.from('personas').select('id, name').eq('organization_id', orgId),
    ])
    const sapRoles = (roleRows ?? []) as unknown as SapRoleRow[]
    const access = (accessRows ?? []) as unknown as RoleAccessItem[]
    const personas = (personaRows ?? []) as { id: string; name: string }[]
    const { data: linkRows } = personas.length
      ? await db.from('persona_roles').select('persona_id, role_id').in('persona_id', personas.map((p) => p.id))
      : { data: [] }
    const personaRoleLinks = (linkRows ?? []) as { persona_id: string; role_id: string }[]

    // ─── Forced-tool draft ────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })
    const systemPrompt =
      'You are a world-class SAP S/4HANA and enterprise security architect writing a governance plan for a non-SAP application that an organization has decided to bring under central security governance. ' +
      'You are A&D-aware (NIST 800-171, CMMC, ITAR, FAR/DFARS) and cite a standard ONLY where it genuinely applies. ' +
      'Ground every element in the observed exploration findings supplied below. Never invent a role, permission, control, or finding that was not observed: if something is unknown, put it in openQuestions. ' +
      'Where the exploration reported targets as unreachable or unscannable, treat that as a gap to confirm, not as an absence of risk. ' +
      'The plan is a DRAFT for operator review and approval; nothing is applied to the target system by anyone but a human. ' +
      'Be specific and concise: short bullets, one idea each. Never use em-dashes or en-dashes; use commas, colons, parentheses, or periods.'

    const user = [
      `System: ${system.name} (${system.kind}${system.vendor ? `, vendor ${system.vendor}` : ''}${system.criticality ? `, criticality ${system.criticality}` : ''}).`,
      system.description ? `Description: ${system.description}` : '',
      system.base_url ? `Base URL: ${system.base_url}` : '',
      system.source_path ? 'A source tree was scanned locally.' : '',
      '',
      '=== OBSERVED EXPLORATION FINDINGS (read-only reconnaissance) ===',
      findingsContext(findings),
      '',
      '=== SAP SECURITY CONTEXT ALREADY GOVERNED IN THIS SUITE ===',
      sapContext(sapRoles, access, personas),
      '',
      'Produce the governance plan for this system.',
    ]
      .filter(Boolean)
      .join('\n')

    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      temperature: 0.3,
      system: systemPrompt,
      tools: [{ name: PLAN_TOOL.name, description: PLAN_TOOL.description, input_schema: PLAN_TOOL.input_schema as unknown as Anthropic.Tool['input_schema'] }],
      tool_choice: { type: 'tool', name: PLAN_TOOL.name },
      messages: [{ role: 'user', content: user }],
    })
    const block = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (!block?.input) return json({ error: 'The model did not return a governance plan. Try again.' }, 502)
    const planDoc = stripDashes(block.input) as unknown as GovernancePlanDoc

    // ─── Persist the draft ────────────────────────────────────────────────
    const { data: created, error: pErr } = await db
      .from('governance_plans')
      .insert({
        organization_id: orgId,
        system_id: system.id,
        exploration_id: explorationId,
        status: 'draft',
        plan: planDoc,
      })
      .select('id, created_at')
      .single()
    if (pErr || !created) return json({ error: `Failed to save the governance plan: ${pErr?.message ?? 'no row returned'}` }, 500)
    const planId = (created as { id: string }).id

    if (['registered', 'explored'].includes(system.status)) {
      await db
        .from('governed_systems')
        .update({ status: 'planned', updated_at: new Date().toISOString() })
        .eq('id', system.id)
        .eq('organization_id', orgId)
    }

    // ─── Harmonize the external roles with the SAP roles / personas ───────
    const externalRoles = (findings.discoveredRoles ?? []) as DiscoveredRole[]
    let harmonization: RoleHarmonization[] = []
    let harmonizationWarning: string | undefined
    if (externalRoles.length) {
      harmonization = harmonizeRoles(externalRoles, sapRoles, access, personas, personaRoleLinks)
      if (harmonization.length) {
        const { error: mErr } = await db.from('governance_role_map').upsert(
          harmonization.map((h) => ({
            organization_id: orgId,
            plan_id: planId,
            external_role: h.externalRole,
            role_id: h.roleId ?? null,
            persona_id: h.personaId ?? null,
            disposition: h.disposition,
            confidence: h.confidence,
            rationale: h.rationale,
          })),
          { onConflict: 'plan_id,external_role' },
        )
        if (mErr) harmonizationWarning = `The plan was saved, but the role map could not be written: ${mErr.message}`
      }
    } else {
      harmonizationWarning = 'The exploration observed no external roles, so there is nothing to harmonize yet. Declare the system\'s roles to build the map.'
    }

    return json(
      {
        ok: true,
        planId,
        systemId: system.id,
        system: system.name,
        status: 'draft' as PlanStatus,
        explorationId,
        plan: planDoc,
        harmonization,
        sapRolesConsidered: sapRoles.length,
        ...(harmonizationWarning ? { warning: harmonizationWarning } : {}),
        next: 'Submit the plan for review, then approve it. Nothing can be built until it is approved and a human confirms.',
      },
      200,
    )
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

// ─── Status transitions ─────────────────────────────────────────────────────
// draft -> review -> approved | rejected. Only 'review' may become 'approved',
// and approving stamps approved_at. 'built' is set by /api/security/build alone.
const ALLOWED_FROM: Record<string, PlanStatus[]> = {
  review: ['draft'],
  approved: ['review'],
  rejected: ['draft', 'review'],
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { orgId?: string; planId?: string; status?: string }
    const orgId = String(body.orgId || '')
    const planId = String(body.planId || '')
    const status = String(body.status || '')
    if (!orgId || !planId || !status) return json({ error: 'orgId, planId, and status are required' }, 400)
    if (!ALLOWED_FROM[status]) return json({ error: 'status must be review, approved, or rejected' }, 400)

    const db = serverModelDb()
    const { data, error } = await db
      .from('governance_plans')
      .select('id, system_id, status, approved_at')
      .eq('id', planId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (error) return json({ error: error.message }, 500)
    if (!data) return json({ error: 'Governance plan not found for this organization' }, 404)
    const plan = data as { id: string; system_id: string; status: PlanStatus; approved_at: string | null }

    if (plan.status === status) return json({ ok: true, planId: plan.id, status: plan.status, unchanged: true }, 200)
    if (!ALLOWED_FROM[status].includes(plan.status)) {
      return json(
        { error: `A plan cannot go from "${plan.status}" to "${status}". Allowed: draft to review, review to approved, and draft or review to rejected.` },
        400,
      )
    }

    const nowIso = new Date().toISOString()
    const updates: Record<string, unknown> = { status, updated_at: nowIso }
    if (status === 'approved') updates.approved_at = nowIso

    const { error: upErr } = await db.from('governance_plans').update(updates).eq('id', plan.id).eq('organization_id', orgId)
    if (upErr) return json({ error: upErr.message }, 500)

    // Mirror approval onto the system lifecycle (governed is set by the build).
    if (status === 'approved') {
      await db
        .from('governed_systems')
        .update({ status: 'approved', updated_at: nowIso })
        .eq('id', plan.system_id)
        .eq('organization_id', orgId)
        .in('status', ['registered', 'explored', 'planned'])
    }

    return json(
      {
        ok: true,
        planId: plan.id,
        previousStatus: plan.status,
        status,
        ...(status === 'approved' ? { approvedAt: nowIso, note: 'Approved. The build still requires explicit human confirmation, and it only generates artifacts into the studio.' } : {}),
      },
      200,
    )
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
