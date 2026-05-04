-- ═══════════════════════════════════════════════════════════
-- Add tag_ids column to capability_outputs
--
-- Migration 014 (014_tags.sql) added tag_ids to capability_inputs
-- but missed capability_outputs. The app's updateOutputTags and the
-- addOutput usage-metadata rollup both PATCH this column, so without
-- it any output write that includes tag_ids fails with:
--   "Could not find the 'tag_ids' column of 'capability_outputs'
--    in the schema cache"
--
-- SAFE / NON-DESTRUCTIVE:
--   * add column if not exists  → defaults existing rows to '{}'
--   * no drop / rename / update / delete statements
--
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor).
-- ═══════════════════════════════════════════════════════════

alter table capability_outputs
  add column if not exists tag_ids uuid[] default '{}';
