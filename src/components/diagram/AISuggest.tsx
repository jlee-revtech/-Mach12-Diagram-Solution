'use client'

import { useState, useCallback } from 'react'
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
        <div className="text-[10px] uppercase tracking-widest text-[#06B6D4] font-[family-name:var(--font-space-mono)] font-bold">
          AI Suggestions
        </div>
      </div>

      {!fetched && !loading && (
        <button
          onClick={handleSuggest}
          className="w-full bg-[#151E2E] hover:bg-[#1A2435] border border-[#374A5E]/40 hover:border-[#06B6D4]/40 rounded-lg px-3 py-2.5 text-xs text-[#64748B] hover:text-[#06B6D4] transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-[#06B6D4] font-bold font-[family-name:var(--font-space-mono)] text-[10px]">AI</span>
          Suggest data elements for {sourceNode.data.label} → {targetNode.data.label}
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-3">
          <div className="w-3 h-3 border-2 border-[#06B6D4] border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] text-[#64748B]">Getting suggestions...</span>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <button
            onClick={handleAcceptAll}
            className="w-full text-[10px] text-[#06B6D4] hover:text-[#22D3EE] font-medium py-1 transition-colors"
          >
            Accept all ({suggestions.length})
          </button>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleAccept(s)}
              className="w-full flex items-center gap-2 bg-[#151E2E] hover:bg-[#1A2435] border border-[#374A5E]/30 hover:border-[#06B6D4]/40 rounded-lg px-3 py-2 text-left transition-colors group"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] shrink-0 opacity-50 group-hover:opacity-100" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-[#CBD5E1] group-hover:text-[#F8FAFC] truncate">
                  {s.name}
                </div>
                <div className="text-[9px] text-[#374A5E] group-hover:text-[#64748B]">
                  {s.elementType?.replace('_', ' ')}
                  {s.description && ` — ${s.description}`}
                </div>
              </div>
              <span className="text-[10px] text-[#374A5E] group-hover:text-[#06B6D4] shrink-0">+</span>
            </button>
          ))}
        </div>
      )}

      {fetched && suggestions.length === 0 && !loading && (
        <div className="text-[10px] text-[#374A5E] text-center py-2">
          All suggestions accepted
        </div>
      )}
    </div>
  )
}
