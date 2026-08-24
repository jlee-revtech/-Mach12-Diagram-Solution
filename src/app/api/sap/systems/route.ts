import { NextRequest, NextResponse } from 'next/server'

import {
  bridgeConfigFromEnv, isPlatformDestination, listBridgeDestinations,
} from '@/lib/sap/bridgeReader'
import { credentialStoreAvailable } from '@/lib/sap/credentialCookie'
import { createSystem, listSystems, orgClient } from '@/lib/sap/db'
import type { SapSystemInput } from '@/lib/sap/types'

// The org-scoped SAP system registry.
//   GET  ?orgId          -> the org's systems, plus what this deployment can do
//                           (direct logon available? which bridge destinations?)
//   POST { orgId, ... }  -> register a system. Metadata only; never a password.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  try {
    const systems = await listSystems(orgClient(req), orgId)

    // Systems Solution Studio can reach. Surfaced as discoverable entries rather
    // than only as options inside the add form, so the systems already available
    // over there show up here without being retyped.
    const cfg = bridgeConfigFromEnv()
    const discovery = cfg
      ? await listBridgeDestinations(cfg).catch((err: unknown) => ({
          destinations: [],
          reachable: false,
          problem: err instanceof Error ? err.message : 'Discovery failed.',
        }))
      : { destinations: [], reachable: false, problem: undefined }

    // Anything already registered is not offered again.
    const claimed = new Set(
      systems
        .filter((s) => s.mode === 'bridge' && s.destinationName)
        .map((s) => s.destinationName!.toLowerCase())
    )

    // Platform plumbing is reported separately rather than offered as a system.
    const abap = discovery.destinations.filter((d) => !isPlatformDestination(d))
    const platform = discovery.destinations.filter(isPlatformDestination)

    return NextResponse.json({
      systems,
      capabilities: {
        directAvailable: credentialStoreAvailable(),
        bridgeAvailable: cfg !== null,
        destinations: abap,
        discoverable: abap.filter((d) => !claimed.has(d.name.toLowerCase())),
        platformDestinations: platform.map((d) => d.name),
        bridgeReachable: discovery.reachable,
        bridgeProblem: discovery.problem,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { orgId?: string; userId?: string } & Partial<SapSystemInput>
    const { orgId, userId } = body
    if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

    const invalid = validate(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const system = await createSystem(orgClient(req), orgId, userId ?? null, {
      name: body.name!,
      mode: body.mode!,
      host: body.host,
      port: body.port,
      useSsl: body.useSsl,
      client: body.client,
      language: body.language,
      username: body.username,
      destinationName: body.destinationName,
      defaultControllingArea: body.defaultControllingArea,
      description: body.description,
    })
    return NextResponse.json({ system })
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 })
  }
}

export function validate(input: Partial<SapSystemInput>): string | null {
  if (!input.name?.trim()) return 'A display name is required.'
  if (input.mode !== 'direct' && input.mode !== 'bridge') return 'Mode must be direct or bridge.'

  if (input.mode === 'direct') {
    if (!input.host?.trim()) return 'A host is required for a direct connection.'
    if (!input.port || input.port < 1 || input.port > 65535) return 'A valid port is required.'
    if (!input.client?.trim()) return 'An SAP client is required.'
    if (!/^\d{3}$/.test(input.client.trim())) return 'The SAP client must be three digits.'
  } else if (!input.destinationName?.trim()) {
    return 'A Solution Studio destination name is required for a bridged connection.'
  }

  if (input.defaultControllingArea && !/^[A-Za-z0-9_-]{1,10}$/.test(input.defaultControllingArea.trim())) {
    return 'The controlling area looks wrong - use the four-character code, e.g. A000.'
  }
  return null
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed.'
}
