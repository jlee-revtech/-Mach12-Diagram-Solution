-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Capability scoping + cross-org provenance
--
-- Two additions to cm_capabilities (the Capability Studio board):
--
--   1. SCOPE. Per-org assessment of whether a capability is in scope for that
--      organization's programme. In scope carries a priority (Required /
--      Preferred / Nice to Have). Out of scope carries a "planned for a future
--      phase" flag. Null scope = not yet assessed.
--
--   2. PROVENANCE. When the base capability library is copied from one org into
--      a client org, each copy remembers where it came from, so the client set
--      can be re-synced against the base later and drift is visible.
--
-- Scope is deliberately per-row (not a separate table): a capability row already
-- belongs to exactly one org, so the client org's copy IS the client's scope
-- record. The base library org simply leaves scope null.
--
-- SAFE / NON-DESTRUCTIVE: add-column-if-not-exists only. Every existing row
-- lands on scope = null (Not assessed) and no provenance.
-- ═══════════════════════════════════════════════════════════

alter table cm_capabilities add column if not exists scope text;
alter table cm_capabilities add column if not exists scope_priority text;
alter table cm_capabilities add column if not exists future_phase boolean not null default false;
alter table cm_capabilities add column if not exists scope_note text;
alter table cm_capabilities add column if not exists scope_decided_at timestamptz;
alter table cm_capabilities add column if not exists scope_decided_by uuid references profiles(id);

-- Provenance of a copied capability (base library -> client org).
alter table cm_capabilities add column if not exists source_capability_id uuid references cm_capabilities(id) on delete set null;
alter table cm_capabilities add column if not exists source_organization_id uuid references organizations(id) on delete set null;
alter table cm_capabilities add column if not exists copied_at timestamptz;

-- ─── Value-set + shape constraints ─────────────────────
-- Enforced here rather than in the UI alone so a stray API write cannot land
-- an in-scope row that is also "planned for a future phase".
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cm_capabilities_scope_values') then
    alter table cm_capabilities add constraint cm_capabilities_scope_values
      check (scope is null or scope in ('in', 'out'));
  end if;

  -- A priority only means something for an in-scope capability.
  if not exists (select 1 from pg_constraint where conname = 'cm_capabilities_scope_priority_values') then
    alter table cm_capabilities add constraint cm_capabilities_scope_priority_values
      check (
        scope_priority is null
        or (scope = 'in' and scope_priority in ('required', 'preferred', 'nice_to_have'))
      );
  end if;

  -- "Planned for a future phase" only means something for an out-of-scope one.
  if not exists (select 1 from pg_constraint where conname = 'cm_capabilities_future_phase_shape') then
    alter table cm_capabilities add constraint cm_capabilities_future_phase_shape
      check (future_phase is not true or scope = 'out');
  end if;
end $$;

-- ─── Indexes ───────────────────────────────────────────
-- Scope filtering and the roll-up counts on the board are per-org.
create index if not exists idx_cm_capabilities_org_scope
  on cm_capabilities(organization_id, scope);

-- Re-sync / drift lookups walk from a client row back to its base row.
create index if not exists idx_cm_capabilities_source_cap
  on cm_capabilities(source_capability_id)
  where source_capability_id is not null;

create index if not exists idx_cm_capabilities_source_org
  on cm_capabilities(source_organization_id)
  where source_organization_id is not null;
