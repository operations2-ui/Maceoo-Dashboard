-- Buy Plan filters sales_order_lines down to real merchandise by checking
-- membership against inventory_snapshots' SKU set (excludes shipping/service/
-- synthetic line items, which never appear in a physical inventory count).
-- sku is only the trailing column of the existing (store_id, snapshot_date,
-- sku) primary key, so a plain lookup can't use it as a leading search key.
create index if not exists idx_inventory_sku on inventory_snapshots (sku);
