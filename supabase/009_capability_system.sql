-- ═══════════════════════════════════════════════════════════
-- Add system_id to capabilities
-- Specifies which system the L3 capability is performed in.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════

alter table capabilities add column if not exists system_id uuid references logical_systems(id) default null;
