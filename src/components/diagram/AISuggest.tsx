'use client'

import { useState, useCallback } from 'react'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/common'
import { useDiagramStore } from '@/lib/diagram/store'

export default function AISuggest() {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [fetched, setFetched] = useState(false)

  const selectedEdgeId = useDiagramStore((s) => s.selectedEdgeId)
  const edges = useDiagramStore((s) => s.edges)
  const nodes = useDiagramStore((s) => s.nodes)
  const meta = useDiagramStore((s) => s.meta)
  const addDataElement = useDiagramStore((s) => s.addDataElement)

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId)
  const sourceNode = nodes.find((n) => n.id === selectedEdge?.source)
  const targetNode = nodes.find((n) => n.id === selectedEdge?.target)

  const handleSuggest = useCallback(async () => {
    if (!sourceNode || !targetNode) return
    setLoading(true)
    setSuggestions([])

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest',
          context: {
            sourceSystem: sourceNode.data.physicalSystem || sourceNode.data.label,
            targetSystem: targetNode.data.physicalSystem || targetNode.data.label,
            sourceType: sourceNode.data.systemType,
            targetType: targetNode.data.systemType,
            processContext: meta.processContext,
          },
        }),
      })
      const data = await res.json()
      if (data.suggestions) {
        setSuggestions(data.suggestions)
        setFetched(true)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [sourceNode, targetNode, meta])

  const handleAccept = useCallback(
    (suggestion: any) => {
      if (!selectedEdgeId) return
      addDataElement(selectedEdgeId, {
        name: suggestion.name,
        elementType: suggestion.elementType || 'custom',
        description: suggestion.description,
        attributes: suggestion.elementType === 'data_object'
          ? suggestion.attributes
          : undefined,
      })
      setSuggestions((prev) => prev.filter((s) => s.name !== suggestion.name))
    },
    [selectedEdgeId, addDataElement]
  )

  const handleAcceptAll = useCallback(() => {
    suggestions.forEach((s) => handleAccept(s))
  }, [suggestions, handleAccept])

  if (!selectedEdge || !sourceNode || !targetNode) return null

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-text-tertiary">
          <Sparkles size={12} className="text-amber-500" />
          AI Suggestions
        </div>
      </div>

      {!fetched && !loading && (
        <Button
          variant="ai"
          size="sm"
          fullWidth
          icon={<Sparkles size={12} />}
          onClick={handleSuggest}
          className="!h-auto py-2 whitespace-normal text-left"
        >
          Suggest data elements for {sourceNode.data.label} → {targetNode.data.label}
        </Button>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-3">
          <Loader2 size={14} className="animate-spin text-brand-500" />
          <span className="text-[10px] text-text-tertiary">Getting suggestions...</span>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <button
            onClick={handleAcceptAll}
            className="w-full text-[10px] text-brand-600 hover:text-brand-700 font-medium py-1 transition-colors"
          >
            Accept all ({suggestions.length})
          </button>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleAccept(s)}
              className="w-full flex items-center gap-2 bg-surface-muted hover:bg-brand-50 border border-border hover:border-brand-200 rounded-lg px-3 py-2 text-left transition-colors group"
            >
              <Sparkles size={12} className="text-amber-500 shrink-0 opacity-60 group-hover:opacity-100" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-text-secondary group-hover:text-text-primary truncate">
                  {s.name}
                </div>
                <div className="text-[10px] text-text-tertiary">
                  {s.elementType?.replace('_', ' ')}
                  {s.description && ` - ${s.description}`}
                </div>
              </div>
              <Plus size={12} className="text-text-tertiary group-hover:text-brand-600 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {fetched && suggestions.length === 0 && !loading && (
        <div className="text-[10px] text-text-tertiary text-center py-2">
          All suggestions accepted
        </div>
      )}
    </div>
  )
}
