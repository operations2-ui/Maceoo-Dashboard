import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseDiscountsCsv } from "@/lib/discounts-parser";
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
    rows = parseDiscountsCsv(text);
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
        `insert into discounts (store_id, day_date, user_name, discount_name, total_discounts, order_id, pos_flag, total_orders)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (store_id, day_date, order_id, discount_name)
         do update set user_name = excluded.user_name, total_discounts = excluded.total_discounts,
                        pos_flag = excluded.pos_flag, total_orders = excluded.total_orders`,
        [storeId, r.dayDate, r.userName, r.discountName, r.totalDiscounts, r.orderId, r.posFlag, r.totalOrders],
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
