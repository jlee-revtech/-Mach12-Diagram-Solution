-- ═══════════════════════════════════════════════════════════
-- Archive deliverables (soft-delete) so they can be hidden from the main list
-- and restored later, instead of only hard-deleted. Additive / non-destructive.
-- ═══════════════════════════════════════════════════════════

alter table deliverables add column if not exists archived_at timestamptz;

-- Partial index for the common "active only" listing.
create index if not exists idx_deliverables_active on deliverables(organization_id, created_at desc) where archived_at is null;
