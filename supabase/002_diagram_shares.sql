-- ═══════════════════════════════════════════════════════════
-- Diagram Shares — shareable invite links for diagrams
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

create table if not exists diagram_shares (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references diagrams(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  code text unique not null,
  permission text not null check (permission in ('viewer', 'editor')) default 'editor',
  created_by uuid references profiles(id),
  expires_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_diagram_shares_code on diagram_shares(code);
create index if not exists idx_diagram_shares_diagram on diagram_shares(diagram_id);

alter table diagram_shares enable row level security;

-- Anyone can read shares (needed for invite acceptance)
create policy "shares_select"
  on diagram_shares for select
  using (true);

-- Authenticated users can create shares
create policy "shares_insert"
  on diagram_shares for insert
  with check (auth.uid() is not null);

-- Owners can delete shares
create policy "shares_delete"
  on diagram_shares for delete
  using (auth.uid() is not null);
