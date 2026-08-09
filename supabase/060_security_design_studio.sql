-- ═══════════════════════════════════════════════════════════
-- 060: Security Design Studio + Explore & Govern.
-- Two features on one data layer:
--   F1 Design Advisory — conversational security-design sessions, grounded
--      guidance (with KB citations), and solution design options (standard /
--      configuration / enhancement / third-party / process-control) with a
--      recorded decision + rationale.
--   F2 Explore & Govern — register a COTS or vibe-coded system, hold the
--      READ-ONLY exploration findings, the drafted governance plan, the
--      harmonization of its roles against the SAP security roles/personas
--      already governed here, and the artifacts BUILD generates into the studio.
--
-- Exploration and build guardrails live in the engine (src/lib/security/
-- explore.ts) and the agent tools; this layer only stores what was observed.
-- Secrets are never persisted — probable secrets are recorded as risks with a
-- redacted fingerprint inside governance_explorations.findings.
--
-- SAFE / NON-DESTRUCTIVE: create-if-not-exists only.
-- ═══════════════════════════════════════════════════════════

-- ─── F1: design advisory ───────────────────────────────

create table if not exists security_design_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  scope text,
  workstream_id uuid references workstreams(id) on delete set null,
  status text not null default 'active' check (status in ('active','decided','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists security_design_guidance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id uuid not null references security_design_sessions(id) on delete cascade,
  topic text not null,
  body text not null,
  citations jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists security_design_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id uuid not null references security_design_sessions(id) on delete cascade,
  name text not null,
  summary text,
  approach text not null default 'standard'
    check (approach in ('standard','configuration','enhancement','third_party','process_control')),
  pros jsonb not null default '[]'::jsonb,
  cons jsonb not null default '[]'::jsonb,
  effort text,
  risk text,
  recommended boolean not null default false,
  decision text not null default 'open' check (decision in ('open','selected','rejected')),
  decision_rationale text,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── F2: explore & govern ──────────────────────────────

create table if not exists governed_systems (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  kind text not null default 'custom' check (kind in ('cots','custom')),
  vendor text,
  base_url text,
  source_path text,
  description text,
  criticality text check (criticality in ('low','medium','high')),
  status text not null default 'registered'
    check (status in ('registered','explored','planned','approved','governed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, name)
);

create table if not exists governance_explorations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  system_id uuid not null references governed_systems(id) on delete cascade,
  status text not null default 'complete' check (status in ('running','complete','failed')),
  findings jsonb not null default '{}'::jsonb,
  summary text,
  created_at timestamptz default now()
);

create table if not exists governance_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  system_id uuid not null references governed_systems(id) on delete cascade,
  exploration_id uuid references governance_explorations(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','review','approved','built','rejected')),
  plan jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  built_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists governance_role_map (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references governance_plans(id) on delete cascade,
  external_role text not null,
  role_id uuid references process_roles(id) on delete set null,
  persona_id uuid references personas(id) on delete set null,
  disposition text not null default 'review' check (disposition in ('map','create','retire','review')),
  confidence numeric,
  rationale text,
  created_at timestamptz default now(),
  unique (plan_id, external_role)
);

create table if not exists governance_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references governance_plans(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('policy','config','code','mapping','runbook','doc')),
  target_path text,
  language text,
  content text not null,
  created_at timestamptz default now()
);

-- ─── Indexes (org + each parent id) ────────────────────

create index if not exists idx_security_design_sessions_org on security_design_sessions(organization_id);
create index if not exists idx_security_design_sessions_workstream on security_design_sessions(workstream_id);
create index if not exists idx_security_design_guidance_org on security_design_guidance(organization_id);
create index if not exists idx_security_design_guidance_session on security_design_guidance(session_id);
create index if not exists idx_security_design_options_org on security_design_options(organization_id);
create index if not exists idx_security_design_options_session on security_design_options(session_id);
create index if not exists idx_governed_systems_org on governed_systems(organization_id);
create index if not exists idx_governance_explorations_org on governance_explorations(organization_id);
create index if not exists idx_governance_explorations_system on governance_explorations(system_id);
create index if not exists idx_governance_plans_org on governance_plans(organization_id);
create index if not exists idx_governance_plans_system on governance_plans(system_id);
create index if not exists idx_governance_plans_exploration on governance_plans(exploration_id);
create index if not exists idx_governance_role_map_org on governance_role_map(organization_id);
create index if not exists idx_governance_role_map_plan on governance_role_map(plan_id);
create index if not exists idx_governance_role_map_role on governance_role_map(role_id);
create index if not exists idx_governance_role_map_persona on governance_role_map(persona_id);
create index if not exists idx_governance_artifacts_org on governance_artifacts(organization_id);
create index if not exists idx_governance_artifacts_plan on governance_artifacts(plan_id);

-- ─── RLS ───────────────────────────────────────────────

alter table security_design_sessions enable row level security;
alter table security_design_guidance enable row level security;
alter table security_design_options enable row level security;
alter table governed_systems enable row level security;
alter table governance_explorations enable row level security;
alter table governance_plans enable row level security;
alter table governance_role_map enable row level security;
alter table governance_artifacts enable row level security;

do $$
declare
  t text;
begin
  -- Every table carries organization_id, so one org-member view + manage pair each.
  foreach t in array array[
    'security_design_sessions',
    'security_design_guidance',
    'security_design_options',
    'governed_systems',
    'governance_explorations',
    'governance_plans',
    'governance_role_map',
    'governance_artifacts'
  ] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'Org members can view ' || t) then
      execute format(
        'create policy %I on %I for select using (organization_id in (select organization_id from profiles where id = auth.uid()))',
        'Org members can view ' || t, t);
    end if;
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'Org members can manage ' || t) then
      execute format(
        'create policy %I on %I for all using (organization_id in (select organization_id from profiles where id = auth.uid())) with check (organization_id in (select organization_id from profiles where id = auth.uid()))',
        'Org members can manage ' || t, t);
    end if;
  end loop;
end $$;
