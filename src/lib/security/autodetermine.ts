// ─── Persona → security-role auto-determination (pure) ─────
// Derives persona→role assignment proposals from the SAP access (Fiori tiles /
// transaction codes) already captured on process steps: lanes carry
// personaId/roleId, steps inherit their lane's persona.
//
// PURE module — no supabase imports. Consumed by both the security agent tools
// and the Security Role Studio UI. graph_data arrives as untrusted jsonb, so
// every access goes through typed guards.

import type {
  PersonaFootprintItem,
  PersonaRoleProposal,
  AccessGap,
  RoleAccessSuggestion,
  AutoDetermineResult,
  RoleAccessItem,
} from './types'

export interface GraphInput {
  processTitle: string
  graph: unknown
}

// ─── Defensive jsonb parsing ───────────────────────────

interface ParsedLane { id: string; personaId?: string; roleId?: string }
interface ParsedStep {
  laneId?: string
  label: string
  tcode?: string
  fioriTileId?: string
  fioriAppId?: string
  fioriTitle?: string
  module?: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined
}

function parseGraph(graph: unknown): { lanes: ParsedLane[]; steps: ParsedStep[] } | null {
  if (!isRecord(graph)) return null
  const { lanes: lanesRaw, nodes: nodesRaw } = graph
  if (!Array.isArray(lanesRaw) || !Array.isArray(nodesRaw)) return null

  const lanes: ParsedLane[] = []
  for (const l of lanesRaw) {
    if (!isRecord(l)) continue
    const id = str(l.id)
    if (!id) continue
    lanes.push({ id, personaId: str(l.personaId), roleId: str(l.roleId) })
  }

  const steps: ParsedStep[] = []
  for (const n of nodesRaw) {
    if (!isRecord(n)) continue
    // React Flow nodes carry their payload under node.data
    const data = isRecord(n.data) ? n.data : null
    if (!data) continue
    const tile = isRecord(data.fioriTile) ? data.fioriTile : null
    steps.push({
      laneId: str(data.laneId),
      label: str(data.label) ?? '',
      tcode: str(data.tcode)?.trim().toUpperCase(),
      fioriTileId: tile ? str(tile.id) : undefined,
      fioriAppId: tile ? str(tile.appId) : undefined,
      fioriTitle: tile ? str(tile.title) : undefined,
      module: str(data.module),
    })
  }
  return { lanes, steps }
}

// A step only contributes a footprint item when it carries matchable SAP
// access (a transaction code or a structured Fiori tile).
function toFootprintItem(step: ParsedStep, processTitle: string): PersonaFootprintItem | null {
  if (!step.tcode && !step.fioriTileId) return null
  const item: PersonaFootprintItem = { stepLabel: step.label, processTitle }
  if (step.tcode) item.tcode = step.tcode
  if (step.fioriTileId) item.fioriTileId = step.fioriTileId
  if (step.fioriAppId) item.fioriAppId = step.fioriAppId
  if (step.fioriTitle) item.fioriTitle = step.fioriTitle
  if (step.module) item.module = step.module
  return item
}

function footprintKey(item: PersonaFootprintItem): string {
  return `${item.tcode ?? ''}|${item.fioriTileId ?? ''}`
}

// Generic walk: collect footprint items per lane owner (personaId or roleId),
// deduped by (tcode|fioriTileId) per owner.
function collectByLaneOwner(
  graphs: GraphInput[],
  ownerOf: (lane: ParsedLane) => string | undefined,
  ownerFilter?: Set<string> | null,
): Map<string, PersonaFootprintItem[]> {
  const out = new Map<string, PersonaFootprintItem[]>()
  const seen = new Map<string, Set<string>>()
  for (const g of graphs) {
    const parsed = parseGraph(g.graph)
    if (!parsed) continue
    for (const lane of parsed.lanes) {
      const owner = ownerOf(lane)
      if (!owner) continue
      if (ownerFilter && !ownerFilter.has(owner)) continue
      if (!out.has(owner)) {
        out.set(owner, [])
        seen.set(owner, new Set())
      }
      for (const step of parsed.steps) {
        if (step.laneId !== lane.id) continue
        const item = toFootprintItem(step, g.processTitle)
        if (!item) continue
        const key = footprintKey(item)
        if (seen.get(owner)!.has(key)) continue
        seen.get(owner)!.add(key)
        out.get(owner)!.push(item)
      }
    }
  }
  return out
}

// ─── Footprint builders ────────────────────────────────

/** Persona footprints: every SAP access item on steps in that persona's lanes. */
export function buildPersonaFootprints(
  graphs: GraphInput[],
  personaIds?: string[],
): Map<string, PersonaFootprintItem[]> {
  const filter = personaIds && personaIds.length > 0 ? new Set(personaIds) : null
  return collectByLaneOwner(graphs, lane => lane.personaId, filter)
}

/**
 * Role lane evidence: steps in lanes directly tagged with a roleId are direct
 * evidence of that role's access (used for proposed role-access additions,
 * NOT for persona matching).
 */
export function buildRoleLaneEvidence(
  graphs: GraphInput[],
): Map<string, PersonaFootprintItem[]> {
  return collectByLaneOwner(graphs, lane => lane.roleId)
}

// ─── Matching ──────────────────────────────────────────

function accessMatchesItem(a: RoleAccessItem, item: PersonaFootprintItem): boolean {
  if (a.access_type === 'transaction') {
    return !!item.tcode && a.value.trim().toUpperCase() === item.tcode
  }
  if (a.access_type === 'fiori_tile') {
    if (item.fioriTileId && a.value === item.fioriTileId) return true
    if (a.fiori_app_id && item.fioriAppId && a.fiori_app_id === item.fioriAppId) return true
    return false
  }
  // programs / tables / auth objects never match footprint items (role-side depth only)
  return false
}

function itemLabel(item: PersonaFootprintItem): string {
  if (item.tcode) return item.tcode
  if (item.fioriTileId) return item.fioriTitle ? `${item.fioriTileId} (${item.fioriTitle})` : item.fioriTileId
  return item.stepLabel
}

const RATIONALE_ITEM_CAP = 5

function buildRationale(matched: PersonaFootprintItem[], total: number): string {
  const labels = matched.slice(0, RATIONALE_ITEM_CAP).map(itemLabel)
  const suffix = matched.length > RATIONALE_ITEM_CAP ? ', …' : ''
  return `Covers ${matched.length}/${total} SAP access items from process lanes: ${labels.join(', ')}${suffix}`
}

export interface MatchFootprintsExtras {
  /** Output of buildRoleLaneEvidence — enables roleAccessSuggestions. */
  roleEvidence?: Map<string, PersonaFootprintItem[]>
  /** Number of process graphs walked (falls back to distinct process titles seen). */
  processesScanned?: number
}

/**
 * Score persona footprints against role access items per the shared matching
 * rules. Proposes every role with coverage > 0 (ranked desc), reports
 * uncovered footprint items as gaps, and — when role lane evidence is passed —
 * suggests access additions for lanes tagged directly with a role.
 */
export function matchFootprints(
  footprints: Map<string, PersonaFootprintItem[]>,
  roles: { id: string; name: string; sap_role_name?: string | null }[],
  access: RoleAccessItem[],
  existingLinks: { persona_id: string; role_id: string }[],
  personas: { id: string; name: string }[],
  extras?: MatchFootprintsExtras,
): AutoDetermineResult {
  const personaName = new Map(personas.map(p => [p.id, p.name]))
  const accessByRole = new Map<string, RoleAccessItem[]>()
  for (const a of access) {
    const arr = accessByRole.get(a.role_id) ?? []
    arr.push(a)
    accessByRole.set(a.role_id, arr)
  }
  const linked = new Set(existingLinks.map(l => `${l.persona_id}|${l.role_id}`))

  const proposals: PersonaRoleProposal[] = []
  const gaps: AccessGap[] = []

  for (const [personaId, items] of footprints) {
    const name = personaName.get(personaId) ?? personaId
    if (items.length === 0) continue
    const coveredKeys = new Set<string>()

    for (const role of roles) {
      const roleAccess = accessByRole.get(role.id) ?? []
      if (roleAccess.length === 0) continue
      const matched = items.filter(item => roleAccess.some(a => accessMatchesItem(a, item)))
      if (matched.length === 0) continue
      for (const m of matched) coveredKeys.add(footprintKey(m))
      const coverage = Math.round((matched.length / items.length) * 100) / 100
      proposals.push({
        personaId,
        personaName: name,
        roleId: role.id,
        roleName: role.name,
        sapRoleName: role.sap_role_name ?? null,
        coverage,
        matched,
        rationale: buildRationale(matched, items.length),
        alreadyLinked: linked.has(`${personaId}|${role.id}`),
      })
    }

    // Footprint items no role covers → gaps (add access to a role, or create one)
    for (const item of items) {
      if (!coveredKeys.has(footprintKey(item))) gaps.push({ personaId, personaName: name, item })
    }
  }

  proposals.sort((a, b) =>
    b.coverage - a.coverage ||
    a.personaName.localeCompare(b.personaName) ||
    a.roleName.localeCompare(b.roleName))

  // Role-lane evidence → access items the role does not grant yet
  const roleAccessSuggestions: RoleAccessSuggestion[] = []
  if (extras?.roleEvidence) {
    const roleName = new Map(roles.map(r => [r.id, r.name]))
    for (const [roleId, items] of extras.roleEvidence) {
      const rName = roleName.get(roleId)
      if (!rName) continue // lane points at a role that no longer exists
      const roleAccess = accessByRole.get(roleId) ?? []
      for (const item of items) {
        if (roleAccess.some(a => accessMatchesItem(a, item))) continue
        roleAccessSuggestions.push({ roleId, roleName: rName, item })
      }
    }
  }

  // Fall back to the distinct process titles seen when the caller didn't count graphs.
  let processesScanned = extras?.processesScanned
  if (processesScanned === undefined) {
    const titles = new Set<string>()
    for (const items of footprints.values()) for (const i of items) titles.add(i.processTitle)
    processesScanned = titles.size
  }

  return {
    proposals,
    gaps,
    roleAccessSuggestions,
    personasScanned: footprints.size,
    processesScanned,
  }
}

/**
 * Convenience one-shot: parse graphs, build persona footprints + role lane
 * evidence, and match — returns a fully-populated AutoDetermineResult.
 */
export function runAutoDetermination(
  graphs: GraphInput[],
  input: {
    personas: { id: string; name: string }[]
    roles: { id: string; name: string; sap_role_name?: string | null }[]
    access: RoleAccessItem[]
    existingLinks: { persona_id: string; role_id: string }[]
    personaIds?: string[]
  },
): AutoDetermineResult {
  const footprints = buildPersonaFootprints(graphs, input.personaIds)
  const roleEvidence = buildRoleLaneEvidence(graphs)
  const processesScanned = graphs.reduce((n, g) => n + (parseGraph(g.graph) ? 1 : 0), 0)
  return matchFootprints(footprints, input.roles, input.access, input.existingLinks, input.personas, {
    roleEvidence,
    processesScanned,
  })
}
