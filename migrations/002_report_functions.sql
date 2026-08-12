create or replace function report_negative_prior_day(p_store_id uuid, p_date date)
returns table (
  sku text, style_code text, size_code text, description text,
  prev_on_hand integer, curr_on_hand integer, items_sold integer
)
language sql
stable
as $$
  select c.sku, c.style_code, c.size_code, c.description,
         p.on_hand as prev_on_hand, c.on_hand as curr_on_hand,
         (p.on_hand - c.on_hand) as items_sold
  from inventory_snapshots c
  join inventory_snapshots p
    on p.store_id = c.store_id
   and p.sku = c.sku
   and p.snapshot_date = c.snapshot_date - interval '1 day'
  where c.store_id = p_store_id
    and c.snapshot_date = p_date
    and c.on_hand < 0
    and (p.on_hand - c.on_hand) < abs(c.on_hand);
$$;

create or replace function report_missing_sizes(p_store_id uuid, p_date date)
returns table (
  style_code text, present_sizes text[], min_size text, max_size text, missing_sizes text[]
)
language sql
stable
as $$
  with variant_sizes as (
    select distinct style_code, size_code
    from inventory_snapshots
    where store_id = p_store_id and snapshot_date = p_date
  ),
  style_sizes as (
    select style_code, array_agg(size_code order by size_code::int) as sizes
    from variant_sizes
    group by style_code
    having count(*) >= 2
  )
  select style_code,
         sizes as present_sizes,
         (select min(s::int) from unnest(sizes) s)::text as min_size,
         (select max(s::int) from unnest(sizes) s)::text as max_size,
         (
           select array_agg(g::text order by g)
           from generate_series(
             (select min(s::int) from unnest(sizes) s),
             (select max(s::int) from unnest(sizes) s)
           ) g
           where g::text != all(sizes)
         ) as missing_sizes
  from style_sizes;
$$;
