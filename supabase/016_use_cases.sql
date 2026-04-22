-- ═══════════════════════════════════════════════════════════
-- Use Cases + Dependencies on Capabilities (L3 SIPOC)
--
-- SAFE / NON-DESTRUCTIVE:
--   * add column if not exists       → existing rows default to '{}'
-- ═══════════════════════════════════════════════════════════

alter table capabilities add column if not exists use_cases text[] default '{}';
alter table capabilities add column if not exists depends_on_capability_ids uuid[] default '{}';
