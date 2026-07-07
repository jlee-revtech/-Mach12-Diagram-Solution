'use client'

// Public, read-only view of a workshop's prep, reached via a share code. No auth:
// it fetches /api/share/workshop/[code] (service-key, gated on the enabled share)
// and renders the brief + each section's content with the SAME SectionContentView
// the prep view uses, so it always matches.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { SectionContent } from '@jlee-revtech/agent-core'
import type { WorkshopBriefData, WorkshopAgendaItem, SectionKind } from '@/lib/workshop/types'
import { sectionMetaFor } from '@/components/workshop/sectionMeta'
import SectionContentView from '@/components/workshop/SectionContentView'

interface ShareData {
  workshop: { id: string; title: string; customer_name: string | null; topic: string | null; objective: string | null; duration_minutes: number | null; status: string; brief: WorkshopBriefData | null }
  agenda: WorkshopAgendaItem[]
  content: { agenda_item_id: string; section_kind: SectionKind; content: SectionContent | null }[]
}

export default function WorkshopSharePage() {
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<ShareData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/share/workshop/${code}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Not available'); return d as ShareData })
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Not available') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [code])

  if (loading) return <Centered><div className="text-sm text-[var(--m12-text-muted)]">Loading…</div></Centered>
  if (error || !data) {
    return (
      <Centered>
        <div className="text-center max-w-md">
          <div className="text-lg font-semibold text-[var(--m12-text-secondary)] mb-2">This link is not available</div>
          <p className="text-sm text-[var(--m12-text-muted)]">{error || 'The share link may have been turned off.'}</p>
        </div>
      </Centered>
    )
  }

  const { workshop, agenda, content } = data
  const contentByItem = new Map(content.map((c) => [c.agenda_item_id, c]))
  const sections = agenda.filter((a) => !!contentByItem.get(a.id)?.content)
  const b = workshop.brief

  return (
    <div className="min-h-screen bg-[var(--m12-bg)]">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gradient text-lg font-bold font-[family-name:var(--font-orbitron)] tracking-wide">MACH12</span>
          <span className="text-[var(--m12-text-muted)]">/</span>
          <span className="text-[10px] uppercase tracking-wider text-[#3B82F6] border border-[#3B82F6]/40 rounded-full px-2 py-0.5">Shared workshop prep, read only</span>
        </div>
        <h1 className="text-xl font-semibold text-[var(--m12-text)] mt-3">{workshop.title}</h1>
        <div className="flex items-center gap-2 text-xs text-[var(--m12-text-muted)] mt-1">
          {workshop.customer_name && <span>{workshop.customer_name}</span>}
          {workshop.duration_minutes ? <span>· {workshop.duration_minutes} min</span> : null}
        </div>
        {workshop.topic && <p className="text-sm text-[var(--m12-text-secondary)] leading-relaxed mt-3">{workshop.topic}</p>}

        {/* Brief */}
        {b && (
          <div className="mt-8 space-y-6">
            <div className="text-[11px] uppercase tracking-wider text-[var(--m12-text-muted)]">Workshop brief</div>
            {b.summary && <p className="text-sm text-[var(--m12-text-secondary)] leading-relaxed">{b.summary}</p>}
            <List title="Objectives" items={b.objectives} marker="•" color="#2563EB" />
            {(b.agenda?.length || 0) > 0 && (
              <Section title="Agenda">
                <div className="space-y-1.5">
                  {b.agenda.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg px-3 py-2">
                      <span className="text-[10px] text-[var(--m12-text-muted)] mt-0.5 w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[var(--m12-text)]">{a.title}</div>
                        {a.objective && <div className="text-[10px] text-[var(--m12-text-muted)] mt-0.5">{a.objective}</div>}
                      </div>
                      {a.timeboxMinutes ? <span className="text-[9px] text-[var(--m12-text-muted)] shrink-0">{a.timeboxMinutes}m</span> : null}
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {b.preRead && <Section title="Pre-read"><p className="text-xs text-[var(--m12-text-secondary)] leading-relaxed whitespace-pre-wrap">{b.preRead}</p></Section>}
            <List title="Gaps & decisions to drive" items={b.gaps} marker="▸" color="#D97706" />
            <List title="Questions to prepare" items={b.keyQuestions} marker="?" color="#3B82F6" />
            <List title="Risks" items={b.risks} marker="⚠" color="#DC2626" />
          </div>
        )}

        {/* Sections */}
        {sections.length > 0 && (
          <div className="mt-10 space-y-6">
            <div className="text-[11px] uppercase tracking-wider text-[var(--m12-text-muted)]">Sections</div>
            {sections.map((a) => {
              const row = contentByItem.get(a.id)!
              const meta = sectionMetaFor(a.section_kind)
              return (
                <div key={a.id} className="border-t border-[var(--m12-border)]/40 pt-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}>
                      <span>{meta.icon}</span>{meta.label}
                    </span>
                    {a.timebox_minutes ? <span className="text-[10px] text-[var(--m12-text-muted)]">{a.timebox_minutes}m</span> : null}
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--m12-text)] leading-snug mb-3">{a.title}</h3>
                  {row.content && <SectionContentView content={row.content} />}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-12 pt-5 border-t border-[var(--m12-border)]/40 text-[10px] text-[var(--m12-text-faint)]">
          Shared read-only from Mach12.ai Solution Architecture Studio.
        </div>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--m12-bg)] flex items-center justify-center px-6">{children}</div>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] uppercase tracking-wider text-[var(--m12-text-muted)] mb-2">{title}</div>{children}</div>
}

function List({ title, items, marker, color }: { title: string; items?: string[]; marker: string; color: string }) {
  if (!items || items.length === 0) return null
  return (
    <Section title={title}>
      <ul className="space-y-1">
        {items.map((t, i) => (
          <li key={i} className="text-xs text-[var(--m12-text-secondary)] flex gap-2 leading-snug"><span style={{ color }}>{marker}</span>{t}</li>
        ))}
      </ul>
    </Section>
  )
}
