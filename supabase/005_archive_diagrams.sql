-- ═══════════════════════════════════════════════════════════
-- Archive support for diagrams (soft delete)
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

alter table diagrams add column if not exists archived_at timestamptz default null;

create index if not exists idx_diagrams_archived on diagrams(archived_at);
