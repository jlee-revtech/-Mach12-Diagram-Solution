'use client'

// The Documents surface (Workpackage K2).
//
// Consulting deliverables the workstream agents and the Solution Architect
// produced: config workbooks, business process designs, functional and technical
// specs, key design decisions, test scripts, migration specs, authorization
// concepts, cutover runbooks, DFARS business system compliance matrices, and the
// Solution Architecture Document.
//
// Every document carries its evidence pack. The provenance panel is not decoration:
// a reader can see which evidence slot was filled by which tool, and which came
// back empty. A document generated over an unfilled REQUIRED slot does not exist,
// because the engine refuses to write one.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { exportDeliverableDocx, exportDeliverableHtml, exportDeliverablePptx, type DeliverableDoc } from '@/lib/workshop/export'
import VersionBadge from '@/components/VersionBadge'

interface DeliverableRow extends DeliverableDoc {
  id: string
  version: number
  updated_at: string | null
}

interface TypeInfo {
  type: string
  title: string
  purpose: string
  audience: string
  dimensions: string[]
  architectOnly: boolean
  requiredEvidence: string[]
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-800 border-amber-200',
  review: 'bg-sky-50 text-sky-800 border-sky-200',
  final: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    return JSON.parse(localStorage.getItem(key) || '{}')?.access_token ?? null
  } catch {
    return null
  }
}

const authHeaders = (): Record<string, string> => {
  const t = getToken()
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }
}

export default function DeliverablesPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuth()
  const [rows, setRows] = useState<DeliverableRow[]>([])
  const [types, setTypes] = useState<TypeInfo[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('')
  const [filterWs, setFilterWs] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  const load = useCallback(async () => {
    if (!organization) return
    setLoadingData(true)
    try {
      const res = await fetch(`/api/deliverables?orgId=${organization.id}`, { headers: authHeaders() }).then((r) => r.json())
      setRows(res.deliverables || [])
      setTypes(res.types || [])
    } catch {
      setRows([])
    }
    setLoadingData(false)
  }, [organization])
  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(
    () => rows.filter((r) => (!filterType || r.dtype === filterType) && (!filterWs || r.workstream_code === filterWs)),
    [rows, filterType, filterWs]
  )
  const current = useMemo(() => filtered.find((r) => r.id === selected) ?? filtered[0] ?? null, [filtered, selected])
  const workstreamCodes = useMemo(() => [...new Set(rows.map((r) => r.workstream_code))].sort(), [rows])
  const typeTitle = (t: string) => types.find((x) => x.type === t)?.title ?? t

  const setStatus = async (id: string, status: string) => {
    setBusy(true)
    await fetch('/api/deliverables', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ id, status }) })
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
    setBusy(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this document? This cannot be undone.')) return
    setBusy(true)
    await fetch(`/api/deliverables?id=${id}`, { method: 'DELETE', headers: authHeaders() })
    setRows((rs) => rs.filter((r) => r.id !== id))
    if (selected === id) setSelected(null)
    setBusy(false)
  }

  if (loading || loadingData) {
    return <div className="p-8 text-sm text-slate-500">Loading documents...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Documents</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Consulting deliverables your agents produced, with the evidence each was written from.
            </p>
          </div>
          <VersionBadge />
        </div>
      </header>

      {!rows.length ? (
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-lg border border-slate-200 bg-white p-8">
            <h2 className="text-base font-semibold text-slate-900">No documents yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Ask a workstream agent, or the Solution Architect, to produce one. For example: &quot;draft the business process
              design for project settlement&quot;, or &quot;generate the configuration workbook for record-to-report&quot;.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              An agent refuses to write a document whose required evidence it cannot gather. If it says the architecture model is
              empty, or that no configuration has been executed, that is the honest answer, and the fix is to supply the evidence.
            </p>
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-900">What they can produce</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                {types.map((t) => (
                  <li key={t.type}>
                    <span className="font-medium text-slate-800">{t.title}</span>
                    {t.architectOnly ? <span className="ml-1.5 text-xs text-slate-400">(Solution Architect)</span> : null}
                    <span className="block text-xs text-slate-500">{t.purpose}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex" style={{ height: 'calc(100vh - 81px)' }}>
          <aside className="w-96 shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
            <div className="sticky top-0 space-y-2 border-b border-slate-200 bg-white p-3">
              <select
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">All document types</option>
                {types.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.title}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={filterWs}
                onChange={(e) => setFilterWs(e.target.value)}
              >
                <option value="">All workstreams</option>
                {workstreamCodes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <ul>
              {filtered.map((r) => {
                const gathered = (r.evidence ?? []).filter((e) => e.ok).length
                const total = (r.evidence ?? []).length
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelected(r.id)}
                      className={`w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                        current?.id === r.id ? 'bg-slate-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">{r.title}</span>
                        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase ${STATUS_STYLE[r.status ?? 'draft']}`}>
                          {r.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {typeTitle(r.dtype)} &middot; {r.workstream_code}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {gathered}/{total} evidence slots filled
                        {r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString()}` : ''}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          <main className="flex-1 overflow-y-auto">
            {!current ? (
              <div className="p-8 text-sm text-slate-500">Select a document.</div>
            ) : (
              <article className="mx-auto max-w-4xl p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">{current.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {typeTitle(current.dtype)} &middot; {current.workstream_code}
                      {current.subject ? ` · ${current.subject}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                      value={current.status ?? 'draft'}
                      disabled={busy}
                      onChange={(e) => setStatus(current.id, e.target.value)}
                    >
                      <option value="draft">Draft</option>
                      <option value="review">In review</option>
                      <option value="final">Final</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => exportDeliverableHtml(current)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Download HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => exportDeliverablePptx(current)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Download PowerPoint
                    </button>
                    <button
                      type="button"
                      onClick={() => exportDeliverableDocx(current)}
                      className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Download Word
                    </button>
                    <button
                      onClick={() => remove(current.id)}
                      disabled={busy}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <EvidencePanel evidence={current.evidence ?? []} />

                <div className="mt-6 space-y-8">
                  {(current.content?.sections ?? []).map((s) => (
                    <section key={s.key}>
                      <h3 className="border-b border-slate-200 pb-1 text-lg font-semibold text-slate-900">{s.title}</h3>
                      <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">{s.content}</pre>
                    </section>
                  ))}
                </div>
              </article>
            )}
          </main>
        </div>
      )}
    </div>
  )
}

function EvidencePanel({ evidence }: { evidence: { key: string; tool: string; ok: boolean; reason?: string }[] }) {
  if (!evidence.length) return null
  const filled = evidence.filter((e) => e.ok).length
  const missing = evidence.filter((e) => !e.ok)
  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Provenance</h3>
        <span className="text-xs text-slate-500">
          {filled} of {evidence.length} evidence slots filled
        </span>
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {evidence.map((e) => (
          <li key={e.key} className="flex items-start gap-1.5">
            <span className={e.ok ? 'text-emerald-600' : 'text-slate-400'}>{e.ok ? '✓' : '✗'}</span>
            <span className="text-slate-600">
              <span className="font-medium text-slate-800">{e.key}</span> via {e.tool}
              {!e.ok && e.reason ? <span className="block text-slate-400">{e.reason}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {missing.length ? (
        <p className="mt-2 text-xs text-slate-500">
          Sections that depended on the unfilled slots say so explicitly. They were not filled with generic content.
        </p>
      ) : null}
    </div>
  )
}
