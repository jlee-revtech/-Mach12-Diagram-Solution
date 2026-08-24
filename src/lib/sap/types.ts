// Types for hooking Solution Architecture Studio into live SAP systems.
//
// Two connection modes, both reaching the same read surface:
//   direct  - this app opens an HTTPS ADT session straight at host:port. Works in
//             local dev against vhcals4hcs and against any internet-reachable
//             system. Does NOT work from Vercel to an on-prem host.
//   bridge  - ADT reads are relayed through SAP Solution Studio on Cloud Foundry,
//             which already holds the BTP destinations + Cloud Connector route.
//             This is what makes on-prem systems reachable from the deployment.

export type SapMode = 'direct' | 'bridge'

/** A system in the org-scoped registry. Never carries a password. */
export interface SapSystem {
  id: string
  organizationId: string
  name: string
  mode: SapMode
  host?: string | null
  port?: number | null
  useSsl: boolean
  client?: string | null
  language?: string | null
  username?: string | null
  destinationName?: string | null
  defaultControllingArea?: string | null
  description?: string | null
  createdAt?: string
  updatedAt?: string
}

/** What the caller supplies when adding or editing a registry entry. */
export interface SapSystemInput {
  name: string
  mode: SapMode
  host?: string
  port?: number
  useSsl?: boolean
  client?: string
  language?: string
  username?: string
  destinationName?: string
  defaultControllingArea?: string
  description?: string
}

/** Credentials for one direct-mode system. Held only in the encrypted cookie. */
export interface SapCredentials {
  username: string
  password: string
}

export interface SapConnectionStatus {
  systemId: string
  connected: boolean
  message: string
  /** The ABAP user the session authenticated as, when the system reports it. */
  user?: string
  timestamp: number
}

/** One table read, as returned by the ADT freestyle data preview. */
export interface PreviewResult {
  fields: string[]
  rows: Array<Record<string, string>>
  /** Total rows the system says match, which can exceed what was returned. */
  totalRows: number
  truncated: boolean
}

/**
 * The read surface an org-model pull needs. Both the direct client and the
 * bridge client implement it, so the pull logic never knows which it is talking
 * to. Deliberately tiny and read-only.
 */
export interface SapReader {
  /** How this reader reaches SAP, for provenance on the snapshot. */
  readonly mode: SapMode
  /** Human-readable system label, for provenance on the snapshot. */
  readonly label: string
  /** The sap-client the reads run against, when known. */
  readonly client?: string
  /** Confirm the session is live. */
  testConnection(): Promise<SapConnectionStatus>
  /** Run one read-only ABAP SQL SELECT through the ADT data preview. */
  dataPreview(sql: string, maxRows: number): Promise<PreviewResult>
  /**
   * Run one of the allowlisted org-model dump classes, when it happens to exist
   * on the target. Returns null when the class is absent or the path is not
   * available, which is the signal to fall back to the freestyle reads.
   */
  runDumpClass(className: string): Promise<string | null>
}

/** A single read in a pull, kept for the diagnostics panel. */
export interface PullDiagnostic {
  step: string
  table: string
  rows: number
  totalRows?: number
  truncated?: boolean
  ms: number
  error?: string
}

export interface SnapshotSummary {
  id: string
  systemId: string | null
  systemLabel: string
  sapClient: string | null
  controllingArea: string
  pulledVia: string
  pulledAt: string
}
