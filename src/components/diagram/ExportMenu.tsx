'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Braces,
  Download,
  FileImage,
  FileText,
  PenTool,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { useDiagramStore } from '@/lib/diagram/store'
import { exportPng, exportSvg, exportPdf, exportJson, exportBpmn } from '@/lib/export'
import TechSpecDialog from './TechSpecDialog'

const EXPORT_OPTIONS = [
  { key: 'png', label: 'PNG Image', desc: 'High-res raster image', icon: FileImage },
  { key: 'svg', label: 'SVG Vector', desc: 'Scalable vector graphic', icon: PenTool },
  { key: 'pdf', label: 'PDF Document', desc: 'Print-ready document', icon: FileText },
  { key: 'json', label: 'JSON Schema', desc: 'Machine-readable data', icon: Braces },
  { key: 'bpmn', label: 'BPMN 2.0 XML', desc: 'For SAP Signavio / Camunda', icon: Workflow },
] as const

export default function ExportMenu() {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [techSpecOpen, setTechSpecOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const meta = useDiagramStore((s) => s.meta)
  const nodes = useDiagramStore((s) => s.nodes)
  const edges = useDiagramStore((s) => s.edges)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleExport = useCallback(async (key: string) => {
    setExporting(key)
    try {
      switch (key) {
        case 'png':
          await exportPng(meta.title)
          break
        case 'svg':
          await exportSvg(meta.title)
          break
        case 'pdf':
          await exportPdf(meta.title)
          break
        case 'json':
          exportJson(meta, nodes, edges)
          break
        case 'bpmn':
          exportBpmn(meta, nodes, edges)
          break
      }
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(null)
      setOpen(false)
    }
  }, [meta, nodes, edges])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        title="Export Diagram"
        className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors"
      >
        <Download size={16} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-dropdown border border-border py-1 animate-slide-in-up z-50">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-text-tertiary">
            Generate
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); setTechSpecOpen(true) }}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-muted transition-colors text-left group"
          >
            <span className="w-5 flex items-center justify-center text-brand-600">
              <FileText size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-body-sm font-medium text-text-secondary group-hover:text-text-primary">
                Technical Spec
                <span className="ml-1.5 text-[10px] font-bold text-brand-600 align-middle font-mono">AI</span>
              </div>
              <div className="text-[10px] text-text-tertiary">
                Integration functional &amp; technical doc
              </div>
            </div>
            <Sparkles size={12} className="text-amber-500 shrink-0" />
          </button>
          <div className="my-1 mx-3 border-t border-border" />
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-text-tertiary">
            Export As
          </div>
          {EXPORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleExport(opt.key)}
              disabled={exporting !== null}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-muted transition-colors text-left group"
            >
              <span className="w-5 flex items-center justify-center text-text-tertiary group-hover:text-text-secondary">
                <opt.icon size={15} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-body-sm font-medium text-text-secondary group-hover:text-text-primary">
                  {opt.label}
                  {exporting === opt.key && (
                    <span className="ml-2 text-brand-600">...</span>
                  )}
                </div>
                <div className="text-[10px] text-text-tertiary">
                  {opt.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <TechSpecDialog open={techSpecOpen} onClose={() => setTechSpecOpen(false)} />
    </div>
  )
}
