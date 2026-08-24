import { NextRequest, NextResponse } from 'next/server'

import { buildOrgModel, listControllingAreas } from '@/lib/sap/buildOrgModel'
import { getSystem, orgClient, saveSnapshot } from '@/lib/sap/db'
import {
  pullHierarchyViaClassrun, pullHierarchyViaFreestyle,
  pullRawViaClassrun, pullRawViaFreestyle,
} from '@/lib/sap/orgModelRaw'
import { resolveReader } from '@/lib/sap/resolveReader'
import type { PullDiagnostic } from '@/lib/sap/types'

/**
 * Pull the organizational model out of a connected system.
 *
 *   POST { orgId, userId, systemId, controllingArea?, save? }
 *
 * Two passes. First the raw dump: the fast path runs ZCL_M12_ORG_MODEL_DUMP if
 * the target happens to have it, otherwise the portable freestyle reads replay
 * the same SELECTs through the ADT data preview. Then the model is built for one
 * controlling area - if none was named, the one with the most company codes,
 * since that is what an assessment is almost always after.
 *
 * Reading the whole org structure is not fast: the PRPS/PROJ join alone runs
 * ~17s on the reference sandbox, so the reads are issued concurrently and the
 * route asks for a long budget.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const started = Date.now()
  try {
    const body = (await req.json()) as {
      orgId?: string
      userId?: string
      systemId?: string
      controllingArea?: string
      save?: boolean
    }
    if (!body.orgId || !body.systemId) {
      return NextResponse.json({ error: 'orgId and systemId are required' }, { status: 400 })
    }

    const db = orgClient(req)
    const system = await getSystem(db, body.orgId, body.systemId)
    if (!system) return NextResponse.json({ error: 'System not found.' }, { status: 404 })

    const resolved = resolveReader(req, system)
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.reason, needsLogon: resolved.needsLogon === true },
        { status: resolved.needsLogon ? 401 : 400 }
      )
    }
    const reader = resolved.reader

    const diagnostics: PullDiagnostic[] = []

    // ── Raw dump: fast path, else the portable reads ────────────────────────
    let pulledVia: 'classrun' | 'freestyle' = 'classrun'
    let raw = await pullRawViaClassrun(reader, diagnostics)
    if (!raw) {
      pulledVia = 'freestyle'
      raw = await pullRawViaFreestyle(reader, diagnostics)
    }

    const areas = listControllingAreas(raw)
    if (areas.length === 0) {
      return NextResponse.json(
        {
          error:
            'No controlling areas came back from this system. The reads may have been refused - check the diagnostics.',
          diagnostics,
        },
        { status: 502 }
      )
    }

    const requested = body.controllingArea?.trim().toUpperCase()
      || system.defaultControllingArea?.trim().toUpperCase()
    const chosen = (requested && areas.find((a) => a.kokrs === requested)?.kokrs) || areas[0].kokrs
    if (requested && requested !== chosen) {
      diagnostics.push({
        step: 'Controlling area', table: 'TKA01', rows: 0, ms: 0,
        error: `Controlling area ${requested} does not exist on this system; used ${chosen} instead.`,
      })
    }

    // ── Profit centre hierarchy for the chosen area ─────────────────────────
    // The dump class hardcodes subclass A000, so it is only correct there.
    let hierarchy = chosen === 'A000' ? await pullHierarchyViaClassrun(reader, diagnostics) : null
    if (!hierarchy) hierarchy = await pullHierarchyViaFreestyle(reader, chosen, diagnostics)

    const model = buildOrgModel(raw, hierarchy, {
      systemLabel: reader.label,
      sapClient: reader.client ?? system.client ?? '',
      controllingArea: chosen,
      pulledVia,
      pulledOn: new Date().toISOString().slice(0, 10),
    })

    let snapshot = null
    if (body.save !== false) {
      snapshot = await saveSnapshot(db, body.orgId, body.userId ?? null, {
        systemId: system.id,
        systemLabel: reader.label,
        sapClient: reader.client ?? system.client ?? '',
        controllingArea: chosen,
        pulledVia,
        model,
        diagnostics,
      })
    }

    return NextResponse.json({
      model,
      snapshot,
      diagnostics,
      controllingAreas: areas,
      controllingArea: chosen,
      pulledVia,
      elapsedMs: Date.now() - started,
    })
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 })
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'The pull failed.'
}
