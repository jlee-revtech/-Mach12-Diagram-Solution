-- ═══════════════════════════════════════════════════════════
-- Multi-Org Support: org_members join table
-- Run this in Supabase SQL Editor AFTER 001_schema.sql
-- ═══════════════════════════════════════════════════════════

-- ─── Organization Members (many-to-many) ────────────────
create table if not exists org_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role text check (role in ('admin', 'member')) default 'member',
  created_at timestamptz default now(),
  unique(user_id, organization_id)
);

create index if not exists idx_org_members_user on org_members(user_id);
create index if not exists idx_org_members_org on org_members(organization_id);

-- ─── Seed from existing profiles ────────────────────────
-- Backfill org_members from profiles that already have an organization_id
insert into org_members (user_id, organization_id, role)
select id, organization_id, role
from profiles
where organization_id is not null
on conflict (user_id, organization_id) do nothing;

-- ─── RLS ────────────────────────────────────────────────
alter table org_members enable row level security;

-- Users can see memberships for orgs they belong to
create policy "Users can view org memberships"
  on org_members for select
  using (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
    or user_id = auth.uid()
  );

-- Users can insert their own memberships (for joining orgs)
create policy "Users can join orgs"
  on org_members for insert
  with check (user_id = auth.uid());

-- Users can delete their own memberships (for leaving orgs)
create policy "Users can leave orgs"
  on org_members for delete
  using (user_id = auth.uid());

-- Admins can manage memberships in their orgs
create policy "Admins can manage org members"
  on org_members for all
  using (
    organization_id in (
      select organization_id from org_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- ─── Update organizations policy to use org_members ─────
-- Users can view orgs they are a member of
drop policy if exists "Users can view their organization" on organizations;
create policy "Users can view their organizations"
  on organizations for select
  using (
    id in (select organization_id from org_members where user_id = auth.uid())
  );

-- Allow authenticated users to create organizations
create policy "Authenticated users can create organizations"
  on organizations for insert
  with check (auth.uid() is not null);

-- ─── Update org_invites policies to use org_members ─────
drop policy if exists "Org members can view invites" on org_invites;
create policy "Org members can view invites"
  on org_invites for select
  using (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

drop policy if exists "Org admins can create invites" on org_invites;
create policy "Org admins can create invites"
  on org_invites for insert
  with check (
    organization_id in (
      select organization_id from org_members
      where user_id = auth.uid() and role = 'admin'
    )
  );
