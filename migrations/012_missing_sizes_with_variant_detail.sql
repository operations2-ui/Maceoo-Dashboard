-- Adds a `variants` JSON array (sku, size_code, description, on_hand) for every
-- variant currently on file for a flagged style, so the UI can show SKU/name/qty
-- detail on demand instead of just the bare size digit.
drop function if exists report_missing_sizes(uuid, date);

create function report_missing_sizes(p_store_id uuid, p_date date)
returns table (
  style_code text, present_sizes text[], min_size text, max_size text, missing_sizes text[], variants jsonb
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
  ),
  style_variants as (
    select i.style_code,
           jsonb_agg(
             jsonb_build_object(
               'size_code', i.size_code, 'sku', i.sku, 'description', i.description, 'on_hand', i.on_hand
             )
             order by i.sku
           ) as variants
    from inventory_snapshots i
    where i.store_id = p_store_id and i.snapshot_date = p_date
      and i.style_code in (select style_code from style_sizes)
    group by i.style_code
  )
  select ss.style_code,
         ss.sizes as present_sizes,
         (select min(s::int) from unnest(ss.sizes) s)::text as min_size,
         (select max(s::int) from unnest(ss.sizes) s)::text as max_size,
         (
           select array_agg(g::text order by g)
           from generate_series(
             (select min(s::int) from unnest(ss.sizes) s),
             (select max(s::int) from unnest(ss.sizes) s)
           ) g
           where g::text != all(ss.sizes)
         ) as missing_sizes,
         sv.variants
  from style_sizes ss
  join style_variants sv on sv.style_code = ss.style_code;
$$;
