'use client'

import { useState, useCallback, useRef } from 'react'
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-2xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--m12-border)]/20">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#2563EB] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L7.5 4.5L11 5.5L8.5 8L9 11.5L6 10L3 11.5L3.5 8L1 5.5L4.5 4.5L6 1Z" fill="white" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-[var(--m12-text)]">AI Bulk Load</div>
            <div className="text-[10px] text-[var(--m12-text-muted)]">
              Generate L2 Capabilities and L3 Functionalities for <span className="font-semibold text-[var(--m12-text-secondary)]">{coreAreaName}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)] transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 10L10 2M2 2l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!result ? (
            <>
              {/* Prompt input */}
              <div>
                <label className="text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider text-[var(--m12-text-muted)] mb-1.5 block">
                  Instructions or description
                </label>
                <textarea
                  ref={textRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Describe the capabilities to add, or paste a screenshot of an existing capability model..."
                  rows={4}
                  className="w-full bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2.5 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60 resize-none"
                />
              </div>

              {/* Image preview */}
              {image && (
                <div className="relative rounded-lg border border-[var(--m12-border)]/30 overflow-hidden bg-[var(--m12-bg)]">
                  <img src={image} alt="Pasted" className="max-h-[200px] w-full object-contain" />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className="text-[8px] bg-black/60 text-white px-2 py-0.5 rounded font-[family-name:var(--font-space-mono)]">{imageName}</span>
                    <button
                      onClick={() => { setImage(null); setImageName(null) }}
                      className="w-5 h-5 rounded bg-black/60 text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 6.5l5-5M1.5 1.5l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Paste hint */}
              {!image && (
                <div className="flex items-center gap-2 text-[10px] text-[var(--m12-text-faint)]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                    <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
                    <path d="M4 6h4M6 4v4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
                  </svg>
                  Paste an image (Ctrl+V) of a capability model, org chart, or process map to extract capabilities from it
                </div>
              )}

              {/* Existing capabilities note */}
              {existingL2s.length > 0 && (
                <div className="text-[9px] text-[var(--m12-text-faint)] bg-[var(--m12-bg)] rounded-lg px-3 py-2 border border-[var(--m12-border)]/20">
                  <span className="font-semibold text-[var(--m12-text-muted)]">{existingL2s.length} existing L2s</span> will be preserved. AI will not duplicate them.
                </div>
              )}

              {error && (
                <div className="text-[10px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2 border border-red-400/20">{error}</div>
              )}
            </>
          ) : (
            <>
              {/* Results */}
              <div className="text-[10px] text-[var(--m12-text-muted)] mb-2">
                {result.capabilities.length} L2 Capabilities generated. Select which to add:
              </div>
              <div className="space-y-2">
                {result.capabilities.map((l2, i) => {
                  const l2Selected = selected.has(`l2-${i}`)
                  return (
                    <div key={i} className={`rounded-lg border overflow-hidden transition-colors ${l2Selected ? 'border-[#2563EB]/30 bg-[#2563EB]/5' : 'border-[var(--m12-border)]/20 bg-[var(--m12-bg)]'}`}>
                      {/* L2 header */}
                      <button
                        onClick={() => toggleL2(i)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${l2Selected ? 'bg-[#2563EB] border-[#2563EB]' : 'border-[var(--m12-border)]'}`}>
                          {l2Selected && (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                              <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[var(--m12-text)]">{l2.name}</div>
                          {l2.description && <div className="text-[9px] text-[var(--m12-text-muted)] mt-0.5">{l2.description}</div>}
                        </div>
                        <span className="text-[8px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-faint)] bg-[var(--m12-bg)] px-1.5 py-0.5 rounded">
                          L2 · {l2.children.length} L3s
                        </span>
                      </button>

                      {/* L3 children */}
                      {l2.children.length > 0 && (
                        <div className="border-t border-[var(--m12-border)]/10 pl-9 pr-3 py-1.5 space-y-0.5">
                          {l2.children.map((l3, j) => {
                            const l3Selected = selected.has(`l3-${i}-${j}`)
                            return (
                              <button
                                key={j}
                                onClick={() => toggleL3(i, j)}
                                className="w-full flex items-center gap-2 py-1 text-left"
                              >
                                <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 transition-colors ${l3Selected ? 'bg-[#8B5CF6] border-[#8B5CF6]' : 'border-[var(--m12-border)]/60'}`}>
                                  {l3Selected && (
                                    <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                                      <path d="M1 3L2.5 4.5L5 1.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                <span className={`text-[10px] ${l3Selected ? 'text-[var(--m12-text)]' : 'text-[var(--m12-text-muted)]'}`}>{l3.name}</span>
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
                <div className="text-[10px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2 border border-red-400/20">{error}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--m12-border)]/20 bg-[var(--m12-bg)]/50">
          {!result ? (
            <>
              <div className="flex-1" />
              <button onClick={onClose} className="text-xs text-[var(--m12-text-muted)] px-3 py-1.5">Cancel</button>
              <button
                onClick={handleGenerate}
                disabled={loading || (!prompt.trim() && !image)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-[#8B5CF6] to-[#2563EB] hover:from-[#7C3AED] hover:to-[#3B82F6] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-xs font-medium transition-all"
              >
                {loading ? (
                  <>
                    <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1L7.5 4.5L11 5.5L8.5 8L9 11.5L6 10L3 11.5L3.5 8L1 5.5L4.5 4.5L6 1Z" fill="white" />
                    </svg>
                    Generate
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="text-[10px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
                {totalCount} items selected
              </div>
              <div className="flex-1" />
              <button onClick={() => setResult(null)} className="text-xs text-[var(--m12-text-muted)] px-3 py-1.5">Back</button>
              <button
                onClick={handleApply}
                disabled={applying || totalCount === 0}
                className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors"
              >
                {applying ? (
                  <>
                    <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>Add {totalCount} Capabilities</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
