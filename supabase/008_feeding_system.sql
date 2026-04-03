-- ═══════════════════════════════════════════════════════════
-- Add feeding_system_id to capability_inputs
-- The feeding system is the single system that delivers the
-- information product to the L3 BPML process, separate from
-- the upstream source system flow.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════

alter table capability_inputs add column if not exists feeding_system_id uuid references logical_systems(id) default null;
