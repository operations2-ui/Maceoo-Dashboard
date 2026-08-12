import { config } from "dotenv";
import { join } from "path";
config({ path: join(__dirname, "..", ".env.local") });

import { readdirSync, readFileSync } from "fs";
import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { Readable } from "stream";
import { parseInventoryCsv } from "../src/lib/inventory-parser";
import { parseFlexibleDate } from "../src/lib/date-utils";
import { rowsToCsv } from "../src/lib/csv-utils";
import { resolveStoreId, type StoreRef, type StoreAlias } from "../src/lib/store-resolver";

const ROOT = process.argv[2] || join(__dirname, "..", "data", "inventory");

async function streamCopy(client: Client, sql: string, csvText: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = client.query(copyFrom(sql));
    const readable = Readable.from([csvText]);
    readable.on("error", reject);
    stream.on("error", reject);
    stream.on("finish", resolve);
    readable.pipe(stream);
  });
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows: stores } = await client.query<StoreRef>("select id, name, code from stores");
  const { rows: aliases } = await client.query<StoreAlias>(
    "select store_id, source, alias_name from store_aliases",
  );

  await client.query(`
    create temporary table staging_inventory (
      store_id uuid, snapshot_date date, sku text, style_code text, size_code text,
      description text, vendor text, on_hand integer
    ) on commit preserve rows;
  `);

  const storeFolders = readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory());
  const unmatchedFolders: string[] = [];
  let totalRowsStaged = 0;
  let fileErrors = 0;

  for (const folder of storeFolders) {
    const storeId = resolveStoreId(folder.name, stores, aliases, "inventory");
    if (!storeId) {
      unmatchedFolders.push(folder.name);
      continue;
    }

    const folderPath = join(ROOT, folder.name);
    const files = readdirSync(folderPath).filter((f) => f.endsWith(".csv"));
    let folderRows = 0;

    for (const file of files) {
      const text = readFileSync(join(folderPath, file), "utf-8");
      const asOfMatch = text.match(/As of\s+(.+)/i);
      if (!asOfMatch) {
        console.error(`SKIP ${folder.name}/${file}: no "As of <date>" line`);
        fileErrors++;
        continue;
      }
      const snapshotDate = parseFlexibleDate(asOfMatch[1]);

      let variantRows;
      try {
        variantRows = parseInventoryCsv(text);
      } catch (e) {
        console.error(`SKIP ${folder.name}/${file}: ${e instanceof Error ? e.message : String(e)}`);
        fileErrors++;
        continue;
      }

      if (variantRows.length === 0) continue;

      const csvRows = variantRows.map((r) => [
        storeId,
        snapshotDate,
        r.sku,
        r.styleCode,
        r.sizeCode,
        r.description,
        r.vendor,
        String(r.onHand),
      ]);
      const csvText = rowsToCsv(csvRows);
      await streamCopy(
        client,
        "COPY staging_inventory (store_id, snapshot_date, sku, style_code, size_code, description, vendor, on_hand) FROM STDIN WITH (FORMAT csv)",
        csvText,
      );
      folderRows += variantRows.length;
    }

    totalRowsStaged += folderRows;
    console.log(`${folder.name}: staged ${folderRows} rows from ${files.length} files`);
  }

  console.log(`\nTotal staged: ${totalRowsStaged} rows. Unmatched folders: ${unmatchedFolders.join(", ") || "none"}`);
  console.log("Running dedupe + upsert into inventory_snapshots (this may take a while for large datasets)...");

  const upsertStart = Date.now();
  const upsertResult = await client.query(`
    insert into inventory_snapshots (store_id, snapshot_date, sku, style_code, size_code, description, vendor, on_hand)
    select distinct on (store_id, snapshot_date, sku)
      store_id, snapshot_date, sku, style_code, size_code, description, vendor, on_hand
    from staging_inventory
    order by store_id, snapshot_date, sku, ctid desc
    on conflict (store_id, snapshot_date, sku) do update set
      style_code = excluded.style_code, size_code = excluded.size_code,
      description = excluded.description, vendor = excluded.vendor, on_hand = excluded.on_hand;
  `);
  console.log(
    `Upserted ${upsertResult.rowCount} rows in ${((Date.now() - upsertStart) / 1000).toFixed(1)}s. File errors: ${fileErrors}.`,
  );

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
