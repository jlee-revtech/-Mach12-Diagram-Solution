'use client'

import { useState, useCallback } from 'react'
import { useSIPOCStore } from '@/lib/sipoc/store'
import type { Persona, InformationProduct, LogicalSystem } from '@/lib/sipoc/types'
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
function TagPicker<T extends { id: string; name: string }>({
  items,
  selectedIds,
  onChange,
  colorFn,
  emptyLabel,
}: {
  items: T[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  colorFn?: (item: T) => string | undefined
  emptyLabel: string
}) {
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

  return (
    <div className="flex flex-wrap gap-1">
      {items.map(item => {
        const isSelected = selectedIds.includes(item.id)
        const color = colorFn?.(item)
        return (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all border ${
              isSelected
                ? 'border-[#2563EB]/60 bg-[#2563EB]/15 text-[var(--m12-text)]'
                : 'border-[var(--m12-border)]/30 text-[var(--m12-text-muted)] hover:border-[var(--m12-border)]/60'
            }`}
          >
            {color && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
            {item.name}
          </button>
        )
      })}
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
                  <TagPicker
                    items={personas}
                    selectedIds={input.supplier_persona_ids}
                    onChange={ids => updateInputSuppliers(input.id, capabilityId, ids)}
                    colorFn={p => p.color}
                    emptyLabel="Create personas first"
                  />
                </div>
                {/* Source systems */}
                <div>
                  <div className="text-[9px] text-[var(--m12-text-muted)] uppercase tracking-wider mb-1 font-[family-name:var(--font-space-mono)]">Source Systems</div>
                  <TagPicker
                    items={logicalSystems}
                    selectedIds={input.source_system_ids}
                    onChange={ids => updateInputSystems(input.id, capabilityId, ids)}
                    colorFn={s => s.color || '#64748B'}
                    emptyLabel="Create logical systems first"
                  />
                </div>
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
                  <TagPicker
                    items={personas}
                    selectedIds={output.consumer_persona_ids}
                    onChange={ids => updateOutputConsumers(output.id, capabilityId, ids)}
                    colorFn={p => p.color}
                    emptyLabel="Create personas first"
                  />
                </div>
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

// ─── Entity Pool Manager ────────────────────────────────
function EntityPool({ orgId }: { orgId: string }) {
  const personas = useSIPOCStore(s => s.personas)
  const informationProducts = useSIPOCStore(s => s.informationProducts)
  const logicalSystems = useSIPOCStore(s => s.logicalSystems)
  const addPersona = useSIPOCStore(s => s.addPersona)
  const removePersona = useSIPOCStore(s => s.removePersona)
  const addInformationProduct = useSIPOCStore(s => s.addInformationProduct)
  const removeInformationProduct = useSIPOCStore(s => s.removeInformationProduct)
  const addLogicalSystem = useSIPOCStore(s => s.addLogicalSystem)
  const removeLogicalSystem = useSIPOCStore(s => s.removeLogicalSystem)

  const [activeTab, setActiveTab] = useState<'personas' | 'products' | 'systems'>('personas')
  const [newSystemType, setNewSystemType] = useState('')

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
            onClick={() => setActiveTab(tab.key)}
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
            <div key={p.id} className="flex items-center gap-2 group">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-xs text-[var(--m12-text)] flex-1 truncate">{p.name}</span>
              {p.role && <span className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">{p.role}</span>}
              <button
                onClick={() => removePersona(p.id)}
                className="opacity-0 group-hover:opacity-100 text-[var(--m12-text-muted)] hover:text-red-400 transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
          <QuickAdd placeholder="New persona name..." onAdd={handleAddPersona} />
        </div>
      )}

      {/* Information Products list */}
      {activeTab === 'products' && (
        <div className="space-y-1.5">
          {informationProducts.map(ip => (
            <div key={ip.id} className="flex items-center gap-2 group">
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
              <button
                onClick={() => removeInformationProduct(ip.id)}
                className="opacity-0 group-hover:opacity-100 text-[var(--m12-text-muted)] hover:text-red-400 transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
          <QuickAdd placeholder="New info product name..." onAdd={handleAddIP} />
        </div>
      )}

      {/* Logical Systems list */}
      {activeTab === 'systems' && (
        <div className="space-y-1.5">
          {logicalSystems.map(s => {
            const template = SYSTEM_TEMPLATES.find(t => t.type === s.system_type)
            return (
              <div key={s.id} className="flex items-center gap-2 group">
                <div className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: s.color || template?.color || '#64748B' }} />
                <span className="text-xs text-[var(--m12-text)] flex-1 truncate">{s.name}</span>
                {template && (
                  <span className="text-[8px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase">{template.label}</span>
                )}
                <button
                  onClick={() => removeLogicalSystem(s.id)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--m12-text-muted)] hover:text-red-400 transition-all"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
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
