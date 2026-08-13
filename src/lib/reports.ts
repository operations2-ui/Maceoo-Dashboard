import { pool } from "./db";

export interface NegativeInventoryRow {
  [key: string]: unknown;
  sku: string;
  style_code: string;
  size_code: string;
  description: string | null;
  vendor: string | null;
  on_hand: number;
}

export async function getNegativeInventory(storeId: string, date: string): Promise<NegativeInventoryRow[]> {
  const { rows } = await pool.query(
    `select sku, style_code, size_code, description, vendor, on_hand
     from inventory_snapshots
     where store_id = $1 and snapshot_date = $2 and on_hand < 0
     order by on_hand asc`,
    [storeId, date],
  );
  return rows;
}

export interface SoldNegativeRow {
  [key: string]: unknown;
  sku: string;
  style_code: string;
  size_code: string;
  description: string | null;
  prev_on_hand: number;
  curr_on_hand: number;
  items_sold: number;
}

export async function getSoldNegative(storeId: string, date: string): Promise<SoldNegativeRow[]> {
  const { rows } = await pool.query("select * from report_negative_prior_day($1, $2)", [storeId, date]);
  return rows;
}

export interface MissingSizeVariant {
  size_code: string;
  sku: string;
  description: string | null;
  on_hand: number;
}

export interface MissingSizeRow {
  [key: string]: unknown;
  style_code: string;
  present_sizes: string[];
  min_size: string;
  max_size: string;
  missing_sizes: string[] | null;
  variants: MissingSizeVariant[];
}

export async function getMissingSizes(storeId: string, date: string): Promise<MissingSizeRow[]> {
  const { rows } = await pool.query("select * from report_missing_sizes($1, $2)", [storeId, date]);
  return rows.filter((r: MissingSizeRow) => r.missing_sizes && r.missing_sizes.length > 0);
}

export interface DiscountRow {
  [key: string]: unknown;
  day_date: string;
  store_name: string;
  user_name: string;
  discount_name: string;
  total_discounts: string;
  order_id: string;
  pos_flag: string;
}

export async function getDiscounts(storeIds: string[], fromDate: string, toDate: string): Promise<DiscountRow[]> {
  if (storeIds.length === 0) return [];
  const { rows } = await pool.query(
    `select to_char(d.day_date, 'YYYY-MM-DD') as day_date, s.name as store_name, d.user_name, d.discount_name,
            d.total_discounts, d.order_id, d.pos_flag
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

  const missingByStore = await Promise.all(storeIds.map((id) => getMissingSizes(id, latestDate)));
  const missingSizeStyleCount = missingByStore.reduce((sum, rows) => sum + rows.length, 0);

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
