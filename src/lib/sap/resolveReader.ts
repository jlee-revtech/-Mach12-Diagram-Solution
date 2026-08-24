// Turn a registry row + the caller's cookie into a live SapReader.
//
// Direct systems need credentials out of the encrypted cookie; bridge systems
// need only the Solution Studio channel. Every failure mode returns a reason the
// UI can show verbatim rather than a thrown stack.

import { bridgeConfigFromEnv, BridgeSapReader } from './bridgeReader'
import { credentialStoreAvailable, readCredentials } from './credentialCookie'
import { DirectSapReader } from './directReader'
import type { SapReader, SapSystem } from './types'

export type ResolveResult =
  | { ok: true; reader: SapReader }
  | { ok: false; reason: string; needsLogon?: boolean }

export function resolveReader(req: Request, system: SapSystem): ResolveResult {
  if (system.mode === 'bridge') {
    const cfg = bridgeConfigFromEnv()
    if (!cfg) {
      return {
        ok: false,
        reason:
          'This system routes through SAP Solution Studio, but SSS_REALIZATION_URL / REALIZATION_SHARED_SECRET are not configured on this deployment.',
      }
    }
    if (!system.destinationName) {
      return { ok: false, reason: `System "${system.name}" has no destination name set.` }
    }
    return {
      ok: true,
      reader: new BridgeSapReader(
        {
          systemId: system.id,
          label: system.name,
          destinationName: system.destinationName,
          client: system.client ?? undefined,
        },
        cfg
      ),
    }
  }

  if (!credentialStoreAvailable()) {
    return {
      ok: false,
      reason:
        'Direct SAP logon is disabled because no SAP_SESSION_SECRET is configured on this deployment. Credentials are held in an encrypted cookie and there is no key to encrypt them with.',
    }
  }
  if (!system.host || !system.port || !system.client) {
    return { ok: false, reason: `System "${system.name}" is missing its host, port, or client.` }
  }

  const creds = readCredentials(req, system.id)
  if (!creds) {
    return { ok: false, reason: `Not signed in to ${system.name}.`, needsLogon: true }
  }

  return {
    ok: true,
    reader: new DirectSapReader({
      systemId: system.id,
      label: system.name,
      host: system.host,
      port: system.port,
      useSsl: system.useSsl,
      client: system.client,
      language: system.language ?? 'EN',
      username: creds.username,
      password: creds.password,
    }),
  }
}
