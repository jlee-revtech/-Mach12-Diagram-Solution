-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — 036: multiple value streams (workstreams) per logical bedrock system
--
-- A logical bedrock system can now be aligned to MORE THAN ONE value stream.
-- We add workstream_ids uuid[] holding the full set. The existing single
-- workstream_id column is retained as the PRIMARY value stream (the first of
-- the set) so the workstream-banded integration layout still places each
-- system in exactly one band.
--
-- No FK is added on the array (Postgres does not support element FKs); the
-- column lives on bedrock_systems which already carries org-scoped RLS, so no
-- new policy is required.
--
-- SAFE / NON-DESTRUCTIVE: add-column-if-not-exists + idempotent backfill.
-- ═══════════════════════════════════════════════════════════

alter table bedrock_systems
  add column if not exists workstream_ids uuid[] not null default '{}';

-- Backfill the array from the existing single assignment (idempotent: only
-- when the array is still empty and a single value stream was set).
update bedrock_systems
   set workstream_ids = array[workstream_id]
 where workstream_id is not null
   and (workstream_ids is null or workstream_ids = '{}'::uuid[]);
