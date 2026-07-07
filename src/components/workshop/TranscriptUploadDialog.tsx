'use client'

// Upload (or paste) a transcript into a workshop. It is parsed into speaker +
// content lines and appended to the workshop's messages, so it drives the
// facilitation, capture, and recap exactly as if it had been recorded live.

import { useMemo, useRef, useState } from 'react'
import { parseTranscript } from '@/lib/workshop/parseTranscript'
import { addMessages } from '@/lib/supabase/workshops'

export default function TranscriptUploadDialog({
  workshopId, onClose, onImported,
}: {
  workshopId: string
  onClose: () => void
  onImported: (count: number) => void
}) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [defaultSpeaker, setDefaultSpeaker] = useState('Participant')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => parseTranscript(text, { defaultSpeaker }), [text, defaultSpeaker])
  const speakers = useMemo(() => Array.from(new Set(parsed.map((p) => p.speaker))).slice(0, 8), [parsed])

  const onFile = async (f: File | null) => {
    if (!f) return
    setError(null)
    try {
      const content = await f.text()
      setText(content)
      setFileName(f.name)
    } catch {
      setError('Could not read that file.')
    }
  }

  const importNow = async () => {
    if (parsed.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const count = await addMessages(
        workshopId,
        parsed.map((p) => ({ speaker_kind: 'person' as const, speaker_name: p.speaker, speaker_role: 'participant', content: p.content, source: 'upload' })),
      )
      onImported(count)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import the transcript')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[42rem] max-w-[94vw] max-h-[88vh] flex flex-col bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--m12-border)]/40">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--m12-text)]">Upload transcript</h3>
            <div className="text-[11px] text-[var(--m12-text-muted)]">Paste or upload a transcript; it is added to the workshop as if recorded live.</div>
          </div>
          <button type="button" onClick={onClose} title="Close" aria-label="Close" className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </div>

        {error && <div className="mx-5 mt-3 text-[11px] text-[#EF4444] bg-[#DC262614] border border-[#DC2626]/30 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] px-2.5 py-1.5 rounded-lg border border-[var(--m12-border)]/50 text-[var(--m12-text-secondary)] hover:border-[var(--m12-border)]">
              Choose file (.txt, .vtt, .srt, .md)
            </button>
            <input ref={fileRef} type="file" accept=".txt,.vtt,.srt,.md,.text,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            {fileName && <span className="text-[10px] text-[var(--m12-text-muted)] truncate max-w-[16rem]">{fileName}</span>}
            <div className="ml-auto flex items-center gap-1.5">
              <label className="text-[10px] text-[var(--m12-text-muted)]">Unnamed speaker</label>
              <input value={defaultSpeaker} onChange={(e) => setDefaultSpeaker(e.target.value)} className="w-28 bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded px-2 py-1 text-[11px] text-[var(--m12-text)] outline-none" placeholder="Participant" />
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setFileName(null) }}
            rows={12}
            placeholder={'Paste a transcript here, or choose a file.\n\nWorks with "Speaker: text" lines, WebVTT (.vtt), and SubRip (.srt). Lines without a speaker use the name above.'}
            className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 focus:border-[#2563EB] rounded-lg px-3 py-2 text-xs text-[var(--m12-text)] outline-none resize-none font-mono leading-relaxed"
          />

          {parsed.length > 0 && (
            <div className="rounded-lg border border-[var(--m12-border)]/40 bg-[var(--m12-bg)] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] text-[var(--m12-text-secondary)]">{parsed.length} line{parsed.length === 1 ? '' : 's'} parsed{speakers.length ? `, ${speakers.length} speaker${speakers.length === 1 ? '' : 's'}` : ''}</div>
                {speakers.length > 0 && <div className="text-[10px] text-[var(--m12-text-muted)] truncate max-w-[20rem]">{speakers.join(', ')}</div>}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {parsed.slice(0, 30).map((p, i) => (
                  <div key={i} className="text-[11px] leading-snug">
                    <span className="text-[#3B82F6] font-medium">{p.speaker}:</span> <span className="text-[var(--m12-text-secondary)]">{p.content}</span>
                  </div>
                ))}
                {parsed.length > 30 && <div className="text-[10px] text-[var(--m12-text-muted)]">…and {parsed.length - 30} more</div>}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--m12-border)]/40 flex items-center gap-2">
          <div className="text-[11px] text-[var(--m12-text-muted)]">Appends to the existing transcript. Nothing is overwritten.</div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-[11px] px-3 py-1.5 rounded-lg border border-[var(--m12-border)]/50 text-[var(--m12-text-secondary)] hover:border-[var(--m12-border)]">Cancel</button>
            <button type="button" onClick={importNow} disabled={busy || parsed.length === 0} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50">
              {busy ? 'Importing…' : `Add ${parsed.length || ''} to transcript`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
