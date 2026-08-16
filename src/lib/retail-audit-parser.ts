import { parseRawCsv, findHeaderRowIndex, buildHeaderIndex, cell, numOrNull } from "./csv-utils";
import { parseDDMMYYYY } from "./date-utils";

export interface PoRawRow {
  internalId: string;
  documentNumber: string;
  poDate: string | null;
  vendorName: string;
  location: string;
  status: string;
  macPoType: string;
  macPoStatus: string;
  poStartDate: string | null;
  poCancelDate: string | null;
  dueDate: string | null;
  expectedReceiptDate: string | null;
  memo: string;
  lineId: string;
  item: string;
  displayName: string;
  quantity: number | null;
  quantityFulfilledReceived: number | null;
  inventoryLocation: string;
  quantityBilled: number | null;
  quantityCommitted: number | null;
}

/** Columns: Internal ID, Document Number, Date, Name, Location, Status, Mac PO Type,
 * Mac PO Status, PO Start Date, PO Cancel Date, Due Date/Receive By, Expected Receipt Date,
 * Memo (Main), Line ID, Item, Display Name, Quantity, Quantity Fulfilled/Received,
 * Inventory Location, Quantity Billed, Quantity Committed. */
export function parsePoRawCsv(csvText: string): PoRawRow[] {
  const rows = parseRawCsv(csvText);
  const headerIdx = findHeaderRowIndex(rows, "Document Number");
  if (headerIdx === -1) throw new Error('Could not find header row (a cell === "Document Number")');
  const headerIndex = buildHeaderIndex(rows[headerIdx]);

  const out: PoRawRow[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const documentNumber = cell(row, headerIndex, "Document Number");
    if (!documentNumber) continue;
    out.push({
      internalId: cell(row, headerIndex, "Internal ID"),
      documentNumber,
      poDate: parseDDMMYYYY(cell(row, headerIndex, "Date")),
      vendorName: cell(row, headerIndex, "Name"),
      location: cell(row, headerIndex, "Location"),
      status: cell(row, headerIndex, "Status"),
      macPoType: cell(row, headerIndex, "Mac PO Type"),
      macPoStatus: cell(row, headerIndex, "Mac PO Status"),
      poStartDate: parseDDMMYYYY(cell(row, headerIndex, "PO Start Date")),
      poCancelDate: parseDDMMYYYY(cell(row, headerIndex, "PO Cancel Date")),
      dueDate: parseDDMMYYYY(cell(row, headerIndex, "Due Date/Receive By")),
      expectedReceiptDate: parseDDMMYYYY(cell(row, headerIndex, "Expected Receipt Date")),
      memo: cell(row, headerIndex, "Memo (Main)"),
      lineId: cell(row, headerIndex, "Line ID"),
      item: cell(row, headerIndex, "Item"),
      displayName: cell(row, headerIndex, "Display Name"),
      quantity: numOrNull(cell(row, headerIndex, "Quantity")),
      quantityFulfilledReceived: numOrNull(cell(row, headerIndex, "Quantity Fulfilled/Received")),
      inventoryLocation: cell(row, headerIndex, "Inventory Location"),
      quantityBilled: numOrNull(cell(row, headerIndex, "Quantity Billed")),
      quantityCommitted: numOrNull(cell(row, headerIndex, "Quantity Committed")),
    });
  }
  return out;
}

export interface RetailAuditRawRow {
  vendor: string;
  poNumber: string;
  purchasingTransType: string;
  poDate: string | null;
  sku: string;
  itemName: string;
  quantityReceived: number | null;
  quantityBilled: number | null;
  customer: string;
  spNumber: string;
  salesTransType: string;
  salesTransDate: string | null;
  quantityShipped: number | null;
  quantityInvoiced: number | null;
}

/** Columns: Vendor, Purchasing Trans, Purchasing Trans Type, Purchasing Trans Date,
 * Inventory Item: Name, Inventory Item: Display Name, Quantity Received, Quantity Billed,
 * Customer, Sales Trans, Sales Trans Type, Sales Trans Date, Quantity Shipped, Quantity Invoiced. */
export function parseRetailAuditRawCsv(csvText: string): RetailAuditRawRow[] {
  const rows = parseRawCsv(csvText);
  const headerIdx = findHeaderRowIndex(rows, "Purchasing Trans");
  if (headerIdx === -1) throw new Error('Could not find header row (a cell === "Purchasing Trans")');
  const headerIndex = buildHeaderIndex(rows[headerIdx]);

  const out: RetailAuditRawRow[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const poNumber = cell(row, headerIndex, "Purchasing Trans");
    if (!poNumber) continue;
    out.push({
      vendor: cell(row, headerIndex, "Vendor"),
      poNumber,
      purchasingTransType: cell(row, headerIndex, "Purchasing Trans Type"),
      poDate: parseDDMMYYYY(cell(row, headerIndex, "Purchasing Trans Date")),
      sku: cell(row, headerIndex, "Inventory Item: Name"),
      itemName: cell(row, headerIndex, "Inventory Item: Display Name"),
      quantityReceived: numOrNull(cell(row, headerIndex, "Quantity Received")),
      quantityBilled: numOrNull(cell(row, headerIndex, "Quantity Billed")),
      customer: cell(row, headerIndex, "Customer"),
      spNumber: cell(row, headerIndex, "Sales Trans"),
      salesTransType: cell(row, headerIndex, "Sales Trans Type"),
      salesTransDate: parseDDMMYYYY(cell(row, headerIndex, "Sales Trans Date")),
      quantityShipped: numOrNull(cell(row, headerIndex, "Quantity Shipped")),
      quantityInvoiced: numOrNull(cell(row, headerIndex, "Quantity Invoiced")),
    });
  }
  return out;
}

export interface RetailAuditDashboardRow {
  poNumber: string;
  poDate: string | null;
  poStatus: string;
  relatedSp: string;
  vendorName: string;
  orderedQuantity: number | null;
  billedQuantity: number | null;
  shippedQuantity: number | null;
  receivedQuantity: number | null;
  diffShippedReceived: number | null;
  diffReceivedBilled: number | null;
}

/** Columns (first 11 of 18 — the rest are ad-hoc audit-tracking notes not
 * needed for the summary page): PO Number, Date of PO, PO Status (From PO
 * File), Related SP, Vendor Name, Ordered Quantity, Billed Quantity, Shipped
 * Quantity, Received Quantity, Difference Between Shipped and Received,
 * Difference Between Received and Billed. */
export function parseDashboardCsv(csvText: string): RetailAuditDashboardRow[] {
  const rows = parseRawCsv(csvText);
  const headerIdx = findHeaderRowIndex(rows, "PO Number");
  if (headerIdx === -1) throw new Error('Could not find header row (a cell === "PO Number")');
  const headerIndex = buildHeaderIndex(rows[headerIdx]);

  const out: RetailAuditDashboardRow[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const poNumber = cell(row, headerIndex, "PO Number");
    if (!poNumber) continue;
    out.push({
      poNumber,
      poDate: parseDDMMYYYY(cell(row, headerIndex, "Date of PO")),
      poStatus: cell(row, headerIndex, "PO Status (From PO File)"),
      relatedSp: cell(row, headerIndex, "Related SP"),
      vendorName: cell(row, headerIndex, "Vendor Name"),
      orderedQuantity: numOrNull(cell(row, headerIndex, "Ordered Quantity")),
      billedQuantity: numOrNull(cell(row, headerIndex, "Billed Quantity")),
      shippedQuantity: numOrNull(cell(row, headerIndex, "Shipped Quantity")),
      receivedQuantity: numOrNull(cell(row, headerIndex, "Received Quantity")),
      diffShippedReceived: numOrNull(cell(row, headerIndex, "Difference Between Shipped and Received")),
      diffReceivedBilled: numOrNull(cell(row, headerIndex, "Difference Between Received and Billed")),
    });
  }
  return out;
}
