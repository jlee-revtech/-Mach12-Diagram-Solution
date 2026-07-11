'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Search, Plus, Crosshair, Trash2, MessageSquare } from 'lucide-react'
import { Button, EmptyState } from '@/components/common'
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
      className={`rounded-lg border border-border bg-white transition-all ${
        expanded ? 'shadow-card' : 'hover:shadow-card'
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
                className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                style={{ backgroundColor: region.color }}
              >
                {group.region} · {region.label}
              </span>
              {group.resolved && (
                <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-status-green-bg text-status-green">
                  Resolved
                </span>
              )}
              <span className="ml-auto text-[11px] text-text-tertiary">
                {group.comments.length}
              </span>
            </div>
            <div className="text-body-sm font-semibold text-text-primary leading-tight truncate">
              {cap?.name || 'Unknown capability'}
              {artifactName && (
                <span className="text-text-tertiary font-normal"> → {artifactName}</span>
              )}
            </div>
            {!expanded && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-text-secondary truncate">
                  {group.latest.author_name}:
                </span>
                <span className="text-[11px] text-text-tertiary truncate flex-1">
                  {group.latest.body}
                </span>
                <span className="text-[11px] text-text-tertiary shrink-0">
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
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Crosshair size={12} />}
                  onClick={(e) => { e.stopPropagation(); onJump() }}
                  title="Highlight on canvas"
                >
                  Show on diagram
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`ml-auto ${
                    group.resolved
                      ? 'text-amber-700 hover:text-amber-700 hover:bg-amber-50'
                      : 'text-status-green hover:text-status-green hover:bg-status-green-bg'
                  }`}
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
                >
                  {group.resolved ? 'Reopen' : 'Resolve'}
                </Button>
              </div>
              {group.resolved && group.resolvedBy && (
                <div className="text-[11px] text-status-green">
                  Resolved by {group.resolvedBy}
                </div>
              )}

              {/* Comments */}
              <div className="space-y-2">
                {group.comments.map(c => (
                  <div key={c.id} className="rounded-lg bg-surface-muted/60 border border-border px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-body-sm font-medium text-text-primary">{c.author_name}</span>
                      <span className="text-[11px] text-text-tertiary" title={fullTime(c.created_at)}>
                        {relTime(c.created_at)}
                      </span>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          icon={<Trash2 size={12} />}
                          aria-label="Delete comment"
                          title="Delete (owner)"
                          className="ml-auto h-6 w-6 text-text-tertiary hover:text-red-600 hover:bg-red-50"
                          onClick={() => { if (confirm('Delete this comment?')) removeComment(c.id) }}
                        />
                      )}
                    </div>
                    <div className="text-body-sm text-text-secondary whitespace-pre-wrap break-words">
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
                  className="w-full h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none"
                />
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Reply..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none resize-none"
                />
                <div className="flex items-center justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!name.trim() || !reply.trim() || busy}
                  >
                    {busy ? 'Posting...' : 'Reply'}
                  </Button>
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
    <div className="rounded-lg border-2 border-brand-300 bg-brand-50 overflow-hidden">
      <div className="flex">
        <div className="w-1 shrink-0" style={{ backgroundColor: region.color }} />
        <div className="flex-1 min-w-0 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: region.color }}
            >
              {pendingNewAnchor.region} · {region.label}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-brand-600">
              New comment
            </span>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<X size={12} />}
              aria-label="Cancel"
              title="Cancel"
              className="ml-auto h-6 w-6"
              onClick={onCancel}
            />
          </div>
          <div className="text-body-sm font-semibold text-text-primary leading-tight truncate mb-2">
            {cap?.name || 'Unknown'}
            {artifactName && <span className="text-text-tertiary font-normal"> → {artifactName}</span>}
          </div>
          <form onSubmit={submit} className="space-y-1.5">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              autoFocus={!commenterName}
              className="w-full h-9 px-3 rounded-lg border border-border bg-white text-body-sm text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none"
            />
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Comment..."
              autoFocus={!!commenterName}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-body-sm text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none resize-none"
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onCancel} type="button">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!name.trim() || !body.trim() || busy}
              >
                {busy ? 'Posting...' : 'Post'}
              </Button>
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
    <div className="fixed top-0 right-0 bottom-0 z-40 w-[380px] max-w-[92vw] bg-white border-l border-border shadow-modal flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-heading-sm font-display text-text-primary">Comments</h2>
          <span className="text-[11px] text-text-tertiary">
            {groups.length} thread{groups.length === 1 ? '' : 's'}
            {totalUnresolved > 0 && (
              <span className="ml-1 text-status-yellow">· {totalUnresolved} unresolved</span>
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={<X size={14} />}
            aria-label="Close"
            title="Close"
            className="ml-auto"
            onClick={() => setOpen(false)}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search comments..."
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none"
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
                className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-md border transition-colors ${
                  active
                    ? `border-transparent text-white ${color ? '' : 'bg-brand-500'}`
                    : 'border-border text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                }`}
                style={active && color ? { backgroundColor: color } : undefined}
              >
                {label}
              </button>
            )
          })}
          <button
            onClick={() => setSort(s => s === 'recent' ? 'capability' : 'recent')}
            className="ml-auto text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-md border border-border text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors"
            title="Toggle sort"
          >
            Sort: {sort === 'recent' ? 'recent' : 'by cap'}
          </button>
        </div>
      </div>

      {/* New-comment CTA / pick-anchor banner */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        {pickingAnchor && !pendingNewAnchor ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-brand-50 border border-brand-200 text-[11px] text-text-primary">
            <Crosshair size={12} className="shrink-0 text-brand-600" />
            <span className="flex-1">Click any region of the diagram to anchor your comment.</span>
            <button
              onClick={() => setPickingAnchor(false)}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-text-tertiary hover:bg-surface-muted transition-colors"
            >
              ESC
            </button>
          </div>
        ) : pendingNewAnchor ? (
          <NewCommentComposer onCancel={() => setPendingNewAnchor(null)} />
        ) : (
          <button
            onClick={() => { setPickingAnchor(true); setSelectedThreadKey(null) }}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-wider px-3 py-2 rounded-lg border border-dashed border-border text-text-secondary hover:border-brand-500/50 hover:text-brand-600 transition-colors"
          >
            <Plus size={12} className="shrink-0" />
            New comment
          </button>
        )}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0 bg-surface-muted/40">
        {sorted.length === 0 ? (
          <EmptyState
            variant="inline"
            compact
            icon={<MessageSquare size={20} />}
            title={
              search.trim()
                ? 'No comments match your search'
                : filter === 'unresolved'
                ? 'No open threads'
                : 'No comments yet'
            }
            description={filter === 'unresolved' && !search.trim() ? 'Nice work!' : undefined}
          />
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
