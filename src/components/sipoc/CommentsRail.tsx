'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import { anchorKey } from '@/lib/sipoc/types'
import type { SipocComment, SipocRegion } from '@/lib/sipoc/types'

const REGION: Record<SipocRegion, { label: string; color: string }> = {
  S: { label: 'Suppliers', color: '#F97316' },
  I: { label: 'Inputs',    color: '#EAB308' },
  P: { label: 'Process',   color: '#2563EB' },
  O: { label: 'Outputs',   color: '#10B981' },
  C: { label: 'Customers', color: '#8B5CF6' },
}

interface ThreadGroup {
  key: string
  capability_id: string
  region: SipocRegion
  item_id: string | null
  comments: SipocComment[]   // sorted by created_at asc
  latest: SipocComment
  unread: number
  resolved: boolean           // most recent comment carries resolution flag
  resolvedBy: string | null
}

function groupThreads(comments: SipocComment[]): ThreadGroup[] {
  const map = new Map<string, ThreadGroup>()
  for (const c of comments) {
    const key = anchorKey(c)
    let g = map.get(key)
    if (!g) {
      g = {
        key,
        capability_id: c.capability_id,
        region: c.region,
        item_id: c.item_id,
        comments: [],
        latest: c,
        unread: 0,
        resolved: false,
        resolvedBy: null,
      }
      map.set(key, g)
    }
    g.comments.push(c)
  }
  for (const g of map.values()) {
    g.comments.sort((a, b) => a.created_at.localeCompare(b.created_at))
    g.latest = g.comments[g.comments.length - 1]
    g.resolved = !!g.latest.resolved_at
    g.resolvedBy = g.latest.resolved_by_name
  }
  return [...map.values()]
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fullTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ─── Per-thread row ─────────────────────────────────────
function ThreadRow({ group, expanded, onToggle, onHover, onLeaveHover, onJump }: {
  group: ThreadGroup
  expanded: boolean
  onToggle: () => void
  onHover: () => void
  onLeaveHover: () => void
  onJump: () => void
}) {
  const capabilities = useSIPOCStore(s => s.capabilities)
  const inputs = useSIPOCStore(s => s.inputs)
  const outputs = useSIPOCStore(s => s.outputs)
  const ips = useSIPOCStore(s => s.informationProducts)
  const readOnly = useSIPOCStore(s => s.readOnly)
  const commenterName = useSIPOCStore(s => s.commenterName)
  const setCommenterName = useSIPOCStore(s => s.setCommenterName)
  const addComment = useSIPOCStore(s => s.addComment)
  const removeComment = useSIPOCStore(s => s.removeComment)
  const resolveThread = useSIPOCStore(s => s.resolveThread)
  const unresolveThread = useSIPOCStore(s => s.unresolveThread)

  const cap = capabilities.find(c => c.id === group.capability_id)
  const region = REGION[group.region]
  let artifactName: string | null = null
  if (group.item_id) {
    const item = Object.values(inputs).flat().find(i => i.id === group.item_id)
      || Object.values(outputs).flat().find(o => o.id === group.item_id)
    if (item) artifactName = ips.find(p => p.id === item.information_product_id)?.name || null
  }

  const [reply, setReply] = useState('')
  const [name, setName] = useState(commenterName)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setName(commenterName) }, [commenterName])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !reply.trim() || busy) return
    setBusy(true)
    setCommenterName(name.trim())
    const ok = await addComment({
      capability_id: group.capability_id,
      region: group.region,
      item_type: group.item_id ? 'item' : null,
      item_id: group.item_id,
      author_name: name.trim(),
      body: reply.trim(),
    })
    setBusy(false)
    if (ok) setReply('')
  }

  return (
    <div
      className={`rounded-lg border transition-colors ${
        expanded
          ? 'border-[var(--m12-border)]/60 bg-[var(--m12-bg-card)]'
          : 'border-[var(--m12-border)]/25 bg-[var(--m12-bg-card)]/60 hover:border-[var(--m12-border)]/45'
      } ${group.resolved ? 'opacity-70' : ''}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeaveHover}
    >
      {/* Region color stripe */}
      <div className="flex">
        <div className="w-1 shrink-0 rounded-l-lg" style={{ backgroundColor: region.color }} />
        <div className="flex-1 min-w-0">
          {/* Header row — always visible */}
          <button
            type="button"
            onClick={onToggle}
            className="w-full text-left px-3 py-2.5"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[8px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                style={{ backgroundColor: region.color }}
              >
                {group.region} · {region.label}
              </span>
              {group.resolved && (
                <span className="text-[8px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  Resolved
                </span>
              )}
              <span className="ml-auto text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
                {group.comments.length}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-[var(--m12-text)] leading-tight truncate">
              {cap?.name || 'Unknown capability'}
              {artifactName && (
                <span className="text-[var(--m12-text-muted)] font-normal"> → {artifactName}</span>
              )}
            </div>
            {!expanded && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-[var(--m12-text-secondary)] truncate">
                  {group.latest.author_name}:
                </span>
                <span className="text-[10px] text-[var(--m12-text-muted)] truncate flex-1">
                  {group.latest.body}
                </span>
                <span className="text-[9px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] shrink-0">
                  {relTime(group.latest.created_at)}
                </span>
              </div>
            )}
          </button>

          {/* Expanded body */}
          {expanded && (
            <div className="px-3 pb-3 space-y-2.5">
              {/* Jump to anchor + resolve toggle */}
              <div className="flex items-center gap-2 -mt-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onJump() }}
                  className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider px-2 py-1 rounded border border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:border-[var(--m12-border)] transition-colors"
                  title="Highlight on canvas"
                >
                  Show on diagram
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (group.resolved) {
                      unresolveThread({ capability_id: group.capability_id, region: group.region, item_id: group.item_id })
                    } else {
                      resolveThread(
                        { capability_id: group.capability_id, region: group.region, item_id: group.item_id },
                        name.trim() || commenterName.trim() || 'Reviewer',
                      )
                    }
                  }}
                  className={`ml-auto text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
                    group.resolved
                      ? 'border-amber-500/40 text-amber-500 hover:bg-amber-500/10'
                      : 'border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10'
                  }`}
                >
                  {group.resolved ? 'Reopen' : 'Resolve'}
                </button>
              </div>
              {group.resolved && group.resolvedBy && (
                <div className="text-[9px] text-emerald-500/70 font-[family-name:var(--font-space-mono)]">
                  Resolved by {group.resolvedBy}
                </div>
              )}

              {/* Comments */}
              <div className="space-y-2">
                {group.comments.map(c => (
                  <div key={c.id} className="rounded-md bg-[var(--m12-bg)]/40 border border-[var(--m12-border)]/15 px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold text-[var(--m12-text)]">{c.author_name}</span>
                      <span className="text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)]" title={fullTime(c.created_at)}>
                        {relTime(c.created_at)}
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => { if (confirm('Delete this comment?')) removeComment(c.id) }}
                          className="ml-auto text-[var(--m12-text-faint)] hover:text-red-400 transition-colors"
                          title="Delete (owner)"
                        >
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--m12-text-secondary)] whitespace-pre-wrap break-words">
                      {c.body}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply composer */}
              <form onSubmit={submit} className="space-y-1.5 pt-1">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full text-[11px] px-2 py-1 rounded-md bg-[var(--m12-bg)]/50 border border-[var(--m12-border)]/30 text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60"
                />
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Reply…"
                  rows={2}
                  className="w-full text-[12px] px-2 py-1 rounded-md bg-[var(--m12-bg)]/50 border border-[var(--m12-border)]/30 text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60 resize-none"
                />
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={!name.trim() || !reply.trim() || busy}
                    className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md bg-[#2563EB] text-white hover:bg-[#2563EB]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {busy ? 'Posting…' : 'Reply'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pending new-comment composer ───────────────────────
function NewCommentComposer({ onCancel }: { onCancel: () => void }) {
  const pendingNewAnchor = useSIPOCStore(s => s.pendingNewAnchor)
  const capabilities = useSIPOCStore(s => s.capabilities)
  const inputs = useSIPOCStore(s => s.inputs)
  const outputs = useSIPOCStore(s => s.outputs)
  const ips = useSIPOCStore(s => s.informationProducts)
  const commenterName = useSIPOCStore(s => s.commenterName)
  const setCommenterName = useSIPOCStore(s => s.setCommenterName)
  const addComment = useSIPOCStore(s => s.addComment)
  const setPendingNewAnchor = useSIPOCStore(s => s.setPendingNewAnchor)
  const setSelectedThreadKey = useSIPOCStore(s => s.setSelectedThreadKey)

  const [name, setName] = useState(commenterName)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setName(commenterName) }, [commenterName])

  if (!pendingNewAnchor) return null
  const cap = capabilities.find(c => c.id === pendingNewAnchor.capability_id)
  const region = REGION[pendingNewAnchor.region]
  let artifactName: string | null = null
  if (pendingNewAnchor.item_id) {
    const item = Object.values(inputs).flat().find(i => i.id === pendingNewAnchor.item_id)
      || Object.values(outputs).flat().find(o => o.id === pendingNewAnchor.item_id)
    if (item) artifactName = ips.find(p => p.id === item.information_product_id)?.name || null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !body.trim() || busy) return
    setBusy(true)
    setCommenterName(name.trim())
    const created = await addComment({
      capability_id: pendingNewAnchor.capability_id,
      region: pendingNewAnchor.region,
      item_type: pendingNewAnchor.item_id ? 'item' : null,
      item_id: pendingNewAnchor.item_id,
      author_name: name.trim(),
      body: body.trim(),
    })
    setBusy(false)
    if (created) {
      setBody('')
      setPendingNewAnchor(null)
      // Auto-expand the newly created thread
      const key = `${created.capability_id}::${created.region}::${created.item_id || 'none'}`
      setSelectedThreadKey(key)
    }
  }

  return (
    <div className="rounded-lg border-2 border-[#2563EB]/40 bg-[#2563EB]/5 overflow-hidden">
      <div className="flex">
        <div className="w-1 shrink-0" style={{ backgroundColor: region.color }} />
        <div className="flex-1 min-w-0 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-[8px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: region.color }}
            >
              {pendingNewAnchor.region} · {region.label}
            </span>
            <span className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[#2563EB]/80">
              New comment
            </span>
            <button
              type="button"
              onClick={onCancel}
              className="ml-auto text-[var(--m12-text-faint)] hover:text-[var(--m12-text)] transition-colors"
              title="Cancel"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="text-[11px] font-semibold text-[var(--m12-text)] leading-tight truncate mb-2">
            {cap?.name || 'Unknown'}
            {artifactName && <span className="text-[var(--m12-text-muted)] font-normal"> → {artifactName}</span>}
          </div>
          <form onSubmit={submit} className="space-y-1.5">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              autoFocus={!commenterName}
              className="w-full text-[11px] px-2 py-1 rounded-md bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60"
            />
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Comment…"
              autoFocus={!!commenterName}
              rows={3}
              className="w-full text-[12px] px-2 py-1 rounded-md bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60 resize-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider px-2 py-1 rounded text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || !body.trim() || busy}
                className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md bg-[#2563EB] text-white hover:bg-[#2563EB]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Main rail ──────────────────────────────────────────
type FilterChip = 'all' | 'unresolved' | 'resolved' | SipocRegion
type SortMode = 'recent' | 'capability'

export default function CommentsRail() {
  const open = useSIPOCStore(s => s.commentsRailOpen)
  const setOpen = useSIPOCStore(s => s.setCommentsRailOpen)
  const comments = useSIPOCStore(s => s.comments)
  const capabilities = useSIPOCStore(s => s.capabilities)
  const selectedThreadKey = useSIPOCStore(s => s.selectedThreadKey)
  const setSelectedThreadKey = useSIPOCStore(s => s.setSelectedThreadKey)
  const pickingAnchor = useSIPOCStore(s => s.pickingAnchor)
  const setPickingAnchor = useSIPOCStore(s => s.setPickingAnchor)
  const setHighlightedAnchorKey = useSIPOCStore(s => s.setHighlightedAnchorKey)
  const pendingNewAnchor = useSIPOCStore(s => s.pendingNewAnchor)
  const setPendingNewAnchor = useSIPOCStore(s => s.setPendingNewAnchor)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterChip>('unresolved')
  const [sort, setSort] = useState<SortMode>('recent')

  // Cancel anchor-pick on Escape
  useEffect(() => {
    if (!pickingAnchor) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPickingAnchor(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickingAnchor, setPickingAnchor])

  const groups = useMemo(() => groupThreads(comments), [comments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return groups.filter(g => {
      // Filter chip
      if (filter === 'unresolved' && g.resolved) return false
      if (filter === 'resolved' && !g.resolved) return false
      if (filter !== 'all' && filter !== 'unresolved' && filter !== 'resolved' && g.region !== filter) return false
      // Search
      if (q) {
        const hay = [
          capabilities.find(c => c.id === g.capability_id)?.name || '',
          ...g.comments.map(c => c.body),
          ...g.comments.map(c => c.author_name),
        ].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [groups, filter, search, capabilities])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sort === 'recent') {
      arr.sort((a, b) => b.latest.created_at.localeCompare(a.latest.created_at))
    } else {
      arr.sort((a, b) => {
        const an = capabilities.find(c => c.id === a.capability_id)?.name || ''
        const bn = capabilities.find(c => c.id === b.capability_id)?.name || ''
        if (an !== bn) return an.localeCompare(bn)
        return a.region.localeCompare(b.region)
      })
    }
    return arr
  }, [filtered, sort, capabilities])

  const totalUnresolved = groups.filter(g => !g.resolved).length

  const handleJump = (g: ThreadGroup) => {
    setHighlightedAnchorKey(g.key)
    // Scroll to the matching DOM node, if mounted
    const node = document.querySelector<HTMLElement>(`[data-anchor-key="${g.key}"]`)
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Clear highlight after pulse
    setTimeout(() => setHighlightedAnchorKey(null), 2200)
  }

  if (!open) return null

  return (
    <div className="fixed top-0 right-0 bottom-0 z-40 w-[380px] max-w-[92vw] bg-[var(--m12-bg-card)] border-l border-[var(--m12-border)]/40 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--m12-border)]/30 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-sm font-bold text-[var(--m12-text)]">Comments</div>
          <span className="text-[9px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)]">
            {groups.length} thread{groups.length === 1 ? '' : 's'}
            {totalUnresolved > 0 && (
              <span className="ml-1 text-amber-500">· {totalUnresolved} unresolved</span>
            )}
          </span>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors"
            title="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--m12-text-faint)]">
            <circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7.5 7.5L10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search comments…"
            className="w-full text-[11px] pl-7 pr-2 py-1.5 rounded-md bg-[var(--m12-bg)]/50 border border-[var(--m12-border)]/30 text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {(['unresolved','all','resolved','S','I','P','O','C'] as FilterChip[]).map(f => {
            const active = filter === f
            const color = (f === 'S' || f === 'I' || f === 'P' || f === 'O' || f === 'C') ? REGION[f].color : null
            const label = f === 'unresolved' ? 'Open' : f === 'all' ? 'All' : f === 'resolved' ? 'Done' : f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider px-2 py-1 rounded-md border transition-colors ${
                  active
                    ? 'border-transparent text-white'
                    : 'border-[var(--m12-border)]/30 text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]'
                }`}
                style={active ? { backgroundColor: color || '#2563EB' } : undefined}
              >
                {label}
              </button>
            )
          })}
          <button
            onClick={() => setSort(s => s === 'recent' ? 'capability' : 'recent')}
            className="ml-auto text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider px-2 py-1 rounded-md border border-[var(--m12-border)]/30 text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors"
            title="Toggle sort"
          >
            Sort: {sort === 'recent' ? 'recent' : 'by cap'}
          </button>
        </div>
      </div>

      {/* New-comment CTA / pick-anchor banner */}
      <div className="px-4 py-2 border-b border-[var(--m12-border)]/20 shrink-0">
        {pickingAnchor && !pendingNewAnchor ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#2563EB]/10 border border-[#2563EB]/40 text-[10px] text-[var(--m12-text)]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[#2563EB]">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="6" cy="6" r="1.5" fill="currentColor" />
            </svg>
            <span className="flex-1">Click any region of the diagram to anchor your comment.</span>
            <button
              onClick={() => setPickingAnchor(false)}
              className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]"
            >
              ESC
            </button>
          </div>
        ) : pendingNewAnchor ? (
          <NewCommentComposer onCancel={() => setPendingNewAnchor(null)} />
        ) : (
          <button
            onClick={() => { setPickingAnchor(true); setSelectedThreadKey(null) }}
            className="w-full flex items-center justify-center gap-1.5 text-[10px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider px-3 py-2 rounded-md border border-dashed border-[var(--m12-border)]/50 text-[var(--m12-text-muted)] hover:border-[#2563EB]/50 hover:text-[#2563EB] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            New comment
          </button>
        )}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {sorted.length === 0 ? (
          <div className="text-[11px] text-[var(--m12-text-muted)] italic text-center py-10">
            {search.trim()
              ? 'No comments match your search.'
              : filter === 'unresolved'
              ? 'No open threads. Nice work!'
              : 'No comments yet.'}
          </div>
        ) : (
          sorted.map(g => (
            <ThreadRow
              key={g.key}
              group={g}
              expanded={selectedThreadKey === g.key}
              onToggle={() => setSelectedThreadKey(selectedThreadKey === g.key ? null : g.key)}
              onHover={() => setHighlightedAnchorKey(g.key)}
              onLeaveHover={() => setHighlightedAnchorKey(null)}
              onJump={() => handleJump(g)}
            />
          ))
        )}
      </div>
    </div>
  )
}
