'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CapabilityTemplateRow } from '@/lib/sipoc/types'
import { listCapabilityTemplates, deleteCapabilityTemplate } from '@/lib/supabase/capability-maps'

interface Props {
  orgId: string
  onClose: () => void
}

export default function SIPOCTemplatesPanel({ orgId, onClose }: Props) {
  const [templates, setTemplates] = useState<CapabilityTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listCapabilityTemplates(orgId)
      setTemplates(data)
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteCapabilityTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
      if (expandedId === id) setExpandedId(null)
    } catch (err) {
      console.error('Failed to delete template:', err)
      alert('Failed to delete template')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--m12-border)]/20 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-[var(--m12-text)]">Saved SIPOC Templates</h2>
          <p className="text-[9px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-faint)] uppercase tracking-wider mt-0.5">
            Reusable across Process Maps & Value Streams
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--m12-text-muted)] hover:text-[var(--m12-text)] hover:bg-[var(--m12-bg)] transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 8L8 2M2 2l6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-[var(--m12-text-faint)] text-xs">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20 14" />
              </svg>
              Loading templates...
            </div>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--m12-bg)] border border-[var(--m12-border)]/20 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="var(--m12-text-faint)" strokeWidth="1.2" />
                <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="var(--m12-text-faint)" strokeWidth="1.2" />
                <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="var(--m12-text-faint)" strokeWidth="1.2" />
                <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="var(--m12-text-faint)" strokeWidth="1.2" strokeDasharray="3 2" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-[var(--m12-text-muted)] mb-1">No templates yet</p>
            <p className="text-[10px] text-[var(--m12-text-faint)] max-w-[240px] leading-relaxed">
              Save a SIPOC capability as a template using the Export menu to reuse it across maps.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map(tmpl => {
              const td = tmpl.template_data
              const inputCount = td.inputs?.length ?? 0
              const outputCount = td.outputs?.length ?? 0
              const isExpanded = expandedId === tmpl.id

              return (
                <div
                  key={tmpl.id}
                  className="rounded-lg border border-[var(--m12-border)]/20 bg-[var(--m12-bg-card)] overflow-hidden"
                >
                  {/* Template row */}
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--m12-bg)]/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : tmpl.id)}
                  >
                    {/* Level badge */}
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ backgroundColor: td.capability.color || '#2563EB' }}
                    >
                      L{td.capability.level}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-[var(--m12-text)] truncate">{tmpl.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {tmpl.description && (
                          <span className="text-[9px] text-[var(--m12-text-muted)] truncate max-w-[200px]">{tmpl.description}</span>
                        )}
                      </div>
                    </div>

                    {/* Counts */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[8px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-faint)] uppercase">
                        {inputCount} in · {outputCount} out
                      </span>
                    </div>

                    {/* Expand indicator */}
                    <svg
                      width="8" height="8" viewBox="0 0 8 8" fill="none"
                      className={`shrink-0 text-[var(--m12-text-faint)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    >
                      <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-[var(--m12-border)]/15 px-3 py-3">
                      {/* Capability info */}
                      <div className="mb-3">
                        <div className="text-[8px] font-[family-name:var(--font-space-mono)] text-[var(--m12-text-faint)] uppercase tracking-wider mb-1">Capability</div>
                        <div className="text-[10px] text-[var(--m12-text)]">{td.capability.name}</div>
                        {td.capability.description && (
                          <div className="text-[9px] text-[var(--m12-text-muted)] mt-0.5">{td.capability.description}</div>
                        )}
                        {td.system && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-1.5 h-1.5 rounded-sm bg-[#64748B] shrink-0" />
                            <span className="text-[9px] text-[var(--m12-text-muted)]">{td.system}</span>
                          </div>
                        )}
                      </div>

                      {/* Inputs summary */}
                      {inputCount > 0 && (
                        <div className="mb-3">
                          <div className="text-[8px] font-[family-name:var(--font-space-mono)] text-[#EAB308] uppercase tracking-wider mb-1">
                            Inputs ({inputCount})
                          </div>
                          <div className="space-y-1">
                            {td.inputs.map((inp, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[9px]">
                                <div className="w-1 h-1 rounded-full bg-[#EAB308] shrink-0" />
                                <span className="text-[var(--m12-text-secondary)] truncate">{inp.informationProduct.name}</span>
                                {inp.supplierPersonas.length > 0 && (
                                  <span className="text-[var(--m12-text-faint)]">
                                    ({inp.supplierPersonas.length} supplier{inp.supplierPersonas.length !== 1 ? 's' : ''})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Outputs summary */}
                      {outputCount > 0 && (
                        <div className="mb-3">
                          <div className="text-[8px] font-[family-name:var(--font-space-mono)] text-[#10B981] uppercase tracking-wider mb-1">
                            Outputs ({outputCount})
                          </div>
                          <div className="space-y-1">
                            {td.outputs.map((out, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[9px]">
                                <div className="w-1 h-1 rounded-full bg-[#10B981] shrink-0" />
                                <span className="text-[var(--m12-text-secondary)] truncate">{out.informationProduct.name}</span>
                                {out.consumerPersonas.length > 0 && (
                                  <span className="text-[var(--m12-text-faint)]">
                                    ({out.consumerPersonas.length} consumer{out.consumerPersonas.length !== 1 ? 's' : ''})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Created date */}
                      <div className="text-[8px] text-[var(--m12-text-faint)] font-[family-name:var(--font-space-mono)] mb-3">
                        Created {new Date(tmpl.created_at).toLocaleDateString()}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          className="px-2.5 py-1 rounded-md text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/20 transition-colors"
                          onClick={() => alert('Apply template — coming soon')}
                        >
                          Apply
                        </button>
                        <button
                          disabled={deletingId === tmpl.id}
                          onClick={() => handleDelete(tmpl.id)}
                          className="px-2.5 py-1 rounded-md text-[9px] font-[family-name:var(--font-space-mono)] font-bold uppercase tracking-wider text-red-400/70 hover:bg-red-400/10 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          {deletingId === tmpl.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
