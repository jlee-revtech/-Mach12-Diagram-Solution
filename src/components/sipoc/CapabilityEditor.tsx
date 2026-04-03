'use client'

import { useState, useCallback } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { Persona, InformationProduct, LogicalSystem, Dimension } from '@/lib/sipoc/types'
import { PERSONA_COLORS, IP_CATEGORIES } from '@/lib/sipoc/types'
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
        className="flex-1 bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded-lg px-2.5 py-1.5 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60"
      />
      <button
        onClick={handleSubmit}
        className="bg-[#2563EB] hover:bg-[#3B82F6] text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0"
      >
        Add
      </button>
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

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(sid => sid !== id)
        : [...selectedIds, id]
    )
  }

  if (items.length === 0) {
    return <div className="text-[10px] text-[var(--m12-text-muted)] italic py-1">{emptyLabel}</div>
  }

  const selectedItems = items.filter(i => selectedIds.includes(i.id))

  // Group items if groupFn provided
  const grouped = groupFn ? (() => {
    const groups = new Map<string, T[]>()
    items.forEach(item => {
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
          isSelected ? 'bg-[#2563EB]/10 text-[var(--m12-text)]' : 'text-[var(--m12-text-secondary)] hover:bg-[var(--m12-bg)]'
        }`}
      >
        <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#2563EB] border-[#2563EB]' : 'border-[var(--m12-border)]'}`}>
          {isSelected && (
            <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
              <path d="M1 3.5L3 5.5L6 1.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        {color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
        <span className="flex-1 truncate">{item.name}</span>
      </button>
    )
  }

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1 min-h-[28px] bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded-lg px-2 py-1 text-left hover:border-[var(--m12-border)]/60 transition-colors"
      >
        {selectedItems.length > 0 ? (
          <div className="flex flex-wrap gap-0.5 flex-1">
            {selectedItems.map(item => {
              const color = colorFn?.(item)
              return (
                <span key={item.id} className="inline-flex items-center gap-1 bg-[#2563EB]/10 border border-[#2563EB]/20 rounded px-1.5 py-0 text-[9px] text-[var(--m12-text)]">
                  {color && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
                  {item.name}
                </span>
              )
            })}
          </div>
        ) : (
          <span className="text-[10px] text-[var(--m12-text-faint)] flex-1">{placeholder || 'Select...'}</span>
        )}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`shrink-0 text-[var(--m12-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/50 rounded-lg shadow-xl overflow-hidden max-h-[240px] overflow-y-auto">
            {grouped ? (
              [...grouped.entries()].map(([group, groupItems]) => (
                <div key={group}>
                  <div className="px-2.5 py-1 text-[8px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] uppercase tracking-widest font-bold bg-[var(--m12-bg)]/60 border-b border-[var(--m12-border)]/20 sticky top-0">
                    {group}
                  </div>
                  {groupItems.map(renderItem)}
                </div>
              ))
            ) : (
              items.map(renderItem)
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Section header ─────────────────────────────────────
function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[9px] uppercase tracking-widest font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] font-bold">
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[9px] bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded px-1.5 py-0.5 text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">
          {count}
        </span>
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
}: {
  dimensions: Dimension[]
  side: 'input' | 'output'
  itemId: string
  capabilityId: string
}) {
  const addDimension = useSIPOCStore(s => s.addDimension)
  const updateDimension = useSIPOCStore(s => s.updateDimension)
  const removeDimension = useSIPOCStore(s => s.removeDimension)

  return (
    <div>
      <div className="text-[9px] text-[var(--m12-text-muted)] uppercase tracking-wider mb-1 font-[family-name:var(--font-space-mono)]">
        Dimensions
      </div>
      {dimensions.length > 0 && (
        <div className="space-y-0.5 mb-1.5 border-l-2 border-[var(--m12-border)]/20 ml-1 pl-2">
          {dimensions.map(dim => (
            <div key={dim.id} className="flex items-center gap-1.5 group/dim">
              <input
                value={dim.name}
                onChange={e => updateDimension(side, itemId, capabilityId, dim.id, { name: e.target.value })}
                className="flex-1 bg-transparent text-[10px] text-[var(--m12-text-secondary)] focus:outline-none border-b border-transparent focus:border-[#2563EB]/30 py-0.5"
              />
              <button
                onClick={() => removeDimension(side, itemId, capabilityId, dim.id)}
                className="opacity-0 group-hover/dim:opacity-100 text-[var(--m12-text-muted)] hover:text-red-400 transition-all"
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

// ─── Capability Detail Editor ───────────────────────────
function CapabilityDetail({ capabilityId, orgId }: { capabilityId: string; orgId: string }) {
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
  const updateInputSuppliers = useSIPOCStore(s => s.updateInputSuppliers)
  const updateInputSystems = useSIPOCStore(s => s.updateInputSystems)
  const updateInputFeedingSystem = useSIPOCStore(s => s.updateInputFeedingSystem)
  const addOutput = useSIPOCStore(s => s.addOutput)
  const removeOutput = useSIPOCStore(s => s.removeOutput)
  const updateOutputConsumers = useSIPOCStore(s => s.updateOutputConsumers)
  const addInformationProduct = useSIPOCStore(s => s.addInformationProduct)

  const capability = capabilities.find(c => c.id === capabilityId)
  if (!capability) return null

  // Get IPs not already used as inputs/outputs for this capability
  const usedInputIpIds = new Set(inputs.map(i => i.information_product_id))
  const usedOutputIpIds = new Set(outputs.map(o => o.information_product_id))
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

  return (
    <div className="space-y-5">
      {/* Capability name & description */}
      <div className="space-y-2">
        <input
          value={capability.name}
          onChange={e => updateCapability(capabilityId, { name: e.target.value })}
          className="w-full bg-transparent border-b border-[var(--m12-border)]/40 focus:border-[#2563EB] text-sm font-semibold text-[var(--m12-text)] py-1 focus:outline-none transition-colors"
        />
        <textarea
          value={capability.description || ''}
          onChange={e => updateCapability(capabilityId, { description: e.target.value })}
          placeholder="Description..."
          rows={2}
          className="w-full bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded-lg px-2.5 py-1.5 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60 resize-none"
        />
      </div>

      {/* INPUTS section */}
      <div>
        <SectionLabel label="Inputs" count={inputs.length} />
        <div className="space-y-2">
          {inputs.map(input => {
            const ip = informationProducts.find(p => p.id === input.information_product_id)
            return (
              <div key={input.id} className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/30 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--m12-text)]">{ip?.name || '(deleted)'}</span>
                  <button
                    onClick={() => removeInput(input.id, capabilityId)}
                    className="text-[var(--m12-text-muted)] hover:text-red-400 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                {/* Supplier personas */}
                <div>
                  <div className="text-[9px] text-[var(--m12-text-muted)] uppercase tracking-wider mb-1 font-[family-name:var(--font-space-mono)]">Suppliers</div>
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
                  <div className="text-[9px] text-[var(--m12-text-muted)] uppercase tracking-wider mb-1 font-[family-name:var(--font-space-mono)]">
                    Source Systems
                    {input.source_system_ids.length > 1 && (
                      <span className="ml-1 text-[var(--m12-text-faint)] normal-case">(order = data lineage)</span>
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
                                <svg width="10" height="12" viewBox="0 0 10 12" fill="none" className="text-[var(--m12-border)]">
                                  <path d="M5 0v9M2.5 7L5 10l2.5-3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 bg-[var(--m12-bg)] border border-[var(--m12-border)]/30 rounded-lg px-2 py-1.5 group/sys">
                              <div className="w-2 h-2 rounded shrink-0" style={{ backgroundColor: sys.color || tmpl?.color || '#64748B' }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-medium text-[var(--m12-text)] truncate">{sys.name}</div>
                                {tmpl && <div className="text-[7px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase">{tmpl.label}</div>}
                              </div>
                              <span className="text-[7px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] font-bold">
                                {isFirst && input.source_system_ids.length > 1 ? 'ORIGIN' : `#${idx + 1}`}
                              </span>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/sys:opacity-100 transition-opacity">
                                {!isFirst && (
                                  <button onClick={() => { const ids = [...input.source_system_ids]; [ids[idx-1],ids[idx]]=[ids[idx],ids[idx-1]]; updateInputSystems(input.id, capabilityId, ids) }} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors p-0.5" title="Move up">
                                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 1.5L1.5 4.5h5L4 1.5z" fill="currentColor" /></svg>
                                  </button>
                                )}
                                {!isLast && (
                                  <button onClick={() => { const ids = [...input.source_system_ids]; [ids[idx],ids[idx+1]]=[ids[idx+1],ids[idx]]; updateInputSystems(input.id, capabilityId, ids) }} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors p-0.5" title="Move down">
                                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 6.5L1.5 3.5h5L4 6.5z" fill="currentColor" /></svg>
                                  </button>
                                )}
                                <button onClick={() => updateInputSystems(input.id, capabilityId, input.source_system_ids.filter(id => id !== sysId))} className="text-[var(--m12-text-muted)] hover:text-red-400 transition-colors p-0.5" title="Remove">
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
                      return tmpl ? `${tmpl.label} — ${tmpl.description}` : 'Other'
                    }}
                    emptyLabel="No more systems to add"
                    placeholder="+ Add source system..."
                  />
                </div>
                {/* Feeding system (single select) */}
                <div>
                  <div className="text-[9px] text-[var(--m12-text-muted)] uppercase tracking-wider mb-1 font-[family-name:var(--font-space-mono)]">
                    Feeding System
                    <span className="ml-1 text-[var(--m12-text-faint)] normal-case">(delivers to process)</span>
                  </div>
                  {(() => {
                    const feedSys = input.feeding_system_id ? logicalSystems.find(s => s.id === input.feeding_system_id) : null
                    const feedTmpl = feedSys ? SYSTEM_TEMPLATES.find(t => t.type === feedSys.system_type) : null
                    return (
                      <div className="relative">
                        <select
                          value={input.feeding_system_id || ''}
                          onChange={e => updateInputFeedingSystem(input.id, capabilityId, e.target.value || null)}
                          className="w-full bg-[var(--m12-bg-input)] border border-[#EAB308]/30 rounded-lg px-2.5 py-2 text-xs text-[var(--m12-text)] focus:outline-none focus:border-[#EAB308]/60 appearance-none pr-7"
                          style={feedSys ? { borderLeftWidth: 3, borderLeftColor: feedSys.color || feedTmpl?.color || '#64748B' } : {}}
                        >
                          <option value="">None</option>
                          {logicalSystems
                            .filter(s => !input.source_system_ids.includes(s.id))
                            .map(s => {
                              const t = SYSTEM_TEMPLATES.find(t => t.type === s.system_type)
                              return <option key={s.id} value={s.id}>{s.name}{t ? ` (${t.label})` : ''}</option>
                            })
                          }
                        </select>
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--m12-text-muted)] pointer-events-none">
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
                />
              </div>
            )
          })}

          {/* Add existing IP as input */}
          {availableForInput.length > 0 && (
            <div>
              <div className="text-[9px] text-[var(--m12-text-muted)] mb-1 font-[family-name:var(--font-space-mono)]">ADD EXISTING</div>
              <div className="flex flex-wrap gap-1">
                {availableForInput.slice(0, 8).map(ip => (
                  <button
                    key={ip.id}
                    onClick={() => handleAddInputIP(ip.id)}
                    className="text-[10px] px-2 py-0.5 rounded border border-dashed border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:border-[#EAB308]/60 hover:text-[#EAB308] transition-colors"
                  >
                    + {ip.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick-create new IP as input */}
          <QuickAdd placeholder="New input info product..." onAdd={handleQuickCreateAndAddInput} />
        </div>
      </div>

      {/* OUTPUTS section */}
      <div>
        <SectionLabel label="Outputs" count={outputs.length} />
        <div className="space-y-2">
          {outputs.map(output => {
            const ip = informationProducts.find(p => p.id === output.information_product_id)
            return (
              <div key={output.id} className="bg-[var(--m12-bg)] border border-[var(--m12-border)]/30 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--m12-text)]">{ip?.name || '(deleted)'}</span>
                  <button
                    onClick={() => removeOutput(output.id, capabilityId)}
                    className="text-[var(--m12-text-muted)] hover:text-red-400 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                {/* Consumer personas */}
                <div>
                  <div className="text-[9px] text-[var(--m12-text-muted)] uppercase tracking-wider mb-1 font-[family-name:var(--font-space-mono)]">Consumers</div>
                  <MultiSelect
                    items={personas}
                    selectedIds={output.consumer_persona_ids}
                    onChange={ids => updateOutputConsumers(output.id, capabilityId, ids)}
                    colorFn={p => p.color}
                    emptyLabel="Create personas first"
                  />
                </div>
                {/* Data Objects */}
                <DimensionsEditor
                  dimensions={output.dimensions || []}
                  side="output"
                  itemId={output.id}
                  capabilityId={capabilityId}
                />
              </div>
            )
          })}

          {/* Add existing IP as output */}
          {availableForOutput.length > 0 && (
            <div>
              <div className="text-[9px] text-[var(--m12-text-muted)] mb-1 font-[family-name:var(--font-space-mono)]">ADD EXISTING</div>
              <div className="flex flex-wrap gap-1">
                {availableForOutput.slice(0, 8).map(ip => (
                  <button
                    key={ip.id}
                    onClick={() => handleAddOutputIP(ip.id)}
                    className="text-[10px] px-2 py-0.5 rounded border border-dashed border-[var(--m12-border)]/40 text-[var(--m12-text-muted)] hover:border-[#10B981]/60 hover:text-[#10B981] transition-colors"
                  >
                    + {ip.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick-create new IP as output */}
          <QuickAdd placeholder="New output info product..." onAdd={handleQuickCreateAndAddOutput} />
        </div>
      </div>

      {/* Delete capability */}
      <div className="pt-2 border-t border-[var(--m12-border)]/20">
        <button
          onClick={() => { if (confirm(`Delete capability "${capability.name}"?`)) removeCapability(capabilityId) }}
          className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors font-[family-name:var(--font-space-mono)] uppercase tracking-wider"
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
      <div className="bg-[var(--m12-bg)] border border-[#2563EB]/40 rounded-lg p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          {color && (
            <div className={`w-2.5 h-2.5 shrink-0 ${colorDot === 'square' ? 'rounded' : 'rounded-full'}`} style={{ backgroundColor: color }} />
          )}
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            autoFocus
            className="flex-1 bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded px-2 py-1 text-xs text-[var(--m12-text)] focus:outline-none focus:border-[#2563EB]/60"
          />
        </div>
        {onSaveSecondary && (
          <input
            value={editSecondary}
            onChange={e => setEditSecondary(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder={secondaryLabel || 'Role...'}
            className="w-full bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded px-2 py-1 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60"
          />
        )}
        {onSaveCategory && (
          <select
            value={editCategory}
            onChange={e => setEditCategory(e.target.value)}
            className="w-full bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded px-2 py-1 text-xs text-[var(--m12-text)] focus:outline-none focus:border-[#2563EB]/60"
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
                className={`w-5 h-5 rounded-full border-2 transition-colors ${color === c ? 'border-white scale-110' : 'border-transparent hover:border-white/40'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
        {children}
        <div className="flex gap-1.5">
          <button onClick={save} className="text-[10px] bg-[#2563EB] hover:bg-[#3B82F6] text-white px-2.5 py-1 rounded font-medium transition-colors">Save</button>
          <button onClick={() => setEditingId(null)} className="text-[10px] text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] px-2 py-1 transition-colors">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 group cursor-pointer hover:bg-[var(--m12-bg)]/50 rounded-lg px-1 py-0.5 -mx-1 transition-colors" onClick={startEditing}>
      {color && (
        <div className={`w-2.5 h-2.5 shrink-0 ${colorDot === 'square' ? 'rounded' : 'rounded-full'}`} style={{ backgroundColor: color }} />
      )}
      {!color && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[var(--m12-text-muted)] shrink-0">
          <rect x="1" y="2" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
          <path d="M3 4.5h4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        </svg>
      )}
      <span className="text-xs text-[var(--m12-text)] flex-1 truncate">{name}</span>
      {categoryValue && (
        <span className="text-[8px] text-[var(--m12-text-muted)] bg-[var(--m12-bg)] border border-[var(--m12-border)]/30 rounded px-1 py-0.5 font-[family-name:var(--font-space-mono)] uppercase">
          {categoryValue}
        </span>
      )}
      {secondaryField && !categoryValue && (
        <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">{secondaryField}</span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 text-[var(--m12-text-muted)] hover:text-red-400 transition-all"
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
          <div key={ip.id} className={`border rounded-lg transition-all ${isExpanded ? 'border-[var(--m12-border)]/50 bg-[var(--m12-bg)]/50' : 'border-transparent'}`}>
            {/* Collapsed row */}
            <div
              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--m12-bg)]/50 rounded-lg transition-colors group"
              onClick={() => setExpandedId(isExpanded ? null : ip.id)}
            >
              <button className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors shrink-0">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                  <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[var(--m12-text-muted)] shrink-0">
                <rect x="1" y="2" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
                <path d="M3 4.5h4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
              </svg>
              <span className="text-xs text-[var(--m12-text)] flex-1 truncate">{ip.name}</span>
              {ip.category && (
                <span className="text-[8px] text-[var(--m12-text-muted)] bg-[var(--m12-bg)] border border-[var(--m12-border)]/30 rounded px-1 py-0.5 font-[family-name:var(--font-space-mono)] uppercase">
                  {ip.category}
                </span>
              )}
              {usedIn.length > 0 && (
                <span className="text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)]">
                  {usedIn.length}x
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); removeInformationProduct(ip.id) }}
                className="opacity-0 group-hover:opacity-100 text-[var(--m12-text-muted)] hover:text-red-400 transition-all shrink-0"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-3 pb-2.5 pt-1 space-y-2 border-t border-[var(--m12-border)]/20 mx-1">
                {/* Edit button */}
                <button
                  onClick={() => setEditingId(ip.id)}
                  className="text-[8px] font-[family-name:var(--font-space-mono)] text-[#2563EB] hover:text-[#3B82F6] uppercase tracking-wider font-bold transition-colors"
                >
                  Edit Name / Category
                </button>

                {/* Usage */}
                {usedIn.length > 0 ? (
                  <div>
                    <div className="text-[8px] text-[var(--m12-text-muted)] uppercase tracking-wider mb-1 font-[family-name:var(--font-space-mono)] font-bold">Used In</div>
                    <div className="space-y-0.5">
                      {usedIn.map((u, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[9px]">
                          <span className={`text-[7px] font-[family-name:var(--font-space-mono)] font-bold uppercase px-1 py-0.5 rounded ${
                            u.side === 'input'
                              ? 'bg-[#EAB308]/10 text-[#EAB308]'
                              : 'bg-[#10B981]/10 text-[#10B981]'
                          }`}>
                            {u.side === 'input' ? 'IN' : 'OUT'}
                          </span>
                          <span className="text-[var(--m12-text-secondary)] truncate">{u.capName}</span>
                          {u.dimCount > 0 && (
                            <span className="text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] text-[7px]">{u.dimCount} dims</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-[9px] text-[var(--m12-text-faint)] italic">Not used in any capability yet</div>
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

  const [activeTab, setActiveTab] = useState<'personas' | 'products' | 'systems'>('personas')
  const [newSystemType, setNewSystemType] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleAddPersona = useCallback(async (name: string) => {
    const colorIdx = personas.length % PERSONA_COLORS.length
    await addPersona(orgId, { name, color: PERSONA_COLORS[colorIdx] })
  }, [orgId, personas.length, addPersona])

  const handleAddIP = useCallback(async (name: string) => {
    await addInformationProduct(orgId, { name })
  }, [orgId, addInformationProduct])

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
  ]

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--m12-bg)] rounded-lg p-0.5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setEditingId(null) }}
            className={`flex-1 text-[9px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] font-bold py-1.5 px-2 rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-[var(--m12-bg-card)] text-[var(--m12-text)] shadow-sm'
                : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
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
                  className="w-full bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded px-2 py-1 text-xs text-[var(--m12-text)] focus:outline-none focus:border-[#2563EB]/60"
                >
                  <option value="">Type (optional)</option>
                  {SYSTEM_TEMPLATES.map(t => (
                    <option key={t.type} value={t.type}>{t.label} — {t.description}</option>
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
              className="w-full bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded-lg px-2.5 py-1.5 text-xs text-[var(--m12-text)] focus:outline-none focus:border-[#2563EB]/60"
            >
              <option value="">Type (optional)</option>
              {SYSTEM_TEMPLATES.map(t => (
                <option key={t.type} value={t.type}>{t.label} — {t.description}</option>
              ))}
            </select>
            <QuickAdd placeholder="New system name..." onAdd={handleAddSystem} />
          </div>
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

  return (
    <div className="w-[380px] shrink-0 bg-[var(--m12-bg-card)] border-l border-[var(--m12-border)]/40 flex flex-col h-full overflow-hidden">
      {/* Sidebar header */}
      <div className="px-4 py-3 border-b border-[var(--m12-border)]/40">
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setSidebarMode('detail')}
            className={`flex-1 text-[9px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] font-bold py-1.5 rounded-md transition-colors ${
              sidebarMode === 'detail'
                ? 'bg-[#2563EB]/10 text-[#93C5FD]'
                : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
            }`}
          >
            Capability
          </button>
          <button
            onClick={() => setSidebarMode('entities')}
            className={`flex-1 text-[9px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] font-bold py-1.5 rounded-md transition-colors ${
              sidebarMode === 'entities'
                ? 'bg-[#2563EB]/10 text-[#93C5FD]'
                : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
            }`}
          >
            Entity Pool
          </button>
        </div>
      </div>

      {/* Sidebar content */}
      <div className="flex-1 overflow-y-auto p-4">
        {sidebarMode === 'detail' ? (
          selectedCapabilityId ? (
            <CapabilityDetail capabilityId={selectedCapabilityId} orgId={orgId} />
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-[var(--m12-text-muted)]">
                Select a capability from the visual, or add a new one.
              </div>

              {/* Capability list */}
              <div className="space-y-1">
                <SectionLabel label="Capabilities" count={capabilities.length} />
                {capabilities.map(cap => (
                  <button
                    key={cap.id}
                    onClick={() => useSIPOCStore.getState().setSelectedCapability(cap.id)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-[var(--m12-text)] hover:bg-[var(--m12-bg)] transition-colors border border-transparent hover:border-[var(--m12-border)]/30"
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
