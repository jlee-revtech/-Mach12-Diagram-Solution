'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { useDiagramStore } from '@/lib/diagram/store'
import type { SystemNode, DataFlowEdge } from '@/lib/diagram/types'

interface AICommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function AICommandPalette({ open, onClose }: AICommandPaletteProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'generate' | 'analyze'>('generate')
  const [analysis, setAnalysis] = useState<any>(null)
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const nodes = useDiagramStore((s) => s.nodes)
  const edges = useDiagramStore((s) => s.edges)
  const meta = useDiagramStore((s) => s.meta)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setError(null)
      setAnalysis(null)
      setImageData(null)
      setImageName(null)
    }
  }, [open])

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Extract base64 data (remove data:image/...;base64, prefix)
      setImageData(result)
    }
    reader.readAsDataURL(file)
    // Reset file input so same file can be selected again
    e.target.value = ''
  }, [])

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) onClose()
        else {
          setMode('generate')
          setPrompt('')
          // Parent handles opening
        }
      }
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() && !imageData) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', prompt: prompt.trim(), image: imageData }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI request failed')

      // Convert AI response to React Flow nodes and edges
      const store = useDiagramStore.getState()

      // Add systems as nodes
      const nodeIds: Record<string, string> = {}
      for (const sys of data.systems || []) {
        const id = `system-${uuid()}`
        nodeIds[sys.id] = id
        const newNode: SystemNode = {
          id,
          type: 'system',
          position: sys.position || { x: 100, y: 100 },
          data: {
            label: sys.label,
            systemType: sys.systemType || 'custom',
            physicalSystem: sys.physicalSystem,
          },
        }
        store.nodes.push(newNode)
      }

      // Add flows as edges
      for (const flow of data.flows || []) {
        const sourceId = nodeIds[flow.source]
        const targetId = nodeIds[flow.target]
        if (!sourceId || !targetId) continue

        const newEdge: DataFlowEdge = {
          id: `edge-${uuid()}`,
          source: sourceId,
          target: targetId,
          sourceHandle: flow.sourceHandle || 'right-src',
          targetHandle: flow.targetHandle || 'left-tgt',
          type: 'dataFlow',
          data: {
            direction: flow.direction || 'forward',
            dataElements: (flow.dataElements || []).map((el: any) => ({
              id: uuid(),
              name: el.name,
              elementType: el.elementType || 'custom',
              description: el.description,
              attributes: el.elementType === 'data_object'
                ? (el.attributes || []).map((a: any) => ({ id: uuid(), name: a.name }))
                : undefined,
            })),
          },
        }
        store.edges.push(newEdge)
      }

      // Trigger re-render
      useDiagramStore.setState({
        nodes: [...store.nodes],
        edges: [...store.edges],
      })

      setPrompt('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate diagram')
    } finally {
      setLoading(false)
    }
  }, [prompt, imageData, onClose])

  const handleAnalyze = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAnalysis(null)

    try {
      const context = {
        systems: nodes.map((n) => ({
          label: n.data.label,
          systemType: n.data.systemType,
          physicalSystem: n.data.physicalSystem,
        })),
        flows: edges.map((e) => ({
          source: nodes.find((n) => n.id === e.source)?.data.label || e.source,
          target: nodes.find((n) => n.id === e.target)?.data.label || e.target,
          dataElements: (e.data?.dataElements || []).map((el) => ({ name: el.name })),
        })),
        processContext: meta.processContext,
      }

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', context }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')

      setAnalysis(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }, [nodes, edges, meta])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-[#1A2435] border border-[#374A5E]/60 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Mode tabs */}
        <div className="flex border-b border-[#374A5E]/40">
          <button
            onClick={() => { setMode('generate'); setAnalysis(null) }}
            className={`flex-1 px-4 py-3 text-xs font-medium transition-colors ${
              mode === 'generate'
                ? 'text-[#06B6D4] border-b-2 border-[#06B6D4]'
                : 'text-[#64748B] hover:text-[#CBD5E1]'
            }`}
          >
            Generate Diagram
          </button>
          <button
            onClick={() => { setMode('analyze'); setAnalysis(null) }}
            className={`flex-1 px-4 py-3 text-xs font-medium transition-colors ${
              mode === 'analyze'
                ? 'text-[#06B6D4] border-b-2 border-[#06B6D4]'
                : 'text-[#64748B] hover:text-[#CBD5E1]'
            }`}
          >
            Analyze Diagram
          </button>
        </div>

        {mode === 'generate' ? (
          <div className="p-4">
            <div className="flex items-center gap-3 bg-[#151E2E] rounded-xl px-4 py-3 border border-[#374A5E]/40 focus-within:border-[#2563EB]">
              <span className="text-[#06B6D4] text-sm font-bold font-[family-name:var(--font-space-mono)]">AI</span>
              <input
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerate()}
                placeholder={imageData ? "Describe what to do with this image..." : "Describe your data architecture..."}
                className="flex-1 bg-transparent text-sm text-[#F8FAFC] outline-none placeholder:text-[#374A5E]"
                disabled={loading}
              />
              {/* Image upload button */}
              <button
                onClick={() => fileRef.current?.click()}
                title="Upload screenshot"
                className="text-[#64748B] hover:text-[#06B6D4] transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="5.5" cy="6.5" r="1" fill="currentColor"/><path d="M2 11l3-3 2 2 3-4 4 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {loading && (
                <div className="w-4 h-4 border-2 border-[#06B6D4] border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Image preview */}
            {imageData && (
              <div className="mt-2 relative inline-block">
                <img
                  src={imageData}
                  alt="Uploaded screenshot"
                  className="max-h-32 rounded-lg border border-[#374A5E]/40"
                />
                <button
                  onClick={() => { setImageData(null); setImageName(null) }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#1A2435] border border-[#374A5E] rounded-full flex items-center justify-center text-[#64748B] hover:text-red-400 transition-colors"
                >
                  <svg width="8" height="8" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
                <div className="text-[9px] text-[#374A5E] mt-1 truncate max-w-[200px]">{imageName}</div>
              </div>
            )}

            {/* Quick prompts */}
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                'Procure to Pay with SAP S/4HANA and Ariba',
                'Order to Cash with SAP and Salesforce',
                'Data warehouse architecture with SAP BW and Snowflake',
                'ERP to PLM integration for manufacturing',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setPrompt(q); setTimeout(() => inputRef.current?.focus(), 0) }}
                  className="text-[10px] bg-[#151E2E] text-[#64748B] hover:text-[#CBD5E1] border border-[#374A5E]/30 hover:border-[#374A5E] px-2.5 py-1 rounded-lg transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            <div className="mt-3 flex justify-between items-center">
              <span className="text-[10px] text-[#374A5E] font-[family-name:var(--font-space-mono)]">
                Ctrl+K to toggle
              </span>
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-30 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {loading ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {!analysis && !loading && (
              <div className="text-center py-6">
                <p className="text-sm text-[#CBD5E1] mb-4">
                  AI will analyze your current diagram for completeness, missing systems, and data governance.
                </p>
                <button
                  onClick={handleAnalyze}
                  disabled={nodes.length === 0}
                  className="bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-30 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
                >
                  {nodes.length === 0 ? 'Add systems first' : 'Analyze Diagram'}
                </button>
              </div>
            )}

            {loading && (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-[#06B6D4] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-[#64748B]">Analyzing your diagram...</p>
              </div>
            )}

            {analysis && (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                {/* Score */}
                <div className="flex items-center gap-3">
                  <div className={`text-2xl font-bold font-[family-name:var(--font-orbitron)] ${
                    analysis.score >= 80 ? 'text-[#10B981]' :
                    analysis.score >= 50 ? 'text-[#EAB308]' : 'text-[#EF4444]'
                  }`}>
                    {analysis.score}
                  </div>
                  <div className="text-xs text-[#64748B]">Completeness Score</div>
                </div>

                {/* Missing Systems */}
                {analysis.missingSystems?.length > 0 && (
                  <AnalysisSection title="Missing Systems" items={analysis.missingSystems} color="#EF4444" />
                )}

                {/* Missing Flows */}
                {analysis.missingFlows?.length > 0 && (
                  <AnalysisSection title="Missing Data Flows" items={analysis.missingFlows} color="#EAB308" />
                )}

                {/* Data Governance */}
                {analysis.dataGovernance?.length > 0 && (
                  <AnalysisSection title="Data Governance" items={analysis.dataGovernance} color="#06B6D4" />
                )}

                {/* Recommendations */}
                {analysis.recommendations?.length > 0 && (
                  <AnalysisSection title="Recommendations" items={analysis.recommendations} color="#10B981" />
                )}
              </div>
            )}

            {error && (
              <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AnalysisSection({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] font-bold mb-1.5" style={{ color }}>
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-[#CBD5E1]">
            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}
