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
