import { createClient } from './client'

// Every REST call in the data layer goes through sbFetch. Plain fetch() has no
// timeout: a stalled socket (flaky wifi, VPN, a QUIC blackhole) leaves the
// promise pending for minutes. Loaders await Promise.all over several calls and
// flip `loading` off afterwards, so one stalled socket reads to the user as a
// spinner that never resolves.
const DEFAULT_TIMEOUT_MS = 20_000

function isIdempotent(init: RequestInit): boolean {
  const m = (init.method ?? 'GET').toUpperCase()
  return m === 'GET' || m === 'HEAD'
}

// Share one refresh across concurrent 401s — a page load fires several calls at
// once and they would otherwise each ask for a new token.
let refreshInFlight: Promise<string | null> | null = null
function refreshToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = createClient().auth.refreshSession()
      .then(({ data }) => data.session?.access_token ?? null)
      .catch(() => null)
      .finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

function withToken(init: RequestInit, token: string): RequestInit {
  const h = new Headers(init.headers)
  h.set('Authorization', `Bearer ${token}`)
  return { ...init, headers: h }
}

/**
 * fetch() with a hard timeout, one retry for reads, and a single session
 * refresh + replay on 401.
 *
 * The 401 replay matters because headers() reads the access token straight out
 * of localStorage, which lags behind the session supabase-js holds in memory.
 * A token that expired while the tab was idle otherwise turned into a silent
 * empty list — every list helper returns [] when the response is not ok.
 */
export async function sbFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    // Only reads are safe to replay — a retried POST could double-write.
    if (!isIdempotent(init)) throw err
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  }

  if (res.status !== 401) return res

  // 401 means the request never took effect, so replaying any method is safe.
  const token = await refreshToken()
  if (!token) return res
  return fetch(url, { ...withToken(init, token), signal: AbortSignal.timeout(timeoutMs) })
}
