'use client'

import { useState, useCallback, useEffect } from 'react'

interface OnboardingGuideProps {
  open: boolean
  onClose: () => void
}

const STEPS = [
  {
    title: 'Add Systems',
    subtitle: 'Build your architecture',
    description:
      'Use the Systems panel on the right to add enterprise systems like ERP, CRM, PLM, and more. Click any system type to place it on the canvas.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="10" width="32" height="28" rx="6" stroke="#2563EB" strokeWidth="2" />
        <rect x="14" y="18" width="10" height="10" rx="3" fill="#2563EB" fillOpacity="0.2" stroke="#2563EB" strokeWidth="1.5" />
        <rect x="28" y="18" width="6" height="3" rx="1" fill="#64748B" />
        <rect x="28" y="24" width="6" height="3" rx="1" fill="#64748B" />
      </svg>
    ),
    keys: [],
    color: '#2563EB',
  },
  {
    title: 'Connect Systems',
    subtitle: 'Define data flows',
    description:
      'Click the Connect button in the toolbar, then click a source system followed by a target system. A data flow line is created automatically. You can also drag from the connection dots that appear when you hover over a system.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="16" width="16" height="16" rx="4" stroke="#06B6D4" strokeWidth="2" />
        <rect x="28" y="16" width="16" height="16" rx="4" stroke="#06B6D4" strokeWidth="2" />
        <path d="M20 24H28" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
        <circle cx="20" cy="24" r="2.5" fill="#06B6D4" />
        <circle cx="28" cy="24" r="2.5" fill="#06B6D4" />
      </svg>
    ),
    keys: ['Connect button', 'or drag handles'],
    color: '#06B6D4',
  },
  {
    title: 'Add Data Elements',
    subtitle: 'Describe what flows between systems',
    description:
      'Click on any connection line to select it, then use the Data tab in the sidebar to add data elements like transactions, master data, and documents that flow between systems.',
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
    keys: ['Click a line', 'Data tab'],
    color: '#10B981',
  },
  {
    title: 'Use AI Assistant',
    subtitle: 'Generate diagrams instantly',
    description:
      'Press Ctrl+K to open the AI assistant. Describe your architecture in plain English or upload a screenshot, and AI will generate the diagram for you — complete with systems, connections, and data elements.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="12" width="32" height="24" rx="6" stroke="#8B5CF6" strokeWidth="2" />
        <path d="M16 22h16M16 28h10" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="36" cy="16" r="6" fill="#8B5CF6" fillOpacity="0.15" stroke="#8B5CF6" strokeWidth="1.5" />
        <text x="36" y="19" textAnchor="middle" fill="#8B5CF6" fontSize="8" fontWeight="bold">AI</text>
      </svg>
    ),
    keys: ['Ctrl + K'],
    color: '#8B5CF6',
  },
  {
    title: 'Organize & Edit',
    subtitle: 'Refine your diagram',
    description:
      'Drag systems to reposition them. Double-click a system name to rename it. Select a system and use the Properties tab to set the physical system (e.g., SAP S/4HANA). Use scroll to zoom, and drag the canvas to pan.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M24 8v8M24 32v8M8 24h8M32 24h8" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
        <rect x="16" y="16" width="16" height="16" rx="4" stroke="#F97316" strokeWidth="2" />
        <path d="M20 24h8M24 20v8" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    keys: ['Drag', 'Double-click', 'Scroll'],
    color: '#F97316',
  },
  {
    title: 'Save & Share',
    subtitle: 'Collaborate with your team',
    description:
      'Click the Save button to persist your diagram. Use the Share button to invite team members as viewers or editors. All changes sync in real-time when collaborating.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="14" r="6" stroke="#EC4899" strokeWidth="2" />
        <circle cx="12" cy="32" r="5" stroke="#EC4899" strokeWidth="1.5" />
        <circle cx="36" cy="32" r="5" stroke="#EC4899" strokeWidth="1.5" />
        <path d="M24 20v6M18 29l-3 1M30 29l3 1" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    keys: ['Save', 'Share'],
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
        className="relative w-full max-w-lg mx-4 bg-[#1A2435] border border-[#374A5E]/60 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-[#151E2E]">
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
            className="text-[#374A5E] hover:text-[#CBD5E1] transition-colors"
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
              <h3 className="text-lg font-semibold text-[#F8FAFC]">{current.title}</h3>
              <p className="text-sm text-[#64748B] mt-0.5">{current.subtitle}</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm leading-relaxed text-[#CBD5E1]">{current.description}</p>

          {/* Keyboard hints */}
          {current.keys.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {current.keys.map((key) => (
                <span
                  key={key}
                  className="text-[11px] font-[family-name:var(--font-space-mono)] px-2.5 py-1 rounded-md bg-[#151E2E] border border-[#374A5E]/50 text-[#94A3B8]"
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
                className="text-sm text-[#64748B] hover:text-[#CBD5E1] px-3 py-2 rounded-lg transition-colors"
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
