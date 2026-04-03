-- ═══════════════════════════════════════════════════════════
-- Add destination systems to capability outputs
-- Mirrors source_system_ids on inputs — ordered array of
-- logical system IDs showing the integration flow for where
-- output data is consumed/available.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════

alter table capability_outputs add column if not exists destination_system_ids jsonb default '[]';
