import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Readable } from "stream";
import { from as copyFrom } from "pg-copy-streams";
import { pool } from "./db";
import { getDriveClient, getSheetsClient } from "./google-clients";
import { parseInventoryCsv, dateFromFilename, type InventoryRow } from "./inventory-parser";
import { parseSalesCsv } from "./sales-parser";
import { parsePoRawCsv, parseRetailAuditRawCsv, parseDashboardCsv } from "./retail-audit-parser";
import { resolveStoreId, type StoreRef, type StoreAlias } from "./store-resolver";
import { rowsToCsv, rowsToCsvNullable } from "./csv-utils";
import { parseFlexibleDate } from "./date-utils";

export type SyncProgress = (message: string) => void;
const noopProgress: SyncProgress = () => {};

/** Polled at natural checkpoints (between stores/phases) to see if the run should stop early. */
export type CancelCheck = () => Promise<boolean>;
const noopCancelCheck: CancelCheck = async () => false;

export class SyncCancelledError extends Error {
  constructor() {
    super("Sync cancelled");
    this.name = "SyncCancelledError";
  }
}

async function throwIfCancelled(checkCancelled: CancelCheck): Promise<void> {
  if (await checkCancelled()) throw new SyncCancelledError();
}

// A store's daily inventory file can run into the thousands of SKU rows —
// backfilling many missing days across several stores in one run can easily
// take longer than a single invocation should run, and on Vercel would get
// hard-killed at the 60s function limit before it ever gets to update its
// own status row (the exact "stuck on running forever" symptom). Bound the
// inventory phase so it stops cleanly and picks up where it left off next
// time, instead of assuming one run finishes the whole backlog.
//
// Configurable via SYNC_TIME_BUDGET_MS: once daily syncs have caught up,
// there's only ~1 new file per store to import and 40s is more than enough
// — but during the initial backfill this can be set much higher locally
// (no Vercel process to get killed here). Do NOT set this above ~50000 on
// Vercel — its function hard-stops at the route's maxDuration (60s), so a
// higher budget there would just get killed mid-run instead of stopping
// cleanly on its own.
const INVENTORY_TIME_BUDGET_MS = Number(process.env.SYNC_TIME_BUDGET_MS) || 40_000;

function pastDeadline(deadline: number | null): boolean {
  return deadline != null && Date.now() > deadline;
}

/** Marks any sync_runs row still 'running' well past Vercel's max function
 * duration as failed. Nothing can update its own row after being hard-killed
 * mid-run, so without this, an orphaned row shows "running" forever in the
 * Recent Runs table even though the actual process died minutes ago. */
export async function closeStaleSyncRuns(): Promise<void> {
  await pool.query(
    `update sync_runs
     set finished_at = now(), status = 'error', current_step = null,
         error_message = 'Orphaned: the platform likely hard-killed this run before it could update its own status'
     where status = 'running' and started_at < now() - interval '5 minutes'`,
  );
}

export interface SyncSummary {
  inventory: { folder: string; store: string; file: string; imported: number }[];
  inventoryUnmatchedFolders: string[];
  inventoryErrors: { file: string; error: string }[];
  inventoryPruned: number;
  inventoryStoppedEarly: boolean;
  discounts: { imported: number; skipped: number; unmatchedLocations: string[] } | null;
  sales: { imported: number; skipped: number; unmatchedLocations: string[] } | null;
  retailAudit: { poRows: number; auditRows: number; dashboardRows: number } | null;
  errors: string[];
}

// The dashboard only ever shows the last 30 days of inventory, so there's no
// reason to import or retain snapshots older than that.
const INVENTORY_RETENTION_DAYS = 30;

function inventoryRetentionCutoff(): string {
  const d = new Date();
  d.setDate(d.getDate() - INVENTORY_RETENTION_DAYS);
  return d.toISOString().slice(0, 10);
}

/** Deletes inventory_snapshots rows older than the retention window. Returns the number of rows removed. */
async function pruneOldInventorySnapshots(): Promise<number> {
  const { rowCount } = await pool.query(
    "delete from inventory_snapshots where snapshot_date < (current_date - ($1 || ' days')::interval)",
    [INVENTORY_RETENTION_DAYS],
  );
  return rowCount ?? 0;
}

async function getStoresAndAliases(): Promise<{ stores: StoreRef[]; aliases: StoreAlias[] }> {
  const [{ rows: stores }, { rows: aliases }] = await Promise.all([
    pool.query("select id, name, code from stores"),
    pool.query("select store_id, source, alias_name from store_aliases"),
  ]);
  return { stores, aliases };
}

// googleapis/gaxios has no default request timeout, so a stalled connection
// to Google's API would otherwise hang the whole sync indefinitely — not
// just failing to progress, but making it uncancellable too, since the
// cancellation check only runs between requests, never during one.
const GOOGLE_REQUEST_TIMEOUT_MS = 30_000;

async function downloadDriveFileText(fileId: string): Promise<string> {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer", timeout: GOOGLE_REQUEST_TIMEOUT_MS },
  );
  return Buffer.from(res.data as ArrayBuffer).toString("utf-8");
}

async function streamCopy(client: import("pg").PoolClient, sql: string, csvText: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = client.query(copyFrom(sql));
    const readable = Readable.from([csvText]);
    readable.on("error", reject);
    stream.on("error", reject);
    stream.on("finish", resolve);
    readable.pipe(stream);
  });
}

/**
 * Truncates (deleteFromDate === null) or deletes rows >= deleteFromDate from
 * `table`, then COPY-loads `rows` in. For tables that get fully replaced
 * rather than incrementally upserted — the delete scope lets a "refresh"
 * pass leave untouched history alone (e.g. only the current calendar year)
 * instead of wiping everything on every run.
 */
async function deleteAndLoadTable(
  client: import("pg").PoolClient,
  table: string,
  dateColumn: string,
  deleteFromDate: string | null,
  columns: string[],
  rows: (string | number | null)[][],
): Promise<void> {
  if (deleteFromDate === null) {
    await client.query(`truncate table ${table}`);
  } else {
    await client.query(`delete from ${table} where ${dateColumn} >= $1`, [deleteFromDate]);
  }
  if (rows.length === 0) return;
  await streamCopy(client, `COPY ${table} (${columns.join(", ")}) FROM STDIN WITH (FORMAT csv)`, rowsToCsvNullable(rows));
}

/**
 * Bulk-loads one file's inventory rows via COPY into a temp staging table,
 * then a single set-based upsert into inventory_snapshots. A store's daily
 * file can run into the thousands of rows — one COPY stream plus one INSERT
 * is dramatically fewer round trips than the previous N-batches-of-500
 * approach, which was the real reason large files were taking minutes
 * instead of seconds (each batch is its own network round trip to RDS).
 * Mirrors the proven approach in scripts/import-local-inventory.ts.
 */
async function copyUpsertInventorySnapshots(
  client: import("pg").PoolClient,
  storeId: string,
  snapshotDate: string,
  rows: InventoryRow[],
): Promise<void> {
  await client.query(`
    create temporary table staging_inventory (
      store_id uuid, snapshot_date date, sku text, style_code text, size_code text,
      description text, vendor text, on_hand integer
    ) on commit drop;
  `);
  const csvText = rowsToCsv(
    rows.map((r) => [storeId, snapshotDate, r.sku, r.styleCode, r.sizeCode, r.description, r.vendor, String(r.onHand)]),
  );
  await streamCopy(
    client,
    "COPY staging_inventory (store_id, snapshot_date, sku, style_code, size_code, description, vendor, on_hand) FROM STDIN WITH (FORMAT csv)",
    csvText,
  );
  await client.query(`
    insert into inventory_snapshots (store_id, snapshot_date, sku, style_code, size_code, description, vendor, on_hand)
    select distinct on (store_id, snapshot_date, sku)
      store_id, snapshot_date, sku, style_code, size_code, description, vendor, on_hand
    from staging_inventory
    order by store_id, snapshot_date, sku, ctid desc
    on conflict (store_id, snapshot_date, sku) do update set
      style_code = excluded.style_code, size_code = excluded.size_code,
      description = excluded.description, vendor = excluded.vendor, on_hand = excluded.on_hand
  `);
}

async function syncInventoryFromDrive(
  rootFolderId: string | null,
  stores: StoreRef[],
  aliases: StoreAlias[],
  onProgress: SyncProgress = noopProgress,
  checkCancelled: CancelCheck = noopCancelCheck,
  deadline: number | null = null,
): Promise<Pick<SyncSummary, "inventory" | "inventoryUnmatchedFolders" | "inventoryErrors" | "inventoryStoppedEarly">> {
  const drive = getDriveClient();
  const inventory: SyncSummary["inventory"] = [];
  const inventoryUnmatchedFolders: string[] = [];
  const inventoryErrors: SyncSummary["inventoryErrors"] = [];
  const cutoff = inventoryRetentionCutoff();
  let stoppedEarly = false;

  // Store folders aren't necessarily collected under one dedicated parent —
  // when no DRIVE_ROOT_FOLDER_ID is configured, discover them by what's been
  // shared directly with the service account instead.
  const foldersRes = await drive.files.list(
    {
      q: rootFolderId
        ? `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
        : `sharedWithMe = true and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id, name)",
      pageSize: 200,
    },
    { timeout: GOOGLE_REQUEST_TIMEOUT_MS },
  );

  for (const folder of foldersRes.data.files ?? []) {
    await throwIfCancelled(checkCancelled);
    if (pastDeadline(deadline)) {
      stoppedEarly = true;
      break;
    }
    if (!folder.id || !folder.name) continue;
    const storeId = resolveStoreId(folder.name, stores, aliases, "inventory");
    if (!storeId) {
      inventoryUnmatchedFolders.push(folder.name);
      continue;
    }
    const store = stores.find((s) => s.id === storeId)!;
    onProgress(`Inventory: checking ${store.name}`);

    // The set of dates actually present, not just the max — a run that got
    // interrupted partway (timeout, cancellation, crash) can leave gaps
    // below the max date, and Drive doesn't return files in date order, so
    // those gaps must be retried rather than assumed covered.
    const { rows: dateRows } = await pool.query(
      "select distinct to_char(snapshot_date, 'YYYY-MM-DD') as d from inventory_snapshots where store_id = $1",
      [storeId],
    );
    const alreadySynced = new Set<string>(dateRows.map((r) => r.d));

    const filesRes = await drive.files.list(
      {
        q: `'${folder.id}' in parents and trashed = false and (name contains '.csv' or mimeType = 'text/csv')`,
        fields: "files(id, name)",
        pageSize: 500,
      },
      { timeout: GOOGLE_REQUEST_TIMEOUT_MS },
    );

    for (const file of filesRes.data.files ?? []) {
      await throwIfCancelled(checkCancelled);
      if (pastDeadline(deadline)) {
        stoppedEarly = true;
        break;
      }
      if (!file.id || !file.name) continue;
      try {
        // Cheap skip via the filename-derived date before paying for a Drive
        // download on files we already have or don't need (older than the
        // retention window).
        try {
          const filenameDate = dateFromFilename(file.name);
          if (filenameDate < cutoff || alreadySynced.has(filenameDate)) continue;
        } catch {
          // filename doesn't carry a date; fall through to reading the file
        }

        const text = await downloadDriveFileText(file.id);
        const asOfMatch = text.match(/As of\s+(.+)/i);
        const snapshotDate = asOfMatch ? parseFlexibleDate(asOfMatch[1]) : null;
        if (!snapshotDate) {
          inventoryErrors.push({ file: `${folder.name}/${file.name}`, error: 'No "As of <date>" line found' });
          continue;
        }
        if (snapshotDate < cutoff || alreadySynced.has(snapshotDate)) continue;

        onProgress(`Inventory: importing ${store.name} — ${file.name}`);
        const rows = parseInventoryCsv(text);
        const client = await pool.connect();
        try {
          await client.query("begin");
          await copyUpsertInventorySnapshots(client, storeId, snapshotDate, rows);
          await client.query("commit");
        } catch (e) {
          await client.query("rollback");
          throw e;
        } finally {
          client.release();
        }

        inventory.push({ folder: folder.name, store: store.name, file: file.name, imported: rows.length });
      } catch (e) {
        inventoryErrors.push({
          file: `${folder.name}/${file.name}`,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (stoppedEarly) break;
  }

  return { inventory, inventoryUnmatchedFolders, inventoryErrors, inventoryStoppedEarly: stoppedEarly };
}

/**
 * Reads store subfolders of dated CSVs directly off disk (e.g. a manually
 * downloaded/extracted Drive folder), mirroring syncInventoryFromDrive.
 * Only imports files newer than the latest snapshot_date already stored for
 * that store, so routine runs after the initial backfill stay cheap.
 */
async function syncInventoryFromLocalFolder(
  rootPath: string,
  stores: StoreRef[],
  aliases: StoreAlias[],
  onProgress: SyncProgress = noopProgress,
  checkCancelled: CancelCheck = noopCancelCheck,
  deadline: number | null = null,
): Promise<Pick<SyncSummary, "inventory" | "inventoryUnmatchedFolders" | "inventoryErrors" | "inventoryStoppedEarly">> {
  const inventory: SyncSummary["inventory"] = [];
  const inventoryUnmatchedFolders: string[] = [];
  const inventoryErrors: SyncSummary["inventoryErrors"] = [];
  const cutoff = inventoryRetentionCutoff();
  let stoppedEarly = false;

  const folders = readdirSync(rootPath, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const folder of folders) {
    await throwIfCancelled(checkCancelled);
    if (pastDeadline(deadline)) {
      stoppedEarly = true;
      break;
    }
    const storeId = resolveStoreId(folder.name, stores, aliases, "inventory");
    if (!storeId) {
      inventoryUnmatchedFolders.push(folder.name);
      continue;
    }
    const store = stores.find((s) => s.id === storeId)!;
    onProgress(`Inventory: checking ${store.name}`);

    // The set of dates actually present, not just the max — a run that got
    // interrupted partway (timeout, cancellation, crash) can leave gaps
    // below the max date, and files aren't guaranteed to be processed in
    // date order, so those gaps must be retried rather than assumed covered.
    const { rows: dateRows } = await pool.query(
      "select distinct to_char(snapshot_date, 'YYYY-MM-DD') as d from inventory_snapshots where store_id = $1",
      [storeId],
    );
    const alreadySynced = new Set<string>(dateRows.map((r) => r.d));

    const folderPath = join(rootPath, folder.name);
    const files = readdirSync(folderPath).filter((f) => f.endsWith(".csv"));

    for (const file of files) {
      await throwIfCancelled(checkCancelled);
      if (pastDeadline(deadline)) {
        stoppedEarly = true;
        break;
      }
      try {
        // Cheap skip: check the filename-derived date before paying for a full
        // file read on files we already have (some of these files are large).
        try {
          const filenameDate = dateFromFilename(file);
          if (filenameDate < cutoff || alreadySynced.has(filenameDate)) continue;
        } catch {
          // filename doesn't carry a date; fall through to reading the file
        }

        const text = readFileSync(join(folderPath, file), "utf-8");
        const asOfMatch = text.match(/As of\s+(.+)/i);
        const snapshotDate = asOfMatch ? parseFlexibleDate(asOfMatch[1]) : null;
        if (!snapshotDate) {
          inventoryErrors.push({ file: `${folder.name}/${file}`, error: 'No "As of <date>" line found' });
          continue;
        }
        if (snapshotDate < cutoff || alreadySynced.has(snapshotDate)) continue;

        onProgress(`Inventory: importing ${store.name} — ${file}`);
        const rows = parseInventoryCsv(text);
        const client = await pool.connect();
        try {
          await client.query("begin");
          await copyUpsertInventorySnapshots(client, storeId, snapshotDate, rows);
          await client.query("commit");
        } catch (e) {
          await client.query("rollback");
          throw e;
        } finally {
          client.release();
        }

        inventory.push({ folder: folder.name, store: store.name, file, imported: rows.length });
      } catch (e) {
        inventoryErrors.push({ file: `${folder.name}/${file}`, error: e instanceof Error ? e.message : String(e) });
      }
    }
    if (stoppedEarly) break;
  }

  return { inventory, inventoryUnmatchedFolders, inventoryErrors, inventoryStoppedEarly: stoppedEarly };
}

interface DailyTotal {
  storeId: string;
  date: string;
  totalQuantity: number;
  totalOrders: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  taxes: number;
  shipping: number;
  totalSales: number;
  cogs: number;
  grossMargin: number;
}

interface UserDailyTotal extends DailyTotal {
  userName: string;
}

interface OrderTotal extends DailyTotal {
  orderName: string;
  userName: string;
  discountName: string;
}

interface DiscountTotal {
  storeId: string;
  date: string;
  userName: string;
  discountName: string;
  totalDiscounts: number;
  totalOrders: number;
}

/**
 * Full overwrite (delete-scoped-or-truncate, then reload), not incremental
 * upsert — the sheet's own totals can change retroactively (a user can
 * enter/correct an order dated earlier in the year), so an upsert that only
 * ever adds or updates by key can't detect a row that needs to disappear or
 * shift. `ranges` lets the caller combine multiple tabs (the current-year
 * tab alone for the daily job; current + prior-year archive tabs for a
 * one-time historical load). `deleteFromDate` scopes what gets wiped before
 * reloading — null truncates every affected table outright (full backfill);
 * a date only deletes rows from that date forward, leaving earlier history
 * (already-closed prior years) untouched — this is what makes the daily job
 * a "refresh the current year, don't touch prior years" operation instead of
 * a full re-truncate every time.
 *
 * Each order is exploded into one row per line item (a real product/SKU
 * line, or a synthetic line like "[Tax]"/"[Shipping]"/"[Refund disc...").
 * Verified against real data that a multi-line order's financials are
 * apportioned per line (not the whole order repeated on every line), so
 * summing every line for a store+date/user+date/order reproduces the true
 * total. Order-level fields (Location Name, Order User name, Order Discount
 * names) repeat identically across an order's lines — including staying
 * genuinely blank for every line of an unattributed order — so they're read
 * directly per row with no forward-fill.
 */
async function syncSalesFromSheet(
  sheetId: string,
  ranges: string[],
  stores: StoreRef[],
  aliases: StoreAlias[],
  deleteFromDate: string | null,
  onProgress: SyncProgress = noopProgress,
): Promise<{ sales: SyncSummary["sales"]; discounts: SyncSummary["discounts"] }> {
  onProgress(`Fetching sales sheet (${ranges.length} tab${ranges.length === 1 ? "" : "s"})`);
  const sheets = getSheetsClient();
  const rows: ReturnType<typeof parseSalesCsv> = [];
  for (const range of ranges) {
    const res = await sheets.spreadsheets.values.get(
      { spreadsheetId: sheetId, range },
      { timeout: GOOGLE_REQUEST_TIMEOUT_MS },
    );
    const csv = rowsToCsv((res.data.values ?? []) as string[][]);
    rows.push(...parseSalesCsv(csv));
  }
  onProgress(`Aggregating ${rows.length.toLocaleString("en-US")} line-item rows`);

  const unmatched = new Set<string>();
  const dailyTotals = new Map<string, DailyTotal>();
  const userTotals = new Map<string, UserDailyTotal>();
  const discountTotals = new Map<string, DiscountTotal>();
  const orderTotals = new Map<string, OrderTotal>();
  const orderLineRows: (string | number | null)[][] = [];
  let matchedRowCount = 0;
  let discountedLineCount = 0;

  // "Total orders" in the sheet is a per-LINE flag (1 on a line that
  // represents a real sold unit, 0 on refund/synthetic lines) — NOT a
  // per-order count, even though it looks like one. Confirmed against live
  // data: a single 13-line order had total_orders=1 on every one of its 13
  // product lines, so summing it the way every other numeric column is
  // summed would report that one order as 13. The correct order count is
  // the number of DISTINCT order names touching a given bucket, tracked
  // here and applied to each Total's totalOrders after the main loop.
  const dailyOrderNames = new Map<string, Set<string>>();
  const userOrderNames = new Map<string, Set<string>>();
  const discountOrderNames = new Map<string, Set<string>>();

  for (const r of rows) {
    const storeId = resolveStoreId(r.locationName, stores, aliases, "sheet");
    if (!storeId) {
      unmatched.add(r.locationName);
      continue;
    }
    matchedRowCount++;

    const key = `${storeId}|${r.orderDate}`;
    let day = dailyTotals.get(key);
    if (!day) {
      day = {
        storeId,
        date: r.orderDate,
        totalQuantity: 0,
        totalOrders: 0,
        grossSales: 0,
        discounts: 0,
        refunds: 0,
        netSales: 0,
        taxes: 0,
        shipping: 0,
        totalSales: 0,
        cogs: 0,
        grossMargin: 0,
      };
      dailyTotals.set(key, day);
    }
    if (r.orderName) {
      if (!dailyOrderNames.has(key)) dailyOrderNames.set(key, new Set());
      dailyOrderNames.get(key)!.add(r.orderName);
    }
    day.totalQuantity += r.quantity ?? 0;
    day.grossSales += r.grossSales ?? 0;
    day.discounts += r.discounts ?? 0;
    day.refunds += r.refunds ?? 0;
    day.netSales += r.netSales ?? 0;
    day.taxes += r.taxes ?? 0;
    day.shipping += r.shipping ?? 0;
    day.totalSales += r.totalSales ?? 0;
    day.cogs += r.cogs ?? 0;
    day.grossMargin += r.grossMargin ?? 0;

    // Same aggregation as above, but also split by user — this is what lets
    // the Sales page compare a user's sales against their discount usage in
    // one row instead of two separate reports.
    const userKey = `${storeId}|${r.orderDate}|${r.userName}`;
    let userDay = userTotals.get(userKey);
    if (!userDay) {
      userDay = {
        storeId,
        date: r.orderDate,
        userName: r.userName,
        totalQuantity: 0,
        totalOrders: 0,
        grossSales: 0,
        discounts: 0,
        refunds: 0,
        netSales: 0,
        taxes: 0,
        shipping: 0,
        totalSales: 0,
        cogs: 0,
        grossMargin: 0,
      };
      userTotals.set(userKey, userDay);
    }
    if (r.orderName) {
      if (!userOrderNames.has(userKey)) userOrderNames.set(userKey, new Set());
      userOrderNames.get(userKey)!.add(r.orderName);
    }
    userDay.totalQuantity += r.quantity ?? 0;
    userDay.grossSales += r.grossSales ?? 0;
    userDay.discounts += r.discounts ?? 0;
    userDay.refunds += r.refunds ?? 0;
    userDay.netSales += r.netSales ?? 0;
    userDay.taxes += r.taxes ?? 0;
    userDay.shipping += r.shipping ?? 0;
    userDay.totalSales += r.totalSales ?? 0;
    userDay.cogs += r.cogs ?? 0;
    userDay.grossMargin += r.grossMargin ?? 0;

    if (r.discountNames) {
      // Store+date+user+discount-combo key can repeat across multiple lines
      // (or multiple orders) in a day — sum them rather than pushing one row
      // per line.
      discountedLineCount++;
      const discountKey = `${storeId}|${r.orderDate}|${r.userName}|${r.discountNames}`;
      let discountTotal = discountTotals.get(discountKey);
      if (!discountTotal) {
        discountTotal = {
          storeId,
          date: r.orderDate,
          userName: r.userName,
          discountName: r.discountNames,
          totalDiscounts: 0,
          totalOrders: 0,
        };
        discountTotals.set(discountKey, discountTotal);
      }
      discountTotal.totalDiscounts += r.discounts ?? 0;
      if (r.orderName) {
        if (!discountOrderNames.has(discountKey)) discountOrderNames.set(discountKey, new Set());
        discountOrderNames.get(discountKey)!.add(r.orderName);
      }
    }

    if (r.orderName) {
      // Order-level aggregate (sum across every line sharing this order
      // name) for sales_orders — a raw per-line upsert keyed on order_name
      // would just overwrite itself down to the last line's partial amounts
      // now that an order can span several rows. An order name can recur
      // across a return/exchange line posted months after the original sale
      // (confirmed in live data, e.g. a sale on 2024-10-29 refunded on
      // 2025-05-09 under the same order name, across two different sheet
      // tabs) — always anchor the order's date/store/user to its EARLIEST
      // line rather than whichever line is processed first, so a full
      // multi-tab backfill doesn't misattribute an order to the wrong year
      // depending on tab order.
      let ord = orderTotals.get(r.orderName);
      if (!ord) {
        ord = {
          storeId,
          orderName: r.orderName,
          date: r.orderDate,
          userName: r.userName,
          discountName: r.discountNames,
          totalQuantity: 0,
          // Always exactly 1 — this map is already keyed by order_name, so
          // each entry IS one order by construction. The raw per-line
          // "Total orders" flag isn't a count to sum (see note above).
          totalOrders: 1,
          grossSales: 0,
          discounts: 0,
          refunds: 0,
          netSales: 0,
          taxes: 0,
          shipping: 0,
          totalSales: 0,
          cogs: 0,
          grossMargin: 0,
        };
        orderTotals.set(r.orderName, ord);
      } else if (r.orderDate < ord.date) {
        ord.date = r.orderDate;
        ord.storeId = storeId;
        ord.userName = r.userName;
        ord.discountName = r.discountNames;
      }
      ord.totalQuantity += r.quantity ?? 0;
      ord.grossSales += r.grossSales ?? 0;
      ord.discounts += r.discounts ?? 0;
      ord.refunds += r.refunds ?? 0;
      ord.netSales += r.netSales ?? 0;
      ord.taxes += r.taxes ?? 0;
      ord.shipping += r.shipping ?? 0;
      ord.totalSales += r.totalSales ?? 0;
      ord.cogs += r.cogs ?? 0;
      ord.grossMargin += r.grossMargin ?? 0;

      // Raw per-line detail (SKU/product/customer) — no aggregation, this is
      // the new granularity the extra sheet columns exist to capture.
      orderLineRows.push([
        storeId, r.orderName, r.orderDate, r.userName, r.discountNames,
        r.productCategory, r.productType, r.coreSku, r.variantSku,
        r.customerType, r.customerTags, r.customerFullName, r.customerTotalNetSpent,
        r.quantity, r.totalOrders, r.grossSales, r.discounts, r.refunds, r.netSales,
        r.taxes, r.shipping, r.totalSales, r.cogs, r.grossMargin,
      ]);
    }
  }

  for (const [key, day] of dailyTotals) day.totalOrders = dailyOrderNames.get(key)?.size ?? 0;
  for (const [key, userDay] of userTotals) userDay.totalOrders = userOrderNames.get(key)?.size ?? 0;
  for (const [key, discountTotal] of discountTotals) discountTotal.totalOrders = discountOrderNames.get(key)?.size ?? 0;

  const salesRows = [...dailyTotals.values()].map((d) => [
    d.storeId, d.date, d.totalQuantity, d.totalOrders, d.grossSales, d.discounts, d.refunds,
    d.netSales, d.taxes, d.shipping, d.totalSales, d.cogs, d.grossMargin,
  ]);
  const userSalesRows = [...userTotals.values()].map((d) => [
    d.storeId, d.date, d.userName, d.totalQuantity, d.totalOrders, d.grossSales, d.discounts, d.refunds,
    d.netSales, d.taxes, d.shipping, d.totalSales, d.cogs, d.grossMargin,
  ]);
  const discountRows = [...discountTotals.values()].map((d) => [
    d.storeId, d.date, d.userName, d.discountName, d.totalDiscounts, d.totalOrders,
  ]);
  const orderRows = [...orderTotals.values()].map((o) => [
    o.storeId, o.orderName, o.date, o.userName, o.discountName, o.totalQuantity, o.totalOrders,
    o.grossSales, o.discounts, o.refunds, o.netSales, o.taxes, o.shipping,
    o.totalSales, o.cogs, o.grossMargin,
  ]);

  onProgress(
    `Loading ${salesRows.length.toLocaleString("en-US")} daily, ${userSalesRows.length.toLocaleString("en-US")} user-daily, ` +
      `${orderRows.length.toLocaleString("en-US")} orders, ${discountRows.length.toLocaleString("en-US")} discount combos, ` +
      `${orderLineRows.length.toLocaleString("en-US")} line items`,
  );

  const client = await pool.connect();
  try {
    await client.query("begin");
    // sales_order_lines now carries one row per line item (up to ~240k for a
    // full 3-year reload, ~85k-and-growing for a current-year-only daily
    // refresh) — its COPY alone can run well past the pool's normal 30s
    // statement_timeout (built for report queries, not bulk loads). Scoped to
    // this transaction only, so report-serving queries elsewhere keep the
    // tight 30s guard. Measured ~226s for an 87k-line current-year load in
    // August; left headroom for the rest of the year plus the 3-year backfill.
    await client.query("set local statement_timeout = '600000'");
    await deleteAndLoadTable(
      client, "sales_daily", "order_date", deleteFromDate,
      ["store_id", "order_date", "total_quantity", "total_orders", "gross_sales", "discounts", "refunds",
       "net_sales", "taxes", "shipping", "total_sales", "cogs", "gross_margin"],
      salesRows,
    );
    await deleteAndLoadTable(
      client, "sales_by_user", "day_date", deleteFromDate,
      ["store_id", "day_date", "user_name", "total_quantity", "total_orders", "gross_sales", "discounts", "refunds",
       "net_sales", "taxes", "shipping", "total_sales", "cogs", "gross_margin"],
      userSalesRows,
    );
    if (deleteFromDate !== null && orderRows.length > 0) {
      // order_name is unique across the whole table, but an order can get a
      // return/exchange line posted in a later calendar year under the same
      // order name (confirmed in live data) — its sales_orders row then
      // keeps the ORIGINAL sale's day_date, which can fall outside this
      // scoped reload's date window. Without this, re-inserting that order
      // name during a current-year-only refresh would hit the unique
      // constraint. Delete by name first so the fresh row (from this sync's
      // date-scoped view of the order) replaces it cleanly.
      await client.query("delete from sales_orders where order_name = any($1)", [
        orderRows.map((o) => o[1]),
      ]);
    }
    await deleteAndLoadTable(
      client, "sales_orders", "day_date", deleteFromDate,
      ["store_id", "order_name", "day_date", "user_name", "discount_name", "total_quantity", "total_orders",
       "gross_sales", "discounts", "refunds", "net_sales", "taxes", "shipping", "total_sales",
       "cogs", "gross_margin"],
      orderRows,
    );
    await deleteAndLoadTable(
      client, "discounts", "day_date", deleteFromDate,
      ["store_id", "day_date", "user_name", "discount_name", "total_discounts", "total_orders"],
      discountRows,
    );
    await deleteAndLoadTable(
      client, "sales_order_lines", "day_date", deleteFromDate,
      ["store_id", "order_name", "day_date", "user_name", "discount_name", "product_category",
       "product_type", "core_sku", "variant_sku", "customer_type", "customer_tags",
       "customer_full_name", "customer_total_net_spent", "quantity", "total_orders", "gross_sales",
       "discounts", "refunds", "net_sales", "taxes", "shipping", "total_sales", "cogs", "gross_margin"],
      orderLineRows,
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  return {
    sales: {
      imported: salesRows.length,
      skipped: rows.length - matchedRowCount,
      unmatchedLocations: [...unmatched],
    },
    discounts: {
      imported: discountRows.length,
      skipped: matchedRowCount - discountedLineCount,
      unmatchedLocations: [...unmatched],
    },
  };
}

async function copyLoadTable(
  client: import("pg").PoolClient,
  table: string,
  columns: string[],
  rows: (string | number | null)[][],
): Promise<void> {
  await client.query(`truncate table ${table}`);
  if (rows.length === 0) return;
  await streamCopy(client, `COPY ${table} (${columns.join(", ")}) FROM STDIN WITH (FORMAT csv)`, rowsToCsvNullable(rows));
}

/**
 * Full overwrite (truncate + reload), not incremental like sales — PO status
 * and quantities get corrected in place over a PO's lifecycle, so there's no
 * append-only watermark to track. All three tabs load in one transaction so
 * a run that dies partway leaves the old data intact rather than mismatched
 * (e.g. a fresh dashboard next to a stale raw-data table).
 */
async function syncRetailAuditFromSheet(
  sheetId: string,
  onProgress: SyncProgress = noopProgress,
): Promise<SyncSummary["retailAudit"]> {
  onProgress("Fetching PO / Retail Audit sheet");
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.batchGet(
    {
      spreadsheetId: sheetId,
      ranges: ["'All PO Raw Data'!A:Z", "'Retail Audit Raw Data'!A:Z", "'Dashboard'!A:R"],
    },
    { timeout: GOOGLE_REQUEST_TIMEOUT_MS },
  );
  const [poRes, auditRes, dashRes] = res.data.valueRanges ?? [];
  const poRows = parsePoRawCsv(rowsToCsv((poRes?.values ?? []) as string[][]));
  const auditRows = parseRetailAuditRawCsv(rowsToCsv((auditRes?.values ?? []) as string[][]));
  const dashboardRows = parseDashboardCsv(rowsToCsv((dashRes?.values ?? []) as string[][]));

  onProgress(
    `Loading PO/Retail Audit data (${poRows.length.toLocaleString("en-US")} PO lines, ${auditRows.length.toLocaleString("en-US")} audit lines, ${dashboardRows.length.toLocaleString("en-US")} POs)`,
  );

  const client = await pool.connect();
  try {
    await client.query("begin");
    // Same reasoning as the sales transaction's override: this table's COPY
    // (127k+ rows combined) has been observed exceeding the pool's normal
    // 30s statement_timeout under real network conditions, not just in the
    // much larger sales load.
    await client.query("set local statement_timeout = '180000'");
    await copyLoadTable(
      client,
      "po_raw_data",
      [
        "internal_id", "document_number", "po_date", "vendor_name", "location", "status", "mac_po_type",
        "mac_po_status", "po_start_date", "po_cancel_date", "due_date", "expected_receipt_date", "memo",
        "line_id", "item", "display_name", "quantity", "quantity_fulfilled_received", "inventory_location",
        "quantity_billed", "quantity_committed",
      ],
      poRows.map((r) => [
        r.internalId, r.documentNumber, r.poDate, r.vendorName, r.location, r.status, r.macPoType,
        r.macPoStatus, r.poStartDate, r.poCancelDate, r.dueDate, r.expectedReceiptDate, r.memo,
        r.lineId, r.item, r.displayName, r.quantity, r.quantityFulfilledReceived, r.inventoryLocation,
        r.quantityBilled, r.quantityCommitted,
      ]),
    );
    await copyLoadTable(
      client,
      "retail_audit_raw_data",
      [
        "vendor", "po_number", "purchasing_trans_type", "po_date", "sku", "item_name", "quantity_received",
        "quantity_billed", "customer", "sp_number", "sales_trans_type", "sales_trans_date", "quantity_shipped",
        "quantity_invoiced",
      ],
      auditRows.map((r) => [
        r.vendor, r.poNumber, r.purchasingTransType, r.poDate, r.sku, r.itemName, r.quantityReceived,
        r.quantityBilled, r.customer, r.spNumber, r.salesTransType, r.salesTransDate, r.quantityShipped,
        r.quantityInvoiced,
      ]),
    );
    await copyLoadTable(
      client,
      "retail_audit_dashboard",
      [
        "po_number", "po_date", "po_status", "related_sp", "vendor_name", "ordered_quantity",
        "billed_quantity", "shipped_quantity", "received_quantity", "diff_shipped_received", "diff_received_billed",
      ],
      dashboardRows.map((r) => [
        r.poNumber, r.poDate, r.poStatus, r.relatedSp, r.vendorName, r.orderedQuantity,
        r.billedQuantity, r.shippedQuantity, r.receivedQuantity, r.diffShippedReceived, r.diffReceivedBilled,
      ]),
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  return { poRows: poRows.length, auditRows: auditRows.length, dashboardRows: dashboardRows.length };
}

/**
 * Full historical reload across all of `ranges` (e.g. the current-year tab
 * plus prior-year archive tabs), unconditionally truncating and reloading
 * every sales table. Not part of the regular daily sync — the daily job
 * (via runSync) only ever refreshes the current year. Intended for one-off
 * use, e.g. right after the sheet's format changes and a full re-baseline
 * is needed.
 */
export async function runFullSalesBackfill(
  sheetId: string,
  ranges: string[],
  onProgress: SyncProgress = noopProgress,
): Promise<{ sales: SyncSummary["sales"]; discounts: SyncSummary["discounts"] }> {
  const { stores, aliases } = await getStoresAndAliases();
  return syncSalesFromSheet(sheetId, ranges, stores, aliases, null, onProgress);
}

export type InventorySyncResult = Pick<
  SyncSummary,
  "inventory" | "inventoryUnmatchedFolders" | "inventoryErrors" | "inventoryStoppedEarly" | "inventoryPruned"
> & { errors: string[] };

/**
 * Inventory phase only — split out from the old combined runSync() so each
 * phase gets its own maxDuration budget instead of all three sharing one
 * (the combined route was hitting Vercel's function-duration ceiling as the
 * sales sheet grew). Safe to call on its own schedule/button independent of
 * the other two phases.
 */
export async function runInventorySync(
  onProgress: SyncProgress = noopProgress,
  checkCancelled: CancelCheck = noopCancelCheck,
): Promise<InventorySyncResult> {
  const errors: string[] = [];
  onProgress("Loading stores");
  const { stores, aliases } = await getStoresAndAliases();

  let inventoryResult: Pick<
    SyncSummary,
    "inventory" | "inventoryUnmatchedFolders" | "inventoryErrors" | "inventoryStoppedEarly"
  > = {
    inventory: [],
    inventoryUnmatchedFolders: [],
    inventoryErrors: [],
    inventoryStoppedEarly: false,
  };
  const inventoryDeadline = Date.now() + INVENTORY_TIME_BUDGET_MS;
  const localRoot = process.env.LOCAL_INVENTORY_ROOT_PATH;
  const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID || null;
  if (localRoot) {
    try {
      inventoryResult = await syncInventoryFromLocalFolder(
        localRoot,
        stores,
        aliases,
        onProgress,
        checkCancelled,
        inventoryDeadline,
      );
    } catch (e) {
      if (e instanceof SyncCancelledError) throw e;
      errors.push(`Inventory sync failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    // No DRIVE_ROOT_FOLDER_ID is fine — syncInventoryFromDrive falls back to
    // whatever folders are shared directly with the service account.
    try {
      inventoryResult = await syncInventoryFromDrive(
        rootFolderId,
        stores,
        aliases,
        onProgress,
        checkCancelled,
        inventoryDeadline,
      );
    } catch (e) {
      if (e instanceof SyncCancelledError) throw e;
      errors.push(`Inventory sync failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (inventoryResult.inventoryStoppedEarly) {
    onProgress("Inventory backfill hit its time budget — remaining stores/dates will continue on the next sync");
  }

  await throwIfCancelled(checkCancelled);
  onProgress("Pruning inventory older than 30 days");
  let inventoryPruned = 0;
  try {
    inventoryPruned = await pruneOldInventorySnapshots();
  } catch (e) {
    errors.push(`Inventory pruning failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  onProgress("Finishing up");
  return { ...inventoryResult, inventoryPruned, errors };
}

export type SalesSyncResult = Pick<SyncSummary, "sales" | "discounts"> & { errors: string[] };

/**
 * Sales/discounts phase only (current calendar year, scoped delete-and-
 * reload) — the heaviest of the three phases now that the sheet is
 * line-item grain, and the one most likely to need its own full budget.
 */
export async function runSalesSync(onProgress: SyncProgress = noopProgress): Promise<SalesSyncResult> {
  const errors: string[] = [];
  onProgress("Loading stores");
  const { stores, aliases } = await getStoresAndAliases();

  // Discounts now come from the Sales sheet itself (each row is a per-user,
  // per-discount-combo slice of a day's orders), so one fetch covers both —
  // no separate Discounts sheet needed. Daily runs only touch the current
  // calendar year (deleteFromDate = Jan 1) — prior years are loaded once via
  // the standalone full-history backfill and never re-touched by this job,
  // since closed years don't get corrected.
  let sales: SyncSummary["sales"] = null;
  let discounts: SyncSummary["discounts"] = null;
  const salesSheetId = process.env.SALES_SHEET_ID;
  if (salesSheetId) {
    try {
      const yearStart = `${new Date().getFullYear()}-01-01`;
      const result = await syncSalesFromSheet(
        salesSheetId,
        [process.env.SALES_SHEET_RANGE || "'Year to Date Sales in Google sheets'!A:X"],
        stores,
        aliases,
        yearStart,
        onProgress,
      );
      sales = result.sales;
      discounts = result.discounts;
    } catch (e) {
      errors.push(`Sales/discounts sync failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errors.push("SALES_SHEET_ID is not set; skipped sales/discounts sync");
  }

  onProgress("Finishing up");
  return { sales, discounts, errors };
}

export type RetailAuditSyncResult = Pick<SyncSummary, "retailAudit"> & { errors: string[] };

/** Retail Audit phase only (PO / Retail Audit sheet, full overwrite). */
export async function runRetailAuditSync(onProgress: SyncProgress = noopProgress): Promise<RetailAuditSyncResult> {
  const errors: string[] = [];
  let retailAudit: SyncSummary["retailAudit"] = null;
  const poSheetId = process.env.PO_SHEET_ID;
  if (poSheetId) {
    try {
      retailAudit = await syncRetailAuditFromSheet(poSheetId, onProgress);
    } catch (e) {
      errors.push(`PO/Retail Audit sync failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  onProgress("Finishing up");
  return { retailAudit, errors };
}

/**
 * Convenience wrapper that runs all three phases back to back — useful for
 * local/manual use, but no longer what any route calls: on Vercel Hobby's
 * 300s function-duration ceiling, running all three in one invocation risks
 * the combined time exceeding the limit as the sales sheet grows. The admin
 * UI and the daily cron each trigger the three phases as separate
 * invocations instead, so every phase gets its own full budget.
 */
export async function runSync(
  onProgress: SyncProgress = noopProgress,
  checkCancelled: CancelCheck = noopCancelCheck,
): Promise<SyncSummary> {
  const inventoryResult = await runInventorySync(onProgress, checkCancelled);
  await throwIfCancelled(checkCancelled);
  const salesResult = await runSalesSync(onProgress);
  await throwIfCancelled(checkCancelled);
  const retailAuditResult = await runRetailAuditSync(onProgress);

  return {
    ...inventoryResult,
    ...salesResult,
    ...retailAuditResult,
    errors: [...inventoryResult.errors, ...salesResult.errors, ...retailAuditResult.errors],
  };
}
