import { parseRawCsv, findHeaderRowIndex, buildHeaderIndex, cell, numOrNull, intOrNull } from "./csv-utils";
import { parseFlexibleDate } from "./date-utils";

export interface DiscountRow {
  locationName: string;
  dayDate: string;
  userName: string;
  discountName: string;
  totalDiscounts: number;
  orderId: string;
  posFlag: string;
  totalOrders: number | null;
}

/**
 * Parses the "Discount Amount by Date and Location and User Name Wise" export.
 * Columns: DAY Date, Location Name, User name, Discount names, Total discounts,
 * Order id, POS or Non-POS, Total orders. A few filter/metadata rows may precede
 * the real header, so the header row is located by searching for "DAY Date".
 */
export function parseDiscountsCsv(csvText: string): DiscountRow[] {
  const rows = parseRawCsv(csvText);
  const headerIdx = findHeaderRowIndex(rows, "DAY Date");
  if (headerIdx === -1) throw new Error('Could not find header row (a cell === "DAY Date")');

  const headerIndex = buildHeaderIndex(rows[headerIdx]);
  const result: DiscountRow[] = [];
  let lastLocationName = "";

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const dayDateRaw = cell(row, headerIndex, "DAY Date");
    if (!dayDateRaw) continue;

    const locationCell = cell(row, headerIndex, "Location Name");
    if (locationCell) lastLocationName = locationCell;

    result.push({
      dayDate: parseFlexibleDate(dayDateRaw),
      locationName: lastLocationName,
      userName: cell(row, headerIndex, "User name"),
      discountName: cell(row, headerIndex, "Discount names"),
      totalDiscounts: numOrNull(cell(row, headerIndex, "Total discounts")) ?? 0,
      orderId: cell(row, headerIndex, "Order id"),
      posFlag: cell(row, headerIndex, "POS or Non-POS"),
      totalOrders: intOrNull(cell(row, headerIndex, "Total orders")),
    });
  }

  return result;
}
