// Bridge-mode SapReader: ADT reads relayed through SAP Solution Studio on Cloud
// Foundry, which already holds the BTP destinations and the Cloud Connector
// route to on-prem systems.
//
// This is what makes vhcals4hcs (and any customer system behind a Cloud
// Connector) readable from the Vercel deployment, which cannot open a socket to
// an on-prem host itself. Same shared-secret channel as the existing
// SapRealization tool belt, on a separate read-only endpoint.

import { ORG_DUMP_CLASSES } from './dumpClasses'
import type { PreviewResult, SapConnectionStatus, SapReader } from './types'

export interface BridgeTarget {
  systemId: string
  label: string
  destinationName: string
  client?: string
}

export interface BridgeConfig {
  url: string
  secret: string
}

/** Solution Studio bridge coordinates, or null when the app is not wired to one. */
export function bridgeConfigFromEnv(): BridgeConfig | null {
  const base = process.env.SSS_REALIZATION_URL
  const secret = process.env.REALIZATION_SHARED_SECRET
  if (!base || !secret) return null
  // SSS_REALIZATION_URL points at .../api/realization; the read bridge is its
  // sibling. Derive rather than add another environment variable to keep in sync.
  const url = process.env.SSS_SAP_BRIDGE_URL || base.replace(/\/realization\/?$/, '/sap-bridge')
  return { url, secret }
}

export class BridgeSapReader implements SapReader {
  readonly mode = 'bridge' as const
  readonly label: string
  readonly client?: string

  constructor(
    private target: BridgeTarget,
    private cfg: BridgeConfig
  ) {
    this.label = target.label
    this.client = target.client
  }

  private async call<T>(op: string, payload: Record<string, unknown>): Promise<T> {
    let res: Response
    try {
      res = await fetch(this.cfg.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-realization-secret': this.cfg.secret,
        },
        body: JSON.stringify({ op, destination: this.target.destinationName, ...payload }),
      })
    } catch (err) {
      throw new Error(
        `Could not reach the Solution Studio bridge: ${err instanceof Error ? err.message : 'request failed'}.`
      )
    }
    const text = await res.text().catch(() => '')
    let json: { error?: string } & Record<string, unknown> = {}
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      throw new Error(`Solution Studio bridge returned a non-JSON response (HTTP ${res.status}).`)
    }
    if (!res.ok) {
      throw new Error(
        typeof json.error === 'string'
          ? json.error
          : `Solution Studio bridge returned HTTP ${res.status}.`
      )
    }
    return json as T
  }

  async testConnection(): Promise<SapConnectionStatus> {
    try {
      const out = await this.call<{ connected?: boolean; message?: string; user?: string }>(
        'test_connection',
        {}
      )
      return {
        systemId: this.target.systemId,
        connected: out.connected === true,
        message:
          out.message ||
          (out.connected
            ? `Reachable via Solution Studio destination ${this.target.destinationName}.`
            : 'The destination did not respond.'),
        user: out.user,
        timestamp: Date.now(),
      }
    } catch (err) {
      return {
        systemId: this.target.systemId,
        connected: false,
        message: err instanceof Error ? err.message : 'Bridge call failed.',
        timestamp: Date.now(),
      }
    }
  }

  async dataPreview(sql: string, maxRows: number): Promise<PreviewResult> {
    const out = await this.call<{ result?: PreviewResult }>('data_preview', { sql, maxRows })
    if (!out.result) throw new Error('The bridge returned no data-preview payload.')
    return out.result
  }

  async runDumpClass(className: string): Promise<string | null> {
    if (!ORG_DUMP_CLASSES.includes(className)) return null
    try {
      const out = await this.call<{ output?: string | null }>('run_dump_class', { className })
      return typeof out.output === 'string' && out.output.trim() ? out.output : null
    } catch {
      return null
    }
  }
}

/** Ask Solution Studio which destinations it can route to. */
export async function listBridgeDestinations(
  cfg: BridgeConfig
): Promise<{ name: string; description?: string }[]> {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-realization-secret': cfg.secret },
    body: JSON.stringify({ op: 'list_destinations' }),
  })
  if (!res.ok) return []
  const json = (await res.json().catch(() => ({}))) as {
    destinations?: { name: string; description?: string }[]
  }
  return Array.isArray(json.destinations) ? json.destinations : []
}
