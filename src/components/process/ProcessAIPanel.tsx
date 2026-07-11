'use client'

import { useState, useCallback } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/common'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-[30rem] max-w-[92vw] bg-white border border-border rounded-xl shadow-card-hover overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            <h3 className="text-heading-sm font-display text-text-primary">Generate process hierarchy</h3>
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={16} />} aria-label="Close" onClick={onClose} />
        </div>
        <div className="p-5">
          <p className="text-body-sm text-text-secondary mb-3">
            {target
              ? `Generates ${targetLevel === 1 ? 'process groups and processes' : 'processes'} under "${target.name}".`
              : 'Generates end-to-end scenarios with their groups and processes.'}
          </p>
          {!canTarget && (
            <div className="text-body-sm text-status-yellow bg-status-yellow-bg border border-amber-200 rounded-lg px-3 py-2 mb-3">
              The selected node is a leaf process (L3). Pick a higher node or deselect to generate scenarios.
            </div>
          )}
          <textarea
            autoFocus
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={4}
            placeholder="e.g. A&D contract manufacturer's Source-to-Pay including subcontracts and flowdowns"
            className="w-full bg-surface-input border border-border rounded-lg px-3 py-2 text-body-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none resize-y mb-3"
          />
          {error && <div className="text-body-sm text-status-red mb-3">{error}</div>}
          <Button
            fullWidth
            icon={<Sparkles size={14} />}
            loading={busy}
            disabled={!prompt.trim() || !canTarget}
            onClick={handleGenerate}
          >
            {busy ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      </div>
    </div>
  )
}
