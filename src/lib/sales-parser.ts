import { parseRawCsv, findHeaderRowIndex, buildHeaderIndex, cell, numOrNull, intOrNull } from "./csv-utils";
import { parseFlexibleDate } from "./date-utils";

export interface SalesRow {
  locationName: string;
  orderDate: string;
  /** Globally unique per order. Multiple rows can now share the same order name — see file doc comment. */
  orderName: string;
  userName: string;
  /** Comma-separated discount names applied to this order, or "" if none. */
  discountNames: string;
  /** Line-item detail — varies per row, unlike the order-level fields above which repeat across every line of an order. */
  productCategory: string;
  productType: string;
  coreSku: string;
  variantSku: string;
  customerType: string;
  customerTags: string;
  customerFullName: string;
  customerTotalNetSpent: number | null;
  /** Units sold on this line; negative on a refund line (confirmed in live data). */
  quantity: number | null;
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
 * Parses the sales export. As of the latest sheet format, each order is
 * exploded into one row per line item (a real product/SKU line, or a
 * synthetic line like "[Tax]", "[Shipping]", "[Refund disc...", "[Tip]") —
 * confirmed against real data that each line carries its own slice of the
 * order's financials (not the whole order repeated), so summing every line
 * for an order reconstructs the true order total. Location Name, Order User
 * name, Order Discount names, and customer fields are order-level and
 * repeat identically across all of an order's lines — including staying
 * genuinely blank across every line for orders with no store attribution
 * (confirmed ~26% of rows). That means, unlike the older format, this one
 * must NOT forward-fill a blank Location Name from the previous row: doing
 * so would incorrectly attribute an unattributed order to whatever order
 * happened to precede it in the sheet.
 * Columns: Location Name, Order name, DAY Date, Order User name, Order
 * Discount names, Product Category, Product type, Core SKU, Variant SKU,
 * Order Customer type, Customer tags, Customer Full name, Customer Total
 * net spent, SUM Quantity, Total orders, Total gross sales, Total discounts,
 * Total refunds, Total net sales, Total taxes, Total shipping, Total sales,
 * Total cost of goods sold, Total gross margin.
 */
export function parseSalesCsv(csvText: string): SalesRow[] {
  const rows = parseRawCsv(csvText);
  const headerIdx = findHeaderRowIndex(rows, "Location Name");
  if (headerIdx === -1) throw new Error('Could not find header row (a cell === "Location Name")');

  const headerIndex = buildHeaderIndex(rows[headerIdx]);
  const result: SalesRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const dateRaw = cell(row, headerIndex, "DAY Date");
    if (!dateRaw) continue;

    result.push({
      locationName: cell(row, headerIndex, "Location Name"),
      orderDate: parseFlexibleDate(dateRaw),
      orderName: cell(row, headerIndex, "Order name"),
      userName: cell(row, headerIndex, "Order User name"),
      discountNames: cell(row, headerIndex, "Order Discount names"),
      productCategory: cell(row, headerIndex, "Product Category"),
      productType: cell(row, headerIndex, "Product type"),
      coreSku: cell(row, headerIndex, "Core SKU"),
      variantSku: cell(row, headerIndex, "Variant SKU"),
      customerType: cell(row, headerIndex, "Order Customer type"),
      customerTags: cell(row, headerIndex, "Customer tags"),
      customerFullName: cell(row, headerIndex, "Customer Full name"),
      customerTotalNetSpent: numOrNull(cell(row, headerIndex, "Customer Total net spent")),
      quantity: intOrNull(cell(row, headerIndex, "SUM Quantity")),
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
