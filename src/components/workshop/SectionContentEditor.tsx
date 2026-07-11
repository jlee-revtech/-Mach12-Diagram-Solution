'use client'

// Direct manual editor for a section's facilitation content. It edits the SAME
// typed SectionContent that the AI generates and that the deck (walkthrough +
// PPTX) is derived from, so a hand-edit here shows up everywhere without drift.
// Fully controlled: it takes `value` + `onChange` and never persists itself; the
// host (prep SectionEditor / Workshop Experience present drawer) owns save.
//
// Every field is editable: prose (headline, notes, recommendations), bullet
// lists (talking points, considerations, pros/cons, rationale...), the structured
// sub-objects (future-state options, key decisions, divergences), and the typed
// diagrams (flow / matrix / quadrant / layers) with a live preview.

import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react'
import type {
  SectionContent, OverviewSectionContent, WorkstreamSectionContent,
  EvaluationSectionContent, FutureStateOption, KeyDecision, EvaluationDivergence,
  WorkshopDiagram, WorkshopDiagramType,
} from '@jlee-revtech/agent-core'
import { DiagramCard } from './DiagramView'
import { readSynthesis, type CriterionPriority } from '@/lib/workshop/decisionCriteria'

// Host-supplied AI generator: turns a prompt (plus the current diagram + context)
// into a fresh WorkshopDiagram. The host owns the fetch + auth (it has workshopId
// / orgId); this component stays presentational. Absent -> no AI box is shown.
export type GenerateDiagramFn = (opts: {
  prompt: string
  current?: WorkshopDiagram
  context?: string
  preferType?: WorkshopDiagramType
}) => Promise<WorkshopDiagram | null>

// Host-supplied AI generator for TEXT fragments: bullets (summary / current state /
// considerations / rationale / pros / cons), a future-state option, a full key
// decision, an overview (headline + talking points), or an evaluation summary.
// Overloaded so each call site gets the right return type. Absent -> no AI text
// boxes are shown.
export type EvalFragment = { overallRecommendation?: string; pros?: string[]; cons?: string[]; tradeoffs?: string[]; rationale?: string[] }
export type OverviewFragment = { headline?: string; talkingPoints: string[] }
export interface GenerateContentFn {
  (opts: { target: 'bullets'; prompt: string; context?: string }): Promise<string[] | null>
  (opts: { target: 'option'; prompt: string; context?: string }): Promise<FutureStateOption | null>
  (opts: { target: 'decision'; prompt: string; context?: string }): Promise<KeyDecision | null>
  (opts: { target: 'overview'; prompt: string; context?: string }): Promise<OverviewFragment | null>
  (opts: { target: 'evaluation'; prompt: string; context?: string }): Promise<EvalFragment | null>
}

// ─── Immutable array helpers ─────────────────────────────────────────────────
function replaceAt<T>(arr: T[], i: number, v: T): T[] { const c = arr.slice(); c[i] = v; return c }
function removeAt<T>(arr: T[], i: number): T[] { const c = arr.slice(); c.splice(i, 1); return c }
function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const c = arr.slice()
  const a = c[i] as T, b = c[j] as T
  c[i] = b; c[j] = a
  return c
}

// ─── Shared class strings (canonical Tesseract tokens) ───────────────────────
const INPUT = 'w-full bg-surface-input border border-border rounded px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500'
const LABEL = 'text-[10px] uppercase tracking-wide text-text-secondary mb-1'
const GHOST_BTN = 'text-[10px] px-1.5 py-0.5 rounded border border-border text-text-tertiary hover:text-text-primary hover:border-border-strong transition-colors'
const ADD_BTN = 'text-[10px] px-2 py-1 rounded border border-brand-200 text-brand-600 hover:bg-brand-50 transition-colors'
const CARD = 'bg-white border border-border rounded-lg p-3'

// ─── Field primitives ────────────────────────────────────────────────────────
function Field({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <div className={LABEL}>{label}</div>}
      {children}
    </div>
  )
}

function TextField({ label, value, onChange, placeholder }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <Field label={label}>
      <input className={INPUT} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function TextAreaField({ label, value, onChange, placeholder, rows = 2 }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <Field label={label}>
      <textarea className={`${INPUT} resize-none leading-snug`} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

// Reorder + remove controls for a list row.
function RowControls({ i, len, onMove, onRemove }: {
  i: number; len: number; onMove: (dir: -1 | 1) => void; onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button type="button" title="Move up" aria-label="Move up" disabled={i === 0} onClick={() => onMove(-1)} className={`${GHOST_BTN} disabled:opacity-30`}><ChevronUp size={10} /></button>
      <button type="button" title="Move down" aria-label="Move down" disabled={i === len - 1} onClick={() => onMove(1)} className={`${GHOST_BTN} disabled:opacity-30`}><ChevronDown size={10} /></button>
      <button type="button" title="Remove" aria-label="Remove" onClick={onRemove} className="text-[10px] px-1.5 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"><X size={10} /></button>
    </div>
  )
}

// Editor for a string[] (bullets, pros, cons, steps of text, etc.).
function StringListEditor({ label, items, onChange, placeholder, addLabel = 'Add', color }: {
  label?: string; items: string[]; onChange: (next: string[]) => void
  placeholder?: string; addLabel?: string; color?: string
}) {
  const list = items ?? []
  return (
    <Field label={label}>
      <div className="space-y-1.5">
        {list.map((t, i) => (
          <div key={i} className="flex items-start gap-1.5">
            {color && <span className="text-[11px] mt-1 shrink-0" style={{ color }}>•</span>}
            <input className={INPUT} value={t} placeholder={placeholder} onChange={(e) => onChange(replaceAt(list, i, e.target.value))} />
            <RowControls i={i} len={list.length} onMove={(d) => onChange(move(list, i, d))} onRemove={() => onChange(removeAt(list, i))} />
          </div>
        ))}
        <button type="button" className={ADD_BTN} onClick={() => onChange([...list, ''])}>+ {addLabel}</button>
      </div>
    </Field>
  )
}

// A compact AI prompt bar for generating text content. The caller's onRun applies
// the generated fragment (append bullets, add an option/decision, fill a summary).
function AiContentBar({ label, placeholder, onRun }: {
  label: string; placeholder: string; onRun: (prompt: string) => Promise<void>
}) {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const run = async () => {
    const p = prompt.trim()
    if (!p) return
    setBusy(true)
    setErr(null)
    try { await onRun(p); setPrompt('') }
    catch (e) { setErr(e instanceof Error ? e.message : 'Generation failed') }
    finally { setBusy(false) }
  }
  return (
    <div className="rounded-lg border border-[#7C3AED]/30 bg-[#7C3AED]/5 p-2 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wide text-[#7C3AED]">{label}</div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run() }}
        rows={2}
        placeholder={placeholder}
        className={`${INPUT} resize-none`}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={run} disabled={busy || !prompt.trim()}
          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded font-medium text-white bg-[#7C3AED] hover:bg-[#8B5CF6] disabled:opacity-40 transition-colors">
          <Sparkles size={10} />{busy ? 'Generating...' : 'Generate'}
        </button>
        <span className="text-[10px] text-text-tertiary">Cmd/Ctrl+Enter.</span>
      </div>
      {err && <div className="text-[10px] text-red-600">{err}</div>}
    </div>
  )
}

// ─── Diagram editors ─────────────────────────────────────────────────────────
const DIAGRAM_TYPES: { value: WorkshopDiagramType; label: string }[] = [
  { value: 'flow', label: 'Flow' },
  { value: 'matrix', label: 'Matrix' },
  { value: 'quadrant', label: 'Quadrant' },
  { value: 'layers', label: 'Layers' },
]

// A sensible empty scaffold when switching type or adding a diagram, so the
// preview and the per-type editor have something to show immediately.
function scaffoldForType(type: WorkshopDiagramType, prev: WorkshopDiagram): WorkshopDiagram {
  const base: WorkshopDiagram = { type, ...(prev.title ? { title: prev.title } : {}), ...(prev.caption ? { caption: prev.caption } : {}) }
  if (type === 'flow') return { ...base, steps: prev.steps?.length ? prev.steps : [{ label: '' }, { label: '' }] }
  if (type === 'matrix') return { ...base, columns: prev.columns?.length ? prev.columns : ['Option A', 'Option B'], rows: prev.rows?.length ? prev.rows : [{ label: 'Criterion', cells: ['', ''] }] }
  if (type === 'quadrant') return { ...base, xAxis: prev.xAxis ?? { low: 'Low', high: 'High' }, yAxis: prev.yAxis ?? { low: 'Low', high: 'High' }, points: prev.points?.length ? prev.points : [{ label: '', x: 0.5, y: 0.5 }] }
  return { ...base, layers: prev.layers?.length ? prev.layers : [{ label: 'Layer', nodes: [''] }], ...(prev.connections?.length ? { connections: prev.connections } : {}) }
}

function FlowEditor({ d, onChange }: { d: WorkshopDiagram; onChange: (d: WorkshopDiagram) => void }) {
  const steps = d.steps ?? []
  return (
    <Field label="Steps">
      <div className="space-y-1.5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <div className="flex-1 space-y-1">
              <input className={INPUT} value={s.label} placeholder="Step label" onChange={(e) => onChange({ ...d, steps: replaceAt(steps, i, { ...s, label: e.target.value }) })} />
              <input className={INPUT} value={s.sublabel ?? ''} placeholder="Sublabel (optional)" onChange={(e) => onChange({ ...d, steps: replaceAt(steps, i, { ...s, sublabel: e.target.value || undefined }) })} />
            </div>
            <RowControls i={i} len={steps.length} onMove={(dir) => onChange({ ...d, steps: move(steps, i, dir) })} onRemove={() => onChange({ ...d, steps: removeAt(steps, i) })} />
          </div>
        ))}
        <button type="button" className={ADD_BTN} onClick={() => onChange({ ...d, steps: [...steps, { label: '' }] })}>+ Step</button>
      </div>
    </Field>
  )
}

function MatrixEditor({ d, onChange }: { d: WorkshopDiagram; onChange: (d: WorkshopDiagram) => void }) {
  const columns = d.columns ?? []
  const rows = d.rows ?? []
  // Keep every row's cells aligned to the column count.
  const fit = (cells: string[]) => Array.from({ length: columns.length }, (_, k) => cells[k] ?? '')

  const setColumns = (cols: string[]) =>
    onChange({ ...d, columns: cols, rows: rows.map((r) => ({ ...r, cells: Array.from({ length: cols.length }, (_, k) => r.cells[k] ?? '') })) })

  return (
    <div className="space-y-2">
      <StringListEditor label="Columns" items={columns} onChange={setColumns} placeholder="Column header" addLabel="Column" />
      <Field label="Rows">
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="border border-border rounded p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input className={INPUT} value={r.label} placeholder="Row label" onChange={(e) => onChange({ ...d, rows: replaceAt(rows, i, { ...r, label: e.target.value }) })} />
                <RowControls i={i} len={rows.length} onMove={(dir) => onChange({ ...d, rows: move(rows, i, dir) })} onRemove={() => onChange({ ...d, rows: removeAt(rows, i) })} />
              </div>
              {columns.length > 0 && (
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 3)}, minmax(0,1fr))` }}>
                  {fit(r.cells).map((cell, ci) => (
                    <input key={ci} className={INPUT} value={cell} placeholder={columns[ci] || `Cell ${ci + 1}`}
                      onChange={(e) => onChange({ ...d, rows: replaceAt(rows, i, { ...r, cells: replaceAt(fit(r.cells), ci, e.target.value) }) })} />
                  ))}
                </div>
              )}
            </div>
          ))}
          <button type="button" className={ADD_BTN} onClick={() => onChange({ ...d, rows: [...rows, { label: '', cells: Array.from({ length: columns.length }, () => '') }] })}>+ Row</button>
        </div>
      </Field>
    </div>
  )
}

function AxisEditor({ label, axis, onChange }: { label: string; axis?: { low: string; high: string }; onChange: (a: { low: string; high: string }) => void }) {
  const a = axis ?? { low: '', high: '' }
  return (
    <Field label={label}>
      <div className="grid grid-cols-2 gap-1.5">
        <input className={INPUT} value={a.low} placeholder="Low" onChange={(e) => onChange({ ...a, low: e.target.value })} />
        <input className={INPUT} value={a.high} placeholder="High" onChange={(e) => onChange({ ...a, high: e.target.value })} />
      </div>
    </Field>
  )
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)) }

function QuadrantEditor({ d, onChange }: { d: WorkshopDiagram; onChange: (d: WorkshopDiagram) => void }) {
  const points = d.points ?? []
  return (
    <div className="space-y-2">
      <AxisEditor label="X axis (horizontal)" axis={d.xAxis} onChange={(xAxis) => onChange({ ...d, xAxis })} />
      <AxisEditor label="Y axis (vertical)" axis={d.yAxis} onChange={(yAxis) => onChange({ ...d, yAxis })} />
      <Field label="Points (position 0 to 1)">
        <div className="space-y-1.5">
          {points.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input className={`${INPUT} flex-1`} value={p.label} placeholder="Point label" onChange={(e) => onChange({ ...d, points: replaceAt(points, i, { ...p, label: e.target.value }) })} />
              <input className={`${INPUT} w-16`} type="number" step={0.05} min={0} max={1} value={p.x} title="x (0=left, 1=right)" onChange={(e) => onChange({ ...d, points: replaceAt(points, i, { ...p, x: clamp01(Number(e.target.value)) }) })} />
              <input className={`${INPUT} w-16`} type="number" step={0.05} min={0} max={1} value={p.y} title="y (0=bottom, 1=top)" onChange={(e) => onChange({ ...d, points: replaceAt(points, i, { ...p, y: clamp01(Number(e.target.value)) }) })} />
              <RowControls i={i} len={points.length} onMove={(dir) => onChange({ ...d, points: move(points, i, dir) })} onRemove={() => onChange({ ...d, points: removeAt(points, i) })} />
            </div>
          ))}
          <button type="button" className={ADD_BTN} onClick={() => onChange({ ...d, points: [...points, { label: '', x: 0.5, y: 0.5 }] })}>+ Point</button>
        </div>
      </Field>
    </div>
  )
}

function LayersEditor({ d, onChange }: { d: WorkshopDiagram; onChange: (d: WorkshopDiagram) => void }) {
  const layers = d.layers ?? []
  const connections = d.connections ?? []
  return (
    <div className="space-y-2">
      <Field label="Layers (bands)">
        <div className="space-y-2">
          {layers.map((ly, i) => (
            <div key={i} className="border border-border rounded p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input className={INPUT} value={ly.label} placeholder="Layer label" onChange={(e) => onChange({ ...d, layers: replaceAt(layers, i, { ...ly, label: e.target.value }) })} />
                <RowControls i={i} len={layers.length} onMove={(dir) => onChange({ ...d, layers: move(layers, i, dir) })} onRemove={() => onChange({ ...d, layers: removeAt(layers, i) })} />
              </div>
              <StringListEditor label="Nodes" items={ly.nodes ?? []} placeholder="Node label" addLabel="Node"
                onChange={(nodes) => onChange({ ...d, layers: replaceAt(layers, i, { ...ly, nodes }) })} />
            </div>
          ))}
          <button type="button" className={ADD_BTN} onClick={() => onChange({ ...d, layers: [...layers, { label: '', nodes: [''] }] })}>+ Layer</button>
        </div>
      </Field>
      <Field label="Connections (by node label, optional)">
        <div className="space-y-1.5">
          {connections.map((cn, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input className={`${INPUT} flex-1`} value={cn.from} placeholder="From node" onChange={(e) => onChange({ ...d, connections: replaceAt(connections, i, { ...cn, from: e.target.value }) })} />
              <span className="text-[10px] text-text-tertiary">→</span>
              <input className={`${INPUT} flex-1`} value={cn.to} placeholder="To node" onChange={(e) => onChange({ ...d, connections: replaceAt(connections, i, { ...cn, to: e.target.value }) })} />
              <input className={`${INPUT} flex-1`} value={cn.label ?? ''} placeholder="Label" onChange={(e) => onChange({ ...d, connections: replaceAt(connections, i, { ...cn, label: e.target.value || undefined }) })} />
              <RowControls i={i} len={connections.length} onMove={(dir) => onChange({ ...d, connections: move(connections, i, dir) })} onRemove={() => onChange({ ...d, connections: removeAt(connections, i) })} />
            </div>
          ))}
          <button type="button" className={ADD_BTN} onClick={() => onChange({ ...d, connections: [...connections, { from: '', to: '' }] })}>+ Connection</button>
        </div>
      </Field>
    </div>
  )
}

// AI prompt box: describe the visual you want and the engine returns a typed
// diagram, replacing the one below. Keeps the current type as a hint and passes
// the current diagram so a prompt can also revise. Only rendered when the host
// wired a generator.
function DiagramPromptBar({ diagram, gen, onChange, context }: {
  diagram: WorkshopDiagram; gen: GenerateDiagramFn; onChange: (d: WorkshopDiagram) => void; context?: string
}) {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const hasContent = !!(diagram.steps?.length || diagram.rows?.length || diagram.points?.length || diagram.layers?.length)
  const run = async () => {
    const p = prompt.trim()
    if (!p) return
    setBusy(true)
    setErr(null)
    try {
      const d = await gen({ prompt: p, current: diagram, preferType: diagram.type, ...(context ? { context } : {}) })
      if (!d) { setErr('No diagram came back. Try rephrasing the prompt.'); return }
      onChange(d)
      setPrompt('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rounded-lg border border-[#7C3AED]/30 bg-[#7C3AED]/5 p-2 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wide text-[#7C3AED]">Generate with AI</div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run() }}
        rows={2}
        placeholder={hasContent
          ? 'Describe a change or a new visual. e.g. Turn this into a quadrant of cost vs risk.'
          : 'Describe the visual. e.g. A flow of the 3-way match: PO, goods receipt, invoice, payment.'}
        className={`${INPUT} resize-none`}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={run} disabled={busy || !prompt.trim()}
          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded font-medium text-white bg-[#7C3AED] hover:bg-[#8B5CF6] disabled:opacity-40 transition-colors">
          <Sparkles size={10} />{busy ? 'Generating...' : hasContent ? 'Generate / revise' : 'Generate diagram'}
        </button>
        <span className="text-[10px] text-text-tertiary">Replaces the diagram below; you can then fine-tune it by hand. Cmd/Ctrl+Enter.</span>
      </div>
      {err && <div className="text-[10px] text-red-600">{err}</div>}
    </div>
  )
}

const DIAGRAM_SELECT = 'bg-surface-input border border-border rounded px-1.5 py-0.5 text-[11px] text-text-primary focus:outline-none focus:border-brand-500'

// One diagram: an optional AI prompt box, then type + title + caption +
// type-specific body + a live preview.
function DiagramEditor({ diagram, onChange, onRemove, gen, context }: {
  diagram: WorkshopDiagram; onChange: (d: WorkshopDiagram) => void; onRemove: () => void
  gen?: GenerateDiagramFn; context?: string
}) {
  return (
    <div className="border border-brand-200 bg-brand-50/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-brand-600">Diagram</span>
        <select aria-label="Diagram type" title="Diagram type" className={DIAGRAM_SELECT}
          value={diagram.type} onChange={(e) => onChange(scaffoldForType(e.target.value as WorkshopDiagramType, diagram))}>
          {DIAGRAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button type="button" onClick={onRemove} className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors">Remove diagram</button>
      </div>
      {gen && <DiagramPromptBar diagram={diagram} gen={gen} onChange={onChange} context={context} />}
      <TextField label="Title" value={diagram.title ?? ''} placeholder="Diagram title" onChange={(v) => onChange({ ...diagram, title: v || undefined })} />
      <TextField label="Caption" value={diagram.caption ?? ''} placeholder="One line explaining the diagram" onChange={(v) => onChange({ ...diagram, caption: v || undefined })} />
      {diagram.type === 'flow' && <FlowEditor d={diagram} onChange={onChange} />}
      {diagram.type === 'matrix' && <MatrixEditor d={diagram} onChange={onChange} />}
      {diagram.type === 'quadrant' && <QuadrantEditor d={diagram} onChange={onChange} />}
      {diagram.type === 'layers' && <LayersEditor d={diagram} onChange={onChange} />}
      <div>
        <div className={LABEL}>Preview</div>
        <DiagramCard diagram={diagram} width={520} />
      </div>
    </div>
  )
}

// A single diagram slot (used where the model requires exactly one, e.g. a key
// decision's visual). Always present; cannot be removed, only retyped/edited.
function SingleDiagramEditor({ diagram, onChange, gen, context }: {
  diagram: WorkshopDiagram; onChange: (d: WorkshopDiagram) => void; gen?: GenerateDiagramFn; context?: string
}) {
  return (
    <div className="border border-brand-200 bg-brand-50/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-brand-600">Decision visual</span>
        <select aria-label="Diagram type" title="Diagram type" className={DIAGRAM_SELECT}
          value={diagram.type} onChange={(e) => onChange(scaffoldForType(e.target.value as WorkshopDiagramType, diagram))}>
          {DIAGRAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      {gen && <DiagramPromptBar diagram={diagram} gen={gen} onChange={onChange} context={context} />}
      <TextField label="Title" value={diagram.title ?? ''} placeholder="Diagram title" onChange={(v) => onChange({ ...diagram, title: v || undefined })} />
      <TextField label="Caption" value={diagram.caption ?? ''} placeholder="One line explaining the diagram" onChange={(v) => onChange({ ...diagram, caption: v || undefined })} />
      {diagram.type === 'flow' && <FlowEditor d={diagram} onChange={onChange} />}
      {diagram.type === 'matrix' && <MatrixEditor d={diagram} onChange={onChange} />}
      {diagram.type === 'quadrant' && <QuadrantEditor d={diagram} onChange={onChange} />}
      {diagram.type === 'layers' && <LayersEditor d={diagram} onChange={onChange} />}
      <div>
        <div className={LABEL}>Preview</div>
        <DiagramCard diagram={diagram} width={520} />
      </div>
    </div>
  )
}

// Editor for an optional list of section-level diagrams.
function DiagramListEditor({ diagrams, onChange, gen, context }: {
  diagrams?: WorkshopDiagram[]; onChange: (d: WorkshopDiagram[]) => void; gen?: GenerateDiagramFn; context?: string
}) {
  const list = diagrams ?? []
  return (
    <Field label="Diagrams">
      <div className="space-y-2">
        {list.map((d, i) => (
          <DiagramEditor key={i} diagram={d} gen={gen} context={context} onChange={(nd) => onChange(replaceAt(list, i, nd))} onRemove={() => onChange(removeAt(list, i))} />
        ))}
        <button type="button" className={ADD_BTN} onClick={() => onChange([...list, scaffoldForType('flow', { type: 'flow' })])}>+ Diagram</button>
      </div>
    </Field>
  )
}

// ─── Sub-object editors ──────────────────────────────────────────────────────
function OptionEditor({ o, onChange, onRemove, i, len, onMove }: {
  o: FutureStateOption; onChange: (o: FutureStateOption) => void; onRemove: () => void
  i: number; len: number; onMove: (dir: -1 | 1) => void
}) {
  return (
    <div className={`${CARD} space-y-2`}>
      <div className="flex items-center gap-1.5">
        <input className={INPUT} value={o.label} placeholder="Option label" onChange={(e) => onChange({ ...o, label: e.target.value })} />
        <RowControls i={i} len={len} onMove={onMove} onRemove={onRemove} />
      </div>
      <TextAreaField label="Summary" value={o.summary ?? ''} placeholder="One short sentence" onChange={(v) => onChange({ ...o, summary: v || undefined })} />
      <div className="grid grid-cols-2 gap-2">
        <StringListEditor label="Pros" color="#059669" items={o.pros ?? []} placeholder="Pro" addLabel="Pro" onChange={(pros) => onChange({ ...o, pros })} />
        <StringListEditor label="Cons" color="#DC2626" items={o.cons ?? []} placeholder="Con" addLabel="Con" onChange={(cons) => onChange({ ...o, cons })} />
      </div>
    </div>
  )
}

function DecisionEditor({ d, onChange, onRemove, i, len, onMove, gen }: {
  d: KeyDecision; onChange: (d: KeyDecision) => void; onRemove: () => void
  i: number; len: number; onMove: (dir: -1 | 1) => void; gen?: GenerateDiagramFn
}) {
  const rec = d.recommendedDecision ?? { recommendation: '', rationale: [] }
  const diagramContext = [d.title ? `Decision: ${d.title}` : '', rec.recommendation ? `Recommendation: ${rec.recommendation}` : '']
    .filter(Boolean)
    .join('. ')
  return (
    <div className={`${CARD} space-y-2.5`}>
      <div className="flex items-start gap-1.5">
        <input className={`${INPUT} font-medium`} value={d.title} placeholder="Decision title" onChange={(e) => onChange({ ...d, title: e.target.value })} />
        <RowControls i={i} len={len} onMove={onMove} onRemove={onRemove} />
      </div>
      <StringListEditor label="Context" color="#2563EB" items={d.context ?? []} placeholder="Why this matters" addLabel="Context point" onChange={(context) => onChange({ ...d, context })} />
      <StringListEditor label="Leading questions" color="#D97706" items={d.leadingQuestions ?? []} placeholder="Question to walk the room" addLabel="Question" onChange={(leadingQuestions) => onChange({ ...d, leadingQuestions })} />
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-2.5 space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-brand-600">Recommended decision</div>
        <TextAreaField value={rec.recommendation} placeholder="One short sentence" onChange={(v) => onChange({ ...d, recommendedDecision: { ...rec, recommendation: v } })} />
        <StringListEditor label="Rationale" color="#3B82F6" items={rec.rationale ?? []} placeholder="Reasoning point" addLabel="Rationale point" onChange={(rationale) => onChange({ ...d, recommendedDecision: { ...rec, rationale } })} />
        <Field label="Confidence">
          <select aria-label="Confidence" title="Confidence" className={DIAGRAM_SELECT}
            value={rec.confidence ?? ''} onChange={(e) => onChange({ ...d, recommendedDecision: { ...rec, confidence: (e.target.value || undefined) as KeyDecision['recommendedDecision']['confidence'] } })}>
            <option value="">Unset</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>
      </div>
      <SingleDiagramEditor diagram={d.diagram ?? scaffoldForType('flow', { type: 'flow' })} gen={gen} context={diagramContext} onChange={(diagram) => onChange({ ...d, diagram })} />
    </div>
  )
}

function DivergenceEditor({ dv, onChange, onRemove, i, len, onMove }: {
  dv: EvaluationDivergence; onChange: (dv: EvaluationDivergence) => void; onRemove: () => void
  i: number; len: number; onMove: (dir: -1 | 1) => void
}) {
  const positions = dv.positions ?? []
  return (
    <div className={`${CARD} space-y-2`}>
      <div className="flex items-center gap-1.5">
        <input className={INPUT} value={dv.topic} placeholder="Divergence topic" onChange={(e) => onChange({ ...dv, topic: e.target.value })} />
        <RowControls i={i} len={len} onMove={onMove} onRemove={onRemove} />
      </div>
      <Field label="Positions">
        <div className="space-y-1.5">
          {positions.map((p, pi) => (
            <div key={pi} className="flex items-center gap-1.5">
              <input className={`${INPUT} w-28`} value={p.workstreamCode} placeholder="Workstream" onChange={(e) => onChange({ ...dv, positions: replaceAt(positions, pi, { ...p, workstreamCode: e.target.value }) })} />
              <input className={`${INPUT} flex-1`} value={p.stance} placeholder="Stance" onChange={(e) => onChange({ ...dv, positions: replaceAt(positions, pi, { ...p, stance: e.target.value }) })} />
              <RowControls i={pi} len={positions.length} onMove={(dir) => onChange({ ...dv, positions: move(positions, pi, dir) })} onRemove={() => onChange({ ...dv, positions: removeAt(positions, pi) })} />
            </div>
          ))}
          <button type="button" className={ADD_BTN} onClick={() => onChange({ ...dv, positions: [...positions, { workstreamCode: '', stance: '' }] })}>+ Position</button>
        </div>
      </Field>
      <TextAreaField label="Tension" value={dv.tension} placeholder="The architectural tension this creates" onChange={(v) => onChange({ ...dv, tension: v })} />
    </div>
  )
}

// ─── Per-kind editors ────────────────────────────────────────────────────────
function OverviewEditor({ c, onChange, gen, genContent }: { c: OverviewSectionContent; onChange: (c: OverviewSectionContent) => void; gen?: GenerateDiagramFn; genContent?: GenerateContentFn }) {
  return (
    <div className="space-y-3">
      {genContent && (
        <AiContentBar
          label="Generate overview with AI"
          placeholder="e.g. Summarize the make-vs-buy framing for a new A&D contract; keep it executive-level."
          onRun={async (p) => {
            const f = await genContent({ target: 'overview', prompt: p, ...(c.headline ? { context: c.headline } : {}) })
            if (f) onChange({ ...c, ...(f.headline && !c.headline ? { headline: f.headline } : {}), talkingPoints: [...(c.talkingPoints ?? []), ...(f.talkingPoints ?? [])] })
          }}
        />
      )}
      <TextField label="Headline" value={c.headline} placeholder="Section headline" onChange={(v) => onChange({ ...c, headline: v })} />
      <StringListEditor label="Talking points" color="#0891B2" items={c.talkingPoints ?? []} placeholder="Talking point" addLabel="Talking point" onChange={(talkingPoints) => onChange({ ...c, talkingPoints })} />
      <TextAreaField label="Facilitator notes" rows={3} value={c.facilitatorNotes ?? ''} placeholder="Private note on how to run this section" onChange={(v) => onChange({ ...c, facilitatorNotes: v || undefined })} />
      <DiagramListEditor diagrams={c.diagrams} gen={gen} context={c.headline || undefined} onChange={(diagrams) => onChange({ ...c, diagrams: diagrams.length ? diagrams : undefined })} />
    </div>
  )
}

function WorkstreamEditor({ c, onChange, gen, genContent }: { c: WorkstreamSectionContent; onChange: (c: WorkstreamSectionContent) => void; gen?: GenerateDiagramFn; genContent?: GenerateContentFn }) {
  const options = c.futureStateOptions ?? []
  const decisions = c.keyDecisions ?? []
  const wsContext = c.workstreamName || c.workstreamCode || undefined
  const withWs = (s: string) => (wsContext ? `${wsContext}: ${s}` : s)
  return (
    <div className="space-y-3">
      <TextField label="Workstream name" value={c.workstreamName ?? ''} placeholder="Value stream name" onChange={(v) => onChange({ ...c, workstreamName: v || undefined })} />
      <StringListEditor label="Overall considerations" color="#2563EB" items={c.overallConsiderations ?? []} placeholder="Consideration" addLabel="Consideration" onChange={(overallConsiderations) => onChange({ ...c, overallConsiderations })} />
      {genContent && (
        <AiContentBar label="Generate considerations with AI" placeholder="e.g. Why co-mingling contracts matters for DCAA audit readiness."
          onRun={async (p) => { const b = await genContent({ target: 'bullets', prompt: p, context: withWs('overall considerations, the stakes') }); if (b?.length) onChange({ ...c, overallConsiderations: [...(c.overallConsiderations ?? []), ...b] }) }} />
      )}
      <StringListEditor label="Current state" color="#0891B2" items={c.currentState ?? []} placeholder="As-is point" addLabel="Current-state point" onChange={(currentState) => onChange({ ...c, currentState })} />
      {genContent && (
        <AiContentBar label="Generate current state with AI" placeholder="e.g. Describe the as-is contract accounting setup and its gaps."
          onRun={async (p) => { const b = await genContent({ target: 'bullets', prompt: p, context: withWs('current state, the as-is relevant to the decision') }); if (b?.length) onChange({ ...c, currentState: [...(c.currentState ?? []), ...b] }) }} />
      )}

      <Field label="Future-state options">
        <div className="space-y-2">
          {options.map((o, i) => (
            <OptionEditor key={i} o={o} i={i} len={options.length}
              onChange={(no) => onChange({ ...c, futureStateOptions: replaceAt(options, i, no) })}
              onMove={(dir) => onChange({ ...c, futureStateOptions: move(options, i, dir) })}
              onRemove={() => onChange({ ...c, futureStateOptions: removeAt(options, i) })} />
          ))}
          <button type="button" className={ADD_BTN} onClick={() => onChange({ ...c, futureStateOptions: [...options, { label: '', pros: [], cons: [] }] })}>+ Option</button>
          {genContent && (
            <AiContentBar label="Generate an option with AI (name the pros/cons to call out)" placeholder="e.g. Option: single co-mingled cost center. Call out pros: simpler setup; cons: harder DCAA segregation."
              onRun={async (p) => { const o = await genContent({ target: 'option', prompt: p, context: withWs('a future-state option with pros and cons') }); if (o) onChange({ ...c, futureStateOptions: [...options, { label: o.label ?? '', ...(o.summary ? { summary: o.summary } : {}), pros: o.pros ?? [], cons: o.cons ?? [] }] }) }} />
          )}
        </div>
      </Field>

      <Field label="Key decisions">
        <div className="space-y-2">
          {decisions.map((d, i) => (
            <DecisionEditor key={d.id || i} d={d} i={i} len={decisions.length} gen={gen}
              onChange={(nd) => onChange({ ...c, keyDecisions: replaceAt(decisions, i, nd) })}
              onMove={(dir) => onChange({ ...c, keyDecisions: move(decisions, i, dir) })}
              onRemove={() => onChange({ ...c, keyDecisions: removeAt(decisions, i) })} />
          ))}
          <button type="button" className={ADD_BTN}
            onClick={() => onChange({ ...c, keyDecisions: [...decisions, { id: `decision-${decisions.length + 1}`, title: '', context: [], leadingQuestions: [], recommendedDecision: { recommendation: '', rationale: [] }, diagram: scaffoldForType('flow', { type: 'flow' }) }] })}>+ Decision</button>
          {genContent && (
            <AiContentBar label="Generate a decision with AI (describe it and the pros/cons to call out)" placeholder="e.g. Decision on co-mingle vs separate cost centers. Call out pros of separation: clean DCAA segregation, audit clarity. Cons: setup overhead, more master data."
              onRun={async (p) => {
                const d = await genContent({ target: 'decision', prompt: p, context: withWs('a key decision framed around the topic') })
                if (!d) return
                const id = d.id && !decisions.some((x) => x.id === d.id) ? d.id : `decision-${decisions.length + 1}`
                onChange({ ...c, keyDecisions: [...decisions, { ...d, id, diagram: d.diagram ?? scaffoldForType('flow', { type: 'flow' }) }] })
              }} />
          )}
        </div>
      </Field>

      <DiagramListEditor diagrams={c.diagrams} gen={gen} context={wsContext} onChange={(diagrams) => onChange({ ...c, diagrams: diagrams.length ? diagrams : undefined })} />
    </div>
  )
}

function EvaluationEditor({ c, onChange, gen, genContent }: { c: EvaluationSectionContent; onChange: (c: EvaluationSectionContent) => void; gen?: GenerateDiagramFn; genContent?: GenerateContentFn }) {
  const divergences = c.divergences ?? []
  return (
    <div className="space-y-3">
      {genContent && (
        <AiContentBar
          label="Generate recommendation + pros/cons with AI"
          placeholder="e.g. Recommend separate cost centers across the workstreams. Call out pros: audit clarity, DCAA segregation; cons: setup overhead."
          onRun={async (p) => {
            const f = await genContent({ target: 'evaluation', prompt: p, ...(c.overallRecommendation ? { context: c.overallRecommendation } : {}) })
            if (!f) return
            onChange({
              ...c,
              ...(f.overallRecommendation && !c.overallRecommendation ? { overallRecommendation: f.overallRecommendation } : {}),
              pros: [...(c.pros ?? []), ...(f.pros ?? [])],
              cons: [...(c.cons ?? []), ...(f.cons ?? [])],
              ...(f.tradeoffs?.length ? { tradeoffs: [...(c.tradeoffs ?? []), ...f.tradeoffs] } : {}),
              rationale: [...(c.rationale ?? []), ...(f.rationale ?? [])],
            })
          }}
        />
      )}
      <Field label="Divergences">
        <div className="space-y-2">
          {divergences.map((dv, i) => (
            <DivergenceEditor key={i} dv={dv} i={i} len={divergences.length}
              onChange={(ndv) => onChange({ ...c, divergences: replaceAt(divergences, i, ndv) })}
              onMove={(dir) => onChange({ ...c, divergences: move(divergences, i, dir) })}
              onRemove={() => onChange({ ...c, divergences: removeAt(divergences, i) })} />
          ))}
          <button type="button" className={ADD_BTN} onClick={() => onChange({ ...c, divergences: [...divergences, { topic: '', positions: [], tension: '' }] })}>+ Divergence</button>
        </div>
      </Field>
      <div className="rounded-lg border border-[#7C3AED]/40 bg-[#7C3AED]/5 p-3 space-y-2">
        <TextAreaField label="Overall recommendation" value={c.overallRecommendation} placeholder="One short sentence" onChange={(v) => onChange({ ...c, overallRecommendation: v })} />
        <div className="grid grid-cols-2 gap-2">
          <StringListEditor label="Pros" color="#059669" items={c.pros ?? []} placeholder="Pro" addLabel="Pro" onChange={(pros) => onChange({ ...c, pros })} />
          <StringListEditor label="Cons" color="#DC2626" items={c.cons ?? []} placeholder="Con" addLabel="Con" onChange={(cons) => onChange({ ...c, cons })} />
        </div>
        <StringListEditor label="Tradeoffs" color="#D97706" items={c.tradeoffs ?? []} placeholder="Tradeoff" addLabel="Tradeoff" onChange={(tradeoffs) => onChange({ ...c, tradeoffs: tradeoffs.length ? tradeoffs : undefined })} />
        <StringListEditor label="Rationale" color="#7C3AED" items={c.rationale ?? []} placeholder="Reasoning point" addLabel="Rationale point" onChange={(rationale) => onChange({ ...c, rationale })} />
      </div>
      <DecisionCriteriaEditor c={c} onChange={onChange} />
      <DiagramListEditor diagrams={c.diagrams} gen={gen} context={c.overallRecommendation || undefined} onChange={(diagrams) => onChange({ ...c, diagrams: diagrams.length ? diagrams : undefined })} />
    </div>
  )
}

// Editable synthesized deliverable on the evaluation section: the recommended
// decision (bullets), the prioritized criteria, actions, and next steps. These are
// app-level fields on the content, written back via a cast. Editing them here (and
// re-synthesizing) both write the same fields.
function DecisionCriteriaEditor({ c, onChange }: { c: EvaluationSectionContent; onChange: (c: EvaluationSectionContent) => void }) {
  const s = readSynthesis(c)
  const set = (patch: Record<string, unknown>) => onChange({ ...(c as object), ...patch } as unknown as EvaluationSectionContent)
  const criteria = s.decisionCriteria
  const actions = s.actions
  return (
    <div className="rounded-lg border border-[#0891B2]/40 bg-[#0891B2]/5 p-3 space-y-3">
      <div className="text-[11px] uppercase tracking-wide text-[#0891B2] font-semibold">Decision Criteria</div>

      <StringListEditor label="Recommended decision" color="#0891B2" items={s.recommendedDecision} placeholder="Decision point" addLabel="Point"
        onChange={(recommendedDecision) => set({ recommendedDecision })} />

      <Field label="Criteria (prioritized)">
        <div className="space-y-2">
          {criteria.map((d, i) => (
            <div key={i} className={`${CARD} space-y-1.5`}>
              <div className="flex items-center gap-1.5">
                <input className={INPUT} value={d.criterion} placeholder="Criterion" onChange={(e) => set({ decisionCriteria: replaceAt(criteria, i, { ...d, criterion: e.target.value }) })} />
                <select aria-label="Priority" title="Priority" className={DIAGRAM_SELECT} value={d.priority ?? 'medium'}
                  onChange={(e) => set({ decisionCriteria: replaceAt(criteria, i, { ...d, priority: e.target.value as CriterionPriority }) })}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <RowControls i={i} len={criteria.length} onMove={(dir) => set({ decisionCriteria: move(criteria, i, dir) })} onRemove={() => set({ decisionCriteria: removeAt(criteria, i) })} />
              </div>
              <input className={INPUT} value={d.rationale ?? ''} placeholder="Rationale (why it matters, how to weigh it)"
                onChange={(e) => set({ decisionCriteria: replaceAt(criteria, i, { ...d, rationale: e.target.value || undefined }) })} />
              <StringListEditor label="Informed by" items={d.sources ?? []} placeholder="Consideration or section" addLabel="Source"
                onChange={(sources) => set({ decisionCriteria: replaceAt(criteria, i, { ...d, sources: sources.length ? sources : undefined }) })} />
            </div>
          ))}
          <button type="button" className={ADD_BTN} onClick={() => set({ decisionCriteria: [...criteria, { criterion: '', priority: 'medium' as CriterionPriority }] })}>+ Criterion</button>
        </div>
      </Field>

      <Field label="Actions">
        <div className="space-y-1.5">
          {actions.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input className={`${INPUT} flex-1`} value={a.title} placeholder="Action" onChange={(e) => set({ actions: replaceAt(actions, i, { ...a, title: e.target.value }) })} />
              <input className={`${INPUT} w-28`} value={a.owner ?? ''} placeholder="Owner" onChange={(e) => set({ actions: replaceAt(actions, i, { ...a, owner: e.target.value || undefined }) })} />
              <input className={`${INPUT} w-24`} value={a.due ?? ''} placeholder="Due" onChange={(e) => set({ actions: replaceAt(actions, i, { ...a, due: e.target.value || undefined }) })} />
              <RowControls i={i} len={actions.length} onMove={(dir) => set({ actions: move(actions, i, dir) })} onRemove={() => set({ actions: removeAt(actions, i) })} />
            </div>
          ))}
          <button type="button" className={ADD_BTN} onClick={() => set({ actions: [...actions, { title: '' }] })}>+ Action</button>
        </div>
      </Field>

      <StringListEditor label="Next steps" color="#059669" items={s.nextSteps} placeholder="Next step" addLabel="Next step"
        onChange={(nextSteps) => set({ nextSteps })} />
    </div>
  )
}

// ─── Public component ────────────────────────────────────────────────────────
export default function SectionContentEditor({ value, onChange, generateDiagram, generateContent }: {
  value: SectionContent
  onChange: (next: SectionContent) => void
  // Optional: wire an AI generator to show a "Generate with AI" box on each diagram.
  generateDiagram?: GenerateDiagramFn
  // Optional: wire an AI generator to show "Generate with AI" boxes for text content.
  generateContent?: GenerateContentFn
}) {
  const kindEditor =
    value.kind === 'overview' ? <OverviewEditor c={value} onChange={onChange} gen={generateDiagram} genContent={generateContent} />
    : value.kind === 'workstream' ? <WorkstreamEditor c={value} onChange={onChange} gen={generateDiagram} genContent={generateContent} />
    : <EvaluationEditor c={value} onChange={onChange} gen={generateDiagram} genContent={generateContent} />

  // "Notes & Considerations" is an app-level field carried on every kind. Edit it
  // here uniformly; it renders in prep and as a slide in the Workshop Experience.
  const notes = (value as unknown as { notesAndConsiderations?: string[] }).notesAndConsiderations ?? []
  const setNotes = (n: string[]) => onChange({ ...(value as object), notesAndConsiderations: n.length ? n : undefined } as unknown as SectionContent)

  return (
    <div className="space-y-4">
      {kindEditor}
      <div className="pt-3 border-t border-border space-y-2">
        <StringListEditor label="Notes & Considerations" color="#D97706" items={notes} placeholder="Note or consideration" addLabel="Note" onChange={setNotes} />
        {generateContent && (
          <AiContentBar
            label="Generate notes & considerations with AI"
            placeholder="e.g. Call out FAR/DFARS exposure, data migration gotchas, and change-management notes."
            onRun={async (p) => {
              const b = await generateContent({ target: 'bullets', prompt: p, context: 'notes and considerations for this section' })
              if (b?.length) setNotes([...notes, ...b])
            }}
          />
        )}
      </div>
    </div>
  )
}
