// Voice transcription seam for the Workshop Room. Pluggable provider interface
// with a browser (Web Speech API) implementation. Swap in a cloud provider
// (Deepgram / AssemblyAI streaming) later by implementing TranscriptionProvider
// and returning it from createTranscription().

export interface TranscriptionResult {
  text: string
  isFinal: boolean
}

export interface TranscriptionProvider {
  readonly supported: boolean
  start(onResult: (r: TranscriptionResult) => void, onError?: (msg: string) => void): void
  stop(): void
}

// ─── Browser Web Speech API (Chrome / Edge, https or localhost) ───

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionType = any

function getRecognitionCtor(): SpeechRecognitionType | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionType; webkitSpeechRecognition?: SpeechRecognitionType }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

class BrowserTranscription implements TranscriptionProvider {
  private rec: SpeechRecognitionType | null = null
  private stopped = false
  readonly supported: boolean
  constructor(private lang = 'en-US') {
    this.supported = !!getRecognitionCtor()
  }
  start(onResult: (r: TranscriptionResult) => void, onError?: (msg: string) => void) {
    const Ctor = getRecognitionCtor()
    if (!Ctor) { onError?.('Speech recognition is not supported in this browser. Use Chrome or Edge.'); return }
    this.stopped = false
    const rec = new Ctor()
    rec.lang = this.lang
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) onResult({ text: r[0].transcript.trim(), isFinal: true })
        else interim += r[0].transcript
      }
      if (interim) onResult({ text: interim.trim(), isFinal: false })
    }
    rec.onerror = (e: any) => { if (e.error !== 'no-speech' && e.error !== 'aborted') onError?.(`Voice error: ${e.error}`) }
    // Web Speech ends itself periodically; restart while we're live.
    rec.onend = () => { if (!this.stopped) { try { rec.start() } catch { /* already started */ } } }
    this.rec = rec
    try { rec.start() } catch (e) { onError?.(e instanceof Error ? e.message : 'Could not start microphone') }
  }
  stop() {
    this.stopped = true
    try { this.rec?.stop() } catch { /* noop */ }
    this.rec = null
  }
}

// ─── Deepgram (cloud) — browser streams mic audio to Deepgram over a WebSocket ──
// Auth uses a SHORT-LIVED token minted server-side (/api/workshops/voice-token),
// so the DEEPGRAM_API_KEY never reaches the browser. Opt-in: only used when
// NEXT_PUBLIC_VOICE_PROVIDER=deepgram (and the server has DEEPGRAM_API_KEY).

function pickMime(): string {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
  for (const c of cands) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  return ''
}

class DeepgramTranscription implements TranscriptionProvider {
  private ws: WebSocket | null = null
  private rec: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private stopped = false
  readonly supported = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices

  async start(onResult: (r: TranscriptionResult) => void, onError?: (msg: string) => void) {
    this.stopped = false
    try {
      const tokRes = await fetch('/api/workshops/voice-token', { method: 'POST' })
      const tok = await tokRes.json().catch(() => ({}))
      if (!tokRes.ok || !tok.access_token) throw new Error(tok.error || 'Could not get a voice token — is DEEPGRAM_API_KEY set on the server?')

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const q = new URLSearchParams({ model: 'nova-2', language: 'en', smart_format: 'true', interim_results: 'true', punctuate: 'true' })
      // Deepgram browser auth: pass the short-lived token as a WS subprotocol.
      // (If a Deepgram change ever rejects this, switch 'token' -> 'bearer'.)
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${q}`, ['token', tok.access_token])
      this.ws = ws
      ws.onopen = () => {
        if (this.stopped) return
        const mimeType = pickMime()
        const rec = mimeType ? new MediaRecorder(this.stream!, { mimeType }) : new MediaRecorder(this.stream!)
        this.rec = rec
        rec.ondataavailable = (e) => { if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data) }
        rec.start(250)
      }
      ws.onmessage = (m) => {
        try {
          const d = JSON.parse(m.data as string)
          const text = d?.channel?.alternatives?.[0]?.transcript?.trim()
          if (text) onResult({ text, isFinal: !!d.is_final })
        } catch { /* keepalive / non-json */ }
      }
      ws.onerror = () => { if (!this.stopped) onError?.('Voice stream error — check the Deepgram key and your connection.') }
      ws.onclose = () => { if (!this.stopped) onError?.('Voice stream ended. Toggle voice on again to resume.') }
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Could not start cloud voice')
      this.stop()
    }
  }

  stop() {
    this.stopped = true
    try { this.rec?.stop() } catch { /* noop */ }
    try {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'CloseStream' }))
      this.ws?.close()
    } catch { /* noop */ }
    this.stream?.getTracks().forEach((t) => t.stop())
    this.rec = null; this.ws = null; this.stream = null
  }
}

export function createTranscription(opts: { provider?: 'browser' | 'deepgram'; lang?: string } = {}): TranscriptionProvider {
  const provider = opts.provider || (process.env.NEXT_PUBLIC_VOICE_PROVIDER as 'browser' | 'deepgram' | undefined) || 'browser'
  if (provider === 'deepgram') return new DeepgramTranscription()
  return new BrowserTranscription(opts.lang)
}
