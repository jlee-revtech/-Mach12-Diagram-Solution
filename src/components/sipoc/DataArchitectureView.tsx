'use client'

import { useMemo, useState } from 'react'
import { X, ChevronRight, ArrowRight, Network } from 'lucide-react'
import { Button, EmptyState } from '@/components/common'
import { useSIPOCStore, type IPLineage, type SystemUsage } from '@/lib/sipoc/store'
import { SYSTEM_TEMPLATES } from '@/lib/diagram/types'
import NeighborhoodView from './NeighborhoodView'
import MatrixView from './MatrixView'

// ─── Small reusable UI ──────────────────────────────────
function Chip({ name, color, tone }: { name: string; color?: string; tone?: 'system' | 'persona' | 'tag' | 'cap' }) {
  if (tone === 'cap') {
    return <span className="inline-flex items-center text-[10px] bg-brand-50 border border-blue-200 text-brand-600 rounded px-1.5 py-0.5">{name}</span>
  }
  if (tone === 'tag' && color) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5" style={{ backgroundColor: color, color: '#fff' }}>
        {name}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 bg-surface-muted text-text-secondary border border-border">
      {color && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
      {name}
    </span>
  )
}

function SystemChip({ name, color, systemType }: { name: string; color?: string | null; systemType?: string }) {
  const tmpl = SYSTEM_TEMPLATES.find(t => t.type === systemType)
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] bg-surface-muted border border-border rounded-md px-2 py-0.5 text-text-secondary">
      <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color || tmpl?.color || '#64748B' }} />
      {name}
      {tmpl && <span className="text-[10px] text-text-tertiary font-mono uppercase">{tmpl.label}</span>}
    </span>
  )
}

function Arrow() {
  return <ArrowRight size={14} className="shrink-0 text-text-tertiary opacity-60" />
}

function SectionLabel({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-[10px] font-mono uppercase tracking-wider font-bold" style={{ color }}>{label}</span>
      <span className="text-[10px] bg-surface-muted border border-border rounded px-1 text-text-tertiary font-mono">{count}</span>
    </div>
  )
}

// ─── IP Lineage Row ─────────────────────────────────────
function LineageRow({ lineage }: { lineage: IPLineage }) {
  const [expanded, setExpanded] = useState(false)
  const l = lineage
  return (
    <div className="border border-border rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted transition-colors"
      >
        <ChevronRight size={10} className={`text-text-tertiary transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-body-md font-semibold text-text-primary truncate">{l.ip.name}</span>
            {l.ip.category && <span className="text-[10px] font-mono text-text-tertiary uppercase">{l.ip.category}</span>}
            {l.tags.map(t => <Chip key={t.id} name={t.name} color={t.color} tone="tag" />)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px] text-text-tertiary">
            <span>{l.sourceSystems.length} source</span>
            <span>·</span>
            <span>{l.feedingSystems.length} feeding</span>
            <span>·</span>
            <span>{l.processingSystems.length} processing</span>
            <span>·</span>
            <span>{l.destinationSystems.length} destination</span>
            <span>·</span>
            <span>{l.consumedBy.length + l.producedBy.length} capabilit{l.consumedBy.length + l.producedBy.length === 1 ? 'y' : 'ies'}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-surface-muted/40">
          {/* System flow: sources → feeding → processing → destinations */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary font-bold mb-1.5">System Flow</div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Sources */}
              {l.sourceSystems.length > 0 && <>
                <SectionLabel label="Source" count={l.sourceSystems.length} color="#F97316" />
                <div className="flex flex-wrap gap-1">
                  {l.sourceSystems.map(s => <SystemChip key={s.id} name={s.name} color={s.color} systemType={s.system_type} />)}
                </div>
                <Arrow />
              </>}
              {/* Feeding */}
              {l.feedingSystems.length > 0 && <>
                <SectionLabel label="Feeding" count={l.feedingSystems.length} color="#EAB308" />
                <div className="flex flex-wrap gap-1">
                  {l.feedingSystems.map(s => <SystemChip key={s.id} name={s.name} color={s.color} systemType={s.system_type} />)}
                </div>
                <Arrow />
              </>}
              {/* Processing */}
              {l.processingSystems.length > 0 && <>
                <SectionLabel label="Process" count={l.processingSystems.length} color="#2563EB" />
                <div className="flex flex-wrap gap-1">
                  {l.processingSystems.map(s => <SystemChip key={s.id} name={s.name} color={s.color} systemType={s.system_type} />)}
                </div>
                {l.destinationSystems.length > 0 && <Arrow />}
              </>}
              {/* Destinations */}
              {l.destinationSystems.length > 0 && <>
                <SectionLabel label="Destination" count={l.destinationSystems.length} color="#10B981" />
                <div className="flex flex-wrap gap-1">
                  {l.destinationSystems.map(s => <SystemChip key={s.id} name={s.name} color={s.color} systemType={s.system_type} />)}
                </div>
              </>}
            </div>
          </div>

          {/* Capabilities */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary font-bold mb-1">Consumed By ({l.consumedBy.length})</div>
              <div className="flex flex-wrap gap-1">
                {l.consumedBy.length > 0 ? l.consumedBy.map(c => <Chip key={c.id} name={c.name} tone="cap" />) : <span className="text-[10px] text-text-tertiary italic">-</span>}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary font-bold mb-1">Produced By ({l.producedBy.length})</div>
              <div className="flex flex-wrap gap-1">
                {l.producedBy.length > 0 ? l.producedBy.map(c => <Chip key={c.id} name={c.name} tone="cap" />) : <span className="text-[10px] text-text-tertiary italic">-</span>}
              </div>
            </div>
          </div>

          {/* Personas + Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary font-bold mb-1">Suppliers / Consumers</div>
              <div className="flex flex-wrap gap-1">
                {[...l.supplierPersonas, ...l.consumerPersonas.filter(c => !l.supplierPersonas.some(s => s.id === c.id))].map(p => (
                  <Chip key={p.id} name={p.name} color={p.color} tone="persona" />
                ))}
                {l.supplierPersonas.length + l.consumerPersonas.length === 0 && <span className="text-[10px] text-text-tertiary italic">-</span>}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary font-bold mb-1">Dimensions ({l.dimensions.length})</div>
              <div className="flex flex-wrap gap-1">
                {l.dimensions.length > 0 ? l.dimensions.map(d => (
                  <span key={d.id} className="text-[10px] text-text-secondary bg-surface-muted border border-border rounded px-1.5 py-0.5">{d.name}</span>
                )) : <span className="text-[10px] text-text-tertiary italic">-</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── System Usage Card ──────────────────────────────────
function SystemCard({ usage }: { usage: SystemUsage }) {
  const tmpl = SYSTEM_TEMPLATES.find(t => t.type === usage.system.system_type)
  const totalIps = usage.asSource.length + usage.asFeeding.length + usage.asDestination.length
  return (
    <div className="border border-border rounded-lg bg-white shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3" style={{ borderLeftWidth: 4, borderLeftColor: usage.system.color || tmpl?.color || '#64748B' }}>
        <div className="flex-1 min-w-0">
          <div className="text-body-md font-semibold text-text-primary">{usage.system.name}</div>
          {tmpl && <div className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">{tmpl.label} · {tmpl.description}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold font-display text-text-primary">{totalIps}</div>
          <div className="text-[10px] text-text-tertiary font-mono uppercase">IP Flows</div>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2 text-[11px]">
        {usage.asSource.length > 0 && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#F97316] font-bold mr-2">Sources</span>
            <div className="inline-flex flex-wrap gap-1 mt-0.5">
              {usage.asSource.map(ip => <Chip key={ip.id} name={ip.name} />)}
            </div>
          </div>
        )}
        {usage.asFeeding.length > 0 && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#EAB308] font-bold mr-2">Feeds</span>
            <div className="inline-flex flex-wrap gap-1 mt-0.5">
              {usage.asFeeding.map(ip => <Chip key={ip.id} name={ip.name} />)}
            </div>
          </div>
        )}
        {usage.asProcessing.length > 0 && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#2563EB] font-bold mr-2">Processes</span>
            <div className="inline-flex flex-wrap gap-1 mt-0.5">
              {usage.asProcessing.map(e => <Chip key={e.capability.id} name={`${e.capability.name} (${e.ips.length})`} tone="cap" />)}
            </div>
          </div>
        )}
        {usage.asDestination.length > 0 && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#10B981] font-bold mr-2">Receives</span>
            <div className="inline-flex flex-wrap gap-1 mt-0.5">
              {usage.asDestination.map(ip => <Chip key={ip.id} name={ip.name} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main View ──────────────────────────────────────────
export default function DataArchitectureView({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'neighborhood' | 'matrix' | 'lineage' | 'systems'>('neighborhood')
  const [filter, setFilter] = useState('')

  const data = useMemo(() => useSIPOCStore.getState().getDataArchitecture(), [])
  // Re-read on any store change that could affect this view
  const caps = useSIPOCStore(s => s.capabilities)
  const inputs = useSIPOCStore(s => s.inputs)
  const outputs = useSIPOCStore(s => s.outputs)
  const arch = useMemo(() => useSIPOCStore.getState().getDataArchitecture(), [caps, inputs, outputs])

  const filteredLineages = useMemo(() => {
    if (!filter.trim()) return arch.ipLineages
    const q = filter.toLowerCase()
    return arch.ipLineages.filter(l =>
      l.ip.name.toLowerCase().includes(q) ||
      (l.ip.category || '').toLowerCase().includes(q) ||
      l.tags.some(t => t.name.toLowerCase().includes(q)) ||
      l.sourceSystems.some(s => s.name.toLowerCase().includes(q)) ||
      l.processingSystems.some(s => s.name.toLowerCase().includes(q)) ||
      l.destinationSystems.some(s => s.name.toLowerCase().includes(q))
    )
  }, [arch, filter])

  const systemsList = useMemo(() => Object.values(arch.systemUsage).sort((a, b) => {
    const ac = a.asSource.length + a.asFeeding.length + a.asDestination.length + a.asProcessing.length
    const bc = b.asSource.length + b.asFeeding.length + b.asDestination.length + b.asProcessing.length
    return bc - ac
  }), [arch])

  return (
    <div className="fixed inset-0 bg-surface-muted z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <Network size={16} />
          </div>
          <div>
            <div className="text-heading-sm font-display text-text-primary">Data & System Architecture</div>
            <div className="text-body-sm text-text-secondary">
              {arch.ipLineages.length} information products · {systemsList.length} systems · {arch.flows.length} flows
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" iconOnly aria-label="Close" onClick={onClose} icon={<X size={18} />} />
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-white shrink-0">
        <div className="flex gap-1 bg-surface-muted rounded-lg p-0.5">
          {[
            { id: 'neighborhood' as const, label: 'Neighborhood' },
            { id: 'matrix' as const, label: 'Matrix' },
            { id: 'lineage' as const, label: `IP Lineage (${arch.ipLineages.length})` },
            { id: 'systems' as const, label: `By System (${systemsList.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-1.5 px-3 rounded text-body-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-brand-500 text-white'
                  : 'text-text-secondary hover:bg-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'lineage' && (
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by IP, system, tag..."
            className="h-8 px-3 rounded-lg border border-border bg-surface-input text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 w-64"
          />
        )}
      </div>

      {/* Content */}
      {tab === 'neighborhood' ? (
        <div className="flex-1 overflow-hidden">
          <NeighborhoodView />
        </div>
      ) : tab === 'matrix' ? (
        <div className="flex-1 overflow-hidden">
          <MatrixView />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'lineage' && (
            <div className="space-y-2 max-w-5xl mx-auto">
              {filteredLineages.length === 0 ? (
                <EmptyState
                  variant="inline"
                  title={arch.ipLineages.length === 0 ? 'No information products defined yet' : 'No matches'}
                />
              ) : (
                filteredLineages.map(l => <LineageRow key={l.ip.id} lineage={l} />)
              )}
            </div>
          )}
          {tab === 'systems' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-6xl mx-auto">
              {systemsList.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState variant="inline" title="No systems defined yet" />
                </div>
              ) : (
                systemsList.map(u => <SystemCard key={u.system.id} usage={u} />)
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
