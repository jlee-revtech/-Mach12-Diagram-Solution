-- ═══════════════════════════════════════════════════════════
-- Add dimensions JSONB column to capability inputs/outputs
-- Dimensions are the lower-level detail attributes of each
-- information product (the IP itself is the "data object").
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════

alter table capability_inputs add column if not exists dimensions jsonb default '[]';
alter table capability_outputs add column if not exists dimensions jsonb default '[]';
