'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, Download, FileUp, Network, Send, Sparkles, User, X } from 'lucide-react'
import type { Workstream } from '@/lib/workstream/types'
import type { Recommendation, Citation } from '@/lib/agents/types'
import { WorkstreamIcon } from '@/components/workstream/WorkstreamIcon'
import { WORKSTREAM_BY_CODE } from '@/lib/workstream/catalog'
import DataArchitectureDialog from '@/components/process/DataArchitectureDialog'
import { Button } from '@/components/common'

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
  // Prior history the user chose to reload (.md download from an earlier
  // session). Sent to the agent as background context, never persisted.
  const [loadedContext, setLoadedContext] = useState<{ name: string; text: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const historyInputRef = useRef<HTMLInputElement>(null)

  // The workstream this agent speaks for (enterprise orchestrator has none).
  const workstream = agentCode === 'enterprise' ? null : workstreams.find((w) => w.code === agentCode) ?? null

  useEffect(() => { if (initialAgentCode) setAgentCode(initialAgentCode) }, [initialAgentCode])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, status])

  // Conversations are fresh by design: nothing is stored server-side. Switching
  // agents clears the transcript; Download preserves it as a .md the user can
  // reload into a future session.
  useEffect(() => {
    setMessages([])
  }, [orgId, agentCode])

  const agentMeta = agentCode === 'enterprise'
    ? { name: 'Enterprise Architect', tagline: 'Cross-workstream synthesis & routing', color: '#2563EB', icon: 'portfolio' as const }
    : (() => { const w = workstreams.find((x) => x.code === agentCode); const c = WORKSTREAM_BY_CODE[agentCode]; return { name: w?.name || c?.name || agentCode, tagline: c?.agentTagline || '', color: w?.color || '#2563EB', icon: (w?.icon || c?.icon || 'target') as string } })()

  // Serialize the visible transcript as a portable markdown file.
  const downloadHistory = useCallback(() => {
    if (messages.length === 0) return
    const stamp = new Date()
    const lines: string[] = [
      `# ${agentMeta.name} conversation`,
      `_Exported ${stamp.toLocaleString()} from Mach12 Studio_`,
      '',
    ]
    for (const m of messages) {
      lines.push(m.role === 'user' ? '## You' : `## ${agentMeta.name}`)
      lines.push('')
      lines.push(m.text)
      if (m.recommendations?.length) {
        lines.push('', '**Recommendations:**')
        for (const r of m.recommendations) lines.push(`- [${r.pillar}] ${r.title}: ${r.detail}`)
      }
      if (m.citations?.length) {
        lines.push('', '**Sources:** ' + m.citations.map((c) => c.sourceTitle || c.sourceCode).join('; '))
      }
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const d = stamp.toISOString().slice(0, 16).replace(/[:T]/g, '-')
    a.href = url
    a.download = `${agentCode}-conversation-${d}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [messages, agentCode, agentMeta.name])

  const loadHistoryFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    setLoadedContext({ name: file.name, text: text.slice(0, 60_000) })
  }, [])

  const send = useCallback(async () => {
    const q = input.trim()
    if (!q || busy) return
    const next = [...messages, { role: 'user' as const, text: q }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setStatus('Thinking...')
    try {
      const wire = next.map((m) => ({ role: m.role, content: m.text }))
      if (loadedContext) {
        wire.unshift({
          role: 'user',
          content: `Background: this is a prior conversation history I downloaded from an earlier session. Use it as context; do not repeat or summarize it unless I ask.\n\n---\n${loadedContext.text}\n---`,
        })
      }
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ agentCode, orgId, userId, messages: wire }),
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
          if (ev === 'status') setStatus(data.label + '...')
          else if (ev === 'message') { setMessages((m) => [...m, { role: 'assistant', text: data.text, recommendations: data.recommendations, citations: data.citations }]); setStatus(null) }
          else if (ev === 'error') { setMessages((m) => [...m, { role: 'assistant', text: `⚠️ ${data.error}` }]); setStatus(null) }
        }
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `⚠️ ${e instanceof Error ? e.message : 'Agent failed'}` }])
    } finally {
      setBusy(false); setStatus(null)
    }
  }, [input, busy, messages, agentCode, orgId, userId, loadedContext])

  return (
    <>
    <div className="fixed right-0 top-0 h-full z-50 w-full max-w-md bg-white border-l border-border shadow-modal flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="h-14 flex-shrink-0 flex items-center gap-3 px-4 border-b border-border">
        <Sparkles size={18} className="text-amber-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-body-md font-semibold text-text-primary truncate">{agentMeta.name}</div>
          {agentMeta.tagline && <div className="text-[10px] text-text-tertiary truncate">{agentMeta.tagline}</div>}
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${agentMeta.color}1A`, color: agentMeta.color }}>
          <WorkstreamIcon icon={agentMeta.icon} size={16} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={<Download size={14} />}
          title="Download conversation history (.md)"
          aria-label="Download conversation history"
          disabled={messages.length === 0}
          onClick={downloadHistory}
        />
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={<FileUp size={14} />}
          title="Load a downloaded conversation history as context"
          aria-label="Load conversation history"
          onClick={() => historyInputRef.current?.click()}
        />
        <input
          ref={historyInputRef}
          type="file"
          accept=".md,.txt"
          onChange={loadHistoryFile}
          className="hidden"
          aria-label="Load conversation history file"
        />
        <Button variant="ghost" size="sm" iconOnly icon={<X size={14} />} title="Close" aria-label="Close" onClick={onClose} />
      </div>

      {/* Agent picker */}
      <div className="px-4 py-2 border-b border-border">
        <select
          value={agentCode}
          onChange={(e) => { setAgentCode(e.target.value); setMessages([]) }}
          aria-label="Choose consultant agent"
          className="w-full h-9 px-2 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        >
          <option value="enterprise">Enterprise Architect (orchestrator)</option>
          {workstreams.map((w) => <option key={w.id} value={w.code}>{w.name}</option>)}
        </select>
        {workstream && userId && (
          <button
            type="button"
            onClick={() => setArchOpen(true)}
            title="Generate a data-architecture diagram from this workstream's L3 process flows and assigned capabilities"
            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: agentMeta.color }}
          >
            <Network size={12} />
            Generate data architecture
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center text-center py-10">
            <Sparkles size={24} className="text-amber-500 mb-3" />
            <div className="text-[11px] text-text-tertiary max-w-xs">
              Ask about data architecture, integrations, process design, or persona mapping for this value stream. The agent reads your live model and the SAP / Dassian knowledge base.
            </div>
            <div className="text-[10px] text-text-tertiary/80 max-w-xs mt-2">
              Conversations start fresh each session. Use the download button to keep a copy, and the load button to bring one back as context.
            </div>
          </div>
        )}
        {loadedContext && (
          <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
            <FileUp size={12} className="text-brand-600 shrink-0" />
            <span className="flex-1 min-w-0 text-[11px] text-brand-700 truncate">
              Context loaded: {loadedContext.name}
            </span>
            <button
              type="button"
              onClick={() => setLoadedContext(null)}
              aria-label="Remove loaded history"
              className="text-brand-600 hover:text-brand-700 shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-brand-500 text-white' : 'bg-amber-100'}`}>
              {m.role === 'user' ? <User size={14} /> : <Bot size={14} className="text-amber-700" />}
            </div>
            <div className={`min-w-0 max-w-[85%] ${m.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block text-left rounded-lg px-3 py-2 text-body-sm leading-relaxed whitespace-pre-wrap animate-slide-in-up ${m.role === 'user' ? 'bg-brand-500 text-white rounded-tr-sm' : 'bg-white border border-border rounded-tl-sm text-text-secondary'}`}>
                {m.text}
              </div>
              {m.recommendations && m.recommendations.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {m.recommendations.map((r, j) => (
                    <div key={j} className="bg-surface-muted border-l-2 rounded-r-lg px-3 py-2 text-left" style={{ borderColor: PILLAR_COLOR[r.pillar] || '#2563EB' }}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{ color: PILLAR_COLOR[r.pillar], backgroundColor: `${PILLAR_COLOR[r.pillar]}1A` }}>{r.pillar}</span>
                        <span className="text-[11px] font-semibold text-text-primary">{r.title}</span>
                      </div>
                      <div className="text-[11px] text-text-secondary">{r.detail}</div>
                      {r.rationale && <div className="text-[10px] text-text-tertiary mt-0.5 italic">{r.rationale}</div>}
                    </div>
                  ))}
                </div>
              )}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.citations.map((c, j) => (
                    <span key={j} className="text-[10px] text-text-tertiary bg-surface-muted border border-border rounded px-1.5 py-0.5" title={c.sourceTitle}>
                      {c.sourceTitle || c.sourceCode}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {status && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-amber-100">
              <Bot size={14} className="text-amber-700" />
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg rounded-tl-sm bg-white border border-border px-3 py-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-brand-300 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-brand-300 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-brand-300 animate-bounce [animation-delay:300ms]" />
              </span>
              <span className="text-[11px] text-text-tertiary">{status}</span>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={`Ask the ${agentMeta.name}...`}
            rows={2}
            disabled={busy}
            className="flex-1 min-h-[40px] max-h-24 px-3 py-2 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary resize-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none disabled:opacity-60"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            title="Send"
            aria-label="Send"
            className="h-10 w-10 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-30 flex items-center justify-center shrink-0 transition-colors"
          >
            <Send size={16} />
          </button>
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
