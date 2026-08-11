-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Persona role within its value stream
--   personas.workstream_role : is this persona a PRIMARY actor in the value
--   stream it is aligned to (executes/owns the work, appears as a swimlane),
--   or a STAKEHOLDER / RECEIVER (consumes the stream's outputs, approves or
--   oversees, supplies reference data, but does not run the process)?
--
--   null      = not yet determined
--   'primary'     = primary persona for the value stream
--   'stakeholder' = stakeholder / receiver of data within the value stream
--
-- Populated by scripts/classify-persona-workstream-role.mjs and overridable
-- from the Persona Catalog page.
-- SAFE / NON-DESTRUCTIVE: add-column-if-not-exists.
-- ═══════════════════════════════════════════════════════════

alter table personas add column if not exists workstream_role text;
-- One-line justification for the determination (shown on the card, exported).
alter table personas add column if not exists workstream_role_note text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'personas_workstream_role_chk'
  ) then
    alter table personas add constraint personas_workstream_role_chk
      check (workstream_role is null or workstream_role in ('primary', 'stakeholder'));
  end if;
end $$;

create index if not exists idx_personas_ws_role on personas(workstream_role);
