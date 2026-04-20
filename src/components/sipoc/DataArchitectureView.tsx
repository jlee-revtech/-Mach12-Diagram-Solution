'use client'

import { useMemo, useState } from 'react'
import { useSIPOCStore, type IPLineage, type SystemUsage, type SystemFlow } from '@/lib/sipoc/store'
import { SYSTEM_TEMPLATES } from '@/lib/diagram/types'

// ─── Small reusable UI ──────────────────────────────────
function Chip({ name, color, tone }: { name: string; color?: string; tone?: 'system' | 'persona' | 'tag' | 'cap' }) {
  const style = color && tone === 'tag'
    ? { backgroundColor: color, color: '#fff' }
    : { backgroundColor: color + '22', color }
  if (tone === 'cap') {
    return <span className="inline-flex items-center text-[10px] bg-[#2563EB]/10 border border-[#2563EB]/30 text-[#93C5FD] rounded px-1.5 py-0.5">{name}</span>
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5" style={tone === 'tag' ? style : { backgroundColor: 'var(--m12-bg)', color: 'var(--m12-text-secondary)', border: '1px solid var(--m12-border)' }}>
      {color && tone !== 'tag' && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
      {name}
    </span>
  )
}

function SystemChip({ name, color, systemType }: { name: string; color?: string | null; systemType?: string }) {
  const tmpl = SYSTEM_TEMPLATES.find(t => t.type === systemType)
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] bg-[var(--m12-bg)] border border-[var(--m12-border)]/40 rounded-md px-2 py-0.5 text-[var(--m12-text-secondary)]">
      <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color || tmpl?.color || '#64748B' }} />
      {name}
      {tmpl && <span className="text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] uppercase">{tmpl.label}</span>}
    </span>
  )
}

function Arrow() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" className="shrink-0 text-[var(--m12-text-faint)] opacity-60">
      <path d="M0 6h12M10 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SectionLabel({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-[8px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider font-bold" style={{ color }}>{label}</span>
      <span className="text-[8px] bg-[var(--m12-bg)] border border-[var(--m12-border)]/30 rounded px-1 text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)]">{count}</span>
    </div>
  )
}

// ─── IP Lineage Row ─────────────────────────────────────
function LineageRow({ lineage }: { lineage: IPLineage }) {
  const [expanded, setExpanded] = useState(false)
  const l = lineage
  return (
    <div className="border border-[var(--m12-border)]/30 rounded-lg bg-[var(--m12-bg-card)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--m12-bg)] transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`text-[var(--m12-text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}>
          <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--m12-text)] truncate">{l.ip.name}</span>
            {l.ip.category && <span className="text-[9px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-muted)] uppercase">{l.ip.category}</span>}
            {l.tags.map(t => <Chip key={t.id} name={t.name} color={t.color} tone="tag" />)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px] text-[var(--m12-text-muted)]">
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
        <div className="border-t border-[var(--m12-border)]/20 px-4 py-3 space-y-3 bg-[var(--m12-bg)]/40">
          {/* System flow: sources → feeding → processing → destinations */}
          <div>
            <div className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[var(--m12-text-muted)] font-bold mb-1.5">System Flow</div>
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
              <div className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[var(--m12-text-muted)] font-bold mb-1">Consumed By ({l.consumedBy.length})</div>
              <div className="flex flex-wrap gap-1">
                {l.consumedBy.length > 0 ? l.consumedBy.map(c => <Chip key={c.id} name={c.name} tone="cap" />) : <span className="text-[10px] text-[var(--m12-text-faint)] italic">—</span>}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[var(--m12-text-muted)] font-bold mb-1">Produced By ({l.producedBy.length})</div>
              <div className="flex flex-wrap gap-1">
                {l.producedBy.length > 0 ? l.producedBy.map(c => <Chip key={c.id} name={c.name} tone="cap" />) : <span className="text-[10px] text-[var(--m12-text-faint)] italic">—</span>}
              </div>
            </div>
          </div>

          {/* Personas + Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[var(--m12-text-muted)] font-bold mb-1">Suppliers / Consumers</div>
              <div className="flex flex-wrap gap-1">
                {[...l.supplierPersonas, ...l.consumerPersonas.filter(c => !l.supplierPersonas.some(s => s.id === c.id))].map(p => (
                  <Chip key={p.id} name={p.name} color={p.color} tone="persona" />
                ))}
                {l.supplierPersonas.length + l.consumerPersonas.length === 0 && <span className="text-[10px] text-[var(--m12-text-faint)] italic">—</span>}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[var(--m12-text-muted)] font-bold mb-1">Dimensions ({l.dimensions.length})</div>
              <div className="flex flex-wrap gap-1">
                {l.dimensions.length > 0 ? l.dimensions.map(d => (
                  <span key={d.id} className="text-[10px] text-[var(--m12-text-secondary)] bg-[var(--m12-bg)] border border-[var(--m12-border)]/30 rounded px-1.5 py-0.5">{d.name}</span>
                )) : <span className="text-[10px] text-[var(--m12-text-faint)] italic">—</span>}
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
    <div className="border border-[var(--m12-border)]/30 rounded-lg bg-[var(--m12-bg-card)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--m12-border)]/20 flex items-center gap-3" style={{ borderLeftWidth: 4, borderLeftColor: usage.system.color || tmpl?.color || '#64748B' }}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--m12-text)]">{usage.system.name}</div>
          {tmpl && <div className="text-[9px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase tracking-wider">{tmpl.label} · {tmpl.description}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-[var(--m12-text)]">{totalIps}</div>
          <div className="text-[8px] text-[var(--m12-text-muted)] font-[family-name:var(--font-space-mono)] uppercase">IP Flows</div>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2 text-[11px]">
        {usage.asSource.length > 0 && (
          <div>
            <span className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[#F97316] font-bold mr-2">Sources</span>
            <div className="inline-flex flex-wrap gap-1 mt-0.5">
              {usage.asSource.map(ip => <Chip key={ip.id} name={ip.name} />)}
            </div>
          </div>
        )}
        {usage.asFeeding.length > 0 && (
          <div>
            <span className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[#EAB308] font-bold mr-2">Feeds</span>
            <div className="inline-flex flex-wrap gap-1 mt-0.5">
              {usage.asFeeding.map(ip => <Chip key={ip.id} name={ip.name} />)}
            </div>
          </div>
        )}
        {usage.asProcessing.length > 0 && (
          <div>
            <span className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[#2563EB] font-bold mr-2">Processes</span>
            <div className="inline-flex flex-wrap gap-1 mt-0.5">
              {usage.asProcessing.map(e => <Chip key={e.capability.id} name={`${e.capability.name} (${e.ips.length})`} tone="cap" />)}
            </div>
          </div>
        )}
        {usage.asDestination.length > 0 && (
          <div>
            <span className="text-[9px] font-[family-name:var(--font-space-mono)] uppercase tracking-wider text-[#10B981] font-bold mr-2">Receives</span>
            <div className="inline-flex flex-wrap gap-1 mt-0.5">
              {usage.asDestination.map(ip => <Chip key={ip.id} name={ip.name} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Flow Diagram (simple SVG Sankey-ish) ───────────────
function FlowDiagram({ flows, systems }: { flows: SystemFlow[]; systems: { id: string; name: string; color?: string | null }[] }) {
  if (flows.length === 0) {
    return <div className="text-center py-16 text-[var(--m12-text-muted)] text-sm italic">No system-to-system flows defined yet.</div>
  }
  // Simple two-column layout: sources on left, destinations on right
  const sourceIds = [...new Set(flows.map(f => f.from))]
  const destIds = [...new Set(flows.map(f => f.to))]
  const allIds = [...new Set([...sourceIds, ...destIds])]
  const sysById = new Map(systems.map(s => [s.id, s]))

  // Layout: nodes arranged in two columns
  const nodeH = 36
  const nodeGap = 10
  const leftX = 20
  const rightX = 460
  const width = 620
  const height = Math.max(sourceIds.length, destIds.length) * (nodeH + nodeGap) + 40

  const leftPos = new Map<string, number>(sourceIds.map((id, i) => [id, 20 + i * (nodeH + nodeGap)]))
  const rightPos = new Map<string, number>(destIds.map((id, i) => [id, 20 + i * (nodeH + nodeGap)]))

  const maxW = Math.max(...flows.map(f => f.ips.length))

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="mx-auto">
        {/* Flows */}
        {flows.map((f, i) => {
          const y1 = (leftPos.get(f.from) ?? rightPos.get(f.from) ?? 0) + nodeH / 2
          const y2 = (rightPos.get(f.to) ?? leftPos.get(f.to) ?? 0) + nodeH / 2
          const strokeW = 1 + (f.ips.length / maxW) * 4
          const sys = sysById.get(f.from)
          return (
            <path
              key={i}
              d={`M ${leftX + 140} ${y1} C ${leftX + 260} ${y1}, ${rightX - 120} ${y2}, ${rightX} ${y2}`}
              stroke={sys?.color || '#64748B'}
              strokeOpacity="0.4"
              strokeWidth={strokeW}
              fill="none"
            />
          )
        })}
        {/* Source nodes */}
        {sourceIds.map(id => {
          const sys = sysById.get(id)
          if (!sys) return null
          const y = leftPos.get(id)!
          const ipCount = flows.filter(f => f.from === id).reduce((acc, f) => acc + f.ips.length, 0)
          return (
            <g key={`src-${id}`}>
              <rect x={leftX} y={y} width={140} height={nodeH} rx={4} fill="var(--m12-bg-card)" stroke={sys.color || '#64748B'} strokeWidth="1.5" />
              <rect x={leftX} y={y} width={4} height={nodeH} fill={sys.color || '#64748B'} />
              <text x={leftX + 12} y={y + 14} fontSize="10" fill="var(--m12-text)" fontWeight="600">{sys.name.slice(0, 18)}</text>
              <text x={leftX + 12} y={y + 27} fontSize="8" fill="var(--m12-text-muted)">{ipCount} IP flow{ipCount !== 1 ? 's' : ''}</text>
            </g>
          )
        })}
        {/* Destination nodes */}
        {destIds.map(id => {
          const sys = sysById.get(id)
          if (!sys) return null
          const y = rightPos.get(id)!
          const ipCount = flows.filter(f => f.to === id).reduce((acc, f) => acc + f.ips.length, 0)
          return (
            <g key={`dst-${id}`}>
              <rect x={rightX} y={y} width={140} height={nodeH} rx={4} fill="var(--m12-bg-card)" stroke={sys.color || '#64748B'} strokeWidth="1.5" />
              <rect x={rightX} y={y} width={4} height={nodeH} fill={sys.color || '#64748B'} />
              <text x={rightX + 12} y={y + 14} fontSize="10" fill="var(--m12-text)" fontWeight="600">{sys.name.slice(0, 18)}</text>
              <text x={rightX + 12} y={y + 27} fontSize="8" fill="var(--m12-text-muted)">{ipCount} IP flow{ipCount !== 1 ? 's' : ''}</text>
            </g>
          )
        })}
      </svg>
      {allIds.length === 0 && <div className="text-center py-8 text-[var(--m12-text-muted)] text-sm italic">No systems connected via IP flows.</div>}
    </div>
  )
}

// ─── Main View ──────────────────────────────────────────
export default function DataArchitectureView({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'lineage' | 'systems' | 'flow'>('lineage')
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
    <div className="fixed inset-0 bg-[var(--m12-bg)]/95 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--m12-border)]/40 bg-[var(--m12-bg-card)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#2563EB] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="white" strokeWidth="1.2"/>
              <rect x="10" y="1" width="5" height="5" rx="1" stroke="white" strokeWidth="1.2"/>
              <rect x="5.5" y="10" width="5" height="5" rx="1" stroke="white" strokeWidth="1.2"/>
              <path d="M3.5 6v1.5M12.5 6v1.5M8 7.5v2.5M3.5 7.5h9" stroke="white" strokeWidth="1"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--m12-text)]">Data & System Architecture</div>
            <div className="text-[10px] text-[var(--m12-text-muted)]">
              {arch.ipLineages.length} information products · {systemsList.length} systems · {arch.flows.length} flows
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] transition-colors">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--m12-border)]/30 bg-[var(--m12-bg-card)]/40 shrink-0">
        <div className="flex gap-1 bg-[var(--m12-bg)] rounded-lg p-0.5">
          {[
            { id: 'lineage' as const, label: `IP Lineage (${arch.ipLineages.length})` },
            { id: 'systems' as const, label: `By System (${systemsList.length})` },
            { id: 'flow' as const, label: `Flow Diagram` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-[10px] uppercase tracking-wider font-[family-name:var(--font-space-mono)] font-bold py-1.5 px-3 rounded-md transition-colors ${
                tab === t.id
                  ? 'bg-[var(--m12-bg-card)] text-[var(--m12-text)] shadow-sm'
                  : 'text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)]'
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
            className="bg-[var(--m12-bg-input)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-1.5 text-xs text-[var(--m12-text)] placeholder:text-[var(--m12-text-faint)] focus:outline-none focus:border-[#2563EB]/60 w-64"
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'lineage' && (
          <div className="space-y-2 max-w-5xl mx-auto">
            {filteredLineages.length === 0 ? (
              <div className="text-center py-16 text-[var(--m12-text-muted)] text-sm italic">
                {arch.ipLineages.length === 0 ? 'No information products defined yet.' : 'No matches.'}
              </div>
            ) : (
              filteredLineages.map(l => <LineageRow key={l.ip.id} lineage={l} />)
            )}
          </div>
        )}
        {tab === 'systems' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-6xl mx-auto">
            {systemsList.length === 0 ? (
              <div className="col-span-full text-center py-16 text-[var(--m12-text-muted)] text-sm italic">No systems defined yet.</div>
            ) : (
              systemsList.map(u => <SystemCard key={u.system.id} usage={u} />)
            )}
          </div>
        )}
        {tab === 'flow' && (
          <div className="max-w-4xl mx-auto">
            <FlowDiagram flows={arch.flows} systems={arch.systems} />
          </div>
        )}
      </div>
    </div>
  )
}
