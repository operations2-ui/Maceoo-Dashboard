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
}

/**
 * SKU-level drill-down for one PO, shown when a Retail Audit summary row is
 * expanded. Driven by po_raw_data (All PO Data), not retail_audit_raw_data —
 * a PO's line items only show up in the Retail Audit sheet once they've been
 * matched to a sales order, so some SKUs that are genuinely on the PO would
 * be missing entirely if this queried Retail Audit Data directly. Instead,
 * every SKU on the PO is listed (from All PO Data), left-joined against
 * Retail Audit Data by SKU to fill in Quantity Received/Shipped where a
 * match exists — blank where it doesn't (not yet audited).
 */
export async function getRetailAuditDetail(poNumber: string): Promise<RetailAuditDetailRow[]> {
  const { rows } = await pool.query(
    `select
       p.document_number as po_number,
       trim(split_part(p.item, ':', 2)) as sku,
       p.display_name as item_name,
       p.quantity as po_quantity,
       a.quantity_received,
       a.quantity_shipped
     from po_raw_data p
     left join retail_audit_raw_data a
       on a.po_number = p.document_number and a.sku = trim(split_part(p.item, ':', 2))
     where p.document_number = $1
     order by p.line_id`,
    [poNumber],
  );
  return rows;
}
