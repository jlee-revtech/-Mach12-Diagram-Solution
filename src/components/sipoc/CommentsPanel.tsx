'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { SipocRegion } from '@/lib/sipoc/types'

const REGION: Record<SipocRegion, { label: string; color: string }> = {
  S: { label: 'Suppliers', color: '#F97316' },
  I: { label: 'Inputs',    color: '#EAB308' },
  P: { label: 'Process',   color: '#2563EB' },
  O: { label: 'Outputs',   color: '#10B981' },
  C: { label: 'Customers', color: '#8B5CF6' },
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export default function CommentsPanel() {
  const anchor = useSIPOCStore(s => s.commentsAnchorOpen)
  const setAnchor = useSIPOCStore(s => s.setCommentsAnchor)
  const comments = useSIPOCStore(s => s.comments)
  const capabilities = useSIPOCStore(s => s.capabilities)
  const inputs = useSIPOCStore(s => s.inputs)
  const outputs = useSIPOCStore(s => s.outputs)
  const informationProducts = useSIPOCStore(s => s.informationProducts)
  const readOnly = useSIPOCStore(s => s.readOnly)
  const commenterName = useSIPOCStore(s => s.commenterName)
  const setCommenterName = useSIPOCStore(s => s.setCommenterName)
  const addComment = useSIPOCStore(s => s.addComment)
  const removeComment = useSIPOCStore(s => s.removeComment)

  const [name, setName] = useState(commenterName)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { setName(commenterName) }, [commenterName])

  const open = anchor !== null

  // Resolve the human-friendly anchor label
  const anchorLabel = useMemo(() => {
    if (!anchor) return ''
    const cap = capabilities.find(c => c.id === anchor.capability_id)
    if (!cap) return ''
    const region = REGION[anchor.region]
    if (!anchor.item_id) return `${cap.name} → ${region.label}`
    // Item is either input or output
    const allInputs = Object.values(inputs).flat()
    const allOutputs = Object.values(outputs).flat()
    const item = allInputs.find(i => i.id === anchor.item_id) || allOutputs.find(o => o.id === anchor.item_id)
    if (!item) return `${cap.name} → ${region.label}`
    const ip = informationProducts.find(p => p.id === item.information_product_id)
    return `${cap.name} → ${region.label} → ${ip?.name || 'item'}`
  }, [anchor, capabilities, inputs, outputs, informationProducts])

  const visible = useMemo(() => {
    if (!anchor) return []
    return comments
      .filter(c =>
        c.capability_id === anchor.capability_id &&
        c.region === anchor.region &&
        (c.item_id || null) === (anchor.item_id || null)
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }, [comments, anchor])

  if (!open || !anchor) return null

  const region = REGION[anchor.region]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !body.trim() || submitting) return
    setSubmitting(true)
    setCommenterName(name.trim())
    const ok = await addComment({
      capability_id: anchor.capability_id,
      region: anchor.region,
      item_type: anchor.item_id ? 'item' : null,
      item_id: anchor.item_id,
      author_name: name.trim(),
      body: body.trim(),
    })
    setSubmitting(false)
    if (ok) setBody('')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={() => setAnchor(null)}
      />
      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-[380px] max-w-[92vw] bg-[var(--m12-bg-card)] border-l border-[var(--m12-border)]/40 shadow-2xl flex flex-col">
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b border-[var(--m12-border)]/30 shrink-0"
          style={{ backgroundColor: `${region.color}10` }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs font-[family-name:var(--font-orbitron)] shadow-sm shrink-0"
            style={{ backgroundColor: region.color }}
          >
            {anchor.region}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[var(--m12-text-muted)]">
              Comments — {region.label}
            </div>
            <div className="text-xs font-semibold text-[var(--m12-text)] truncate" title={anchorLabel}>
              {anchorLabel}
            </div>
          </div>
          <button
            onClick={() => setAnchor(null)}
            className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors"
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {visible.length === 0 && (
            <div className="text-[11px] text-[var(--m12-text-muted)] italic text-center py-6">
              No comments yet. Start the conversation.
            </div>
          )}
          {visible.map(c => (
            <div key={c.id} className="rounded-lg border border-[var(--m12-border)]/25 bg-[var(--m12-bg)]/40 px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold text-[var(--m12-text)]">{c.author_name}</span>
                <span className="text-[9px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)]">
                  {formatTime(c.created_at)}
                </span>
                {!readOnly && (
                  <button
                    onClick={() => {
                      if (confirm('Delete this comment?')) removeComment(c.id)
                    }}
                    className="ml-auto text-[var(--m12-text-faint)] hover:text-red-400 transition-colors"
                    title="Delete (owner)"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="text-[12px] text-[var(--m12-text-secondary)] whitespace-pre-wrap break-words">
                {c.body}
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <form onSubmit={handleSubmit} className="border-t border-[var(--m12-border)]/30 px-4 py-3 space-y-2 shrink-0 bg-[var(--m12-bg)]/30">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            className="w-full text-[11px] px-2.5 py-1.5 rounded-md bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={`Comment on ${region.label.toLowerCase()}…`}
            rows={3}
            className="w-full text-[12px] px-2.5 py-1.5 rounded-md bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60 resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={!name.trim() || !body.trim() || submitting}
              className="text-[10px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider font-bold px-3 py-1.5 rounded-md bg-[#2563EB] text-white hover:bg-[#2563EB]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
