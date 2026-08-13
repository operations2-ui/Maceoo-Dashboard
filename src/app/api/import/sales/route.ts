import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseSalesCsv } from "@/lib/sales-parser";
import { resolveStoreId } from "@/lib/store-resolver";

interface DailyTotal {
  storeId: string;
  date: string;
  totalOrders: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  taxes: number;
  shipping: number;
  totalSales: number;
  cogs: number;
  grossMargin: number;
}

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
  // Each store/day is now one row per (user, discount-name combination)
  // slice of that day's orders, not a single per-day total — sum rows per
  // store+date before writing to sales_daily, and collect discount-named
  // slices separately for the discounts table.
  const dailyTotals = new Map<string, DailyTotal>();
  const discountRows: { storeId: string; date: string; userName: string; discountName: string; totalDiscounts: number; totalOrders: number | null }[] = [];
  let matchedRowCount = 0;

  for (const r of rows) {
    const storeId = resolveStoreId(r.locationName, stores, aliases, "sheet");
    if (!storeId) {
      unmatched.add(r.locationName);
      continue;
    }
    matchedRowCount++;

    const key = `${storeId}|${r.orderDate}`;
    let day = dailyTotals.get(key);
    if (!day) {
      day = {
        storeId,
        date: r.orderDate,
        totalOrders: 0,
        grossSales: 0,
        discounts: 0,
        refunds: 0,
        netSales: 0,
        taxes: 0,
        shipping: 0,
        totalSales: 0,
        cogs: 0,
        grossMargin: 0,
      };
      dailyTotals.set(key, day);
    }
    day.totalOrders += r.totalOrders ?? 0;
    day.grossSales += r.grossSales ?? 0;
    day.discounts += r.discounts ?? 0;
    day.refunds += r.refunds ?? 0;
    day.netSales += r.netSales ?? 0;
    day.taxes += r.taxes ?? 0;
    day.shipping += r.shipping ?? 0;
    day.totalSales += r.totalSales ?? 0;
    day.cogs += r.cogs ?? 0;
    day.grossMargin += r.grossMargin ?? 0;

    if (r.discountNames) {
      discountRows.push({
        storeId,
        date: r.orderDate,
        userName: r.userName,
        discountName: r.discountNames,
        totalDiscounts: r.discounts ?? 0,
        totalOrders: r.totalOrders,
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const d of dailyTotals.values()) {
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
          d.storeId,
          d.date,
          d.totalOrders,
          d.grossSales,
          d.discounts,
          d.refunds,
          d.netSales,
          d.taxes,
          d.shipping,
          d.totalSales,
          d.cogs,
          d.grossMargin,
        ],
      );
    }
    for (const r of discountRows) {
      await client.query(
        `insert into discounts (store_id, day_date, user_name, discount_name, total_discounts, total_orders)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (store_id, day_date, user_name, discount_name)
         do update set total_discounts = excluded.total_discounts, total_orders = excluded.total_orders`,
        [r.storeId, r.date, r.userName, r.discountName, r.totalDiscounts, r.totalOrders],
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({
    daysImported: dailyTotals.size,
    discountsImported: discountRows.length,
    skipped: rows.length - matchedRowCount,
    unmatchedLocations: [...unmatched],
  });
}
