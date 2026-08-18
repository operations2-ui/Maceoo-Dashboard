import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSoldNegative } from "@/lib/reports";
import { buildOversellWorkbook } from "@/lib/oversell-excel";
import { sendOversellAlert } from "@/lib/email";

// Building an .xlsx per store and sending mail can take a while across ~10 stores.
export const maxDuration = 60;

/**
 * Weekly Prior-Day Oversell email, triggered by Vercel Cron (see vercel.json,
 * Tuesdays). Same shared-secret auth as the /api/cron/sync-* routes — no user session at
 * cron time. Stores without a to_email set are skipped, as are stores with
 * zero flagged items for the date (no "all clear" noise).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const { rows: stores } = await pool.query(
    "select id, name, to_email, cc_email from stores where to_email is not null and to_email <> ''",
  );

  const results: { store: string; sent: boolean; items: number; error?: string }[] = [];

  for (const store of stores) {
    try {
      const rows = await getSoldNegative([store.id], date);
      if (rows.length === 0) {
        results.push({ store: store.name, sent: false, items: 0 });
        continue;
      }
      const attachment = await buildOversellWorkbook(store.name, date, rows);
      await sendOversellAlert({
        to: store.to_email,
        cc: store.cc_email,
        storeName: store.name,
        date,
        rows,
        attachment,
      });
      results.push({ store: store.name, sent: true, items: rows.length });
    } catch (e) {
      results.push({ store: store.name, sent: false, items: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ date, results });
}
