-- ═══════════════════════════════════════════════════════════
-- Mach12.ai: the Deliverables Engine (Workpackage K2)
--
-- Consulting documents produced by the workstream agents and the Solution
-- Architect: config workbooks, business process designs, functional and technical
-- specs, key design decisions, test scripts, migration specs, authorization
-- concepts, cutover runbooks, DFARS business system compliance matrices, and the
-- Solution Architecture Document.
--
-- `evidence` is not decoration. Every deliverable carries the tool results it was
-- generated from (architecture reads, live-config introspection, kb hits, the
-- executed-config log). An auditor, or a DCAA-minded client, can walk any claim in
-- the document back to the evidence that produced it. A required evidence slot
-- that could not be filled means the document was never generated: the agent
-- reports the gap instead. There is no filler path.
--
-- Org-scoped RLS, mirroring agent_threads.
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists.
-- ═══════════════════════════════════════════════════════════

create table if not exists deliverables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workstream_id uuid references workstreams(id) on delete set null,
  workstream_code text not null,            -- canonical stream code, or 'enterprise'
  dtype text not null,                      -- deliverable type key (agent-core DeliverableType)
  title text not null,
  subject text,
  status text not null default 'draft',     -- draft | review | final
  -- { sections: [{key,title,content}] } as returned by the deliverables engine
  content jsonb not null default '{}'::jsonb,
  -- [{key,tool,ok,result,reason}] the evidence pack the document was written from
  evidence jsonb not null default '[]'::jsonb,
  version int not null default 1,
  rendered_path text,                       -- populated when a DOCX is stored
  thread_id uuid references agent_threads(id) on delete set null,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_deliverables_org on deliverables(organization_id, created_at desc);
create index if not exists idx_deliverables_ws on deliverables(organization_id, workstream_code);
create index if not exists idx_deliverables_type on deliverables(organization_id, dtype);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'deliverables_updated_at') then
    create trigger deliverables_updated_at before update on deliverables
      for each row execute function update_updated_at();
  end if;
end $$;

alter table deliverables enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='deliverables' and policyname='Org members can view deliverables') then
    create policy "Org members can view deliverables" on deliverables for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='deliverables' and policyname='Org members can manage deliverables') then
    create policy "Org members can manage deliverables" on deliverables for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
end $$;

-- ─── Knowledge gaps the agents logged (Workpackage D2 / I harvest) ──────────
-- An agent that answers from first principles because the kb was silent records
-- the gap here. The training-run engine harvests this table to decide what
-- knowledge to author next. Honest degradation becomes a work queue.

create table if not exists agent_knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workstream_code text not null,
  topic text not null,
  note text,
  thread_id uuid references agent_threads(id) on delete set null,
  status text not null default 'open',      -- open | queued | authored | dismissed
  created_at timestamptz default now()
);

create index if not exists idx_agent_kb_gaps_org on agent_knowledge_gaps(organization_id, created_at desc);
create index if not exists idx_agent_kb_gaps_ws on agent_knowledge_gaps(workstream_code, status);

alter table agent_knowledge_gaps enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='agent_knowledge_gaps' and policyname='Org members can view agent_knowledge_gaps') then
    create policy "Org members can view agent_knowledge_gaps" on agent_knowledge_gaps for select
      using (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='agent_knowledge_gaps' and policyname='Org members can manage agent_knowledge_gaps') then
    create policy "Org members can manage agent_knowledge_gaps" on agent_knowledge_gaps for all
      using (organization_id in (select organization_id from profiles where id = auth.uid()))
      with check (organization_id in (select organization_id from profiles where id = auth.uid()));
  end if;
end $$;
