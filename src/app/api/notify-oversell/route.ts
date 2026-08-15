import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getSoldNegative } from "@/lib/reports";
import { buildOversellWorkbook } from "@/lib/oversell-excel";
import { sendOversellAlert } from "@/lib/email";
import { pool } from "@/lib/db";

// Building an .xlsx per store and sending mail can take a while when "All stores" is selected.
export const maxDuration = 60;

interface NotifyResult {
  store: string;
  sent: boolean;
  items?: number;
  to?: string;
  reason?: string;
}

/**
 * On-demand version of the Tuesday /api/cron/oversell-emails job — lets a
 * user notify store manager(s) for whatever store/date they're currently
 * viewing on the Prior-Day Oversell page. Fully independent of the cron
 * route (no shared state), so manual sends never affect the weekly schedule.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { storeIds, date } = await request.json();
  if (!Array.isArray(storeIds) || storeIds.length === 0 || typeof date !== "string") {
    return NextResponse.json({ error: "storeIds[] and date are required" }, { status: 400 });
  }

  // Only ever notify stores this user is actually allowed to see.
  const accessible = await getAccessibleStores(user);
  const allowedIds = new Set(accessible.map((s) => s.id));
  const targetIds = storeIds.filter((id: unknown) => typeof id === "string" && allowedIds.has(id));
  if (targetIds.length === 0) {
    return NextResponse.json({ error: "No accessible stores in this selection" }, { status: 403 });
  }

  const { rows: stores } = await pool.query(
    "select id, name, to_email, cc_email from stores where id = any($1::uuid[]) order by name",
    [targetIds],
  );

  const results: NotifyResult[] = [];
  for (const store of stores) {
    if (!store.to_email) {
      results.push({ store: store.name, sent: false, reason: "No To Email set in Store Master" });
      continue;
    }
    try {
      const rows = await getSoldNegative([store.id], date);
      if (rows.length === 0) {
        results.push({ store: store.name, sent: false, reason: "No Prior-Day Oversell items for this date" });
        continue;
      }
      const attachment = await buildOversellWorkbook(store.name, date, rows);
      await sendOversellAlert({ to: store.to_email, cc: store.cc_email, storeName: store.name, date, rows, attachment });
      results.push({ store: store.name, sent: true, items: rows.length, to: store.to_email });
    } catch (e) {
      results.push({ store: store.name, sent: false, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ date, results });
}
