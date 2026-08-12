-- Real SKU data includes non-numeric size suffixes (letters like B/C for custom
-- fits, short alias codes like BLE001, etc). These aren't part of a numeric size
-- run, so gap-detection only makes sense over the numeric subset per style.
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
      and size_code ~ '^[0-9]+$'
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
