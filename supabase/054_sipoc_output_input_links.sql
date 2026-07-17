-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — SIPOC output → input sequence links
--
-- Lets an Output of one process (L3 capability) be linked as an
-- Input of another process, across the same or a different SIPOC
-- map. This records intentional process sequence (e.g. the output
-- of "Income Statement Forecasting" feeds "Cash Flow Forecasting")
-- WITHOUT forcing the downstream process to re-enter all the
-- detailed suppliers/systems/dimensions that fed the upstream one.
--
-- Model: a capability_inputs row carries an optional pointer to the
-- upstream capability_outputs row it is fed by. The input reuses the
-- same information product as that output (the shared IP is the
-- handoff); the upstream PROCESS is the effective supplier.
--
-- on delete set null: if the upstream output is hard-deleted the
-- downstream input survives as a normal (unlinked) input on the
-- still-existing shared information product — we never cascade-delete
-- a downstream process's input just because an upstream row was removed.
--
-- SAFE / NON-DESTRUCTIVE: add-column-if-not-exists.
-- ═══════════════════════════════════════════════════════════

alter table capability_inputs
  add column if not exists source_output_id uuid
    references capability_outputs(id) on delete set null;

create index if not exists idx_capability_inputs_source_output
  on capability_inputs(source_output_id);
