'use client'

import {
  scopeBucket, bucketLabel, priorityLabel, fitLabel, BUCKET_COLORS, FIT_COLORS,
  SCOPE_PRIORITIES, FIT_TYPES, type ScopeBucket, type ScopeState,
} from '@/lib/capmap/scope'

// ─── Capability scoping controls ───────────────────────
// One capability sits in exactly one bucket:
//
//   In scope     -> Required | Preferred | Nice to Have
//                   plus a fit: Standard | ARICEFW Required
//   Out of scope -> optionally "planned for a future phase"
//   Not assessed (the default for a freshly copied capability)
//
// `CapabilityScopeBadge` is the read-only chip used on board cards, pivot
// columns and the share view. `CapabilityScopeControl` is the editor in the
// capability drawer.

export function CapabilityScopeBadge({ state, size = 'sm' }: { state: ScopeState; size?: 'xs' | 'sm' }) {
  const bucket = scopeBucket(state)
  if (bucket === 'unassessed') return null
  const c = BUCKET_COLORS[bucket]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-medium ${size === 'xs' ? 'text-[9px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5'}`}
      style={{ color: c.fg, background: c.bg, borderColor: c.border }}
      title={bucket === 'future' ? 'Out of scope — planned for a future phase' : undefined}
    >
      {bucket === 'required' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.fg }} />}
      {bucketLabel(bucket)}
    </span>
  )
}

// Only ARICEFW renders. An in-scope capability is standard far more often than
// not, so badging every standard one would be noise; the gap is the signal.
export function CapabilityFitBadge({ state, size = 'sm' }: { state: ScopeState; size?: 'xs' | 'sm' }) {
  if (state.scope !== 'in' || state.fit !== 'aricefw') return null
  const c = FIT_COLORS.aricefw
  return (
    <span
      className={`inline-flex items-center rounded border font-medium ${size === 'xs' ? 'text-[9px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5'}`}
      style={{ color: c.fg, background: c.bg, borderColor: c.border }}
      title="Needs an ARICEFW object — Application, Report, Interface, Conversion, Enhancement, Form or Workflow"
    >
      ARICEFW
    </span>
  )
}

export default function CapabilityScopeControl({
  state, onChange, disabled,
}: {
  state: ScopeState
  onChange: (next: Partial<ScopeState>) => void
  disabled?: boolean
}) {
  const bucket = scopeBucket(state)
  const btn = (active: boolean, b: ScopeBucket) => {
    const c = BUCKET_COLORS[b]
    return {
      className: `flex-1 rounded-lg border px-2.5 py-1.5 text-body-sm font-medium transition-colors disabled:opacity-50 ${active ? '' : 'border-border text-text-secondary hover:bg-surface-muted'}`,
      style: active ? { color: c.fg, background: c.bg, borderColor: c.border } : undefined,
    }
  }

  return (
    <div className="space-y-2.5">
      {/* In / Out / Not assessed */}
      <div className="flex gap-1.5">
        <button
          type="button" disabled={disabled}
          onClick={() => onChange({ scope: 'in' })}
          {...btn(state.scope === 'in', state.scope === 'in' ? bucket : 'required')}
        >
          In Scope
        </button>
        <button
          type="button" disabled={disabled}
          onClick={() => onChange({ scope: 'out' })}
          {...btn(state.scope === 'out', state.scope === 'out' ? bucket : 'out')}
        >
          Out of Scope
        </button>
        <button
          type="button" disabled={disabled}
          onClick={() => onChange({ scope: null })}
          {...btn(state.scope === null, 'unassessed')}
          title="Clear the scope decision"
        >
          Not Assessed
        </button>
      </div>

      {/* In scope -> priority */}
      {state.scope === 'in' && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-text-tertiary mb-1.5">Priority</div>
          <div className="flex gap-1.5">
            {SCOPE_PRIORITIES.map(p => {
              const active = state.scope_priority === p
              const c = BUCKET_COLORS[p]
              return (
                <button
                  key={p} type="button" disabled={disabled}
                  onClick={() => onChange({ scope_priority: p })}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${active ? '' : 'border-border text-text-secondary hover:bg-surface-muted'}`}
                  style={active ? { color: c.fg, background: c.bg, borderColor: c.border } : undefined}
                >
                  {priorityLabel(p)}
                </button>
              )
            })}
          </div>

          {/* Fit — orthogonal to priority. Left unset until decided rather than
              defaulted to Standard, which would quietly hide a gap. */}
          <div className="mt-2.5">
            <div className="text-[10px] uppercase tracking-wider font-mono text-text-tertiary mb-1.5">Fit</div>
            <div className="flex gap-1.5">
              {FIT_TYPES.map(f => {
                const active = state.fit === f
                const c = FIT_COLORS[f]
                return (
                  <button
                    key={f} type="button" disabled={disabled}
                    onClick={() => onChange({ fit: active ? null : f })}
                    title={f === 'aricefw'
                      ? 'Needs an Application, Report, Interface, Conversion, Enhancement, Form or Workflow object'
                      : 'Met by standard SAP configuration'}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${active ? '' : 'border-border text-text-secondary hover:bg-surface-muted'}`}
                    style={active ? { color: c.fg, background: c.bg, borderColor: c.border } : undefined}
                  >
                    {fitLabel(f)}
                  </button>
                )
              })}
            </div>
            {!state.fit && (
              <div className="text-[10px] text-text-tertiary mt-1">Not yet decided.</div>
            )}
          </div>
        </div>
      )}

      {/* Out of scope -> future phase */}
      {state.scope === 'out' && (
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox" disabled={disabled}
            checked={state.future_phase}
            onChange={e => onChange({ future_phase: e.target.checked })}
            className="mt-0.5 accent-brand-500"
          />
          <span className="text-body-sm text-text-primary">
            Planned for a future phase
            <span className="block text-[10px] text-text-tertiary mt-0.5">
              Out of scope now, but on the roadmap — reported separately from a hard exclusion.
            </span>
          </span>
        </label>
      )}
    </div>
  )
}
