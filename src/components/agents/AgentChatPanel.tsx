'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Workstream } from '@/lib/workstream/types'
import type { Recommendation, Citation } from '@/lib/agents/types'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'
import { WORKSTREAM_BY_CODE } from '@/lib/workstream/catalog'
import DataArchitectureDialog from '@/components/process/DataArchitectureDialog'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  recommendations?: Recommendation[]
  citations?: Citation[]
}

const PILLAR_COLOR: Record<string, string> = { People: '#8B5CF6', Process: '#0EA5E9', Data: '#10B981', Technology: '#F59E0B' }

function getToken(): string | null {
  try {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    return JSON.parse(localStorage.getItem(key) || '{}')?.access_token ?? null
  } catch { return null }
}

interface Props {
  orgId: string
  workstreams: Workstream[]
  initialAgentCode?: string
  userId?: string
  onClose: () => void
}

export default function AgentChatPanel({ orgId, workstreams, initialAgentCode, userId, onClose }: Props) {
  const [agentCode, setAgentCode] = useState(initialAgentCode || 'enterprise')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [archOpen, setArchOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // The workstream this agent speaks for (enterprise orchestrator has none).
  const workstream = agentCode === 'enterprise' ? null : workstreams.find((w) => w.code === agentCode) ?? null

  useEffect(() => { if (initialAgentCode) setAgentCode(initialAgentCode) }, [initialAgentCode])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, status])

  const agentMeta = agentCode === 'enterprise'
    ? { name: 'Enterprise Architect', tagline: 'Cross-workstream synthesis & routing', color: '#2563EB', icon: 'portfolio' as const }
    : (() => { const w = workstreams.find((x) => x.code === agentCode); const c = WORKSTREAM_BY_CODE[agentCode]; return { name: w?.name || c?.name || agentCode, tagline: c?.agentTagline || '', color: w?.color || '#2563EB', icon: (w?.icon || c?.icon || 'target') as string } })()

  const send = useCallback(async () => {
    const q = input.trim()
    if (!q || busy) return
    const next = [...messages, { role: 'user' as const, text: q }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setStatus('Thinking…')
    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ agentCode, orgId, messages: next.map((m) => ({ role: m.role, content: m.text })) }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Request failed (${res.status})`)
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let idx
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, idx); buf = buf.slice(idx + 2)
          const evMatch = block.match(/^event: (.+)$/m)
          const dataMatch = block.match(/^data: (.+)$/m)
          if (!evMatch || !dataMatch) continue
          const ev = evMatch[1]; const data = JSON.parse(dataMatch[1])
          if (ev === 'status') setStatus(data.label + '…')
          else if (ev === 'message') { setMessages((m) => [...m, { role: 'assistant', text: data.text, recommendations: data.recommendations, citations: data.citations }]); setStatus(null) }
          else if (ev === 'error') { setMessages((m) => [...m, { role: 'assistant', text: `⚠️ ${data.error}` }]); setStatus(null) }
        }
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `⚠️ ${e instanceof Error ? e.message : 'Agent failed'}` }])
    } finally {
      setBusy(false); setStatus(null)
    }
  }, [input, busy, messages, agentCode, orgId])

  return (
    <>
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--m12-bg-card)] border-l border-[var(--m12-border)]/60 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--m12-border)]/40">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${agentMeta.color}1A`, color: agentMeta.color }}>
          <WorkstreamIcon icon={agentMeta.icon} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--m12-text)] truncate">{agentMeta.name}</div>
          <div className="text-[10px] text-[var(--m12-text-muted)] truncate">{agentMeta.tagline}</div>
        </div>
        <button onClick={onClose} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]" title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>

      {/* Agent picker */}
      <div className="px-4 py-2 border-b border-[var(--m12-border)]/30">
        <select
          value={agentCode}
          onChange={(e) => { setAgentCode(e.target.value); setMessages([]) }}
          aria-label="Choose consultant agent"
          className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-2 py-1.5 text-xs text-[var(--m12-text)] focus:outline-none"
        >
          <option value="enterprise">Enterprise Architect (orchestrator)</option>
          {workstreams.map((w) => <option key={w.id} value={w.code}>{w.name}</option>)}
        </select>
        {workstream && userId && (
          <button
            type="button"
            onClick={() => setArchOpen(true)}
            title="Generate a data-architecture diagram from this workstream's L3 process flows and assigned capabilities"
            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium text-white transition-colors"
            style={{ backgroundColor: agentMeta.color }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="5" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.2" /><rect x="9" y="2.5" width="5" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.2" /><rect x="5.5" y="9.5" width="5" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.2" /><path d="M4.5 6.5v1.5a1 1 0 001 1h5a1 1 0 001-1V6.5M8 9.3V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
            Generate data architecture
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-10 text-[11px] text-[var(--m12-text-muted)]">
            Ask about data architecture, integrations, process design, or persona mapping for this value stream. The agent reads your live model and the SAP / Dassian knowledge base.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div className={`inline-block text-left rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap max-w-[92%] ${m.role === 'user' ? 'bg-[#2563EB]/15 text-[var(--m12-text)]' : 'bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 text-[var(--m12-text-secondary)]'}`}>
              {m.text}
            </div>
            {m.recommendations && m.recommendations.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {m.recommendations.map((r, j) => (
                  <div key={j} className="bg-[var(--m12-bg)] border-l-2 rounded-r-lg px-3 py-2 text-left" style={{ borderColor: PILLAR_COLOR[r.pillar] || '#2563EB' }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{ color: PILLAR_COLOR[r.pillar], backgroundColor: `${PILLAR_COLOR[r.pillar]}1A` }}>{r.pillar}</span>
                      <span className="text-[11px] font-semibold text-[var(--m12-text)]">{r.title}</span>
                    </div>
                    <div className="text-[11px] text-[var(--m12-text-secondary)]">{r.detail}</div>
                    {r.rationale && <div className="text-[10px] text-[var(--m12-text-muted)] mt-0.5 italic">{r.rationale}</div>}
                  </div>
                ))}
              </div>
            )}
            {m.citations && m.citations.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.citations.map((c, j) => (
                  <span key={j} className="text-[9px] text-[var(--m12-text-muted)] bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded px-1.5 py-0.5" title={c.sourceTitle}>
                    {c.sourceTitle || c.sourceCode}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {status && (
          <div className="flex items-center gap-2 text-[11px] text-[var(--m12-text-muted)]">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="animate-spin"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" /></svg>
            {status}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--m12-border)]/40 p-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={`Ask the ${agentMeta.name}…`}
            rows={2}
            disabled={busy}
            className="flex-1 resize-none bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-xs text-[var(--m12-text)] focus:outline-none focus:border-[#2563EB]/60 disabled:opacity-60"
          />
          <button onClick={send} disabled={busy || !input.trim()} className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 text-white rounded-lg px-3 py-2 text-xs font-medium transition-colors shrink-0">Send</button>
        </div>
      </div>
    </div>
    {archOpen && workstream && userId && (
      <DataArchitectureDialog
        orgId={orgId}
        userId={userId}
        workstream={{ id: workstream.id, name: workstream.name, ...(workstream.color ? { color: workstream.color } : {}) }}
        onClose={() => setArchOpen(false)}
      />
    )}
    </>
  )
}
