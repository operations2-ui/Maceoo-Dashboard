alter table sync_runs add column if not exists cancel_requested boolean not null default false;

alter table sync_runs drop constraint if exists sync_runs_status_check;
alter table sync_runs add constraint sync_runs_status_check
  check (status in ('running', 'success', 'error', 'cancelled'));
