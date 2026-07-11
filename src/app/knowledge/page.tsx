'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import type { Workstream } from '@/lib/workstream/types'
import VersionBadge from '@/components/VersionBadge'

interface SourceRow {
  id: string; code: string; title: string; description: string | null
  kind: string; origin: string; tenant_key: string | null; workstream_codes: string[]; version: string | null
}

interface UploadResult {
  draft: {
    code: string; title: string; description: string; docType: string
    workstreams: string[]; skillMarkdown: string
  }
  fullText: string
  extraction: {
    filename: string; format: string; pages: number | null
    chars: number; truncated: boolean; usedVision: boolean
  }
}

const ACCEPT = '.pdf,.docx,.pptx,.xlsx,.xls,.txt,.md,.csv'

export default function KnowledgePage() {
  const router = useRouter()
  const { user, organization, loading } = useAuth()
  const [sources, setSources] = useState<SourceRow[]>([])
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reembedding, setReembedding] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', title: '', body: '', ws: [] as string[] })
  const [showForm, setShowForm] = useState(false)

  // Upload flow state: pick a file, analyze it, review the AI-drafted skill,
  // then save it (and optionally the full document text) into the shared KB.
  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [draftWs, setDraftWs] = useState<string[]>([])
  const [indexFullText, setIndexFullText] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  const load = useCallback(async () => {
    if (!organization) return
    setLoadingData(true)
    const [srcRes, ws] = await Promise.all([
      fetch('/api/knowledge/sources').then((r) => r.json()).catch(() => ({ sources: [] })),
      listWorkstreams(organization.id),
    ])
    setSources(srcRes.sources || [])
    setWorkstreams(ws)
    setLoadingData(false)
  }, [organization])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!form.code.trim() || !form.title.trim() || !form.body.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/knowledge/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.code.trim(), title: form.title.trim(), body: form.body, workstreamCodes: form.ws, kind: 'customer-doc' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setForm({ code: '', title: '', body: '', ws: [] })
      setShowForm(false)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save')
    } finally { setBusy(false) }
  }

  const analyze = async () => {
    if (!file || analyzing) return
    setAnalyzing(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/knowledge/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setResult(data)
      setDraftWs(data.draft.workstreams || [])
      setIndexFullText((data.fullText || '').trim().length > 0)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Analysis failed')
    } finally { setAnalyzing(false) }
  }

  const saveDraft = async () => {
    if (!result || saving) return
    const d = result.draft
    if (!d.code.trim() || !d.title.trim() || !d.skillMarkdown.trim()) {
      alert('Code, title, and the skill summary are required.')
      return
    }
    setSaving(true)
    try {
      const frontmatter = {
        sourceDocument: result.extraction.filename,
        docType: d.docType,
        format: result.extraction.format,
        pages: result.extraction.pages,
        uploadedAt: new Date().toISOString(),
      }
      const res = await fetch('/api/knowledge/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: d.code.trim(), title: d.title.trim(), description: d.description,
          body: d.skillMarkdown, workstreamCodes: draftWs, kind: 'skill', origin: 'upload', frontmatter,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save skill')

      if (indexFullText && result.fullText.trim()) {
        const res2 = await fetch('/api/knowledge/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: `${d.code.trim()}-doc`, title: `${d.title.trim()} (full document)`,
            description: `Full extracted text of ${result.extraction.filename}`,
            body: result.fullText, workstreamCodes: draftWs, kind: 'customer-doc', origin: 'upload',
            frontmatter: { sourceDocument: result.extraction.filename, skillCode: d.code.trim() },
          }),
        })
        const data2 = await res2.json()
        if (!res2.ok) throw new Error(data2.error || 'Skill saved, but indexing the full text failed')
      }

      setResult(null)
      setFile(null)
      setShowUpload(false)
      if (fileInput.current) fileInput.current.value = ''
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  const reembed = async (id: string) => {
    setReembedding(id)
    try { await fetch('/api/knowledge/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId: id }) }) }
    finally { setReembedding(null) }
  }

  const remove = async (s: SourceRow) => {
    if (!confirm(`Delete "${s.title}" from the knowledge base? The agents will no longer retrieve it.`)) return
    setDeleting(s.id)
    try {
      const res = await fetch(`/api/knowledge/sources?id=${s.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally { setDeleting(null) }
  }

  if (loading || !user || !organization) return null
  const toggleWs = (code: string) => setForm((f) => ({ ...f, ws: f.ws.includes(code) ? f.ws.filter((c) => c !== code) : [...f.ws, code] }))
  const toggleDraftWs = (code: string) => setDraftWs((ws) => ws.includes(code) ? ws.filter((c) => c !== code) : [...ws, code])
  const setDraft = (patch: Partial<UploadResult['draft']>) => setResult((r) => r ? { ...r, draft: { ...r.draft, ...patch } } : r)

  const wsChips = (selected: string[], onToggle: (code: string) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {workstreams.map((w) => (
        <button key={w.id} onClick={() => onToggle(w.code)} className={`text-[10px] rounded px-2 py-1 border transition-colors ${selected.includes(w.code) ? 'text-white' : 'text-[var(--m12-text-muted)]'}`} style={selected.includes(w.code) ? { background: w.color || '#2563EB', borderColor: w.color || '#2563EB' } : { borderColor: 'var(--m12-border)' }}>{w.name}</button>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--m12-bg)] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/workstreams')} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]" title="Back to workstreams">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span className="text-gradient text-xl font-bold font-[family-name:var(--font-orbitron)] tracking-wide">MACH12</span>
            <span className="text-[var(--m12-text-muted)] text-lg font-light">/</span>
            <span className="text-[var(--m12-text-secondary)] text-lg font-medium">Knowledge</span>
            <span className="self-end mb-0.5"><VersionBadge /></span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowUpload((s) => !s); setShowForm(false) }} className="bg-[#06B6D4] hover:bg-[#22D3EE] text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">
              {showUpload ? 'Cancel upload' : 'Upload document'}
            </button>
            <button onClick={() => { setShowForm((s) => !s); setShowUpload(false) }} className="bg-[#2563EB] hover:bg-[#3B82F6] text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">
              {showForm ? 'Cancel' : '+ Add customer knowledge'}
            </button>
          </div>
        </div>
        <p className="text-sm text-[var(--m12-text-muted)] mb-6 ml-9">
          The shared SAP S/4HANA + Dassian knowledge base that powers the workstream agents. Baselines are shared with SAP Solution Studio; add customer-specific knowledge here and it grows the agents&apos; expertise.
        </p>

        {showUpload && (
          <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-xl p-4 mb-6 space-y-3">
            {!result && (
              <>
                <div className="text-sm font-semibold text-[var(--m12-text)]">Upload a document</div>
                <p className="text-[11px] text-[var(--m12-text-muted)]">
                  PDF, Word, PowerPoint, Excel, or text. The document is analyzed by AI and distilled into a plain-language skill. You review the skill before it joins the shared brain used by the agents in both studios.
                </p>
                <div className="flex items-center gap-3">
                  <input ref={fileInput} type="file" accept={ACCEPT} title="Choose a document to upload" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs text-[var(--m12-text-muted)] file:mr-3 file:bg-[var(--m12-bg)] file:border file:border-[var(--m12-border)]/50 file:rounded-lg file:px-3 file:py-2 file:text-xs file:text-[var(--m12-text)] file:cursor-pointer" />
                  <button onClick={analyze} disabled={!file || analyzing} className="bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0">
                    {analyzing ? 'Extracting and analyzing…' : 'Analyze document'}
                  </button>
                </div>
                {analyzing && <div className="text-[11px] text-[var(--m12-text-muted)] animate-pulse">Reading the document and drafting the skill. Large documents can take a minute.</div>}
              </>
            )}

            {result && (
              <>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-[var(--m12-text)]">Review the drafted skill</div>
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#06B6D4]/10 text-[#06B6D4]">{result.draft.docType}</span>
                </div>
                <div className="text-[11px] text-[var(--m12-text-muted)]">
                  {result.extraction.filename}
                  {result.extraction.pages ? ` · ${result.extraction.pages} ${result.extraction.format === 'pptx' ? 'slides' : result.extraction.format === 'xlsx' ? 'sheets' : 'pages'}` : ''}
                  {` · ${Math.round(result.extraction.chars / 1000)}k characters extracted`}
                  {result.extraction.usedVision ? ' · no text layer, analyzed the PDF visually' : ''}
                  {result.extraction.truncated ? ' · very large document, analysis used the first ~300k characters' : ''}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={result.draft.code} onChange={(e) => setDraft({ code: e.target.value.replace(/[^a-z0-9-]/gi, '-').toLowerCase() })} placeholder="code" className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none" />
                  <input value={result.draft.title} onChange={(e) => setDraft({ title: e.target.value })} placeholder="Title" className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none" />
                </div>
                <input value={result.draft.description} onChange={(e) => setDraft({ description: e.target.value })} placeholder="One-line description" className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none" />
                <textarea value={result.draft.skillMarkdown} onChange={(e) => setDraft({ skillMarkdown: e.target.value })} placeholder="The plain-language skill the agents will retrieve (markdown). Edit freely before saving." rows={14} className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-xs text-[var(--m12-text)] focus:outline-none font-mono" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--m12-text-muted)] mb-1.5">Tag workstreams (AI suggestion preselected)</div>
                  {wsChips(draftWs, toggleDraftWs)}
                </div>
                <label className="flex items-center gap-2 text-[11px] text-[var(--m12-text-muted)] cursor-pointer">
                  <input type="checkbox" checked={indexFullText} disabled={!result.fullText.trim()} onChange={(e) => setIndexFullText(e.target.checked)} className="accent-[#2563EB]" />
                  Also index the full document text so the agents can retrieve exact details beyond the summary
                </label>
                <div className="flex items-center gap-2">
                  <button onClick={saveDraft} disabled={saving} className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    {saving ? 'Saving and embedding…' : 'Add to knowledge base'}
                  </button>
                  <button onClick={() => { setResult(null); setFile(null); if (fileInput.current) fileInput.current.value = '' }} disabled={saving} className="text-xs text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] px-3 py-2 transition-colors">
                    Discard
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {showForm && (
          <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-xl p-4 mb-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^a-z0-9-]/gi, '-').toLowerCase() })} placeholder="code (e.g. acme-rate-policy)" className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none" />
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none" />
            </div>
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Paste the customer-specific knowledge (markdown). This is chunked and embedded for the agents to retrieve." rows={8} className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-xs text-[var(--m12-text)] focus:outline-none font-mono" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--m12-text-muted)] mb-1.5">Tag workstreams</div>
              {wsChips(form.ws, toggleWs)}
            </div>
            <button onClick={submit} disabled={busy} className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">{busy ? 'Ingesting…' : 'Save & ingest'}</button>
          </div>
        )}

        {loadingData ? (
          <div className="text-center py-20 text-[var(--m12-text-muted)] text-sm">Loading…</div>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => (
              <div key={s.id} className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--m12-text)] truncate">{s.title}</span>
                    <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 text-[var(--m12-text-muted)]">{s.kind}</span>
                    {s.origin === 'solution-studio' && <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#06B6D4]/10 text-[#06B6D4]">Solution Studio</span>}
                    {s.origin === 'upload' && <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#8B5CF6]/10 text-[#A78BFA]">Uploaded</span>}
                  </div>
                  {s.description && <div className="text-[11px] text-[var(--m12-text-muted)] truncate mt-0.5">{s.description}</div>}
                  {s.workstream_codes?.length > 0 && <div className="text-[9px] text-[var(--m12-text-muted)] mt-0.5 font-[family-name:var(--font-space-mono)]">{s.workstream_codes.join(' · ')}</div>}
                </div>
                <button onClick={() => reembed(s.id)} disabled={reembedding === s.id} className="text-[10px] text-[var(--m12-text-muted)] hover:text-[#2563EB] border border-[var(--m12-border)]/40 rounded px-2 py-1 transition-colors shrink-0">{reembedding === s.id ? 'Re-embedding…' : 'Re-embed'}</button>
                {s.origin !== 'solution-studio' && (
                  <button onClick={() => remove(s)} disabled={deleting === s.id} title="Delete" className="text-[10px] text-[var(--m12-text-muted)] hover:text-red-400 border border-[var(--m12-border)]/40 rounded px-2 py-1 transition-colors shrink-0">{deleting === s.id ? '…' : 'Delete'}</button>
                )}
              </div>
            ))}
            {sources.length === 0 && <div className="text-center py-16 border border-dashed border-[var(--m12-border)]/50 rounded-xl text-sm text-[var(--m12-text-muted)]">No knowledge sources yet. Run the vibe-skills import, upload a document, or add a customer doc.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
