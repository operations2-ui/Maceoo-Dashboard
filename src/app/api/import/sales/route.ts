import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseSalesCsv } from "@/lib/sales-parser";
import { resolveStoreId } from "@/lib/store-resolver";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const text = await file.text();
  let rows;
  try {
    rows = parseSalesCsv(text);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }

  const { rows: stores } = await pool.query("select id, name, code from stores");
  const { rows: aliases } = await pool.query("select store_id, source, alias_name from store_aliases");

  const unmatched = new Set<string>();
  let imported = 0;

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const r of rows) {
      const storeId = resolveStoreId(r.locationName, stores, aliases, "sheet");
      if (!storeId) {
        unmatched.add(r.locationName);
        continue;
      }
      await client.query(
        `insert into sales_daily
           (store_id, order_date, total_orders, gross_sales, discounts, refunds, net_sales, taxes, shipping, total_sales, cogs, gross_margin)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         on conflict (store_id, order_date)
         do update set total_orders = excluded.total_orders, gross_sales = excluded.gross_sales,
                        discounts = excluded.discounts, refunds = excluded.refunds, net_sales = excluded.net_sales,
                        taxes = excluded.taxes, shipping = excluded.shipping, total_sales = excluded.total_sales,
                        cogs = excluded.cogs, gross_margin = excluded.gross_margin`,
        [
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
        ],
      );
      imported++;
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({
    imported,
    skipped: rows.length - imported,
    unmatchedLocations: [...unmatched],
  });
}
