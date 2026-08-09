import { NextRequest } from 'next/server'
import { serverModelDb } from '@/lib/workshop/server'
import { runExploration } from '@/lib/security/explore'
import type { ExplorationFindings } from '@/lib/security/types'

// Explore & Govern, step 1: run the READ-ONLY exploration of a registered
// governed system and persist the findings.
//
//   POST /api/security/explore   { orgId, systemId }
//
// The Govern Tools tab calls this directly so the Explore button works without
// chatting; the agent reaches the same engine through explore_governed_system.
//
// GUARDRAILS (contract section "GUARDRAILS"), enforced in src/lib/security/explore.ts:
//   1. READ-ONLY reconnaissance of a system the operator declared they administer.
//      Never authenticate, never submit credentials or forms, never POST, never
//      attempt an auth bypass, never exploit a finding, never scan a host that was
//      not registered.
//   2. HTTP caps: max 12 requests, 8s each, max 3 redirects, same-origin only,
//      512 KB bodies, GET/HEAD only, honest `unreachable[]`.
//   3. Source caps: node_modules/.git/dist/build/.next/vendor skipped, max 1500
//      files, 256 KB per file, allow-listed extensions. Never .env / .env.local /
//      *.pem / *.key.
//   4. A probable secret is a RISK with a redacted fingerprint. The value never
//      enters the findings JSON, the response, or the log.
//   7. Honest degradation: what could not be reached or scanned is reported, and
//      nothing is invented to fill the gap.
//
// Server-side with the service key, scoped explicitly by organization_id (this
// route validates the system belongs to the org), like the workshop routes.

export const runtime = 'nodejs'
// Bounded by the engine's own caps (12 requests x 8s plus the source scan), but
// well past Vercel's default; allow the full window rather than truncating a scan.
export const maxDuration = 300

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const

/** One honest sentence about what the exploration actually observed. */
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { orgId?: string; systemId?: string }
    const orgId = String(body.orgId || '')
    const systemId = String(body.systemId || '')
    if (!orgId || !systemId) return json({ error: 'orgId and systemId are required' }, 400)

    const db = serverModelDb()
    const { data: system, error: sErr } = await db
      .from('governed_systems')
      .select('id, name, base_url, source_path, status')
      .eq('id', systemId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (sErr) return json({ error: sErr.message }, 500)
    if (!system) return json({ error: 'Governed system not found for this organization' }, 404)

    const row = system as { id: string; name: string; base_url: string | null; source_path: string | null; status: string }
    if (!row.base_url && !row.source_path) {
      return json(
        { error: `"${row.name}" has neither a base URL nor a source path registered, so there is nothing to explore read-only.` },
        400,
      )
    }

    let findings: ExplorationFindings
    try {
      findings = await runExploration({
        ...(row.base_url ? { baseUrl: row.base_url } : {}),
        ...(row.source_path ? { sourcePath: row.source_path } : {}),
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'exploration failed'
      // Record the failure honestly rather than leaving a silent gap.
      await db.from('governance_explorations').insert({
        organization_id: orgId,
        system_id: row.id,
        status: 'failed',
        findings: {},
        summary: `Exploration failed: ${message}`,
      })
      return json({ error: `Exploration failed: ${message}`, systemId: row.id }, 502)
    }

    const summary = summarizeFindings(findings)
    const { data: exploration, error: eErr } = await db
      .from('governance_explorations')
      .insert({
        organization_id: orgId,
        system_id: row.id,
        status: 'complete',
        findings,
        summary,
      })
      .select('id, created_at')
      .single()
    if (eErr || !exploration) return json({ error: `The exploration ran but could not be recorded: ${eErr?.message ?? 'no row returned'}` }, 500)

    // registered -> explored. A system already further along (planned, approved,
    // governed) keeps its status: a re-exploration is evidence, not a rollback.
    if (row.status === 'registered') {
      await db
        .from('governed_systems')
        .update({ status: 'explored', updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('organization_id', orgId)
    }

    const created = exploration as { id: string; created_at: string }
    return json(
      {
        ok: true,
        explorationId: created.id,
        systemId: row.id,
        system: row.name,
        status: row.status === 'registered' ? 'explored' : row.status,
        exploredAt: created.created_at,
        summary,
        findings,
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
