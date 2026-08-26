-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Capability fit (Standard vs ARICEFW Required)
--
-- A third scoping dimension on cm_capabilities, orthogonal to priority:
-- once a capability is IN SCOPE, is it delivered by standard SAP, or does it
-- need an ARICEFW object (Application / Report / Interface / Conversion /
-- Enhancement / Form / Workflow)?
--
--   fit = 'standard'   Met by standard configuration
--   fit = 'aricefw'    Needs custom development — this is the gap
--   fit = null         In scope, fit not yet decided
--
-- Deliberately NOT defaulted to 'standard'. An unset fit reads as "we have not
-- looked at this yet"; a wrong 'standard' hides a gap, which is the expensive
-- direction to be wrong in on a fixed-fee estimate.
--
-- Out-of-scope and not-assessed capabilities carry no fit at all — enforced by
-- the check constraint below, mirroring how migration 063 gates scope_priority.
--
-- SAFE / NON-DESTRUCTIVE: add-column-if-not-exists only.
-- ═══════════════════════════════════════════════════════════

alter table cm_capabilities add column if not exists fit text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cm_capabilities_fit_values') then
    alter table cm_capabilities add constraint cm_capabilities_fit_values
      check (
        fit is null
        or (scope = 'in' and fit in ('standard', 'aricefw'))
      );
  end if;
end $$;

-- Fit roll-ups ("how many in-scope capabilities need ARICEFW?") are per-org.
create index if not exists idx_cm_capabilities_org_fit
  on cm_capabilities(organization_id, fit)
  where fit is not null;
