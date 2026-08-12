-- Maceoo Dashboard schema (plain Postgres, no Supabase).
-- Authorization is enforced in the application layer (see src/lib/authz.ts),
-- not via Postgres RLS, since there's no JWT-to-session bridge without Supabase.

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text,
  role text not null default 'store_manager' check (role in ('admin', 'store_manager')),
  created_at timestamptz not null default now()
);

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  drive_folder_id text,
  created_at timestamptz not null default now()
);

create table if not exists inventory_snapshots (
  store_id uuid not null references stores(id) on delete cascade,
  snapshot_date date not null,
  sku text not null,
  style_code text not null,
  size_code text not null,
  description text,
  vendor text,
  on_hand integer not null,
  created_at timestamptz not null default now(),
  primary key (store_id, snapshot_date, sku)
);
create index if not exists idx_inventory_store_date on inventory_snapshots (store_id, snapshot_date);
create index if not exists idx_inventory_style on inventory_snapshots (store_id, snapshot_date, style_code);

create table if not exists discounts (
  id bigint generated always as identity primary key,
  store_id uuid not null references stores(id) on delete cascade,
  day_date date not null,
  user_name text,
  discount_name text,
  total_discounts numeric not null default 0,
  order_id text,
  pos_flag text,
  total_orders integer,
  created_at timestamptz not null default now(),
  unique (store_id, day_date, order_id, discount_name)
);
create index if not exists idx_discounts_store_date on discounts (store_id, day_date);

create table if not exists sales_daily (
  store_id uuid not null references stores(id) on delete cascade,
  order_date date not null,
  total_orders integer,
  gross_sales numeric,
  discounts numeric,
  refunds numeric,
  net_sales numeric,
  taxes numeric,
  shipping numeric,
  total_sales numeric,
  cogs numeric,
  gross_margin numeric,
  created_at timestamptz not null default now(),
  primary key (store_id, order_date)
);

create table if not exists user_store_access (
  user_id uuid not null references app_users(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  primary key (user_id, store_id)
);
