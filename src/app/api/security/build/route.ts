import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { serverModelDb } from '@/lib/workshop/server'
import type { ExplorationFindings, GovernancePlanDoc, PlanStatus } from '@/lib/security/types'

// Explore & Govern, step 3: BUILD the security design for an APPROVED governance
// plan by generating artifacts INTO THE STUDIO.
//
//   POST /api/security/build   { orgId, planId, humanConfirmed }
//
// GUARDRAILS (contract section "GUARDRAILS"):
//   5. The build generates artifacts INTO THE STUDIO ONLY. It never writes to the
//      target repository, never calls a target admin API, and never provisions
//      anything. Applying the artifacts to the target system is a HUMAN STEP.
//   6. It FAILS CLOSED: humanConfirmed must be exactly true AND the plan's status
//      must be 'approved'. Anything else is HTTP 400 and nothing is written.
//   7. Honest degradation: whatever the plan left as an open question stays an
//      open question; the artifacts never paper over it.
//
// Generation is a single forced-tool Anthropic call over the approved plan
// (pattern copied from src/app/api/workshops/section-fragment/route.ts).
// Server-side with the service key, scoped explicitly by organization_id. No
// secret ever reaches the response.

export const runtime = 'nodejs'
// Long-running LLM generation; allow up to 5 minutes on Vercel.
export const maxDuration = 300

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
const MODEL = process.env.WORKSHOP_MODEL || 'claude-sonnet-4-6'

const MAX_ARTIFACTS = 12
const MAX_ARTIFACT_CHARS = 20000
const ARTIFACT_KINDS = ['policy', 'config', 'code', 'mapping', 'runbook', 'doc'] as const
type ArtifactKind = (typeof ARTIFACT_KINDS)[number]
// Prose artifacts get the house no-dash rule; code/config/policy/mapping bodies
// are left byte-for-byte as generated so nothing is rewritten inside a payload.
const PROSE_KINDS: ArtifactKind[] = ['doc', 'runbook']

const STR = { type: 'string' } as const

const BUILD_TOOL = {
  name: 'governance_artifacts',
  description:
    `Return the security design artifacts for the approved governance plan: policy files, RBAC configuration, role-mapping tables, middleware scaffolding, and the runbook. Maximum ${MAX_ARTIFACTS} artifacts, each at most ${MAX_ARTIFACT_CHARS} characters. These are generated into the studio for a human to review and apply; they are never written to the target system by this process.`,
  input_schema: {
    type: 'object',
    properties: {
      artifacts: {
        type: 'array',
        description: `The artifacts, maximum ${MAX_ARTIFACTS}. Follow the plan's buildPlan; do not add artifacts the plan did not call for.`,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'File-style artifact name (e.g. "rbac.policy.yaml", "role-mapping.md").' },
            kind: { type: 'string', enum: ['policy', 'config', 'code', 'mapping', 'runbook', 'doc'] },
            target_path: { type: 'string', description: 'Where a human would place this in the target system. Advisory only: nothing is written there.' },
            language: { type: 'string', description: 'Language or format of the content (yaml, json, typescript, sql, markdown, ...).' },
            content: { type: 'string', description: `The artifact body, complete and ready for a human to review. At most ${MAX_ARTIFACT_CHARS} characters.` },
          },
          required: ['name', 'kind', 'content'],
        },
      },
    },
    required: ['artifacts'],
  },
} as const

function stripDashesFromString(s: string): string {
  return s.replace(/\s*[—–]\s+/g, ', ').replace(/\s+[—–]\s*/g, ', ').replace(/(?<=\S)[—–](?=\S)/g, '-')
}

interface PlanRow {
  id: string
  system_id: string
  exploration_id: string | null
  status: PlanStatus
  plan: GovernancePlanDoc | null
  approved_at: string | null
  built_at: string | null
}

/** Compact rendering of the approved plan for the generator. */
function planContext(p: GovernancePlanDoc): string {
  const lines: string[] = []
  lines.push(`Objective: ${p.objective}`)
  lines.push(`Target identity model: ${p.identity?.target ?? 'not stated'}`)
  if ((p.identity?.steps ?? []).length) lines.push(`Identity steps:\n${p.identity.steps.map((s) => `- ${s}`).join('\n')}`)
  if ((p.roleModel ?? []).length) {
    lines.push(
      'Role model:\n' +
        p.roleModel
          .map((r) => `- ${r.name}: ${r.purpose}${r.mapsToSapRole ? ` (aligns to SAP role ${r.mapsToSapRole})` : ''}; permissions: ${(r.permissions ?? []).join(', ') || 'none stated'}`)
          .join('\n'),
    )
  }
  if ((p.controls ?? []).length) lines.push('Controls:\n' + p.controls.map((c) => `- ${c.id} ${c.title}${c.standard ? ` [${c.standard}]` : ''}: ${c.detail}`).join('\n'))
  if ((p.sod ?? []).length) lines.push('Segregation of duties:\n' + p.sod.map((s) => `- ${s.pair}: ${s.detail} Mitigation: ${s.mitigation}`).join('\n'))
  if ((p.remediation ?? []).length) lines.push('Remediation:\n' + p.remediation.map((r) => `- ${r.id} [${r.severity}] ${r.title}: ${r.detail}${r.effort ? ` (effort: ${r.effort})` : ''}`).join('\n'))
  if ((p.buildPlan ?? []).length) {
    lines.push('BUILD PLAN (generate exactly these artifacts):\n' + p.buildPlan.map((b) => `- ${b.artifact} [${b.kind}]${b.targetPath ? ` -> ${b.targetPath}` : ''}: ${b.purpose}`).join('\n'))
  }
  if ((p.openQuestions ?? []).length) lines.push('Open questions (do NOT resolve these by inventing an answer; carry them into the runbook):\n' + p.openQuestions.map((q) => `- ${q}`).join('\n'))
  return lines.join('\n\n')
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { orgId?: string; planId?: string; humanConfirmed?: unknown }
    const orgId = String(body.orgId || '')
    const planId = String(body.planId || '')
    if (!orgId || !planId) return json({ error: 'orgId and planId are required' }, 400)

    // ─── Gate 1: explicit human confirmation ──────────────────────────────
    if (body.humanConfirmed !== true) {
      return json(
        {
          error:
            'Refused: humanConfirmed must be exactly true. The build generates security artifacts into the studio and requires an explicit human confirmation. Nothing was generated.',
        },
        400,
      )
    }
    if (!ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)

    const db = serverModelDb()
    const { data: planData, error: pErr } = await db
      .from('governance_plans')
      .select('id, system_id, exploration_id, status, plan, approved_at, built_at')
      .eq('id', planId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (pErr) return json({ error: pErr.message }, 500)
    if (!planData) return json({ error: 'Governance plan not found for this organization' }, 404)
    const plan = planData as unknown as PlanRow

    // ─── Gate 2: the plan must be approved ────────────────────────────────
    if (plan.status !== 'approved') {
      return json(
        {
          error:
            plan.status === 'built'
              ? `Refused: this plan has already been built${plan.built_at ? ` (${plan.built_at})` : ''}. Nothing was generated.`
              : `Refused: the plan is "${plan.status}", not "approved". A plan must be submitted for review and approved by the operator before anything is generated. Nothing was generated.`,
          status: plan.status,
        },
        400,
      )
    }
    if (!plan.plan || !plan.plan.objective) {
      return json({ error: 'Refused: the approved plan has no plan document to build from. Nothing was generated.' }, 400)
    }

    const { data: systemData } = await db
      .from('governed_systems')
      .select('id, name, kind, vendor, base_url, source_path, description, criticality, status')
      .eq('id', plan.system_id)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!systemData) return json({ error: 'The plan\'s governed system no longer exists for this organization' }, 404)
    const system = systemData as { id: string; name: string; kind: string; vendor: string | null; description: string | null; status: string }

    // The harmonization map, so the generated mapping artifact reflects the
    // decisions actually recorded rather than a fresh guess.
    const { data: mapRows } = await db
      .from('governance_role_map')
      .select('external_role, role_id, persona_id, disposition, confidence, rationale')
      .eq('organization_id', orgId)
      .eq('plan_id', plan.id)
      .order('external_role')
    const mapping = (mapRows ?? []) as { external_role: string; role_id: string | null; persona_id: string | null; disposition: string; confidence: number | null; rationale: string | null }[]
    const roleIds = [...new Set(mapping.map((m) => m.role_id).filter((v): v is string => !!v))]
    const { data: roleNameRows } = roleIds.length
      ? await db.from('process_roles').select('id, name, sap_role_name').eq('organization_id', orgId).in('id', roleIds)
      : { data: [] }
    const roleById = new Map(((roleNameRows ?? []) as { id: string; name: string; sap_role_name: string | null }[]).map((r) => [r.id, r]))
    const mappingContext = mapping.length
      ? 'Recorded role harmonization (external role -> SAP role, disposition):\n' +
        mapping
          .map((m) => {
            const sap = m.role_id ? roleById.get(m.role_id) : undefined
            return `- ${m.external_role} -> ${sap ? `${sap.name}${sap.sap_role_name ? ` (${sap.sap_role_name})` : ''}` : 'no SAP analogue'} [${m.disposition}${m.confidence != null ? `, confidence ${m.confidence}` : ''}]${m.rationale ? `: ${m.rationale}` : ''}`
          })
          .join('\n')
      : 'No role harmonization has been recorded for this plan. Say so in the mapping artifact rather than inventing mappings.'

    // Honest carry-through of what the exploration could not see.
    let unreachable: string[] = []
    if (plan.exploration_id) {
      const { data: eRow } = await db
        .from('governance_explorations')
        .select('findings')
        .eq('id', plan.exploration_id)
        .eq('organization_id', orgId)
        .maybeSingle()
      const f = (eRow as { findings: ExplorationFindings | null } | null)?.findings
      unreachable = f?.unreachable ?? []
    }

    // ─── Forced-tool artifact generation ──────────────────────────────────
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })
    const systemPrompt =
      'You are a world-class enterprise security architect generating the concrete artifacts for an APPROVED governance plan. ' +
      'The artifacts are generated INTO A STUDIO for a human to review and apply. Nothing you produce is written to the target system, no admin API is called, and nothing is provisioned: applying these artifacts is a human step, and the runbook must say so plainly. ' +
      'Follow the plan\'s build plan exactly: produce those artifacts, no more. Every artifact must be complete and directly usable, not a sketch. ' +
      'Never invent a role, permission, or finding the plan did not establish; carry the plan\'s open questions and anything the exploration could not reach into the runbook as items for the operator to confirm. ' +
      `Keep each artifact under ${MAX_ARTIFACT_CHARS} characters. In prose (doc and runbook artifacts), never use em-dashes or en-dashes; use commas, colons, parentheses, or periods.`

    const user = [
      `System: ${system.name} (${system.kind}${system.vendor ? `, vendor ${system.vendor}` : ''}).`,
      system.description ? `Description: ${system.description}` : '',
      '',
      '=== APPROVED GOVERNANCE PLAN ===',
      planContext(plan.plan),
      '',
      '=== ROLE HARMONIZATION ===',
      mappingContext,
      '',
      unreachable.length ? `=== NOT OBSERVED DURING EXPLORATION ===\n${unreachable.join(', ')}` : '',
      '',
      'Generate the artifacts for this approved plan.',
    ]
      .filter(Boolean)
      .join('\n')

    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      temperature: 0.2,
      system: systemPrompt,
      tools: [{ name: BUILD_TOOL.name, description: BUILD_TOOL.description, input_schema: BUILD_TOOL.input_schema as unknown as Anthropic.Tool['input_schema'] }],
      tool_choice: { type: 'tool', name: BUILD_TOOL.name },
      messages: [{ role: 'user', content: user }],
    })
    const block = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (!block?.input) return json({ error: 'The model did not return any artifacts. Nothing was generated.' }, 502)

    const raw = (block.input as { artifacts?: unknown }).artifacts
    const warnings: string[] = []
    const all = Array.isArray(raw) ? raw : []
    if (all.length > MAX_ARTIFACTS) warnings.push(`The generator returned ${all.length} artifacts; only the first ${MAX_ARTIFACTS} were kept.`)

    const specs: { name: string; kind: ArtifactKind; target_path: string | null; language: string | null; content: string }[] = []
    for (const item of all.slice(0, MAX_ARTIFACTS)) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const name = typeof o.name === 'string' ? o.name.trim() : ''
      const kindRaw = typeof o.kind === 'string' ? o.kind.trim().toLowerCase() : ''
      let content = typeof o.content === 'string' ? o.content : ''
      if (!name || !content.trim()) continue
      const kind = ((ARTIFACT_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : 'doc') as ArtifactKind
      if (kindRaw && kind !== kindRaw) warnings.push(`Artifact "${name}" had an unknown kind "${kindRaw}"; it was recorded as "doc".`)
      if (content.length > MAX_ARTIFACT_CHARS) {
        content = content.slice(0, MAX_ARTIFACT_CHARS)
        warnings.push(`Artifact "${name}" exceeded ${MAX_ARTIFACT_CHARS} characters and was truncated; review it before use.`)
      }
      if (PROSE_KINDS.includes(kind)) content = stripDashesFromString(content)
      const targetPath = typeof o.target_path === 'string' ? o.target_path.trim() : ''
      const language = typeof o.language === 'string' ? o.language.trim() : ''
      specs.push({
        name: stripDashesFromString(name),
        kind,
        target_path: targetPath || null,
        language: language || null,
        content,
      })
    }
    if (!specs.length) return json({ error: 'The generator returned no usable artifact. Nothing was generated.' }, 502)

    const { data: inserted, error: aErr } = await db
      .from('governance_artifacts')
      .insert(
        specs.map((s) => ({
          organization_id: orgId,
          plan_id: plan.id,
          name: s.name,
          kind: s.kind,
          target_path: s.target_path,
          language: s.language,
          content: s.content,
        })),
      )
      .select('id, name, kind, target_path, language, created_at')
    if (aErr) return json({ error: `Failed to save the artifacts: ${aErr.message}. Nothing was generated; the plan is unchanged.` }, 500)

    const nowIso = new Date().toISOString()
    const { error: planErr } = await db
      .from('governance_plans')
      .update({ status: 'built', built_at: nowIso, updated_at: nowIso })
      .eq('id', plan.id)
      .eq('organization_id', orgId)
    if (planErr) warnings.push(`The artifacts were saved, but marking the plan built failed: ${planErr.message}`)
    const { error: sysErr } = await db
      .from('governed_systems')
      .update({ status: 'governed', updated_at: nowIso })
      .eq('id', system.id)
      .eq('organization_id', orgId)
    if (sysErr) warnings.push(`The artifacts were saved, but marking the system governed failed: ${sysErr.message}`)

    const rows = (inserted ?? []) as { id: string; name: string; kind: string; target_path: string | null; language: string | null; created_at: string }[]
    return json(
      {
        ok: true,
        planId: plan.id,
        systemId: system.id,
        system: system.name,
        status: planErr ? plan.status : ('built' as PlanStatus),
        systemStatus: sysErr ? system.status : 'governed',
        builtAt: planErr ? null : nowIso,
        artifacts: rows.map((r) => {
          const spec = specs.find((s) => s.name === r.name)
          return {
            id: r.id,
            name: r.name,
            kind: r.kind,
            target_path: r.target_path,
            language: r.language,
            content: spec?.content ?? '',
            created_at: r.created_at,
          }
        }),
        message:
          `${specs.length} artifact(s) were generated INTO THE STUDIO for "${system.name}". ` +
          'Nothing was written to the target system: no repository file was changed, no admin API was called, and nothing was provisioned. ' +
          'Applying these artifacts to the target system is a human step.',
        ...(warnings.length ? { warnings } : {}),
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
