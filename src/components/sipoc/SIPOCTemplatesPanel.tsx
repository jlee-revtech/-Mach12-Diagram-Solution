'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronRight, LayoutTemplate } from 'lucide-react'
import { Button, EmptyState, LoadingState } from '@/components/common'
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
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div>
          <h2 className="text-heading-sm font-display text-text-primary">Saved SIPOC Templates</h2>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            Reusable across Process Maps & Value Streams
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={<X size={14} />}
          aria-label="Close"
          onClick={onClose}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-surface-muted/40">
        {loading ? (
          <LoadingState variant="inline" label="Loading templates..." />
        ) : templates.length === 0 ? (
          <EmptyState
            variant="dashed"
            icon={<LayoutTemplate size={24} />}
            title="No templates yet"
            description="Save a SIPOC capability as a template using the Export menu to reuse it across maps."
          />
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
                  className="rounded-lg border border-border bg-white shadow-card overflow-hidden"
                >
                  {/* Template row */}
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-muted/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : tmpl.id)}
                  >
                    {/* Level badge */}
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: td.capability.color || '#2563EB' }}
                    >
                      L{td.capability.level}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="text-body-sm font-semibold text-text-primary truncate">{tmpl.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {tmpl.description && (
                          <span className="text-[11px] text-text-secondary truncate max-w-[200px]">{tmpl.description}</span>
                        )}
                      </div>
                    </div>

                    {/* Counts */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
                        {inputCount} in · {outputCount} out
                      </span>
                    </div>

                    {/* Expand indicator */}
                    <ChevronRight
                      size={12}
                      className={`shrink-0 text-text-tertiary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-border px-3 py-3">
                      {/* Capability info */}
                      <div className="mb-3">
                        <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">Capability</div>
                        <div className="text-body-sm text-text-primary">{td.capability.name}</div>
                        {(td.capability.features || []).length > 0 && (
                          <div className="text-[11px] text-text-secondary mt-0.5">
                            {td.capability.features!.map(f => `• ${f}`).join(' ')}
                          </div>
                        )}
                        {td.system && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-1.5 h-1.5 rounded-sm bg-[#64748B] shrink-0" />
                            <span className="text-[11px] text-text-secondary">{td.system}</span>
                          </div>
                        )}
                      </div>

                      {/* Inputs summary */}
                      {inputCount > 0 && (
                        <div className="mb-3">
                          <div className="text-[10px] uppercase tracking-wider text-status-yellow font-medium mb-1">
                            Inputs ({inputCount})
                          </div>
                          <div className="space-y-1">
                            {td.inputs.map((inp, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                                <div className="w-1 h-1 rounded-full bg-status-yellow shrink-0" />
                                <span className="text-text-secondary truncate">{inp.informationProduct.name}</span>
                                {inp.supplierPersonas.length > 0 && (
                                  <span className="text-text-tertiary">
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
                          <div className="text-[10px] uppercase tracking-wider text-status-green font-medium mb-1">
                            Outputs ({outputCount})
                          </div>
                          <div className="space-y-1">
                            {td.outputs.map((out, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                                <div className="w-1 h-1 rounded-full bg-status-green shrink-0" />
                                <span className="text-text-secondary truncate">{out.informationProduct.name}</span>
                                {out.consumerPersonas.length > 0 && (
                                  <span className="text-text-tertiary">
                                    ({out.consumerPersonas.length} consumer{out.consumerPersonas.length !== 1 ? 's' : ''})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Created date */}
                      <div className="text-[11px] text-text-tertiary mb-3">
                        Created {new Date(tmpl.created_at).toLocaleDateString()}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => alert('Apply template - coming soon')}
                        >
                          Apply
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingId === tmpl.id}
                          onClick={() => handleDelete(tmpl.id)}
                        >
                          {deletingId === tmpl.id ? 'Deleting...' : 'Delete'}
                        </Button>
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
