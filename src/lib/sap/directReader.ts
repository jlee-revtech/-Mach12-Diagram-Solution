// Direct-mode SapReader: an HTTPS ADT session opened straight at host:port with
// Basic auth. This is the path used in local dev against vhcals4hcs and against
// any internet-reachable system.
//
// Deliberately much smaller than Solution Studio's full AdtClient - an org-model
// pull needs exactly three things: discovery (is the session alive), the
// freestyle data preview (read a table), and classrun (the optional fast path).
// Everything here is read-only.

import { parseAdtError, parseDataPreview } from './dataPreview'
import { ORG_DUMP_CLASSES } from './dumpClasses'
import type { PreviewResult, SapConnectionStatus, SapReader } from './types'

export interface DirectTarget {
  systemId: string
  label: string
  host: string
  port: number
  useSsl: boolean
  client: string
  language?: string
  username: string
  password: string
}

export class DirectSapReader implements SapReader {
  readonly mode = 'direct' as const
  readonly label: string
  readonly client: string

  private baseUrl: string
  private authHeader: string
  private target: DirectTarget
  private csrfToken: string | null = null
  private cookies: string[] = []

  constructor(target: DirectTarget) {
    this.target = target
    this.label = target.label
    this.client = target.client
    this.baseUrl = `${target.useSsl ? 'https' : 'http'}://${target.host}:${target.port}`
    this.authHeader =
      'Basic ' + Buffer.from(`${target.username}:${target.password}`).toString('base64')
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: this.authHeader,
      'sap-client': this.target.client,
      'sap-language': this.target.language || 'EN',
      ...extra,
    }
  }

  async testConnection(): Promise<SapConnectionStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/sap/bc/adt/discovery`, {
        headers: this.headers({ Accept: 'application/atomsvc+xml, application/xml, */*' }),
      })
      if (!res.ok) {
        return {
          systemId: this.target.systemId,
          connected: false,
          message:
            res.status === 401
              ? 'SAP rejected the user or password.'
              : `SAP returned ${res.status} ${res.statusText} from /sap/bc/adt/discovery.`,
          timestamp: Date.now(),
        }
      }
      await res.text().catch(() => '')
      return {
        systemId: this.target.systemId,
        connected: true,
        message: `Connected to ${this.target.host} client ${this.target.client}.`,
        user: this.target.username.toUpperCase(),
        timestamp: Date.now(),
      }
    } catch (err) {
      return {
        systemId: this.target.systemId,
        connected: false,
        message: explainNetworkError(err, this.target.host, this.target.port),
        timestamp: Date.now(),
      }
    }
  }

  /** GET /sap/bc/adt/discovery with x-csrf-token: fetch, capturing token + cookies. */
  private async primeCsrf(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sap/bc/adt/discovery`, {
      headers: this.headers({
        Accept: 'application/atomsvc+xml, application/xml, */*',
        'x-csrf-token': 'fetch',
      }),
    })
    const token = res.headers.get('x-csrf-token')
    await res.text().catch(() => '')
    if (!res.ok || !token) {
      throw new Error(
        `Could not obtain a CSRF token from ${this.target.host} (HTTP ${res.status}).`
      )
    }
    this.csrfToken = token
    this.captureCookies(res)
  }

  private captureCookies(res: Response): void {
    const getSetCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie
    const raw =
      typeof getSetCookie === 'function'
        ? getSetCookie.call(res.headers)
        : (res.headers.get('set-cookie') || '').split(/,(?=[^;]+=)/)
    const incoming = raw.map((c) => c.split(';')[0].trim()).filter(Boolean)
    if (incoming.length === 0) return
    const byName = new Map<string, string>()
    for (const c of [...this.cookies, ...incoming]) {
      const eq = c.indexOf('=')
      if (eq > 0) byName.set(c.slice(0, eq), c)
    }
    this.cookies = Array.from(byName.values())
  }

  private async post(
    path: string,
    body: string,
    contentType: string,
    accept: string
  ): Promise<string> {
    if (!this.csrfToken) await this.primeCsrf()

    const send = () =>
      fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        body,
        headers: this.headers({
          'Content-Type': contentType,
          Accept: accept,
          'x-csrf-token': this.csrfToken!,
          'x-sap-adt-sessiontype': 'stateless',
          ...(this.cookies.length ? { Cookie: this.cookies.join('; ') } : {}),
        }),
      })

    let res = await send()
    // A stale token comes back as 403 + x-csrf-token: Required. Re-prime once.
    if (res.status === 403 && (res.headers.get('x-csrf-token') || '').toLowerCase() === 'required') {
      await res.text().catch(() => '')
      await this.primeCsrf()
      res = await send()
    }

    const text = await res.text().catch(() => '')
    if (!res.ok) {
      throw new Error(parseAdtError(text) || `ADT POST ${path} failed: HTTP ${res.status}.`)
    }
    this.captureCookies(res)
    return text
  }

  async dataPreview(sql: string, maxRows: number): Promise<PreviewResult> {
    const xml = await this.post(
      `/sap/bc/adt/datapreview/freestyle?rowNumber=${maxRows}`,
      sql,
      'text/plain',
      'application/xml, application/vnd.sap.adt.datapreview.table.v1+xml'
    )
    return parseDataPreview(xml)
  }

  async runDumpClass(className: string): Promise<string | null> {
    if (!ORG_DUMP_CLASSES.includes(className)) return null
    try {
      return await this.post(
        `/sap/bc/adt/oo/classrun/${encodeURIComponent(className.toLowerCase())}`,
        '',
        'text/plain',
        'text/plain'
      )
    } catch {
      // Class absent, not a classrun, or no authority. The freestyle path covers it.
      return null
    }
  }
}

function explainNetworkError(err: unknown, host: string, port: number): string {
  const code = errorCode(err)
  const where = `${host}:${port}`
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `Cannot resolve ${host}. If this is an on-prem hostname, the deployed app cannot see it - register the system in bridge mode instead.`
  }
  if (code === 'ECONNREFUSED') return `Nothing is listening on ${where}.`
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return `Timed out reaching ${where}. On-prem hosts are not reachable from the deployed app - use bridge mode.`
  }
  if (code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code === 'SELF_SIGNED_CERT_IN_CHAIN') {
    return `${where} presents a self-signed certificate that this runtime will not trust.`
  }
  const raw = err instanceof Error ? err.message : String(err)
  return `Unable to reach ${where}: ${raw}`
}

function errorCode(err: unknown): string | null {
  let cur: unknown = err
  for (let i = 0; i < 4 && cur && typeof cur === 'object'; i++) {
    const c = (cur as { code?: unknown }).code
    if (typeof c === 'string') return c
    cur = (cur as { cause?: unknown }).cause
  }
  return null
}
