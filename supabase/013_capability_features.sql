-- Add features column to capabilities
-- Features are a list of things this capability does/solves
alter table capabilities add column if not exists features jsonb default '[]';
