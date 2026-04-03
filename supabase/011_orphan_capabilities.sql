-- ═══════════════════════════════════════════════════════════
-- Fix: Allow orphaned capabilities instead of cascading deletes
-- Changes parent_id FK from ON DELETE CASCADE to ON DELETE SET NULL
-- so that deleting a parent preserves children as unassigned orphans.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- Drop the existing CASCADE constraint and re-add as SET NULL
alter table capabilities
  drop constraint if exists capabilities_parent_id_fkey;

alter table capabilities
  add constraint capabilities_parent_id_fkey
  foreign key (parent_id) references capabilities(id)
  on delete set null;
