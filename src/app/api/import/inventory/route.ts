import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseInventoryCsv } from "@/lib/inventory-parser";
import { parseFlexibleDate } from "@/lib/date-utils";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const form = await request.formData();
  const file = form.get("file");
  const storeId = form.get("storeId");
  const asOfDateOverride = form.get("asOfDate");

  if (!(file instanceof File) || typeof storeId !== "string" || !storeId) {
    return NextResponse.json({ error: "file and storeId are required" }, { status: 400 });
  }

  const text = await file.text();

  let snapshotDate: string;
  if (typeof asOfDateOverride === "string" && asOfDateOverride) {
    snapshotDate = asOfDateOverride;
  } else {
    const asOfMatch = text.match(/As of\s+(.+)/i);
    if (!asOfMatch) {
      return NextResponse.json(
        { error: 'Could not find "As of <date>" in the file; pass asOfDate explicitly.' },
        { status: 400 },
      );
    }
    snapshotDate = parseFlexibleDate(asOfMatch[1]);
  }

  let rows;
  try {
    rows = parseInventoryCsv(text);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No variant rows found in file" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const r of rows) {
      await client.query(
        `insert into inventory_snapshots
           (store_id, snapshot_date, sku, style_code, size_code, description, vendor, on_hand)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (store_id, snapshot_date, sku)
         do update set style_code = excluded.style_code, size_code = excluded.size_code,
                        description = excluded.description, vendor = excluded.vendor, on_hand = excluded.on_hand`,
        [storeId, snapshotDate, r.sku, r.styleCode, r.sizeCode, r.description, r.vendor, r.onHand],
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ imported: rows.length, snapshotDate });
}
