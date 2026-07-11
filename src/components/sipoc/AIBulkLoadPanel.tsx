'use client'

import { useState, useCallback, useRef } from 'react'
import { X, Check, Sparkles, ImagePlus } from 'lucide-react'
import { Button } from '@/components/common'
import { useSIPOCStore } from '@/lib/sipoc/store'

interface BulkLoadResult {
  capabilities: {
    name: string
    description?: string
    level: number
    children: {
      name: string
      description?: string
      level: number
    }[]
  }[]
}

export default function AIBulkLoadPanel({ coreAreaId, coreAreaName, onClose }: {
  coreAreaId: string
  coreAreaName: string
  onClose: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkLoadResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const capabilities = useSIPOCStore(s => s.capabilities)
  const addCapability = useSIPOCStore(s => s.addCapability)

  // Existing L2/L3 under this core area
  const existingL2s = capabilities.filter(c => c.parent_id === coreAreaId && c.level === 2)
  const existingL3s = capabilities.filter(c => existingL2s.some(l2 => l2.id === c.parent_id) && c.level === 3)

  // Handle paste (image)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (!file) continue
        setImageName(file.name || 'pasted-image.png')
        const reader = new FileReader()
        reader.onload = () => {
          setImage(reader.result as string)
        }
        reader.readAsDataURL(file)
        return
      }
    }
  }, [])

  // Generate
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() && !image) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sipoc-bulk-load',
          prompt: prompt.trim(),
          image: image || undefined,
          context: {
            coreAreaName,
            existingL2s: existingL2s.map(c => c.name),
            existingL3s: existingL3s.map(c => c.name),
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || 'AI request failed')
      }

      const data: BulkLoadResult = await res.json()
      setResult(data)

      // Select all by default
      const ids = new Set<string>()
      data.capabilities.forEach((l2, i) => {
        ids.add(`l2-${i}`)
        l2.children.forEach((_, j) => ids.add(`l3-${i}-${j}`))
      })
      setSelected(ids)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate')
    } finally {
      setLoading(false)
    }
  }, [prompt, image, coreAreaName, existingL2s, existingL3s])

  // Toggle selection
  const toggleL2 = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      const key = `l2-${idx}`
      if (next.has(key)) {
        next.delete(key)
        // Also deselect children
        result?.capabilities[idx].children.forEach((_, j) => next.delete(`l3-${idx}-${j}`))
      } else {
        next.add(key)
        result?.capabilities[idx].children.forEach((_, j) => next.add(`l3-${idx}-${j}`))
      }
      return next
    })
  }

  const toggleL3 = (l2Idx: number, l3Idx: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      const key = `l3-${l2Idx}-${l3Idx}`
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Apply selected capabilities
  const handleApply = useCallback(async () => {
    if (!result) return
    setApplying(true)

    try {
      for (let i = 0; i < result.capabilities.length; i++) {
        const l2 = result.capabilities[i]
        if (!selected.has(`l2-${i}`)) continue

        // Create L2
        const l2Id = await addCapability(l2.name, coreAreaId, 2)
        if (!l2Id) continue

        // Create selected L3 children
        for (let j = 0; j < l2.children.length; j++) {
          if (!selected.has(`l3-${i}-${j}`)) continue
          const l3 = l2.children[j]
          await addCapability(l3.name, l2Id, 3)
        }
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply')
    } finally {
      setApplying(false)
    }
  }, [result, selected, coreAreaId, addCapability, onClose])

  const selectedCount = selected.size
  const totalCount = result ? result.capabilities.reduce((a, l2, i) => a + (selected.has(`l2-${i}`) ? 1 : 0) + l2.children.filter((_, j) => selected.has(`l3-${i}-${j}`)).length, 0) : 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-card-hover w-[640px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <Sparkles size={16} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <div className="text-heading-sm font-display text-text-primary">AI Bulk Load</div>
            <div className="text-[11px] text-text-tertiary">
              Generate L2 Capabilities and L3 Functionalities for <span className="font-medium text-text-secondary">{coreAreaName}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={<X size={14} />}
            aria-label="Close"
            onClick={onClose}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!result ? (
            <>
              {/* Prompt input */}
              <div>
                <label className="text-label uppercase text-text-secondary mb-1.5 block">
                  Instructions or description
                </label>
                <textarea
                  ref={textRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Describe the capabilities to add, or paste a screenshot of an existing capability model..."
                  rows={4}
                  className="w-full bg-surface-input border border-border rounded-lg px-3 py-2.5 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
                />
              </div>

              {/* Image preview */}
              {image && (
                <div className="relative rounded-lg border border-border overflow-hidden bg-surface-muted">
                  <img src={image} alt="Pasted" className="max-h-[200px] w-full object-contain" />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className="text-[10px] font-mono bg-black/60 text-white px-2 py-0.5 rounded">{imageName}</span>
                    <button
                      type="button"
                      onClick={() => { setImage(null); setImageName(null) }}
                      aria-label="Remove image"
                      title="Remove image"
                      className="w-5 h-5 rounded bg-black/60 text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
                    >
                      <X size={8} />
                    </button>
                  </div>
                </div>
              )}

              {/* Paste hint */}
              {!image && (
                <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
                  <ImagePlus size={12} className="shrink-0" />
                  Paste an image (Ctrl+V) of a capability model, org chart, or process map to extract capabilities from it
                </div>
              )}

              {/* Existing capabilities note */}
              {existingL2s.length > 0 && (
                <div className="text-[11px] text-text-secondary bg-surface-muted rounded-lg px-3 py-2 border border-border">
                  <span className="font-semibold text-text-primary">{existingL2s.length} existing L2s</span> will be preserved. AI will not duplicate them.
                </div>
              )}

              {error && (
                <div className="text-[11px] text-red-700 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{error}</div>
              )}
            </>
          ) : (
            <>
              {/* Results */}
              <div className="text-[11px] text-text-secondary mb-2">
                {result.capabilities.length} L2 Capabilities generated. Select which to add:
              </div>
              <div className="space-y-2">
                {result.capabilities.map((l2, i) => {
                  const l2Selected = selected.has(`l2-${i}`)
                  return (
                    <div key={i} className={`rounded-lg border overflow-hidden transition-colors ${l2Selected ? 'border-brand-300 bg-brand-50' : 'border-border bg-white'}`}>
                      {/* L2 header */}
                      <button
                        onClick={() => toggleL2(i)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${l2Selected ? 'bg-brand-500 border-brand-500' : 'border-border-strong'}`}>
                          {l2Selected && <Check size={10} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-body-sm font-semibold text-text-primary">{l2.name}</div>
                          {l2.description && <div className="text-[11px] text-text-secondary mt-0.5">{l2.description}</div>}
                        </div>
                        <span className="text-[10px] text-text-tertiary bg-surface-muted px-1.5 py-0.5 rounded">
                          L2 · {l2.children.length} L3s
                        </span>
                      </button>

                      {/* L3 children */}
                      {l2.children.length > 0 && (
                        <div className="border-t border-border pl-9 pr-3 py-1.5 space-y-0.5">
                          {l2.children.map((l3, j) => {
                            const l3Selected = selected.has(`l3-${i}-${j}`)
                            return (
                              <button
                                key={j}
                                onClick={() => toggleL3(i, j)}
                                className="w-full flex items-center gap-2 py-1 text-left"
                              >
                                <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 transition-colors ${l3Selected ? 'bg-brand-500 border-brand-500' : 'border-border-strong'}`}>
                                  {l3Selected && <Check size={8} className="text-white" />}
                                </div>
                                <span className={`text-[11px] ${l3Selected ? 'text-text-primary' : 'text-text-tertiary'}`}>{l3.name}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {error && (
                <div className="text-[11px] text-red-700 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{error}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border bg-surface-muted/50">
          {!result ? (
            <>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                variant="ai"
                size="sm"
                icon={<Sparkles size={12} />}
                loading={loading}
                disabled={!prompt.trim() && !image}
                onClick={handleGenerate}
              >
                {loading ? 'Generating...' : 'Generate'}
              </Button>
            </>
          ) : (
            <>
              <div className="text-[11px] text-text-tertiary">
                {totalCount} items selected
              </div>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => setResult(null)}>Back</Button>
              <Button
                variant="primary"
                size="sm"
                loading={applying}
                disabled={totalCount === 0}
                onClick={handleApply}
              >
                {applying ? 'Adding...' : `Add ${totalCount} Capabilities`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
