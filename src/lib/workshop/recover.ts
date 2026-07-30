// Recovery for long-running generate calls. Corporate proxies, VPNs, and flaky
// networks drop the browser's connection on 1-3 minute POSTs while the Vercel
// function keeps running and persists the result ("Failed to fetch" in the UI,
// yet the section lands in the DB as final). When a generate fetch dies with a
// network-level error, watch the section's content row for a newer version and
// treat its arrival as success instead of surfacing the raw fetch error.

import { getAgendaContent, type AgendaContentRow } from '@/lib/supabase/workshops'

// Network-level fetch failures (connection dropped/reset/blocked), as opposed to
// an HTTP error response. Chrome: "Failed to fetch"; Firefox: "NetworkError when
// attempting to fetch resource"; Safari: "Load failed".
export const isNetworkDrop = (e: unknown): boolean =>
  e instanceof TypeError ||
  (e instanceof Error && /failed to fetch|networkerror|load failed|fetch failed/i.test(e.message))

// Poll the agenda item's content row until a version newer than prevVersion
// appears (the server bumps version on every persist) or the timeout elapses.
export async function watchForAgendaContent(
  agendaItemId: string,
  prevVersion: number,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<AgendaContentRow | null> {
  const deadline = Date.now() + (opts.timeoutMs ?? 4 * 60_000)
  const interval = opts.intervalMs ?? 5_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval))
    try {
      const row = await getAgendaContent(agendaItemId)
      if (row?.content && (row.version ?? 0) > prevVersion) return row
    } catch { /* transient read failure; keep watching */ }
  }
  return null
}
