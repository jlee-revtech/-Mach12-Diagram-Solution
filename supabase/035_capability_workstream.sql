-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Align capabilities to value streams (workstreams)
--   cm_capabilities.workstream_id : the value stream (workstream) a capability
--                                   belongs to, mirroring the Process Studio
--                                   value streams.
-- SAFE / NON-DESTRUCTIVE: add-column-if-not-exists.
-- ═══════════════════════════════════════════════════════════

alter table cm_capabilities add column if not exists workstream_id uuid references workstreams(id) on delete set null;
create index if not exists idx_cm_capabilities_ws on cm_capabilities(workstream_id);
