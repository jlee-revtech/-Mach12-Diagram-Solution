'use client'

import { useState, useCallback } from 'react'
import { useProcessStore } from '@/lib/process/store'

interface GenNode { name: string; description?: string; children?: GenNode[] }

// Generate a process hierarchy from a prompt. If a node is selected, children
// are generated one level below it; otherwise top-level scenarios are created.
export default function ProcessAIPanel({ onClose }: { onClose: () => void }) {
  const nodes = useProcessStore(s => s.nodes)
  const selectedNodeId = useProcessStore(s => s.selectedNodeId)
  const addNode = useProcessStore(s => s.addNode)
  const updateNode = useProcessStore(s => s.updateNode)

  const target = nodes.find(n => n.id === selectedNodeId) || null
  const targetLevel = target?.level ?? 0
  const canTarget = !target || target.level < 3

  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTree = useCallback(async (children: GenNode[], parentId: string | null, parentLevel: number) => {
    for (const c of children) {
      const level = Math.min(parentLevel + 1, 3)
      const id = await addNode(c.name, parentId, level)
      if (!id) continue
      if (c.description) await updateNode(id, { description: c.description })
      if (c.children?.length && level < 3) await createTree(c.children, id, level)
    }
  }, [addNode, updateNode])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || busy) return
    setBusy(true); setError(null)
    try {
      const existing = target
        ? nodes.filter(n => n.parent_id === target.id).map(n => n.name)
        : nodes.filter(n => !n.parent_id).map(n => n.name)
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process-generate',
          prompt,
          context: { targetName: target?.name, targetLevel, existing },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.children) throw new Error(data.error || 'Generation failed')
      await createTree(data.children as GenNode[], target?.id ?? null, targetLevel)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
      setBusy(false)
    }
  }, [prompt, busy, target, targetLevel, nodes, createTree, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-[30rem] max-w-[92vw] bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/60 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--m12-border)]/40">
          <h3 className="text-sm font-semibold text-[var(--m12-text)]">Generate process hierarchy</h3>
          <button onClick={onClose} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="p-5">
          <p className="text-xs text-[var(--m12-text-muted)] mb-3">
            {target
              ? `Generates ${targetLevel === 1 ? 'process groups and processes' : 'processes'} under "${target.name}".`
              : 'Generates end-to-end scenarios with their groups and processes.'}
          </p>
          {!canTarget && (
            <div className="text-[11px] text-[#EAB308] mb-3">The selected node is a leaf process (L3) — pick a higher node or deselect to generate scenarios.</div>
          )}
          <textarea
            autoFocus
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={4}
            placeholder="e.g. A&D contract manufacturer's Source-to-Pay including subcontracts and flowdowns"
            className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 rounded-lg px-3 py-2 text-sm text-[var(--m12-text)] focus:outline-none focus:border-[#0EA5E9]/60 resize-y mb-3"
          />
          {error && <div className="text-[11px] text-red-400 mb-3">{error}</div>}
          <button
            onClick={handleGenerate}
            disabled={busy || !prompt.trim() || !canTarget}
            className="w-full flex items-center justify-center gap-2 bg-[#0EA5E9] hover:bg-[#38BDF8] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
