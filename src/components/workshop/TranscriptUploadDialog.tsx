'use client'

// Upload (or paste) a transcript into a workshop. It is parsed into speaker +
// content lines and appended to the workshop's messages, so it drives the
// facilitation, capture, and recap exactly as if it had been recorded live.

import { useMemo, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { parseTranscript } from '@/lib/workshop/parseTranscript'
import { addMessages } from '@/lib/supabase/workshops'
import { Button } from '@/components/common'

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[42rem] max-w-[94vw] max-h-[88vh] flex flex-col bg-white rounded-xl shadow-card-hover overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="min-w-0">
            <h3 className="text-heading-sm font-display text-text-primary">Upload transcript</h3>
            <div className="text-[11px] text-text-tertiary">Paste or upload a transcript; it is added to the workshop as if recorded live.</div>
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={14} />} title="Close" aria-label="Close" onClick={onClose} />
        </div>

        {error && <div className="mx-5 mt-3 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" size="sm" icon={<Upload size={12} />} onClick={() => fileRef.current?.click()}>
              Choose file (.txt, .vtt, .srt, .md)
            </Button>
            <input ref={fileRef} type="file" accept=".txt,.vtt,.srt,.md,.text,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            {fileName && <span className="text-[11px] text-text-tertiary truncate max-w-[16rem]">{fileName}</span>}
            <div className="ml-auto flex items-center gap-1.5">
              <label className="text-label uppercase text-text-secondary">Unnamed speaker</label>
              <input value={defaultSpeaker} onChange={(e) => setDefaultSpeaker(e.target.value)} className="w-28 h-8 px-2 rounded-lg border border-border bg-surface-input text-[11px] text-text-primary focus:outline-none focus:border-brand-500" placeholder="Participant" />
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setFileName(null) }}
            rows={12}
            placeholder={'Paste a transcript here, or choose a file.\n\nWorks with "Speaker: text" lines, WebVTT (.vtt), and SubRip (.srt). Lines without a speaker use the name above.'}
            className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-body-sm text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none resize-none font-mono leading-relaxed"
          />

          {parsed.length > 0 && (
            <div className="rounded-lg border border-border bg-surface-muted p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] text-text-secondary">{parsed.length} line{parsed.length === 1 ? '' : 's'} parsed{speakers.length ? `, ${speakers.length} speaker${speakers.length === 1 ? '' : 's'}` : ''}</div>
                {speakers.length > 0 && <div className="text-[11px] text-text-tertiary truncate max-w-[20rem]">{speakers.join(', ')}</div>}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {parsed.slice(0, 30).map((p, i) => (
                  <div key={i} className="text-[11px] leading-snug">
                    <span className="text-brand-600 font-medium">{p.speaker}:</span> <span className="text-text-secondary">{p.content}</span>
                  </div>
                ))}
                {parsed.length > 30 && <div className="text-[11px] text-text-tertiary">...and {parsed.length - 30} more</div>}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center gap-2">
          <div className="text-[11px] text-text-tertiary">Appends to the existing transcript. Nothing is overwritten.</div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={importNow} loading={busy} disabled={busy || parsed.length === 0}>
              {busy ? 'Importing...' : `Add ${parsed.length || ''} to transcript`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
