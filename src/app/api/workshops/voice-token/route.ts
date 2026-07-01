import { NextRequest } from 'next/server'

// Mint a short-lived Deepgram token for browser voice streaming. The real
// DEEPGRAM_API_KEY stays server-side; the browser only ever sees a token that
// expires in a few minutes. Returns 503 when no key is configured, so the Room
// falls back to the free browser engine.

const KEY = process.env.DEEPGRAM_API_KEY

export async function POST(_req: NextRequest) {
  if (!KEY) return json({ error: 'Cloud voice is not configured (set DEEPGRAM_API_KEY).' }, 503)
  try {
    const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: { Authorization: `Token ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl_seconds: 300 }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.access_token) return json({ error: data.err_msg || data.error || 'Failed to grant a voice token' }, 502)
    return json({ access_token: data.access_token, expires_in: data.expires_in }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'voice token error' }, 500)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
