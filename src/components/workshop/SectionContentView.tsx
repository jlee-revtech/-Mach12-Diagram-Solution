'use client'

// Read-only render of a section's content, shared by the prep editor's read view
// and the public share page. Renders per kind (overview / workstream / evaluation),
// the section diagrams, the "Notes & Considerations" block, and — for the
// evaluation section — the synthesized Decision Criteria, Actions, and Next Steps.

import type { ReactNode } from 'react'
import type {
  SectionContent, OverviewSectionContent, WorkstreamSectionContent,
  EvaluationSectionContent, KeyDecision, WorkshopDiagram,
} from '@jlee-revtech/agent-core'
import { CONFIDENCE_META } from './sectionMeta'
import { DiagramCard } from './DiagramView'
import { normalizeSectionContent, sectionNotes } from '@/lib/workshop/deck'
import { readSynthesis, sortByPriority, PRIORITY_META } from '@/lib/workshop/decisionCriteria'

// Public entry: normalize (so old-shape rows never throw), then render the body +
// the notes block.
export default function SectionContentView({ content }: { content: SectionContent }) {
  return (
    <>
      <ContentBody content={normalizeSectionContent(content)} />
      <NotesReadBlock notes={sectionNotes(content)} />
    </>
  )
}

export function NotesReadBlock({ notes }: { notes: string[] }) {
  if (!notes || notes.length === 0) return null
  return (
    <div className="bg-[#D9770610] border border-[#D97706]/30 rounded-lg p-4 mt-3">
      <div className="text-[10px] uppercase tracking-wide text-[#D97706] mb-1.5">Notes & Considerations</div>
      <ul className="space-y-1">
        {notes.map((t, i) => (
          <li key={i} className="text-[11px] text-[var(--m12-text-secondary)] flex gap-2 leading-snug">
            <span className="text-[#D97706]">▸</span><span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ContentBody({ content }: { content: SectionContent }) {
  if (content.kind === 'overview') return <OverviewBody c={content} />
  if (content.kind === 'workstream') return <WorkstreamBody c={content} />
  return <EvaluationBody c={content} />
}

function SectionDiagrams({ diagrams }: { diagrams?: WorkshopDiagram[] }) {
  if (!diagrams || diagrams.length === 0) return null
  return <div className="space-y-3">{diagrams.map((d, i) => <DiagramCard key={i} diagram={d} width={560} />)}</div>
}

function Block({ title, color, children }: { title: string; color?: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: color || 'var(--m12-text-muted)' }}>{title}</div>
      {children}
    </div>
  )
}

function Bullets({ items, marker, color }: { items: string[]; marker?: string; color?: string }) {
  return (
    <ul className="space-y-1">
      {items.map((t, i) => (
        <li key={i} className="text-[11px] text-[var(--m12-text-secondary)] flex gap-2 leading-snug">
          <span style={{ color: color || '#2563EB' }}>{marker || '•'}</span><span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  const p = pros || [], c = cons || []
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-[9px] uppercase tracking-wide text-[#059669] mb-1">Pros</div>
        {p.length ? <Bullets items={p} marker="+" color="#059669" /> : <div className="text-[10px] text-[var(--m12-text-muted)]">None</div>}
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-wide text-[#DC2626] mb-1">Cons</div>
        {c.length ? <Bullets items={c} marker="−" color="#DC2626" /> : <div className="text-[10px] text-[var(--m12-text-muted)]">None</div>}
      </div>
    </div>
  )
}

// Coerce a value that SHOULD be a string[] into one (old rows may carry a blob).
function asBullets(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : v ? [String(v)] : []
}

function OverviewBody({ c }: { c: OverviewSectionContent }) {
  return (
    <div className="space-y-3">
      <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-4 space-y-3">
        <div className="text-sm font-semibold text-[#0891B2]">{c.headline}</div>
        <Block title="Talking points"><Bullets items={c.talkingPoints} color="#0891B2" /></Block>
        {c.facilitatorNotes && (
          <div className="pt-2 border-t border-[var(--m12-border)]/40">
            <Block title="Facilitator notes">
              <p className="text-[11px] text-[var(--m12-text-secondary)] leading-relaxed whitespace-pre-wrap">{c.facilitatorNotes}</p>
            </Block>
          </div>
        )}
      </div>
      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}

function WorkstreamBody({ c }: { c: WorkstreamSectionContent }) {
  const considerations = asBullets(c.overallConsiderations)
  const current = asBullets(c.currentState)
  const options = c.futureStateOptions || []
  const decisions = c.keyDecisions || []
  return (
    <div className="space-y-3">
      {(considerations.length > 0 || current.length > 0 || options.length > 0) && (
        <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-4 space-y-3">
          {considerations.length > 0 && (
            <Block title="Overall considerations" color="#2563EB"><Bullets items={considerations} color="#2563EB" /></Block>
          )}
          {current.length > 0 && (
            <div className={considerations.length > 0 ? 'pt-2 border-t border-[var(--m12-border)]/40' : ''}>
              <Block title="Current state" color="#0891B2"><Bullets items={current} color="#0891B2" /></Block>
            </div>
          )}
          {options.length > 0 && (
            <div className={considerations.length > 0 || current.length > 0 ? 'pt-2 border-t border-[var(--m12-border)]/40' : ''}>
              <Block title="Options for future state" color="#7C3AED">
                <div className="space-y-2.5">
                  {options.map((o, i) => (
                    <div key={i} className="border border-[var(--m12-border)]/40 rounded-lg p-2.5">
                      <div className="text-[11px] font-medium text-[var(--m12-text)]">{o.label}</div>
                      {o.summary && <p className="text-[10px] text-[var(--m12-text-muted)] leading-snug mt-0.5 mb-1.5">{o.summary}</p>}
                      <div className={o.summary ? '' : 'mt-1.5'}><ProsCons pros={o.pros || []} cons={o.cons || []} /></div>
                    </div>
                  ))}
                </div>
              </Block>
            </div>
          )}
        </div>
      )}
      {decisions.length > 0 && <div className="text-[10px] uppercase tracking-wide text-[var(--m12-text-muted)]">Key decisions</div>}
      {decisions.map((d, i) => <DecisionCard key={d.id || i} d={d} />)}
      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}

function DecisionCard({ d }: { d: KeyDecision }) {
  const rec = d.recommendedDecision || { recommendation: '', rationale: [] }
  const confMeta = rec.confidence ? CONFIDENCE_META[rec.confidence] : null
  const context = asBullets(d.context)
  const rationale = asBullets(rec.rationale)
  const leadingQuestions = d.leadingQuestions || []
  return (
    <div className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-4 space-y-3">
      <div>
        <div className="text-[12px] font-semibold text-[var(--m12-text)]">{d.title}</div>
        {context.length > 0 && <div className="mt-1.5"><Block title="Context"><Bullets items={context} /></Block></div>}
      </div>
      {leadingQuestions.length > 0 && <Block title="Leading questions" color="#D97706"><Bullets items={leadingQuestions} marker="?" color="#D97706" /></Block>}
      <div className="rounded-lg border border-[#2563EB]/40 bg-[#2563EB0F] p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-wide text-[#3B82F6]">Recommended decision</span>
          {confMeta && (
            <span className="text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ml-auto" style={{ backgroundColor: `${confMeta.color}1A`, color: confMeta.color }}>{confMeta.label}</span>
          )}
        </div>
        <div className="text-[12px] text-[var(--m12-text)] font-medium leading-snug">{rec.recommendation}</div>
        {rationale.length > 0 && <div className="mt-1.5"><Block title="Rationale" color="#3B82F6"><Bullets items={rationale} color="#3B82F6" /></Block></div>}
      </div>
      {d.diagram && (
        <div className="pt-1">
          <div className="text-[9px] uppercase tracking-wide text-[var(--m12-text-muted)] mb-1.5">Decision visual</div>
          <DiagramCard diagram={d.diagram} width={520} />
        </div>
      )}
    </div>
  )
}

function EvaluationBody({ c }: { c: EvaluationSectionContent }) {
  const divergences = c.divergences || []
  const rationale = asBullets(c.rationale)
  return (
    <div className="space-y-3">
      {divergences.length > 0 && (
        <div className="space-y-2">
          {divergences.map((dv, i) => (
            <div key={i} className="bg-[var(--m12-bg-card)] border border-[var(--m12-border)]/40 rounded-lg p-3">
              <div className="text-[12px] font-semibold text-[var(--m12-text)] mb-1.5">{dv.topic}</div>
              <div className="space-y-1 mb-2">
                {(dv.positions || []).map((p, j) => (
                  <div key={j} className="flex gap-2 text-[11px]">
                    <span className="text-[#7C3AED] font-medium shrink-0">{p.workstreamCode}</span>
                    <span className="text-[var(--m12-text-secondary)] leading-snug">{p.stance}</span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-[#D97706] leading-snug pt-1.5 border-t border-[var(--m12-border)]/40">
                <span className="uppercase tracking-wide">Tension:</span> {dv.tension}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-[#7C3AED]/40 bg-[#7C3AED0F] p-4 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#7C3AED] mb-1">Overall recommendation</div>
          <div className="text-[12px] text-[var(--m12-text)] font-medium leading-snug">{c.overallRecommendation}</div>
        </div>
        <ProsCons pros={c.pros || []} cons={c.cons || []} />
        {c.tradeoffs && c.tradeoffs.length > 0 && <Block title="Tradeoffs" color="#D97706"><Bullets items={c.tradeoffs} marker="⇄" color="#D97706" /></Block>}
        {rationale.length > 0 && (
          <div className="pt-2 border-t border-[var(--m12-border)]/40"><Block title="Rationale"><Bullets items={rationale} /></Block></div>
        )}
      </div>

      <DecisionCriteriaBody content={c} />
      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}

// The synthesized decision-criteria deliverable (from considerations, notes,
// decisions, and captures across the workshop). Rendered on the evaluation section.
export function DecisionCriteriaBody({ content }: { content: unknown }) {
  const { decisionCriteria, actions, nextSteps } = readSynthesis(content)
  if (decisionCriteria.length === 0 && actions.length === 0 && nextSteps.length === 0) return null
  const sorted = sortByPriority(decisionCriteria)
  return (
    <div className="rounded-lg border border-[#0891B2]/40 bg-[#0891B20D] p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-wide text-[#0891B2] font-semibold">Decision Criteria</div>
      {sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.map((d, i) => {
            const pm = d.priority ? PRIORITY_META[d.priority] : null
            return (
              <div key={i} className="border border-[var(--m12-border)]/40 rounded-lg p-2.5 bg-[var(--m12-bg-card)]">
                <div className="flex items-start gap-2">
                  <span className="text-[11px] text-[#0891B2] mt-0.5">◆</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[var(--m12-text)] leading-snug">{d.criterion}</span>
                      {pm && <span className="text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${pm.color}1A`, color: pm.color }}>{pm.label}</span>}
                    </div>
                    {d.rationale && <div className="text-[10px] text-[var(--m12-text-muted)] mt-0.5 leading-snug">{d.rationale}</div>}
                    {d.sources && d.sources.length > 0 && (
                      <div className="text-[9px] text-[var(--m12-text-faint)] mt-1">Informed by: {d.sources.join(', ')}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {actions.length > 0 && (
        <div className="pt-2 border-t border-[var(--m12-border)]/40">
          <div className="text-[10px] uppercase tracking-wide text-[#7C3AED] mb-1">Actions</div>
          <ul className="space-y-1">
            {actions.map((a, i) => (
              <li key={i} className="text-[11px] text-[var(--m12-text-secondary)] flex gap-2 leading-snug">
                <span className="text-[#7C3AED]">→</span>
                <span>{a.title}{a.owner ? `, ${a.owner}` : ''}{a.due ? ` (due ${a.due})` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nextSteps.length > 0 && (
        <div className="pt-2 border-t border-[var(--m12-border)]/40">
          <div className="text-[10px] uppercase tracking-wide text-[#059669] mb-1">Next steps</div>
          <ul className="space-y-1">
            {nextSteps.map((n, i) => (
              <li key={i} className="text-[11px] text-[var(--m12-text-secondary)] flex gap-2 leading-snug"><span className="text-[#059669]">▸</span><span>{n}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
