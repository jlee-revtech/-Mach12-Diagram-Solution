'use client'

import { use, useEffect, useState, useMemo } from 'react'
import type {
  CapabilityMapRow, Capability, CapabilityInput, CapabilityOutput,
  Persona, InformationProduct, LogicalSystem, Tag, HydratedCapability, Dimension,
} from '@/lib/sipoc/types'
import {
  getShareByCode, getCapabilityMapAnon, listCapabilitiesAnon,
  listCapabilityInputsAnon, listCapabilityOutputsAnon,
  listPersonasAnon, listInformationProductsAnon, listLogicalSystemsAnon, listTagsAnon,
} from '@/lib/supabase/capability-maps'
import VersionBadge from '@/components/VersionBadge'

// ─── Types ──────────────────────────────────────────────
interface ShareData {
  map: CapabilityMapRow
  capabilities: Capability[]
  inputs: Record<string, CapabilityInput[]>
  outputs: Record<string, CapabilityOutput[]>
  personas: Persona[]
  informationProducts: InformationProduct[]
  logicalSystems: LogicalSystem[]
  tags: Tag[]
}

// ─── Hydration helper ───────────────────────────────────
function hydrate(data: ShareData): HydratedCapability[] {
  const personaMap = new Map(data.personas.map(p => [p.id, p]))
  const ipMap = new Map(data.informationProducts.map(ip => [ip.id, ip]))
  const sysMap = new Map(data.logicalSystems.map(s => [s.id, s]))
  const tagMap = new Map(data.tags.map(t => [t.id, t]))
  const resolveTags = (ids?: string[]): Tag[] =>
    (ids || []).map(id => tagMap.get(id)).filter((t): t is Tag => !!t)

  return data.capabilities.map(cap => ({
    ...cap,
    system: cap.system_id ? sysMap.get(cap.system_id) || null : null,
    inputs: (data.inputs[cap.id] || []).map(input => ({
      ...input,
      informationProduct: ipMap.get(input.information_product_id) || {
        id: input.information_product_id, organization_id: '', name: '(deleted)', created_at: '', updated_at: '',
      },
      supplierPersonas: input.supplier_persona_ids.map(id => personaMap.get(id)).filter((p): p is Persona => !!p),
      sourceSystems: input.source_system_ids.map(id => sysMap.get(id)).filter((s): s is LogicalSystem => !!s),
      feedingSystem: input.feeding_system_id ? sysMap.get(input.feeding_system_id) || null : null,
      tags: resolveTags(input.tag_ids),
      dimensions: (input.dimensions || []).map((d: Dimension) => ({ ...d, tags: resolveTags(d.tag_ids) })),
    })),
    outputs: (data.outputs[cap.id] || []).map(output => ({
      ...output,
      informationProduct: ipMap.get(output.information_product_id) || {
        id: output.information_product_id, organization_id: '', name: '(deleted)', created_at: '', updated_at: '',
      },
      consumerPersonas: output.consumer_persona_ids.map(id => personaMap.get(id)).filter((p): p is Persona => !!p),
      destinationSystems: (output.destination_system_ids || []).map(id => sysMap.get(id)).filter((s): s is LogicalSystem => !!s),
      dimensions: (output.dimensions || []).map((d: Dimension) => ({ ...d })),
    })),
  }))
}

// ─── SIPOC columns ──────────────────────────────────────
const SIPOC_COLORS = {
  S: '#F97316', I: '#EAB308', P: '#2563EB', O: '#10B981', C: '#8B5CF6',
}

function PersonaChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] rounded px-1.5 py-0.5" style={{ backgroundColor: color + '20', color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  )
}

function SystemChip({ name, color }: { name: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] bg-[#2563EB]/10 text-[#2563EB] rounded px-1.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded" style={{ backgroundColor: color || '#2563EB' }} />
      {name}
    </span>
  )
}

// ─── Capability SIPOC Block (read-only) ─────────────────
function ReadOnlySIPOC({ cap }: { cap: HydratedCapability }) {
  const [expanded, setExpanded] = useState(false)
  const hasContent = cap.inputs.length > 0 || cap.outputs.length > 0
  if (!hasContent && cap.level === 3) return null

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>
          <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-semibold text-gray-800 flex-1">{cap.name}</span>
        <span className="text-[9px] text-gray-400 font-mono uppercase">
          L{cap.level} · {cap.inputs.length}in / {cap.outputs.length}out
        </span>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4">
          <div className="grid grid-cols-5 gap-3 text-[10px]">
            {/* Suppliers */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: SIPOC_COLORS.S }}>Suppliers</div>
              <div className="space-y-1">
                {[...new Map(cap.inputs.flatMap(i => i.supplierPersonas).map(p => [p.id, p])).values()].map(p => (
                  <PersonaChip key={p.id} name={p.name} color={p.color} />
                ))}
              </div>
            </div>
            {/* Inputs */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: SIPOC_COLORS.I }}>Inputs</div>
              <div className="space-y-1.5">
                {cap.inputs.map(inp => (
                  <div key={inp.id} className="bg-yellow-50 border border-yellow-200/50 rounded px-2 py-1.5">
                    <div className="font-medium text-gray-800">{inp.informationProduct.name}</div>
                    {inp.tags.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {inp.tags.map(t => (
                          <span key={t.id} className="text-[8px] px-1 rounded text-white" style={{ backgroundColor: t.color }}>{t.name}</span>
                        ))}
                      </div>
                    )}
                    {inp.dimensions.length > 0 && (
                      <div className="mt-1 text-[9px] text-gray-500">{inp.dimensions.map(d => d.name).join(', ')}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Process */}
            <div className="flex flex-col items-center justify-center">
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: SIPOC_COLORS.P }}>Process</div>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg px-3 py-3 text-center w-full">
                <div className="text-[11px] font-bold text-gray-800">{cap.name}</div>
                {cap.system && <div className="mt-1"><SystemChip name={cap.system.name} color={cap.system.color || undefined} /></div>}
                {(cap.features || []).length > 0 && (
                  <div className="mt-2 text-[8px] text-blue-500">{cap.features!.length} feature{cap.features!.length !== 1 ? 's' : ''}</div>
                )}
              </div>
            </div>
            {/* Outputs */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: SIPOC_COLORS.O }}>Outputs</div>
              <div className="space-y-1.5">
                {cap.outputs.map(out => (
                  <div key={out.id} className="bg-green-50 border border-green-200/50 rounded px-2 py-1.5">
                    <div className="font-medium text-gray-800">{out.informationProduct.name}</div>
                    {out.dimensions.length > 0 && (
                      <div className="mt-1 text-[9px] text-gray-500">{out.dimensions.map(d => d.name).join(', ')}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Customers */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: SIPOC_COLORS.C }}>Customers</div>
              <div className="space-y-1">
                {[...new Map(cap.outputs.flatMap(o => o.consumerPersonas).map(p => [p.id, p])).values()].map(p => (
                  <PersonaChip key={p.id} name={p.name} color={p.color} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tree node for L1/L2 groups ─────────────────────────
const L1_COLORS = ['#2563EB', '#10B981', '#F97316', '#8B5CF6', '#06B6D4', '#EF4444', '#EAB308', '#EC4899']

function CapTree({ capabilities }: { capabilities: HydratedCapability[] }) {
  const tree = useMemo(() => {
    const byId = new Map(capabilities.map(c => [c.id, c]))
    const build = (parentId: string | null): HydratedCapability[] =>
      capabilities
        .filter(c => (c.parent_id || null) === parentId)
        .sort((a, b) => a.sort_order - b.sort_order)
    const l1s = build(null).filter(c => c.level === 1)
    return l1s.map(l1 => ({
      ...l1,
      l2s: build(l1.id).filter(c => c.level === 2).map(l2 => ({
        ...l2,
        l3s: build(l2.id).filter(c => c.level === 3),
      })),
    }))
  }, [capabilities])

  if (tree.length === 0) {
    // Flat: render all as SIPOC blocks
    return (
      <div className="space-y-3">
        {capabilities.sort((a, b) => a.sort_order - b.sort_order).map(c => (
          <ReadOnlySIPOC key={c.id} cap={c} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {tree.map((l1, i) => {
        const color = l1.color || L1_COLORS[i % L1_COLORS.length]
        return (
          <div key={l1.id}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: color }} />
              <h2 className="text-lg font-bold text-gray-800">{l1.name}</h2>
              <span className="text-[9px] font-mono text-gray-400 uppercase">L1 Core Area</span>
            </div>
            <div className="space-y-6 pl-5 border-l-2" style={{ borderColor: color + '30' }}>
              {l1.l2s.map(l2 => (
                <div key={l2.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color + '60' }} />
                    <h3 className="text-sm font-semibold text-gray-700">{l2.name}</h3>
                    <span className="text-[8px] font-mono text-gray-400 uppercase">L2</span>
                  </div>
                  <div className="space-y-2 pl-4">
                    {l2.l3s.map(l3 => (
                      <ReadOnlySIPOC key={l3.id} cap={l3} />
                    ))}
                    {l2.l3s.length === 0 && (
                      <div className="text-[11px] text-gray-400 italic py-2">No L3 functionalities</div>
                    )}
                  </div>
                </div>
              ))}
              {l1.l2s.length === 0 && (
                <div className="text-[11px] text-gray-400 italic py-2">No L2 capabilities</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────
export default function SharePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready'>('loading')
  const [data, setData] = useState<ShareData | null>(null)

  useEffect(() => {
    async function load() {
      const share = await getShareByCode(code)
      if (!share) { setStatus('invalid'); return }

      const map = await getCapabilityMapAnon(share.capability_map_id)
      if (!map) { setStatus('invalid'); return }

      const caps = await listCapabilitiesAnon(share.capability_map_id)

      const [inputResults, outputResults] = await Promise.all([
        Promise.all(caps.map(c => listCapabilityInputsAnon(c.id))),
        Promise.all(caps.map(c => listCapabilityOutputsAnon(c.id))),
      ])
      const inputs: Record<string, CapabilityInput[]> = {}
      const outputs: Record<string, CapabilityOutput[]> = {}
      caps.forEach((c, i) => { inputs[c.id] = inputResults[i]; outputs[c.id] = outputResults[i] })

      const [personas, informationProducts, logicalSystems, tags] = await Promise.all([
        listPersonasAnon(map.organization_id),
        listInformationProductsAnon(map.organization_id),
        listLogicalSystemsAnon(map.organization_id),
        listTagsAnon(map.organization_id),
      ])

      setData({ map, capabilities: caps, inputs, outputs, personas, informationProducts, logicalSystems, tags })
      setStatus('ready')
    }
    load()
  }, [code])

  const hydrated = useMemo(() => data ? hydrate(data) : [], [data])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading shared capability map...</div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Link expired or invalid</h1>
          <p className="text-gray-500 text-sm">This share link is no longer active. Ask the map owner to generate a new one.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <span className="text-gradient text-sm font-bold font-[family-name:var(--font-orbitron)] tracking-wide">MACH12</span>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-semibold text-gray-800 flex-1">{data!.map.title}</h1>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 2a2 2 0 00-2 2v1H2.5a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5H7V4a2 2 0 00-2-2zm0 .8A1.2 1.2 0 016.2 4v1H3.8V4A1.2 1.2 0 015 2.8z" fill="currentColor"/>
              </svg>
              Read-Only View
            </span>
            <VersionBadge />
          </div>
        </div>
        {data!.map.description && (
          <div className="max-w-7xl mx-auto mt-2">
            <p className="text-sm text-gray-500">{data!.map.description}</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <CapTree capabilities={hydrated} />
      </div>
    </div>
  )
}
