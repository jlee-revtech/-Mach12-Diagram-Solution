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
import Link from 'next/link'
import { Archive, ArchiveRestore, Check, ChevronDown, FileText, Network, Plus, Sparkles, Tag, X } from 'lucide-react'
import { useAuth } from '@/lib/supabase/auth-context'
import { exportDeliverableDocx, exportDeliverableHtml, exportDeliverablePptx, type DeliverableDoc } from '@/lib/workshop/export'
import { listWorkstreams } from '@/lib/supabase/workstreams'
import type { Workstream } from '@/lib/workstream/types'
import { sectionBlocks, type SectionBlock } from '@/lib/deliverables/blocks'
import AgentChatPanel from '@/components/agents/AgentChatPanel'
import { Button, EmptyState, LoadingState, PageHeader } from '@/components/common'

interface DeliverableRow extends DeliverableDoc {
  id: string
  version: number
  updated_at: string | null
  tags?: string[]
  archived_at?: string | null
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
  draft: 'bg-gray-100 text-gray-500',
  review: 'bg-status-blue-bg text-status-blue',
  final: 'bg-status-green-bg text-status-green',
}

const SELECT_CLS = 'h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none'

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
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('')
  const [filterWs, setFilterWs] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [pivotByTag, setPivotByTag] = useState(false)
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set())
  const [tagDraft, setTagDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [enrichOpen, setEnrichOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (!loading && user && !organization) router.push('/setup')
  }, [user, organization, loading, router])

  const load = useCallback(async () => {
    if (!organization) return
    setLoadingData(true)
    try {
      const [res, ws] = await Promise.all([
        fetch(`/api/deliverables?orgId=${organization.id}`, { headers: authHeaders() }).then((r) => r.json()),
        listWorkstreams(organization.id).catch(() => [] as Workstream[]),
      ])
      setRows(res.deliverables || [])
      setTypes(res.types || [])
      setWorkstreams(ws)
    } catch {
      setRows([])
    }
    setLoadingData(false)
  }, [organization])
  useEffect(() => {
    load()
  }, [load])

  // Re-fetch one document (after the enrichment panel closes) so newly added
  // sections and blocks appear without a full page reload.
  const refreshDoc = useCallback(
    async (id: string) => {
      if (!organization) return
      try {
        const res = await fetch(`/api/deliverables?orgId=${organization.id}&id=${id}`, { headers: authHeaders() }).then((r) => r.json())
        const fresh = (res.deliverables || [])[0] as DeliverableRow | undefined
        if (fresh) setRows((rs) => rs.map((r) => (r.id === id ? fresh : r)))
      } catch {
        /* keep the stale copy; the next full load refreshes it */
      }
    },
    [organization]
  )

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          !r.archived_at &&
          (!filterType || r.dtype === filterType) &&
          (!filterWs || r.workstream_code === filterWs) &&
          (!filterTag || (r.tags ?? []).includes(filterTag))
      ),
    [rows, filterType, filterWs, filterTag]
  )
  const archivedRows = useMemo(() => rows.filter((r) => r.archived_at), [rows])
  const current = useMemo(() => rows.find((r) => r.id === selected) ?? filtered[0] ?? null, [rows, filtered, selected])
  const workstreamCodes = useMemo(() => [...new Set(rows.map((r) => r.workstream_code))].sort(), [rows])
  const allTags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags ?? []))].sort((a, b) => a.localeCompare(b)), [rows])
  // Friendly labels for deliverable types not in the agent catalog (e.g. published
  // workshop readouts, which are authored, not agent-generated).
  const CUSTOM_TYPE_TITLES: Record<string, string> = { workshop_readout: 'Workshop Readout' }
  const typeTitle = (t: string) => types.find((x) => x.type === t)?.title ?? CUSTOM_TYPE_TITLES[t] ?? t

  // Focus a specific document when arriving via ?selected=<id> (e.g. right after
  // publishing a workshop to Deliverables).
  useEffect(() => {
    const sel = new URLSearchParams(window.location.search).get('selected')
    if (sel) setSelected(sel)
  }, [])

  const UNTAGGED = '— Untagged'
  // Pivot: one group per tag (a document with N tags appears in N groups), plus an
  // "Untagged" bucket. Ordered by tag name, Untagged last.
  const tagGroups = useMemo(() => {
    const byTag = new Map<string, DeliverableRow[]>()
    for (const r of filtered) {
      const tags = r.tags && r.tags.length ? r.tags : [UNTAGGED]
      for (const t of tags) {
        if (!byTag.has(t)) byTag.set(t, [])
        byTag.get(t)!.push(r)
      }
    }
    return [...byTag.entries()]
      .sort(([a], [b]) => (a === UNTAGGED ? 1 : b === UNTAGGED ? -1 : a.localeCompare(b)))
      .map(([tag, list]) => ({ tag, list }))
  }, [filtered])

  // Scope the enrichment agent to the open document: which deliverable it is and
  // its section indexes, so the agent targets the deliverable tools correctly.
  const enrichContext = useMemo(() => {
    if (!current) return undefined
    const secs = (current.content?.sections ?? []).map((s, i) => `[${i}] "${s.title}"`).join(', ')
    return (
      `The user has deliverable "${current.title}" (id ${current.id}, type ${current.dtype}) open in the Documents tab. ` +
      `Its sections by 0-based index: ${secs || '(none yet)'}. ` +
      `When they ask to add or enrich content, use the deliverable tools (get_deliverable, add_deliverable_section, update_deliverable_section, add_section_table, add_section_visual, add_section_diagram_ref) against this deliverable id.`
    )
  }, [current])
  const enrichAgentCode =
    current && workstreams.some((w) => w.code === current.workstream_code) ? current.workstream_code : 'enterprise'

  const setStatus = async (id: string, status: string) => {
    setBusy(true)
    await fetch('/api/deliverables', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ id, status }) })
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
    setBusy(false)
  }

  const setTags = async (id: string, tags: string[]) => {
    // Normalize client-side to match the API (trim, dedupe, non-empty).
    const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))]
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, tags: clean } : r)))
    await fetch('/api/deliverables', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ id, tags: clean }) }).catch(() => load())
  }
  const addTag = (r: DeliverableRow, tag: string) => {
    const t = tag.trim()
    if (!t) return
    setTags(r.id, [...(r.tags ?? []), t])
    setTagDraft('')
  }
  const removeTag = (r: DeliverableRow, tag: string) => setTags(r.id, (r.tags ?? []).filter((x) => x !== tag))
  const toggleTagCollapse = (tag: string) =>
    setCollapsedTags((prev) => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })

  const renderRow = (r: DeliverableRow) => {
    const gathered = (r.evidence ?? []).filter((e) => e.ok).length
    const total = (r.evidence ?? []).length
    return (
      <li key={r.id}>
        <button
          type="button"
          onClick={() => setSelected(r.id)}
          className={`w-full border-b border-border last:border-0 px-4 py-3 text-left transition-colors ${
            current?.id === r.id ? 'bg-brand-50' : 'hover:bg-surface-muted/50'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-body-sm font-medium text-text-primary">{r.title}</span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase font-medium ${STATUS_STYLE[r.status ?? 'draft']}`}>
              {r.status}
            </span>
          </div>
          <div className="mt-1 text-body-sm text-text-secondary">
            {typeTitle(r.dtype)} &middot; <span className="font-mono">{r.workstream_code}</span>
          </div>
          {(r.tags ?? []).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(r.tags ?? []).map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded bg-brand-50 text-brand-700 border border-brand-200 px-1.5 py-0.5 text-[10px]">
                  <Tag size={9} />
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1 text-[11px] text-text-tertiary">
            {gathered}/{total} evidence slots filled
            {r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString()}` : ''}
          </div>
        </button>
      </li>
    )
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this document? This cannot be undone.')) return
    setBusy(true)
    await fetch(`/api/deliverables?id=${id}`, { method: 'DELETE', headers: authHeaders() })
    setRows((rs) => rs.filter((r) => r.id !== id))
    if (selected === id) setSelected(null)
    setBusy(false)
  }

  const setArchived = async (id: string, archived: boolean) => {
    setBusy(true)
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, archived_at: archived ? new Date().toISOString() : null } : r)))
    if (archived && selected === id) setSelected(null)
    await fetch('/api/deliverables', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ id, archived }) }).catch(() => load())
    setBusy(false)
  }

  if (loading || loadingData) {
    return (
      <div className="space-y-6 max-w-[1400px]">
        <LoadingState label="Loading documents..." />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Deliverables"
        icon={<FileText size={24} />}
        subtitle="Consulting deliverables your agents produced, with the evidence each was written from."
      />

      {!rows.length ? (
        <>
          <EmptyState
            variant="dashed"
            icon={<FileText size={28} />}
            title="No documents yet"
            description={
              <>
                Ask a workstream agent, or the Solution Architect, to produce one. For example: &quot;draft the business process
                design for project settlement&quot;, or &quot;generate the configuration workbook for record-to-report&quot;.
                <span className="block mt-2">
                  An agent refuses to write a document whose required evidence it cannot gather. If it says the architecture model is
                  empty, or that no configuration has been executed, that is the honest answer, and the fix is to supply the evidence.
                </span>
              </>
            }
          />
          {types.length > 0 && (
            <div className="bg-white rounded-lg border border-border shadow-card p-5">
              <h3 className="text-body-md font-semibold text-text-primary">What they can produce</h3>
              <ul className="mt-2 space-y-1.5 text-body-sm text-text-secondary">
                {types.map((t) => (
                  <li key={t.type}>
                    <span className="font-medium text-text-primary">{t.title}</span>
                    {t.architectOnly ? <span className="ml-1.5 text-body-sm text-text-tertiary">(Solution Architect)</span> : null}
                    <span className="block text-body-sm text-text-tertiary">{t.purpose}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,340px)_1fr] gap-4 items-start">
          <aside className="bg-white rounded-lg border border-border shadow-card overflow-hidden">
            <div className="space-y-2 border-b border-border p-3">
              <select
                className={`w-full ${SELECT_CLS}`}
                value={filterType}
                aria-label="Filter by document type"
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
                className={`w-full ${SELECT_CLS}`}
                value={filterWs}
                aria-label="Filter by workstream"
                onChange={(e) => setFilterWs(e.target.value)}
              >
                <option value="">All workstreams</option>
                {workstreamCodes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <select
                  className={`flex-1 min-w-0 ${SELECT_CLS}`}
                  value={filterTag}
                  aria-label="Filter by tag"
                  disabled={allTags.length === 0}
                  onChange={(e) => setFilterTag(e.target.value)}
                >
                  <option value="">{allTags.length ? 'All tags' : 'No tags yet'}</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setPivotByTag((v) => !v)}
                  title="Group the list by tag"
                  className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border text-body-sm transition-colors ${
                    pivotByTag ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-border text-text-secondary hover:bg-surface-muted'
                  }`}
                >
                  <Tag size={13} />
                  Pivot
                </button>
              </div>
            </div>
            {pivotByTag ? (
              <div className="max-h-[65vh] overflow-y-auto">
                {tagGroups.map(({ tag, list }) => {
                  const collapsed = collapsedTags.has(tag)
                  return (
                    <div key={tag}>
                      <button
                        type="button"
                        onClick={() => toggleTagCollapse(tag)}
                        className="w-full sticky top-0 z-10 flex items-center gap-2 bg-surface-muted/80 backdrop-blur px-3 py-2 border-b border-border text-left"
                      >
                        <ChevronDown size={13} className={`shrink-0 text-text-tertiary transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                        <Tag size={12} className="shrink-0 text-brand-500" />
                        <span className="flex-1 truncate text-body-sm font-semibold text-text-primary">{tag}</span>
                        <span className="text-[11px] text-text-tertiary tabular-nums">{list.length}</span>
                      </button>
                      {!collapsed && <ul>{list.map(renderRow)}</ul>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <ul className="max-h-[65vh] overflow-y-auto">{filtered.map(renderRow)}</ul>
            )}
            {archivedRows.length > 0 && (
              <div className="border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <ChevronDown size={13} className={`shrink-0 transition-transform ${showArchived ? '' : '-rotate-90'}`} />
                  <Archive size={13} className="shrink-0" />
                  <span className="flex-1 text-body-sm font-medium">Archived</span>
                  <span className="text-[11px] tabular-nums">{archivedRows.length}</span>
                </button>
                {showArchived && <ul className="opacity-70">{archivedRows.map(renderRow)}</ul>}
              </div>
            )}
          </aside>

          <section className="bg-white rounded-lg border border-border shadow-card">
            {!current ? (
              <EmptyState variant="inline" title="Select a document" compact />
            ) : (
              <article className="p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-heading-lg font-display text-text-primary">{current.title}</h2>
                    <p className="mt-1 text-body-sm text-text-secondary">
                      {typeTitle(current.dtype)} &middot; <span className="font-mono">{current.workstream_code}</span>
                      {current.subject ? ` · ${current.subject}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Tag size={12} className="text-text-tertiary" />
                      {(current.tags ?? []).map((t) => (
                        <span key={t} className="group inline-flex items-center gap-1 rounded bg-brand-50 text-brand-700 border border-brand-200 px-1.5 py-0.5 text-[11px]">
                          {t}
                          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => removeTag(current, t)} className="opacity-60 hover:opacity-100 hover:text-red-600">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      <input
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addTag(current, tagDraft)
                          if (e.key === 'Backspace' && !tagDraft && (current.tags ?? []).length) removeTag(current, current.tags![current.tags!.length - 1])
                        }}
                        onBlur={() => addTag(current, tagDraft)}
                        placeholder="+ tag"
                        aria-label="Add a tag"
                        list="deliverable-tags"
                        className="w-24 rounded border border-border bg-surface-input px-1.5 py-0.5 text-[11px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                      />
                      <datalist id="deliverable-tags">
                        {allTags.map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 flex-wrap">
                    <Button variant="ai" size="sm" icon={<Sparkles size={14} />} onClick={() => setEnrichOpen(true)}>
                      Enrich with agent
                    </Button>
                    <select
                      className={SELECT_CLS}
                      value={current.status ?? 'draft'}
                      disabled={busy}
                      aria-label="Document status"
                      onChange={(e) => setStatus(current.id, e.target.value)}
                    >
                      <option value="draft">Draft</option>
                      <option value="review">In review</option>
                      <option value="final">Final</option>
                    </select>
                    <Button variant="secondary" size="sm" onClick={() => exportDeliverableHtml(current)}>
                      Download HTML
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => exportDeliverablePptx(current)}>
                      Download PowerPoint
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => exportDeliverableDocx(current)}>
                      Download Word
                    </Button>
                    {current.archived_at ? (
                      <Button variant="secondary" size="sm" icon={<ArchiveRestore size={14} />} disabled={busy} onClick={() => setArchived(current.id, false)}>
                        Restore
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" icon={<Archive size={14} />} disabled={busy} onClick={() => setArchived(current.id, true)}>
                        Archive
                      </Button>
                    )}
                    <Button variant="destructive" size="sm" disabled={busy} onClick={() => remove(current.id)}>
                      Delete
                    </Button>
                  </div>
                </div>

                <EvidencePanel evidence={current.evidence ?? []} />

                <div className="mt-6 space-y-8">
                  {(current.content?.sections ?? []).map((s) => (
                    <section key={s.key}>
                      <h3 className="border-b border-border pb-1 text-heading-md text-text-primary">{s.title}</h3>
                      <pre className="mt-3 whitespace-pre-wrap font-sans text-body-md leading-6 text-text-secondary">{s.content}</pre>
                      {sectionBlocks(s).map((b, i) => (
                        <BlockView key={`${s.key}-block-${i}`} block={b} />
                      ))}
                    </section>
                  ))}
                </div>
              </article>
            )}
          </section>
        </div>
      )}

      {enrichOpen && current && organization && (
        <AgentChatPanel
          orgId={organization.id}
          userId={user?.id}
          workstreams={workstreams}
          initialAgentCode={enrichAgentCode}
          pageContext={enrichContext}
          onClose={() => {
            setEnrichOpen(false)
            refreshDoc(current.id)
          }}
        />
      )}
    </div>
  )
}

// ─── Enrichment blocks (agent-added tables, visuals, diagram refs) ────────────

function BlockView({ block }: { block: SectionBlock }) {
  if (block.kind === 'table') {
    return (
      <div className="mt-4">
        {block.title ? <div className="mb-1.5 text-body-sm font-semibold text-text-primary">{block.title}</div> : null}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-body-sm">
            <thead className="bg-surface-muted/60">
              <tr>
                {block.columns.map((c, i) => (
                  <th key={i} className="text-label uppercase text-text-secondary text-left px-3 py-2 border-b border-border whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {r.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-text-secondary align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  if (block.kind === 'svg') {
    // Rendered via an img data URL so any script content is inert; the server-side
    // sanitizer in the deliverable tools remains the primary gate.
    return (
      <figure className="mt-4 rounded-lg border border-border bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(block.svg)}`}
          alt={block.title || 'Document visual'}
          className="w-full h-auto"
        />
        {block.title ? <figcaption className="mt-2 text-center text-body-sm text-text-tertiary">{block.title}</figcaption> : null}
      </figure>
    )
  }
  return (
    <Link
      href={`/diagram/${block.diagramId}`}
      className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface-muted/40 px-4 py-3 transition-colors hover:border-brand-200 hover:bg-brand-50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Network size={16} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body-sm font-medium text-text-primary">{block.title || 'Data-architecture diagram'}</span>
        <span className="block text-[11px] text-text-tertiary">Open in Data Studio</span>
      </span>
    </Link>
  )
}

function EvidencePanel({ evidence }: { evidence: { key: string; tool: string; ok: boolean; reason?: string }[] }) {
  if (!evidence.length) return null
  const filled = evidence.filter((e) => e.ok).length
  const missing = evidence.filter((e) => !e.ok)
  return (
    <div className="mt-5 rounded-lg border border-border bg-surface-muted/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-body-sm font-semibold text-text-primary">Provenance</h3>
        <span className="text-body-sm text-text-secondary">
          {filled} of {evidence.length} evidence slots filled
        </span>
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-1 text-body-sm sm:grid-cols-2">
        {evidence.map((e) => (
          <li key={e.key} className="flex items-start gap-1.5">
            <span className={`mt-0.5 shrink-0 ${e.ok ? 'text-status-green' : 'text-text-tertiary'}`}>
              {e.ok ? <Check size={12} /> : <X size={12} />}
            </span>
            <span className="text-text-secondary">
              <span className="font-medium text-text-primary">{e.key}</span> via <span className="font-mono">{e.tool}</span>
              {!e.ok && e.reason ? <span className="block text-text-tertiary">{e.reason}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {missing.length ? (
        <p className="mt-2 text-body-sm text-text-tertiary">
          Sections that depended on the unfilled slots say so explicitly. They were not filled with generic content.
        </p>
      ) : null}
    </div>
  )
}
