'use client'

// In-place review comments anchored to a single entity / bullet. A host (the public
// share page) supplies the context; without it CommentAnchor renders nothing, so the
// same read-only views are reused unchanged in the authed prep view.
//
// Markup is span-based (with `block` where needed) because anchors are rendered
// inside <li> and <span> content, where a <div> would be invalid.

import { createContext, useContext, useState } from 'react'

export interface ShareComment {
  id: string
  anchor_key: string
  anchor_label: string | null
  author_name: string
  body: string
  created_at: string
}

export interface CommentsApi {
  byAnchor: Map<string, ShareComment[]>
  add: (anchorKey: string, anchorLabel: string, body: string) => Promise<void>
  authorName: string
  setAuthorName: (name: string) => void
}

const Ctx = createContext<CommentsApi | null>(null)
export const CommentsProvider = Ctx.Provider
export function useComments(): CommentsApi | null {
  return useContext(Ctx)
}

const FIELD = 'w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/60 focus:border-[#2563EB] rounded px-2 py-1 text-[11px] text-[var(--m12-text)] outline-none'

export default function CommentAnchor({ anchor, label }: { anchor: string; label: string }) {
  const ctx = useComments()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  if (!ctx) return null

  const list = ctx.byAnchor.get(anchor) ?? []
  const post = async () => {
    const t = body.trim()
    if (!t) return
    setBusy(true)
    setErr(null)
    try {
      await ctx.add(anchor, label, t)
      setBody('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to post the comment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="relative inline-flex items-center shrink-0 ml-1 align-top">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={list.length ? `${list.length} comment${list.length === 1 ? '' : 's'}` : 'Add a comment'}
        aria-label={list.length ? `${list.length} comments` : 'Add a comment'}
        className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] leading-none transition-opacity ${
          list.length || open
            ? 'text-[#2563EB] bg-[#2563EB14] opacity-100'
            : 'text-[var(--m12-text-muted)] opacity-0 group-hover:opacity-100 focus:opacity-100'
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 4.5h10a1 1 0 011 1v4a1 1 0 01-1 1H7l-3 2.5V10.5a1 1 0 01-1-1v-4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        {list.length > 0 && <span className="font-semibold">{list.length}</span>}
      </button>

      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <span className="absolute right-0 top-5 z-50 block w-72 rounded-lg border border-[var(--m12-border)] bg-[var(--m12-bg-card)] shadow-xl p-2.5 text-left normal-case">
            <span className="block text-[9px] uppercase tracking-wide text-[var(--m12-text-muted)] mb-1.5">
              {list.length ? `${list.length} comment${list.length === 1 ? '' : 's'}` : 'Add a comment'}
            </span>

            {list.length > 0 && (
              <span className="block max-h-40 overflow-y-auto mb-2">
                {list.map((c) => (
                  <span key={c.id} className="block mb-2 last:mb-0">
                    <span className="block text-[10px] font-semibold text-[var(--m12-text)]">{c.author_name}</span>
                    <span className="block text-[11px] text-[var(--m12-text-secondary)] leading-snug whitespace-pre-wrap">{c.body}</span>
                  </span>
                ))}
              </span>
            )}

            <input value={ctx.authorName} onChange={(e) => ctx.setAuthorName(e.target.value)} placeholder="Your name" className={`${FIELD} mb-1.5`} />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post() }}
              rows={2}
              placeholder="Add a comment…"
              className={`${FIELD} resize-none`}
            />
            {err && <span className="block text-[10px] text-[#EF4444] mt-1">{err}</span>}
            <span className="flex items-center justify-end gap-1.5 mt-1.5">
              <button type="button" onClick={() => setOpen(false)} className="text-[10px] px-2 py-1 rounded border border-[var(--m12-border)]/60 text-[var(--m12-text-secondary)] hover:border-[var(--m12-border)]">Close</button>
              <button type="button" onClick={post} disabled={busy || !body.trim()} className="text-[10px] px-2 py-1 rounded font-medium text-white bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-40">{busy ? 'Posting…' : 'Comment'}</button>
            </span>
          </span>
        </>
      )}
    </span>
  )
}
