// Security Design Studio + Explore & Govern tools: the Super Consultant agents
// (led by the security-authorization workstream specialist) can (F1) run a
// conversational SECURITY DESIGN ADVISORY session — grounded best practice
// captured with its citations, plus solution design OPTIONS wherever standard
// SAP will not cover the requirement, and the operator's recorded DECISION — and
// (F2) EXPLORE AND GOVERN an estate of COTS and vibe-coded applications: register
// a system, explore it read-only, draft a governance plan, harmonize its roles
// with the SAP roles and personas already governed in the suite, and — only after
// the plan is approved and a human confirms — BUILD the security artifacts into
// the studio.
//
// Same AgentTool contract as @jlee-revtech/agent-core: execute(args, ctx) where
// ctx.modelDb is the caller's RLS org-scoped Supabase client. RLS already fences
// every statement to the user's org; each tool ALSO verifies the target row's
// organization before writing (belt and suspenders), because a wrong-id write
// must fail closed with a clear message, not lean on the database alone.
//
// Deliberately conservative, like studioTools and securityTools:
//   - writes happen ONLY on explicit user request (see ONLY_ON_REQUEST)
//   - batch caps: <= 10 guidance entries, <= 6 design options, <= 80 declared
//     external roles, <= 12 build artifacts (each <= 20,000 characters) per call
//   - every result returns ids, names, and the /process/security/design link
//
// GUARDRAILS (contract section "GUARDRAILS"; stated in the tool descriptions so
// the model reads them before it acts, and enforced in the code below):
//   1. Exploration is READ-ONLY reconnaissance of systems the operator declares
//      they administer. Never authenticate, never submit credentials or forms,
//      never POST, never attempt an auth bypass, never exploit a finding, never
//      scan a host the operator did not register.
//   2. HTTP caps: max 12 requests per exploration, 8s timeout each, max 3
//      redirects, same-origin only, 512 KB body cap, GET/HEAD only, honest
//      `unreachable[]` list.
//   3. Source caps: node_modules/.git/dist/build/.next/vendor skipped, max 1500
//      files, 256 KB per file, allow-listed extensions only. Never read .env /
//      .env.local / *.pem / *.key.
//   4. SECRETS: a probable secret is recorded as a RISK with file + line + a
//      redacted fingerprint. The value is never stored, logged, echoed, or
//      returned, and never appears in findings JSON.
//   5. BUILD generates artifacts INTO THE STUDIO only. It never writes to the
//      target repo, never calls a target admin API, never provisions. Applying
//      the artifacts is a human step.
//   6. Build fails closed: plan.status === 'approved' AND explicit human
//      confirmation, or it refuses.
//   7. Honest degradation everywhere: report what was unreachable or unscannable;
//      never fabricate a role, permission, or finding that was not observed.
//
// Guardrails 1-4 live in the read-only exploration engine
// (src/lib/security/explore.ts); the harmonization rules live in the pure
// matcher (src/lib/security/harmonize.ts). Both are shared with the API routes
// and the Security Design Studio UI.

import type { AgentTool, ToolContext } from '@jlee-revtech/agent-core'
import type {
  DesignApproach,
  ExplorationFindings,
  GovernancePlanDoc,
  PlanStatus,
  RoleAccessItem,
  RoleHarmonization,
  DiscoveredRole,
} from '@/lib/security/types'
import { runExploration } from '@/lib/security/explore'
import { harmonizeRoles } from '@/lib/security/harmonize'

const J = (v: unknown) => JSON.stringify(v, null, 2)

const ONLY_ON_REQUEST =
  'Use this tool ONLY when the user has explicitly asked you to create or change this content in the studio. ' +
  'Never call it speculatively, never to "improve" the model unasked, and never while answering a purely informational question. ' +
  'Confirm scope with the user first if their request is ambiguous.'

// The read-only reconnaissance guardrail, stated verbatim wherever a tool can
// reach an external system or record what one reported.
const RECON_GUARDRAIL =
  'GUARDRAIL: exploration is READ-ONLY reconnaissance of a system the operator has declared they administer. ' +
  'It never authenticates, never submits credentials or forms, never POSTs, never attempts an authentication bypass, ' +
  'never exploits a finding, and never touches a host that was not registered. HTTP is capped at 12 GET/HEAD requests, ' +
  '8s each, 3 redirects, same-origin only, 512 KB bodies; the source scan skips node_modules/.git/dist/build/.next/vendor ' +
  'and never reads .env, .env.local, *.pem, or *.key. A probable secret is recorded as a RISK with a redacted fingerprint only, ' +
  'never its value. Whatever could not be reached or scanned is reported honestly and never invented.'

const BUILD_GUARDRAIL =
  'GUARDRAIL: the build generates artifacts INTO THE STUDIO ONLY. It never writes to the target repository, never calls a ' +
  'target admin API, and never provisions anything. Applying the artifacts to the target system is a human step.'

const HONESTY_GUARDRAIL =
  'GUARDRAIL: never fabricate a role, permission, control, or finding that was not observed or explicitly declared by the operator.'

const WS_PROP = {
  workstream_code: {
    type: 'string',
    description: "Workstream code to home the new content to (e.g. 'security-authorization'). Defaults to this agent's own workstream; omit for none.",
  },
} as const

/** Resolve the workstream to home new content to. Mirrors agent-core's codeFor:
 *  explicit arg wins, else the agent's own stream, and 'enterprise' means none.
 *  An explicit code that does not exist in the org is reported, not guessed. */
function resolveWs(ctx: ToolContext, codeArg: unknown): { code: string | null; id: string | null; warning?: string } {
  const code = (typeof codeArg === 'string' && codeArg.trim()) || ctx.agentWorkstreamCode
  if (!code || code === 'enterprise') return { code: null, id: null }
  const ws = ctx.wsByCode.get(code)
  if (!ws) {
    return typeof codeArg === 'string' && codeArg.trim()
      ? { code: null, id: null, warning: `Workstream code "${codeArg}" does not exist in this organization; the content was created without a workstream home.` }
      : { code: null, id: null }
  }
  return { code, id: ws.id }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const optStr = (v: unknown): string | null => {
  const s = str(v)
  return s ? s : null
}
const strArr = (v: unknown, cap: number): string[] =>
  (Array.isArray(v) ? v : []).map((x) => str(x)).filter(Boolean).slice(0, cap)

const DESIGN_LINK = '/process/security/design'
const CITE_NOTE = 'Cite the link so the user can open it in the Security Design Studio.'

const MAX_GUIDANCE = 10
const MAX_OPTIONS = 6
const MAX_DECLARED_ROLES = 80
const MAX_ARTIFACTS = 12
const MAX_ARTIFACT_CHARS = 20000
// Plan-document caps, so one call cannot dump an unbounded document into the row.
const MAX_ROLE_MODEL = 40
const MAX_CONTROLS = 40
const MAX_SOD = 25
const MAX_REMEDIATION = 40
const MAX_BUILD_PLAN = MAX_ARTIFACTS
const MAX_OPEN_QUESTIONS = 20

const APPROACHES: DesignApproach[] = ['standard', 'configuration', 'enhancement', 'third_party', 'process_control']
const APPROACH_LIST = APPROACHES.join(', ')
const SESSION_STATUSES = ['active', 'decided', 'archived'] as const
const SYSTEM_KINDS = ['cots', 'custom'] as const
const CRITICALITIES = ['low', 'medium', 'high'] as const
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
const ARTIFACT_KINDS = ['policy', 'config', 'code', 'mapping', 'runbook', 'doc'] as const
const ARTIFACT_KIND_LIST = ARTIFACT_KINDS.join(', ')

// ─── Row shapes ─────────────────────────────────────────────────────────────

interface SessionRow {
  id: string
  title: string
  scope: string | null
  workstream_id: string | null
  status: string
  created_at: string
}

interface OptionRow {
  id: string
  session_id: string
  name: string
  summary: string | null
  approach: string
  pros: unknown
  cons: unknown
  effort: string | null
  risk: string | null
  recommended: boolean
  decision: string
  decision_rationale: string | null
  sort_order: number
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

interface ExplorationRow {
  id: string
  system_id: string
  status: string
  findings: ExplorationFindings | null
  summary: string | null
  created_at: string
}

interface PlanRow {
  id: string
  system_id: string
  exploration_id: string | null
  status: PlanStatus
  plan: GovernancePlanDoc | null
  approved_at: string | null
  built_at: string | null
  created_at: string
}

/** SAP role candidates for harmonization. Selected wide on purpose so the pure
 *  matcher can read whatever it needs off the row. */
interface SapRoleRow {
  id: string
  name: string
  description: string | null
  sap_role_name: string | null
  role_type: string | null
}

const SESSION_SELECT = 'id, title, scope, workstream_id, status, created_at'
const OPTION_SELECT = 'id, session_id, name, summary, approach, pros, cons, effort, risk, recommended, decision, decision_rationale, sort_order'
const SYSTEM_SELECT = 'id, name, kind, vendor, base_url, source_path, description, criticality, status'
const EXPLORATION_SELECT = 'id, system_id, status, findings, summary, created_at'
const PLAN_SELECT = 'id, system_id, exploration_id, status, plan, approved_at, built_at, created_at'
const SAP_ROLE_SELECT = 'id, name, description, sap_role_name, role_type'

// ─── Row resolvers (id wins; names resolve case-insensitively, fail closed) ─

async function findSession(ctx: ToolContext, idArg: unknown, titleArg: unknown): Promise<SessionRow | string> {
  const id = str(idArg)
  if (id) {
    const { data, error } = await ctx.modelDb
      .from('security_design_sessions')
      .select(SESSION_SELECT)
      .eq('id', id)
      .eq('organization_id', ctx.orgId)
      .maybeSingle()
    if (error) return `Error reading the design session: ${error.message}`
    if (!data) return "No such design session in this organization's studio. Do not guess ids; call list_design_sessions first."
    return data as unknown as SessionRow
  }
  const title = str(titleArg)
  if (!title) return 'Pass session_id or session_title.'
  const { data, error } = await ctx.modelDb
    .from('security_design_sessions')
    .select(SESSION_SELECT)
    .eq('organization_id', ctx.orgId)
  if (error) return `Error reading the design sessions: ${error.message}`
  const rows = (data ?? []) as unknown as SessionRow[]
  const t = title.toLowerCase()
  const matches = rows.filter((s) => s.title.toLowerCase() === t)
  if (!matches.length) return `No design session titled "${title}" exists in this organization. Call list_design_sessions; do not guess.`
  if (matches.length > 1) return `The title "${title}" matches ${matches.length} sessions (ids: ${matches.map((m) => m.id).join(', ')}). Call again with session_id.`
  return matches[0]
}

async function findSystem(ctx: ToolContext, idArg: unknown, nameArg: unknown): Promise<SystemRow | string> {
  const id = str(idArg)
  if (id) {
    const { data, error } = await ctx.modelDb
      .from('governed_systems')
      .select(SYSTEM_SELECT)
      .eq('id', id)
      .eq('organization_id', ctx.orgId)
      .maybeSingle()
    if (error) return `Error reading the governed system: ${error.message}`
    if (!data) return "No such governed system in this organization's studio. Do not guess ids; call list_governed_systems first."
    return data as unknown as SystemRow
  }
  const name = str(nameArg)
  if (!name) return 'Pass system_id or system_name.'
  const { data, error } = await ctx.modelDb
    .from('governed_systems')
    .select(SYSTEM_SELECT)
    .eq('organization_id', ctx.orgId)
  if (error) return `Error reading the governed systems: ${error.message}`
  const rows = (data ?? []) as unknown as SystemRow[]
  const n = name.toLowerCase()
  const matches = rows.filter((s) => s.name.toLowerCase() === n)
  if (!matches.length) return `No governed system named "${name}" is registered in this organization. Call list_governed_systems, or register it first with register_governed_system; do not guess.`
  if (matches.length > 1) return `The name "${name}" matches ${matches.length} systems (ids: ${matches.map((m) => m.id).join(', ')}). Call again with system_id.`
  return matches[0]
}

/** Resolve a plan by id, or the newest plan for a system. Fails closed. */
async function findPlan(ctx: ToolContext, args: Record<string, unknown>): Promise<{ plan: PlanRow; system: SystemRow } | string> {
  const planId = str(args.plan_id)
  if (planId) {
    const { data, error } = await ctx.modelDb
      .from('governance_plans')
      .select(PLAN_SELECT)
      .eq('id', planId)
      .eq('organization_id', ctx.orgId)
      .maybeSingle()
    if (error) return `Error reading the governance plan: ${error.message}`
    if (!data) return "No such governance plan in this organization's studio. Do not guess ids; call get_governance_plan or list_governed_systems first."
    const plan = data as unknown as PlanRow
    const system = await findSystem(ctx, plan.system_id, null)
    if (typeof system === 'string') return system
    return { plan, system }
  }
  const system = await findSystem(ctx, args.system_id, args.system_name)
  if (typeof system === 'string') return system
  const { data, error } = await ctx.modelDb
    .from('governance_plans')
    .select(PLAN_SELECT)
    .eq('organization_id', ctx.orgId)
    .eq('system_id', system.id)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return `Error reading the governance plans: ${error.message}`
  const rows = (data ?? []) as unknown as PlanRow[]
  if (!rows.length) return `"${system.name}" has no governance plan yet. Explore it with explore_governed_system, then draft one with draft_governance_plan.`
  return { plan: rows[0], system }
}

async function latestExploration(ctx: ToolContext, systemId: string): Promise<ExplorationRow | null | string> {
  const { data, error } = await ctx.modelDb
    .from('governance_explorations')
    .select(EXPLORATION_SELECT)
    .eq('organization_id', ctx.orgId)
    .eq('system_id', systemId)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return `Error reading the explorations: ${error.message}`
  const rows = (data ?? []) as unknown as ExplorationRow[]
  return rows[0] ?? null
}

// ─── Validation helpers ─────────────────────────────────────────────────────

/** Only http/https, a real host, and no embedded credentials (guardrail 1: the
 *  explorer never authenticates, so a user:pass URL is refused outright). */
function validateBaseUrl(raw: unknown): { ok: true; url: string | null } | { ok: false; reason: string } {
  const s = str(raw)
  if (!s) return { ok: true, url: null }
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return { ok: false, reason: `"${s}" is not a valid absolute URL. Use the form https://host[/path].` }
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, reason: `Only http and https are explorable; "${u.protocol}" is not.` }
  if (!u.hostname) return { ok: false, reason: 'The URL has no host.' }
  if (u.username || u.password) {
    return { ok: false, reason: 'The URL carries embedded credentials. Exploration never authenticates; register the base URL without a user:password prefix.' }
  }
  return { ok: true, url: u.toString() }
}

function parseCitations(raw: unknown): { sourceCode?: string; sourceTitle?: string }[] {
  if (!Array.isArray(raw)) return []
  const out: { sourceCode?: string; sourceTitle?: string }[] = []
  for (const c of raw.slice(0, 12)) {
    if (typeof c === 'string') {
      const s = c.trim()
      if (s) out.push({ sourceCode: s })
      continue
    }
    if (!c || typeof c !== 'object') continue
    const o = c as Record<string, unknown>
    const code = optStr(o.source_code ?? o.sourceCode)
    const title = optStr(o.source_title ?? o.sourceTitle)
    if (!code && !title) continue
    out.push({ ...(code ? { sourceCode: code } : {}), ...(title ? { sourceTitle: title } : {}) })
  }
  return out
}

/** Validate + normalize the agent-supplied GovernancePlanDoc. Fails closed on a
 *  missing objective; every list is capped and coerced, never invented. */
function parsePlanDoc(raw: unknown): GovernancePlanDoc | string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'plan must be an object shaped like the governance plan document (objective, identity, roleModel, controls, sod, remediation, buildPlan, openQuestions).'
  const o = raw as Record<string, unknown>
  const objective = str(o.objective)
  if (!objective) return 'The plan needs an objective: one or two sentences saying what governing this system is meant to achieve.'

  const identityRaw = (o.identity && typeof o.identity === 'object' ? o.identity : {}) as Record<string, unknown>
  const identity = { target: str(identityRaw.target), steps: strArr(identityRaw.steps, 20) }
  if (!identity.target) return 'plan.identity.target is required: the target identity model (e.g. "Entra ID SSO with SCIM provisioning").'

  const roleModel = (Array.isArray(o.roleModel) ? o.roleModel : [])
    .slice(0, MAX_ROLE_MODEL)
    .map((r) => {
      const ro = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
      return {
        name: str(ro.name),
        purpose: str(ro.purpose),
        permissions: strArr(ro.permissions, 60),
        ...(optStr(ro.mapsToSapRole ?? ro.maps_to_sap_role) ? { mapsToSapRole: optStr(ro.mapsToSapRole ?? ro.maps_to_sap_role)! } : {}),
      }
    })
    .filter((r) => !!r.name)

  const controls = (Array.isArray(o.controls) ? o.controls : [])
    .slice(0, MAX_CONTROLS)
    .map((c, i) => {
      const co = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
      return {
        id: str(co.id) || `C-${i + 1}`,
        title: str(co.title),
        detail: str(co.detail),
        ...(optStr(co.standard) ? { standard: optStr(co.standard)! } : {}),
      }
    })
    .filter((c) => !!c.title)

  const sod = (Array.isArray(o.sod) ? o.sod : [])
    .slice(0, MAX_SOD)
    .map((s) => {
      const so = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
      return { pair: str(so.pair), detail: str(so.detail), mitigation: str(so.mitigation) }
    })
    .filter((s) => !!s.pair)

  const remediation = (Array.isArray(o.remediation) ? o.remediation : [])
    .slice(0, MAX_REMEDIATION)
    .map((r, i) => {
      const ro = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
      const sev = str(ro.severity).toLowerCase()
      return {
        id: str(ro.id) || `R-${i + 1}`,
        title: str(ro.title),
        detail: str(ro.detail),
        severity: ((SEVERITIES as readonly string[]).includes(sev) ? sev : 'medium') as GovernancePlanDoc['remediation'][number]['severity'],
        ...(optStr(ro.effort) ? { effort: optStr(ro.effort)! } : {}),
      }
    })
    .filter((r) => !!r.title)

  const buildPlan = (Array.isArray(o.buildPlan ?? o.build_plan) ? (o.buildPlan ?? o.build_plan) as unknown[] : [])
    .slice(0, MAX_BUILD_PLAN)
    .map((b) => {
      const bo = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>
      const kind = str(bo.kind).toLowerCase()
      const targetPath = optStr(bo.targetPath ?? bo.target_path)
      return {
        artifact: str(bo.artifact),
        kind: ((ARTIFACT_KINDS as readonly string[]).includes(kind) ? kind : 'doc') as GovernancePlanDoc['buildPlan'][number]['kind'],
        ...(targetPath ? { targetPath } : {}),
        purpose: str(bo.purpose),
      }
    })
    .filter((b) => !!b.artifact)

  return {
    objective,
    identity,
    roleModel,
    controls,
    sod,
    remediation,
    buildPlan,
    openQuestions: strArr(o.openQuestions ?? o.open_questions, MAX_OPEN_QUESTIONS),
  }
}

/** One honest sentence about what an exploration actually observed. */
function summarizeFindings(f: ExplorationFindings): string {
  const bySeverity = new Map<string, number>()
  for (const r of f.risks ?? []) bySeverity.set(r.severity, (bySeverity.get(r.severity) ?? 0) + 1)
  const riskBits = (SEVERITIES as readonly string[])
    .map((s) => (bySeverity.get(s) ? `${bySeverity.get(s)} ${s}` : null))
    .filter(Boolean)
    .join(', ')
  const parts = [
    `Auth mechanism: ${f.authModel?.mechanism || 'not determined'}${f.authModel?.idp ? ` via ${f.authModel.idp}` : ''}`,
    `${(f.discoveredRoles ?? []).length} role(s) observed`,
    `${(f.permissions ?? []).length} permission(s)`,
    `${(f.surfaces ?? []).length} surface(s)`,
    `${(f.risks ?? []).length} risk(s)${riskBits ? ` (${riskBits})` : ''}`,
    `scanned ${f.scanned?.urls ?? 0} URL(s) and ${f.scanned?.files ?? 0} file(s)`,
  ]
  if ((f.unreachable ?? []).length) parts.push(`${f.unreachable.length} target(s) unreachable or unscannable`)
  return parts.join('; ') + '.'
}

// ─── F1: design advisory ────────────────────────────────────────────────────

export const START_DESIGN_SESSION: AgentTool = {
  name: 'start_design_session',
  description:
    `Open a NEW security design advisory session in the Security Design Studio: a titled conversation about HOW to do a piece of security design (for example "S/4HANA authorization concept for A&D program controls"), with an optional scope note and a workstream home. Guidance, design options, and the operator's decision are captured against this session. ${ONLY_ON_REQUEST} ` +
    `Returns the session id and the ${DESIGN_LINK} link to cite in your reply.`,
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The session title: the design question being worked (e.g. "Least-privilege model for project cost analysts").' },
      scope: { type: 'string', description: 'Optional scope note: systems, org levels, compliance regime, or the boundary of the question.' },
      ...WS_PROP,
    },
    required: ['title'],
  },
  async execute(args, ctx) {
    const title = str(args.title)
    if (!title) return 'A design session needs a title.'

    const { data: existingRows, error: exErr } = await ctx.modelDb
      .from('security_design_sessions')
      .select('id, title')
      .eq('organization_id', ctx.orgId)
    if (exErr) return `Error reading the existing design sessions: ${exErr.message}`
    const dup = ((existingRows ?? []) as { id: string; title: string }[]).find((s) => s.title.toLowerCase() === title.toLowerCase())
    if (dup) return `A design session titled "${dup.title}" already exists (id ${dup.id}). Continue it with capture_design_guidance / propose_design_options, or pick a different title.`

    const ws = resolveWs(ctx, args.workstream_code)
    const { data, error } = await ctx.modelDb
      .from('security_design_sessions')
      .insert({
        organization_id: ctx.orgId,
        title,
        scope: optStr(args.scope),
        workstream_id: ws.id,
        status: 'active',
      })
      .select('id, title')
      .single()
    if (error || !data) return `Failed to start the design session: ${error?.message ?? 'no row returned'}.`
    return J({
      created: 'security_design_session',
      id: (data as { id: string }).id,
      title,
      status: 'active',
      workstream: ws.code ?? undefined,
      link: DESIGN_LINK,
      ...(ws.warning ? { warning: ws.warning } : {}),
      note: CITE_NOTE,
    })
  },
}

export const LIST_DESIGN_SESSIONS: AgentTool = {
  name: 'list_design_sessions',
  description:
    'List the security design advisory sessions in the Security Design Studio: id, title, scope, status (active, decided, archived), how much grounded guidance has been captured, how many solution design options exist, and which option was selected. Use this to find the session the user is talking about before adding to it.',
  input_schema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['active', 'decided', 'archived'], description: 'Optional status filter.' },
    },
    required: [],
  },
  async execute(args, ctx) {
    const { data, error } = await ctx.modelDb
      .from('security_design_sessions')
      .select(SESSION_SELECT)
      .eq('organization_id', ctx.orgId)
      .order('created_at', { ascending: false })
    if (error) return `Error reading the design sessions: ${error.message}`
    const rows = (data ?? []) as unknown as SessionRow[]
    const statusFilter = str(args.status)
    const filtered = statusFilter && (SESSION_STATUSES as readonly string[]).includes(statusFilter) ? rows.filter((s) => s.status === statusFilter) : rows
    if (!filtered.length) {
      return 'The organization has no security design sessions yet' + (statusFilter ? ` with status ${statusFilter}` : '') + `. Start one with start_design_session, or open ${DESIGN_LINK}.`
    }

    const ids = rows.map((s) => s.id)
    const [{ data: gRows }, { data: oRows }] = await Promise.all([
      ctx.modelDb.from('security_design_guidance').select('session_id').eq('organization_id', ctx.orgId).in('session_id', ids),
      ctx.modelDb.from('security_design_options').select('session_id, name, approach, recommended, decision').eq('organization_id', ctx.orgId).in('session_id', ids),
    ])
    const guidanceCount = new Map<string, number>()
    for (const g of (gRows ?? []) as { session_id: string }[]) guidanceCount.set(g.session_id, (guidanceCount.get(g.session_id) ?? 0) + 1)
    const optsBySession = new Map<string, { name: string; approach: string; recommended: boolean; decision: string }[]>()
    for (const o of (oRows ?? []) as { session_id: string; name: string; approach: string; recommended: boolean; decision: string }[]) {
      optsBySession.set(o.session_id, [...(optsBySession.get(o.session_id) ?? []), o])
    }

    return J({
      sessions: filtered.map((s) => {
        const opts = optsBySession.get(s.id) ?? []
        const selected = opts.find((o) => o.decision === 'selected')
        return {
          id: s.id,
          title: s.title,
          scope: s.scope ?? undefined,
          status: s.status,
          guidance_entries: guidanceCount.get(s.id) ?? 0,
          options: opts.length,
          ...(selected ? { selected_option: { name: selected.name, approach: selected.approach } } : {}),
        }
      }),
      link: DESIGN_LINK,
      note: CITE_NOTE,
    })
  },
}

export const CAPTURE_DESIGN_GUIDANCE: AgentTool = {
  name: 'capture_design_guidance',
  description:
    `Record GROUNDED security design best practice into a design session: one or more entries, each a topic, the guidance body, and the knowledge-base citations it came from. Search the knowledge base first and cite what you actually read; ${HONESTY_GUARDRAIL} If the knowledge base does not cover a point, say so in the body rather than inventing a standard. ${ONLY_ON_REQUEST} ` +
    `Maximum ${MAX_GUIDANCE} entries per call.`,
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'The design session (from list_design_sessions).' },
      session_title: { type: 'string', description: 'Alternative to session_id: the session title (exact, case-insensitive).' },
      topic: { type: 'string', description: 'Single-entry shorthand: the topic of one guidance entry.' },
      body: { type: 'string', description: 'Single-entry shorthand: the guidance body for that topic.' },
      citations: {
        type: 'array',
        description: 'Single-entry shorthand: the knowledge sources this guidance came from.',
        items: { type: 'object', properties: { source_code: { type: 'string' }, source_title: { type: 'string' } } },
      },
      items: {
        type: 'array',
        description: `The guidance entries to capture (maximum ${MAX_GUIDANCE}).`,
        items: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Short topic label (e.g. "Derived roles and org levels").' },
            body: { type: 'string', description: 'The guidance itself: specific, decision-oriented, and honest about what the knowledge base did not cover.' },
            citations: {
              type: 'array',
              description: 'The knowledge sources this entry is grounded on.',
              items: { type: 'object', properties: { source_code: { type: 'string' }, source_title: { type: 'string' } } },
            },
          },
          required: ['topic', 'body'],
        },
      },
    },
    required: [],
  },
  async execute(args, ctx) {
    const raw = Array.isArray(args.items) ? args.items : []
    const entries: { topic: string; body: string; citations: { sourceCode?: string; sourceTitle?: string }[] }[] = []
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i]
      if (!item || typeof item !== 'object') return `Item ${i} is not an object. Nothing was captured.`
      const o = item as Record<string, unknown>
      const topic = str(o.topic)
      const body = str(o.body)
      if (!topic || !body) return `Item ${i} needs both a topic and a body. Nothing was captured.`
      entries.push({ topic, body, citations: parseCitations(o.citations) })
    }
    if (str(args.topic) && str(args.body)) {
      entries.push({ topic: str(args.topic), body: str(args.body), citations: parseCitations(args.citations) })
    }
    if (!entries.length) return 'Provide items[] (each with a topic and a body), or the topic/body shorthand for a single entry.'
    if (entries.length > MAX_GUIDANCE) return `That is ${entries.length} entries; the cap is ${MAX_GUIDANCE} per call. Split the request.`

    const session = await findSession(ctx, args.session_id, args.session_title)
    if (typeof session === 'string') return session

    const { count } = await ctx.modelDb
      .from('security_design_guidance')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .eq('session_id', session.id)
    const sortStart = count ?? 0

    const { error } = await ctx.modelDb.from('security_design_guidance').insert(
      entries.map((e, i) => ({
        organization_id: ctx.orgId,
        session_id: session.id,
        topic: e.topic,
        body: e.body,
        citations: e.citations,
        sort_order: sortStart + i,
      }))
    )
    if (error) return `Failed to capture the design guidance: ${error.message}`

    const uncited = entries.filter((e) => !e.citations.length).map((e) => e.topic)
    return J({
      updated: 'security_design_session',
      session_id: session.id,
      session: session.title,
      captured: entries.map((e) => ({ topic: e.topic, citations: e.citations.length })),
      ...(uncited.length ? { warning: `These entries carry no citation, so the user cannot trace them: ${uncited.join(', ')}. Say so in your reply rather than implying they are sourced.` } : {}),
      link: DESIGN_LINK,
      note: CITE_NOTE,
    })
  },
}

export const PROPOSE_DESIGN_OPTIONS: AgentTool = {
  name: 'propose_design_options',
  description:
    `Record the SOLUTION DESIGN OPTIONS for a design session: each option is a named approach (${APPROACH_LIST}) with a summary, pros, cons, effort, risk, and whether you recommend it. Use this wherever standard SAP will not cover the requirement outright, so the operator can compare a standard, configuration, enhancement, third-party, and process-control answer side by side. Ground each option in what you actually know; ${HONESTY_GUARDRAIL} ${ONLY_ON_REQUEST} ` +
    `Maximum ${MAX_OPTIONS} options per call. Nothing is decided here: the operator chooses with record_design_decision.`,
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'The design session (from list_design_sessions).' },
      session_title: { type: 'string', description: 'Alternative to session_id: the session title.' },
      options: {
        type: 'array',
        description: `The design options to record (maximum ${MAX_OPTIONS}).`,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Short option name (e.g. "Derived roles by company code").' },
            summary: { type: 'string', description: 'One or two sentences describing the option.' },
            approach: { type: 'string', enum: ['standard', 'configuration', 'enhancement', 'third_party', 'process_control'], description: 'Defaults to standard.' },
            pros: { type: 'array', items: { type: 'string' }, description: 'What this option buys.' },
            cons: { type: 'array', items: { type: 'string' }, description: 'What it costs or risks.' },
            effort: { type: 'string', description: 'Honest effort estimate (e.g. "2 to 3 weeks, one security consultant").' },
            risk: { type: 'string', description: 'The principal risk, stated plainly.' },
            recommended: { type: 'boolean', description: 'True for the option you recommend. Recommend at most one.' },
          },
          required: ['name'],
        },
      },
    },
    required: ['options'],
  },
  async execute(args, ctx) {
    const raw = Array.isArray(args.options) ? args.options : []
    if (!raw.length) return 'Provide at least one design option.'
    if (raw.length > MAX_OPTIONS) return `That is ${raw.length} options; the cap is ${MAX_OPTIONS} per call. Narrow the comparison.`

    const specs: { name: string; summary: string | null; approach: DesignApproach; pros: string[]; cons: string[]; effort: string | null; risk: string | null; recommended: boolean }[] = []
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i]
      if (!item || typeof item !== 'object') return `Option ${i} is not an object. Nothing was recorded.`
      const o = item as Record<string, unknown>
      const name = str(o.name)
      if (!name) return `Option ${i} needs a name. Nothing was recorded.`
      const approach = (str(o.approach) || 'standard') as DesignApproach
      if (!APPROACHES.includes(approach)) return `Option "${name}": approach "${str(o.approach)}" is invalid; use one of ${APPROACH_LIST}. Nothing was recorded.`
      specs.push({
        name,
        summary: optStr(o.summary),
        approach,
        pros: strArr(o.pros, 12),
        cons: strArr(o.cons, 12),
        effort: optStr(o.effort),
        risk: optStr(o.risk),
        recommended: o.recommended === true,
      })
    }

    const session = await findSession(ctx, args.session_id, args.session_title)
    if (typeof session === 'string') return session

    const { data: existingRows, error: exErr } = await ctx.modelDb
      .from('security_design_options')
      .select('id, name, sort_order')
      .eq('organization_id', ctx.orgId)
      .eq('session_id', session.id)
    if (exErr) return `Error reading the session's existing options: ${exErr.message}`
    const existing = (existingRows ?? []) as { id: string; name: string; sort_order: number }[]
    const existingNames = new Set(existing.map((o) => o.name.toLowerCase()))
    const dup = specs.filter((s) => existingNames.has(s.name.toLowerCase())).map((s) => s.name)
    if (dup.length) return `These options already exist on "${session.title}": ${dup.join(', ')}. Nothing was recorded; rename them or use record_design_decision on the existing ones.`
    const sortStart = existing.reduce((m, o) => Math.max(m, (o.sort_order ?? 0) + 1), 0)

    const { data, error } = await ctx.modelDb
      .from('security_design_options')
      .insert(
        specs.map((s, i) => ({
          organization_id: ctx.orgId,
          session_id: session.id,
          name: s.name,
          summary: s.summary,
          approach: s.approach,
          pros: s.pros,
          cons: s.cons,
          effort: s.effort,
          risk: s.risk,
          recommended: s.recommended,
          decision: 'open',
          sort_order: sortStart + i,
        }))
      )
      .select('id, name')
    if (error) return `Failed to record the design options: ${error.message}`

    const recommendedCount = specs.filter((s) => s.recommended).length
    return J({
      updated: 'security_design_session',
      session_id: session.id,
      session: session.title,
      options: ((data ?? []) as { id: string; name: string }[]).map((r) => {
        const spec = specs.find((s) => s.name === r.name)
        return { id: r.id, name: r.name, approach: spec?.approach, recommended: !!spec?.recommended }
      }),
      ...(recommendedCount > 1 ? { warning: `${recommendedCount} options are flagged recommended. Tell the user which one you actually recommend, or clear the extras.` } : {}),
      next: 'The operator decides: call record_design_decision once they choose.',
      link: DESIGN_LINK,
      note: CITE_NOTE,
    })
  },
}

export const RECORD_DESIGN_DECISION: AgentTool = {
  name: 'record_design_decision',
  description:
    `Record the operator's DECISION on a solution design option: selected or rejected, with the rationale that is kept on the record. Selecting an option marks its sibling options rejected (pass leave_siblings_open true to keep them open) and marks the session decided. Only record a decision the user actually made; never decide on their behalf. ${ONLY_ON_REQUEST}`,
  input_schema: {
    type: 'object',
    properties: {
      option_id: { type: 'string', description: 'The design option (from propose_design_options or list_design_sessions).' },
      option_name: { type: 'string', description: 'Alternative to option_id: the option name, with session_id or session_title.' },
      session_id: { type: 'string', description: 'The design session, when identifying the option by name.' },
      session_title: { type: 'string', description: 'Alternative to session_id.' },
      decision: { type: 'string', enum: ['selected', 'rejected'], description: 'What the operator decided.' },
      rationale: { type: 'string', description: "The operator's reason, recorded on the option." },
      leave_siblings_open: { type: 'boolean', description: 'Default false. True keeps the other options open instead of marking them rejected when one is selected.' },
    },
    required: ['decision'],
  },
  async execute(args, ctx) {
    const decision = str(args.decision)
    if (decision !== 'selected' && decision !== 'rejected') return "decision must be 'selected' or 'rejected'."

    let option: OptionRow | null = null
    const optionId = str(args.option_id)
    if (optionId) {
      const { data, error } = await ctx.modelDb
        .from('security_design_options')
        .select(OPTION_SELECT)
        .eq('id', optionId)
        .eq('organization_id', ctx.orgId)
        .maybeSingle()
      if (error) return `Error reading the design option: ${error.message}`
      if (!data) return "No such design option in this organization's studio. Do not guess ids; call list_design_sessions first."
      option = data as unknown as OptionRow
    } else {
      const name = str(args.option_name)
      if (!name) return 'Pass option_id, or option_name with session_id / session_title.'
      const session = await findSession(ctx, args.session_id, args.session_title)
      if (typeof session === 'string') return session
      const { data, error } = await ctx.modelDb
        .from('security_design_options')
        .select(OPTION_SELECT)
        .eq('organization_id', ctx.orgId)
        .eq('session_id', session.id)
      if (error) return `Error reading the design options: ${error.message}`
      const rows = (data ?? []) as unknown as OptionRow[]
      const n = name.toLowerCase()
      const matches = rows.filter((o) => o.name.toLowerCase() === n)
      if (!matches.length) return `"${session.title}" has no option named "${name}". Call list_design_sessions to see the actual options; do not guess.`
      if (matches.length > 1) return `The name "${name}" matches ${matches.length} options (ids: ${matches.map((m) => m.id).join(', ')}). Call again with option_id.`
      option = matches[0]
    }

    const nowIso = new Date().toISOString()
    const { error: upErr } = await ctx.modelDb
      .from('security_design_options')
      .update({ decision, decision_rationale: optStr(args.rationale), updated_at: nowIso })
      .eq('id', option.id)
      .eq('organization_id', ctx.orgId)
    if (upErr) return `Failed to record the decision: ${upErr.message}`

    let siblingsRejected: string[] = []
    if (decision === 'selected' && args.leave_siblings_open !== true) {
      const { data: sibs, error: sibErr } = await ctx.modelDb
        .from('security_design_options')
        .update({ decision: 'rejected', updated_at: nowIso })
        .eq('organization_id', ctx.orgId)
        .eq('session_id', option.session_id)
        .neq('id', option.id)
        .neq('decision', 'rejected')
        .select('name')
      if (sibErr) return `The decision on "${option.name}" was recorded, but marking the sibling options rejected failed: ${sibErr.message}. Say so, and set them individually.`
      siblingsRejected = ((sibs ?? []) as { name: string }[]).map((s) => s.name)
    }

    let sessionStatus: string | undefined
    if (decision === 'selected') {
      const { error: sErr } = await ctx.modelDb
        .from('security_design_sessions')
        .update({ status: 'decided', updated_at: nowIso })
        .eq('id', option.session_id)
        .eq('organization_id', ctx.orgId)
      sessionStatus = sErr ? undefined : 'decided'
    }

    return J({
      updated: 'security_design_option',
      id: option.id,
      option: option.name,
      approach: option.approach,
      decision,
      rationale: optStr(args.rationale) ?? undefined,
      ...(siblingsRejected.length ? { siblings_rejected: siblingsRejected } : {}),
      ...(sessionStatus ? { session_status: sessionStatus } : {}),
      link: DESIGN_LINK,
      note: CITE_NOTE,
    })
  },
}

// ─── F2: explore and govern ─────────────────────────────────────────────────

export const REGISTER_GOVERNED_SYSTEM: AgentTool = {
  name: 'register_governed_system',
  description:
    `Register a system for the operator to GOVERN: a COTS product or a custom / vibe-coded application, with a base URL and/or a local source path, a vendor, a description, and a criticality. Registration is the operator's declaration that they administer this system and authorize read-only reconnaissance of it. ${RECON_GUARDRAIL} Never register a host the user did not name. ${ONLY_ON_REQUEST} ` +
    `Returns the system id and the ${DESIGN_LINK} link to cite.`,
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'The system name as the operator calls it (e.g. "Contract Portal").' },
      kind: { type: 'string', enum: ['cots', 'custom'], description: 'cots = a purchased product; custom = an in-house or vibe-coded application. Defaults to custom.' },
      vendor: { type: 'string', description: 'For COTS: the vendor.' },
      base_url: { type: 'string', description: 'The system base URL (http or https, no embedded credentials). Explored read-only, same-origin only.' },
      source_path: { type: 'string', description: 'A local filesystem path to the source tree, when the operator has it checked out.' },
      description: { type: 'string', description: 'What the system does and who uses it.' },
      criticality: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Business criticality.' },
    },
    required: ['name'],
  },
  async execute(args, ctx) {
    const name = str(args.name)
    if (!name) return 'A governed system needs a name.'
    const kind = (str(args.kind) || 'custom') as (typeof SYSTEM_KINDS)[number]
    if (!(SYSTEM_KINDS as readonly string[]).includes(kind)) return `kind must be one of: ${SYSTEM_KINDS.join(', ')}.`
    const criticality = str(args.criticality)
    if (criticality && !(CRITICALITIES as readonly string[]).includes(criticality)) return `criticality must be one of: ${CRITICALITIES.join(', ')}.`

    const urlCheck = validateBaseUrl(args.base_url)
    if (!urlCheck.ok) return `The base URL was rejected: ${urlCheck.reason}`
    const sourcePath = optStr(args.source_path)

    const { data: existingRows, error: exErr } = await ctx.modelDb
      .from('governed_systems')
      .select('id, name')
      .eq('organization_id', ctx.orgId)
    if (exErr) return `Error reading the governed systems: ${exErr.message}`
    const dup = ((existingRows ?? []) as { id: string; name: string }[]).find((s) => s.name.toLowerCase() === name.toLowerCase())
    if (dup) return `A system named "${dup.name}" is already registered (id ${dup.id}). Explore it with explore_governed_system, or pick a different name.`

    const { data, error } = await ctx.modelDb
      .from('governed_systems')
      .insert({
        organization_id: ctx.orgId,
        name,
        kind,
        vendor: optStr(args.vendor),
        base_url: urlCheck.url,
        source_path: sourcePath,
        description: optStr(args.description),
        criticality: criticality || null,
        status: 'registered',
      })
      .select('id, name')
      .single()
    if (error || !data) return `Failed to register the system: ${error?.message ?? 'no row returned'}.`

    return J({
      created: 'governed_system',
      id: (data as { id: string }).id,
      name,
      kind,
      base_url: urlCheck.url ?? undefined,
      source_path: sourcePath ?? undefined,
      status: 'registered',
      ...(!urlCheck.url && !sourcePath
        ? { warning: 'Neither a base URL nor a source path was given, so there is nothing to explore. Ask the operator for one and update the registration in the studio.' }
        : {}),
      link: DESIGN_LINK,
      note: CITE_NOTE,
    })
  },
}

export const LIST_GOVERNED_SYSTEMS: AgentTool = {
  name: 'list_governed_systems',
  description:
    'List the systems registered for governance: id, name, kind (cots or custom), vendor, base URL, source path, criticality, lifecycle status (registered, explored, planned, approved, governed), when it was last explored, and its latest governance plan with that plan\'s status. Use this to find the system the user is talking about before exploring or planning.',
  input_schema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['registered', 'explored', 'planned', 'approved', 'governed'], description: 'Optional lifecycle-status filter.' },
    },
    required: [],
  },
  async execute(args, ctx) {
    const { data, error } = await ctx.modelDb
      .from('governed_systems')
      .select(SYSTEM_SELECT)
      .eq('organization_id', ctx.orgId)
      .order('name')
    if (error) return `Error reading the governed systems: ${error.message}`
    const rows = (data ?? []) as unknown as SystemRow[]
    const statusFilter = str(args.status)
    const filtered = statusFilter ? rows.filter((s) => s.status === statusFilter) : rows
    if (!filtered.length) {
      return 'No systems are registered for governance yet' + (statusFilter ? ` with status ${statusFilter}` : '') + `. Register one with register_governed_system, or open ${DESIGN_LINK}.`
    }

    const ids = rows.map((s) => s.id)
    const [{ data: eRows }, { data: pRows }] = await Promise.all([
      ctx.modelDb.from('governance_explorations').select('system_id, status, summary, created_at').eq('organization_id', ctx.orgId).in('system_id', ids),
      ctx.modelDb.from('governance_plans').select('id, system_id, status, created_at').eq('organization_id', ctx.orgId).in('system_id', ids),
    ])
    const lastExplored = new Map<string, { status: string; summary: string | null; created_at: string }>()
    for (const e of (eRows ?? []) as { system_id: string; status: string; summary: string | null; created_at: string }[]) {
      const prev = lastExplored.get(e.system_id)
      if (!prev || e.created_at > prev.created_at) lastExplored.set(e.system_id, e)
    }
    const lastPlan = new Map<string, { id: string; status: string; created_at: string }>()
    for (const p of (pRows ?? []) as { id: string; system_id: string; status: string; created_at: string }[]) {
      const prev = lastPlan.get(p.system_id)
      if (!prev || p.created_at > prev.created_at) lastPlan.set(p.system_id, p)
    }

    return J({
      systems: filtered.map((s) => {
        const e = lastExplored.get(s.id)
        const p = lastPlan.get(s.id)
        return {
          id: s.id,
          name: s.name,
          kind: s.kind,
          vendor: s.vendor ?? undefined,
          base_url: s.base_url ?? undefined,
          source_path: s.source_path ?? undefined,
          criticality: s.criticality ?? undefined,
          status: s.status,
          ...(e ? { last_exploration: { at: e.created_at, status: e.status, summary: e.summary ?? undefined } } : {}),
          ...(p ? { latest_plan: { id: p.id, status: p.status } } : {}),
        }
      }),
      link: DESIGN_LINK,
      note: CITE_NOTE,
    })
  },
}

export const EXPLORE_GOVERNED_SYSTEM: AgentTool = {
  name: 'explore_governed_system',
  description:
    `Run the READ-ONLY exploration of a registered governed system and record the findings: authentication model, discovered roles and permissions, surfaces, security-header and cookie posture, framework and auth libraries, and risks. ${RECON_GUARDRAIL} ${HONESTY_GUARDRAIL} The result reports exactly what was observed plus an honest list of what could not be reached or scanned. Sets the system status to explored. ${ONLY_ON_REQUEST}`,
  input_schema: {
    type: 'object',
    properties: {
      system_id: { type: 'string', description: 'The registered system (from list_governed_systems).' },
      system_name: { type: 'string', description: 'Alternative to system_id: the registered system name.' },
    },
    required: [],
  },
  async execute(args, ctx) {
    const system = await findSystem(ctx, args.system_id, args.system_name)
    if (typeof system === 'string') return system
    if (!system.base_url && !system.source_path) {
      return `"${system.name}" has neither a base URL nor a source path registered, so there is nothing to explore read-only. Ask the operator for one and update the registration in the studio at ${DESIGN_LINK}.`
    }

    let findings: ExplorationFindings
    try {
      findings = await runExploration({
        ...(system.base_url ? { baseUrl: system.base_url } : {}),
        ...(system.source_path ? { sourcePath: system.source_path } : {}),
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'exploration failed'
      await ctx.modelDb.from('governance_explorations').insert({
        organization_id: ctx.orgId,
        system_id: system.id,
        status: 'failed',
        findings: {},
        summary: `Exploration failed: ${message}`,
      })
      return `The exploration of "${system.name}" failed: ${message}. Nothing was inferred about the system; report that honestly rather than guessing its security model.`
    }

    const summary = summarizeFindings(findings)
    const { data, error } = await ctx.modelDb
      .from('governance_explorations')
      .insert({
        organization_id: ctx.orgId,
        system_id: system.id,
        status: 'complete',
        findings,
        summary,
      })
      .select('id')
      .single()
    if (error || !data) return `The exploration ran, but recording it failed: ${error?.message ?? 'no row returned'}. Nothing was persisted; do not treat the findings as governed evidence.`

    // Registered -> explored. A system already further along (planned, approved,
    // governed) keeps its status: a re-exploration is evidence, not a rollback.
    if (system.status === 'registered') {
      await ctx.modelDb
        .from('governed_systems')
        .update({ status: 'explored', updated_at: new Date().toISOString() })
        .eq('id', system.id)
        .eq('organization_id', ctx.orgId)
    }

    return J({
      created: 'governance_exploration',
      id: (data as { id: string }).id,
      system_id: system.id,
      system: system.name,
      summary,
      auth_model: findings.authModel,
      discovered_roles: (findings.discoveredRoles ?? []).map((r) => ({ name: r.name, source: r.source, permissions: (r.permissions ?? []).length })),
      permissions_sample: (findings.permissions ?? []).slice(0, 40),
      surfaces: findings.surfaces ?? [],
      posture: findings.posture,
      risks: (findings.risks ?? []).map((r) => ({ id: r.id, severity: r.severity, title: r.title, detail: r.detail, ...(r.evidence ? { evidence: r.evidence } : {}) })),
      scanned: findings.scanned,
      unreachable: findings.unreachable ?? [],
      next: 'Draft a governance plan with draft_governance_plan, then harmonize its roles with harmonize_governance_with_sap.',
      link: DESIGN_LINK,
      note: `${CITE_NOTE} State the unreachable list in your reply; do not present partial reconnaissance as complete.`,
    })
  },
}

export const DRAFT_GOVERNANCE_PLAN: AgentTool = {
  name: 'draft_governance_plan',
  description:
    `Draft the GOVERNANCE PLAN for an explored system: the objective, the target identity model and the steps to reach it, a least-privilege role model, controls mapped to the relevant standard (NIST 800-171 / CMMC / ITAR where genuinely relevant), segregation-of-duties pairs, remediation items with severity, the build plan (which artifacts the studio would generate), and the open questions. Ground every element in the exploration findings; ${HONESTY_GUARDRAIL} The plan is written as a DRAFT: the operator moves it to review and then approves it before anything can be built. ${ONLY_ON_REQUEST} ` +
    `Caps per plan: ${MAX_ROLE_MODEL} roles, ${MAX_CONTROLS} controls, ${MAX_SOD} SoD pairs, ${MAX_REMEDIATION} remediation items, ${MAX_BUILD_PLAN} build-plan entries, ${MAX_OPEN_QUESTIONS} open questions.`,
  input_schema: {
    type: 'object',
    properties: {
      system_id: { type: 'string', description: 'The explored system (from list_governed_systems).' },
      system_name: { type: 'string', description: 'Alternative to system_id: the registered system name.' },
      exploration_id: { type: 'string', description: 'Optional: the exploration this plan is grounded on. Defaults to the most recent complete exploration of the system.' },
      plan: {
        type: 'object',
        description: 'The governance plan document.',
        properties: {
          objective: { type: 'string', description: 'One or two sentences: what governing this system achieves.' },
          identity: {
            type: 'object',
            properties: {
              target: { type: 'string', description: 'The target identity model (e.g. "Entra ID SSO with SCIM provisioning, local accounts retired").' },
              steps: { type: 'array', items: { type: 'string' }, description: 'The steps to get there.' },
            },
            required: ['target'],
          },
          roleModel: {
            type: 'array',
            description: 'The least-privilege role model.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                purpose: { type: 'string' },
                permissions: { type: 'array', items: { type: 'string' } },
                mapsToSapRole: { type: 'string', description: 'The SAP role this aligns to, when one exists.' },
              },
              required: ['name', 'purpose'],
            },
          },
          controls: {
            type: 'array',
            description: 'Controls, mapped to a standard where one genuinely applies.',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, title: { type: 'string' }, detail: { type: 'string' }, standard: { type: 'string', description: 'e.g. NIST 800-171 3.1.1, CMMC AC.L2-3.1.1, ITAR 22 CFR 120.' } },
              required: ['title', 'detail'],
            },
          },
          sod: {
            type: 'array',
            description: 'Segregation-of-duties conflicts and their mitigations.',
            items: { type: 'object', properties: { pair: { type: 'string' }, detail: { type: 'string' }, mitigation: { type: 'string' } }, required: ['pair', 'detail'] },
          },
          remediation: {
            type: 'array',
            description: 'What must be fixed, worst first.',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, title: { type: 'string' }, detail: { type: 'string' }, severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, effort: { type: 'string' } },
              required: ['title', 'detail', 'severity'],
            },
          },
          buildPlan: {
            type: 'array',
            description: 'The artifacts the studio would generate once the plan is approved.',
            items: {
              type: 'object',
              properties: { artifact: { type: 'string' }, kind: { type: 'string', enum: ['policy', 'config', 'code', 'mapping', 'runbook', 'doc'] }, targetPath: { type: 'string' }, purpose: { type: 'string' } },
              required: ['artifact', 'kind', 'purpose'],
            },
          },
          openQuestions: { type: 'array', items: { type: 'string' }, description: 'What the exploration could not answer and the operator must confirm.' },
        },
        required: ['objective', 'identity'],
      },
    },
    required: ['plan'],
  },
  async execute(args, ctx) {
    const doc = parsePlanDoc(args.plan)
    if (typeof doc === 'string') return `${doc} Nothing was written.`

    const system = await findSystem(ctx, args.system_id, args.system_name)
    if (typeof system === 'string') return system

    let explorationId: string | null = null
    let findings: ExplorationFindings | null = null
    const explicitExploration = str(args.exploration_id)
    if (explicitExploration) {
      const { data, error } = await ctx.modelDb
        .from('governance_explorations')
        .select(EXPLORATION_SELECT)
        .eq('id', explicitExploration)
        .eq('organization_id', ctx.orgId)
        .maybeSingle()
      if (error) return `Error reading the exploration: ${error.message}`
      const row = data as unknown as ExplorationRow | null
      if (!row || row.system_id !== system.id) return `That exploration_id does not belong to "${system.name}". Call list_governed_systems and explore the system first; do not guess ids.`
      explorationId = row.id
      findings = row.findings
    } else {
      const latest = await latestExploration(ctx, system.id)
      if (typeof latest === 'string') return latest
      if (latest) {
        explorationId = latest.id
        findings = latest.findings
      }
    }

    const { data, error } = await ctx.modelDb
      .from('governance_plans')
      .insert({
        organization_id: ctx.orgId,
        system_id: system.id,
        exploration_id: explorationId,
        status: 'draft',
        plan: doc,
      })
      .select('id')
      .single()
    if (error || !data) return `Failed to write the governance plan: ${error?.message ?? 'no row returned'}.`
    const planId = (data as { id: string }).id

    if (['registered', 'explored'].includes(system.status)) {
      await ctx.modelDb
        .from('governed_systems')
        .update({ status: 'planned', updated_at: new Date().toISOString() })
        .eq('id', system.id)
        .eq('organization_id', ctx.orgId)
    }

    return J({
      created: 'governance_plan',
      id: planId,
      system_id: system.id,
      system: system.name,
      status: 'draft',
      grounded_on_exploration: explorationId ?? undefined,
      counts: {
        role_model: doc.roleModel.length,
        controls: doc.controls.length,
        sod: doc.sod.length,
        remediation: doc.remediation.length,
        build_plan: doc.buildPlan.length,
        open_questions: doc.openQuestions.length,
      },
      ...(explorationId
        ? {}
        : { warning: 'This plan is not grounded on any exploration of the system. Say so plainly: it is a proposal from the conversation, not from observed evidence.' }),
      ...(findings && (findings.unreachable ?? []).length
        ? { unreachable_at_exploration: findings.unreachable }
        : {}),
      next: 'Harmonize the roles with harmonize_governance_with_sap. The operator then moves the plan to review and approves it. Nothing can be built until it is approved.',
      link: DESIGN_LINK,
      note: CITE_NOTE,
    })
  },
}

export const HARMONIZE_GOVERNANCE_WITH_SAP: AgentTool = {
  name: 'harmonize_governance_with_sap',
  description:
    `Harmonize a governed system's external roles with the SAP security roles and personas already governed in this suite. Runs the deterministic matcher (name-token overlap plus a domain-keyword bridge onto the SAP access the role actually carries) over the roles observed by the exploration, and records the result as the plan's role map: map (a clear SAP analogue), review (a partial match or an unmanaged superuser), or create (no analogue, propose a new role). Every row carries a confidence and a rationale naming the evidence. ${HONESTY_GUARDRAIL} Roles the exploration never observed can be added with external_roles only when the operator declares them. ${ONLY_ON_REQUEST} ` +
    `Maximum ${MAX_DECLARED_ROLES} declared roles per call.`,
  input_schema: {
    type: 'object',
    properties: {
      plan_id: { type: 'string', description: 'The governance plan whose role map to build.' },
      system_id: { type: 'string', description: 'Alternative to plan_id: the system, whose newest plan is used.' },
      system_name: { type: 'string', description: 'Alternative to system_id: the registered system name.' },
      external_roles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: role names the OPERATOR declared that the exploration did not observe. Recorded with source "declared". Never invent entries here.',
      },
    },
    required: [],
  },
  async execute(args, ctx) {
    const found = await findPlan(ctx, args)
    if (typeof found === 'string') return found
    const { plan, system } = found

    // External roles: whatever the exploration actually observed, plus anything
    // the operator explicitly declared.
    let observed: DiscoveredRole[] = []
    if (plan.exploration_id) {
      const { data, error } = await ctx.modelDb
        .from('governance_explorations')
        .select(EXPLORATION_SELECT)
        .eq('id', plan.exploration_id)
        .eq('organization_id', ctx.orgId)
        .maybeSingle()
      if (error) return `Error reading the plan's exploration: ${error.message}`
      const row = data as unknown as ExplorationRow | null
      observed = (row?.findings?.discoveredRoles ?? []) as DiscoveredRole[]
    }
    const declaredNames = strArr(args.external_roles, MAX_DECLARED_ROLES)
    const seen = new Set(observed.map((r) => r.name.toLowerCase()))
    const declared: DiscoveredRole[] = declaredNames
      .filter((n) => !seen.has(n.toLowerCase()))
      .map((n) => ({ name: n, source: 'declared' as const }))
    const externalRoles = [...observed, ...declared]
    if (!externalRoles.length) {
      return `Neither the exploration of "${system.name}" nor the operator has produced any external role to harmonize. Explore the system first, or ask the operator to name its roles and pass them as external_roles. Do not invent roles.`
    }

    const [{ data: roleRows, error: rErr }, { data: accessRows, error: aErr }, { data: personaRows, error: pErr }] = await Promise.all([
      ctx.modelDb.from('process_roles').select(SAP_ROLE_SELECT).eq('organization_id', ctx.orgId).order('name'),
      ctx.modelDb
        .from('process_role_access')
        .select('id, organization_id, role_id, access_type, value, title, fiori_app_id, source, note, created_at')
        .eq('organization_id', ctx.orgId),
      ctx.modelDb.from('personas').select('id, name').eq('organization_id', ctx.orgId),
    ])
    if (rErr) return `Error reading the SAP security roles: ${rErr.message}`
    if (aErr) return `Error reading the SAP role access: ${aErr.message}`
    if (pErr) return `Error reading the personas: ${pErr.message}`
    const sapRoles = (roleRows ?? []) as unknown as SapRoleRow[]
    const access = (accessRows ?? []) as unknown as RoleAccessItem[]
    const personas = (personaRows ?? []) as { id: string; name: string }[]

    const { data: linkRows } = personas.length
      ? await ctx.modelDb.from('persona_roles').select('persona_id, role_id').in('persona_id', personas.map((p) => p.id))
      : { data: [] }
    const personaRoleLinks = (linkRows ?? []) as { persona_id: string; role_id: string }[]

    const harmonized: RoleHarmonization[] = harmonizeRoles(externalRoles, sapRoles, access, personas, personaRoleLinks)
    if (!harmonized.length) return `The matcher produced no rows for "${system.name}". Nothing was written.`

    const { error: upErr } = await ctx.modelDb.from('governance_role_map').upsert(
      harmonized.map((h) => ({
        organization_id: ctx.orgId,
        plan_id: plan.id,
        external_role: h.externalRole,
        role_id: h.roleId ?? null,
        persona_id: h.personaId ?? null,
        disposition: h.disposition,
        confidence: h.confidence,
        rationale: h.rationale,
      })),
      { onConflict: 'plan_id,external_role' }
    )
    if (upErr) return `The harmonization ran, but writing the role map failed: ${upErr.message}. Nothing was persisted.`

    const counts = harmonized.reduce<Record<string, number>>((acc, h) => {
      acc[h.disposition] = (acc[h.disposition] ?? 0) + 1
      return acc
    }, {})

    return J({
      updated: 'governance_plan',
      plan_id: plan.id,
      system_id: system.id,
      system: system.name,
      sap_roles_considered: sapRoles.length,
      external_roles: { observed: observed.length, declared: declared.length },
      dispositions: counts,
      role_map: harmonized.map((h) => ({
        external_role: h.externalRole,
        sap_role: h.roleName ?? undefined,
        persona: h.personaName ?? undefined,
        disposition: h.disposition,
        confidence: h.confidence,
        rationale: h.rationale,
      })),
      ...(sapRoles.length
        ? {}
        : { warning: 'This organization has no SAP security roles yet, so every external role scored zero and lands on "create". Say so rather than presenting it as an analysis.' }),
      link: DESIGN_LINK,
      note: CITE_NOTE,
    })
  },
}

export const GET_GOVERNANCE_PLAN: AgentTool = {
  name: 'get_governance_plan',
  description:
    'Read ONE governance plan in full: the plan document (objective, identity model, role model, controls, SoD, remediation, build plan, open questions), the exploration findings it is grounded on, the harmonization role map against the SAP roles and personas, the artifacts already generated into the studio, and the approval state (draft, review, approved, built, rejected). Call this before drafting again, before approving, and before building.',
  input_schema: {
    type: 'object',
    properties: {
      plan_id: { type: 'string', description: 'The governance plan.' },
      system_id: { type: 'string', description: 'Alternative to plan_id: the system, whose newest plan is returned.' },
      system_name: { type: 'string', description: 'Alternative to system_id: the registered system name.' },
    },
    required: [],
  },
  async execute(args, ctx) {
    const found = await findPlan(ctx, args)
    if (typeof found === 'string') return found
    const { plan, system } = found

    let findings: ExplorationFindings | null = null
    let exploredAt: string | null = null
    if (plan.exploration_id) {
      const { data } = await ctx.modelDb
        .from('governance_explorations')
        .select(EXPLORATION_SELECT)
        .eq('id', plan.exploration_id)
        .eq('organization_id', ctx.orgId)
        .maybeSingle()
      const row = data as unknown as ExplorationRow | null
      findings = row?.findings ?? null
      exploredAt = row?.created_at ?? null
    }

    const [{ data: mapRows }, { data: artRows }] = await Promise.all([
      ctx.modelDb
        .from('governance_role_map')
        .select('external_role, role_id, persona_id, disposition, confidence, rationale')
        .eq('organization_id', ctx.orgId)
        .eq('plan_id', plan.id)
        .order('external_role'),
      ctx.modelDb
        .from('governance_artifacts')
        .select('id, name, kind, target_path, language, content, created_at')
        .eq('organization_id', ctx.orgId)
        .eq('plan_id', plan.id)
        .order('created_at'),
    ])
    const mapping = (mapRows ?? []) as { external_role: string; role_id: string | null; persona_id: string | null; disposition: string; confidence: number | null; rationale: string | null }[]

    // Resolve the SAP role and persona names on the map so the reply is readable.
    const roleIds = [...new Set(mapping.map((m) => m.role_id).filter((v): v is string => !!v))]
    const personaIds = [...new Set(mapping.map((m) => m.persona_id).filter((v): v is string => !!v))]
    const [{ data: roleNameRows }, { data: personaNameRows }] = await Promise.all([
      roleIds.length ? ctx.modelDb.from('process_roles').select('id, name, sap_role_name').eq('organization_id', ctx.orgId).in('id', roleIds) : Promise.resolve({ data: [] }),
      personaIds.length ? ctx.modelDb.from('personas').select('id, name').eq('organization_id', ctx.orgId).in('id', personaIds) : Promise.resolve({ data: [] }),
    ])
    const roleById = new Map(((roleNameRows ?? []) as { id: string; name: string; sap_role_name: string | null }[]).map((r) => [r.id, r]))
    const personaById = new Map(((personaNameRows ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]))

    const artifacts = (artRows ?? []) as { id: string; name: string; kind: string; target_path: string | null; language: string | null; content: string; created_at: string }[]

    return J({
      plan_id: plan.id,
      system_id: system.id,
      system: system.name,
      system_status: system.status,
      status: plan.status,
      approved_at: plan.approved_at ?? undefined,
      built_at: plan.built_at ?? undefined,
      plan: plan.plan ?? {},
      exploration: findings
        ? {
            id: plan.exploration_id,
            explored_at: exploredAt ?? undefined,
            summary: summarizeFindings(findings),
            auth_model: findings.authModel,
            posture: findings.posture,
            risks: findings.risks ?? [],
            discovered_roles: (findings.discoveredRoles ?? []).map((r) => r.name),
            scanned: findings.scanned,
            unreachable: findings.unreachable ?? [],
          }
        : null,
      role_map: mapping.map((m) => ({
        external_role: m.external_role,
        sap_role: m.role_id ? roleById.get(m.role_id)?.name ?? undefined : undefined,
        sap_role_name: m.role_id ? roleById.get(m.role_id)?.sap_role_name ?? undefined : undefined,
        persona: m.persona_id ? personaById.get(m.persona_id) ?? undefined : undefined,
        disposition: m.disposition,
        confidence: m.confidence ?? undefined,
        rationale: m.rationale ?? undefined,
      })),
      artifacts: artifacts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, target_path: a.target_path ?? undefined, language: a.language ?? undefined, characters: a.content.length })),
      gates: {
        approved: plan.status === 'approved' || plan.status === 'built',
        buildable: plan.status === 'approved',
        note: 'build_governance_design requires plan.status "approved" AND explicit human confirmation. It refuses otherwise.',
      },
      link: DESIGN_LINK,
      note: CITE_NOTE,
    })
  },
}

export const BUILD_GOVERNANCE_DESIGN: AgentTool = {
  name: 'build_governance_design',
  description:
    `Generate the security design ARTIFACTS for an APPROVED governance plan into the studio: policy files, RBAC configuration, role-mapping tables, middleware scaffolding, and the runbook. ${BUILD_GUARDRAIL} ` +
    `FAILS CLOSED: it refuses unless the plan's status is "approved" AND human_confirmed is true. Never set human_confirmed yourself: pass it only after the user has, in this conversation, explicitly confirmed they want the artifacts generated. ` +
    `${ONLY_ON_REQUEST} Maximum ${MAX_ARTIFACTS} artifacts per call, each at most ${MAX_ARTIFACT_CHARS.toLocaleString('en-US')} characters. Artifact kinds: ${ARTIFACT_KIND_LIST}.`,
  input_schema: {
    type: 'object',
    properties: {
      plan_id: { type: 'string', description: 'The APPROVED governance plan to build from.' },
      system_id: { type: 'string', description: 'Alternative to plan_id: the system, whose newest plan is used.' },
      system_name: { type: 'string', description: 'Alternative to system_id: the registered system name.' },
      human_confirmed: {
        type: 'boolean',
        description: 'Must be true. Set it ONLY after the user has explicitly confirmed, in words, that they want the artifacts generated into the studio. This is an approval gate, not a formality.',
      },
      artifacts: {
        type: 'array',
        description: `The artifacts to generate (maximum ${MAX_ARTIFACTS}).`,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Artifact name (e.g. "rbac.policy.yaml").' },
            kind: { type: 'string', enum: ['policy', 'config', 'code', 'mapping', 'runbook', 'doc'] },
            target_path: { type: 'string', description: 'Where a human would place this in the target system. Advisory only: nothing is written there.' },
            language: { type: 'string', description: 'Language or format of the content (yaml, json, typescript, sql, markdown, ...).' },
            content: { type: 'string', description: `The artifact body, at most ${MAX_ARTIFACT_CHARS} characters.` },
          },
          required: ['name', 'kind', 'content'],
        },
      },
    },
    required: ['artifacts'],
  },
  async execute(args, ctx) {
    const found = await findPlan(ctx, args)
    if (typeof found === 'string') return found
    const { plan, system } = found

    // ─── Fail closed: BOTH gates, reported together ──────────────────────────
    const refusals: string[] = []
    if (plan.status !== 'approved') {
      refusals.push(
        plan.status === 'built'
          ? `the plan for "${system.name}" has already been built (built_at ${plan.built_at ?? 'unknown'})`
          : `the plan for "${system.name}" is "${plan.status}", not "approved" (a plan must be moved to review and then approved by the operator before anything is generated)`
      )
    }
    if (args.human_confirmed !== true) {
      refusals.push('human_confirmed is not true (the operator must explicitly confirm the build in this conversation)')
    }
    if (refusals.length) {
      return `Refused: ${refusals.join('; ')}. Nothing was generated. ${BUILD_GUARDRAIL} Ask the operator to approve the plan and confirm the build, then call this tool again.`
    }

    const raw = Array.isArray(args.artifacts) ? args.artifacts : []
    if (!raw.length) return 'Provide at least one artifact to generate. Nothing was written.'
    if (raw.length > MAX_ARTIFACTS) return `That is ${raw.length} artifacts; the cap is ${MAX_ARTIFACTS} per call. Split the build. Nothing was written.`

    const specs: { name: string; kind: string; target_path: string | null; language: string | null; content: string }[] = []
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i]
      if (!item || typeof item !== 'object') return `Artifact ${i} is not an object. Nothing was written.`
      const o = item as Record<string, unknown>
      const name = str(o.name)
      const kind = str(o.kind).toLowerCase()
      const content = typeof o.content === 'string' ? o.content : ''
      if (!name) return `Artifact ${i} needs a name. Nothing was written.`
      if (!(ARTIFACT_KINDS as readonly string[]).includes(kind)) return `Artifact "${name}": kind "${str(o.kind)}" is invalid; use one of ${ARTIFACT_KIND_LIST}. Nothing was written.`
      if (!content.trim()) return `Artifact "${name}" has no content. Nothing was written.`
      if (content.length > MAX_ARTIFACT_CHARS) return `Artifact "${name}" is ${content.length} characters; the cap is ${MAX_ARTIFACT_CHARS} each. Split it. Nothing was written.`
      specs.push({
        name,
        kind,
        target_path: optStr(o.target_path ?? o.targetPath),
        language: optStr(o.language),
        content,
      })
    }

    const { data, error } = await ctx.modelDb
      .from('governance_artifacts')
      .insert(
        specs.map((s) => ({
          organization_id: ctx.orgId,
          plan_id: plan.id,
          name: s.name,
          kind: s.kind,
          target_path: s.target_path,
          language: s.language,
          content: s.content,
        }))
      )
      .select('id, name, kind')
    if (error) return `Failed to write the artifacts: ${error.message}. Nothing was generated; the plan is unchanged.`

    const nowIso = new Date().toISOString()
    const { error: planErr } = await ctx.modelDb
      .from('governance_plans')
      .update({ status: 'built', built_at: nowIso, updated_at: nowIso })
      .eq('id', plan.id)
      .eq('organization_id', ctx.orgId)
    const { error: sysErr } = await ctx.modelDb
      .from('governed_systems')
      .update({ status: 'governed', updated_at: nowIso })
      .eq('id', system.id)
      .eq('organization_id', ctx.orgId)

    return J({
      created: 'governance_artifacts',
      plan_id: plan.id,
      system_id: system.id,
      system: system.name,
      plan_status: planErr ? plan.status : 'built',
      system_status: sysErr ? system.status : 'governed',
      artifacts: ((data ?? []) as { id: string; name: string; kind: string }[]).map((a) => {
        const spec = specs.find((s) => s.name === a.name)
        return { id: a.id, name: a.name, kind: a.kind, target_path: spec?.target_path ?? undefined, characters: spec?.content.length ?? 0 }
      }),
      message:
        `${specs.length} artifact(s) were GENERATED INTO THE STUDIO for "${system.name}" and are available at ${DESIGN_LINK}. ` +
        'Nothing was written to the target system: no repository file was changed, no admin API was called, and nothing was provisioned. ' +
        'APPLYING these artifacts to the target system is a human step, to be done by the operator after review.',
      ...(planErr ? { warning: `The artifacts were saved, but marking the plan built failed: ${planErr.message}.` } : {}),
      ...(sysErr ? { warning_system: `The artifacts were saved, but marking the system governed failed: ${sysErr.message}.` } : {}),
      link: DESIGN_LINK,
      note: `${CITE_NOTE} State plainly in your reply that the artifacts were generated into the studio and that applying them to the target system is a human step.`,
    })
  },
}

// ─── The belt ───────────────────────────────────────────────────────────────

export const SECURITY_STUDIO_TOOLS: AgentTool[] = [
  START_DESIGN_SESSION,
  LIST_DESIGN_SESSIONS,
  CAPTURE_DESIGN_GUIDANCE,
  PROPOSE_DESIGN_OPTIONS,
  RECORD_DESIGN_DECISION,
  REGISTER_GOVERNED_SYSTEM,
  LIST_GOVERNED_SYSTEMS,
  EXPLORE_GOVERNED_SYSTEM,
  DRAFT_GOVERNANCE_PLAN,
  HARMONIZE_GOVERNANCE_WITH_SAP,
  GET_GOVERNANCE_PLAN,
  BUILD_GOVERNANCE_DESIGN,
]
