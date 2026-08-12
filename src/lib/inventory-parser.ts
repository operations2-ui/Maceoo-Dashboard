import Papa from "papaparse";

export interface InventoryRow {
  sku: string;
  styleCode: string;
  sizeCode: string;
  description: string;
  vendor: string;
  onHand: number;
}

/**
 * Parses a "Physical Inventory Worksheet" CSV export (Item, Description,
 * Pref. Vendor, On Hand, Physical Count) into flat variant rows.
 *
 * Row shapes in the source file:
 *  - style row:   Item = style code, everything else blank -> sets the
 *                 current style prefix for subsequent variant rows
 *  - variant row: Item = full SKU, Description populated, On Hand = qty
 *  - total row:   Item = "Total - <sku>" -> skipped, recomputed elsewhere
 *
 * styleCode/sizeCode are derived by diffing the variant SKU against the
 * preceding style row's value (rather than assuming a fixed digit split),
 * since the size suffix width isn't guaranteed to be a single digit.
 */
export function parseInventoryCsv(csvText: string): InventoryRow[] {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: false });
  const rows = parsed.data;

  const headerIdx = rows.findIndex((r) => (r[0] ?? "").trim() === "Item");
  if (headerIdx === -1) {
    throw new Error('Could not find header row (column A === "Item")');
  }

  const result: InventoryRow[] = [];
  let currentStyleCode: string | null = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const item = (row[0] ?? "").trim();
    const description = (row[1] ?? "").trim();
    const vendor = (row[2] ?? "").trim();
    const onHandRaw = (row[3] ?? "").trim();

    if (!item) continue;
    if (item.startsWith("Total - ")) continue;

    if (!description) {
      // style header row
      currentStyleCode = item;
      continue;
    }

    const onHand = onHandRaw === "" ? 0 : Number(onHandRaw);
    if (Number.isNaN(onHand)) {
      throw new Error(`Unparseable On Hand value "${onHandRaw}" for SKU ${item}`);
    }

    const styleCode =
      currentStyleCode && item.startsWith(currentStyleCode)
        ? currentStyleCode
        : item.slice(0, -1);
    const sizeCode = item.startsWith(styleCode) ? item.slice(styleCode.length) : item;

    result.push({
      sku: item,
      styleCode,
      sizeCode,
      description,
      vendor,
      onHand,
    });
  }

  return result;
}

/** Extracts the YYYY-MM-DD date from a filename like "2026-08-08_report.csv". */
export function dateFromFilename(filename: string): string {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  if (!match) throw new Error(`Could not extract date from filename "${filename}"`);
  return match[1];
}
