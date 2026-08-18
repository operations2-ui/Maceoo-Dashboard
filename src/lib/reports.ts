import { pool } from "./db";

export interface NegativeInventoryRow {
  [key: string]: unknown;
  store_id: string;
  store_name: string;
  sku: string;
  style_code: string;
  size_code: string;
  description: string | null;
  vendor: string | null;
  on_hand: number;
}

export async function getNegativeInventory(storeIds: string[], date: string): Promise<NegativeInventoryRow[]> {
  if (storeIds.length === 0) return [];
  const { rows } = await pool.query(
    `select i.store_id, s.name as store_name, i.sku, i.style_code, i.size_code, i.description, i.vendor, i.on_hand
     from inventory_snapshots i
     join stores s on s.id = i.store_id
     where i.store_id = any($1::uuid[]) and i.snapshot_date = $2 and i.on_hand < 0
     order by s.name, i.on_hand asc`,
    [storeIds, date],
  );
  return rows;
}

export interface SoldNegativeRow {
  [key: string]: unknown;
  store_id: string;
  store_name: string;
  sku: string;
  style_code: string;
  size_code: string;
  description: string | null;
  prev_on_hand: number;
  curr_on_hand: number;
  items_sold: number;
}

/** report_negative_prior_day() is single-store, so this fans out one call per store and merges. */
export async function getSoldNegative(storeIds: string[], date: string): Promise<SoldNegativeRow[]> {
  if (storeIds.length === 0) return [];
  const { rows: storeRows } = await pool.query("select id, name from stores where id = any($1::uuid[])", [storeIds]);
  const nameById = new Map<string, string>(storeRows.map((s) => [s.id, s.name]));

  const perStore = await Promise.all(
    storeIds.map(async (storeId) => {
      const { rows } = await pool.query("select * from report_negative_prior_day($1, $2)", [storeId, date]);
      return rows.map((r) => ({ ...r, store_id: storeId, store_name: nameById.get(storeId) ?? "" }));
    }),
  );
  return perStore.flat().sort((a, b) => a.store_name.localeCompare(b.store_name));
}

export interface MissingSizeVariant {
  size_code: string;
  sku: string;
  description: string | null;
  on_hand: number;
}

export interface MissingSizeRow {
  [key: string]: unknown;
  store_id: string;
  store_name: string;
  style_code: string;
  present_sizes: string[];
  min_size: string;
  max_size: string;
  missing_sizes: string[] | null;
  variants: MissingSizeVariant[];
}

/** report_missing_sizes() is single-store, so this fans out one call per store and merges. */
export async function getMissingSizes(storeIds: string[], date: string): Promise<MissingSizeRow[]> {
  if (storeIds.length === 0) return [];
  const { rows: storeRows } = await pool.query("select id, name from stores where id = any($1::uuid[])", [storeIds]);
  const nameById = new Map<string, string>(storeRows.map((s) => [s.id, s.name]));

  const perStore = await Promise.all(
    storeIds.map(async (storeId) => {
      const { rows } = await pool.query("select * from report_missing_sizes($1, $2)", [storeId, date]);
      return rows
        .filter((r: MissingSizeRow) => r.missing_sizes && r.missing_sizes.length > 0)
        .map((r: MissingSizeRow) => ({ ...r, store_id: storeId, store_name: nameById.get(storeId) ?? "" }));
    }),
  );
  return perStore.flat().sort((a, b) => a.store_name.localeCompare(b.store_name));
}

export interface DiscountRow {
  [key: string]: unknown;
  day_date: string;
  store_name: string;
  user_name: string;
  discount_name: string;
  total_discounts: string;
  total_orders: number | null;
}

/**
 * Discount usage now comes from the Sales sheet itself (each row is a
 * per-user, per-discount-combo slice of a day's orders), so this reads the
 * same discounts table that syncSalesFromSheet populates — no separate
 * Discounts sheet/sync anymore.
 */
export async function getDiscounts(storeIds: string[], fromDate: string, toDate: string): Promise<DiscountRow[]> {
  if (storeIds.length === 0) return [];
  const { rows } = await pool.query(
    `select to_char(d.day_date, 'YYYY-MM-DD') as day_date, s.name as store_name, d.user_name, d.discount_name,
            d.total_discounts, d.total_orders
     from discounts d
     join stores s on s.id = d.store_id
     where d.store_id = any($1::uuid[]) and d.day_date >= $2 and d.day_date <= $3
     order by d.day_date desc`,
    [storeIds, fromDate, toDate],
  );
  return rows;
}

export interface SalesRow {
  [key: string]: unknown;
  order_date: string;
  store_name: string;
  total_orders: number | null;
  gross_sales: string | null;
  discounts: string | null;
  refunds: string | null;
  net_sales: string | null;
  taxes: string | null;
  shipping: string | null;
  total_sales: string | null;
  cogs: string | null;
  gross_margin: string | null;
}

export interface InventoryAlertSummary {
  latestDate: string | null;
  negativeCount: number;
  missingSizeStyleCount: number;
}

/** Snapshot of today's operational alerts across all accessible stores, for the Overview dashboard. */
export async function getInventoryAlertSummary(storeIds: string[]): Promise<InventoryAlertSummary> {
  if (storeIds.length === 0) return { latestDate: null, negativeCount: 0, missingSizeStyleCount: 0 };

  const { rows: dateRows } = await pool.query(
    "select to_char(max(snapshot_date), 'YYYY-MM-DD') as latest from inventory_snapshots where store_id = any($1::uuid[])",
    [storeIds],
  );
  const latestDate: string | null = dateRows[0]?.latest ?? null;
  if (!latestDate) return { latestDate: null, negativeCount: 0, missingSizeStyleCount: 0 };

  const { rows: negRows } = await pool.query(
    "select count(*)::int as c from inventory_snapshots where store_id = any($1::uuid[]) and snapshot_date = $2 and on_hand < 0",
    [storeIds, latestDate],
  );

  const missingSizeStyleCount = (await getMissingSizes(storeIds, latestDate)).length;

  return { latestDate, negativeCount: negRows[0]?.c ?? 0, missingSizeStyleCount };
}

export async function getSales(storeIds: string[], fromDate: string, toDate: string): Promise<SalesRow[]> {
  if (storeIds.length === 0) return [];
  const { rows } = await pool.query(
    `select to_char(sd.order_date, 'YYYY-MM-DD') as order_date, s.name as store_name, sd.total_orders, sd.gross_sales, sd.discounts,
            sd.refunds, sd.net_sales, sd.taxes, sd.shipping, sd.total_sales, sd.cogs, sd.gross_margin
     from sales_daily sd
     join stores s on s.id = sd.store_id
     where sd.store_id = any($1::uuid[]) and sd.order_date >= $2 and sd.order_date <= $3
     order by sd.order_date asc`,
    [storeIds, fromDate, toDate],
  );
  return rows;
}

export interface SalesByUserRow {
  [key: string]: unknown;
  day_date: string;
  store_name: string;
  user_name: string;
  total_orders: number | null;
  gross_sales: string | null;
  discounts: string | null;
  net_sales: string | null;
  /** discounts / gross_sales * 100, rounded to 1dp; null when gross_sales is 0. */
  discount_pct: string | null;
}

/**
 * One row per (store, day, user) — sales and discount usage together, so
 * they can be compared per user instead of as two separate reports.
 */
export async function getSalesByUser(storeIds: string[], fromDate: string, toDate: string): Promise<SalesByUserRow[]> {
  if (storeIds.length === 0) return [];
  const { rows } = await pool.query(
    `select to_char(u.day_date, 'YYYY-MM-DD') as day_date, s.name as store_name, u.user_name,
            u.total_orders, u.gross_sales, u.discounts, u.net_sales,
            case when u.gross_sales > 0 then round((u.discounts / u.gross_sales) * 100, 1) else null end as discount_pct
     from sales_by_user u
     join stores s on s.id = u.store_id
     where u.store_id = any($1::uuid[]) and u.day_date >= $2 and u.day_date <= $3
     order by u.day_date desc, u.gross_sales desc`,
    [storeIds, fromDate, toDate],
  );
  return rows;
}

export interface SalesOrderRow {
  [key: string]: unknown;
  store_name: string;
  order_name: string;
  day_date: string;
  user_name: string;
  gross_sales: string | null;
  discounts: string | null;
  refunds: string | null;
  net_sales: string | null;
  discount_pct: string | null;
}

/** Report 1: per-order detail — Location, Order Name, Date, User, Gross Sales, Discounts, Refunds, Net Sales, Discount %. */
export async function getSalesOrders(storeIds: string[], fromDate: string, toDate: string): Promise<SalesOrderRow[]> {
  if (storeIds.length === 0) return [];
  const { rows } = await pool.query(
    `select s.name as store_name, o.order_name, to_char(o.day_date, 'YYYY-MM-DD') as day_date, o.user_name,
            o.gross_sales, o.discounts, o.refunds, o.net_sales,
            case when o.gross_sales > 0 then round((o.discounts / o.gross_sales) * 100, 1) else null end as discount_pct
     from sales_orders o
     join stores s on s.id = o.store_id
     where o.store_id = any($1::uuid[]) and o.day_date >= $2 and o.day_date <= $3
     order by o.day_date desc, o.order_name desc`,
    [storeIds, fromDate, toDate],
  );
  return rows;
}

export interface DiscountBucketRow {
  [key: string]: unknown;
  bucket: string;
  orders: number;
  total_discounts: string;
  total_gross_sales: string;
  users: string[];
}

/** Report 2: orders bucketed by discount % of gross sales (0-5%, 5-10%, ... 25%+). */
export async function getDiscountBuckets(storeIds: string[], fromDate: string, toDate: string): Promise<DiscountBucketRow[]> {
  if (storeIds.length === 0) return [];
  const { rows } = await pool.query(
    `with order_pct as (
       select o.*, (o.discounts / o.gross_sales) * 100 as pct
       from sales_orders o
       where o.store_id = any($1::uuid[]) and o.day_date >= $2 and o.day_date <= $3 and o.gross_sales > 0
     ),
     bucketed as (
       select *,
         case
           when pct < 5 then '0-5%'
           when pct < 10 then '5-10%'
           when pct < 15 then '10-15%'
           when pct < 20 then '15-20%'
           when pct < 25 then '20-25%'
           else '25%+'
         end as bucket,
         case
           when pct < 5 then 1 when pct < 10 then 2 when pct < 15 then 3
           when pct < 20 then 4 when pct < 25 then 5 else 6
         end as bucket_order
       from order_pct
     )
     select bucket, count(*)::int as orders, sum(discounts) as total_discounts, sum(gross_sales) as total_gross_sales,
            coalesce(array_agg(distinct user_name order by user_name) filter (where user_name <> ''), '{}') as users
     from bucketed
     group by bucket, bucket_order
     order by bucket_order`,
    [storeIds, fromDate, toDate],
  );
  return rows;
}

export interface EmployeeSummaryRow {
  [key: string]: unknown;
  user_name: string;
  total_orders: number;
  gross_sales: string;
  discounts: string;
  refunds: string;
  net_sales: string;
  discounts_over_15: string | null;
  orders_over_15: number | null;
  gross_sales_over_15: string | null;
}

/** Report 3: employee-wise summary, plus the subset of each employee's orders that had >15% discount. */
export async function getEmployeeSummary(storeIds: string[], fromDate: string, toDate: string): Promise<EmployeeSummaryRow[]> {
  if (storeIds.length === 0) return [];
  const { rows } = await pool.query(
    `with orders as (
       select *, case when gross_sales > 0 then (discounts / gross_sales) * 100 else 0 end as pct
       from sales_orders
       where store_id = any($1::uuid[]) and day_date >= $2 and day_date <= $3
     )
     select
       user_name,
       sum(total_orders)::int as total_orders,
       sum(gross_sales) as gross_sales,
       sum(discounts) as discounts,
       sum(refunds) as refunds,
       sum(net_sales) as net_sales,
       sum(discounts) filter (where pct > 15) as discounts_over_15,
       sum(total_orders) filter (where pct > 15)::int as orders_over_15,
       sum(gross_sales) filter (where pct > 15) as gross_sales_over_15
     from orders
     where user_name <> ''
     group by user_name
     order by gross_sales desc`,
    [storeIds, fromDate, toDate],
  );
  return rows;
}

/**
 * Shared time-window SQL fragment for Buy Plan's "sold" columns, matching
 * the 6 windows in the source screenshot: WTD, Last 7 days, MTD, Last 3
 * months, YTD, All-time. `last_30d`/`last_90d` aren't display columns —
 * they feed the insufficient/idle business rules below.
 */
const BUY_PLAN_WINDOW_SUMS = `
  sum(quantity) filter (where day_date >= date_trunc('week', current_date))::int as wtd,
  sum(quantity) filter (where day_date >= current_date - interval '7 days')::int as last_7d,
  sum(quantity) filter (where day_date >= date_trunc('month', current_date))::int as mtd,
  sum(quantity) filter (where day_date >= current_date - interval '3 months')::int as last_3mo,
  sum(quantity) filter (where day_date >= date_trunc('year', current_date))::int as ytd,
  sum(quantity)::int as all_time,
  sum(quantity) filter (where day_date >= current_date - interval '30 days')::int as last_30d,
  sum(quantity) filter (where day_date >= current_date - interval '90 days')::int as last_90d
`;

export interface BuyPlanStoreRow {
  [key: string]: unknown;
  store_id: string;
  store_name: string;
  wtd: number;
  last_7d: number;
  mtd: number;
  last_3mo: number;
  ytd: number;
  all_time: number;
  insufficient_count: number;
  idle_count: number;
}

/**
 * Store-level Buy Plan overview: units sold per store across the 6 windows,
 * plus how many of that store's items are flagged insufficient/idle right
 * now (per-item rules below) so a store needing attention is visible before
 * drilling in. Two separate aggregations on purpose: the sold-window totals
 * are pure store-grain sums, while the flag counts need item (variant)
 * grain first — computing both at variant grain and rolling the totals up
 * would just redo the same work at a finer level for no benefit.
 */
export async function getBuyPlanStoreSummary(storeIds: string[]): Promise<BuyPlanStoreRow[]> {
  if (storeIds.length === 0) return [];
  const { rows } = await pool.query(
    `with known_skus as (
       -- Real merchandise only: inventory_snapshots is a physical stock
       -- count, so it never contains synthetic sales lines (shipping
       -- charges, tailoring services, gift cards, etc). This is what keeps
       -- those out of a "top-selling item" ranking without a fragile regex.
       select distinct sku from inventory_snapshots
     ),
     sold as (
       select l.store_id, ${BUY_PLAN_WINDOW_SUMS}
       from sales_order_lines l
       join known_skus k on k.sku = l.variant_sku
       where l.store_id = any($1::uuid[]) and l.product_type <> 'Services'
       group by l.store_id
     ),
     variant_sold as (
       select l.store_id, l.variant_sku,
         sum(l.quantity) filter (where l.day_date >= current_date - interval '30 days')::int as last_30d,
         sum(l.quantity) filter (where l.day_date >= current_date - interval '90 days')::int as last_90d
       from sales_order_lines l
       join known_skus k on k.sku = l.variant_sku
       where l.store_id = any($1::uuid[]) and l.product_type <> 'Services'
       group by l.store_id, l.variant_sku
     ),
     latest_inv as (
       select store_id, max(snapshot_date) as latest_date
       from inventory_snapshots
       where store_id = any($1::uuid[])
       group by store_id
     ),
     inv_by_variant as (
       select i.store_id, i.sku as variant_sku, i.on_hand
       from inventory_snapshots i
       join latest_inv li on li.store_id = i.store_id and li.latest_date = i.snapshot_date
     ),
     joined as (
       select
         coalesce(vs.store_id, iv.store_id) as store_id,
         coalesce(iv.on_hand, 0) as on_hand,
         coalesce(vs.last_30d, 0) as last_30d,
         coalesce(vs.last_90d, 0) as last_90d
       from variant_sold vs
       full outer join inv_by_variant iv on iv.store_id = vs.store_id and iv.variant_sku = vs.variant_sku
     ),
     flagged as (
       select store_id,
         count(*) filter (
           where last_30d > 0 and (on_hand = 0 or on_hand::numeric / (last_30d::numeric / 30.0) < 14)
         )::int as insufficient_count,
         count(*) filter (where on_hand > 0 and last_90d = 0)::int as idle_count
       from joined
       group by store_id
     )
     select s.id as store_id, s.name as store_name,
       coalesce(sold.wtd, 0) as wtd, coalesce(sold.last_7d, 0) as last_7d, coalesce(sold.mtd, 0) as mtd,
       coalesce(sold.last_3mo, 0) as last_3mo, coalesce(sold.ytd, 0) as ytd, coalesce(sold.all_time, 0) as all_time,
       coalesce(flagged.insufficient_count, 0) as insufficient_count, coalesce(flagged.idle_count, 0) as idle_count
     from stores s
     left join sold on sold.store_id = s.id
     left join flagged on flagged.store_id = s.id
     where s.id = any($1::uuid[])
     order by s.name`,
    [storeIds],
  );
  return rows;
}

export interface BuyPlanGroupRow {
  [key: string]: unknown;
  group_key: string;
  label: string;
  wtd: number;
  last_7d: number;
  mtd: number;
  last_3mo: number;
  ytd: number;
  all_time: number;
  on_hand: number;
  insufficient_count: number;
  idle_count: number;
}

/**
 * Category-level Buy Plan for one store — the top of the Category -> Style
 * -> Size drill-down. Same full-outer-join-then-flag shape as
 * getBuyPlanStoreSummary, just grouped by product_category within one store
 * instead of by store. A variant that's never sold at this store (so it
 * only appears on the inventory side) has no category on record — those
 * land in "(Uncategorized)" rather than being silently dropped.
 */
export async function getBuyPlanCategories(storeId: string): Promise<BuyPlanGroupRow[]> {
  const { rows } = await pool.query(
    `with known_skus as (
       select distinct sku from inventory_snapshots
     ),
     sold as (
       select l.variant_sku,
         (array_agg(l.product_category) filter (where l.product_category <> ''))[1] as product_category,
         ${BUY_PLAN_WINDOW_SUMS}
       from sales_order_lines l
       join known_skus k on k.sku = l.variant_sku
       where l.store_id = $1 and l.product_type <> 'Services'
       group by l.variant_sku
     ),
     latest_date as (
       select max(snapshot_date) as d from inventory_snapshots where store_id = $1
     ),
     inv as (
       select i.sku as variant_sku, i.on_hand
       from inventory_snapshots i, latest_date
       where i.store_id = $1 and i.snapshot_date = latest_date.d
     ),
     joined as (
       select
         coalesce(sold.product_category, '') as product_category,
         coalesce(sold.wtd, 0) as wtd, coalesce(sold.last_7d, 0) as last_7d, coalesce(sold.mtd, 0) as mtd,
         coalesce(sold.last_3mo, 0) as last_3mo, coalesce(sold.ytd, 0) as ytd, coalesce(sold.all_time, 0) as all_time,
         coalesce(inv.on_hand, 0) as on_hand,
         coalesce(sold.last_30d, 0) as last_30d, coalesce(sold.last_90d, 0) as last_90d
       from sold
       full outer join inv on inv.variant_sku = sold.variant_sku
     )
     select
       coalesce(nullif(product_category, ''), '(Uncategorized)') as group_key,
       coalesce(nullif(product_category, ''), '(Uncategorized)') as label,
       sum(wtd)::int as wtd, sum(last_7d)::int as last_7d, sum(mtd)::int as mtd,
       sum(last_3mo)::int as last_3mo, sum(ytd)::int as ytd, sum(all_time)::int as all_time,
       sum(on_hand)::int as on_hand,
       count(*) filter (
         where last_30d > 0 and (on_hand = 0 or on_hand::numeric / (last_30d::numeric / 30.0) < 14)
       )::int as insufficient_count,
       count(*) filter (where on_hand > 0 and last_90d = 0)::int as idle_count
     from joined
     group by 1
     order by sum(all_time) desc`,
    [storeId],
  );
  return rows;
}

/**
 * Style-level Buy Plan for one store within one product category — the
 * middle of the Category -> Style -> Size drill-down. Same shape as
 * getBuyPlanCategories, grouped by core_sku instead. `category` is the raw
 * product_category value, or "" for the "(Uncategorized)" bucket.
 */
export async function getBuyPlanStyles(storeId: string, category: string): Promise<BuyPlanGroupRow[]> {
  const { rows } = await pool.query(
    `with known_skus as (
       select distinct sku from inventory_snapshots
     ),
     sold as (
       select l.variant_sku, l.core_sku,
         (array_agg(l.product_category) filter (where l.product_category <> ''))[1] as product_category,
         ${BUY_PLAN_WINDOW_SUMS}
       from sales_order_lines l
       join known_skus k on k.sku = l.variant_sku
       where l.store_id = $1 and l.product_type <> 'Services'
       group by l.variant_sku, l.core_sku
     ),
     latest_date as (
       select max(snapshot_date) as d from inventory_snapshots where store_id = $1
     ),
     inv as (
       select i.sku as variant_sku, i.style_code as core_sku, i.description, i.on_hand
       from inventory_snapshots i, latest_date
       where i.store_id = $1 and i.snapshot_date = latest_date.d
     ),
     joined as (
       select
         coalesce(sold.core_sku, inv.core_sku) as core_sku,
         inv.description,
         coalesce(sold.product_category, '') as product_category,
         coalesce(sold.wtd, 0) as wtd, coalesce(sold.last_7d, 0) as last_7d, coalesce(sold.mtd, 0) as mtd,
         coalesce(sold.last_3mo, 0) as last_3mo, coalesce(sold.ytd, 0) as ytd, coalesce(sold.all_time, 0) as all_time,
         coalesce(inv.on_hand, 0) as on_hand,
         coalesce(sold.last_30d, 0) as last_30d, coalesce(sold.last_90d, 0) as last_90d
       from sold
       full outer join inv on inv.variant_sku = sold.variant_sku
       where coalesce(sold.product_category, '') = $2
     )
     select
       core_sku as group_key,
       core_sku || coalesce(' — ' || (array_agg(description) filter (where description is not null))[1], '') as label,
       sum(wtd)::int as wtd, sum(last_7d)::int as last_7d, sum(mtd)::int as mtd,
       sum(last_3mo)::int as last_3mo, sum(ytd)::int as ytd, sum(all_time)::int as all_time,
       sum(on_hand)::int as on_hand,
       count(*) filter (
         where last_30d > 0 and (on_hand = 0 or on_hand::numeric / (last_30d::numeric / 30.0) < 14)
       )::int as insufficient_count,
       count(*) filter (where on_hand > 0 and last_90d = 0)::int as idle_count
     from joined
     group by core_sku
     order by sum(all_time) desc`,
    [storeId, category],
  );
  return rows;
}

export interface BuyPlanItemRow {
  [key: string]: unknown;
  variant_sku: string;
  core_sku: string;
  description: string | null;
  size_code: string | null;
  vendor: string | null;
  product_category: string;
  product_type: string;
  wtd: number;
  last_7d: number;
  mtd: number;
  last_3mo: number;
  ytd: number;
  all_time: number;
  on_hand: number;
  days_of_supply: number | null;
  status: "insufficient" | "idle" | "ok";
}

/**
 * Item-level Buy Plan for one store, at variant (size) granularity rather
 * than rolled up to style — the insufficient/transfer signal is only
 * actionable at the size a customer actually buys (a style can be
 * well-stocked in M and empty in L; rolling up would hide that). A full
 * outer join between sold lines and the store's latest inventory snapshot
 * is deliberate: it surfaces both "selling but under-stocked" and "in stock
 * but not selling" items in one pass. Business rules (user-confirmed):
 * insufficient = selling in the last 30 days with under 14 days of supply
 * (or none left at all); idle = in stock with zero sales in the last 90 days.
 * `coreSku`, when given, scopes this to one style — the bottom of the
 * Category -> Style -> Size drill-down.
 */
export async function getBuyPlanItems(storeId: string, coreSku?: string): Promise<BuyPlanItemRow[]> {
  const { rows } = await pool.query(
    `with known_skus as (
       select distinct sku from inventory_snapshots
     ),
     sold as (
       select l.variant_sku, l.core_sku,
         (array_agg(l.product_category) filter (where l.product_category <> ''))[1] as product_category,
         (array_agg(l.product_type) filter (where l.product_type <> ''))[1] as product_type,
         ${BUY_PLAN_WINDOW_SUMS}
       from sales_order_lines l
       join known_skus k on k.sku = l.variant_sku
       where l.store_id = $1 and l.product_type <> 'Services'
         and ($2::text is null or l.core_sku = $2)
       group by l.variant_sku, l.core_sku
     ),
     latest_date as (
       select max(snapshot_date) as d from inventory_snapshots where store_id = $1
     ),
     inv as (
       select i.sku as variant_sku, i.style_code as core_sku, i.description, i.size_code, i.vendor, i.on_hand
       from inventory_snapshots i, latest_date
       where i.store_id = $1 and i.snapshot_date = latest_date.d
         and ($2::text is null or i.style_code = $2)
     )
     select
       coalesce(sold.variant_sku, inv.variant_sku) as variant_sku,
       coalesce(sold.core_sku, inv.core_sku) as core_sku,
       inv.description, inv.size_code, inv.vendor,
       coalesce(sold.product_category, '') as product_category,
       coalesce(sold.product_type, '') as product_type,
       coalesce(sold.wtd, 0) as wtd, coalesce(sold.last_7d, 0) as last_7d, coalesce(sold.mtd, 0) as mtd,
       coalesce(sold.last_3mo, 0) as last_3mo, coalesce(sold.ytd, 0) as ytd, coalesce(sold.all_time, 0) as all_time,
       coalesce(inv.on_hand, 0) as on_hand,
       case when coalesce(sold.last_30d, 0) > 0
         then round(greatest(coalesce(inv.on_hand, 0), 0)::numeric / (sold.last_30d::numeric / 30.0), 1)
         else null end as days_of_supply,
       case
         when coalesce(sold.last_30d, 0) > 0
           and (coalesce(inv.on_hand, 0) = 0 or coalesce(inv.on_hand, 0)::numeric / (sold.last_30d::numeric / 30.0) < 14)
           then 'insufficient'
         when coalesce(inv.on_hand, 0) > 0 and coalesce(sold.last_90d, 0) = 0
           then 'idle'
         else 'ok'
       end as status
     from sold
     full outer join inv on inv.variant_sku = sold.variant_sku
     order by all_time desc nulls last`,
    [storeId, coreSku ?? null],
  );
  return rows;
}

export interface BuyPlanTransferSuggestion {
  [key: string]: unknown;
  store_id: string;
  store_name: string;
  on_hand: number;
  last_30d: number;
  spare: number;
}

/**
 * For one insufficient item at one store, finds other stores with spare
 * units of that exact variant to transfer from — "spare" keeps 14 days of
 * that store's own supply (same threshold as the insufficient rule) and
 * offers the rest, ranked highest-spare first. Lazy-loaded on demand per
 * item (not precomputed for a whole item list), same reasoning as
 * RetailAuditTable's click-to-expand SKU detail.
 */
export async function getBuyPlanTransferSuggestions(
  variantSku: string,
  excludeStoreId: string,
): Promise<BuyPlanTransferSuggestion[]> {
  const { rows } = await pool.query(
    `with latest_inv as (
       select store_id, max(snapshot_date) as d
       from inventory_snapshots
       where store_id <> $2
       group by store_id
     ),
     inv as (
       select i.store_id, i.on_hand
       from inventory_snapshots i
       join latest_inv li on li.store_id = i.store_id and li.d = i.snapshot_date
       where i.sku = $1
     ),
     velocity as (
       select store_id, sum(quantity) filter (where day_date >= current_date - interval '30 days')::int as last_30d
       from sales_order_lines
       where variant_sku = $1 and store_id <> $2
       group by store_id
     )
     select store_id, store_name, on_hand, last_30d, spare from (
       select s.id as store_id, s.name as store_name,
         coalesce(inv.on_hand, 0) as on_hand,
         coalesce(v.last_30d, 0) as last_30d,
         coalesce(inv.on_hand, 0) - ceil(coalesce(v.last_30d, 0)::numeric / 30.0 * 14) as spare
       from stores s
       left join inv on inv.store_id = s.id
       left join velocity v on v.store_id = s.id
       where s.id <> $2
     ) t
     where spare > 0
     order by spare desc
     limit 3`,
    [variantSku, excludeStoreId],
  );
  return rows;
}

export interface RetailAuditDashboardRow {
  [key: string]: unknown;
  po_number: string;
  po_date: string | null;
  po_status: string | null;
  related_sp: string | null;
  vendor_name: string | null;
  ordered_quantity: string | null;
  billed_quantity: string | null;
  shipped_quantity: string | null;
  received_quantity: string | null;
  diff_shipped_received: string | null;
  diff_received_billed: string | null;
}

/** Not store-scoped — this is procurement/vendor audit data, not tied to the store access model. */
export async function getRetailAuditDashboard(): Promise<RetailAuditDashboardRow[]> {
  const { rows } = await pool.query(
    `select po_number, to_char(po_date, 'YYYY-MM-DD') as po_date, po_status, related_sp, vendor_name,
            ordered_quantity, billed_quantity, shipped_quantity, received_quantity,
            diff_shipped_received, diff_received_billed
     from retail_audit_dashboard
     order by po_date desc nulls last, po_number desc`,
  );
  return rows;
}

export interface RetailAuditDetailRow {
  [key: string]: unknown;
  po_number: string;
  sku: string;
  item_name: string | null;
  po_quantity: string | null;
  quantity_received: string | null;
  quantity_shipped: string | null;
  diff_shipped_received: string | null;
  diff_ordered_received: string | null;
}

/**
 * SKU-level drill-down for one PO, shown when a Retail Audit summary row is
 * expanded. Driven by po_raw_data (All PO Data), not retail_audit_raw_data —
 * a PO's line items only show up in the Retail Audit sheet once they've been
 * matched to a sales order, so some SKUs that are genuinely on the PO would
 * be missing entirely if this queried Retail Audit Data directly. Instead,
 * every SKU on the PO is listed (from All PO Data), left-joined against
 * Retail Audit Data by SKU to fill in Quantity Received/Shipped where a
 * match exists. Missing Shipped/Received are treated as 0 rather than left
 * blank — "not received" and "not yet audited" both mean nothing has arrived
 * yet, so the difference columns should show the real shortfall either way
 * (e.g. shipped 1, received blank -> Shipped - Received = 1, not "—").
 */
export async function getRetailAuditDetail(poNumber: string): Promise<RetailAuditDetailRow[]> {
  const { rows } = await pool.query(
    `select
       p.document_number as po_number,
       trim(split_part(p.item, ':', 2)) as sku,
       p.display_name as item_name,
       p.quantity as po_quantity,
       coalesce(a.quantity_received, 0) as quantity_received,
       coalesce(a.quantity_shipped, 0) as quantity_shipped,
       coalesce(a.quantity_shipped, 0) - coalesce(a.quantity_received, 0) as diff_shipped_received,
       p.quantity - coalesce(a.quantity_received, 0) as diff_ordered_received
     from po_raw_data p
     left join retail_audit_raw_data a
       on a.po_number = p.document_number and a.sku = trim(split_part(p.item, ':', 2))
     where p.document_number = $1
     order by (coalesce(a.quantity_shipped, 0) - coalesce(a.quantity_received, 0)) desc, p.line_id`,
    [poNumber],
  );
  return rows;
}
