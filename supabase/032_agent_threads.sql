-- ═══════════════════════════════════════════════════════════
-- Mach12.ai — Workstream Agent conversations
-- Per-org chat threads with the workstream consultant agents and the
-- enterprise orchestrator. Conversations live in the app's own project; only
-- the knowledge they draw on lives in the shared Knowledge Repository.
--
-- agent_messages.content (jsonb) carries the rendered text plus any tool calls,
-- citations, and pillar-tagged recommendations for that turn.
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists.
-- ═══════════════════════════════════════════════════════════

create table if not exists agent_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  agent_code text not null,                 -- workstream code or 'enterprise'
  workstream_id uuid references workstreams(id) on delete set null,
  title text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists agent_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references agent_threads(id) on delete cascade,
  role text not null,                       -- 'user' | 'assistant'
  content jsonb not null,                   -- { text, citations?, recommendations?, toolCalls? }
  created_at timestamptz default now()
);

create index if not exists idx_agent_threads_org on agent_threads(organization_id);
create index if not exists idx_agent_messages_thread on agent_messages(thread_id);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'agent_threads_updated_at') then
    create trigger agent_threads_updated_at before update on agent_threads
      for each row execute function update_updated_at();
  end if;
end $$;

alter table agent_threads  enable row level security;
alter table agent_messages enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='agent_threads' and policyname='Org members can view agent_threads') then
    create policy "Org members can view agent_threads" on agent_threads for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='agent_threads' and policyname='Org members can manage agent_threads') then
    create policy "Org members can manage agent_threads" on agent_threads for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where tablename='agent_messages' and policyname='Org members can view agent_messages') then
    create policy "Org members can view agent_messages" on agent_messages for select
      using (thread_id in (select id from agent_threads where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename='agent_messages' and policyname='Org members can manage agent_messages') then
    create policy "Org members can manage agent_messages" on agent_messages for all
      using (thread_id in (select id from agent_threads where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
end $$;
