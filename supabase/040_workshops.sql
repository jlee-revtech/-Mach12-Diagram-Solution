-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Workshops (agent-facilitated delivery sessions)
-- A workshop is a facilitated, human + agent session tied to the customer's
-- architecture. The facilitator (enterprise orchestrator) drives an agenda;
-- workstream specialist agents contribute; the live conversation (voice or
-- typed) is captured as a transcript; and the scribe extracts structured
-- captures (decisions, actions, deliverables, risks, questions, and proposed
-- architecture changes). Architecture-change captures are REVIEWED
-- recommendations — applied to the model only on human confirm.
--
-- Lives in the shared DB (also the Knowledge Repository) so BOTH apps
-- (Solution Architecture Studio + SAP Solution Studio) can launch/run workshops.
--
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor).
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists only.
-- ═══════════════════════════════════════════════════════════

-- ─── Workshop (top-level container, org-scoped) ─────────────
create table if not exists workshops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  topic text,
  objective text,
  customer_name text,                        -- the client/org this workshop is for
  status text not null default 'draft',      -- draft | scheduled | live | completed | archived
  focus_areas text[] default '{}',           -- process | data | integration | capability | poc
  workstream_codes text[] default '{}',      -- value streams / agents in scope
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  brief jsonb,                               -- generated Workshop Brief (agenda, pre-read, gaps, questions)
  recap jsonb,                               -- generated wrap-up (summary, decisions, next steps)
  settings jsonb default '{}'::jsonb,        -- { voice: bool, transcriptionProvider, ... }
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz
);

-- ─── Participants (people + agents) ─────────────────────────
create table if not exists workshop_participants (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  kind text not null,                        -- 'person' | 'agent'
  display_name text not null,
  email text,                                -- person
  org_role text,                             -- person's role / title
  workstream_code text,                      -- agent's value stream, or 'enterprise' for the facilitator
  is_facilitator boolean default false,
  persona_id uuid references personas(id) on delete set null,  -- optional link to a modeled persona
  created_at timestamptz default now()
);

-- ─── Agenda items (timeboxed, focus-typed, artifact-linked) ─
create table if not exists workshop_agenda_items (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  sort_order int default 0,
  title text not null,
  objective text,
  focus_type text,                           -- process | data | integration | capability | poc | discussion
  timebox_minutes int,
  status text not null default 'pending',    -- pending | active | done | skipped
  linked_artifact_type text,                 -- process_model | process_node | data_element | capability | logical_system | workstream
  linked_artifact_id uuid,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Scenarios walked through in the session ────────────────
create table if not exists workshop_scenarios (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  agenda_item_id uuid references workshop_agenda_items(id) on delete set null,
  sort_order int default 0,
  title text not null,
  description text,
  focus_type text,                           -- process | data | integration | capability | poc
  linked_artifact_type text,
  linked_artifact_id uuid,
  created_at timestamptz default now()
);

-- ─── Live transcript (voice or typed) ───────────────────────
-- The running conversation the agents consume to stay aware. Voice lines land
-- here via the transcription provider; agent turns land here too.
create table if not exists workshop_messages (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  agenda_item_id uuid references workshop_agenda_items(id) on delete set null,
  seq bigint,                                -- monotonic ordering within the workshop
  speaker_kind text not null,                -- 'person' | 'agent' | 'system'
  speaker_name text,
  speaker_role text,                         -- 'facilitator' | 'specialist' | 'scribe' | 'participant'
  workstream_code text,                      -- for agent messages
  source text default 'typed',               -- 'voice' | 'typed' | 'agent' | 'system'
  content text not null,
  meta jsonb,                                -- transcription confidence, citations, tool calls
  created_at timestamptz default now()
);

-- ─── Captures (decisions / actions / deliverables / etc.) ───
-- Scribe-extracted, human-confirmable. architecture_change carries the proposed
-- to-be change in payload and is applied to the model only when status='applied'.
create table if not exists workshop_captures (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  agenda_item_id uuid references workshop_agenda_items(id) on delete set null,
  capture_type text not null,                -- decision | action | deliverable | risk | question | architecture_change | parking_lot
  title text not null,
  detail text,
  owner text,                                -- action / deliverable owner
  due_date date,
  status text not null default 'proposed',   -- proposed | confirmed | applied | dismissed
  workstream_code text,
  source_message_id uuid references workshop_messages(id) on delete set null,
  payload jsonb,                             -- architecture_change: { target_type, target_id, change, rationale, ... }
  created_by_kind text default 'agent',      -- 'agent' | 'person'
  applied_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Indexes ────────────────────────────────────────────────
create index if not exists idx_workshops_org           on workshops(organization_id);
create index if not exists idx_ws_participants_ws       on workshop_participants(workshop_id);
create index if not exists idx_ws_agenda_ws             on workshop_agenda_items(workshop_id);
create index if not exists idx_ws_scenarios_ws          on workshop_scenarios(workshop_id);
create index if not exists idx_ws_messages_ws           on workshop_messages(workshop_id);
create index if not exists idx_ws_messages_ws_seq       on workshop_messages(workshop_id, seq);
create index if not exists idx_ws_captures_ws           on workshop_captures(workshop_id);
create index if not exists idx_ws_captures_type_status  on workshop_captures(workshop_id, capture_type, status);

-- ─── updated_at triggers ────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'workshops_updated_at') then
    create trigger workshops_updated_at before update on workshops
      for each row execute function update_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'ws_agenda_updated_at') then
    create trigger ws_agenda_updated_at before update on workshop_agenda_items
      for each row execute function update_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'ws_captures_updated_at') then
    create trigger ws_captures_updated_at before update on workshop_captures
      for each row execute function update_updated_at();
  end if;
end $$;

-- ─── RLS ────────────────────────────────────────────────────
alter table workshops             enable row level security;
alter table workshop_participants enable row level security;
alter table workshop_agenda_items enable row level security;
alter table workshop_scenarios    enable row level security;
alter table workshop_messages     enable row level security;
alter table workshop_captures     enable row level security;

do $$
declare
  child text;
begin
  -- parent: workshops
  if not exists (select 1 from pg_policies where tablename='workshops' and policyname='Org members can view workshops') then
    create policy "Org members can view workshops" on workshops for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='workshops' and policyname='Org members can manage workshops') then
    create policy "Org members can manage workshops" on workshops for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;

  -- children: scope through the parent workshop's org
  foreach child in array array[
    'workshop_participants','workshop_agenda_items','workshop_scenarios','workshop_messages','workshop_captures'
  ] loop
    if not exists (select 1 from pg_policies where tablename=child and policyname='Org members can view '||child) then
      execute format(
        'create policy "Org members can view %1$s" on %1$s for select using (workshop_id in (select id from workshops where organization_id in (select organization_id from profiles where id = auth.uid())))',
        child);
    end if;
    if not exists (select 1 from pg_policies where tablename=child and policyname='Org members can manage '||child) then
      execute format(
        'create policy "Org members can manage %1$s" on %1$s for all using (workshop_id in (select id from workshops where organization_id in (select organization_id from profiles where id = auth.uid()))) with check (workshop_id in (select id from workshops where organization_id in (select organization_id from profiles where id = auth.uid())))',
        child);
    end if;
  end loop;
end $$;
