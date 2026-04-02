-- ═══════════════════════════════════════════════════════════
-- Add data_objects JSONB column to capability inputs/outputs
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════

alter table capability_inputs add column if not exists data_objects jsonb default '[]';
alter table capability_outputs add column if not exists data_objects jsonb default '[]';
