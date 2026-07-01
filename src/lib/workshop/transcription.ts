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

export function createTranscription(opts: { provider?: 'browser'; lang?: string } = {}): TranscriptionProvider {
  // Only 'browser' today; the interface lets us add 'deepgram' | 'assemblyai'
  // (server-streamed) without touching the Room.
  return new BrowserTranscription(opts.lang)
}
