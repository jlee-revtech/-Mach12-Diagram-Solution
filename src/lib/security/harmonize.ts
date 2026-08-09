// ─── External role ↔ SAP role harmonization (pure) ─────────
// Deterministic + explainable: every mapping carries a confidence and a
// rationale that names the evidence it was derived from. No supabase imports,
// no I/O, no randomness — the same inputs always produce the same table, so
// this module is directly unit-testable and safe on the server or the client.
//
// Rules (shared contract, implemented identically in the SAS and SSS apps):
//  • name token overlap — lowercase, split on [^a-z0-9], drop stopwords
//    ('role', 'user'; 'admin' is deliberately NOT a stopword), Jaccard over the
//    two token sets → 0..1
//  • domain-keyword bridge — an external token that hits a bucket in
//    DOMAIN_BRIDGE scores +0.35 when the SAP role carries any transaction in
//    that bucket
//  • score = min(1, jaccard + bridge), rounded to 2 decimals
//  • disposition — score ≥ 0.5 → 'map'; 0.2 ≤ score < 0.5 → 'review';
//    score < 0.2 → 'create'
//  • an unmanaged superuser name is ALWAYS 'review', whatever it scored

import type { DiscoveredRole, MapDisposition, RoleAccessItem, RoleHarmonization } from './types'

export interface HarmonizeSapRole { id: string; name: string; sap_role_name?: string | null }
export interface HarmonizePersona { id: string; name: string }
export interface HarmonizePersonaRoleLink { persona_id: string; role_id: string }

/** 'role'/'user' carry no discriminating signal. 'admin' does — it is kept. */
const STOPWORDS = new Set(['role', 'user'])

const MAP_THRESHOLD = 0.5
const REVIEW_THRESHOLD = 0.2
const BRIDGE_BONUS = 0.35

/** Names that denote an unmanaged superuser — always routed to human review. */
const SUPERUSER_RE = /^(admin|administrator|superuser|root|owner)$/i

/** Small static bridge from business vocabulary to the SAP transactions that prove it. */
export const DOMAIN_BRIDGE: { keywords: string[]; tcodes: string[] }[] = [
  { keywords: ['billing'], tcodes: ['VF01', 'VF02', 'VF03'] },
  { keywords: ['sales', 'order'], tcodes: ['VA01', 'VA02', 'VA03'] },
  { keywords: ['purchase', 'procure'], tcodes: ['ME21N', 'ME22N', 'ME23N'] },
  { keywords: ['project'], tcodes: ['CJ20N', 'CJI3'] },
  { keywords: ['time'], tcodes: ['CAT2', 'CATS'] },
  { keywords: ['finance', 'gl'], tcodes: ['FB03', 'FS00'] },
  { keywords: ['hr'], tcodes: ['PA30'] },
]

/** lowercase → split on [^a-z0-9] → drop stopwords and empties. */
export function tokenize(name: string): Set<string> {
  const out = new Set<string>()
  for (const raw of name.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw) continue
    if (STOPWORDS.has(raw)) continue
    out.add(raw)
  }
  return out
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const t of a) if (b.has(t)) shared++
  const union = a.size + b.size - shared
  return union === 0 ? 0 : shared / union
}

function sharedTokens(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = []
  for (const t of a) if (b.has(t)) out.push(t)
  return out.sort()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

interface Candidate {
  role: HarmonizeSapRole
  score: number
  overlap: string[]
  bridgeTcodes: string[]
}

function scoreRole(
  externalTokens: Set<string>,
  role: HarmonizeSapRole,
  roleTcodes: Set<string>,
): Candidate {
  const roleTokens = tokenize(role.name)
  const overlap = sharedTokens(externalTokens, roleTokens)
  const base = jaccard(externalTokens, roleTokens)

  // Bridge: external vocabulary hits a bucket AND the SAP role carries a
  // transaction from that bucket. Awarded once, not per bucket.
  const bridgeTcodes: string[] = []
  for (const bucket of DOMAIN_BRIDGE) {
    if (!bucket.keywords.some(k => externalTokens.has(k))) continue
    for (const t of bucket.tcodes) if (roleTcodes.has(t)) bridgeTcodes.push(t)
  }
  const bridge = bridgeTcodes.length > 0 ? BRIDGE_BONUS : 0

  return { role, score: round2(Math.min(1, base + bridge)), overlap, bridgeTcodes }
}

function dispositionFor(score: number): MapDisposition {
  if (score >= MAP_THRESHOLD) return 'map'
  if (score >= REVIEW_THRESHOLD) return 'review'
  return 'create'
}

function evidencePhrase(c: Candidate): string {
  const parts: string[] = []
  if (c.overlap.length > 0) parts.push(`name overlap: ${c.overlap.join(', ')}`)
  if (c.bridgeTcodes.length > 0) parts.push(`SAP role carries ${c.bridgeTcodes.join(', ')}`)
  return parts.join('; ')
}

/**
 * Harmonize the roles discovered on an external system against the SAP roles,
 * their access, and the personas already governed in this organization.
 *
 * Returns exactly one row per distinct external role (case-insensitive), in the
 * order the external roles were supplied.
 */
export function harmonizeRoles(
  externalRoles: DiscoveredRole[],
  sapRoles: HarmonizeSapRole[],
  access: RoleAccessItem[],
  personas: HarmonizePersona[],
  personaRoleLinks: HarmonizePersonaRoleLink[],
): RoleHarmonization[] {
  // Transactions per SAP role — the only access type the bridge table speaks.
  const tcodesByRole = new Map<string, Set<string>>()
  for (const a of access) {
    if (a.access_type !== 'transaction') continue
    const set = tcodesByRole.get(a.role_id) ?? new Set<string>()
    set.add(a.value.trim().toUpperCase())
    tcodesByRole.set(a.role_id, set)
  }

  const personaName = new Map(personas.map(p => [p.id, p.name]))
  // Personas linked to each role, sorted by name so the pick is deterministic.
  const personasByRole = new Map<string, HarmonizePersona[]>()
  for (const link of personaRoleLinks) {
    const name = personaName.get(link.persona_id)
    if (!name) continue
    const arr = personasByRole.get(link.role_id) ?? []
    if (!arr.some(p => p.id === link.persona_id)) arr.push({ id: link.persona_id, name })
    personasByRole.set(link.role_id, arr)
  }
  for (const arr of personasByRole.values()) arr.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

  const out: RoleHarmonization[] = []
  const seen = new Set<string>()

  for (const ext of externalRoles) {
    const externalRole = ext.name.trim()
    if (!externalRole) continue
    const key = externalRole.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const externalTokens = tokenize(externalRole)
    const isSuperuser = SUPERUSER_RE.test(externalRole)

    const candidates = sapRoles
      .map(role => scoreRole(externalTokens, role, tcodesByRole.get(role.id) ?? new Set<string>()))
      .sort((a, b) =>
        b.score - a.score ||
        b.overlap.length - a.overlap.length ||
        a.role.name.localeCompare(b.role.name) ||
        a.role.id.localeCompare(b.role.id))

    const best = candidates[0]
    const score = best ? best.score : 0
    const scored = dispositionFor(score)
    // An unmanaged superuser never auto-maps and never auto-creates.
    const disposition: MapDisposition = isSuperuser ? 'review' : scored

    const superuserNote = isSuperuser
      ? `Unmanaged superuser name "${externalRole}" — always routed to review: a blanket administrator grant defeats least privilege and cannot be reconciled to a segregated SAP role without a human decision. `
      : ''

    // A role is only attached when the score itself earned it; the superuser
    // override changes the disposition, never the evidence.
    if (!best || scored === 'create') {
      const why = !best
        ? 'no SAP roles are governed in this organization yet, so there is nothing to compare against'
        : `best SAP candidate "${best.role.name}" scored ${best.score.toFixed(2)} (${evidencePhrase(best) || 'no name-token or domain-keyword evidence'}), below the ${REVIEW_THRESHOLD} review threshold`
      out.push({
        externalRole,
        roleId: null,
        roleName: null,
        personaId: null,
        personaName: null,
        disposition,
        confidence: score,
        rationale: `${superuserNote}No SAP analogue: ${why}. Propose a new least-privilege role for this external role.`,
      })
      continue
    }

    const linkedPersonas = personasByRole.get(best.role.id) ?? []
    const persona = linkedPersonas[0] ?? null
    const evidence = evidencePhrase(best) || 'no name-token or domain-keyword evidence'
    const personaPart = persona
      ? `; persona "${persona.name}" already carries that SAP role`
      : '; no persona is linked to that SAP role yet'
    const verdict = disposition === 'map'
      ? `Map to SAP role "${best.role.name}"${best.role.sap_role_name ? ` (${best.role.sap_role_name})` : ''}`
      : `Closest SAP role is "${best.role.name}"${best.role.sap_role_name ? ` (${best.role.sap_role_name})` : ''} — confirm before mapping`

    out.push({
      externalRole,
      roleId: best.role.id,
      roleName: best.role.name,
      personaId: persona?.id ?? null,
      personaName: persona?.name ?? null,
      disposition,
      confidence: score,
      rationale: `${superuserNote}${verdict}. Evidence — ${evidence}${personaPart}. Score ${best.score.toFixed(2)}.`,
    })
  }

  return out
}
