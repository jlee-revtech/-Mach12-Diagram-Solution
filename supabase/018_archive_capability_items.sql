-- ═══════════════════════════════════════════════════════════
-- Archive support for capability inputs / outputs.
-- Archived rows stay in the DB with all detail (dimensions,
-- suppliers, systems, feeding system, tags) — just hidden from
-- the active list. "Unassign from L3" = set archived_at.
--
-- SAFE / NON-DESTRUCTIVE:
--   * add column if not exists (default null = active)
-- ═══════════════════════════════════════════════════════════

alter table capability_inputs  add column if not exists archived_at timestamptz;
alter table capability_outputs add column if not exists archived_at timestamptz;

create index if not exists idx_capability_inputs_archived  on capability_inputs  (capability_id, archived_at);
create index if not exists idx_capability_outputs_archived on capability_outputs (capability_id, archived_at);
