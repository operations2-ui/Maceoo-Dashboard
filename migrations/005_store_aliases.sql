create table if not exists store_aliases (
  id bigint generated always as identity primary key,
  store_id uuid not null references stores(id) on delete cascade,
  source text not null check (source in ('inventory', 'sheet')),
  alias_name text not null,
  created_at timestamptz not null default now(),
  unique (source, alias_name)
);
create index if not exists idx_store_aliases_store on store_aliases (store_id);
