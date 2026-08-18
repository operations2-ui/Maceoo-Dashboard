-- Sheet added a "SUM Quantity" column (units per line, negative on a
-- refund line). Raw value lives on sales_order_lines; the three aggregate
-- tables get a summed total_quantity. The store+sku index supports the Buy
-- Plan report's per-store per-item time-window aggregation.
alter table sales_order_lines add column if not exists quantity integer;
alter table sales_daily add column if not exists total_quantity integer;
alter table sales_by_user add column if not exists total_quantity integer;
alter table sales_orders add column if not exists total_quantity integer;
create index if not exists idx_sales_order_lines_store_sku on sales_order_lines (store_id, variant_sku);
