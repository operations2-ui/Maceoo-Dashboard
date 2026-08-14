import { parseRawCsv, findHeaderRowIndex, buildHeaderIndex, cell, numOrNull, intOrNull } from "./csv-utils";
import { parseFlexibleDate } from "./date-utils";

export interface SalesRow {
  locationName: string;
  orderDate: string;
  /** Globally unique per order. Empty on old-format sheets without this column. */
  orderName: string;
  /** User the row's orders are attributed to. Empty on old-format sheets without this column. */
  userName: string;
  /** Comma-separated discount names applied to this slice of orders, or "" if none. */
  discountNames: string;
  totalOrders: number | null;
  grossSales: number | null;
  discounts: number | null;
  refunds: number | null;
  netSales: number | null;
  taxes: number | null;
  shipping: number | null;
  totalSales: number | null;
  cogs: number | null;
  grossMargin: number | null;
}

/**
 * Parses the day-wise sales export. As of the merged Sales+Discounts sheet,
 * each store/day is broken into one row per (user, discount-name combination)
 * slice of that day's orders, rather than a single per-day total row —
 * summing all of a day's rows reproduces the old day-level totals, and rows
 * with a non-empty discount combo double as the discount-usage detail
 * (replacing the separate Discounts sheet).
 * Columns: Location Name, Order name, DAY Order Date, Order User name,
 * Order Discount names, Total orders, Total gross sales, Total discounts,
 * Total refunds, Total net sales, Total taxes, Total shipping, Total sales,
 * Total cost of goods sold, Total gross margin.
 */
export function parseSalesCsv(csvText: string): SalesRow[] {
  const rows = parseRawCsv(csvText);
  const headerIdx = findHeaderRowIndex(rows, "Location Name");
  if (headerIdx === -1) throw new Error('Could not find header row (a cell === "Location Name")');

  const headerIndex = buildHeaderIndex(rows[headerIdx]);
  const result: SalesRow[] = [];
  let lastLocationName = "";

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const dateRaw = cell(row, headerIndex, "DAY Order Date");
    if (!dateRaw) continue;

    const locationCell = cell(row, headerIndex, "Location Name");
    if (locationCell) lastLocationName = locationCell;

    result.push({
      locationName: lastLocationName,
      orderDate: parseFlexibleDate(dateRaw),
      orderName: cell(row, headerIndex, "Order name"),
      userName: cell(row, headerIndex, "Order User name"),
      discountNames: cell(row, headerIndex, "Order Discount names"),
      totalOrders: intOrNull(cell(row, headerIndex, "Total orders")),
      grossSales: numOrNull(cell(row, headerIndex, "Total gross sales")),
      discounts: numOrNull(cell(row, headerIndex, "Total discounts")),
      refunds: numOrNull(cell(row, headerIndex, "Total refunds")),
      netSales: numOrNull(cell(row, headerIndex, "Total net sales")),
      taxes: numOrNull(cell(row, headerIndex, "Total taxes")),
      shipping: numOrNull(cell(row, headerIndex, "Total shipping")),
      totalSales: numOrNull(cell(row, headerIndex, "Total sales")),
      cogs: numOrNull(cell(row, headerIndex, "Total cost of goods sold")),
      grossMargin: numOrNull(cell(row, headerIndex, "Total gross margin")),
    });
  }

  return result;
}
