-- True per-order granularity, kept separately from the aggregated
-- sales_daily/sales_by_user/discounts tables. "Order name" is confirmed
-- globally unique in the live sheet (25,787 rows, 25,787 distinct order
-- names), so it's the natural key here.
create table if not exists sales_orders (
  id bigint generated always as identity primary key,
  store_id uuid not null references stores(id) on delete cascade,
  order_name text not null unique,
  day_date date not null,
  user_name text not null default '',
  discount_name text not null default '',
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
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_orders_store_date on sales_orders (store_id, day_date);
create index if not exists idx_sales_orders_user on sales_orders (user_name);
