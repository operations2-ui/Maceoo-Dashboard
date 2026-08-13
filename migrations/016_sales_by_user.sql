-- User-level daily sales, aggregated from every (user, discount-combo) slice
-- of a store/day in the Sales sheet, so sales and discounts can be compared
-- per user in a single report instead of two separate ones.
create table if not exists sales_by_user (
  id bigint generated always as identity primary key,
  store_id uuid not null references stores(id) on delete cascade,
  day_date date not null,
  user_name text not null default '',
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
  unique (store_id, day_date, user_name)
);
create index if not exists idx_sales_by_user_store_date on sales_by_user (store_id, day_date);
