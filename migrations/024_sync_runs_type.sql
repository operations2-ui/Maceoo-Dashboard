-- Sync is now triggered as three separate phase invocations (inventory,
-- sales, retail audit) instead of one combined call, so each phase gets its
-- own Vercel function-duration budget. This column lets Recent Runs show
-- which phase each row represents; existing rows default to 'full' since
-- they really were combined runs.
alter table sync_runs add column if not exists sync_type text not null default 'full'
  check (sync_type in ('full', 'inventory', 'sales', 'retail_audit'));
