-- A SKU with no row at all in yesterday's snapshot (new/first-seen today)
-- should be treated as having had 0 stock yesterday, not excluded entirely.
-- Switch the inner join to a left join with COALESCE so those cases are caught.
create or replace function report_negative_prior_day(p_store_id uuid, p_date date)
returns table (
  sku text, style_code text, size_code text, description text,
  prev_on_hand integer, curr_on_hand integer, items_sold integer
)
language sql
stable
as $$
  select c.sku, c.style_code, c.size_code, c.description,
         coalesce(p.on_hand, 0) as prev_on_hand, c.on_hand as curr_on_hand,
         (coalesce(p.on_hand, 0) - c.on_hand) as items_sold
  from inventory_snapshots c
  left join inventory_snapshots p
    on p.store_id = c.store_id
   and p.sku = c.sku
   and p.snapshot_date = c.snapshot_date - interval '1 day'
  where c.store_id = p_store_id
    and c.snapshot_date = p_date
    and c.on_hand < 0
    and c.on_hand < coalesce(p.on_hand, 0);
$$;
