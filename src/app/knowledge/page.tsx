'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import type { Workstream } from '@/lib/workstream/types'
import VersionBadge from '@/components/VersionBadge'

interface SourceRow {
  id: string; code: string; title: string; description: string | null
  kind: string; origin: string; tenant_key: string | null; workstream_codes: string[]; version: string | null
}

export default function KnowledgePage() {
  const router = useRouter()
  const { user, organization, loading } = useAuth()
  const [sources, setSources] = useState<SourceRow[]>([])
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reembedding, setReembedding] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', title: '', body: '', ws: [] as string[] })
  const [showForm, setShowForm] = useState(false)

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

  const reembed = async (id: string) => {
    setReembedding(id)
    try { await fetch('/api/knowledge/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId: id }) }) }
    finally { setReembedding(null) }
  }

  if (loading || !user || !organization) return null
  const toggleWs = (code: string) => setForm((f) => ({ ...f, ws: f.ws.includes(code) ? f.ws.filter((c) => c !== code) : [...f.ws, code] }))

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
          <button onClick={() => setShowForm((s) => !s)} className="bg-[#2563EB] hover:bg-[#3B82F6] text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">
            {showForm ? 'Cancel' : '+ Add customer knowledge'}
          </button>
        </div>
        <p className="text-sm text-[var(--m12-text-muted)] mb-6 ml-9">
          The shared SAP S/4HANA + Dassian knowledge base that powers the workstream agents. Baselines are shared with SAP Solution Studio; add customer-specific knowledge here and it grows the agents&apos; expertise.
        </p>

        {showForm && (
          <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-xl p-4 mb-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^a-z0-9-]/gi, '-').toLowerCase() })} placeholder="code (e.g. acme-rate-policy)" className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none" />
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none" />
            </div>
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Paste the customer-specific knowledge (markdown). This is chunked and embedded for the agents to retrieve." rows={8} className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-xs text-[var(--m12-text)] focus:outline-none font-mono" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--m12-text-muted)] mb-1.5">Tag workstreams</div>
              <div className="flex flex-wrap gap-1.5">
                {workstreams.map((w) => (
                  <button key={w.id} onClick={() => toggleWs(w.code)} className={`text-[10px] rounded px-2 py-1 border transition-colors ${form.ws.includes(w.code) ? 'text-white' : 'text-[var(--m12-text-muted)]'}`} style={form.ws.includes(w.code) ? { background: w.color || '#2563EB', borderColor: w.color || '#2563EB' } : { borderColor: 'var(--m12-border)' }}>{w.name}</button>
                ))}
              </div>
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
                  </div>
                  {s.description && <div className="text-[11px] text-[var(--m12-text-muted)] truncate mt-0.5">{s.description}</div>}
                  {s.workstream_codes?.length > 0 && <div className="text-[9px] text-[var(--m12-text-muted)] mt-0.5 font-[family-name:var(--font-space-mono)]">{s.workstream_codes.join(' · ')}</div>}
                </div>
                <button onClick={() => reembed(s.id)} disabled={reembedding === s.id} className="text-[10px] text-[var(--m12-text-muted)] hover:text-[#2563EB] border border-[var(--m12-border)]/40 rounded px-2 py-1 transition-colors shrink-0">{reembedding === s.id ? 'Re-embedding…' : 'Re-embed'}</button>
              </div>
            ))}
            {sources.length === 0 && <div className="text-center py-16 border border-dashed border-[var(--m12-border)]/50 rounded-xl text-sm text-[var(--m12-text-muted)]">No knowledge sources yet. Run the vibe-skills import or add a customer doc.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
