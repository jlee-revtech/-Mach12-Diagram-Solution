-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Capability review status (L3 "Done" tagging)
--   capabilities.status : review progress for a capability (primarily L3
--                         functionalities). Null = Not Started.
--                         Values in use: 'in_progress' | 'done'.
--
-- Drives the "Done" badge in the capability map UI and the "Status" column /
-- review-progress counts in the Excel export.
--
-- SAFE / NON-DESTRUCTIVE: add-column-if-not-exists (existing rows stay null).
-- ═══════════════════════════════════════════════════════════

alter table capabilities add column if not exists status text;
create index if not exists idx_capabilities_status on capabilities(status) where status is not null;
