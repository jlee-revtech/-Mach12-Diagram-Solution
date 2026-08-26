// ─── Capability scoping ────────────────────────────────
// Per-organization assessment of a capability. Because each capability row
// belongs to exactly one org, the client org's copy of the base library IS the
// client's scope record — the base library org just leaves scope null.
//
//   scope = null   Not assessed yet
//   scope = 'in'   In scope, with a priority: Required | Preferred | Nice to Have
//                  and a fit: Standard | ARICEFW Required
//   scope = 'out'  Out of scope, optionally planned for a future phase

export type CapabilityScope = 'in' | 'out'
export type CapabilityScopePriority = 'required' | 'preferred' | 'nice_to_have'

// How an in-scope capability gets delivered. Orthogonal to priority: a Required
// capability can be standard, a Nice to Have can need an ARICEFW object.
//   standard  met by standard SAP configuration
//   aricefw   needs an Application / Report / Interface / Conversion /
//             Enhancement / Form / Workflow object — the gap
export type CapabilityFit = 'standard' | 'aricefw'

export const SCOPE_PRIORITIES: CapabilityScopePriority[] = ['required', 'preferred', 'nice_to_have']
export const FIT_TYPES: CapabilityFit[] = ['standard', 'aricefw']

export interface ScopeState {
  scope: CapabilityScope | null
  scope_priority: CapabilityScopePriority | null
  future_phase: boolean
  fit: CapabilityFit | null
}

// The flattened buckets the board filters and rolls up by. One capability is in
// exactly one bucket, which is what makes the counts add to the total.
export type ScopeBucket = 'required' | 'preferred' | 'nice_to_have' | 'future' | 'out' | 'unassessed'

export const SCOPE_BUCKETS: ScopeBucket[] = ['required', 'preferred', 'nice_to_have', 'future', 'out', 'unassessed']

export function scopeBucket(s: Pick<ScopeState, 'scope' | 'scope_priority' | 'future_phase'>): ScopeBucket {
  if (s.scope === 'in') return s.scope_priority ?? 'nice_to_have'
  if (s.scope === 'out') return s.future_phase ? 'future' : 'out'
  return 'unassessed'
}

export function priorityLabel(p: CapabilityScopePriority): string {
  return p === 'required' ? 'Required' : p === 'preferred' ? 'Preferred' : 'Nice to Have'
}

export function fitLabel(f: CapabilityFit): string {
  return f === 'standard' ? 'Standard' : 'ARICEFW Required'
}

// Standard is the quiet, expected answer; ARICEFW is the one that costs money,
// so it carries the warmer colour and is what the board badge surfaces.
export const FIT_COLORS: Record<CapabilityFit, { fg: string; bg: string; border: string }> = {
  standard: { fg: '#047857', bg: '#ECFDF5', border: '#6EE7B7' },
  aricefw:  { fg: '#C2410C', bg: '#FFF7ED', border: '#FDBA74' },
}

// Short label for a board chip / table cell.
export function bucketLabel(b: ScopeBucket): string {
  switch (b) {
    case 'required': return 'Required'
    case 'preferred': return 'Preferred'
    case 'nice_to_have': return 'Nice to Have'
    case 'future': return 'Future Phase'
    case 'out': return 'Out of Scope'
    default: return 'Not Assessed'
  }
}

// Long label for exports, where the in/out distinction has to survive on its own.
export function bucketExportLabel(b: ScopeBucket): string {
  switch (b) {
    case 'required': return 'In Scope — Required'
    case 'preferred': return 'In Scope — Preferred'
    case 'nice_to_have': return 'In Scope — Nice to Have'
    case 'future': return 'Out of Scope — Future Phase'
    case 'out': return 'Out of Scope'
    default: return 'Not Assessed'
  }
}

// Tailwind-free tokens so the same palette drives chips, badges and xlsx fills.
// Required reads as the strongest commitment and shades down from there;
// out-of-scope is grey, future phase keeps a hint of colour because it is a
// deferral rather than a rejection.
export const BUCKET_COLORS: Record<ScopeBucket, { fg: string; bg: string; border: string }> = {
  required:     { fg: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5' },
  preferred:    { fg: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
  nice_to_have: { fg: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' },
  future:       { fg: '#6D28D9', bg: '#F5F3FF', border: '#C4B5FD' },
  out:          { fg: '#475569', bg: '#F8FAFC', border: '#CBD5E1' },
  unassessed:   { fg: '#94A3B8', bg: '#FFFFFF', border: '#E2E8F0' },
}

// Normalize a scope edit so the shape constraints in migration 063 always hold:
// a priority only survives on an in-scope row, future_phase only on an out one.
export function normalizeScope(next: Partial<ScopeState>, prev: ScopeState): ScopeState {
  const scope = next.scope !== undefined ? next.scope : prev.scope
  if (scope === 'in') {
    const p = next.scope_priority !== undefined ? next.scope_priority : prev.scope_priority
    const fit = next.fit !== undefined ? next.fit : prev.fit
    // Priority defaults so an in-scope row is never priority-less; fit does NOT
    // default — an unset fit means "not yet decided", and guessing 'standard'
    // would silently hide a gap.
    return { scope: 'in', scope_priority: p ?? 'required', future_phase: false, fit: fit ?? null }
  }
  if (scope === 'out') {
    const f = next.future_phase !== undefined ? next.future_phase : prev.future_phase
    return { scope: 'out', scope_priority: null, future_phase: !!f, fit: null }
  }
  return { scope: null, scope_priority: null, future_phase: false, fit: null }
}
