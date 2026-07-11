'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { Check, ImagePlus, Loader2, RefreshCw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/common'
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
  const [implementing, setImplementing] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
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

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        setImageName('Pasted screenshot')
        const reader = new FileReader()
        reader.onload = () => setImageData(reader.result as string)
        reader.readAsDataURL(file)
        return
      }
    }
  }, [])

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
      const nodePositions: Record<string, { x: number; y: number }> = {}
      for (const sys of data.systems || []) {
        const id = `system-${uuid()}`
        nodeIds[sys.id] = id
        const pos = sys.position || { x: 100, y: 100 }
        nodePositions[id] = pos
        const newNode: SystemNode = {
          id,
          type: 'system',
          position: pos,
          data: {
            label: sys.label,
            systemType: sys.systemType || 'custom',
            physicalSystem: sys.physicalSystem,
          },
        }
        store.nodes.push(newNode)
      }

      // Add flows as edges — pick best handles based on relative node positions
      for (const flow of data.flows || []) {
        const sourceId = nodeIds[flow.source]
        const targetId = nodeIds[flow.target]
        if (!sourceId || !targetId) continue

        const srcPos = nodePositions[sourceId]
        const tgtPos = nodePositions[targetId]
        let sourceHandle = 'right-s2'
        let targetHandle = 'left-t1'
        if (srcPos && tgtPos) {
          const dx = tgtPos.x - srcPos.x
          const dy = tgtPos.y - srcPos.y
          if (Math.abs(dx) > Math.abs(dy)) {
            sourceHandle = dx > 0 ? 'right-s2' : 'left-s2'
            targetHandle = dx > 0 ? 'left-t1' : 'right-t1'
          } else {
            sourceHandle = dy > 0 ? 'bot-s2' : 'top-s2'
            targetHandle = dy > 0 ? 'top-t1' : 'bot-t1'
          }
        }

        const newEdge: DataFlowEdge = {
          id: `edge-${uuid()}`,
          source: sourceId,
          target: targetId,
          sourceHandle,
          targetHandle,
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

  const handleImplement = useCallback(async () => {
    if (!analysis) return
    setImplementing(true)
    setError(null)

    try {
      // Build context with existing system IDs so AI can reference them for new flows
      const context = {
        systems: nodes.map((n) => ({
          id: n.id,
          label: n.data.label,
          systemType: n.data.systemType,
          physicalSystem: n.data.physicalSystem,
        })),
        flows: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          dataElements: (e.data?.dataElements || []).map((el) => ({
            name: el.name,
            elementType: el.elementType,
          })),
        })),
        processContext: meta.processContext,
        analysis: {
          missingSystems: analysis.missingSystems,
          missingFlows: analysis.missingFlows,
          dataGovernance: analysis.dataGovernance,
          recommendations: analysis.recommendations,
        },
      }

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'implement', context }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Implementation failed')

      // Push undo before applying changes
      const store = useDiagramStore.getState()
      store.pushUndo()

      // Map AI's new system IDs → real React Flow node IDs
      // Also build a lookup that includes existing system IDs
      const nodeIdMap: Record<string, string> = {}
      // Existing nodes: their IDs pass through directly
      for (const n of store.nodes) {
        nodeIdMap[n.id] = n.id
      }
      const nodePositions: Record<string, { x: number; y: number }> = {}
      for (const n of store.nodes) {
        nodePositions[n.id] = n.position
      }

      // Add new systems
      for (const sys of data.systems || []) {
        const id = `system-${uuid()}`
        nodeIdMap[sys.id] = id
        const pos = sys.position || { x: 100, y: 100 }
        nodePositions[id] = pos
        const newNode: SystemNode = {
          id,
          type: 'system',
          position: pos,
          data: {
            label: sys.label,
            systemType: sys.systemType || 'custom',
            physicalSystem: sys.physicalSystem,
          },
        }
        store.nodes.push(newNode)
      }

      // Add new flows
      for (const flow of data.flows || []) {
        const sourceId = nodeIdMap[flow.source]
        const targetId = nodeIdMap[flow.target]
        if (!sourceId || !targetId) continue

        const srcPos = nodePositions[sourceId]
        const tgtPos = nodePositions[targetId]
        let sourceHandle = 'right-s2'
        let targetHandle = 'left-t1'
        if (srcPos && tgtPos) {
          const dx = tgtPos.x - srcPos.x
          const dy = tgtPos.y - srcPos.y
          if (Math.abs(dx) > Math.abs(dy)) {
            sourceHandle = dx > 0 ? 'right-s2' : 'left-s2'
            targetHandle = dx > 0 ? 'left-t1' : 'right-t1'
          } else {
            sourceHandle = dy > 0 ? 'bot-s2' : 'top-s2'
            targetHandle = dy > 0 ? 'top-t1' : 'bot-t1'
          }
        }

        const newEdge: DataFlowEdge = {
          id: `edge-${uuid()}`,
          source: sourceId,
          target: targetId,
          sourceHandle,
          targetHandle,
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

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to implement recommendations')
    } finally {
      setImplementing(false)
    }
  }, [analysis, nodes, edges, meta, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-card-hover overflow-hidden flex flex-col"
      >
        {/* Mode tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => { setMode('generate'); setAnalysis(null) }}
            className={`flex-1 px-4 py-3 text-[12px] font-medium transition-colors ${
              mode === 'generate'
                ? 'text-brand-600 border-b-2 border-brand-500'
                : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent'
            }`}
          >
            Generate Diagram
          </button>
          <button
            onClick={() => { setMode('analyze'); setAnalysis(null) }}
            className={`flex-1 px-4 py-3 text-[12px] font-medium transition-colors ${
              mode === 'analyze'
                ? 'text-brand-600 border-b-2 border-brand-500'
                : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent'
            }`}
          >
            Analyze Diagram
          </button>
        </div>

        {mode === 'generate' ? (
          <div className="p-4">
            <div className="bg-surface-input rounded-lg px-4 py-3 border border-border focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30">
              <div className="flex items-start gap-3">
                <Sparkles size={18} className="text-amber-500 mt-1 shrink-0" />
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading) handleGenerate()
                  }}
                  placeholder={imageData ? "Describe what to do with this image..." : "Describe your data architecture...\n\nPaste long prompts, requirements, or system descriptions here.\nCtrl+Enter to generate."}
                  className="flex-1 bg-transparent text-body-sm text-text-primary outline-none placeholder:text-text-tertiary resize-none min-h-[80px] max-h-[200px] leading-relaxed w-full"
                  rows={4}
                  disabled={loading}
                />
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-text-tertiary shrink-0">Esc</span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  {/* Image upload button */}
                  <button
                    onClick={() => fileRef.current?.click()}
                    title="Upload screenshot"
                    className="text-text-tertiary hover:text-brand-600 transition-colors shrink-0"
                  >
                    <ImagePlus size={16} />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    aria-label="Upload screenshot"
                    title="Upload screenshot"
                  />
                  {loading && (
                    <Loader2 size={16} className="animate-spin text-brand-500" />
                  )}
                </div>
                <span className="text-[10px] text-text-tertiary font-mono">
                  Ctrl+Enter to generate
                </span>
              </div>
            </div>

            {/* Image preview */}
            {imageData && (
              <div className="mt-2 relative inline-block">
                <img
                  src={imageData}
                  alt="Uploaded screenshot"
                  className="max-h-32 rounded-lg border border-border"
                />
                <button
                  onClick={() => { setImageData(null); setImageName(null) }}
                  title="Remove image"
                  aria-label="Remove image"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-border rounded-full flex items-center justify-center text-text-tertiary hover:text-red-600 transition-colors shadow-card"
                >
                  <X size={10} />
                </button>
                <div className="text-[10px] text-text-tertiary mt-1 truncate max-w-[200px]">{imageName}</div>
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
                  className="text-[10px] bg-surface-muted text-text-secondary hover:bg-brand-50 hover:text-brand-600 border border-border hover:border-brand-200 px-2.5 py-1 rounded-lg transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-3 bg-status-red-bg border border-red-200 rounded-lg px-3 py-2 text-body-sm text-status-red">
                {error}
              </div>
            )}

            <div className="mt-3 flex justify-between items-center">
              <span className="text-[10px] text-text-tertiary font-mono">
                Ctrl+K to toggle
              </span>
              <Button
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading || !prompt.trim()}
                onClick={handleGenerate}
              >
                {loading ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {!analysis && !loading && (
              <div className="text-center py-6">
                <p className="text-body-md text-text-secondary mb-4">
                  AI will analyze your current diagram for completeness, missing systems, and data governance.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  icon={<Sparkles size={16} />}
                  disabled={nodes.length === 0}
                  onClick={handleAnalyze}
                >
                  {nodes.length === 0 ? 'Add systems first' : 'Analyze Diagram'}
                </Button>
              </div>
            )}

            {loading && (
              <div className="text-center py-8">
                <Loader2 size={24} className="animate-spin text-brand-500 mx-auto mb-3" />
                <p className="text-body-sm text-text-tertiary">Analyzing your diagram...</p>
              </div>
            )}

            {analysis && (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                {/* Score */}
                <div className="flex items-center gap-3">
                  <div className={`text-heading-lg font-bold font-display ${
                    analysis.score >= 80 ? 'text-status-green' :
                    analysis.score >= 50 ? 'text-status-yellow' : 'text-status-red'
                  }`}>
                    {analysis.score}
                  </div>
                  <div className="text-body-sm text-text-tertiary">Completeness Score</div>
                </div>

                {/* Missing Systems */}
                {analysis.missingSystems?.length > 0 && (
                  <AnalysisSection title="Missing Systems" items={analysis.missingSystems} tone="red" />
                )}

                {/* Missing Flows */}
                {analysis.missingFlows?.length > 0 && (
                  <AnalysisSection title="Missing Data Flows" items={analysis.missingFlows} tone="yellow" />
                )}

                {/* Data Governance */}
                {analysis.dataGovernance?.length > 0 && (
                  <AnalysisSection title="Data Governance" items={analysis.dataGovernance} tone="blue" />
                )}

                {/* Recommendations */}
                {analysis.recommendations?.length > 0 && (
                  <AnalysisSection title="Recommendations" items={analysis.recommendations} tone="green" />
                )}

                {/* Implement Recommendations */}
                <div className="pt-3 border-t border-border flex items-center gap-3">
                  <button
                    onClick={handleImplement}
                    disabled={implementing}
                    className="flex-1 flex items-center justify-center gap-2 bg-status-green hover:bg-green-700 disabled:opacity-50 text-white text-body-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    {implementing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Implementing...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Implement Recommendations
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleAnalyze}
                    disabled={implementing || loading}
                    title="Re-analyze"
                    className="flex items-center justify-center w-10 h-10 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-30"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <p className="text-[10px] text-text-tertiary text-center">
                  AI will add missing systems and data flows to your diagram. You can undo with Ctrl+Z.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-3 bg-status-red-bg border border-red-200 rounded-lg px-3 py-2 text-body-sm text-status-red">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const ANALYSIS_TONES = {
  red: { label: 'text-status-red', dot: 'bg-status-red' },
  yellow: { label: 'text-status-yellow', dot: 'bg-status-yellow' },
  blue: { label: 'text-status-blue', dot: 'bg-status-blue' },
  green: { label: 'text-status-green', dot: 'bg-status-green' },
} as const

function AnalysisSection({ title, items, tone }: { title: string; items: string[]; tone: keyof typeof ANALYSIS_TONES }) {
  const t = ANALYSIS_TONES[tone]
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${t.label}`}>
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-body-sm text-text-secondary">
            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${t.dot}`} />
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}
