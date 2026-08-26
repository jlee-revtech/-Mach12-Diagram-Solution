-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Close the NULL hole in the capability scope constraints
--
-- Migrations 063 and 064 wrote their qualifier constraints as, e.g.
--
--   check (fit is null or (scope = 'in' and fit in ('standard','aricefw')))
--
-- A CHECK constraint only rejects a row when its expression evaluates to
-- FALSE. When `scope` IS NULL, `scope = 'in'` is NULL, so the whole expression
-- is NULL and the row is ACCEPTED. That let a not-yet-assessed capability carry
-- a priority, a fit, or a future-phase flag — states the UI can never produce
-- but a direct PostgREST write can.
--
-- `is not distinct from` is NULL-safe: it returns TRUE/FALSE and never NULL, so
-- a null scope now yields FALSE and the row is rejected as intended.
--
-- Existing data already satisfies the tightened form (every row is either fully
-- unassessed or has an explicit scope), so this is non-destructive.
-- ═══════════════════════════════════════════════════════════

alter table cm_capabilities drop constraint if exists cm_capabilities_scope_priority_values;
alter table cm_capabilities add constraint cm_capabilities_scope_priority_values
  check (
    scope_priority is null
    or (scope is not distinct from 'in' and scope_priority in ('required', 'preferred', 'nice_to_have'))
  );

alter table cm_capabilities drop constraint if exists cm_capabilities_future_phase_shape;
alter table cm_capabilities add constraint cm_capabilities_future_phase_shape
  check (future_phase is not true or scope is not distinct from 'out');

alter table cm_capabilities drop constraint if exists cm_capabilities_fit_values;
alter table cm_capabilities add constraint cm_capabilities_fit_values
  check (
    fit is null
    or (scope is not distinct from 'in' and fit in ('standard', 'aricefw'))
  );
