-- ═══════════════════════════════════════════════════════════
-- Mach12.ai Diagram App — Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- ─── Organizations ──────────────────────────────────────
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- ─── User Profiles (extends Supabase Auth) ──────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id),
  email text not null,
  display_name text,
  role text check (role in ('admin', 'member')) default 'member',
  created_at timestamptz default now()
);

-- ─── Diagrams ───────────────────────────────────────────
create table if not exists diagrams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null default 'Untitled Diagram',
  description text,
  process_context text,
  canvas_data jsonb default '{"nodes":[],"edges":[]}',
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Per-Diagram Permissions ────────────────────────────
create table if not exists diagram_permissions (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references diagrams(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  permission text not null check (permission in ('viewer', 'editor', 'owner')),
  granted_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(diagram_id, user_id)
);

-- ─── Org Invite Codes ───────────────────────────────────
create table if not exists org_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text unique not null,
  created_by uuid references profiles(id),
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- ─── Indexes ────────────────────────────────────────────
create index if not exists idx_profiles_org on profiles(organization_id);
create index if not exists idx_diagrams_org on diagrams(organization_id);
create index if not exists idx_diagram_perms_diagram on diagram_permissions(diagram_id);
create index if not exists idx_diagram_perms_user on diagram_permissions(user_id);
create index if not exists idx_org_invites_code on org_invites(code);

-- ─── Auto-update updated_at ─────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger diagrams_updated_at
  before update on diagrams
  for each row execute function update_updated_at();

-- ─── Auto-create profile on signup ──────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ═══════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table diagrams enable row level security;
alter table diagram_permissions enable row level security;
alter table org_invites enable row level security;

-- ─── Organizations: members can read their own org ──────
create policy "Users can view their organization"
  on organizations for select
  using (
    id in (select organization_id from profiles where id = auth.uid())
  );

-- ─── Profiles: users can read org members, update self ──
create policy "Users can view org members"
  on profiles for select
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
    or id = auth.uid()
  );

create policy "Users can update own profile"
  on profiles for update
  using (id = auth.uid());

-- ─── Diagrams: org members can read, creators/editors can write ──
create policy "Org members can view diagrams"
  on diagrams for select
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create policy "Org members can create diagrams"
  on diagrams for insert
  with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create policy "Diagram owners and editors can update"
  on diagrams for update
  using (
    created_by = auth.uid()
    or id in (
      select diagram_id from diagram_permissions
      where user_id = auth.uid() and permission in ('editor', 'owner')
    )
  );

create policy "Diagram owners can delete"
  on diagrams for delete
  using (
    created_by = auth.uid()
    or id in (
      select diagram_id from diagram_permissions
      where user_id = auth.uid() and permission = 'owner'
    )
  );

-- ─── Diagram Permissions: org members can view, owners can manage ──
create policy "Users can view permissions for their diagrams"
  on diagram_permissions for select
  using (
    diagram_id in (
      select id from diagrams
      where organization_id in (select organization_id from profiles where id = auth.uid())
    )
  );

create policy "Diagram owners can manage permissions"
  on diagram_permissions for all
  using (
    diagram_id in (
      select id from diagrams where created_by = auth.uid()
    )
    or diagram_id in (
      select diagram_id from diagram_permissions
      where user_id = auth.uid() and permission = 'owner'
    )
  );

-- ─── Org Invites: members can view, admins can create ───
create policy "Org members can view invites"
  on org_invites for select
  using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create policy "Org admins can create invites"
  on org_invites for insert
  with check (
    organization_id in (
      select organization_id from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Allow anyone to read invites by code (for joining)
create policy "Anyone can lookup invite by code"
  on org_invites for select
  using (true);
