import ExcelJS from "exceljs";
import type { SoldNegativeRow } from "@/lib/reports";

/** Builds the .xlsx attachment for the weekly Prior-Day Oversell alert email. */
export async function buildOversellWorkbook(storeName: string, date: string, rows: SoldNegativeRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Prior-Day Oversell");

  sheet.columns = [
    { header: "SKU", key: "sku", width: 18 },
    { header: "Description", key: "description", width: 34 },
    { header: "Style", key: "style_code", width: 16 },
    { header: "Size", key: "size_code", width: 10 },
    { header: "Prev Day On Hand", key: "prev_on_hand", width: 16 },
    { header: "Current On Hand", key: "curr_on_hand", width: 16 },
    { header: "Items Sold", key: "items_sold", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

  for (const r of rows) {
    sheet.addRow({
      sku: r.sku,
      description: r.description ?? "",
      style_code: r.style_code,
      size_code: r.size_code,
      prev_on_hand: r.prev_on_hand,
      curr_on_hand: r.curr_on_hand,
      items_sold: r.items_sold,
    });
  }

  sheet.insertRow(1, [`${storeName} — Prior-Day Oversell — ${date}`]);
  sheet.mergeCells(1, 1, 1, 7);
  sheet.getRow(1).font = { bold: true, size: 12 };
  sheet.getRow(2).font = { bold: true };
  sheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
