'use client'

import { useState, useCallback, useEffect } from 'react'

interface OnboardingGuideProps {
  open: boolean
  onClose: () => void
}

const STEPS = [
  {
    title: 'Add Systems',
    subtitle: 'Build your enterprise architecture',
    description:
      'Open the Systems tab in the right sidebar and click any system type (ERP, CRM, PLM, MES, etc.) to place it on the canvas. Each system appears as a card showing its name, physical system, and type. You can add 13 different system types to model your complete data landscape.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="10" width="32" height="28" rx="6" stroke="#2563EB" strokeWidth="2" />
        <rect x="14" y="18" width="10" height="10" rx="3" fill="#2563EB" fillOpacity="0.2" stroke="#2563EB" strokeWidth="1.5" />
        <rect x="28" y="18" width="6" height="3" rx="1" fill="#64748B" />
        <rect x="28" y="24" width="6" height="3" rx="1" fill="#64748B" />
      </svg>
    ),
    keys: ['Systems tab', 'Click to add'],
    color: '#2563EB',
  },
  {
    title: 'Connect Systems',
    subtitle: 'Define data flows between systems',
    description:
      'Two ways to connect: (1) Click the Connect button in the toolbar, then click a source system followed by a target — the connection is created automatically with smart handle placement. (2) Hover over any system to reveal connection dots, then drag from a dot to another system. Connections show directional arrows and can be set to bidirectional.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="16" width="16" height="16" rx="4" stroke="#06B6D4" strokeWidth="2" />
        <rect x="28" y="16" width="16" height="16" rx="4" stroke="#06B6D4" strokeWidth="2" />
        <path d="M20 24H28" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
        <circle cx="20" cy="24" r="2.5" fill="#06B6D4" />
        <circle cx="28" cy="24" r="2.5" fill="#06B6D4" />
      </svg>
    ),
    keys: ['Connect button', 'Drag handles', 'Esc to cancel'],
    color: '#06B6D4',
  },
  {
    title: 'Data Elements & Technical Details',
    subtitle: 'Document what flows between systems',
    description:
      'Click any connection line to select it, then use the Data tab to add data elements (transactions, master data, documents, events). Each element has an expandable Technical Details section where you can record Source System ID, Table, Field, Transaction Code, BAPI/API, IDoc Type, and more. Use the quick-add buttons to populate common fields instantly.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M8 24H40" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
        <polygon points="38,20 44,24 38,28" fill="#64748B" />
        <rect x="14" y="14" width="20" height="20" rx="4" fill="#1F2C3F" stroke="#10B981" strokeWidth="1.5" />
        <circle cx="20" cy="22" r="2" fill="#2563EB" />
        <rect x="24" y="21" width="6" height="2" rx="1" fill="#64748B" />
        <circle cx="20" cy="28" r="2" fill="#06B6D4" />
        <rect x="24" y="27" width="6" height="2" rx="1" fill="#64748B" />
      </svg>
    ),
    keys: ['Click a line', 'Data tab', 'Technical Details'],
    color: '#10B981',
  },
  {
    title: 'Output Artifacts',
    subtitle: 'Define deliverables and trace data lineage',
    description:
      'In the Data tab (with no connection selected), define Output Artifacts — deliverables like Approved Budget, Production Schedule, or Cost Estimate. Then select any connection and tag which artifacts that data flow contributes to. Click an artifact name to Spotlight it — all related data flows light up while everything else dims, showing the complete data lineage for that deliverable.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="10" y="8" width="28" height="32" rx="4" stroke="#F97316" strokeWidth="2" />
        <path d="M16 16h16M16 22h12M16 28h8" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="36" cy="12" r="6" fill="#F97316" fillOpacity="0.2" stroke="#F97316" strokeWidth="1.5" />
        <path d="M34 12h4M36 10v4" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    keys: ['Data tab', 'Tag connections', 'Click to spotlight'],
    color: '#F97316',
  },
  {
    title: 'Spotlight Mode',
    subtitle: 'Focus on what matters',
    description:
      'Click any system to automatically spotlight it — all connected systems and data flows stay bright while everything else fades to 20% opacity. This lets you instantly see every data flow touching that system. Click the canvas background to exit spotlight. The Connect button is disabled during spotlight to prevent accidental changes.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="16" stroke="#EAB308" strokeWidth="2" strokeDasharray="4 3" />
        <circle cx="24" cy="24" r="8" fill="#EAB308" fillOpacity="0.2" stroke="#EAB308" strokeWidth="2" />
        <circle cx="24" cy="24" r="3" fill="#EAB308" />
      </svg>
    ),
    keys: ['Click a system', 'Click canvas to exit'],
    color: '#EAB308',
  },
  {
    title: 'AI Assistant',
    subtitle: 'Generate and analyze diagrams',
    description:
      'Press Ctrl+K to open the AI assistant. In Generate mode, describe your architecture in plain English (e.g., "Procure to Pay with SAP S/4HANA and Ariba") or upload a screenshot — AI creates the full diagram. In Analyze mode, AI reviews your diagram for completeness, missing systems, data governance gaps, and gives a score with recommendations.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="12" width="32" height="24" rx="6" stroke="#8B5CF6" strokeWidth="2" />
        <path d="M16 22h16M16 28h10" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="36" cy="16" r="6" fill="#8B5CF6" fillOpacity="0.15" stroke="#8B5CF6" strokeWidth="1.5" />
        <text x="36" y="19" textAnchor="middle" fill="#8B5CF6" fontSize="8" fontWeight="bold">AI</text>
      </svg>
    ),
    keys: ['Ctrl + K', 'Generate', 'Analyze'],
    color: '#8B5CF6',
  },
  {
    title: 'Auto Layout & Navigation',
    subtitle: 'Organize and explore your diagram',
    description:
      'Click the Auto Layout button (tree icon) to automatically reorganize all systems into clean columns grouped by type, with connections flowing clearly between them. Use Fit View to see everything, zoom with scroll wheel, and pan by dragging the canvas. The minimap in the bottom-right shows an overview for quick navigation.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="14" width="12" height="8" rx="2" stroke="#14B8A6" strokeWidth="1.5"/>
        <rect x="4" y="28" width="12" height="8" rx="2" stroke="#14B8A6" strokeWidth="1.5"/>
        <rect x="32" y="10" width="12" height="8" rx="2" stroke="#14B8A6" strokeWidth="1.5"/>
        <rect x="32" y="22" width="12" height="8" rx="2" stroke="#14B8A6" strokeWidth="1.5"/>
        <rect x="32" y="34" width="12" height="8" rx="2" stroke="#14B8A6" strokeWidth="1.5"/>
        <path d="M16 18h16M16 32h10l6-6M16 32h10l6 6" stroke="#14B8A6" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    keys: ['Auto Layout', 'Fit View', 'Scroll to zoom'],
    color: '#14B8A6',
  },
  {
    title: 'Connections Catalog',
    subtitle: 'Browse and filter all data flows',
    description:
      'In the Data tab with no connection selected, the Connections Catalog shows every data flow in your diagram. Filter by system name (with physical system references) or search by data element name. Each row shows source, target, physical systems, and a preview of data elements. Click any row to jump to editing that connection.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="8" width="32" height="32" rx="4" stroke="#64748B" strokeWidth="2" />
        <path d="M8 18h32M8 28h32" stroke="#64748B" strokeWidth="1.5" />
        <path d="M20 8v32" stroke="#64748B" strokeWidth="1.5" />
      </svg>
    ),
    keys: ['Data tab', 'Filter by system', 'Search'],
    color: '#64748B',
  },
  {
    title: 'Save, Share & Export',
    subtitle: 'Collaborate and deliver',
    description:
      'Click Save to persist your diagram to the cloud. Use Share to generate invite links (editor or viewer access, expires in 7 days). Export your diagram as PNG, SVG, PDF, JSON, or BPMN format. All changes sync in real-time when multiple collaborators are editing — you\'ll see their cursors and a presence indicator showing who\'s online.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="14" r="6" stroke="#EC4899" strokeWidth="2" />
        <circle cx="12" cy="32" r="5" stroke="#EC4899" strokeWidth="1.5" />
        <circle cx="36" cy="32" r="5" stroke="#EC4899" strokeWidth="1.5" />
        <path d="M24 20v6M18 29l-3 1M30 29l3 1" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    keys: ['Save', 'Share', 'Export'],
    color: '#EC4899',
  },
]

export default function OnboardingGuide({ open, onClose }: OnboardingGuideProps) {
  const [step, setStep] = useState(0)
  const total = STEPS.length

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === 'Enter') setStep((s) => Math.min(s + 1, total - 1))
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, total])

  const handleNext = useCallback(() => {
    if (step < total - 1) setStep(step + 1)
    else onClose()
  }, [step, total, onClose])

  const handlePrev = useCallback(() => {
    if (step > 0) setStep(step - 1)
  }, [step])

  if (!open) return null

  const current = STEPS[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg mx-4 bg-[var(--m12-bg-secondary)] border border-[var(--m12-border)]/60 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-[var(--m12-bg)]">
          <div
            className="h-full transition-all duration-500 ease-out rounded-r-full"
            style={{
              width: `${((step + 1) / total) * 100}%`,
              backgroundColor: current.color,
            }}
          />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold font-[family-name:var(--font-space-mono)] uppercase tracking-widest"
              style={{ color: current.color }}
            >
              Step {step + 1} of {total}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--m12-border)] hover:text-[var(--m12-text-secondary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pt-6 pb-4">
          {/* Icon + Title */}
          <div className="flex items-start gap-5 mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: current.color + '10', border: `1px solid ${current.color}30` }}
            >
              {current.icon}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-lg font-semibold text-[var(--m12-text)]">{current.title}</h3>
              <p className="text-sm text-[var(--m12-text-muted)] mt-0.5">{current.subtitle}</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm leading-relaxed text-[var(--m12-text-secondary)]">{current.description}</p>

          {/* Keyboard hints */}
          {current.keys.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {current.keys.map((key) => (
                <span
                  key={key}
                  className="text-[11px] font-[family-name:var(--font-space-mono)] px-2.5 py-1 rounded-md bg-[var(--m12-bg)] border border-[var(--m12-border)]/50 text-[var(--m12-text-faint)]"
                >
                  {key}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Step dots + navigation */}
        <div className="flex items-center justify-between px-6 pb-5 pt-2">
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="transition-all duration-300"
                style={{
                  width: i === step ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === step ? current.color : '#374A5E',
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={handlePrev}
                className="text-sm text-[var(--m12-text-muted)] hover:text-[var(--m12-text-secondary)] px-3 py-2 rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="text-sm font-medium text-white px-5 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: current.color }}
            >
              {step === total - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
