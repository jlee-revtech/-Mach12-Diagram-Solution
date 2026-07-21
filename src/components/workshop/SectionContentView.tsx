'use client'

// Read-only render of a section's content, shared by the prep editor's read view
// and the public share page. Renders per kind (overview / workstream / evaluation),
// the section diagrams, the "Notes & Considerations" block, and — for the
// evaluation section — the synthesized Decision Criteria, Actions, and Next Steps.
//
// When `anchorBase` is supplied (the agenda item id), every bullet and entity gets a
// CommentAnchor so reviewers on the public share link can comment in place. Without
// a CommentsProvider, CommentAnchor renders nothing, so the prep view is unchanged.

import type { ReactNode } from 'react'
import type {
  SectionContent, OverviewSectionContent, WorkstreamSectionContent,
  EvaluationSectionContent, AssessmentSectionContent, RoadmapSectionContent,
  KeyDecision, OpportunityItem, WorkshopDiagram,
} from '@jlee-revtech/agent-core'
import { CONFIDENCE_META, LEVEL_META } from './sectionMeta'
import { DiagramCard } from './DiagramView'
import CommentAnchor from './CommentAnchor'
import { normalizeSectionContent, sectionNotes } from '@/lib/workshop/deck'
import { readSynthesis, sortByPriority, PRIORITY_META } from '@/lib/workshop/decisionCriteria'

// Public entry: normalize (so old-shape rows never throw), then render the body +
// the notes block.
export default function SectionContentView({ content, anchorBase }: { content: SectionContent; anchorBase?: string }) {
  return (
    <>
      <ContentBody content={normalizeSectionContent(content)} base={anchorBase} />
      <NotesReadBlock notes={sectionNotes(content)} base={anchorBase} />
    </>
  )
}

// Build a child anchor path, or undefined when commenting is not in play.
const at = (base: string | undefined, path: string) => (base ? `${base}:${path}` : undefined)

export function NotesReadBlock({ notes, base }: { notes: string[]; base?: string }) {
  if (!notes || notes.length === 0) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
      <div className="text-[10px] uppercase tracking-wide text-amber-700 mb-1.5">Notes & Considerations</div>
      <Bullets items={notes} marker="▸" color="#D97706" anchorPrefix={at(base, 'notes')} />
    </div>
  )
}

function ContentBody({ content, base }: { content: SectionContent; base?: string }) {
  if (content.kind === 'overview') return <OverviewBody c={content} base={base} />
  if (content.kind === 'workstream') return <WorkstreamBody c={content} base={base} />
  if (content.kind === 'assessment') return <AssessmentBody c={content} base={base} />
  if (content.kind === 'roadmap') return <RoadmapBody c={content} base={base} />
  return <EvaluationBody c={content} base={base} />
}

function SectionDiagrams({ diagrams }: { diagrams?: WorkshopDiagram[] }) {
  if (!diagrams || diagrams.length === 0) return null
  return <div className="space-y-3">{diagrams.map((d, i) => <DiagramCard key={i} diagram={d} width={560} />)}</div>
}

function Block({ title, color, children }: { title: string; color?: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide mb-1 text-text-tertiary" style={color ? { color } : undefined}>{title}</div>
      {children}
    </div>
  )
}

function Bullets({ items, marker, color, anchorPrefix }: { items: string[]; marker?: string; color?: string; anchorPrefix?: string }) {
  return (
    <ul className="space-y-1">
      {items.map((t, i) => (
        <li key={i} className="group text-[11px] text-text-secondary flex gap-2 leading-snug">
          <span style={{ color: color || '#2563EB' }}>{marker || '•'}</span>
          <span className="flex-1">{t}</span>
          {anchorPrefix && <CommentAnchor anchor={`${anchorPrefix}:${i}`} label={t} />}
        </li>
      ))}
    </ul>
  )
}

function ProsCons({ pros, cons, anchorPros, anchorCons }: { pros: string[]; cons: string[]; anchorPros?: string; anchorCons?: string }) {
  const p = pros || [], c = cons || []
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-status-green mb-1">Pros</div>
        {p.length ? <Bullets items={p} marker="+" color="#059669" anchorPrefix={anchorPros} /> : <div className="text-[10px] text-text-tertiary">None</div>}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-status-red mb-1">Cons</div>
        {c.length ? <Bullets items={c} marker="−" color="#DC2626" anchorPrefix={anchorCons} /> : <div className="text-[10px] text-text-tertiary">None</div>}
      </div>
    </div>
  )
}

// Coerce a value that SHOULD be a string[] into one (old rows may carry a blob).
function asBullets(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : v ? [String(v)] : []
}

function OverviewBody({ c, base }: { c: OverviewSectionContent; base?: string }) {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-border rounded-lg shadow-card p-4 space-y-3">
        <div className="group flex items-start gap-1 text-body-md font-semibold text-[#0891B2]">
          <span className="flex-1">{c.headline}</span>
          {base && <CommentAnchor anchor={at(base, 'headline')!} label={c.headline} />}
        </div>
        <Block title="Talking points"><Bullets items={c.talkingPoints} color="#0891B2" anchorPrefix={at(base, 'talkingPoints')} /></Block>
        {c.facilitatorNotes && (
          <div className="pt-2 border-t border-border">
            <Block title="Facilitator notes">
              <p className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap">{c.facilitatorNotes}</p>
            </Block>
          </div>
        )}
      </div>
      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}

function WorkstreamBody({ c, base }: { c: WorkstreamSectionContent; base?: string }) {
  const considerations = asBullets(c.overallConsiderations)
  const current = asBullets(c.currentState)
  const options = c.futureStateOptions || []
  const decisions = c.keyDecisions || []
  return (
    <div className="space-y-3">
      {(considerations.length > 0 || current.length > 0 || options.length > 0) && (
        <div className="bg-white border border-border rounded-lg shadow-card p-4 space-y-3">
          {considerations.length > 0 && (
            <Block title="Overall considerations" color="#2563EB"><Bullets items={considerations} color="#2563EB" anchorPrefix={at(base, 'overallConsiderations')} /></Block>
          )}
          {current.length > 0 && (
            <div className={considerations.length > 0 ? 'pt-2 border-t border-border' : ''}>
              <Block title="Current state" color="#0891B2"><Bullets items={current} color="#0891B2" anchorPrefix={at(base, 'currentState')} /></Block>
            </div>
          )}
          {options.length > 0 && (
            <div className={considerations.length > 0 || current.length > 0 ? 'pt-2 border-t border-border' : ''}>
              <Block title="Options for future state" color="#7C3AED">
                <div className="space-y-2.5">
                  {options.map((o, i) => (
                    <div key={i} className="group border border-border rounded-lg p-2.5">
                      <div className="flex items-start gap-1">
                        <span className="flex-1 text-[11px] font-medium text-text-primary">{o.label}</span>
                        {base && <CommentAnchor anchor={at(base, `futureStateOptions:${i}`)!} label={o.label} />}
                      </div>
                      {o.summary && <p className="text-[10px] text-text-tertiary leading-snug mt-0.5 mb-1.5">{o.summary}</p>}
                      <div className={o.summary ? '' : 'mt-1.5'}>
                        <ProsCons pros={o.pros || []} cons={o.cons || []} anchorPros={at(base, `futureStateOptions:${i}:pros`)} anchorCons={at(base, `futureStateOptions:${i}:cons`)} />
                      </div>
                    </div>
                  ))}
                </div>
              </Block>
            </div>
          )}
        </div>
      )}
      {decisions.length > 0 && <div className="text-[10px] uppercase tracking-wide text-text-tertiary">Key decisions</div>}
      {decisions.map((d, i) => <DecisionCard key={d.id || i} d={d} base={base} idx={i} />)}
      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}

function DecisionCard({ d, base, idx }: { d: KeyDecision; base?: string; idx: number }) {
  const rec = d.recommendedDecision || { recommendation: '', rationale: [] }
  const confMeta = rec.confidence ? CONFIDENCE_META[rec.confidence] : null
  const context = asBullets(d.context)
  const rationale = asBullets(rec.rationale)
  const leadingQuestions = d.leadingQuestions || []
  const dBase = at(base, `keyDecisions:${idx}`)
  return (
    <div className="bg-white border border-border rounded-lg shadow-card p-4 space-y-3">
      <div>
        <div className="group flex items-start gap-1">
          <span className="flex-1 text-[12px] font-semibold text-text-primary">{d.title}</span>
          {dBase && <CommentAnchor anchor={dBase} label={d.title} />}
        </div>
        {context.length > 0 && <div className="mt-1.5"><Block title="Context"><Bullets items={context} anchorPrefix={at(dBase, 'context')} /></Block></div>}
      </div>
      {leadingQuestions.length > 0 && <Block title="Leading questions" color="#D97706"><Bullets items={leadingQuestions} marker="?" color="#D97706" anchorPrefix={at(dBase, 'leadingQuestions')} /></Block>}
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-wide text-brand-600">Recommended decision</span>
          {confMeta && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ml-auto" style={{ backgroundColor: `${confMeta.color}1A`, color: confMeta.color }}>{confMeta.label}</span>
          )}
        </div>
        <div className="group flex items-start gap-1">
          <span className="flex-1 text-[12px] text-text-primary font-medium leading-snug">{rec.recommendation}</span>
          {dBase && <CommentAnchor anchor={at(dBase, 'recommendation')!} label={rec.recommendation} />}
        </div>
        {rationale.length > 0 && <div className="mt-1.5"><Block title="Rationale" color="#3B82F6"><Bullets items={rationale} color="#3B82F6" anchorPrefix={at(dBase, 'rationale')} /></Block></div>}
      </div>
      {d.diagram && (
        <div className="pt-1">
          <div className="text-[10px] uppercase tracking-wide text-text-tertiary mb-1.5">Decision visual</div>
          <DiagramCard diagram={d.diagram} width={520} />
        </div>
      )}
    </div>
  )
}

// ─── Assessment / Discovery (056) ────────────────────────────────────────────

function OpportunityCard({ o, base }: { o: OpportunityItem; base?: string }) {
  const impact = o.impact ? LEVEL_META[o.impact] : null
  const effort = o.effort ? LEVEL_META[o.effort] : null
  return (
    <div className="group border border-border rounded-lg p-2.5">
      <div className="flex items-start gap-1.5">
        <span className="flex-1 text-[11px] font-medium text-text-primary leading-snug">{o.title}</span>
        {impact && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${impact.color}1A`, color: impact.color }}>Impact {impact.label}</span>}
        {effort && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${effort.color}1A`, color: effort.color }}>Effort {effort.label}</span>}
        {base && <CommentAnchor anchor={base} label={o.title} />}
      </div>
      {o.summary && <p className="text-[10px] text-text-tertiary leading-snug mt-0.5">{o.summary}</p>}
      {(o.painPoints || []).length > 0 && (
        <div className="mt-1.5">
          <div className="text-[10px] uppercase tracking-wide text-amber-700 mb-0.5">Addresses</div>
          <Bullets items={o.painPoints} marker="▸" color="#D97706" anchorPrefix={base ? `${base}:painPoints` : undefined} />
        </div>
      )}
    </div>
  )
}

function OpportunityGroup({ title, color, items, base }: { title: string; color: string; items: OpportunityItem[]; base?: string }) {
  if (!items?.length) return null
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color }}>{title}</div>
      <div className="space-y-2">
        {items.map((o, i) => <OpportunityCard key={o.id || i} o={o} base={base ? `${base}:${i}` : undefined} />)}
      </div>
    </div>
  )
}

function AssessmentBody({ c, base }: { c: AssessmentSectionContent; base?: string }) {
  const framing = asBullets(c.framing)
  const assessQ = asBullets(c.assessmentQuestions)
  const discQ = asBullets(c.discoveryQuestions)
  const hasOpps = (c.processOpportunities?.length || 0) + (c.dataOpportunities?.length || 0) + (c.technologyOpportunities?.length || 0) > 0
  return (
    <div className="space-y-3">
      {(framing.length > 0 || assessQ.length > 0 || discQ.length > 0) && (
        <div className="bg-white border border-border rounded-lg shadow-card p-4 space-y-3">
          {framing.length > 0 && (
            <Block title="What we are assessing" color="#059669"><Bullets items={framing} color="#059669" anchorPrefix={at(base, 'framing')} /></Block>
          )}
          {assessQ.length > 0 && (
            <div className={framing.length > 0 ? 'pt-2 border-t border-border' : ''}>
              <Block title="Assessment questions" color="#2563EB"><Bullets items={assessQ} marker="?" color="#2563EB" anchorPrefix={at(base, 'assessmentQuestions')} /></Block>
            </div>
          )}
          {discQ.length > 0 && (
            <div className={framing.length > 0 || assessQ.length > 0 ? 'pt-2 border-t border-border' : ''}>
              <Block title="Discovery questions" color="#D97706"><Bullets items={discQ} marker="?" color="#D97706" anchorPrefix={at(base, 'discoveryQuestions')} /></Block>
            </div>
          )}
        </div>
      )}
      {hasOpps && (
        <div className="bg-white border border-border rounded-lg shadow-card p-4 space-y-3">
          <div className="text-[10px] uppercase tracking-wide text-text-tertiary">Candidate opportunities to validate in the room</div>
          <OpportunityGroup title="Process opportunities" color="#2563EB" items={c.processOpportunities || []} base={at(base, 'processOpportunities')} />
          <OpportunityGroup title="Data opportunities" color="#0891B2" items={c.dataOpportunities || []} base={at(base, 'dataOpportunities')} />
          <OpportunityGroup title="Technology opportunities" color="#7C3AED" items={c.technologyOpportunities || []} base={at(base, 'technologyOpportunities')} />
        </div>
      )}
      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}

function RoadmapBody({ c, base }: { c: RoadmapSectionContent; base?: string }) {
  const quickWins = asBullets(c.quickWins)
  const risks = asBullets(c.risks)
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#D97706]/40 bg-[#D97706]/5 p-4 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#D97706] mb-1">Opportunity roadmap</div>
          <div className="group flex items-start gap-1">
            <span className="flex-1 text-[12px] text-text-primary font-medium leading-snug">{c.summary}</span>
            {base && <CommentAnchor anchor={at(base, 'summary')!} label={c.summary} />}
          </div>
        </div>
        {quickWins.length > 0 && (
          <Block title="Quick wins" color="#059669"><Bullets items={quickWins} marker="★" color="#059669" anchorPrefix={at(base, 'quickWins')} /></Block>
        )}
        {risks.length > 0 && (
          <Block title="Sequencing risks" color="#DC2626"><Bullets items={risks} marker="⚠" color="#DC2626" anchorPrefix={at(base, 'risks')} /></Block>
        )}
      </div>

      {(c.phases || []).length > 0 && (
        <div className="space-y-2">
          {(c.phases || []).map((p, i) => (
            <div key={i} className="bg-white border border-border rounded-lg shadow-card p-3">
              <div className="group flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold text-white bg-[#D97706] rounded-full w-5 h-5 flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="flex-1 text-[12px] font-semibold text-text-primary">{p.name}{p.timeframe ? ` (${p.timeframe})` : ''}</span>
                {base && <CommentAnchor anchor={at(base, `phases:${i}`)!} label={p.name} />}
              </div>
              {(p.opportunities || []).length > 0 && (
                <div className="mb-1.5"><Bullets items={p.opportunities} marker="▸" color="#D97706" anchorPrefix={at(base, `phases:${i}:opportunities`)} /></div>
              )}
              {(p.rationale || []).length > 0 && (
                <div className="pt-1.5 border-t border-border">
                  <Block title="Why now"><Bullets items={asBullets(p.rationale)} anchorPrefix={at(base, `phases:${i}:rationale`)} /></Block>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(c.dependencies || []).length > 0 && (
        <div className="bg-white border border-border rounded-lg shadow-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-text-tertiary mb-1.5">Sequencing dependencies</div>
          <ul className="space-y-1">
            {(c.dependencies || []).map((d, i) => (
              <li key={i} className="group text-[11px] text-text-secondary flex gap-2 leading-snug">
                <span className="text-[#D97706]">⇢</span>
                <span className="flex-1"><span className="font-medium text-text-primary">{d.dependent}</span> needs <span className="font-medium text-text-primary">{d.prerequisite}</span> first: {d.reason}</span>
                {base && <CommentAnchor anchor={at(base, `dependencies:${i}`)!} label={`${d.dependent} needs ${d.prerequisite}`} />}
              </li>
            ))}
          </ul>
        </div>
      )}

      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}

function EvaluationBody({ c, base }: { c: EvaluationSectionContent; base?: string }) {
  const divergences = c.divergences || []
  const rationale = asBullets(c.rationale)
  return (
    <div className="space-y-3">
      {divergences.length > 0 && (
        <div className="space-y-2">
          {divergences.map((dv, i) => (
            <div key={i} className="bg-white border border-border rounded-lg shadow-card p-3">
              <div className="group flex items-start gap-1 mb-1.5">
                <span className="flex-1 text-[12px] font-semibold text-text-primary">{dv.topic}</span>
                {base && <CommentAnchor anchor={at(base, `divergences:${i}`)!} label={dv.topic} />}
              </div>
              <div className="space-y-1 mb-2">
                {(dv.positions || []).map((p, j) => (
                  <div key={j} className="flex gap-2 text-[11px]">
                    <span className="text-[#7C3AED] font-medium shrink-0 font-mono">{p.workstreamCode}</span>
                    <span className="text-text-secondary leading-snug">{p.stance}</span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-amber-700 leading-snug pt-1.5 border-t border-border">
                <span className="uppercase tracking-wide">Tension:</span> {dv.tension}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-[#7C3AED]/40 bg-[#7C3AED]/5 p-4 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#7C3AED] mb-1">Overall recommendation</div>
          <div className="group flex items-start gap-1">
            <span className="flex-1 text-[12px] text-text-primary font-medium leading-snug">{c.overallRecommendation}</span>
            {base && <CommentAnchor anchor={at(base, 'overallRecommendation')!} label={c.overallRecommendation} />}
          </div>
        </div>
        <ProsCons pros={c.pros || []} cons={c.cons || []} anchorPros={at(base, 'pros')} anchorCons={at(base, 'cons')} />
        {c.tradeoffs && c.tradeoffs.length > 0 && <Block title="Tradeoffs" color="#D97706"><Bullets items={c.tradeoffs} marker="⇄" color="#D97706" anchorPrefix={at(base, 'tradeoffs')} /></Block>}
        {rationale.length > 0 && (
          <div className="pt-2 border-t border-border"><Block title="Rationale"><Bullets items={rationale} anchorPrefix={at(base, 'rationale')} /></Block></div>
        )}
      </div>

      <DecisionCriteriaBody content={c} base={base} />
      <SectionDiagrams diagrams={c.diagrams} />
    </div>
  )
}

// The synthesized decision-criteria deliverable (from considerations, notes,
// decisions, and captures across the workshop). Rendered on the evaluation section.
export function DecisionCriteriaBody({ content, base }: { content: unknown; base?: string }) {
  const { recommendedDecision, decisionCriteria, actions, nextSteps } = readSynthesis(content)
  if (recommendedDecision.length === 0 && decisionCriteria.length === 0 && actions.length === 0 && nextSteps.length === 0) return null
  const sorted = sortByPriority(decisionCriteria)
  return (
    <div className="rounded-lg border border-[#0891B2]/40 bg-[#0891B2]/5 p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-wide text-[#0891B2] font-semibold">Decision Criteria</div>
      {recommendedDecision.length > 0 && (
        <div className="rounded-lg border border-[#0891B2]/50 bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-[#0891B2] mb-1.5">Recommended decision</div>
          <Bullets items={recommendedDecision} color="#0891B2" anchorPrefix={at(base, 'recommendedDecision')} />
        </div>
      )}
      {sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.map((d, i) => {
            const pm = d.priority ? PRIORITY_META[d.priority] : null
            return (
              <div key={i} className="group border border-border rounded-lg p-2.5 bg-white">
                <div className="flex items-start gap-2">
                  <span className="text-[11px] text-[#0891B2] mt-0.5">◆</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-text-primary leading-snug">{d.criterion}</span>
                      {pm && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${pm.color}1A`, color: pm.color }}>{pm.label}</span>}
                      {base && <CommentAnchor anchor={at(base, `decisionCriteria:${i}`)!} label={d.criterion} />}
                    </div>
                    {d.rationale && <div className="text-[10px] text-text-tertiary mt-0.5 leading-snug">{d.rationale}</div>}
                    {d.sources && d.sources.length > 0 && (
                      <div className="text-[10px] text-text-tertiary mt-1">Informed by: {d.sources.join(', ')}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {actions.length > 0 && (
        <div className="pt-2 border-t border-border">
          <div className="text-[10px] uppercase tracking-wide text-[#7C3AED] mb-1">Actions</div>
          <ul className="space-y-1">
            {actions.map((a, i) => (
              <li key={i} className="group text-[11px] text-text-secondary flex gap-2 leading-snug">
                <span className="text-[#7C3AED]">→</span>
                <span className="flex-1">{a.title}{a.owner ? `, ${a.owner}` : ''}{a.due ? ` (due ${a.due})` : ''}</span>
                {base && <CommentAnchor anchor={at(base, `actions:${i}`)!} label={a.title} />}
              </li>
            ))}
          </ul>
        </div>
      )}

      {nextSteps.length > 0 && (
        <div className="pt-2 border-t border-border">
          <div className="text-[10px] uppercase tracking-wide text-status-green mb-1">Next steps</div>
          <Bullets items={nextSteps} marker="▸" color="#059669" anchorPrefix={at(base, 'nextSteps')} />
        </div>
      )}
    </div>
  )
}
