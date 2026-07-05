'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Interactive loading screen shown while the brief is being generated. It cycles
// through the real steps the consultant agents run, so the wait reads as work in
// progress rather than a dead spinner. Rendered as a fixed overlay while the brief
// POST is in flight.
export default function BriefLoading({
  customerName,
  workstreamCount,
  durationMinutes,
  mode = 'brief',
}: {
  customerName?: string
  workstreamCount?: number
  durationMinutes?: number
  mode?: 'brief' | 'regenerate'
}) {
  const n = workstreamCount || 0
  const steps = [
    `Reading ${customerName || 'the customer'}'s architecture for this topic`,
    `Mapping the ${n || ''} ${n === 1 ? 'value stream' : 'value streams'} in scope`.replace('  ', ' '),
    `Drafting a timeboxed agenda for ${durationMinutes || 120} minutes`,
    'Synthesizing the pre-read from the real model',
    'Identifying the gaps and key decisions to drive',
    'Preparing the probing questions for the room',
    'Assembling the facilitation-ready brief',
  ]
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % steps.length), 2400)
    return () => clearInterval(t)
  }, [steps.length])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--m12-bg)]/85 backdrop-blur-sm">
      <div className="w-full max-w-md px-8 text-center">
        <div className="relative mx-auto mb-8 h-20 w-20">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-[#2563EB]/30"
            animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0.15, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-2 rounded-full border-2 border-[#2563EB]/20 border-t-[#2563EB]"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-gradient text-lg font-bold font-[family-name:var(--font-orbitron)]">
            M12
          </div>
        </div>

        <div className="text-sm font-semibold text-[var(--m12-text)] mb-2">
          {mode === 'regenerate' ? 'Regenerating the brief' : 'Preparing the brief'}
        </div>

        <div className="h-10 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4 }}
              className="text-xs text-[var(--m12-text-muted)]"
            >
              {steps[i]}…
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {steps.map((_, k) => (
            <div
              key={k}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: k === i ? 18 : 6, backgroundColor: k <= i ? '#2563EB' : 'var(--m12-border)' }}
            />
          ))}
        </div>

        <div className="mt-6 text-[10px] text-[var(--m12-text-muted)]">
          The consultant agents are reading the model and drafting a principal-grade agenda. This usually takes 15 to 30 seconds.
        </div>
      </div>
    </div>
  )
}
