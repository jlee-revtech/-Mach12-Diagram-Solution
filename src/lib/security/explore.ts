// ─── Read-only exploration engine (SERVER ONLY) ────────────
// Reconnaissance of a system the operator declares they administer. This module
// is imported by API routes and agent tools only — it uses node:fs and global
// fetch and must never reach a browser bundle.
//
// GUARDRAILS (hard-coded here, never weakened by a caller):
//  1. READ-ONLY. GET/HEAD only. Never authenticates, never submits a form or a
//     credential, never POSTs, never attempts an auth bypass, never exploits a
//     finding, never touches a host that was not derived from the registered
//     base URL.
//  2. HTTP caps: MAX_REQUESTS (12) per exploration, HTTP_TIMEOUT_MS (8s) each,
//     MAX_REDIRECTS (3) followed manually, same-origin only (off-origin
//     redirects are dropped and reported), MAX_BODY_BYTES (512 KB) body cap,
//     honest `unreachable[]`.
//  3. Source caps: SKIP_DIRS are never descended, MAX_FILES (1500) read,
//     MAX_FILE_BYTES (256 KB) per file, only ALLOWED_EXTS / ALLOWED_BASENAMES.
//     .env, .env.* (except .env.example), *.pem and *.key are hard-denied.
//  4. SECRETS: a probable secret becomes a RISK carrying file + line and a
//     REDACTED fingerprint (first 4 chars + length). The value itself is never
//     stored, returned, logged or echoed — it exists only inside
//     `fingerprint()` and is discarded there.
//
// Honest degradation: everything unreachable/unscannable is reported; nothing
// is ever fabricated.

import { readFile, readdir, stat } from 'node:fs/promises'
import { join, extname, basename, relative, sep } from 'node:path'

import type { DiscoveredRole, ExploreRisk, ExplorationFindings } from './types'

// ─── Caps ──────────────────────────────────────────────

const MAX_REQUESTS = 12
const HTTP_TIMEOUT_MS = 8_000
const MAX_REDIRECTS = 3
const MAX_BODY_BYTES = 512 * 1024

const MAX_FILES = 1500
const MAX_FILE_BYTES = 256 * 1024
const MAX_LINE_CHARS = 2_000        // skip minified blobs: no useful signal, and unbounded regex cost
const MAX_ROLES = 80
const MAX_PERMISSIONS = 200
const MAX_EVIDENCE = 80
const MAX_MATCHES_PER_PATTERN = 40

const SECURITY_HEADER_KEYS = [
  'content-security-policy',
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
] as const

// Bounded probe list — guardrail 1: nothing outside this list is ever requested.
const PROBE_PATHS = [
  '',
  '/login',
  '/signin',
  '/admin',
  '/api',
  '/health',
  '/robots.txt',
  '/.well-known/openid-configuration',
] as const

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'vendor'])

const ALLOWED_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.java', '.cs',
  '.rb', '.php', '.sql', '.json', '.yaml', '.yml', '.toml', '.md',
])

// Dependency manifests carry the framework/auth-library signal the contract asks
// for but do not all land in ALLOWED_EXTS (requirements.txt, go.mod, *.csproj).
// They are allowed by exact basename / .csproj only — this never widens to the
// denied files below.
const ALLOWED_BASENAMES = new Set([
  'package.json', 'requirements.txt', 'go.mod', 'pyproject.toml', 'composer.json', 'gemfile', '.env.example',
])

/** Hard deny — checked before anything else, on every candidate file. */
function isDeniedFile(name: string): boolean {
  const lower = name.toLowerCase()
  if (lower === '.env') return true
  if (lower.startsWith('.env') && lower !== '.env.example') return true // .env.local, .env.production, …
  if (lower.endsWith('.pem') || lower.endsWith('.key')) return true
  return false
}

function isScannable(name: string): boolean {
  if (isDeniedFile(name)) return false
  const lower = name.toLowerCase()
  if (ALLOWED_BASENAMES.has(lower)) return true
  if (lower.endsWith('.csproj')) return true
  return ALLOWED_EXTS.has(extname(lower))
}

// ─── Shared helpers ────────────────────────────────────

function clampList<T>(items: T[], cap: number): T[] {
  return items.length > cap ? items.slice(0, cap) : items
}

function risk(id: string, severity: ExploreRisk['severity'], title: string, detail: string, evidence?: string): ExploreRisk {
  return evidence ? { id, severity, title, detail, evidence } : { id, severity, title, detail }
}

/**
 * Guardrail 4. The only place a probable secret value is ever touched. Returns
 * first 4 chars + length (e.g. "sk-a… (len 51)"); the value is discarded here
 * and never leaves this function.
 */
function fingerprint(value: string): string {
  return `${value.slice(0, 4)}… (len ${value.length})`
}

// ─── URL exploration ───────────────────────────────────

interface HttpResult {
  url: string
  status: number
  headers: Headers
  body: string
  setCookies: string[]
}

function setCookiesOf(h: Headers): string[] {
  const maybe = h as unknown as { getSetCookie?: () => string[] }
  if (typeof maybe.getSetCookie === 'function') return maybe.getSetCookie()
  const raw = h.get('set-cookie')
  return raw ? [raw] : []
}

/** Read at most MAX_BODY_BYTES, then cancel the stream. */
async function readCappedBody(res: Response): Promise<string> {
  const body = res.body
  if (!body) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < MAX_BODY_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      if (value && value.byteLength > 0) {
        chunks.push(value)
        total += value.byteLength
      }
    }
  } catch {
    // partial body is still useful — fall through with what we have
  } finally {
    try { await reader.cancel() } catch { /* already closed */ }
  }
  const size = Math.min(total, MAX_BODY_BYTES)
  const buf = new Uint8Array(size)
  let off = 0
  for (const c of chunks) {
    if (off >= size) break
    const take = Math.min(c.byteLength, size - off)
    buf.set(c.subarray(0, take), off)
    off += take
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buf)
}

/** Budgeted, same-origin, manually-redirected GET/HEAD. Never sends credentials. */
class HttpBudget {
  private used = 0
  readonly unreachable: string[] = []
  private readonly origin: string

  constructor(origin: string) {
    this.origin = origin
  }

  get requestsUsed(): number { return this.used }
  get exhausted(): boolean { return this.used >= MAX_REQUESTS }

  async get(url: string, method: 'GET' | 'HEAD' = 'GET'): Promise<HttpResult | null> {
    let target = url
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (this.exhausted) {
        this.unreachable.push(`${target} — request cap of ${MAX_REQUESTS} reached, not fetched`)
        return null
      }
      this.used++
      let res: Response
      try {
        res = await fetch(target, {
          method,
          redirect: 'manual',
          // No cookies, no auth, no body — guardrail 1.
          credentials: 'omit',
          headers: { 'Accept': '*/*', 'User-Agent': 'Mach12-SecurityGovernance/1.0 (read-only recon)' },
          signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.unreachable.push(`${target} — ${msg}`)
        return null
      }

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        try { await res.body?.cancel() } catch { /* ignore */ }
        if (!loc) return { url: target, status: res.status, headers: res.headers, body: '', setCookies: setCookiesOf(res.headers) }
        let next: URL
        try { next = new URL(loc, target) } catch {
          this.unreachable.push(`${target} — unparseable redirect target`)
          return null
        }
        if (next.origin !== this.origin) {
          // Guardrail 2: same-origin only. Off-host redirects are dropped, not followed.
          this.unreachable.push(`${target} — redirected off-origin to ${next.origin} (dropped, same-origin only)`)
          return null
        }
        target = next.toString()
        continue
      }

      const body = method === 'HEAD' ? '' : await readCappedBody(res)
      return { url: target, status: res.status, headers: res.headers, body, setCookies: setCookiesOf(res.headers) }
    }
    this.unreachable.push(`${url} — exceeded ${MAX_REDIRECTS} redirects`)
    return null
  }
}

function looksLikeLoginForm(html: string): boolean {
  return /type=["']password["']/i.test(html) || /name=["'](password|passwd|pwd)["']/i.test(html)
}

function detectFrameworkFromHttp(r: HttpResult): string | undefined {
  const powered = r.headers.get('x-powered-by')
  if (powered) return powered
  const gen = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']{1,80})["']/i.exec(r.body)
  if (gen) return gen[1]
  if (r.body.includes('__NEXT_DATA__') || r.headers.get('x-nextjs-cache')) return 'Next.js'
  if (/<div[^>]+id=["']root["']/.test(r.body) && r.body.includes('/static/js/')) return 'React (CRA-style bundle)'
  if (r.headers.get('x-aspnet-version')) return 'ASP.NET'
  return undefined
}

const COOKIE_FRAMEWORK_HINTS: { re: RegExp; label: string }[] = [
  { re: /^JSESSIONID=/i, label: 'Java servlet session (JSESSIONID)' },
  { re: /^ASP\.NET_SessionId=/i, label: 'ASP.NET session cookie' },
  { re: /^connect\.sid=/i, label: 'Express session cookie (connect.sid)' },
  { re: /^next-auth\./i, label: 'NextAuth session cookie' },
  { re: /^__Secure-authjs\.|^authjs\./i, label: 'Auth.js session cookie' },
  { re: /^laravel_session=/i, label: 'Laravel session cookie' },
  { re: /^sessionid=/i, label: 'Django session cookie' },
  { re: /^sap-usercontext=/i, label: 'SAP user context cookie' },
]

export async function exploreUrl(baseUrl: string): Promise<Partial<ExplorationFindings>> {
  const notes: string[] = []
  const risks: ExploreRisk[] = []
  const evidence: ExplorationFindings['evidence'] = []
  const surfaces: ExplorationFindings['surfaces'] = []
  const permissions = new Set<string>()
  const roles = new Map<string, DiscoveredRole>()
  const cookieFlags: string[] = []
  const securityHeaders: Record<string, string | null> = {}
  for (const k of SECURITY_HEADER_KEYS) securityHeaders[k] = null

  let base: URL
  try {
    base = new URL(baseUrl)
  } catch {
    return {
      authModel: { mfa: null, notes: [`Base URL "${baseUrl}" is not a valid URL — nothing was requested.`] },
      unreachable: [`${baseUrl} — invalid URL`],
      scanned: { urls: 0, files: 0 },
      risks: [], evidence: [], surfaces: [], discoveredRoles: [], permissions: [],
    }
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    return {
      authModel: { mfa: null, notes: [`Base URL scheme "${base.protocol}" is not http(s) — nothing was requested.`] },
      unreachable: [`${baseUrl} — unsupported scheme ${base.protocol}`],
      scanned: { urls: 0, files: 0 },
      risks: [], evidence: [], surfaces: [], discoveredRoles: [], permissions: [],
    }
  }

  const budget = new HttpBudget(base.origin)
  const results = new Map<string, HttpResult>()
  let reached = 0

  for (const path of PROBE_PATHS) {
    if (budget.exhausted) {
      budget.unreachable.push(`${base.origin}${path || '/'} — request cap of ${MAX_REQUESTS} reached, not fetched`)
      continue
    }
    const url = new URL(path || '/', base).toString()
    const r = await budget.get(url)
    if (!r) continue
    reached++
    results.set(path, r)
  }

  const root = results.get('')
  if (!root && reached === 0) {
    notes.push('No probe returned a response — see unreachable for why.')
  }

  // ── Security headers + cookie posture (from the first response we got) ──
  const headerSource = root ?? results.values().next().value
  if (headerSource) {
    for (const k of SECURITY_HEADER_KEYS) securityHeaders[k] = headerSource.headers.get(k)
    evidence.push({ kind: 'url', ref: headerSource.url, note: `HTTP ${headerSource.status}; security headers read` })
  }

  const allCookies: string[] = []
  for (const r of results.values()) allCookies.push(...r.setCookies)
  const cookiesMissingHttpOnly: string[] = []
  const cookiesMissingSecure: string[] = []
  const cookiesMissingSameSite: string[] = []
  for (const c of allCookies) {
    const name = c.split('=')[0]?.trim() ?? '(unnamed)'
    const hasHttpOnly = /;\s*HttpOnly/i.test(c)
    const hasSecure = /;\s*Secure/i.test(c)
    const sameSite = /;\s*SameSite=([A-Za-z]+)/i.exec(c)
    cookieFlags.push(`${name}: ${hasHttpOnly ? 'HttpOnly' : 'no-HttpOnly'}, ${hasSecure ? 'Secure' : 'no-Secure'}, SameSite=${sameSite ? sameSite[1] : 'unset'}`)
    if (!hasHttpOnly) cookiesMissingHttpOnly.push(name)
    if (!hasSecure) cookiesMissingSecure.push(name)
    if (!sameSite) cookiesMissingSameSite.push(name)
    for (const hint of COOKIE_FRAMEWORK_HINTS) {
      if (hint.re.test(c) && !notes.includes(hint.label)) notes.push(hint.label)
    }
  }

  // ── Auth mechanism ──
  let mechanism: string | undefined
  let idp: string | undefined
  let mfa: boolean | null = null

  const oidc = results.get('/.well-known/openid-configuration')
  let oidcOk = false
  if (oidc && oidc.status === 200) {
    try {
      const doc = JSON.parse(oidc.body) as Record<string, unknown>
      if (typeof doc.issuer === 'string' || Array.isArray(doc.scopes_supported)) {
        oidcOk = true
        mechanism = 'OpenID Connect (OIDC discovery document served)'
        if (typeof doc.issuer === 'string') {
          idp = doc.issuer
          notes.push(`OIDC issuer: ${doc.issuer}`)
        }
        if (Array.isArray(doc.scopes_supported)) {
          for (const s of doc.scopes_supported) {
            if (typeof s === 'string' && s.length <= 64) permissions.add(s)
          }
        }
        const acr = doc.acr_values_supported
        if (Array.isArray(acr) && acr.some(v => typeof v === 'string' && /mfa|multi.?factor|loa[23]|aal[23]/i.test(v))) {
          mfa = true
          notes.push('OIDC advertises MFA-capable acr values.')
        }
        evidence.push({ kind: 'url', ref: oidc.url, note: 'OIDC discovery document' })
      }
    } catch {
      notes.push('/.well-known/openid-configuration responded 200 but was not parseable JSON.')
    }
  }

  for (const r of results.values()) {
    const wwwAuth = r.headers.get('www-authenticate')
    if (wwwAuth) {
      const scheme = wwwAuth.split(/[\s,]/)[0]
      if (!mechanism) mechanism = `HTTP auth challenge (${scheme})`
      notes.push(`WWW-Authenticate on ${r.url}: ${scheme}`)
      break
    }
  }

  const htmlBodies = [...results.values()].filter(r => !r.url.endsWith('robots.txt'))
  const samlHit = htmlBodies.find(r => /SAMLRequest|urn:oasis:names:tc:SAML|\/saml2?\//i.test(r.body))
  if (samlHit) {
    if (!mechanism || mechanism.startsWith('HTTP auth challenge')) mechanism = 'SAML 2.0 (SAML markers in served HTML)'
    notes.push(`SAML markers observed at ${samlHit.url}`)
    evidence.push({ kind: 'url', ref: samlHit.url, note: 'SAML markers in HTML' })
  }
  const oauthHit = htmlBodies.find(r => /\/oauth2?\/authorize|response_type=code|client_id=/i.test(r.body))
  if (oauthHit && !mechanism) {
    mechanism = 'OAuth 2.0 / OIDC redirect (authorize markers in served HTML)'
    evidence.push({ kind: 'url', ref: oauthHit.url, note: 'OAuth authorize markers in HTML' })
  }

  const loginPage = ['/login', '/signin', ''].map(p => results.get(p)).find(r => !!r && looksLikeLoginForm(r.body))
  if (loginPage) {
    if (!mechanism) mechanism = 'Form login (password field served)'
    notes.push(`Password form field observed at ${loginPage.url} (form was NOT submitted).`)
    evidence.push({ kind: 'url', ref: loginPage.url, note: 'password input present' })
    if (/two.?factor|multi.?factor|\bMFA\b|authenticator|one.?time code/i.test(loginPage.body)) {
      mfa = true
      notes.push('Login page references a second factor.')
    }
  }
  if (!mechanism) notes.push('No auth mechanism could be determined from the responses that were reachable.')

  // ── Surfaces ──
  const SURFACE_KINDS: Record<string, 'admin' | 'app' | 'api' | 'login'> = {
    '': 'app', '/login': 'login', '/signin': 'login', '/admin': 'admin', '/api': 'api', '/health': 'api',
  }
  for (const [path, r] of results) {
    if (path === '/robots.txt' || path === '/.well-known/openid-configuration') continue
    if (r.status >= 400) continue
    surfaces.push({
      label: path === '' ? 'Application root' : path,
      url: r.url,
      kind: SURFACE_KINDS[path] ?? 'app',
      notes: `HTTP ${r.status}`,
    })
  }
  const robots = results.get('/robots.txt')
  if (robots && robots.status === 200) {
    const disallowed = [...robots.body.matchAll(/^\s*Disallow:\s*(\S+)/gim)].slice(0, 20).map(m => m[1])
    if (disallowed.length > 0) {
      notes.push(`robots.txt discloses ${disallowed.length} disallowed path(s): ${disallowed.slice(0, 8).join(', ')}`)
      evidence.push({ kind: 'url', ref: robots.url, note: 'robots.txt disallow list' })
    }
  }

  // ── Risks ──
  if (headerSource) {
    if (base.protocol === 'https:' && !securityHeaders['strict-transport-security']) {
      risks.push(risk('url-missing-hsts', 'medium', 'No HSTS header',
        'Responses carry no Strict-Transport-Security header, so a browser may be downgraded to HTTP on a first or stale visit.',
        headerSource.url))
    }
    if (!securityHeaders['content-security-policy']) {
      risks.push(risk('url-missing-csp', 'medium', 'No Content-Security-Policy',
        'No CSP header was returned; injected script has no browser-side containment.',
        headerSource.url))
    }
    if (!securityHeaders['x-frame-options'] && !/frame-ancestors/i.test(securityHeaders['content-security-policy'] ?? '')) {
      risks.push(risk('url-missing-frame-ancestors', 'low', 'No clickjacking protection',
        'Neither X-Frame-Options nor a CSP frame-ancestors directive was returned.',
        headerSource.url))
    }
  }
  if (cookiesMissingHttpOnly.length > 0) {
    risks.push(risk('url-cookie-no-httponly', 'high', 'Cookie set without HttpOnly',
      `Cookie(s) ${cookiesMissingHttpOnly.join(', ')} are readable by page script; if any is a session cookie, XSS becomes session theft.`))
  }
  if (cookiesMissingSecure.length > 0 && base.protocol === 'https:') {
    risks.push(risk('url-cookie-no-secure', 'high', 'Cookie set without Secure',
      `Cookie(s) ${cookiesMissingSecure.join(', ')} may be sent over plaintext HTTP.`))
  }
  if (cookiesMissingSameSite.length > 0) {
    risks.push(risk('url-cookie-no-samesite', 'medium', 'Cookie set without SameSite',
      `Cookie(s) ${cookiesMissingSameSite.join(', ')} carry no SameSite attribute, widening CSRF exposure.`))
  }
  const admin = results.get('/admin')
  if (admin && admin.status === 200 && !admin.headers.get('www-authenticate') && !looksLikeLoginForm(admin.body)) {
    risks.push(risk('url-admin-open', 'high', 'Admin surface answers 200 with no auth challenge',
      '/admin returned 200 with neither a WWW-Authenticate challenge nor a login form. A single-page-app shell can legitimately return 200 for an unauthenticated route, so confirm manually before treating this as exposure — this scan never authenticated and never probed past the response.',
      admin.url))
  }
  if (!oidcOk && loginPage) {
    risks.push(risk('url-local-accounts', 'medium', 'Local accounts, no federated identity discovered',
      'A password form is served and no OIDC discovery document was found, which points at locally-managed credentials rather than the enterprise IdP.',
      loginPage.url))
  }

  return {
    authModel: mechanism ? { mechanism, idp, mfa, notes } : { mfa, notes },
    discoveredRoles: [...roles.values()],
    permissions: clampList([...permissions], MAX_PERMISSIONS),
    surfaces,
    posture: {
      securityHeaders,
      cookieFlags,
      framework: headerSource ? detectFrameworkFromHttp(headerSource) : undefined,
      authLibraries: [],
    },
    risks,
    evidence: clampList(evidence, MAX_EVIDENCE),
    unreachable: budget.unreachable,
    scanned: { urls: reached, files: 0 },
  }
}

// ─── Source exploration ────────────────────────────────

interface ScanFile { abs: string; rel: string }

async function collectFiles(rootPath: string, unreachable: string[]): Promise<{ files: ScanFile[]; capped: boolean }> {
  const files: ScanFile[] = []
  const queue: string[] = [rootPath]
  let capped = false

  while (queue.length > 0) {
    const dir = queue.shift()!
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      unreachable.push(`dir: ${relative(rootPath, dir) || '.'} — ${msg}`)
      continue
    }
    for (const e of entries) {
      // Symlinks are never followed: they can escape the declared root or loop.
      if (e.isSymbolicLink()) continue
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue
        queue.push(join(dir, e.name))
        continue
      }
      if (!e.isFile()) continue
      if (!isScannable(e.name)) continue
      if (files.length >= MAX_FILES) { capped = true; continue }
      const abs = join(dir, e.name)
      files.push({ abs, rel: relative(rootPath, abs).split(sep).join('/') })
    }
    if (capped) break
  }
  if (capped) unreachable.push(`source: file cap of ${MAX_FILES} reached — remaining files were not scanned`)
  return { files, capped }
}

// ── Secret patterns (guardrail 4) ──
const SECRET_PATTERNS: { id: string; label: string; re: RegExp; group: number }[] = [
  { id: 'anthropic-openai-key', label: 'API key (sk-… form)', re: /\b(sk-[A-Za-z0-9_-]{16,})/g, group: 1 },
  { id: 'aws-access-key', label: 'AWS access key id', re: /\b(AKIA[0-9A-Z]{16})\b/g, group: 1 },
  { id: 'google-api-key', label: 'Google API key', re: /\b(AIza[0-9A-Za-z_-]{35})\b/g, group: 1 },
  { id: 'github-token', label: 'GitHub token', re: /\b(gh[pousr]_[A-Za-z0-9]{20,})\b/g, group: 1 },
  { id: 'slack-token', label: 'Slack token', re: /\b(xox[baprs]-[A-Za-z0-9-]{10,})/g, group: 1 },
  { id: 'jwt', label: 'JSON Web Token', re: /\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,})/g, group: 1 },
  { id: 'private-key', label: 'PEM private key block', re: /(-----BEGIN [A-Z ]{0,20}PRIVATE KEY-----)/g, group: 1 },
  {
    id: 'assigned-credential',
    label: 'Assigned credential literal',
    re: /(?:password|passwd|secret|token|api[_-]?key|apikey|access[_-]?key|client[_-]?secret)["']?\s*[:=]\s*["']([^"'\n]{8,120})["']/gi,
    group: 1,
  },
]

// Values that look like credentials but are placeholders/references, not secrets.
const PLACEHOLDER_RE = /^(?:\$\{|process\.env|os\.environ|env\.|<|\{\{|your[_-]|xxx|change.?me|placeholder|example|dummy|test|sample|redacted|null|undefined|true|false|\*+)/i

function isProbablePlaceholder(value: string): boolean {
  if (PLACEHOLDER_RE.test(value)) return true
  if (/^[A-Z0-9_]{4,}$/.test(value) && !/\d{6,}/.test(value)) return true // ENV_VAR_NAME style
  if (/\s/.test(value)) return true
  return false
}

// ── RBAC signal patterns ──
const ROLE_LITERAL_PATTERNS: RegExp[] = [
  /\brole\s*(?:===?|==|!=|!==)\s*["']([A-Za-z][\w .:-]{1,48})["']/g,
  /\bhasRole\s*\(\s*["']([A-Za-z][\w .:-]{1,48})["']/g,
  /\bhasAnyRole\s*\(\s*["']([A-Za-z][\w .:-]{1,48})["']/g,
  /\brequireRole\s*\(\s*["']([A-Za-z][\w .:-]{1,48})["']/g,
  /@PreAuthorize\s*\(\s*"[^"]{0,40}hasRole\('([A-Za-z][\w .:-]{1,48})'\)/g,
  /@RolesAllowed\s*\(\s*\{?\s*"([A-Za-z][\w .:-]{1,48})"/g,
  /\bcreate\s+role\s+"?([A-Za-z_][\w$]{1,48})"?/gi,
  /\bgrant\s+[\w, ]{1,80}\s+on\s+[\w."]{1,80}\s+to\s+"?([A-Za-z_][\w$]{1,48})"?/gi,
]

const ROLE_BLOCK_PATTERNS: RegExp[] = [
  /\btype\s+\w*Role\w*\s*=\s*([^;\n]{0,400})/g,
  /\b(?:ROLES|Roles|roles|ALLOWED_ROLES|USER_ROLES|APP_ROLES)\s*[:=]\s*\[([^\]]{0,600})\]/g,
  /\benum\s+\w*Role\w*\s*\{([^}]{0,600})\}/g,
]

const PERMISSION_BLOCK_PATTERNS: RegExp[] = [
  /\b(?:PERMISSIONS|Permissions|permissions|SCOPES|scopes)\s*[:=]\s*\[([^\]]{0,800})\]/g,
]

const PERMISSION_LITERAL_PATTERNS: RegExp[] = [
  /["']([a-z][a-z0-9_]{1,24}[:.][a-z0-9_.:*-]{2,40})["']/g,
  /\bcan\s*\(\s*["']([a-z][\w.:*-]{2,48})["']/g,
  /\brequirePermission\s*\(\s*["']([A-Za-z][\w.:*-]{2,48})["']/g,
]

const AUTHZ_MIDDLEWARE_RE = /\b(?:requireAuth|requireRole|requirePermission|hasRole|hasPermission|authorize|authGuard|withAuth|ensureAuthenticated|isAuthenticated|passport\.authenticate|login_required|permission_classes|before_action\s*:\s*authenticate|@PreAuthorize|@RolesAllowed|AuthorizeAttribute|\[Authorize\]|casbin|middleware\.\w*[Aa]uth)/
const AUDIT_RE = /\b(?:audit_?log|auditLog|auditTrail|audit_event|writeAudit|security_?event|\baudit\b)/i
const SQL_STMT_RE = /\b(?:select|insert\s+into|update|delete\s+from)\b/i
const SQL_INTERP_RE = /(?:\$\{[^}]{1,80}\}|["']\s*\+\s*\w+|%s|f["'][^"'\n]{0,120}\{)/
const AUTH_CONTEXT_RE = /\b(?:user|role|permission|auth|session|password|login|token|account)\b/i

const AUTH_LIB_HINTS: { match: string; label: string }[] = [
  { match: 'next-auth', label: 'NextAuth' },
  { match: '@auth/core', label: 'Auth.js' },
  { match: 'passport', label: 'Passport' },
  { match: 'jsonwebtoken', label: 'jsonwebtoken (JWT)' },
  { match: 'jose', label: 'jose (JOSE/JWT)' },
  { match: 'bcrypt', label: 'bcrypt password hashing' },
  { match: 'argon2', label: 'argon2 password hashing' },
  { match: 'auth0', label: 'Auth0' },
  { match: 'okta', label: 'Okta' },
  { match: 'keycloak', label: 'Keycloak' },
  { match: 'msal', label: 'Microsoft MSAL' },
  { match: 'microsoft.identity', label: 'Microsoft.Identity.Web' },
  { match: '@supabase/supabase-js', label: 'Supabase auth/RLS' },
  { match: 'casbin', label: 'Casbin policy engine' },
  { match: 'accesscontrol', label: 'AccessControl RBAC' },
  { match: 'oso', label: 'Oso authorization' },
  { match: 'clerk', label: 'Clerk' },
  { match: 'firebase-admin', label: 'Firebase Admin auth' },
  { match: 'django-allauth', label: 'django-allauth' },
  { match: 'flask-login', label: 'Flask-Login' },
  { match: 'authlib', label: 'Authlib' },
  { match: 'pyjwt', label: 'PyJWT' },
  { match: 'spring-boot-starter-security', label: 'Spring Security' },
  { match: 'golang-jwt', label: 'golang-jwt' },
  { match: 'devise', label: 'Devise' },
  { match: 'identityserver', label: 'IdentityServer' },
  { match: 'duende', label: 'Duende IdentityServer' },
]

const FRAMEWORK_HINTS: { match: string; label: string }[] = [
  { match: '@nestjs/core', label: 'NestJS' },
  { match: 'next', label: 'Next.js' },
  { match: 'express', label: 'Express' },
  { match: 'fastify', label: 'Fastify' },
  { match: '@angular/core', label: 'Angular' },
  { match: 'svelte', label: 'Svelte' },
  { match: 'vue', label: 'Vue' },
  { match: 'react', label: 'React' },
  { match: 'django', label: 'Django' },
  { match: 'flask', label: 'Flask' },
  { match: 'fastapi', label: 'FastAPI' },
  { match: 'github.com/gin-gonic/gin', label: 'Gin (Go)' },
  { match: 'github.com/labstack/echo', label: 'Echo (Go)' },
  { match: 'spring-boot', label: 'Spring Boot' },
  { match: 'laravel/framework', label: 'Laravel' },
  { match: 'rails', label: 'Ruby on Rails' },
]

function extractQuoted(block: string, cap: number): string[] {
  const out: string[] = []
  const re = /["']([^"'\n]{1,64})["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null && out.length < cap) out.push(m[1])
  return out
}

function cleanRoleName(raw: string): string | null {
  const v = raw.trim().replace(/^["']|["']$/g, '')
  if (v.length < 2 || v.length > 48) return null
  if (!/^[A-Za-z][A-Za-z0-9 ._:-]*$/.test(v)) return null
  return v
}

function cleanPermission(raw: string): string | null {
  const v = raw.trim()
  if (v.length < 3 || v.length > 64) return null
  if (!/^[A-Za-z][A-Za-z0-9 ._:*-]*$/.test(v)) return null
  return v
}

interface ManifestSignals { framework?: string; authLibraries: Set<string> }

function readManifestSignals(rel: string, content: string, sig: ManifestSignals): void {
  const base = basename(rel).toLowerCase()
  let tokens: string[] = []
  if (base === 'package.json' || base === 'composer.json') {
    try {
      const doc = JSON.parse(content) as Record<string, unknown>
      for (const field of ['dependencies', 'devDependencies', 'require', 'require-dev']) {
        const deps = doc[field]
        if (deps && typeof deps === 'object') tokens.push(...Object.keys(deps as Record<string, unknown>))
      }
    } catch { /* unparseable manifest — no signal, no fabrication */ }
  } else if (base === 'requirements.txt' || base === 'go.mod' || base === 'pyproject.toml' || base === 'gemfile' || base.endsWith('.csproj')) {
    tokens = content.split(/\r?\n/).slice(0, 800).map(l => l.trim())
    if (base.endsWith('.csproj')) {
      tokens = [...content.matchAll(/Include="([^"]{1,80})"/g)].slice(0, 300).map(m => m[1])
    }
  } else {
    return
  }
  const lowered = tokens.map(t => t.toLowerCase())
  for (const hint of AUTH_LIB_HINTS) {
    if (lowered.some(t => t.includes(hint.match))) sig.authLibraries.add(hint.label)
  }
  if (!sig.framework) {
    for (const hint of FRAMEWORK_HINTS) {
      if (lowered.some(t => t === hint.match || t.startsWith(`${hint.match}@`) || t.startsWith(`${hint.match}==`) || t.startsWith(`${hint.match}>=`) || t.includes(hint.match))) {
        sig.framework = hint.label
        break
      }
    }
  }
}

export async function exploreSource(rootPath: string): Promise<Partial<ExplorationFindings>> {
  const unreachable: string[] = []
  const risks: ExploreRisk[] = []
  const evidence: ExplorationFindings['evidence'] = []
  const notes: string[] = []
  const roles = new Map<string, DiscoveredRole>()
  const permissions = new Set<string>()
  const sig: ManifestSignals = { authLibraries: new Set<string>() }

  let rootOk = false
  try {
    const st = await stat(rootPath)
    rootOk = st.isDirectory()
    if (!rootOk) unreachable.push(`source: ${rootPath} is not a directory`)
  } catch (err) {
    unreachable.push(`source: ${rootPath} — ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!rootOk) {
    return {
      authModel: { mfa: null, notes: [`Source path "${rootPath}" could not be opened — nothing was scanned.`] },
      discoveredRoles: [], permissions: [], surfaces: [],
      posture: { securityHeaders: {}, cookieFlags: [], authLibraries: [] },
      risks: [], evidence: [], unreachable, scanned: { urls: 0, files: 0 },
    }
  }

  const { files } = await collectFiles(rootPath, unreachable)

  let filesRead = 0
  let authzSignalFiles = 0
  let auditSignalFiles = 0
  let roleLiteralFiles = 0
  const secretSeen = new Set<string>()
  const sqlInterpHits: string[] = []

  for (const f of files) {
    let size = 0
    try {
      const st = await stat(f.abs)
      size = st.size
    } catch (err) {
      unreachable.push(`file: ${f.rel} — ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
    if (size > MAX_FILE_BYTES) {
      unreachable.push(`file: ${f.rel} — ${Math.round(size / 1024)} KB exceeds the ${MAX_FILE_BYTES / 1024} KB per-file scan cap`)
      continue
    }
    let content: string
    try {
      content = await readFile(f.abs, 'utf8')
    } catch (err) {
      unreachable.push(`file: ${f.rel} — ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
    filesRead++

    readManifestSignals(f.rel, content, sig)

    // ── Role signals ──
    let fileHasRoleLiteral = false
    for (const re of ROLE_LITERAL_PATTERNS) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      let n = 0
      while ((m = re.exec(content)) !== null && n < MAX_MATCHES_PER_PATTERN) {
        n++
        const name = cleanRoleName(m[1])
        if (!name) continue
        fileHasRoleLiteral = true
        if (roles.size < MAX_ROLES && !roles.has(name.toLowerCase())) {
          roles.set(name.toLowerCase(), { name, source: 'source', description: `Observed in ${f.rel}` })
        }
      }
    }
    for (const re of ROLE_BLOCK_PATTERNS) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      let n = 0
      while ((m = re.exec(content)) !== null && n < MAX_MATCHES_PER_PATTERN) {
        n++
        const raw = m[1]
        const values = raw.includes('"') || raw.includes("'")
          ? extractQuoted(raw, 40)
          : raw.split(/[,|=]/).map(s => s.trim()).slice(0, 40)
        for (const v of values) {
          const name = cleanRoleName(v)
          if (!name) continue
          fileHasRoleLiteral = true
          if (roles.size < MAX_ROLES && !roles.has(name.toLowerCase())) {
            roles.set(name.toLowerCase(), { name, source: 'source', description: `Enumerated in ${f.rel}` })
          }
        }
      }
    }
    if (fileHasRoleLiteral) {
      roleLiteralFiles++
      if (evidence.length < MAX_EVIDENCE) evidence.push({ kind: 'file', ref: f.rel, note: 'role literals' })
    }

    // ── Permission signals ──
    for (const re of PERMISSION_BLOCK_PATTERNS) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      let n = 0
      while ((m = re.exec(content)) !== null && n < MAX_MATCHES_PER_PATTERN) {
        n++
        for (const v of extractQuoted(m[1], 60)) {
          const p = cleanPermission(v)
          if (p && permissions.size < MAX_PERMISSIONS) permissions.add(p)
        }
      }
    }
    for (const re of PERMISSION_LITERAL_PATTERNS) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      let n = 0
      while ((m = re.exec(content)) !== null && n < MAX_MATCHES_PER_PATTERN) {
        n++
        const p = cleanPermission(m[1])
        if (p && permissions.size < MAX_PERMISSIONS) permissions.add(p)
      }
    }

    if (AUTHZ_MIDDLEWARE_RE.test(content)) authzSignalFiles++
    if (AUDIT_RE.test(content)) auditSignalFiles++

    // ── Line-level scan: secrets + SQL interpolation ──
    const lines = content.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.length > MAX_LINE_CHARS) continue // minified/bundled — skipped deliberately
      const lineNo = i + 1

      for (const pat of SECRET_PATTERNS) {
        pat.re.lastIndex = 0
        const m = pat.re.exec(line)
        if (!m) continue
        const value = m[pat.group]
        if (!value || isProbablePlaceholder(value)) continue
        // Guardrail 4: fingerprint here, then drop the value on the floor.
        const fp = fingerprint(value)
        const key = `${f.rel}:${lineNo}:${pat.id}`
        if (secretSeen.has(key)) continue
        secretSeen.add(key)
        risks.push(risk(
          `secret-${pat.id}-${secretSeen.size}`,
          'critical',
          `Probable secret in source: ${pat.label}`,
          `${f.rel}:${lineNo} contains a literal that matches ${pat.label}. The value was NOT stored, logged or returned — only this redacted fingerprint: ${fp}. Rotate the credential and move it to a secret store.`,
          `${f.rel}:${lineNo}`,
        ))
      }

      if (SQL_STMT_RE.test(line) && SQL_INTERP_RE.test(line) && AUTH_CONTEXT_RE.test(line)) {
        if (sqlInterpHits.length < 20) sqlInterpHits.push(`${f.rel}:${lineNo}`)
      }
    }
  }

  // ── Source-level risks ──
  if (filesRead > 0 && authzSignalFiles === 0) {
    risks.push(risk('src-no-authz-middleware', 'high', 'No authorization middleware or guard found',
      `No route guard, decorator or middleware matching the usual authorization idioms was found across ${filesRead} scanned file(s). Either enforcement lives outside the scanned tree or access is not enforced server-side.`))
  }
  if (filesRead > 0 && roleLiteralFiles > 0) {
    risks.push(risk('src-hardcoded-roles', 'medium', 'Roles are hardcoded in application code',
      `Role names appear as string literals in ${roleLiteralFiles} file(s), so role changes require a code change and cannot be governed centrally.`))
  }
  if (filesRead > 0 && auditSignalFiles === 0) {
    risks.push(risk('src-no-audit-logging', 'medium', 'No audit logging observed',
      `No audit/security-event logging idiom was found across ${filesRead} scanned file(s); privileged actions may leave no reviewable trail.`))
  }
  if (sqlInterpHits.length > 0) {
    risks.push(risk('src-sql-interpolation-auth', 'high', 'SQL built by string interpolation near auth data',
      `SQL statements are assembled with interpolation on lines that also reference user/role/session data (${sqlInterpHits.length} occurrence(s)). Injection here is an authorization bypass, not just a data leak.`,
      sqlInterpHits.slice(0, 5).join(', ')))
  }
  if (files.length === 0) {
    notes.push('No files matching the allowed extensions were found under the declared source path.')
  }
  notes.push(`Source scan read ${filesRead} of ${files.length} candidate file(s); .env*, *.pem and *.key are never read.`)

  return {
    authModel: { mfa: null, notes },
    discoveredRoles: [...roles.values()],
    permissions: clampList([...permissions], MAX_PERMISSIONS),
    surfaces: [],
    posture: {
      securityHeaders: {},
      cookieFlags: [],
      framework: sig.framework,
      authLibraries: [...sig.authLibraries],
    },
    risks,
    evidence: clampList(evidence, MAX_EVIDENCE),
    unreachable,
    scanned: { urls: 0, files: filesRead },
  }
}

// ─── Merge ─────────────────────────────────────────────

function emptyFindings(): ExplorationFindings {
  return {
    authModel: { mfa: null, notes: [] },
    discoveredRoles: [],
    permissions: [],
    surfaces: [],
    posture: { securityHeaders: {}, cookieFlags: [], authLibraries: [] },
    risks: [],
    evidence: [],
    unreachable: [],
    scanned: { urls: 0, files: 0 },
  }
}

function mergeInto(target: ExplorationFindings, part: Partial<ExplorationFindings>): void {
  if (part.authModel) {
    if (!target.authModel.mechanism && part.authModel.mechanism) target.authModel.mechanism = part.authModel.mechanism
    if (!target.authModel.idp && part.authModel.idp) target.authModel.idp = part.authModel.idp
    if (target.authModel.mfa == null && part.authModel.mfa != null) target.authModel.mfa = part.authModel.mfa
    target.authModel.notes.push(...part.authModel.notes)
  }
  for (const r of part.discoveredRoles ?? []) {
    const existing = target.discoveredRoles.find(x => x.name.toLowerCase() === r.name.toLowerCase())
    if (!existing) {
      if (target.discoveredRoles.length < MAX_ROLES) target.discoveredRoles.push(r)
      continue
    }
    if (r.permissions?.length) {
      const merged = new Set([...(existing.permissions ?? []), ...r.permissions])
      existing.permissions = [...merged]
    }
  }
  const perms = new Set([...target.permissions, ...(part.permissions ?? [])])
  target.permissions = clampList([...perms], MAX_PERMISSIONS)
  target.surfaces.push(...(part.surfaces ?? []))
  if (part.posture) {
    for (const [k, v] of Object.entries(part.posture.securityHeaders ?? {})) {
      if (target.posture.securityHeaders[k] == null) target.posture.securityHeaders[k] = v
    }
    target.posture.cookieFlags.push(...(part.posture.cookieFlags ?? []))
    // Source manifests beat an X-Powered-By guess, so a later part may overwrite.
    if (part.posture.framework) target.posture.framework = part.posture.framework
    const libs = new Set([...target.posture.authLibraries, ...(part.posture.authLibraries ?? [])])
    target.posture.authLibraries = [...libs]
  }
  target.risks.push(...(part.risks ?? []))
  target.evidence.push(...(part.evidence ?? []))
  target.unreachable.push(...(part.unreachable ?? []))
  target.scanned.urls += part.scanned?.urls ?? 0
  target.scanned.files += part.scanned?.files ?? 0
}

/**
 * Run the full read-only exploration. Always resolves to a COMPLETE
 * ExplorationFindings object — empty arrays and honest scanned/unreachable
 * counts rather than a thrown error or a fabricated finding.
 */
export async function runExploration(input: { baseUrl?: string; sourcePath?: string }): Promise<ExplorationFindings> {
  const findings = emptyFindings()
  const baseUrl = input.baseUrl?.trim()
  const sourcePath = input.sourcePath?.trim()

  if (!baseUrl && !sourcePath) {
    findings.authModel.notes.push('No base URL and no source path were provided — nothing was explored.')
    return findings
  }

  if (baseUrl) {
    try {
      mergeInto(findings, await exploreUrl(baseUrl))
    } catch (err) {
      findings.unreachable.push(`${baseUrl} — URL exploration failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (sourcePath) {
    try {
      mergeInto(findings, await exploreSource(sourcePath))
    } catch (err) {
      findings.unreachable.push(`source: ${sourcePath} — source scan failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  findings.evidence = clampList(findings.evidence, MAX_EVIDENCE)
  return findings
}
