-- 048: Review comments anchored to individual entities / bullets of a workshop's
-- prep, so reviewers on the public share link can comment in place.
--
-- anchor_key is a stable path to the thing being commented on, e.g.
--   brief:objectives:2
--   <agenda_item_id>:talkingPoints:0
--   <agenda_item_id>:keyDecisions:1
--   <agenda_item_id>:decisionCriteria:3
-- anchor_label snapshots the text that was commented on (so a comment still reads
-- sensibly if the underlying bullet is later edited).
--
-- Public (anon) reads/writes go through the service-key share route
-- (/api/share/workshop/[code]/comments), which validates the share code, so no anon
-- RLS policies are needed here. Org members read/manage via the policies below.

create table if not exists workshop_comments (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  anchor_key text not null,
  anchor_label text,
  author_name text not null default 'Guest',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists workshop_comments_workshop_idx on workshop_comments(workshop_id, created_at);
create index if not exists workshop_comments_anchor_idx on workshop_comments(workshop_id, anchor_key);

alter table workshop_comments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='workshop_comments' and policyname='Org members can view workshop_comments') then
    create policy "Org members can view workshop_comments" on workshop_comments for select
      using (workshop_id in (select id from workshops where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where tablename='workshop_comments' and policyname='Org members can manage workshop_comments') then
    create policy "Org members can manage workshop_comments" on workshop_comments for all
      using (workshop_id in (select id from workshops where organization_id in (select organization_id from profiles where id = auth.uid())))
      with check (workshop_id in (select id from workshops where organization_id in (select organization_id from profiles where id = auth.uid())));
  end if;
end $$;
