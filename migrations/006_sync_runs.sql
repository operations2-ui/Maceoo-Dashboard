create table if not exists sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  summary jsonb,
  error_message text
);
create index if not exists idx_sync_runs_started on sync_runs (started_at desc);
