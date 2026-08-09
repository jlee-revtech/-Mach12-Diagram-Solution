// Security role design tools: the Super Consultant agents (led by the
// security-authorization workstream specialist) can design SAP PFCG security
// roles on top of the Persona Catalog — single / derived / composite Z*/Y*
// roles (process_roles + the 059 SAP columns), per-role SAP access items
// (process_role_access: Fiori tiles, transactions, programs, tables, auth
// objects), composite membership (process_role_members), and persona → role
// assignments (persona_roles with AI provenance).
//
// Same AgentTool contract as @jlee-revtech/agent-core: execute(args, ctx) where
// ctx.modelDb is the caller's RLS org-scoped Supabase client. RLS already fences
// every statement to the user's org; each tool ALSO verifies the target row's
// organization before writing (belt and suspenders), because a wrong-id write
// must fail closed with a clear message, not lean on the database alone.
//
// Deliberately conservative, like studioTools:
//   - writes happen ONLY on explicit user request (see ONLY_ON_REQUEST)
//   - batch caps: <= 40 access items, <= 40 composite members, <= 20 persona
//     links per call; auto-determination reads at most 200 process graphs
//   - every result returns ids, names, and the /process/security link to cite
//
// The auto-determination matcher itself is pure and lives in
// src/lib/security/autodetermine.ts (shared with the Security Role Studio UI).

import type { AgentTool, ToolContext } from '@jlee-revtech/agent-core'
import type { RoleAccessItem, RoleAccessType, SecurityRoleType } from '@/lib/security/types'
import { runAutoDetermination } from '@/lib/security/autodetermine'
import { FIORI_CATALOG } from '@/lib/process/fioriCatalog'

const J = (v: unknown) => JSON.stringify(v, null, 2)

const ONLY_ON_REQUEST =
  'Use this tool ONLY when the user has explicitly asked you to create or change this content in the studio. ' +
  'Never call it speculatively, never to "improve" the model unasked, and never while answering a purely informational question. ' +
  'Confirm scope with the user first if their request is ambiguous.'

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

const SECURITY_LINK = '/process/security'
const CITE_NOTE = 'Cite the link so the user can open it in the Security Role Studio.'

const MAX_ACCESS_ITEMS = 40
const MAX_MEMBERS = 40
const MAX_LINK_ROLES = 20
const MAX_GRAPH_NODES = 200

const ROLE_TYPES: SecurityRoleType[] = ['single', 'derived', 'composite']
const ACCESS_TYPES: RoleAccessType[] = ['fiori_tile', 'transaction', 'program', 'table', 'auth_object']
const ACCESS_TYPE_LIST = ACCESS_TYPES.join(', ')

const ROLE_SELECT = 'id, name, description, sap_role_name, role_type, derived_from, org_levels, workstream_id'

interface SecurityRoleRow {
  id: string
  name: string
  description: string | null
  sap_role_name: string | null
  role_type: SecurityRoleType | null
  derived_from: string | null
  org_levels: string | null
  workstream_id: string | null
}

// ─── Z*/Y* PFCG role-name governance ────────────────────────────────────────

/** SAP customer-namespace role names: start with Z or Y, uppercase, max 30
 *  characters, letters/digits/underscore/colon only (PFCG allows more; we
 *  deliberately keep the governed subset). */
function validateSapRoleName(raw: unknown): { ok: true; name: string } | { ok: false; reason: string } {
  const name = str(raw).toUpperCase()
  if (!name) return { ok: false, reason: 'sap_role_name is empty.' }
  if (!/^[ZY]/.test(name)) return { ok: false, reason: `SAP role name "${name}" must start with Z or Y (customer namespace). Composite naming hint: Z_C_*.` }
  if (name.length > 30) return { ok: false, reason: `SAP role name "${name}" is ${name.length} characters; the cap is 30.` }
  if (!/^[A-Z0-9_:]+$/.test(name)) return { ok: false, reason: `SAP role name "${name}" may only contain letters, digits, underscores, and colons.` }
  return { ok: true, name }
}

// ─── Row resolvers (id wins; names resolve case-insensitively, fail closed) ─

async function listOrgRoles(ctx: ToolContext): Promise<SecurityRoleRow[] | string> {
  const { data, error } = await ctx.modelDb
    .from('process_roles')
    .select(ROLE_SELECT)
    .eq('organization_id', ctx.orgId)
    .order('name')
  if (error) return `Error reading the security roles: ${error.message}`
  return (data ?? []) as unknown as SecurityRoleRow[]
}

async function findRole(ctx: ToolContext, idArg: unknown, nameArg: unknown): Promise<SecurityRoleRow | string> {
  const id = str(idArg)
  if (id) {
    const { data, error } = await ctx.modelDb
      .from('process_roles')
      .select(ROLE_SELECT)
      .eq('id', id)
      .eq('organization_id', ctx.orgId)
      .maybeSingle()
    if (error) return `Error reading the role: ${error.message}`
    if (!data) return "No such role in this organization's model. Do not guess ids; call list_security_roles first."
    return data as unknown as SecurityRoleRow
  }
  const name = str(nameArg)
  if (!name) return 'Pass role_id or role_name.'
  const roles = await listOrgRoles(ctx)
  if (typeof roles === 'string') return roles
  const n = name.toLowerCase()
  const matches = roles.filter((r) => r.name.toLowerCase() === n || (r.sap_role_name ?? '').toLowerCase() === n)
  if (!matches.length) return `No role named "${name}" exists in this organization. Call list_security_roles for the catalog; do not guess.`
  if (matches.length > 1) return `The name "${name}" matches ${matches.length} roles (ids: ${matches.map((m) => m.id).join(', ')}). Call again with role_id.`
  return matches[0]
}

async function findPersona(ctx: ToolContext, idArg: unknown, nameArg: unknown): Promise<{ id: string; name: string } | string> {
  const id = str(idArg)
  if (id) {
    const { data, error } = await ctx.modelDb.from('personas').select('id, name, organization_id').eq('id', id).maybeSingle()
    if (error) return `Error reading the persona: ${error.message}`
    const row = data as { id: string; name: string; organization_id: string } | null
    if (!row || row.organization_id !== ctx.orgId) return "No such persona in this organization's model. Call list_personas first."
    return { id: row.id, name: row.name }
  }
  const name = str(nameArg)
  if (!name) return 'Pass persona_id or persona_name.'
  const { data, error } = await ctx.modelDb.from('personas').select('id, name').eq('organization_id', ctx.orgId)
  if (error) return `Error reading the personas: ${error.message}`
  const rows = (data ?? []) as { id: string; name: string }[]
  const n = name.toLowerCase()
  const matches = rows.filter((p) => p.name.toLowerCase() === n)
  if (!matches.length) return `No persona named "${name}" exists in this organization. Call list_personas first; do not guess.`
  if (matches.length > 1) return `The name "${name}" matches ${matches.length} personas (ids: ${matches.map((m) => m.id).join(', ')}). Call again with persona_id.`
  return matches[0]
}

/** Resolve a full member-role list from ids and/or names. Fails closed: any
 *  unresolvable entry aborts the call with a clear message. Composites cannot
 *  contain composites (PFCG rule kept here on purpose). */
async function resolveMemberRoles(
  ctx: ToolContext,
  idsArg: unknown,
  namesArg: unknown,
  compositeId: string | null,
): Promise<SecurityRoleRow[] | string> {
  const ids = (Array.isArray(idsArg) ? idsArg : []).map((v) => str(v)).filter(Boolean)
  const names = (Array.isArray(namesArg) ? namesArg : []).map((v) => str(v)).filter(Boolean)
  const roles = await listOrgRoles(ctx)
  if (typeof roles === 'string') return roles
  const byId = new Map(roles.map((r) => [r.id, r]))
  const problems: string[] = []
  const out: SecurityRoleRow[] = []
  const seen = new Set<string>()
  const take = (r: SecurityRoleRow | undefined, ref: string) => {
    if (!r) { problems.push(`"${ref}" does not match a role in this organization`); return }
    if (compositeId && r.id === compositeId) { problems.push(`"${ref}" is the composite role itself`); return }
    if (r.role_type === 'composite') { problems.push(`"${r.name}" is a composite role; composites may only contain single or derived roles`); return }
    if (seen.has(r.id)) return
    seen.add(r.id)
    out.push(r)
  }
  for (const id of ids) take(byId.get(id), id)
  for (const name of names) {
    const n = name.toLowerCase()
    const matches = roles.filter((r) => r.name.toLowerCase() === n || (r.sap_role_name ?? '').toLowerCase() === n)
    if (matches.length > 1) { problems.push(`"${name}" matches ${matches.length} roles; use member_role_ids`); continue }
    take(matches[0], name)
  }
  if (problems.length) return `The member list could not be resolved: ${problems.join('; ')}. Fix the list and call again; nothing was changed.`
  if (out.length > MAX_MEMBERS) return `That is ${out.length} member roles; the cap is ${MAX_MEMBERS} per composite.`
  return out
}

// ─── Access item normalization ──────────────────────────────────────────────

interface AccessSpec {
  access_type: RoleAccessType
  value: string
  title: string | null
  fiori_app_id: string | null
  note: string | null
}

/** Parse and normalize one raw access item. Transactions, programs, tables,
 *  and auth objects are uppercased (matching the auto-determination matcher);
 *  fiori_tile values are enriched from the seeded FIORI_CATALOG by tile id or
 *  SAP app id (an app id passed as the value is normalized to the tile id). */
function parseAccessItem(raw: unknown, index: number): AccessSpec | string {
  if (!raw || typeof raw !== 'object') return `Item ${index} is not an object.`
  const o = raw as Record<string, unknown>
  const type = str(o.access_type) as RoleAccessType
  if (!ACCESS_TYPES.includes(type)) return `Item ${index}: access_type "${str(o.access_type)}" is invalid; use one of: ${ACCESS_TYPE_LIST}.`
  let value = str(o.value)
  if (!value) return `Item ${index}: value is required (the tcode, tile id, program, table, or auth object).`
  let title = optStr(o.title)
  let fioriAppId = optStr(o.fiori_app_id)
  if (type === 'fiori_tile') {
    const v = value.toLowerCase()
    const tile = FIORI_CATALOG.find((t) => t.id.toLowerCase() === v || (t.appId ?? '').toLowerCase() === v)
    if (tile) {
      value = tile.id
      title = title ?? tile.title
      fioriAppId = fioriAppId ?? tile.appId ?? null
    }
  } else {
    value = value.toUpperCase()
    fioriAppId = null
  }
  return { access_type: type, value, title, fiori_app_id: fioriAppId, note: optStr(o.note) }
}

// ─── Read tools ─────────────────────────────────────────────────────────────

export const LIST_SECURITY_ROLES: AgentTool = {
  name: 'list_security_roles',
  description:
    "List the organization's security role designs in the Security Role Studio: id, name, SAP role name (Z*/Y* PFCG), role type (single, derived, composite), SAP access item count, composite member count, and the personas each role is linked to. Use this to find the role the user is talking about before reading or changing it.",
  input_schema: {
    type: 'object',
    properties: {
      role_type: { type: 'string', enum: ['single', 'derived', 'composite'], description: 'Optional role-type filter.' },
    },
    required: [],
  },
  async execute(args, ctx) {
    const roles = await listOrgRoles(ctx)
    if (typeof roles === 'string') return roles
    const typeFilter = str(args.role_type)
    const filtered = typeFilter && ROLE_TYPES.includes(typeFilter as SecurityRoleType) ? roles.filter((r) => (r.role_type ?? 'single') === typeFilter) : roles
    if (!filtered.length) return 'The organization has no security roles yet' + (typeFilter ? ` of type ${typeFilter}` : '') + `. Create them with create_security_role, or open ${SECURITY_LINK}.`

    const roleIds = roles.map((r) => r.id)
    const [{ data: accessRows }, { data: memberRows }, { data: personaRows }] = await Promise.all([
      ctx.modelDb.from('process_role_access').select('role_id').eq('organization_id', ctx.orgId),
      ctx.modelDb.from('process_role_members').select('composite_role_id, member_role_id').in('composite_role_id', roleIds),
      ctx.modelDb.from('personas').select('id, name').eq('organization_id', ctx.orgId),
    ])
    const personaById = new Map(((personaRows ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]))
    const { data: linkRows } = personaById.size
      ? await ctx.modelDb.from('persona_roles').select('persona_id, role_id').in('persona_id', [...personaById.keys()])
      : { data: [] }

    const accessCount = new Map<string, number>()
    for (const a of (accessRows ?? []) as { role_id: string }[]) accessCount.set(a.role_id, (accessCount.get(a.role_id) ?? 0) + 1)
    const memberCount = new Map<string, number>()
    for (const m of (memberRows ?? []) as { composite_role_id: string }[]) memberCount.set(m.composite_role_id, (memberCount.get(m.composite_role_id) ?? 0) + 1)
    const personasByRole = new Map<string, string[]>()
    for (const l of (linkRows ?? []) as { persona_id: string; role_id: string }[]) {
      const name = personaById.get(l.persona_id)
      if (!name) continue
      personasByRole.set(l.role_id, [...(personasByRole.get(l.role_id) ?? []), name])
    }

    return J({
      roles: filtered.map((r) => ({
        id: r.id,
        name: r.name,
        sap_role_name: r.sap_role_name ?? undefined,
        role_type: r.role_type ?? 'single',
        ...(r.derived_from ? { derived_from: r.derived_from } : {}),
        access_items: accessCount.get(r.id) ?? 0,
        ...((r.role_type ?? 'single') === 'composite' ? { member_roles: memberCount.get(r.id) ?? 0 } : {}),
        personas: personasByRole.get(r.id) ?? [],
      })),
      link: SECURITY_LINK,
      note: CITE_NOTE,
    })
  },
}

export const GET_SECURITY_ROLE: AgentTool = {
  name: 'get_security_role',
  description:
    'Read ONE security role in full, by id or by name/SAP role name: its fields (SAP role name, type, derived_from, org levels), every SAP access item grouped by type (fiori_tile, transaction, program, table, auth_object), its composite member roles, and the personas linked to it. Call this before changing a role so you never duplicate access or membership.',
  input_schema: {
    type: 'object',
    properties: {
      role_id: { type: 'string', description: 'The role id (from list_security_roles).' },
      role_name: { type: 'string', description: 'Alternative to role_id: the role name or SAP role name (exact, case-insensitive).' },
    },
    required: [],
  },
  async execute(args, ctx) {
    const role = await findRole(ctx, args.role_id, args.role_name)
    if (typeof role === 'string') return role

    const [{ data: accessRows, error: aErr }, { data: memberRows, error: mErr }, { data: linkRows, error: lErr }] = await Promise.all([
      ctx.modelDb
        .from('process_role_access')
        .select('id, access_type, value, title, fiori_app_id, source, note')
        .eq('role_id', role.id)
        .eq('organization_id', ctx.orgId)
        .order('access_type')
        .order('value'),
      ctx.modelDb.from('process_role_members').select('member_role_id').eq('composite_role_id', role.id),
      ctx.modelDb.from('persona_roles').select('persona_id, source, confidence, rationale').eq('role_id', role.id),
    ])
    if (aErr) return `Error reading the role's access items: ${aErr.message}`
    if (mErr) return `Error reading the composite members: ${mErr.message}`
    if (lErr) return `Error reading the persona links: ${lErr.message}`

    const roles = await listOrgRoles(ctx)
    if (typeof roles === 'string') return roles
    const roleById = new Map(roles.map((r) => [r.id, r]))
    const members = ((memberRows ?? []) as { member_role_id: string }[])
      .map((m) => roleById.get(m.member_role_id))
      .filter((r): r is SecurityRoleRow => !!r)
      .map((r) => ({ id: r.id, name: r.name, sap_role_name: r.sap_role_name ?? undefined, role_type: r.role_type ?? 'single' }))

    const links = (linkRows ?? []) as { persona_id: string; source: string | null; confidence: number | null; rationale: string | null }[]
    let personas: { id: string; name: string; source?: string; confidence?: number; rationale?: string }[] = []
    if (links.length) {
      const { data: pRows } = await ctx.modelDb
        .from('personas')
        .select('id, name')
        .eq('organization_id', ctx.orgId)
        .in('id', links.map((l) => l.persona_id))
      const nameById = new Map(((pRows ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]))
      personas = links
        .filter((l) => nameById.has(l.persona_id))
        .map((l) => ({
          id: l.persona_id,
          name: nameById.get(l.persona_id)!,
          source: l.source ?? 'manual',
          ...(typeof l.confidence === 'number' ? { confidence: l.confidence } : {}),
          ...(l.rationale ? { rationale: l.rationale } : {}),
        }))
    }

    const accessByType: Record<string, { value: string; title?: string; fiori_app_id?: string; source: string; note?: string }[]> = {}
    for (const a of (accessRows ?? []) as { access_type: string; value: string; title: string | null; fiori_app_id: string | null; source: string; note: string | null }[]) {
      accessByType[a.access_type] = [
        ...(accessByType[a.access_type] ?? []),
        { value: a.value, ...(a.title ? { title: a.title } : {}), ...(a.fiori_app_id ? { fiori_app_id: a.fiori_app_id } : {}), source: a.source, ...(a.note ? { note: a.note } : {}) },
      ]
    }

    return J({
      id: role.id,
      name: role.name,
      sap_role_name: role.sap_role_name ?? undefined,
      role_type: role.role_type ?? 'single',
      description: role.description ?? undefined,
      derived_from: role.derived_from ?? undefined,
      org_levels: role.org_levels ?? undefined,
      access: accessByType,
      ...((role.role_type ?? 'single') === 'composite' ? { members } : {}),
      personas,
      link: SECURITY_LINK,
      note: CITE_NOTE,
    })
  },
}

// ─── Write tools ────────────────────────────────────────────────────────────

export const CREATE_SECURITY_ROLE: AgentTool = {
  name: 'create_security_role',
  description:
    `Create a NEW security role design in the Security Role Studio: a single, derived, or composite SAP PFCG role. The SAP role name must be in the customer namespace: start with Z or Y, uppercase, max 30 characters, letters/digits/underscore/colon only (composite naming hint: Z_C_*). A composite role can be seeded with member roles (existing single/derived roles). ${ONLY_ON_REQUEST} ` +
    `Returns the role id and the ${SECURITY_LINK} link to cite in your reply.`,
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: "The business role name (e.g. 'Project Cost Analyst')." },
      sap_role_name: { type: 'string', description: 'The Z*/Y* PFCG role name (e.g. Z_PS_COST_ANALYST or Z_C_PROJ_CONTROLLER for a composite).' },
      role_type: { type: 'string', enum: ['single', 'derived', 'composite'], description: 'Defaults to single.' },
      description: { type: 'string', description: 'Optional one or two sentence description.' },
      ...WS_PROP,
      derived_from: { type: 'string', description: 'For a derived role: the SAP name of the parent (imparting) role.' },
      org_levels: { type: 'string', description: "Optional org-level restriction note (e.g. 'Company Code 1000, Plant 1100')." },
      member_role_ids: { type: 'array', items: { type: 'string' }, description: 'Composite only: member role ids (existing single/derived roles).' },
      member_role_names: { type: 'array', items: { type: 'string' }, description: 'Composite only: member role names or SAP role names.' },
    },
    required: ['name'],
  },
  async execute(args, ctx) {
    const name = str(args.name)
    if (!name) return 'A security role needs a name.'
    const roleType = (str(args.role_type) || 'single') as SecurityRoleType
    if (!ROLE_TYPES.includes(roleType)) return `role_type must be one of: ${ROLE_TYPES.join(', ')}.`

    let sapRoleName: string | null = null
    if (str(args.sap_role_name)) {
      const check = validateSapRoleName(args.sap_role_name)
      if (!check.ok) return `The SAP role name was rejected: ${check.reason}`
      sapRoleName = check.name
    }
    const derivedFrom = optStr(args.derived_from)?.toUpperCase() ?? null
    if (derivedFrom && roleType !== 'derived') return `derived_from only applies to role_type 'derived'; "${name}" was requested as ${roleType}. Drop derived_from or change the type.`

    const hasMembers = Array.isArray(args.member_role_ids) || Array.isArray(args.member_role_names)
    if (hasMembers && roleType !== 'composite') return `Member roles only apply to a composite role; "${name}" was requested as ${roleType}.`

    // Duplicate guard: same name or same SAP role name already in the catalog.
    const existing = await listOrgRoles(ctx)
    if (typeof existing === 'string') return existing
    const dup = existing.find(
      (r) => r.name.toLowerCase() === name.toLowerCase() || (sapRoleName && (r.sap_role_name ?? '').toUpperCase() === sapRoleName)
    )
    if (dup) return `A role with that name already exists: "${dup.name}"${dup.sap_role_name ? ` (${dup.sap_role_name})` : ''}, id ${dup.id}. Use update_security_role or add_role_access on it instead.`

    let members: SecurityRoleRow[] = []
    if (hasMembers) {
      const resolved = await resolveMemberRoles(ctx, args.member_role_ids, args.member_role_names, null)
      if (typeof resolved === 'string') return resolved
      members = resolved
    }

    const ws = resolveWs(ctx, args.workstream_code)
    const { data: created, error } = await ctx.modelDb
      .from('process_roles')
      .insert({
        organization_id: ctx.orgId,
        name,
        description: optStr(args.description),
        sap_role_name: sapRoleName,
        role_type: roleType,
        derived_from: derivedFrom,
        org_levels: optStr(args.org_levels),
        workstream_id: ws.id,
      })
      .select('id, name')
      .single()
    if (error || !created) return `Failed to create the security role: ${error?.message ?? 'no row returned'}.`
    const roleId = (created as { id: string }).id

    let memberWarning: string | undefined
    if (members.length) {
      const { error: memErr } = await ctx.modelDb
        .from('process_role_members')
        .insert(members.map((m) => ({ composite_role_id: roleId, member_role_id: m.id })))
      if (memErr) memberWarning = `The role was created, but adding its members failed: ${memErr.message}. Use set_composite_members to finish it.`
    }

    return J({
      created: 'security_role',
      id: roleId,
      name,
      sap_role_name: sapRoleName ?? undefined,
      role_type: roleType,
      ...(derivedFrom ? { derived_from: derivedFrom } : {}),
      ...(members.length ? { members: members.map((m) => m.name) } : {}),
      workstream: ws.code ?? undefined,
      link: SECURITY_LINK,
      ...(memberWarning ? { warning: memberWarning } : ws.warning ? { warning: ws.warning } : {}),
      note: CITE_NOTE,
    })
  },
}

export const UPDATE_SECURITY_ROLE: AgentTool = {
  name: 'update_security_role',
  description:
    `Update an existing security role's fields: name, SAP role name (Z*/Y* governance enforced), role type, description, derived_from, or org levels. Only the fields you pass are changed; access items, members, and persona links are managed by their own tools. ${ONLY_ON_REQUEST}`,
  input_schema: {
    type: 'object',
    properties: {
      role_id: { type: 'string', description: 'The role to update (from list_security_roles).' },
      role_name: { type: 'string', description: 'Alternative to role_id: the current role name or SAP role name.' },
      name: { type: 'string', description: 'New business role name.' },
      sap_role_name: { type: 'string', description: 'New Z*/Y* PFCG role name.' },
      role_type: { type: 'string', enum: ['single', 'derived', 'composite'] },
      description: { type: 'string' },
      derived_from: { type: 'string', description: "Parent role for a derived role. Pass '' to clear." },
      org_levels: { type: 'string', description: "Org-level restriction note. Pass '' to clear." },
    },
    required: [],
  },
  async execute(args, ctx) {
    const role = await findRole(ctx, args.role_id, args.role_name)
    if (typeof role === 'string') return role

    const updates: Record<string, unknown> = {}
    if (str(args.name)) updates.name = str(args.name)
    if (str(args.sap_role_name)) {
      const check = validateSapRoleName(args.sap_role_name)
      if (!check.ok) return `The SAP role name was rejected: ${check.reason}`
      updates.sap_role_name = check.name
    }
    if (str(args.role_type)) {
      const t = str(args.role_type) as SecurityRoleType
      if (!ROLE_TYPES.includes(t)) return `role_type must be one of: ${ROLE_TYPES.join(', ')}.`
      updates.role_type = t
    }
    if (typeof args.description === 'string') updates.description = optStr(args.description)
    if (typeof args.derived_from === 'string') updates.derived_from = optStr(args.derived_from)?.toUpperCase() ?? null
    if (typeof args.org_levels === 'string') updates.org_levels = optStr(args.org_levels)
    if (!Object.keys(updates).length) return 'Nothing to update: pass at least one of name, sap_role_name, role_type, description, derived_from, or org_levels.'

    const { error } = await ctx.modelDb.from('process_roles').update(updates).eq('id', role.id).eq('organization_id', ctx.orgId)
    if (error) return `Failed to update the security role: ${error.message}`
    return J({
      updated: 'security_role',
      id: role.id,
      previous_name: role.name,
      changed_fields: Object.keys(updates),
      link: SECURITY_LINK,
      note: CITE_NOTE,
    })
  },
}

export const ADD_ROLE_ACCESS: AgentTool = {
  name: 'add_role_access',
  description:
    `Add SAP access items to a security role: Fiori tiles, transaction codes, programs, data tables, and authorization objects. Each item is {access_type, value, title?, fiori_app_id?, note?} with access_type one of ${ACCESS_TYPE_LIST}. Fiori tiles are enriched from the seeded Fiori catalog by tile id or SAP app id; transactions/programs/tables/auth objects are stored uppercase. Items the role already has are skipped, never duplicated. ${ONLY_ON_REQUEST} ` +
    `Maximum ${MAX_ACCESS_ITEMS} items per call.`,
  input_schema: {
    type: 'object',
    properties: {
      role_id: { type: 'string', description: 'The role to grant access to (from list_security_roles).' },
      role_name: { type: 'string', description: 'Alternative to role_id: the role name or SAP role name.' },
      items: {
        type: 'array',
        description: 'The access items to add.',
        items: {
          type: 'object',
          properties: {
            access_type: { type: 'string', enum: ['fiori_tile', 'transaction', 'program', 'table', 'auth_object'] },
            value: { type: 'string', description: 'The tcode (VA01), Fiori tile id or app id (F0842), program, table, or auth object name.' },
            title: { type: 'string', description: 'Optional human title (auto-filled for known Fiori tiles).' },
            fiori_app_id: { type: 'string', description: 'Optional SAP Fiori app id for fiori_tile items (e.g. F0842).' },
            note: { type: 'string', description: 'Optional note on why this access is needed.' },
          },
          required: ['access_type', 'value'],
        },
      },
    },
    required: ['items'],
  },
  async execute(args, ctx) {
    const raw = Array.isArray(args.items) ? args.items : []
    if (!raw.length) return 'Provide at least one access item.'
    if (raw.length > MAX_ACCESS_ITEMS) return `That is ${raw.length} items; the cap is ${MAX_ACCESS_ITEMS} per call. Split the request.`

    const role = await findRole(ctx, args.role_id, args.role_name)
    if (typeof role === 'string') return role

    const specs: AccessSpec[] = []
    for (let i = 0; i < raw.length; i++) {
      const parsed = parseAccessItem(raw[i], i)
      if (typeof parsed === 'string') return `${parsed} Nothing was added; fix the item and call again.`
      specs.push(parsed)
    }

    const { data: existingRows, error: exErr } = await ctx.modelDb
      .from('process_role_access')
      .select('access_type, value')
      .eq('role_id', role.id)
      .eq('organization_id', ctx.orgId)
    if (exErr) return `Error reading the role's existing access: ${exErr.message}`
    const existing = new Set(((existingRows ?? []) as { access_type: string; value: string }[]).map((a) => `${a.access_type}|${a.value}`))

    const toInsert: AccessSpec[] = []
    const skipped: string[] = []
    for (const s of specs) {
      const key = `${s.access_type}|${s.value}`
      if (existing.has(key)) {
        skipped.push(`${s.access_type} ${s.value}`)
        continue
      }
      existing.add(key)
      toInsert.push(s)
    }
    if (toInsert.length) {
      const { error } = await ctx.modelDb.from('process_role_access').insert(
        toInsert.map((s) => ({
          organization_id: ctx.orgId,
          role_id: role.id,
          access_type: s.access_type,
          value: s.value,
          title: s.title,
          fiori_app_id: s.fiori_app_id,
          source: 'manual',
          note: s.note,
        }))
      )
      if (error) return `Failed to add the access items: ${error.message}`
    }
    return J({
      updated: 'security_role',
      id: role.id,
      name: role.name,
      added: toInsert.map((s) => ({ access_type: s.access_type, value: s.value, ...(s.title ? { title: s.title } : {}), ...(s.fiori_app_id ? { fiori_app_id: s.fiori_app_id } : {}) })),
      ...(skipped.length ? { skipped_already_present: skipped } : {}),
      link: SECURITY_LINK,
      note: CITE_NOTE,
    })
  },
}

export const REMOVE_ROLE_ACCESS: AgentTool = {
  name: 'remove_role_access',
  description:
    `Remove ONE SAP access item from a security role, identified by access_type + value (the same value shown by get_security_role). ${ONLY_ON_REQUEST}`,
  input_schema: {
    type: 'object',
    properties: {
      role_id: { type: 'string', description: 'The role (from list_security_roles).' },
      role_name: { type: 'string', description: 'Alternative to role_id: the role name or SAP role name.' },
      access_type: { type: 'string', enum: ['fiori_tile', 'transaction', 'program', 'table', 'auth_object'] },
      value: { type: 'string', description: 'The stored access value (tcode, tile id, program, table, or auth object).' },
    },
    required: ['access_type', 'value'],
  },
  async execute(args, ctx) {
    const type = str(args.access_type) as RoleAccessType
    if (!ACCESS_TYPES.includes(type)) return `access_type must be one of: ${ACCESS_TYPE_LIST}.`
    const parsed = parseAccessItem({ access_type: type, value: args.value }, 0)
    if (typeof parsed === 'string') return parsed

    const role = await findRole(ctx, args.role_id, args.role_name)
    if (typeof role === 'string') return role

    const { data, error } = await ctx.modelDb
      .from('process_role_access')
      .delete()
      .eq('organization_id', ctx.orgId)
      .eq('role_id', role.id)
      .eq('access_type', type)
      .eq('value', parsed.value)
      .select('id')
    if (error) return `Failed to remove the access item: ${error.message}`
    if (!(data ?? []).length) return `"${role.name}" has no ${type} access item with value "${parsed.value}". Call get_security_role to see what it actually carries.`
    return J({
      updated: 'security_role',
      id: role.id,
      name: role.name,
      removed: { access_type: type, value: parsed.value },
      link: SECURITY_LINK,
      note: CITE_NOTE,
    })
  },
}

export const SET_COMPOSITE_MEMBERS: AgentTool = {
  name: 'set_composite_members',
  description:
    `Set the FULL member list of a composite security role. This REPLACES the current membership with exactly the roles you pass (an empty list clears it); members must be existing single or derived roles in this organization. ${ONLY_ON_REQUEST} ` +
    `Maximum ${MAX_MEMBERS} members.`,
  input_schema: {
    type: 'object',
    properties: {
      role_id: { type: 'string', description: 'The composite role (from list_security_roles).' },
      role_name: { type: 'string', description: 'Alternative to role_id: the composite role name or SAP role name.' },
      member_role_ids: { type: 'array', items: { type: 'string' }, description: 'The complete new member list by role id.' },
      member_role_names: { type: 'array', items: { type: 'string' }, description: 'And/or by role name / SAP role name.' },
    },
    required: [],
  },
  async execute(args, ctx) {
    if (!Array.isArray(args.member_role_ids) && !Array.isArray(args.member_role_names)) {
      return 'Pass member_role_ids and/or member_role_names (the complete membership; an empty array clears it).'
    }
    const role = await findRole(ctx, args.role_id, args.role_name)
    if (typeof role === 'string') return role
    if ((role.role_type ?? 'single') !== 'composite') {
      return `"${role.name}" is a ${role.role_type ?? 'single'} role, not a composite. Change it with update_security_role (role_type: composite) first, or pick a composite role.`
    }
    const members = await resolveMemberRoles(ctx, args.member_role_ids, args.member_role_names, role.id)
    if (typeof members === 'string') return members

    const { error: delErr } = await ctx.modelDb.from('process_role_members').delete().eq('composite_role_id', role.id)
    if (delErr) return `Failed to clear the current membership: ${delErr.message}. Nothing was changed.`
    if (members.length) {
      const { error: insErr } = await ctx.modelDb
        .from('process_role_members')
        .insert(members.map((m) => ({ composite_role_id: role.id, member_role_id: m.id })))
      if (insErr) return `The old membership was cleared but inserting the new members failed: ${insErr.message}. Call set_composite_members again with the full list.`
    }
    return J({
      updated: 'security_role',
      id: role.id,
      name: role.name,
      members: members.map((m) => ({ id: m.id, name: m.name, sap_role_name: m.sap_role_name ?? undefined })),
      link: SECURITY_LINK,
      note: CITE_NOTE,
    })
  },
}

export const LINK_PERSONA_TO_ROLES: AgentTool = {
  name: 'link_persona_to_roles',
  description:
    `Link a persona (Persona Catalog) to one or more security roles. Pairs that are already linked are skipped, never overwritten. ${ONLY_ON_REQUEST} ` +
    `Maximum ${MAX_LINK_ROLES} roles per call.`,
  input_schema: {
    type: 'object',
    properties: {
      persona_id: { type: 'string', description: 'The persona (from list_personas).' },
      persona_name: { type: 'string', description: 'Alternative to persona_id: the persona name (exact, case-insensitive).' },
      role_ids: { type: 'array', items: { type: 'string' }, description: 'The roles to link by id.' },
      role_names: { type: 'array', items: { type: 'string' }, description: 'And/or by role name / SAP role name.' },
      from_autodetermine: { type: 'boolean', description: 'True only when applying an autodetermine_persona_roles proposal; records source ai instead of manual.' },
      rationale: { type: 'string', description: 'Optional short reason recorded on the link.' },
    },
    required: [],
  },
  async execute(args, ctx) {
    const persona = await findPersona(ctx, args.persona_id, args.persona_name)
    if (typeof persona === 'string') return persona

    const ids = (Array.isArray(args.role_ids) ? args.role_ids : []).map((v) => str(v)).filter(Boolean)
    const names = (Array.isArray(args.role_names) ? args.role_names : []).map((v) => str(v)).filter(Boolean)
    if (!ids.length && !names.length) return 'Pass role_ids and/or role_names.'

    const roles = await listOrgRoles(ctx)
    if (typeof roles === 'string') return roles
    const byId = new Map(roles.map((r) => [r.id, r]))
    const targets: SecurityRoleRow[] = []
    const seen = new Set<string>()
    const problems: string[] = []
    const take = (r: SecurityRoleRow | undefined, ref: string) => {
      if (!r) { problems.push(`"${ref}" does not match a role in this organization`); return }
      if (!seen.has(r.id)) { seen.add(r.id); targets.push(r) }
    }
    for (const id of ids) take(byId.get(id), id)
    for (const name of names) {
      const n = name.toLowerCase()
      const matches = roles.filter((r) => r.name.toLowerCase() === n || (r.sap_role_name ?? '').toLowerCase() === n)
      if (matches.length > 1) { problems.push(`"${name}" matches ${matches.length} roles; use role_ids`); continue }
      take(matches[0], name)
    }
    if (problems.length) return `The role list could not be resolved: ${problems.join('; ')}. Nothing was linked; call list_security_roles and try again.`
    if (targets.length > MAX_LINK_ROLES) return `That is ${targets.length} roles; the cap is ${MAX_LINK_ROLES} per call.`

    const { data: existingRows, error: exErr } = await ctx.modelDb
      .from('persona_roles')
      .select('role_id')
      .eq('persona_id', persona.id)
    if (exErr) return `Error reading the persona's existing links: ${exErr.message}`
    const linked = new Set(((existingRows ?? []) as { role_id: string }[]).map((l) => l.role_id))

    const source = args.from_autodetermine === true ? 'ai' : 'manual'
    const toInsert = targets.filter((r) => !linked.has(r.id))
    const skipped = targets.filter((r) => linked.has(r.id)).map((r) => r.name)
    if (toInsert.length) {
      const { error } = await ctx.modelDb.from('persona_roles').insert(
        toInsert.map((r) => ({ persona_id: persona.id, role_id: r.id, source, rationale: optStr(args.rationale) }))
      )
      if (error) return `Failed to link the persona: ${error.message}`
    }
    return J({
      updated: 'persona',
      persona_id: persona.id,
      persona: persona.name,
      linked_roles: toInsert.map((r) => r.name),
      ...(skipped.length ? { already_linked: skipped } : {}),
      source,
      link: SECURITY_LINK,
      note: CITE_NOTE,
    })
  },
}

export const UNLINK_PERSONA_ROLE: AgentTool = {
  name: 'unlink_persona_role',
  description:
    `Remove the link between ONE persona and ONE security role. The persona and the role themselves are untouched. ${ONLY_ON_REQUEST}`,
  input_schema: {
    type: 'object',
    properties: {
      persona_id: { type: 'string', description: 'The persona (from list_personas).' },
      persona_name: { type: 'string', description: 'Alternative to persona_id: the persona name.' },
      role_id: { type: 'string', description: 'The role (from list_security_roles).' },
      role_name: { type: 'string', description: 'Alternative to role_id: the role name or SAP role name.' },
    },
    required: [],
  },
  async execute(args, ctx) {
    const persona = await findPersona(ctx, args.persona_id, args.persona_name)
    if (typeof persona === 'string') return persona
    const role = await findRole(ctx, args.role_id, args.role_name)
    if (typeof role === 'string') return role

    const { data, error } = await ctx.modelDb
      .from('persona_roles')
      .delete()
      .eq('persona_id', persona.id)
      .eq('role_id', role.id)
      .select('id')
    if (error) return `Failed to unlink: ${error.message}`
    if (!(data ?? []).length) return `"${persona.name}" is not linked to "${role.name}". Call get_security_role or list_security_roles to see the actual links.`
    return J({
      updated: 'persona',
      persona: persona.name,
      unlinked_role: role.name,
      link: SECURITY_LINK,
      note: CITE_NOTE,
    })
  },
}

// ─── AI auto-determination ──────────────────────────────────────────────────

export const AUTODETERMINE_PERSONA_ROLES: AgentTool = {
  name: 'autodetermine_persona_roles',
  description:
    'Derive persona-to-security-role assignments from the SAP access already captured in the process models: swimlanes carry personas, steps carry Fiori tiles and transaction codes, and each role\'s access items are matched against that footprint. ' +
    'Returns coverage-ranked proposals per persona (with rationale), uncovered access gaps, and role-access suggestions gathered from lanes that are tied to a role. ' +
    `By default (apply=false) it ONLY proposes and writes nothing — safe to call when analyzing. Set apply=true ONLY when the user has explicitly asked to apply the mapping: it then records the proposed persona links (source ai, with confidence and rationale) and, with include_role_access_sync=true, also records the role-access suggestions as access items (source ai). Existing manual links are never deleted or overwritten. Scans at most ${MAX_GRAPH_NODES} process graphs. Returns the ${SECURITY_LINK} link to cite.`,
  input_schema: {
    type: 'object',
    properties: {
      persona_id: { type: 'string', description: 'Optional: restrict the analysis to one persona (from list_personas). Omit to analyze every persona.' },
      apply: { type: 'boolean', description: 'Default false (propose only). True writes the proposed persona-role links; only on explicit user request.' },
      include_role_access_sync: { type: 'boolean', description: 'With apply=true: also record the role-access suggestions (from role-tagged lanes) as access items, source ai.' },
    },
    required: [],
  },
  async execute(args, ctx) {
    const apply = args.apply === true
    const includeSync = args.include_role_access_sync === true

    // Personas (org-scoped); optional single-persona focus.
    const { data: pRows, error: pErr } = await ctx.modelDb.from('personas').select('id, name').eq('organization_id', ctx.orgId)
    if (pErr) return `Error reading the personas: ${pErr.message}`
    const personas = (pRows ?? []) as { id: string; name: string }[]
    if (!personas.length) return 'The organization has no personas yet, so there is nothing to map. Create personas first (Persona Catalog), assign them to process swimlanes, then call this tool again.'
    const focusId = str(args.persona_id)
    if (focusId && !personas.some((p) => p.id === focusId)) {
      return "No such persona in this organization's model. Call list_personas first; do not guess ids."
    }

    // Process graphs: models org-scoped, then their leaf graphs (capped).
    const { data: mRows, error: mErr } = await ctx.modelDb.from('process_models').select('id, title').eq('organization_id', ctx.orgId)
    if (mErr) return `Error reading the process models: ${mErr.message}`
    const models = (mRows ?? []) as { id: string; title: string }[]
    let graphs: { processTitle: string; graph: unknown }[] = []
    let graphCapHit = false
    if (models.length) {
      const titleById = new Map(models.map((m) => [m.id, m.title]))
      const { data: nRows, error: nErr } = await ctx.modelDb
        .from('process_nodes')
        .select('process_model_id, name, graph_data')
        .in('process_model_id', models.map((m) => m.id))
        .not('graph_data', 'is', null)
        .limit(MAX_GRAPH_NODES)
      if (nErr) return `Error reading the process graphs: ${nErr.message}`
      const nodes = (nRows ?? []) as { process_model_id: string; name: string; graph_data: unknown }[]
      graphCapHit = nodes.length === MAX_GRAPH_NODES
      graphs = nodes.map((n) => ({
        processTitle: [titleById.get(n.process_model_id), n.name].filter(Boolean).join(': '),
        graph: n.graph_data,
      }))
    }
    if (!graphs.length) {
      return 'No process graphs exist yet (no BPMN leaf has been drawn), so there is no SAP access footprint to analyze. Model the processes with lanes (persona-assigned) and steps carrying Fiori tiles or tcodes first.'
    }

    // Roles, access, and existing links.
    const roles = await listOrgRoles(ctx)
    if (typeof roles === 'string') return roles
    const { data: aRows, error: aErr } = await ctx.modelDb
      .from('process_role_access')
      .select('id, organization_id, role_id, access_type, value, title, fiori_app_id, source, note, created_at')
      .eq('organization_id', ctx.orgId)
    if (aErr) return `Error reading the role access items: ${aErr.message}`
    const access = (aRows ?? []) as unknown as RoleAccessItem[]
    const { data: lRows, error: lErr } = await ctx.modelDb
      .from('persona_roles')
      .select('persona_id, role_id')
      .in('persona_id', personas.map((p) => p.id))
    if (lErr) return `Error reading the existing persona links: ${lErr.message}`
    const links = (lRows ?? []) as { persona_id: string; role_id: string }[]

    // The pure matcher (shared with the Security Role Studio UI): persona
    // footprints from lanes/steps, role-lane evidence, coverage scoring.
    const result = runAutoDetermination(graphs, {
      personas,
      roles: roles.map((r) => ({ id: r.id, name: r.name, sap_role_name: r.sap_role_name })),
      access,
      existingLinks: links,
      personaIds: focusId ? [focusId] : undefined,
    })

    // Apply mode: record the links (and optionally the access suggestions).
    let applied: Record<string, unknown> | undefined
    if (apply) {
      const problems: string[] = []
      const newLinks = result.proposals.filter((p) => !p.alreadyLinked)
      if (newLinks.length) {
        const { error } = await ctx.modelDb.from('persona_roles').upsert(
          newLinks.map((p) => ({ persona_id: p.personaId, role_id: p.roleId, source: 'ai', confidence: p.coverage, rationale: p.rationale })),
          { onConflict: 'persona_id,role_id', ignoreDuplicates: true }
        )
        if (error) problems.push(`persona link write failed: ${error.message}`)
      }
      let syncedAccess = 0
      if (includeSync && result.roleAccessSuggestions.length) {
        const rows = result.roleAccessSuggestions
          .map((s) => {
            const it = s.item
            const note = `AI: evidence from "${it.processTitle}" step "${it.stepLabel}"`
            if (it.tcode) return { organization_id: ctx.orgId, role_id: s.roleId, access_type: 'transaction', value: it.tcode, title: null as string | null, fiori_app_id: null as string | null, source: 'ai', note }
            if (it.fioriTileId) return { organization_id: ctx.orgId, role_id: s.roleId, access_type: 'fiori_tile', value: it.fioriTileId, title: it.fioriTitle ?? null, fiori_app_id: it.fioriAppId ?? null, source: 'ai', note }
            return null
          })
          .filter((r): r is NonNullable<typeof r> => !!r)
        if (rows.length) {
          const { error } = await ctx.modelDb.from('process_role_access').upsert(rows, { onConflict: 'role_id,access_type,value', ignoreDuplicates: true })
          if (error) problems.push(`role access sync failed: ${error.message}`)
          else syncedAccess = rows.length
        }
      }
      applied = {
        persona_links_written: result.proposals.filter((p) => !p.alreadyLinked).length,
        persona_links_skipped_existing: result.proposals.filter((p) => p.alreadyLinked).length,
        ...(includeSync ? { role_access_items_synced: syncedAccess } : {}),
        ...(problems.length ? { errors: problems } : {}),
      }
    }

    const summary =
      `Scanned ${result.processesScanned} process graph(s) and ${result.personasScanned} persona(s): ` +
      `${result.proposals.length} persona-role proposal(s), ${result.gaps.length} uncovered access gap(s), ` +
      `${result.roleAccessSuggestions.length} role-access suggestion(s).` +
      (apply ? ' Apply mode: the proposals were recorded.' : ' Propose-only mode: nothing was written.')

    return J({
      summary,
      mode: apply ? 'apply' : 'propose',
      ...(applied ? { applied } : {}),
      proposals: result.proposals,
      gaps: result.gaps,
      role_access_suggestions: result.roleAccessSuggestions,
      personas_scanned: result.personasScanned,
      processes_scanned: result.processesScanned,
      ...(graphCapHit ? { warning: `Only the first ${MAX_GRAPH_NODES} process graphs were scanned; the model is larger than the per-call cap.` } : {}),
      link: SECURITY_LINK,
      note: CITE_NOTE,
    })
  },
}

// ─── The belt ───────────────────────────────────────────────────────────────

export const SECURITY_DESIGN_TOOLS: AgentTool[] = [
  LIST_SECURITY_ROLES,
  GET_SECURITY_ROLE,
  CREATE_SECURITY_ROLE,
  UPDATE_SECURITY_ROLE,
  ADD_ROLE_ACCESS,
  REMOVE_ROLE_ACCESS,
  SET_COMPOSITE_MEMBERS,
  LINK_PERSONA_TO_ROLES,
  UNLINK_PERSONA_ROLE,
  AUTODETERMINE_PERSONA_ROLES,
]
