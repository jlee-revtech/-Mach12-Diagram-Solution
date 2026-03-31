'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useDiagramStore } from '@/lib/diagram/store'
import { exportPng, exportSvg, exportPdf, exportJson, exportBpmn } from '@/lib/export'

const EXPORT_OPTIONS = [
  { key: 'png', label: 'PNG Image', desc: 'High-res raster image', icon: '🖼' },
  { key: 'svg', label: 'SVG Vector', desc: 'Scalable vector graphic', icon: '◇' },
  { key: 'pdf', label: 'PDF Document', desc: 'Print-ready document', icon: '📄' },
  { key: 'json', label: 'JSON Schema', desc: 'Machine-readable data', icon: '{ }' },
  { key: 'bpmn', label: 'BPMN 2.0 XML', desc: 'For SAP Signavio / Camunda', icon: '⬡' },
] as const

export default function ExportMenu() {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
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
        className="flex items-center justify-center w-8 h-8 rounded-lg text-[#CBD5E1] hover:bg-[#374A5E]/60 hover:text-[#F8FAFC] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-[#1A2435] border border-[#374A5E]/60 rounded-xl shadow-2xl py-1.5 z-50">
          <div className="px-3 py-1.5 text-[9px] uppercase tracking-widest text-[#64748B] font-[family-name:var(--font-space-mono)] font-bold">
            Export As
          </div>
          {EXPORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleExport(opt.key)}
              disabled={exporting !== null}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#374A5E]/30 transition-colors text-left group"
            >
              <span className="text-sm w-5 text-center opacity-60 group-hover:opacity-100">
                {opt.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[#CBD5E1] group-hover:text-[#F8FAFC]">
                  {opt.label}
                  {exporting === opt.key && (
                    <span className="ml-2 text-[#06B6D4]">...</span>
                  )}
                </div>
                <div className="text-[10px] text-[#374A5E] group-hover:text-[#64748B]">
                  {opt.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
