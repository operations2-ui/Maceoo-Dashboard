import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Readable } from "stream";
import { from as copyFrom } from "pg-copy-streams";
import { pool } from "./db";
import { getDriveClient, getSheetsClient } from "./google-clients";
import { parseInventoryCsv, dateFromFilename, type InventoryRow } from "./inventory-parser";
import { parseDiscountsCsv } from "./discounts-parser";
import { parseSalesCsv } from "./sales-parser";
import { resolveStoreId, type StoreRef, type StoreAlias } from "./store-resolver";
import { rowsToCsv } from "./csv-utils";
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

export interface SyncSummary {
  inventory: { folder: string; store: string; file: string; imported: number }[];
  inventoryUnmatchedFolders: string[];
  inventoryErrors: { file: string; error: string }[];
  inventoryPruned: number;
  inventoryStoppedEarly: boolean;
  discounts: { imported: number; skipped: number; unmatchedLocations: string[] } | null;
  sales: { imported: number; skipped: number; unmatchedLocations: string[] } | null;
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

/**
 * Builds a single batched `INSERT ... VALUES (...),(...),... ON CONFLICT DO
 * UPDATE` statement for a chunk of rows. One-row-per-await was fine against
 * local Postgres but far too slow once the DB is on a remote host (RDS) â€”
 * thousands of sequential round trips can blow past a serverless function's
 * execution time limit. Batching turns that into a handful of round trips.
 */
function buildBatchUpsertQuery(
  table: string,
  columns: string[],
  conflictColumns: string[],
  updateColumns: string[],
  rows: unknown[][],
): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const valueGroups = rows.map((row, rowIdx) => {
    const placeholders = row.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`);
    values.push(...row);
    return `(${placeholders.join(", ")})`;
  });
  const updateClause = updateColumns.map((c) => `${c} = excluded.${c}`).join(", ");
  const text = `
    insert into ${table} (${columns.join(", ")})
    values ${valueGroups.join(", ")}
    on conflict (${conflictColumns.join(", ")})
    do update set ${updateClause}
  `;
  return { text, values };
}

async function batchUpsert(
  client: import("pg").PoolClient,
  table: string,
  columns: string[],
  conflictColumns: string[],
  updateColumns: string[],
  allRows: unknown[][],
  batchSize = 500,
): Promise<void> {
  for (let i = 0; i < allRows.length; i += batchSize) {
    const chunk = allRows.slice(i, i + batchSize);
    const { text, values } = buildBatchUpsertQuery(table, columns, conflictColumns, updateColumns, chunk);
    await client.query(text, values);
  }
}

async function syncDiscountsFromSheet(
  sheetId: string,
  range: string,
  stores: StoreRef[],
  aliases: StoreAlias[],
): Promise<SyncSummary["discounts"]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get(
    { spreadsheetId: sheetId, range },
    { timeout: GOOGLE_REQUEST_TIMEOUT_MS },
  );
  const csv = rowsToCsv((res.data.values ?? []) as string[][]);
  const rows = parseDiscountsCsv(csv);

  const unmatched = new Set<string>();
  const matchedRows: unknown[][] = [];
  for (const r of rows) {
    const storeId = resolveStoreId(r.locationName, stores, aliases, "sheet");
    if (!storeId) {
      unmatched.add(r.locationName);
      continue;
    }
    matchedRows.push([storeId, r.dayDate, r.userName, r.discountName, r.totalDiscounts, r.orderId, r.posFlag, r.totalOrders]);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await batchUpsert(
      client,
      "discounts",
      ["store_id", "day_date", "user_name", "discount_name", "total_discounts", "order_id", "pos_flag", "total_orders"],
      ["store_id", "day_date", "order_id", "discount_name"],
      ["user_name", "total_discounts", "pos_flag", "total_orders"],
      matchedRows,
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  return { imported: matchedRows.length, skipped: rows.length - matchedRows.length, unmatchedLocations: [...unmatched] };
}

async function syncSalesFromSheet(
  sheetId: string,
  range: string,
  stores: StoreRef[],
  aliases: StoreAlias[],
): Promise<SyncSummary["sales"]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get(
    { spreadsheetId: sheetId, range },
    { timeout: GOOGLE_REQUEST_TIMEOUT_MS },
  );
  const csv = rowsToCsv((res.data.values ?? []) as string[][]);
  const rows = parseSalesCsv(csv);

  const unmatched = new Set<string>();
  const matchedRows: unknown[][] = [];
  for (const r of rows) {
    const storeId = resolveStoreId(r.locationName, stores, aliases, "sheet");
    if (!storeId) {
      unmatched.add(r.locationName);
      continue;
    }
    matchedRows.push([
      storeId,
      r.orderDate,
      r.totalOrders,
      r.grossSales,
      r.discounts,
      r.refunds,
      r.netSales,
      r.taxes,
      r.shipping,
      r.totalSales,
      r.cogs,
      r.grossMargin,
    ]);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await batchUpsert(
      client,
      "sales_daily",
      [
        "store_id", "order_date", "total_orders", "gross_sales", "discounts", "refunds",
        "net_sales", "taxes", "shipping", "total_sales", "cogs", "gross_margin",
      ],
      ["store_id", "order_date"],
      [
        "total_orders", "gross_sales", "discounts", "refunds", "net_sales",
        "taxes", "shipping", "total_sales", "cogs", "gross_margin",
      ],
      matchedRows,
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  return { imported: matchedRows.length, skipped: rows.length - matchedRows.length, unmatchedLocations: [...unmatched] };
}

export async function runSync(
  onProgress: SyncProgress = noopProgress,
  checkCancelled: CancelCheck = noopCancelCheck,
): Promise<SyncSummary> {
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

  await throwIfCancelled(checkCancelled);
  let discounts: SyncSummary["discounts"] = null;
  const discountsSheetId = process.env.DISCOUNTS_SHEET_ID;
  if (discountsSheetId) {
    onProgress("Syncing discounts");
    try {
      discounts = await syncDiscountsFromSheet(
        discountsSheetId,
        process.env.DISCOUNTS_SHEET_RANGE || "A:Z",
        stores,
        aliases,
      );
    } catch (e) {
      errors.push(`Discounts sync failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errors.push("DISCOUNTS_SHEET_ID is not set; skipped discounts sync");
  }

  await throwIfCancelled(checkCancelled);
  let sales: SyncSummary["sales"] = null;
  const salesSheetId = process.env.SALES_SHEET_ID;
  if (salesSheetId) {
    onProgress("Syncing sales");
    try {
      sales = await syncSalesFromSheet(salesSheetId, process.env.SALES_SHEET_RANGE || "A:Z", stores, aliases);
    } catch (e) {
      errors.push(`Sales sync failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errors.push("SALES_SHEET_ID is not set; skipped sales sync");
  }

  onProgress("Finishing up");
  return { ...inventoryResult, inventoryPruned, discounts, sales, errors };
}
