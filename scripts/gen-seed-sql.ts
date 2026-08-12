import { readFileSync } from "fs";
import { join } from "path";
import { parseInventoryCsv, dateFromFilename } from "../src/lib/inventory-parser";

const PARIS_STORE_ID = "ab7ae5af-0395-4828-8696-55162dd0dca1";
const dir = join(__dirname, "..", "src", "lib", "__fixtures__");

function esc(s: string) {
  return s.replace(/'/g, "''");
}

const files = ["paris_2026-08-06_report.csv", "paris_2026-08-07_report.csv"];
const values: string[] = [];

for (const f of files) {
  const date = dateFromFilename(f);
  const rows = parseInventoryCsv(readFileSync(join(dir, f), "utf-8"));
  for (const r of rows) {
    values.push(
      `('${PARIS_STORE_ID}','${date}','${esc(r.sku)}','${esc(r.styleCode)}','${esc(r.sizeCode)}','${esc(r.description)}','${esc(r.vendor)}',${r.onHand})`,
    );
  }
}

console.log(
  "insert into inventory_snapshots (store_id, snapshot_date, sku, style_code, size_code, description, vendor, on_hand) values\n" +
    values.join(",\n") +
    "\non conflict (store_id, snapshot_date, sku) do update set on_hand = excluded.on_hand;",
);
