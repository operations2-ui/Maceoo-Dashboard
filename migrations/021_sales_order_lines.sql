-- Line-item-level detail (SKU, product category/type, customer info) behind
-- each order. sales_orders stays "one row per order" (financials summed
-- across all of an order's lines) for existing reports; this table preserves
-- the newly-added per-line granularity for future drill-down reporting.
create table if not exists sales_order_lines (
  id bigint generated always as identity primary key,
  store_id uuid not null references stores(id) on delete cascade,
  order_name text not null,
  day_date date not null,
  user_name text not null default '',
  discount_name text not null default '',
  product_category text not null default '',
  product_type text not null default '',
  core_sku text not null default '',
  variant_sku text not null default '',
  customer_type text not null default '',
  customer_tags text not null default '',
  customer_full_name text not null default '',
  customer_total_net_spent numeric,
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
create index if not exists idx_sales_order_lines_store_date on sales_order_lines (store_id, day_date);
create index if not exists idx_sales_order_lines_order on sales_order_lines (order_name);
