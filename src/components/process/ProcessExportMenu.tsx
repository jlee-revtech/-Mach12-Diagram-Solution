'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Download, FileCode, FileSpreadsheet, FileText, Presentation } from 'lucide-react'
import { Button } from '@/components/common'
import { useProcessStore } from '@/lib/process/store'
import { listProcessOverlays, listProcessInterfaces, listRicefw } from '@/lib/supabase/process-models'
import { generateProcessBpmn } from '@/lib/export/bpmn'
import { exportPlaybookXlsx, exportPlaybookPdf, exportPlaybookPptx, type ProcessPlaybook } from '@/lib/export/playbook'

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const sanitize = (s: string) => (s || 'process').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').substring(0, 80)

export default function ProcessExportMenu() {
  const model = useProcessStore(s => s.model)
  const nodes = useProcessStore(s => s.nodes)
  const logicalSystems = useProcessStore(s => s.logicalSystems)
  const selectedNode = useProcessStore(s => s.nodes.find(n => n.id === s.selectedNodeId))

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const playbookCache = useRef<ProcessPlaybook | null>(null)
  const playbookForNode = useRef<string | null>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const leaf = selectedNode?.is_leaf ? selectedNode : null
  const sysName = useCallback((id?: string | null) => (id ? logicalSystems.find(s => s.id === id)?.name ?? null : null), [logicalSystems])

  // Executive process map (model-level SVG)
  const handleExecMap = async () => {
    if (!model || busy) return
    setBusy('exec'); setOpen(false)
    try {
      const byParent = new Map<string | null, typeof nodes>()
      for (const n of nodes) { const k = n.parent_id ?? null; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k)!.push(n) }
      const kids = (id: string | null) => (byParent.get(id) || []).sort((a, b) => a.sort_order - b.sort_order)
      const scenarios = kids(null).filter(n => n.level === 1).map(s1 => ({
        name: s1.name,
        groups: kids(s1.id).map(g => ({ name: g.name, processes: kids(g.id).map(p => p.name) })),
      }))
      const res = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process-exec-map', prompt: '', context: { modelTitle: model.title, scenarios } }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Exec map failed') }
      const svg = await res.text()
      downloadBlob(svg, `${sanitize(model.title)}_ProcessMap.svg`, 'image/svg+xml')
    } catch (e) { alert(e instanceof Error ? e.message : 'Exec map failed') }
    finally { setBusy(null) }
  }

  // BPMN 2.0 (selected leaf)
  const handleBpmn = () => {
    if (!leaf || !model) return
    setOpen(false)
    const graph = leaf.graph_data || { lanes: [], nodes: [], edges: [] }
    const xml = generateProcessBpmn(leaf.name, model.id, graph)
    downloadBlob(xml, `${sanitize(leaf.name)}.bpmn`, 'application/xml')
  }

  // Playbook (selected leaf) - generate once, then export
  const getPlaybook = useCallback(async (): Promise<ProcessPlaybook | null> => {
    if (!leaf || !model) return null
    if (playbookCache.current && playbookForNode.current === leaf.id) return playbookCache.current
    const graph = leaf.graph_data || { lanes: [], nodes: [], edges: [] }
    const [overlays, interfaces, ricefw] = await Promise.all([
      listProcessOverlays(leaf.id),
      listProcessInterfaces(leaf.id),
      listRicefw(model.organization_id, leaf.id),
    ])
    const namesOf = (ids?: string[]) => (ids || []).map(id => sysName(id)).filter(Boolean) as string[]
    const res = await fetch('/api/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'process-playbook',
        context: {
          processName: leaf.name,
          modelTitle: model.title,
          description: leaf.description,
          scopeItemRef: leaf.scope_item_ref,
          lifecycle: leaf.lifecycle,
          variant: leaf.variant_label,
          lanes: (graph.lanes || []).map(l => ({ label: l.label, system: sysName(l.systemId) })),
          steps: (graph.nodes || []).map(n => {
            const d = n.data as Record<string, unknown>
            return {
              label: (d.label as string) || 'Step',
              elementType: (d.elementType as string) || 'task',
              lane: sysName((graph.lanes || []).find(l => l.id === (d.laneId as string))?.systemId) || null,
              responsibleRole: (d.responsibleRole as string) || null,
              raci: d.raci || null,
              systems: namesOf(d.systemIds as string[]),
              module: (d.module as string) || null,
              fioriApp: ((d.fioriTile as { title?: string } | undefined)?.title) || (d.fioriApp as string) || null,
              tcode: (d.tcode as string) || null,
              ricefwCodes: (d.ricefwCodes as string[]) || [],
            }
          }),
          interfaces: interfaces.map(i => ({ source: sysName(i.source_system_id), target: sysName(i.target_system_id), direction: i.direction, frequency: i.frequency, tech: i.integration_tech, ref: i.interface_ref })),
          ricefw: ricefw.map(r => ({ code: r.code, type: r.ricefw_type, title: r.title, status: r.status })),
          overlays: overlays.map(o => ({ kind: o.overlay_kind, title: o.payload.title, framework: o.payload.framework, code: o.payload.code, kpiTarget: o.payload.kpiTarget })),
        },
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.narrative) throw new Error(data.error || 'Playbook failed')
    playbookCache.current = data; playbookForNode.current = leaf.id
    return data
  }, [leaf, model, sysName])

  const handlePlaybook = async (fmt: 'xlsx' | 'pdf' | 'pptx') => {
    if (!leaf || busy) return
    setBusy('playbook'); setOpen(false)
    try {
      const pb = await getPlaybook()
      if (!pb) return
      if (fmt === 'xlsx') exportPlaybookXlsx(leaf.name, pb)
      else if (fmt === 'pdf') exportPlaybookPdf(leaf.name, pb)
      else exportPlaybookPptx(leaf.name, pb)
    } catch (e) { alert(e instanceof Error ? e.message : 'Playbook failed') }
    finally { setBusy(null) }
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        icon={<Download size={12} />}
        loading={!!busy}
        onClick={() => setOpen(o => !o)}
      >
        {busy ? 'Exporting...' : 'Export'}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white rounded-lg shadow-dropdown border border-border py-1 animate-slide-in-up">
          <MenuLabel>Model</MenuLabel>
          <MenuItem icon={<Presentation size={14} />} onClick={handleExecMap} desc="AI value-chain slide (SVG)">Executive Process Map</MenuItem>

          <MenuLabel>{leaf ? `Leaf: ${leaf.name}` : 'Leaf process (select one)'}</MenuLabel>
          <MenuItem icon={<FileCode size={14} />} onClick={handleBpmn} disabled={!leaf}>BPMN 2.0 (.bpmn)</MenuItem>
          <MenuItem icon={<FileSpreadsheet size={14} />} onClick={() => handlePlaybook('xlsx')} disabled={!leaf} desc="AI playbook">Playbook - Excel</MenuItem>
          <MenuItem icon={<FileText size={14} />} onClick={() => handlePlaybook('pdf')} disabled={!leaf} desc="AI playbook">Playbook - PDF</MenuItem>
          <MenuItem icon={<Presentation size={14} />} onClick={() => handlePlaybook('pptx')} disabled={!leaf} desc="AI playbook">Playbook - PowerPoint</MenuItem>
        </div>
      )}
    </div>
  )
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-text-tertiary truncate">{children}</div>
}
function MenuItem({ children, desc, icon, onClick, disabled }: { children: React.ReactNode; desc?: string; icon?: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="w-full flex items-start gap-2 text-left px-3 py-1.5 hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
      {icon && <span className="inline-flex shrink-0 text-text-tertiary mt-0.5">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-body-sm text-text-primary">{children}</span>
        {desc && <span className="block text-[10px] text-text-tertiary">{desc}</span>}
      </span>
    </button>
  )
}
