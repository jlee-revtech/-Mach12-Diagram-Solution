'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/common'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { Persona, InformationProduct, LogicalSystem, Dimension, Tag } from '@/lib/sipoc/types'
import { PERSONA_COLORS, IP_CATEGORIES, TAG_COLORS } from '@/lib/sipoc/types'
import { SYSTEM_TEMPLATES } from '@/lib/diagram/types'

// ─── Inline quick-create input ──────────────────────────
function QuickAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState('')
  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }
  return (
    <div className="flex gap-1.5">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder={placeholder}
        className="flex-1 h-9 px-3 rounded-lg border border-border bg-surface-input text-body-sm text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:outline-none"
      />
      <Button variant="primary" size="md" onClick={handleSubmit} className="shrink-0">
        Add
      </Button>
    </div>
  )
}

// ─── Searchable IP dropdown ─────────────────────────────
function SearchableIPDropdown({ items, onSelect, accent, placeholder }: {
  items: InformationProduct[]
  onSelect: (id: string) => void
  accent: string
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = items.filter(ip =>
    ip.name.toLowerCase().includes(filter.toLowerCase()) ||
    (ip.category || '').toLowerCase().includes(filter.toLowerCase())
  )

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (items.length === 0) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setOpen(o => !o); setFilter('') }}
        className={`w-full text-left text-[10px] px-2.5 py-1.5 rounded-lg border border-dashed transition-colors ${
          open
            ? `border-[${accent}]/60 text-[${accent}]`
            : `border-border text-text-tertiary hover:border-[${accent}]/40 hover:text-[${accent}]`
        }`}
        style={open ? { borderColor: `${accent}99`, color: accent } : undefined}
      >
        + Add existing info product
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-dropdown overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <input
              ref={inputRef}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-surface-input border border-border rounded-md px-2 py-1 text-[10px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[color:var(--accent)]"
              style={{ '--accent': accent } as React.CSSProperties}
            />
          </div>
          <div className="max-h-[180px] overflow-y-auto">
            {filtered.length > 0 ? filtered.map(ip => (
              <button
                key={ip.id}
                onClick={() => { onSelect(ip.id); setOpen(false); setFilter('') }}
                className="w-full text-left px-2.5 py-1.5 text-[10px] text-text-secondary hover:bg-surface-muted transition-colors flex items-center gap-2"
              >
                <div className="w-1 h-3 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                <span className="flex-1 truncate">{ip.name}</span>
                {ip.category && (
                  <span className="text-[10px] text-text-tertiary font-mono uppercase shrink-0">{ip.category}</span>
                )}
              </button>
            )) : (
              <div className="px-2.5 py-3 text-[10px] text-text-tertiary text-center italic">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Multi-select tag picker ────────────────────────────
function MultiSelect<T extends { id: string; name: string }>({
  items,
  selectedIds,
  onChange,
  colorFn,
  groupFn,
  emptyLabel,
  placeholder,
}: {
  items: T[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  colorFn?: (item: T) => string | undefined
  groupFn?: (item: T) => string
  emptyLabel: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) { setFilter(''); setTimeout(() => searchRef.current?.focus(), 0) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(sid => sid !== id)
        : [...selectedIds, id]
    )
  }

  if (items.length === 0) {
    return <div className="text-[10px] text-text-tertiary italic py-1">{emptyLabel}</div>
  }

  const selectedItems = items.filter(i => selectedIds.includes(i.id))
  const filtered = filter
    ? items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()))
    : items

  // Group filtered items if groupFn provided
  const grouped = groupFn ? (() => {
    const groups = new Map<string, T[]>()
    filtered.forEach(item => {
      const group = groupFn(item)
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group)!.push(item)
    })
    return groups
  })() : null

  const renderItem = (item: T) => {
    const isSelected = selectedIds.includes(item.id)
    const color = colorFn?.(item)
    return (
      <button
        key={item.id}
        onClick={() => toggle(item.id)}
        className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-[10px] transition-colors ${
          isSelected ? 'bg-brand-50 text-text-primary' : 'text-text-secondary hover:bg-surface-muted'
        }`}
      >
        <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-brand-500 border-brand-500' : 'border-border-strong'}`}>
          {isSelected && (
            <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
              <path d="M1 3.5L3 5.5L6 1.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        {color && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
        <span className="flex-1">{item.name}</span>
      </button>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1 min-h-[28px] bg-surface-input border border-border rounded-lg px-2 py-1 text-left hover:border-border-strong transition-colors"
      >
        {selectedItems.length > 0 ? (
          <div className="flex flex-wrap gap-0.5 flex-1">
            {selectedItems.map(item => {
              const color = colorFn?.(item)
              return (
                <span key={item.id} className="inline-flex items-center gap-1 bg-brand-50 border border-[#2563EB]/20 rounded px-1.5 py-0 text-[10px] text-text-primary">
                  {color && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
                  {item.name}
                </span>
              )
            })}
          </div>
        ) : (
          <span className="text-[10px] text-text-tertiary flex-1">{placeholder || 'Select...'}</span>
        )}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`shrink-0 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-border rounded-lg shadow-dropdown overflow-hidden min-w-full w-max max-w-[400px]">
          {/* Search */}
          <div className="p-1.5 border-b border-border">
            <input
              ref={searchRef}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search..."
              className="w-full bg-surface-input border border-border rounded-md px-2 py-1 text-[10px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand-500"
            />
          </div>
          {/* Items */}
          <div className="max-h-[220px] overflow-y-auto">
            {filtered.length > 0 ? (
              grouped ? (
                [...grouped.entries()].map(([group, groupItems]) => (
                  <div key={group}>
                    <div className="px-2.5 py-1 text-[10px] font-mono text-text-tertiary uppercase tracking-widest font-bold bg-surface-muted/60 border-b border-border sticky top-0">
                      {group}
                    </div>
                    {groupItems.map(renderItem)}
                  </div>
                ))
              ) : (
                filtered.map(renderItem)
              )
            ) : (
              <div className="px-2.5 py-3 text-[10px] text-text-tertiary text-center italic">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Section header ─────────────────────────────────────
function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-label uppercase text-text-secondary">
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[10px] bg-surface-muted border border-border rounded px-1.5 py-0.5 text-text-tertiary font-mono">
          {count}
        </span>
      )}
    </div>
  )
}

// ─── Tag Picker (reusable, org-scoped tags) ─────────────
function TagPicker({
  selectedIds,
  onChange,
  orgId,
  compact = false,
}: {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  orgId: string
  compact?: boolean
}) {
  const tags = useSIPOCStore(s => s.tags)
  const addTag = useSIPOCStore(s => s.addTag)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0)
  }, [open])
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const selected = tags.filter(t => selectedIds.includes(t.id))
  const filtered = filter
    ? tags.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()))
    : tags
  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])

  const canCreate = filter.trim().length > 0 && !tags.some(t => t.name.toLowerCase() === filter.trim().toLowerCase())
  const handleCreate = async () => {
    const name = filter.trim()
    if (!name) return
    const tag = await addTag(orgId, { name })
    onChange([...selectedIds, tag.id])
    setFilter('')
  }

  const chipSize = compact ? 'text-[10px] px-1 py-0' : 'text-[10px] px-1.5 py-0'

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-1 ${compact ? 'min-h-[20px]' : 'min-h-[24px]'} bg-surface-input border border-border rounded px-1.5 py-0.5 text-left hover:border-border-strong transition-colors`}
      >
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-0.5 flex-1">
            {selected.map(t => (
              <span key={t.id} className={`inline-flex items-center gap-1 rounded ${chipSize} text-white`} style={{ backgroundColor: t.color }}>
                {t.name}
              </span>
            ))}
          </div>
        ) : (
          <span className={`${compact ? 'text-[10px]' : 'text-[10px]'} text-text-tertiary flex-1`}>
            {compact ? '+ tag' : '+ Add tag'}
          </span>
        )}
        <svg width="7" height="7" viewBox="0 0 8 8" fill="none" className={`shrink-0 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-border rounded-lg shadow-dropdown overflow-hidden min-w-[200px] w-max max-w-[320px]">
          <div className="p-1.5 border-b border-border">
            <input
              ref={searchRef}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); handleCreate() } }}
              placeholder="Search or create..."
              className="w-full bg-surface-input border border-border rounded-md px-2 py-1 text-[10px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="max-h-[180px] overflow-y-auto">
            {filtered.length > 0 ? filtered.map(t => {
              const isSelected = selectedIds.includes(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-[10px] transition-colors ${isSelected ? 'bg-brand-50 text-text-primary' : 'text-text-secondary hover:bg-surface-muted'}`}
                >
                  <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-brand-500 border-brand-500' : 'border-border-strong'}`}>
                    {isSelected && (
                      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                        <path d="M1 3.5L3 5.5L6 1.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="flex-1">{t.name}</span>
                </button>
              )
            }) : (
              <div className="px-2.5 py-3 text-[10px] text-text-tertiary text-center italic">No tags yet</div>
            )}
          </div>
          {canCreate && (
            <button
              onClick={handleCreate}
              className="w-full text-left px-2.5 py-1.5 text-[10px] text-[#2563EB] hover:bg-brand-50 border-t border-border transition-colors"
            >
              + Create tag &quot;{filter.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── System Data Element Picker (reusable on IPs) ──────
function SystemDataElementPicker({
  selectedIds,
  onChange,
  orgId,
}: {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  orgId: string
}) {
  const elements = useSIPOCStore(s => s.systemDataElements)
  const addElement = useSIPOCStore(s => s.addSystemDataElement)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0)
  }, [open])
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const selected = elements.filter(e => selectedIds.includes(e.id))
  const filtered = filter
    ? elements.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
    : elements
  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])

  const canCreate = filter.trim().length > 0 && !elements.some(e => e.name.toLowerCase() === filter.trim().toLowerCase())
  const handleCreate = async () => {
    const name = filter.trim()
    if (!name) return
    const el = await addElement(orgId, { name })
    onChange([...selectedIds, el.id])
    setFilter('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1 min-h-[24px] bg-surface-input border border-border rounded px-1.5 py-0.5 text-left hover:border-border-strong transition-colors"
      >
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-0.5 flex-1">
            {selected.map(e => (
              <span key={e.id} className="inline-flex items-center gap-1 rounded text-[10px] px-1.5 py-0 bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/30">
                {e.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-text-tertiary flex-1">+ Add data element</span>
        )}
        <svg width="7" height="7" viewBox="0 0 8 8" fill="none" className={`shrink-0 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-border rounded-lg shadow-dropdown overflow-hidden min-w-[220px] w-max max-w-[340px]">
          <div className="p-1.5 border-b border-border">
            <input
              ref={searchRef}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); handleCreate() } }}
              placeholder="Search or type to create..."
              className="w-full bg-surface-input border border-border rounded-md px-2 py-1 text-[10px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[#06B6D4]/50"
            />
          </div>
          <div className="max-h-[180px] overflow-y-auto">
            {filtered.length > 0 ? filtered.map(e => {
              const isSelected = selectedIds.includes(e.id)
              return (
                <button
                  key={e.id}
                  onClick={() => toggle(e.id)}
                  className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-[10px] transition-colors ${isSelected ? 'bg-[#06B6D4]/10 text-text-primary' : 'text-text-secondary hover:bg-surface-muted'}`}
                >
                  <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#06B6D4] border-[#06B6D4]' : 'border-border-strong'}`}>
                    {isSelected && (
                      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                        <path d="M1 3.5L3 5.5L6 1.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="flex-1">{e.name}</span>
                </button>
              )
            }) : (
              <div className="px-2.5 py-3 text-[10px] text-text-tertiary text-center italic">No data elements yet</div>
            )}
          </div>
          {canCreate && (
            <button
              onClick={handleCreate}
              className="w-full text-left px-2.5 py-1.5 text-[10px] text-[#06B6D4] hover:bg-[#06B6D4]/10 border-t border-border transition-colors"
            >
              + Create data element &quot;{filter.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Dimensions Editor (detail attributes on an input/output) ──
function DimensionsEditor({
  dimensions,
  side,
  itemId,
  capabilityId,
  orgId,
}: {
  dimensions: Dimension[]
  side: 'input' | 'output'
  itemId: string
  capabilityId: string
  orgId: string
}) {
  const addDimension = useSIPOCStore(s => s.addDimension)
  const updateDimension = useSIPOCStore(s => s.updateDimension)
  const removeDimension = useSIPOCStore(s => s.removeDimension)
  const updateDimensionTags = useSIPOCStore(s => s.updateDimensionTags)

  return (
    <div>
      <div className="text-label uppercase text-text-secondary mb-1">
        Dimensions
      </div>
      {dimensions.length > 0 && (
        <div className="space-y-1 mb-1.5 border-l-2 border-border ml-1 pl-2">
          {dimensions.map(dim => (
            <div key={dim.id} className="flex items-center gap-1.5 group/dim">
              <input
                value={dim.name}
                onChange={e => updateDimension(side, itemId, capabilityId, dim.id, { name: e.target.value })}
                className="flex-1 min-w-0 bg-transparent text-[10px] text-text-secondary focus:outline-none border-b border-transparent focus:border-brand-500/50 py-0.5"
              />
              <div className="shrink-0 w-[110px]">
                <TagPicker
                  selectedIds={dim.tag_ids || []}
                  onChange={ids => updateDimensionTags(side, itemId, capabilityId, dim.id, ids)}
                  orgId={orgId}
                  compact
                />
              </div>
              <button
                onClick={() => removeDimension(side, itemId, capabilityId, dim.id)}
                className="opacity-0 group-hover/dim:opacity-100 text-text-tertiary hover:text-red-600 transition-all shrink-0"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M2 2l4 4M6 2l-4 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <QuickAdd
        placeholder="Add dimension..."
        onAdd={name => addDimension(side, itemId, capabilityId, name)}
      />
    </div>
  )
}

// ─── Rollup summary (read-only, shown for L1/L2 with children) ──
function RollupSummary({ rollup, capabilityId }: { rollup: import('@/lib/sipoc/types').HydratedCapability; capabilityId: string }) {
  const updateCapability = useSIPOCStore(s => s.updateCapability)
  const allCapabilities = useSIPOCStore(s => s.capabilities)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const handleGenerateNarrative = async () => {
    setGenerating(true)
    setGenError(null)
    try {
      const payload = {
        name: rollup.name,
        level: rollup.level,
        features: rollup.features || [],
        suppliers: [...new Set(rollup.inputs.flatMap(i => i.supplierPersonas.map(p => p.name)))],
        customers: [...new Set(rollup.outputs.flatMap(o => o.consumerPersonas.map(p => p.name)))],
        inputs: rollup.inputs.map(i => ({
          name: i.informationProduct.name,
          dimensions: i.dimensions.map(d => d.name),
          tags: i.tags.map(t => t.name),
        })),
        outputs: rollup.outputs.map(o => ({
          name: o.informationProduct.name,
          dimensions: o.dimensions.map(d => d.name),
        })),
        feedingSystems: [...new Set(rollup.inputs.map(i => i.feedingSystem?.name).filter(Boolean))],
        sourceSystems: [...new Set(rollup.inputs.flatMap(i => i.sourceSystems.map(s => s.name)))],
        destinationSystems: [...new Set(rollup.outputs.flatMap(o => o.destinationSystems.map(s => s.name)))],
      }
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sipoc-l2-narrative', context: payload }),
      })
      const data = await res.json()
      if (!res.ok || !data.narrative) {
        setGenError(data.error || 'Generation failed')
        return
      }
      await updateCapability(capabilityId, { description: data.narrative })
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }
  const childCount = allCapabilities.filter(c => c.parent_id === capabilityId).length
  const allSuppliers = new Map<string, Persona>()
  const allCustomers = new Map<string, Persona>()
  const allInputIPs = new Map<string, string>()
  const allOutputIPs = new Map<string, string>()
  const allTags = new Map<string, Tag>()
  rollup.inputs.forEach(i => {
    i.supplierPersonas.forEach(p => allSuppliers.set(p.id, p))
    allInputIPs.set(i.informationProduct.id, i.informationProduct.name)
    i.tags.forEach(t => allTags.set(t.id, t))
    i.dimensions.forEach(d => d.tags.forEach(t => allTags.set(t.id, t)))
  })
  rollup.outputs.forEach(o => {
    o.consumerPersonas.forEach(p => allCustomers.set(p.id, p))
    allOutputIPs.set(o.informationProduct.id, o.informationProduct.name)
  })

  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const toggle = (key: string) => setOpenSections(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
  })

  const Row = ({ sectionKey, label, items, colorFor }: { sectionKey: string; label: string; items: { id: string; name: string }[]; colorFor?: (id: string) => string | undefined }) => {
    const isOpen = openSections.has(sectionKey)
    return (
      <div>
        <button
          onClick={() => toggle(sectionKey)}
          className="w-full flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-1 hover:text-text-secondary transition-colors"
        >
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>
            <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{label}</span>
          <span className="text-text-tertiary">({items.length})</span>
        </button>
        {isOpen && (
          items.length > 0 ? (
            <div className="flex flex-wrap gap-1 pl-3">
              {items.map(i => (
                <span key={i.id} className="inline-flex items-center gap-1 text-[10px] bg-surface-muted border border-border rounded px-1.5 py-0.5 text-text-secondary">
                  {colorFor?.(i.id) && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorFor(i.id) }} />}
                  {i.name}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-text-tertiary italic pl-3">None</div>
          )
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-brand-50 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <svg width="11" height="11" viewBox="0 0 10 10" fill="none" className="text-brand-600">
          <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[10px] font-mono uppercase tracking-wider text-brand-600 font-bold flex-1">
          Rollup · summarized from {childCount} sub-capabilit{childCount === 1 ? 'y' : 'ies'} (read-only)
        </span>
        <button
          onClick={handleGenerateNarrative}
          disabled={generating}
          className="shrink-0 text-[10px] px-2 py-1 rounded-md font-mono uppercase tracking-wider border bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-wait transition-colors flex items-center gap-1"
          title="Generate an AI description from this rollup and save it to the capability"
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M5 1l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="currentColor" />
          </svg>
          {generating ? 'Generating…' : 'AI Description'}
        </button>
      </div>
      {genError && (
        <div className="text-[10px] text-status-red bg-status-red-bg border border-red-200 rounded px-2 py-1">{genError}</div>
      )}
      <Row sectionKey="suppliers" label="Suppliers" items={[...allSuppliers.values()]} colorFor={id => allSuppliers.get(id)?.color} />
      <Row sectionKey="inputs" label="Inputs" items={[...allInputIPs.entries()].map(([id, name]) => ({ id, name }))} />
      <Row sectionKey="outputs" label="Outputs" items={[...allOutputIPs.entries()].map(([id, name]) => ({ id, name }))} />
      <Row sectionKey="customers" label="Customers" items={[...allCustomers.values()]} colorFor={id => allCustomers.get(id)?.color} />
      {allTags.size > 0 && (() => {
        const isOpen = openSections.has('tags')
        return (
          <div>
            <button
              onClick={() => toggle('tags')}
              className="w-full flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-1 hover:text-text-secondary transition-colors"
            >
              <svg width="7" height="7" viewBox="0 0 8 8" fill="none" className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Tags</span>
              <span className="text-text-tertiary">({allTags.size})</span>
            </button>
            {isOpen && (
              <div className="flex flex-wrap gap-1 pl-3">
                {[...allTags.values()].map(t => (
                  <span key={t.id} className="inline-flex items-center rounded text-[10px] px-1.5 py-0 text-white" style={{ backgroundColor: t.color }}>{t.name}</span>
                ))}
              </div>
            )}
          </div>
        )
      })()}
      {(rollup.features || []).length > 0 && (() => {
        const isOpen = openSections.has('features')
        return (
          <div>
            <button
              onClick={() => toggle('features')}
              className="w-full flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-1 hover:text-text-secondary transition-colors"
            >
              <svg width="7" height="7" viewBox="0 0 8 8" fill="none" className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Features (auto)</span>
              <span className="text-text-tertiary">({(rollup.features || []).length})</span>
            </button>
            {isOpen && (
              <ul className="pl-3 space-y-0.5">
                {(rollup.features || []).map((f, i) => {
                  const dashIdx = f.indexOf(' - ')
                  const head = dashIdx >= 0 ? f.slice(0, dashIdx) : ''
                  const tail = dashIdx >= 0 ? f.slice(dashIdx + 3) : f
                  return (
                    <li key={i} className="text-[10px] leading-snug">
                      {head && <span className="text-brand-600 font-mono mr-1">{head}</span>}
                      <span className="text-text-secondary">{tail}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })()}
      {(rollup.use_cases || []).length > 0 && (() => {
        const isOpen = openSections.has('use_cases')
        return (
          <div>
            <button
              onClick={() => toggle('use_cases')}
              className="w-full flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-1 hover:text-text-secondary transition-colors"
            >
              <svg width="7" height="7" viewBox="0 0 8 8" fill="none" className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Use Cases (auto)</span>
              <span className="text-text-tertiary">({(rollup.use_cases || []).length})</span>
            </button>
            {isOpen && (
              <ul className="pl-3 space-y-0.5">
                {(rollup.use_cases || []).map((u, i) => {
                  const dashIdx = u.indexOf(' - ')
                  const head = dashIdx >= 0 ? u.slice(0, dashIdx) : ''
                  const tail = dashIdx >= 0 ? u.slice(dashIdx + 3) : u
                  return (
                    <li key={i} className="text-[10px] leading-snug">
                      {head && <span className="text-brand-600 font-mono mr-1">{head}</span>}
                      <span className="text-text-secondary">{tail}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Capability Detail Editor ───────────────────────────
function CapabilityDetail({ capabilityId, orgId }: { capabilityId: string; orgId: string }) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [dragState, setDragState] = useState<{ side: 'input' | 'output'; id: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ side: 'input' | 'output'; id: string; above: boolean } | null>(null)
  const [archivedInputsOpen, setArchivedInputsOpen] = useState(false)
  const [archivedOutputsOpen, setArchivedOutputsOpen] = useState(false)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const focusedItemId = useSIPOCStore(s => s.focusedItemId)
  const setFocusedItem = useSIPOCStore(s => s.setFocusedItem)

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // When focusedItemId changes, expand and scroll to that item
  useEffect(() => {
    if (!focusedItemId) return
    setExpandedItems(prev => {
      const next = new Set(prev)
      next.add(focusedItemId)
      return next
    })
    // Scroll into view after a tick to let the DOM expand
    requestAnimationFrame(() => {
      itemRefs.current[focusedItemId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    // Clear focus after handling
    setFocusedItem(null)
  }, [focusedItemId, setFocusedItem])

  const capabilities = useSIPOCStore(s => s.capabilities)
  const inputs = useSIPOCStore(s => s.inputs[capabilityId] || [])
  const outputs = useSIPOCStore(s => s.outputs[capabilityId] || [])
  const personas = useSIPOCStore(s => s.personas)
  const informationProducts = useSIPOCStore(s => s.informationProducts)
  const logicalSystems = useSIPOCStore(s => s.logicalSystems)

  const updateCapability = useSIPOCStore(s => s.updateCapability)
  const removeCapability = useSIPOCStore(s => s.removeCapability)
  const addInput = useSIPOCStore(s => s.addInput)
  const removeInput = useSIPOCStore(s => s.removeInput)
  const reorderInputs = useSIPOCStore(s => s.reorderInputs)
  const archiveInput = useSIPOCStore(s => s.archiveInput)
  const unarchiveInput = useSIPOCStore(s => s.unarchiveInput)
  const updateInputSuppliers = useSIPOCStore(s => s.updateInputSuppliers)
  const updateInputSystems = useSIPOCStore(s => s.updateInputSystems)
  const updateInputFeedingSystem = useSIPOCStore(s => s.updateInputFeedingSystem)
  const updateInputTags = useSIPOCStore(s => s.updateInputTags)
  const addOutput = useSIPOCStore(s => s.addOutput)
  const removeOutput = useSIPOCStore(s => s.removeOutput)
  const reorderOutputs = useSIPOCStore(s => s.reorderOutputs)
  const archiveOutput = useSIPOCStore(s => s.archiveOutput)
  const unarchiveOutput = useSIPOCStore(s => s.unarchiveOutput)
  const updateOutputConsumers = useSIPOCStore(s => s.updateOutputConsumers)
  const updateOutputSystems = useSIPOCStore(s => s.updateOutputSystems)
  const updateOutputTags = useSIPOCStore(s => s.updateOutputTags)
  const addInformationProduct = useSIPOCStore(s => s.addInformationProduct)
  const updateInformationProduct = useSIPOCStore(s => s.updateInformationProduct)

  const capability = capabilities.find(c => c.id === capabilityId)
  const getRollup = useSIPOCStore(s => s.getRollup)
  const hasChildren = capabilities.some(c => c.parent_id === capabilityId)
  if (!capability) return null
  const rollup = hasChildren ? getRollup(capabilityId) : null

  // Split active vs archived; archived items keep their detail but are hidden from the main list
  const activeInputs = inputs.filter(i => !i.archived_at)
  const archivedInputs = inputs.filter(i => i.archived_at)
  const activeOutputs = outputs.filter(o => !o.archived_at)
  const archivedOutputs = outputs.filter(o => o.archived_at)

  // Get IPs not already used as active inputs/outputs for this capability
  const usedInputIpIds = new Set(activeInputs.map(i => i.information_product_id))
  const usedOutputIpIds = new Set(activeOutputs.map(o => o.information_product_id))
  const availableForInput = informationProducts.filter(ip => !usedInputIpIds.has(ip.id))
  const availableForOutput = informationProducts.filter(ip => !usedOutputIpIds.has(ip.id))

  const handleAddInputIP = async (ipId: string) => {
    await addInput(capabilityId, ipId)
  }

  const handleAddOutputIP = async (ipId: string) => {
    await addOutput(capabilityId, ipId)
  }

  const handleQuickCreateAndAddInput = async (name: string) => {
    const ip = await addInformationProduct(orgId, { name })
    await addInput(capabilityId, ip.id)
  }

  const handleQuickCreateAndAddOutput = async (name: string) => {
    const ip = await addInformationProduct(orgId, { name })
    await addOutput(capabilityId, ip.id)
  }

  const handleRowDragStart = (side: 'input' | 'output', id: string) => (e: React.DragEvent) => {
    setDragState({ side, id })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `${side}:${id}`)
  }
  const handleRowDragOver = (side: 'input' | 'output', id: string) => (e: React.DragEvent) => {
    if (!dragState || dragState.side !== side) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const above = e.clientY < rect.top + rect.height / 2
    setDropTarget(prev => prev?.id === id && prev.above === above && prev.side === side ? prev : { side, id, above })
  }
  const handleRowDrop = (side: 'input' | 'output', targetId: string) => (e: React.DragEvent) => {
    e.preventDefault()
    if (!dragState || dragState.side !== side || dragState.id === targetId) {
      setDragState(null); setDropTarget(null); return
    }
    const list = (side === 'input' ? inputs : outputs).map(i => i.id)
    const from = list.indexOf(dragState.id)
    const to = list.indexOf(targetId)
    if (from < 0 || to < 0) { setDragState(null); setDropTarget(null); return }
    const above = dropTarget?.above ?? true
    let insertAt = above ? to : to + 1
    if (from < insertAt) insertAt--
    const next = [...list]
    next.splice(from, 1)
    next.splice(insertAt, 0, dragState.id)
    if (side === 'input') reorderInputs(capabilityId, next)
    else reorderOutputs(capabilityId, next)
    setDragState(null)
    setDropTarget(null)
  }
  const handleRowDragEnd = () => { setDragState(null); setDropTarget(null) }

  return (
    <div className="space-y-5">
      {rollup && <RollupSummary rollup={rollup} capabilityId={capabilityId} />}
      {/* Capability name & description */}
      <div className="space-y-2">
        <input
          value={capability.name}
          onChange={e => updateCapability(capabilityId, { name: e.target.value })}
          className="w-full bg-transparent border-b border-border focus:border-brand-500 text-sm font-semibold text-text-primary py-1 focus:outline-none transition-colors"
        />
        {/* Features */}
        <div className="space-y-1.5">
          <div className="text-label uppercase text-text-secondary">
            Features
            <span className="ml-1 text-text-tertiary normal-case">(what this capability does)</span>
          </div>
          {(capability.features || []).map((feat, i) => (
            <div key={i} className="flex items-center gap-1.5 group/feat">
              <span className="text-text-tertiary text-[10px] shrink-0">•</span>
              <input
                value={feat}
                onChange={e => {
                  const updated = [...(capability.features || [])]
                  updated[i] = e.target.value
                  updateCapability(capabilityId, { features: updated })
                }}
                className="flex-1 bg-surface-input border border-border rounded px-2 py-1 text-[10px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand-500"
              />
              <button
                onClick={() => {
                  const updated = (capability.features || []).filter((_, j) => j !== i)
                  updateCapability(capabilityId, { features: updated })
                }}
                className="w-5 h-5 rounded flex items-center justify-center text-text-tertiary hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover/feat:opacity-100"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 6.5l5-5M1.5 1.5l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const updated = [...(capability.features || []), '']
              updateCapability(capabilityId, { features: updated })
            }}
            className="text-[10px] text-brand-600 hover:text-brand-500 font-medium transition-colors flex items-center gap-1"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Add feature
          </button>
        </div>

        {/* Use Cases */}
        <div className="space-y-1.5">
          <div className="text-label uppercase text-text-secondary">
            Use Cases
            <span className="ml-1 text-text-tertiary normal-case">(scenarios where this capability is applied)</span>
          </div>
          {(capability.use_cases || []).map((uc, i) => (
            <div key={i} className="flex items-center gap-1.5 group/uc">
              <span className="text-text-tertiary text-[10px] shrink-0">•</span>
              <input
                value={uc}
                onChange={e => {
                  const updated = [...(capability.use_cases || [])]
                  updated[i] = e.target.value
                  updateCapability(capabilityId, { use_cases: updated })
                }}
                className="flex-1 bg-surface-input border border-border rounded px-2 py-1 text-[10px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand-500"
              />
              <button
                onClick={() => {
                  const updated = (capability.use_cases || []).filter((_, j) => j !== i)
                  updateCapability(capabilityId, { use_cases: updated })
                }}
                className="w-5 h-5 rounded flex items-center justify-center text-text-tertiary hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover/uc:opacity-100"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 6.5l5-5M1.5 1.5l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const updated = [...(capability.use_cases || []), '']
              updateCapability(capabilityId, { use_cases: updated })
            }}
            className="text-[10px] text-brand-600 hover:text-brand-500 font-medium transition-colors flex items-center gap-1"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Add use case
          </button>
        </div>

        {/* Dependencies (other L3 capabilities this one depends on) */}
        <div className="space-y-1.5">
          <div className="text-label uppercase text-text-secondary">
            Dependencies
            <span className="ml-1 text-text-tertiary normal-case">(other L3s this capability depends on)</span>
          </div>
          {(() => {
            const allL3s = capabilities.filter(c => c.level === 3 && c.id !== capabilityId)
            const selectedIds = capability.depends_on_capability_ids || []
            // Build "Parent L2 name / L3 name" label map for clarity
            const capById = new Map(capabilities.map(c => [c.id, c]))
            const labelFor = (c: typeof allL3s[0]) => {
              const parent = c.parent_id ? capById.get(c.parent_id) : null
              return parent ? `${parent.name} / ${c.name}` : c.name
            }
            return (
              <MultiSelect
                items={allL3s.map(c => ({ id: c.id, name: labelFor(c) }))}
                selectedIds={selectedIds}
                onChange={ids => updateCapability(capabilityId, { depends_on_capability_ids: ids })}
                emptyLabel="No other L3 capabilities to depend on"
                placeholder="Select dependencies..."
              />
            )
          })()}
        </div>
      </div>

      {/* System (where this capability is performed) */}
      <div>
        <div className="text-label uppercase text-text-secondary mb-1">
          Performed In
          <span className="ml-1 text-text-tertiary normal-case">(system)</span>
        </div>
        {(() => {
          const capSys = capability.system_id ? logicalSystems.find(s => s.id === capability.system_id) : null
          const capTmpl = capSys ? SYSTEM_TEMPLATES.find(t => t.type === capSys.system_type) : null
          return (
            <div className="relative">
              <select
                value={capability.system_id || ''}
                onChange={e => updateCapability(capabilityId, { system_id: e.target.value || null })}
                className="w-full bg-surface-input border border-blue-200 rounded-lg px-2.5 py-2 text-body-sm text-text-primary focus:outline-none focus:border-brand-500 appearance-none pr-7"
                style={capSys ? { borderLeftWidth: 3, borderLeftColor: capSys.color || capTmpl?.color || '#64748B' } : {}}
              >
                <option value="">Not specified</option>
                {(() => {
                  const groups = new Map<string, typeof logicalSystems>()
                  logicalSystems.forEach(s => {
                    const tmpl = SYSTEM_TEMPLATES.find(t => t.type === s.system_type)
                    const label = tmpl ? `${tmpl.label} - ${tmpl.description}` : 'Other'
                    if (!groups.has(label)) groups.set(label, [])
                    groups.get(label)!.push(s)
                  })
                  return [...groups.entries()].map(([group, systems]) => (
                    <optgroup key={group} label={group}>
                      {systems.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))
                })()}
              </select>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
                <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )
        })()}
      </div>

      {/* INPUTS section */}
      <div>
        <SectionLabel label="Inputs" count={activeInputs.length} />
        <div className="space-y-2">
          {activeInputs.map(input => {
            const ip = informationProducts.find(p => p.id === input.information_product_id)
            const isDragging = dragState?.side === 'input' && dragState.id === input.id
            const drop = dropTarget?.side === 'input' && dropTarget.id === input.id ? dropTarget : null
            return (
              <div
                key={input.id}
                ref={el => { itemRefs.current[input.id] = el }}
                draggable
                onDragStart={handleRowDragStart('input', input.id)}
                onDragOver={handleRowDragOver('input', input.id)}
                onDrop={handleRowDrop('input', input.id)}
                onDragEnd={handleRowDragEnd}
                className={`bg-surface-muted border rounded-lg overflow-hidden transition-colors ${expandedItems.has(input.id) ? 'border-yellow-200' : 'border-border'} ${isDragging ? 'opacity-40' : ''} ${drop?.above ? 'shadow-[0_-2px_0_0_#2563EB]' : ''} ${drop && !drop.above ? 'shadow-[0_2px_0_0_#2563EB]' : ''}`}
              >
                <div
                  className="flex items-center gap-2 px-2.5 py-2 cursor-grab active:cursor-grabbing hover:bg-white/60 transition-colors"
                  onClick={() => toggleItem(input.id)}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="shrink-0 text-text-tertiary" aria-hidden>
                    <circle cx="2.5" cy="2" r="0.6" fill="currentColor"/>
                    <circle cx="5.5" cy="2" r="0.6" fill="currentColor"/>
                    <circle cx="2.5" cy="4" r="0.6" fill="currentColor"/>
                    <circle cx="5.5" cy="4" r="0.6" fill="currentColor"/>
                    <circle cx="2.5" cy="6" r="0.6" fill="currentColor"/>
                    <circle cx="5.5" cy="6" r="0.6" fill="currentColor"/>
                  </svg>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`shrink-0 text-text-tertiary transition-transform ${expandedItems.has(input.id) ? 'rotate-90' : ''}`}>
                    <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="w-1 h-3 rounded-full bg-[#EAB308]/60 shrink-0" />
                  {ip ? (
                    <input
                      value={ip.name}
                      onChange={e => updateInformationProduct(ip.id, { name: e.target.value })}
                      onClick={e => e.stopPropagation()}
                      className="text-body-sm font-medium text-text-primary flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-border focus:border-brand-500 focus:outline-none truncate"
                    />
                  ) : (
                    <span className="text-body-sm font-medium italic text-text-tertiary flex-1 truncate">(deleted)</span>
                  )}
                  <span className="text-[10px] text-text-tertiary font-mono">
                    {input.supplier_persona_ids.length}s {input.source_system_ids.length}sys {(input.dimensions || []).length}d
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); archiveInput(input.id, capabilityId) }}
                    className="text-text-tertiary hover:text-brand-600 transition-colors shrink-0"
                    title="Unassign from L3 (keeps all detail; can restore from Archived)"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <rect x="1" y="2" width="8" height="2" stroke="currentColor" strokeWidth="1"/>
                      <path d="M2 4v5h6V4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 6h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeInput(input.id, capabilityId) }}
                    className="text-text-tertiary hover:text-red-600 transition-colors shrink-0"
                    title="Delete permanently"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                {expandedItems.has(input.id) && <div className="px-2.5 pb-2.5 space-y-2 border-t border-border pt-2">
                {/* Tags (reusable, org-scoped) */}
                <div>
                  <div className="text-label uppercase text-text-secondary mb-1">Tags</div>
                  <TagPicker
                    selectedIds={input.tag_ids || []}
                    onChange={ids => updateInputTags(input.id, capabilityId, ids)}
                    orgId={orgId}
                  />
                </div>
                {/* Supplier personas */}
                <div>
                  <div className="text-label uppercase text-text-secondary mb-1">Suppliers</div>
                  <MultiSelect
                    items={personas}
                    selectedIds={input.supplier_persona_ids}
                    onChange={ids => updateInputSuppliers(input.id, capabilityId, ids)}
                    colorFn={p => p.color}
                    emptyLabel="Create personas first"
                  />
                </div>
                {/* Source systems (ordered upstream flow) */}
                <div>
                  <div className="text-label uppercase text-text-secondary mb-1">
                    Source Systems
                    {input.source_system_ids.length > 1 && (
                      <span className="ml-1 text-text-tertiary normal-case">(order = data lineage)</span>
                    )}
                  </div>
                  {input.source_system_ids.length > 0 && (
                    <div className="space-y-0 mb-2">
                      {input.source_system_ids.map((sysId, idx) => {
                        const sys = logicalSystems.find(s => s.id === sysId)
                        if (!sys) return null
                        const tmpl = SYSTEM_TEMPLATES.find(t => t.type === sys.system_type)
                        const isFirst = idx === 0
                        const isLast = idx === input.source_system_ids.length - 1
                        return (
                          <div key={sysId}>
                            {idx > 0 && (
                              <div className="flex items-center justify-center py-0.5">
                                <svg width="10" height="12" viewBox="0 0 10 12" fill="none" className="text-border-strong">
                                  <path d="M5 0v9M2.5 7L5 10l2.5-3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 bg-surface-muted border border-border rounded-lg px-2 py-1.5 group/sys">
                              <div className="w-2 h-2 rounded shrink-0" style={{ backgroundColor: sys.color || tmpl?.color || '#64748B' }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-medium text-text-primary truncate">{sys.name}</div>
                                {tmpl && <div className="text-[10px] text-text-tertiary font-mono uppercase">{tmpl.label}</div>}
                              </div>
                              <span className="text-[10px] text-text-tertiary font-mono font-bold">
                                {isFirst && input.source_system_ids.length > 1 ? 'ORIGIN' : `#${idx + 1}`}
                              </span>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/sys:opacity-100 transition-opacity">
                                {!isFirst && (
                                  <button onClick={() => { const ids = [...input.source_system_ids]; [ids[idx-1],ids[idx]]=[ids[idx],ids[idx-1]]; updateInputSystems(input.id, capabilityId, ids) }} className="text-text-tertiary hover:text-text-primary transition-colors p-0.5" title="Move up">
                                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 1.5L1.5 4.5h5L4 1.5z" fill="currentColor" /></svg>
                                  </button>
                                )}
                                {!isLast && (
                                  <button onClick={() => { const ids = [...input.source_system_ids]; [ids[idx],ids[idx+1]]=[ids[idx+1],ids[idx]]; updateInputSystems(input.id, capabilityId, ids) }} className="text-text-tertiary hover:text-text-primary transition-colors p-0.5" title="Move down">
                                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 6.5L1.5 3.5h5L4 6.5z" fill="currentColor" /></svg>
                                  </button>
                                )}
                                <button onClick={() => updateInputSystems(input.id, capabilityId, input.source_system_ids.filter(id => id !== sysId))} className="text-text-tertiary hover:text-red-600 transition-colors p-0.5" title="Remove">
                                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 2l4 4M6 2l-4 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <MultiSelect
                    items={logicalSystems.filter(s => !input.source_system_ids.includes(s.id) && s.id !== input.feeding_system_id)}
                    selectedIds={[]}
                    onChange={newIds => {
                      if (newIds.length > 0) updateInputSystems(input.id, capabilityId, [...input.source_system_ids, ...newIds])
                    }}
                    colorFn={s => s.color || '#64748B'}
                    groupFn={s => {
                      const tmpl = SYSTEM_TEMPLATES.find(t => t.type === s.system_type)
                      return tmpl ? `${tmpl.label} - ${tmpl.description}` : 'Other'
                    }}
                    emptyLabel="No more systems to add"
                    placeholder="+ Add source system..."
                  />
                </div>
                {/* Feeding system (single select) */}
                <div>
                  <div className="text-label uppercase text-text-secondary mb-1">
                    Feeding System
                    <span className="ml-1 text-text-tertiary normal-case">(delivers to process)</span>
                  </div>
                  {(() => {
                    const feedSys = input.feeding_system_id ? logicalSystems.find(s => s.id === input.feeding_system_id) : null
                    const feedTmpl = feedSys ? SYSTEM_TEMPLATES.find(t => t.type === feedSys.system_type) : null
                    return (
                      <div className="relative">
                        <select
                          value={input.feeding_system_id || ''}
                          onChange={e => updateInputFeedingSystem(input.id, capabilityId, e.target.value || null)}
                          className="w-full bg-surface-input border border-yellow-200 rounded-lg px-2.5 py-2 text-body-sm text-text-primary focus:outline-none focus:border-yellow-400 appearance-none pr-7"
                          style={feedSys ? { borderLeftWidth: 3, borderLeftColor: feedSys.color || feedTmpl?.color || '#64748B' } : {}}
                        >
                          <option value="">None</option>
                          {(() => {
                            const groups = new Map<string, typeof logicalSystems>()
                            logicalSystems.forEach(s => {
                              const tmpl = SYSTEM_TEMPLATES.find(t => t.type === s.system_type)
                              const label = tmpl ? `${tmpl.label} - ${tmpl.description}` : 'Other'
                              if (!groups.has(label)) groups.set(label, [])
                              groups.get(label)!.push(s)
                            })
                            return [...groups.entries()].map(([group, systems]) => (
                              <optgroup key={group} label={group}>
                                {systems.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </optgroup>
                            ))
                          })()}
                        </select>
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
                          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )
                  })()}
                </div>
                {/* Data Objects */}
                <DimensionsEditor
                  dimensions={input.dimensions || []}
                  side="input"
                  itemId={input.id}
                  capabilityId={capabilityId}
                  orgId={orgId}
                />
                {/* System Data Elements (on the IP, reusable across IPs) */}
                {ip && (
                  <div>
                    <div className="text-label uppercase text-text-secondary mb-1">
                      System Data Elements
                      <span className="ml-1 text-text-tertiary normal-case">(on this info product)</span>
                    </div>
                    <SystemDataElementPicker
                      selectedIds={ip.data_element_ids || []}
                      onChange={ids => updateInformationProduct(ip.id, { data_element_ids: ids })}
                      orgId={orgId}
                    />
                  </div>
                )}
                </div>}
              </div>
            )
          })}

          {/* Archived inputs (unassigned; detail preserved) */}
          {archivedInputs.length > 0 && (
            <div className="mt-1">
              <button
                onClick={() => setArchivedInputsOpen(o => !o)}
                className="flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary uppercase tracking-wider hover:text-text-primary transition-colors"
              >
                <svg width="7" height="7" viewBox="0 0 8 8" fill="none" className={`transition-transform ${archivedInputsOpen ? 'rotate-90' : ''}`}>
                  <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Archived</span>
                <span className="text-text-tertiary">({archivedInputs.length})</span>
              </button>
              {archivedInputsOpen && (
                <div className="mt-1 space-y-1">
                  {archivedInputs.map(input => {
                    const ip = informationProducts.find(p => p.id === input.information_product_id)
                    return (
                      <div key={input.id} className="flex items-center gap-2 px-2 py-1 rounded bg-surface-muted/40 border border-dashed border-border">
                        <div className="w-1 h-3 rounded-full bg-[#EAB308]/30 shrink-0" />
                        <span className="text-[10px] text-text-tertiary flex-1 truncate italic">{ip?.name || '(deleted)'}</span>
                        <span className="text-[10px] text-text-tertiary font-mono">
                          {input.supplier_persona_ids.length}s {input.source_system_ids.length}sys {(input.dimensions || []).length}d
                        </span>
                        <button
                          onClick={() => unarchiveInput(input.id, capabilityId)}
                          className="text-[10px] font-mono uppercase tracking-wider text-brand-600 hover:text-brand-500 transition-colors"
                          title="Restore to active inputs"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => { if (confirm('Delete this archived input permanently? Detail will be lost.')) removeInput(input.id, capabilityId) }}
                          className="text-text-tertiary hover:text-red-600 transition-colors shrink-0"
                          title="Delete permanently"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Add existing IP as input */}
          <SearchableIPDropdown
            items={availableForInput}
            onSelect={handleAddInputIP}
            accent="#EAB308"
            placeholder="Search info products..."
          />

          {/* Quick-create new IP as input */}
          <QuickAdd placeholder="New input info product..." onAdd={handleQuickCreateAndAddInput} />
        </div>
      </div>

      {/* OUTPUTS section */}
      <div>
        <SectionLabel label="Outputs" count={activeOutputs.length} />
        <div className="space-y-2">
          {activeOutputs.map(output => {
            const ip = informationProducts.find(p => p.id === output.information_product_id)
            const isDragging = dragState?.side === 'output' && dragState.id === output.id
            const drop = dropTarget?.side === 'output' && dropTarget.id === output.id ? dropTarget : null
            return (
              <div
                key={output.id}
                ref={el => { itemRefs.current[output.id] = el }}
                draggable
                onDragStart={handleRowDragStart('output', output.id)}
                onDragOver={handleRowDragOver('output', output.id)}
                onDrop={handleRowDrop('output', output.id)}
                onDragEnd={handleRowDragEnd}
                className={`bg-surface-muted border rounded-lg overflow-hidden transition-colors ${expandedItems.has(output.id) ? 'border-green-200' : 'border-border'} ${isDragging ? 'opacity-40' : ''} ${drop?.above ? 'shadow-[0_-2px_0_0_#2563EB]' : ''} ${drop && !drop.above ? 'shadow-[0_2px_0_0_#2563EB]' : ''}`}
              >
                <div
                  className="flex items-center gap-2 px-2.5 py-2 cursor-grab active:cursor-grabbing hover:bg-white/60 transition-colors"
                  onClick={() => toggleItem(output.id)}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="shrink-0 text-text-tertiary" aria-hidden>
                    <circle cx="2.5" cy="2" r="0.6" fill="currentColor"/>
                    <circle cx="5.5" cy="2" r="0.6" fill="currentColor"/>
                    <circle cx="2.5" cy="4" r="0.6" fill="currentColor"/>
                    <circle cx="5.5" cy="4" r="0.6" fill="currentColor"/>
                    <circle cx="2.5" cy="6" r="0.6" fill="currentColor"/>
                    <circle cx="5.5" cy="6" r="0.6" fill="currentColor"/>
                  </svg>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`shrink-0 text-text-tertiary transition-transform ${expandedItems.has(output.id) ? 'rotate-90' : ''}`}>
                    <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="w-1 h-3 rounded-full bg-[#10B981]/60 shrink-0" />
                  {ip ? (
                    <input
                      value={ip.name}
                      onChange={e => updateInformationProduct(ip.id, { name: e.target.value })}
                      onClick={e => e.stopPropagation()}
                      className="text-body-sm font-medium text-text-primary flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-border focus:border-brand-500 focus:outline-none truncate"
                    />
                  ) : (
                    <span className="text-body-sm font-medium italic text-text-tertiary flex-1 truncate">(deleted)</span>
                  )}
                  <span className="text-[10px] text-text-tertiary font-mono">
                    {output.consumer_persona_ids.length}c {(output.destination_system_ids || []).length}sys {(output.dimensions || []).length}d
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); archiveOutput(output.id, capabilityId) }}
                    className="text-text-tertiary hover:text-brand-600 transition-colors shrink-0"
                    title="Unassign from L3 (keeps all detail; can restore from Archived)"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <rect x="1" y="2" width="8" height="2" stroke="currentColor" strokeWidth="1"/>
                      <path d="M2 4v5h6V4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 6h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeOutput(output.id, capabilityId) }}
                    className="text-text-tertiary hover:text-red-600 transition-colors shrink-0"
                    title="Delete permanently"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                {expandedItems.has(output.id) && <div className="px-2.5 pb-2.5 space-y-2 border-t border-border pt-2">
                {/* Tags (reusable, org-scoped) */}
                <div>
                  <div className="text-label uppercase text-text-secondary mb-1">Tags</div>
                  <TagPicker
                    selectedIds={output.tag_ids || []}
                    onChange={ids => updateOutputTags(output.id, capabilityId, ids)}
                    orgId={orgId}
                  />
                </div>
                {/* Consumer personas */}
                <div>
                  <div className="text-label uppercase text-text-secondary mb-1">Consumers</div>
                  <MultiSelect
                    items={personas}
                    selectedIds={output.consumer_persona_ids}
                    onChange={ids => updateOutputConsumers(output.id, capabilityId, ids)}
                    colorFn={p => p.color}
                    emptyLabel="Create personas first"
                  />
                </div>
                {/* Destination systems */}
                <div>
                  <div className="text-label uppercase text-text-secondary mb-1">
                    Destination Systems
                    {(output.destination_system_ids || []).length > 1 && (
                      <span className="ml-1 text-text-tertiary normal-case">(order = integration flow)</span>
                    )}
                  </div>
                  {(output.destination_system_ids || []).length > 0 && (
                    <div className="space-y-0 mb-2">
                      {(output.destination_system_ids || []).map((sysId, idx) => {
                        const sys = logicalSystems.find(s => s.id === sysId)
                        if (!sys) return null
                        const tmpl = SYSTEM_TEMPLATES.find(t => t.type === sys.system_type)
                        const isFirst = idx === 0
                        const isLast = idx === (output.destination_system_ids || []).length - 1
                        return (
                          <div key={sysId}>
                            {idx > 0 && (
                              <div className="flex items-center py-0.5 pl-3">
                                <svg width="8" height="12" viewBox="0 0 8 12" fill="none"><path d="M4 0v12M1 9l3 3 3-3" stroke="#9ca3af" strokeWidth="0.8" strokeLinecap="round" /></svg>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-muted border border-border group/sys">
                              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: sys.color || '#64748B' }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-medium text-text-primary truncate">{sys.name}</div>
                                {tmpl && <div className="text-[10px] text-text-tertiary font-mono uppercase">{tmpl.label}</div>}
                              </div>
                              <span className="text-[10px] text-text-tertiary font-mono font-bold">
                                {isFirst && (output.destination_system_ids || []).length > 1 ? 'PRIMARY' : `#${idx + 1}`}
                              </span>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/sys:opacity-100 transition-opacity">
                                {!isFirst && (
                                  <button onClick={() => { const ids = [...(output.destination_system_ids || [])]; [ids[idx-1],ids[idx]]=[ids[idx],ids[idx-1]]; updateOutputSystems(output.id, capabilityId, ids) }} className="text-text-tertiary hover:text-text-primary transition-colors p-0.5" title="Move up">
                                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 1.5L1.5 4.5h5L4 1.5z" fill="currentColor" /></svg>
                                  </button>
                                )}
                                {!isLast && (
                                  <button onClick={() => { const ids = [...(output.destination_system_ids || [])]; [ids[idx],ids[idx+1]]=[ids[idx+1],ids[idx]]; updateOutputSystems(output.id, capabilityId, ids) }} className="text-text-tertiary hover:text-text-primary transition-colors p-0.5" title="Move down">
                                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 6.5L1.5 3.5h5L4 6.5z" fill="currentColor" /></svg>
                                  </button>
                                )}
                                <button onClick={() => updateOutputSystems(output.id, capabilityId, (output.destination_system_ids || []).filter(id => id !== sysId))} className="text-text-tertiary hover:text-red-600 transition-colors p-0.5" title="Remove">
                                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 2l4 4M6 2l-4 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <MultiSelect
                    items={logicalSystems.filter(s => !(output.destination_system_ids || []).includes(s.id))}
                    selectedIds={[]}
                    onChange={newIds => {
                      if (newIds.length > 0) updateOutputSystems(output.id, capabilityId, [...(output.destination_system_ids || []), ...newIds])
                    }}
                    colorFn={s => s.color || '#64748B'}
                    groupFn={s => {
                      const tmpl = SYSTEM_TEMPLATES.find(t => t.type === s.system_type)
                      return tmpl ? `${tmpl.label} - ${tmpl.description}` : 'Other'
                    }}
                    emptyLabel="No more systems to add"
                    placeholder="+ Add destination system..."
                  />
                </div>
                {/* Data Objects */}
                <DimensionsEditor
                  dimensions={output.dimensions || []}
                  side="output"
                  itemId={output.id}
                  capabilityId={capabilityId}
                  orgId={orgId}
                />
                {/* System Data Elements (on the IP, reusable across IPs) */}
                {ip && (
                  <div>
                    <div className="text-label uppercase text-text-secondary mb-1">
                      System Data Elements
                      <span className="ml-1 text-text-tertiary normal-case">(on this info product)</span>
                    </div>
                    <SystemDataElementPicker
                      selectedIds={ip.data_element_ids || []}
                      onChange={ids => updateInformationProduct(ip.id, { data_element_ids: ids })}
                      orgId={orgId}
                    />
                  </div>
                )}
                </div>}
              </div>
            )
          })}

          {/* Add existing IP as output */}
          <SearchableIPDropdown
            items={availableForOutput}
            onSelect={handleAddOutputIP}
            accent="#10B981"
            placeholder="Search info products..."
          />

          {/* Archived outputs (unassigned; detail preserved) */}
          {archivedOutputs.length > 0 && (
            <div className="mt-1">
              <button
                onClick={() => setArchivedOutputsOpen(o => !o)}
                className="flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary uppercase tracking-wider hover:text-text-primary transition-colors"
              >
                <svg width="7" height="7" viewBox="0 0 8 8" fill="none" className={`transition-transform ${archivedOutputsOpen ? 'rotate-90' : ''}`}>
                  <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Archived</span>
                <span className="text-text-tertiary">({archivedOutputs.length})</span>
              </button>
              {archivedOutputsOpen && (
                <div className="mt-1 space-y-1">
                  {archivedOutputs.map(output => {
                    const ip = informationProducts.find(p => p.id === output.information_product_id)
                    return (
                      <div key={output.id} className="flex items-center gap-2 px-2 py-1 rounded bg-surface-muted/40 border border-dashed border-border">
                        <div className="w-1 h-3 rounded-full bg-[#10B981]/30 shrink-0" />
                        <span className="text-[10px] text-text-tertiary flex-1 truncate italic">{ip?.name || '(deleted)'}</span>
                        <span className="text-[10px] text-text-tertiary font-mono">
                          {output.consumer_persona_ids.length}c {(output.destination_system_ids || []).length}sys {(output.dimensions || []).length}d
                        </span>
                        <button
                          onClick={() => unarchiveOutput(output.id, capabilityId)}
                          className="text-[10px] font-mono uppercase tracking-wider text-brand-600 hover:text-brand-500 transition-colors"
                          title="Restore to active outputs"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => { if (confirm('Delete this archived output permanently? Detail will be lost.')) removeOutput(output.id, capabilityId) }}
                          className="text-text-tertiary hover:text-red-600 transition-colors shrink-0"
                          title="Delete permanently"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Quick-create new IP as output */}
          <QuickAdd placeholder="New output info product..." onAdd={handleQuickCreateAndAddOutput} />
        </div>
      </div>

      {/* Delete capability */}
      <div className="pt-2 border-t border-border">
        <button
          onClick={() => { if (confirm(`Delete capability "${capability.name}"?`)) removeCapability(capabilityId) }}
          className="text-[10px] text-red-500/70 hover:text-red-600 transition-colors font-mono uppercase tracking-wider"
        >
          Delete Capability
        </button>
      </div>
    </div>
  )
}

// ─── Inline Editable Row ────────────────────────────────
function EditableRow({
  id,
  name,
  onSave,
  onDelete,
  editingId,
  setEditingId,
  color,
  colorDot,
  secondaryLabel,
  secondaryField,
  onSaveSecondary,
  categoryField,
  categoryValue,
  onSaveCategory,
  colorOptions,
  onSaveColor,
  children,
}: {
  id: string
  name: string
  onSave: (name: string) => void
  onDelete: () => void
  editingId: string | null
  setEditingId: (id: string | null) => void
  color?: string
  colorDot?: 'round' | 'square'
  secondaryLabel?: string
  secondaryField?: string
  onSaveSecondary?: (value: string) => void
  categoryField?: string
  categoryValue?: string
  onSaveCategory?: (value: string) => void
  colorOptions?: readonly string[]
  onSaveColor?: (color: string) => void
  children?: React.ReactNode
}) {
  const isEditing = editingId === id
  const [editName, setEditName] = useState(name)
  const [editSecondary, setEditSecondary] = useState(secondaryField || '')
  const [editCategory, setEditCategory] = useState(categoryValue || '')

  const startEditing = () => {
    setEditName(name)
    setEditSecondary(secondaryField || '')
    setEditCategory(categoryValue || '')
    setEditingId(id)
  }

  const save = () => {
    if (editName.trim()) onSave(editName.trim())
    if (onSaveSecondary) onSaveSecondary(editSecondary.trim())
    if (onSaveCategory) onSaveCategory(editCategory)
    setEditingId(null)
  }

  if (isEditing) {
    return (
      <div className="bg-surface-muted border border-brand-500/40 rounded-lg p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          {color && (
            <div className={`w-2.5 h-2.5 shrink-0 ${colorDot === 'square' ? 'rounded' : 'rounded-full'}`} style={{ backgroundColor: color }} />
          )}
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            autoFocus
            className="flex-1 bg-surface-input border border-border rounded px-2 py-1 text-body-sm text-text-primary focus:outline-none focus:border-brand-500"
          />
        </div>
        {onSaveSecondary && (
          <input
            value={editSecondary}
            onChange={e => setEditSecondary(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder={secondaryLabel || 'Role...'}
            className="w-full bg-surface-input border border-border rounded px-2 py-1 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand-500"
          />
        )}
        {onSaveCategory && (
          <select
            value={editCategory}
            onChange={e => setEditCategory(e.target.value)}
            className="w-full bg-surface-input border border-border rounded px-2 py-1 text-body-sm text-text-primary focus:outline-none focus:border-brand-500"
          >
            <option value="">No category</option>
            {IP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {colorOptions && onSaveColor && (
          <div className="flex flex-wrap gap-1">
            {colorOptions.map(c => (
              <button
                key={c}
                onClick={() => onSaveColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-colors ${color === c ? 'border-text-primary scale-110' : 'border-transparent hover:border-border-strong'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
        {children}
        <div className="flex gap-1.5">
          <Button variant="primary" size="sm" onClick={save}>Save</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 group cursor-pointer hover:bg-surface-muted/50 rounded-lg px-1 py-0.5 -mx-1 transition-colors" onClick={startEditing}>
      {color && (
        <div className={`w-2.5 h-2.5 shrink-0 ${colorDot === 'square' ? 'rounded' : 'rounded-full'}`} style={{ backgroundColor: color }} />
      )}
      {!color && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-text-tertiary shrink-0">
          <rect x="1" y="2" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
          <path d="M3 4.5h4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        </svg>
      )}
      <span className="text-body-sm text-text-primary flex-1 truncate">{name}</span>
      {categoryValue && (
        <span className="text-[10px] text-text-tertiary bg-surface-muted border border-border rounded px-1 py-0.5 font-mono uppercase">
          {categoryValue}
        </span>
      )}
      {secondaryField && !categoryValue && (
        <span className="text-[10px] text-text-tertiary font-mono">{secondaryField}</span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-600 transition-all"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// ─── Collapsible Info Products List ─────────────────────
function IPEntityList({
  informationProducts,
  editingId,
  setEditingId,
  updateInformationProduct,
  removeInformationProduct,
  onAdd,
}: {
  informationProducts: InformationProduct[]
  editingId: string | null
  setEditingId: (id: string | null) => void
  updateInformationProduct: (id: string, updates: Partial<Pick<InformationProduct, 'name' | 'description' | 'category'>>) => Promise<void>
  removeInformationProduct: (id: string) => Promise<void>
  onAdd: (name: string) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const inputs = useSIPOCStore(s => s.inputs)
  const outputs = useSIPOCStore(s => s.outputs)
  const capabilities = useSIPOCStore(s => s.capabilities)

  return (
    <div className="space-y-1">
      {informationProducts.map(ip => {
        const isExpanded = expandedId === ip.id
        const isEditing = editingId === ip.id

        // Find which capabilities use this IP
        const usedIn: { capName: string; side: 'input' | 'output'; dimCount: number }[] = []
        capabilities.forEach(cap => {
          (inputs[cap.id] || []).forEach(inp => {
            if (inp.information_product_id === ip.id) {
              usedIn.push({ capName: cap.name, side: 'input', dimCount: (inp.dimensions || []).length })
            }
          })
          ;(outputs[cap.id] || []).forEach(out => {
            if (out.information_product_id === ip.id) {
              usedIn.push({ capName: cap.name, side: 'output', dimCount: (out.dimensions || []).length })
            }
          })
        })

        if (isEditing) {
          return (
            <EditableRow
              key={ip.id}
              id={ip.id}
              name={ip.name}
              editingId={editingId}
              setEditingId={setEditingId}
              categoryValue={ip.category || ''}
              onSave={name => updateInformationProduct(ip.id, { name })}
              onSaveCategory={category => updateInformationProduct(ip.id, { category: category || undefined })}
              onDelete={() => removeInformationProduct(ip.id)}
            />
          )
        }

        return (
          <div key={ip.id} className={`border rounded-lg transition-all ${isExpanded ? 'border-border bg-surface-muted/50' : 'border-transparent'}`}>
            {/* Collapsed row */}
            <div
              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-surface-muted/50 rounded-lg transition-colors group"
              onClick={() => setExpandedId(isExpanded ? null : ip.id)}
            >
              <button className="text-text-tertiary hover:text-text-primary transition-colors shrink-0">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                  <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-text-tertiary shrink-0">
                <rect x="1" y="2" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
                <path d="M3 4.5h4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
              </svg>
              <span className="text-body-sm text-text-primary flex-1 truncate">{ip.name}</span>
              {ip.category && (
                <span className="text-[10px] text-text-tertiary bg-surface-muted border border-border rounded px-1 py-0.5 font-mono uppercase">
                  {ip.category}
                </span>
              )}
              {usedIn.length > 0 && (
                <span className="text-[10px] text-text-tertiary font-mono">
                  {usedIn.length}x
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); removeInformationProduct(ip.id) }}
                className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-600 transition-all shrink-0"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-3 pb-2.5 pt-1 space-y-2 border-t border-border mx-1">
                {/* Edit button */}
                <button
                  onClick={() => setEditingId(ip.id)}
                  className="text-[10px] font-mono text-brand-600 hover:text-brand-500 uppercase tracking-wider font-bold transition-colors"
                >
                  Edit Name / Category
                </button>

                {/* Usage */}
                {usedIn.length > 0 ? (
                  <div>
                    <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1 font-mono font-bold">Used In</div>
                    <div className="space-y-0.5">
                      {usedIn.map((u, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10px]">
                          <span className={`text-[10px] font-mono font-bold uppercase px-1 py-0.5 rounded ${
                            u.side === 'input'
                              ? 'bg-status-yellow-bg text-status-yellow'
                              : 'bg-status-green-bg text-status-green'
                          }`}>
                            {u.side === 'input' ? 'IN' : 'OUT'}
                          </span>
                          <span className="text-text-secondary truncate">{u.capName}</span>
                          {u.dimCount > 0 && (
                            <span className="text-text-tertiary font-mono text-[10px]">{u.dimCount} dims</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-text-tertiary italic">Not used in any capability yet</div>
                )}
              </div>
            )}
          </div>
        )
      })}
      <QuickAdd placeholder="New info product name..." onAdd={onAdd} />
    </div>
  )
}

// ─── Entity Pool Manager ────────────────────────────────
function EntityPool({ orgId }: { orgId: string }) {
  const personas = useSIPOCStore(s => s.personas)
  const informationProducts = useSIPOCStore(s => s.informationProducts)
  const logicalSystems = useSIPOCStore(s => s.logicalSystems)
  const addPersona = useSIPOCStore(s => s.addPersona)
  const removePersona = useSIPOCStore(s => s.removePersona)
  const updatePersona = useSIPOCStore(s => s.updatePersona)
  const addInformationProduct = useSIPOCStore(s => s.addInformationProduct)
  const removeInformationProduct = useSIPOCStore(s => s.removeInformationProduct)
  const updateInformationProduct = useSIPOCStore(s => s.updateInformationProduct)
  const addLogicalSystem = useSIPOCStore(s => s.addLogicalSystem)
  const removeLogicalSystem = useSIPOCStore(s => s.removeLogicalSystem)
  const updateLogicalSystem = useSIPOCStore(s => s.updateLogicalSystem)
  const tags = useSIPOCStore(s => s.tags)
  const addTag = useSIPOCStore(s => s.addTag)
  const updateTagFn = useSIPOCStore(s => s.updateTag)
  const removeTag = useSIPOCStore(s => s.removeTag)

  const [activeTab, setActiveTab] = useState<'personas' | 'products' | 'systems' | 'tags'>('personas')
  const [newSystemType, setNewSystemType] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleAddPersona = useCallback(async (name: string) => {
    const colorIdx = personas.length % PERSONA_COLORS.length
    await addPersona(orgId, { name, color: PERSONA_COLORS[colorIdx] })
  }, [orgId, personas.length, addPersona])

  const handleAddIP = useCallback(async (name: string) => {
    await addInformationProduct(orgId, { name })
  }, [orgId, addInformationProduct])

  const handleAddTag = useCallback(async (name: string) => {
    const colorIdx = tags.length % TAG_COLORS.length
    await addTag(orgId, { name, color: TAG_COLORS[colorIdx] })
  }, [orgId, tags.length, addTag])

  const handleAddSystem = useCallback(async (name: string) => {
    const template = SYSTEM_TEMPLATES.find(t => t.type === newSystemType)
    await addLogicalSystem(orgId, {
      name,
      system_type: newSystemType || undefined,
      color: template?.color,
    })
  }, [orgId, newSystemType, addLogicalSystem])

  const tabs = [
    { key: 'personas' as const, label: 'Personas', count: personas.length },
    { key: 'products' as const, label: 'Info Products', count: informationProducts.length },
    { key: 'systems' as const, label: 'Systems', count: logicalSystems.length },
    { key: 'tags' as const, label: 'Tags', count: tags.length },
  ]

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 bg-surface-muted rounded-lg p-0.5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setEditingId(null) }}
            className={`flex-1 text-[10px] uppercase tracking-wider font-mono font-bold py-1.5 px-2 rounded transition-colors ${
              activeTab === tab.key
                ? 'bg-brand-500 text-white'
                : 'text-text-secondary hover:bg-white'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Personas list */}
      {activeTab === 'personas' && (
        <div className="space-y-1.5">
          {personas.map(p => (
            <EditableRow
              key={p.id}
              id={p.id}
              name={p.name}
              editingId={editingId}
              setEditingId={setEditingId}
              color={p.color}
              colorDot="round"
              secondaryLabel="Role..."
              secondaryField={p.role || ''}
              onSave={name => updatePersona(p.id, { name })}
              onSaveSecondary={role => updatePersona(p.id, { role: role || undefined })}
              onDelete={() => removePersona(p.id)}
              colorOptions={PERSONA_COLORS}
              onSaveColor={color => updatePersona(p.id, { color })}
            />
          ))}
          <QuickAdd placeholder="New persona name..." onAdd={handleAddPersona} />
        </div>
      )}

      {/* Information Products list */}
      {activeTab === 'products' && (
        <IPEntityList
          informationProducts={informationProducts}
          editingId={editingId}
          setEditingId={setEditingId}
          updateInformationProduct={updateInformationProduct}
          removeInformationProduct={removeInformationProduct}
          onAdd={handleAddIP}
        />
      )}

      {/* Logical Systems list */}
      {activeTab === 'systems' && (
        <div className="space-y-1.5">
          {logicalSystems.map(s => {
            const template = SYSTEM_TEMPLATES.find(t => t.type === s.system_type)
            return (
              <EditableRow
                key={s.id}
                id={s.id}
                name={s.name}
                editingId={editingId}
                setEditingId={setEditingId}
                color={s.color || template?.color || '#64748B'}
                colorDot="square"
                secondaryField={template?.label}
                onSave={name => updateLogicalSystem(s.id, { name })}
                onDelete={() => removeLogicalSystem(s.id)}
              >
                <select
                  defaultValue={s.system_type || ''}
                  onChange={e => {
                    const val = e.target.value as import('@/lib/diagram/types').SystemType | ''
                    const tmpl = SYSTEM_TEMPLATES.find(t => t.type === val)
                    updateLogicalSystem(s.id, {
                      system_type: val || undefined,
                      color: tmpl?.color,
                    })
                  }}
                  className="w-full bg-surface-input border border-border rounded px-2 py-1 text-body-sm text-text-primary focus:outline-none focus:border-brand-500"
                >
                  <option value="">Type (optional)</option>
                  {SYSTEM_TEMPLATES.map(t => (
                    <option key={t.type} value={t.type}>{t.label} - {t.description}</option>
                  ))}
                </select>
              </EditableRow>
            )
          })}
          {/* System type selector + name */}
          <div className="space-y-1.5">
            <select
              value={newSystemType}
              onChange={e => setNewSystemType(e.target.value)}
              className="w-full bg-surface-input border border-border rounded-lg px-2.5 py-1.5 text-body-sm text-text-primary focus:outline-none focus:border-brand-500"
            >
              <option value="">Type (optional)</option>
              {SYSTEM_TEMPLATES.map(t => (
                <option key={t.type} value={t.type}>{t.label} - {t.description}</option>
              ))}
            </select>
            <QuickAdd placeholder="New system name..." onAdd={handleAddSystem} />
          </div>
        </div>
      )}

      {/* Tags list */}
      {activeTab === 'tags' && (
        <div className="space-y-1.5">
          {tags.map(t => (
            <EditableRow
              key={t.id}
              id={t.id}
              name={t.name}
              editingId={editingId}
              setEditingId={setEditingId}
              color={t.color}
              colorDot="round"
              secondaryLabel="Description..."
              secondaryField={t.description || ''}
              onSave={name => updateTagFn(t.id, { name })}
              onSaveSecondary={description => updateTagFn(t.id, { description: description || undefined })}
              onDelete={() => removeTag(t.id)}
              colorOptions={TAG_COLORS}
              onSaveColor={color => updateTagFn(t.id, { color })}
            />
          ))}
          <QuickAdd placeholder="New tag name..." onAdd={handleAddTag} />
        </div>
      )}
    </div>
  )
}

// ─── Main Editor Sidebar ────────────────────────────────
export default function CapabilityEditor({ orgId }: { orgId: string }) {
  const selectedCapabilityId = useSIPOCStore(s => s.selectedCapabilityId)
  const addCapability = useSIPOCStore(s => s.addCapability)
  const capabilities = useSIPOCStore(s => s.capabilities)

  const [sidebarMode, setSidebarMode] = useState<'detail' | 'entities'>('detail')
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <div className={
      fullscreen
        ? 'fixed inset-0 z-40 bg-white flex flex-col overflow-hidden'
        : 'w-[380px] shrink-0 bg-white border-l border-border flex flex-col h-full overflow-hidden'
    }>
      {/* Sidebar header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex gap-1 flex-1">
            <button
              onClick={() => setSidebarMode('detail')}
              className={`flex-1 text-[10px] uppercase tracking-wider font-mono font-bold py-1.5 rounded transition-colors ${
                sidebarMode === 'detail'
                  ? 'bg-brand-500 text-white'
                  : 'text-text-secondary hover:bg-surface-muted'
              }`}
            >
              Capability
            </button>
            <button
              onClick={() => setSidebarMode('entities')}
              className={`flex-1 text-[10px] uppercase tracking-wider font-mono font-bold py-1.5 rounded transition-colors ${
                sidebarMode === 'entities'
                  ? 'bg-brand-500 text-white'
                  : 'text-text-secondary hover:bg-surface-muted'
              }`}
            >
              Entity Pool
            </button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            iconOnly
            onClick={() => setFullscreen(f => !f)}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            className="shrink-0"
            icon={fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          />
        </div>
      </div>

      {/* Sidebar content */}
      <div className="flex-1 overflow-y-auto p-4">
        {sidebarMode === 'detail' ? (
          selectedCapabilityId ? (
            <CapabilityDetail capabilityId={selectedCapabilityId} orgId={orgId} />
          ) : (
            <div className="space-y-4">
              <div className="text-body-sm text-text-tertiary">
                Select a capability from the visual, or add a new one.
              </div>

              {/* Capability list */}
              <div className="space-y-1">
                <SectionLabel label="Capabilities" count={capabilities.length} />
                {capabilities.map(cap => (
                  <button
                    key={cap.id}
                    onClick={() => useSIPOCStore.getState().setSelectedCapability(cap.id)}
                    className="w-full text-left px-3 py-2 rounded-lg text-body-sm text-text-primary hover:bg-surface-muted transition-colors border border-transparent hover:border-border"
                  >
                    {cap.name}
                  </button>
                ))}
              </div>

              <QuickAdd
                placeholder="New capability name..."
                onAdd={name => addCapability(name)}
              />
            </div>
          )
        ) : (
          <EntityPool orgId={orgId} />
        )}
      </div>
    </div>
  )
}
